# Virtual RPG Table

Camada visual local que transforma a câmera coletiva de uma chamada do Google Meet (cinco pessoas na mesma mesa) em retratos individuais, mais um card para o jogador remoto. A conversa e o áudio continuam no Meet.

> **Estado:** Fase 1 (cinco retratos com recortes manuais, mesa com 6 cards e configuração salva no navegador). Especificação completa em [`docs/virtual-rpg-table-plano-claude-gpt.md`](docs/virtual-rpg-table-plano-claude-gpt.md).

## Privacidade e limites

- A captura só começa com clique e com a escolha da aba/janela no **seletor do próprio navegador**. A permissão precisa ser renovada a cada sessão.
- O vídeo é processado só no navegador. Nada é gravado, enviado ou retransmitido, e não há backend.
- O áudio **não** é capturado (`audio: false`) e o `<video>` fica sempre mudo.
- Sem reconhecimento facial de identidade. Nomes e associações serão manuais.
- O app não consegue recuperar detalhes que não vieram na chamada: se a câmera coletiva chega pequena, os recortes ficam borrados.

## Requisitos

- WSL2 com Ubuntu, Node.js ≥ 22 e npm. O projeto deve ficar no filesystem Linux (`~/...`), não em `/mnt/c`.
- Chrome ou Edge no Windows para testar a captura real.

## Rodando

```bash
npm install
npm run dev -- --host 127.0.0.1
```

Abra `http://localhost:5173` no Chrome/Edge **do Windows**. O WSL2 encaminha `localhost` para o Linux por padrão. Se a página não abrir:

1. Confira se `localhostForwarding` não está desativado no `%UserProfile%\.wslconfig`.
2. Alternativa: em `[wsl2]`, use `networkingMode=mirrored` e rode `wsl --shutdown`.

`getDisplayMedia` só funciona em contexto seguro: `localhost` ou HTTPS. Um IP da rede (`http://192.168...`) **não** funciona.

### Fontes de teste (sem chamada real)

- **Fonte sintética:** cinco jogadores desenhados em canvas, 1280×720 a 30 fps. Não pede permissão.
- **Vídeo local:** qualquer arquivo de vídeo seu. Use só vídeos com consentimento de quem aparece neles.

## Scripts

| Comando                  | O que faz                                     |
| ------------------------ | --------------------------------------------- |
| `npm run dev`            | Servidor de desenvolvimento (Vite)            |
| `npm run build`          | Typecheck + build de produção em `dist/`      |
| `npm run preview`        | Serve o build                                 |
| `npm run lint`           | oxlint (avisos contam como erro)              |
| `npm run typecheck`      | `tsc -b` (strict)                             |
| `npm test`               | Vitest (unidade + componentes, jsdom)         |
| `npm run format[:check]` | Prettier                                      |
| `npm run test:e2e`       | Playwright (Chromium) sobre a fonte sintética |

Na primeira vez, instale o navegador do Playwright com `npx playwright install chromium`. Ele fica em `~/.cache/ms-playwright`, fora do projeto. O E2E sobe o dev server sozinho, ou reaproveita um que já esteja rodando na porta 5173.

## Smoke test manual (Chrome **e** Edge no Windows)

A automação não reproduz o seletor de janela do navegador, então este roteiro é obrigatório a cada mudança na captura.

1. Abra uma chamada do Meet (pode ser só você) numa aba e o app em outra.
2. Clique em **Selecionar fonte de vídeo**:
   - [ ] A aba do próprio VTT **não** aparece no seletor.
   - [ ] Não há opção de compartilhar áudio.
3. Escolha a **aba** do Meet:
   - [ ] Aparece o vídeo, com resolução e FPS no painel.
   - Observação: o Chrome pode trocar o foco para a aba do Meet ao compartilhar. Volte para a aba do app para calibrar.
4. Arraste e redimensione a moldura:
   - [ ] A prévia acompanha a moldura.
   - [ ] Setas e Shift+setas funcionam.
5. Redimensione a janela do navegador:
   - [ ] A moldura continua sobre a mesma região do vídeo.
6. Clique em **Escolher outra aba/janela** e escolha a **janela** do Meet:
   - [ ] O indicador de compartilhamento anterior some.
7. Cancele o seletor numa nova tentativa:
   - [ ] Aparece mensagem de cancelamento, sem travar.
8. Use o botão **Parar compartilhamento** da barra do navegador:
   - [ ] O app volta ao setup com o aviso de encerramento.
9. Clique em **Parar captura**:
   - [ ] O indicador de compartilhamento do navegador some.
   - [ ] Opcional: `chrome://webrtc-internals` (ou `edge://webrtc-internals`) não mostra captura ativa.
10. Repita o passo 3 escolhendo a **tela inteira**.
    - Observação: no Windows, uma janela **minimizada** pode congelar a captura. Prefira capturar a aba.

### Mesa (F1)

1. Com a aba do Meet capturada, ajuste a moldura da câmera coletiva e clique em **Próximo: jogadores**.
2. Clique em **Distribuir automaticamente** e ajuste cada recorte sobre um rosto: arraste para mover e use a alça do canto ou o slider para o zoom.
   - [ ] As miniaturas do painel acompanham os recortes.
3. Preencha nomes e personagens. No 6º card, escolha **Recorte da captura** e posicione a moldura tracejada sobre o seu próprio vídeo no Meet, se ele aparecer.
4. Clique em **Ir para a mesa**:
   - [ ] Cinco retratos ao vivo, sem deformação, e o card "Remoto".
   - [ ] Tudo cabe na tela em 1080p.
5. Recarregue a página e capture o Meet de novo:
   - [ ] Abre direto na mesa, com os nomes mantidos.
6. Use **Parar compartilhamento** na barra do navegador:
   - [ ] A mesa continua, com "Fonte perdida", e **Reconectar** volta ao vivo.
7. Volte em **Calibrar → 1. Câmera coletiva** e mova a moldura:
   - [ ] Os 5 recortes acompanham.

## Documentação

- [`AGENTS.md`](AGENTS.md): regras e protocolo para os agentes (Claude e Codex).
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): módulos e pipeline.
- [`docs/DECISIONS.md`](docs/DECISIONS.md): decisões registradas.
- [`docs/tasks/`](docs/tasks): tarefas por fase.
