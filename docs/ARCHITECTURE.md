# Arquitetura (Fase 0)

```text
 clique do usuário
       │
       ▼
 VideoSource ──────────────┬─────────────────────────┬──────────────────────────┐
 (features/capture/types)  │                         │                          │
                CapturedDisplaySource      LocalVideoFileSource        SyntheticTestSource
                getDisplayMedia(audio:false) object URL do arquivo      canvas.captureStream(30)
                           │                         │                          │
                           └────────────┬────────────┴──────────────────────────┘
                                        ▼
                         CaptureSession (sem React)
             idle → requesting → active → ended | error, contador de geração
                                        │  useCapture (useSyncExternalStore)
                                        ▼
                  App ── CaptureSetup (Tela A) | CalibrationView (Tela B)
                                        │
             useAttachedVideo (ref callback: liga/desliga srcObject/src, sempre mudo)
                                        │
                    ┌───────────────────┴────────────────────┐
                    ▼                                        ▼
       RoiEditor (overlay, pointer + teclado)   RoiPreview (canvas, requestVideoFrameCallback)
                    │                                        │
                    └──── roi.ts (geometria pura em [0,1]) ──┘
```

## Módulos

| Caminho                                   | Responsabilidade                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/features/capture/types.ts`           | Contrato `VideoSource`, `CaptureState`, `CaptureError`                                     |
| `src/features/capture/captureSession.ts`  | Fonte única ativa; libera recursos em stop, troca, `ended` e corrida                       |
| `src/features/capture/streamOwnership.ts` | Para tracks e escuta `ended` de um `MediaStream`                                           |
| `src/features/capture/displaySource.ts`   | `getDisplayMedia` com `selfBrowserSurface: 'exclude'` (evita recursão)                     |
| `src/features/capture/fileSource.ts`      | Vídeo local via object URL (revogado no stop)                                              |
| `src/features/capture/syntheticSource.ts` | Fonte determinística para desenvolvimento                                                  |
| `src/features/capture/errors.ts`          | `DOMException` → código de erro da UI                                                      |
| `src/features/calibration/roi.ts`         | Letterbox (`object-fit: contain`), conversões, clamp, mover/redimensionar, px da fonte     |
| `src/features/calibration/RoiEditor.tsx`  | Moldura arrastável com 8 alças e controle por teclado                                      |
| `src/features/calibration/RoiPreview.tsx` | Desenha o recorte a cada frame novo e mede o FPS da fonte; é a semente do compositor da F1 |
| `src/features/calibration/useVideo.ts`    | Liga a mídia ao `<video>`, lê o tamanho intrínseco e mantém o loop rVFC/rAF                |

## Invariantes

- A ROI é **normalizada** em relação ao frame da fonte. Por isso continua válida quando a janela, o container ou a resolução da captura mudam.
- `CaptureSession.start()` chama `source.start()` **antes** do primeiro `await`, mantendo a ativação do usuário exigida por `getDisplayMedia`.
- Um request que termina depois de `stop()` ou de um `start()` mais novo é descartado e suas tracks são paradas.
- O `<video>` sempre fica `muted`. Nenhum áudio é solicitado, e tracks de áudio inesperadas são descartadas.
- O canvas só desenha, nunca lê pixels de volta (`getImageData`). Nada sai do navegador.

# Fase 1: retratos e mesa

```text
 TableConfig (features/table/model.ts) ── localStorage (storage.ts, validado)
   ├─ roi: NormRect                 (frame)
   ├─ players[5].crop: PortraitCrop (relativo à ROI)  ┐
   └─ remote.crop: PortraitCrop     (relativo ao frame)┤
                                                       ▼
                           portraitFrameRect (compositor/portrait.ts)
                           → NormRect do frame, sempre 3:4 em pixels
                                                       │
            usePortraitRenderer: 1 loop rVFC → drawImage em N canvases
                    │                                     │
     CalibrationView (passo 2: CropEditor + miniaturas)   TableView (6 PlayerCards)
```

| Caminho                                          | Responsabilidade                                                                        |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `src/features/compositor/portrait.ts`            | `PortraitCrop {cx, cy, size}` → retângulo 3:4; clamp na região; distribuição em colunas |
| `src/features/compositor/usePortraitRenderer.ts` | Registro de canvases por slot e um único loop de desenho por tela                       |
| `src/features/table/model.ts`                    | `TableConfig`, padrões, cores dos slots, iniciais                                       |
| `src/features/table/storage.ts`                  | Validação de JSON não confiável, load/save/clear tolerantes a falha                     |
| `src/features/calibration/CropEditor.tsx`        | Molduras 3:4 arrastáveis (mover, zoom pela alça, teclado)                               |
| `src/components/Calibration/PlayersPanel.tsx`    | Miniaturas ao vivo, nome, personagem, zoom e modo do remoto                             |
| `src/components/VirtualTable/TableView.tsx`      | Mesa: layout, vídeo oculto, aviso de fonte perdida e reconexão                          |
| `src/components/PlayerCard/PlayerCard.tsx`       | Card 3:4 com iniciais por baixo do canvas e placa de nome                               |

## Invariantes da F1

- Os recortes dos jogadores são relativos à ROI: mover a ROI move os 5 juntos. O do remoto é relativo ao frame.
- A proporção 3:4 é garantida em pixels da fonte. Depois do arredondamento para pixels inteiros, o desvio é de no máximo 1 px.
- Cada tela tem o seu próprio `<video>` (o da mesa fica oculto). Trocar de tela reanexa o mesmo `MediaStream`; nenhuma track nova é pedida.
- O `localStorage` guarda só a configuração (ROI, recortes, nomes, personagens e modo do remoto), nunca frames.
