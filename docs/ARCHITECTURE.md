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
