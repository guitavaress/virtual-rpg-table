# Virtual RPG Table

Camada visual local que transforma a câmera coletiva de uma chamada do Google Meet (cinco pessoas na mesma mesa) em retratos individuais, mais um card para o jogador remoto. A conversa e o áudio continuam no Meet.

> **Estado:** Fase 1 completa (cinco retratos com recortes manuais, mesa com 6 cards e configuração salva no navegador). F1.5 em andamento: W0 (câmera deste computador) feita; W1 (publicação na Cloudflare e esqueleto da sinalização) nesta branch. Especificação completa em [`docs/virtual-rpg-table-plano-claude-gpt.md`](docs/virtual-rpg-table-plano-claude-gpt.md).

## Privacidade e limites

- A captura só começa com clique e com a escolha da aba/janela no **seletor do próprio navegador**. A permissão precisa ser renovada a cada sessão.
- O vídeo é processado só no navegador. Nada é gravado, enviado ou retransmitido. O app ainda não usa o Worker de sinalização da F1.5 (`worker/`); isso vem na W2. Ele só troca mensagens de conexão e nunca recebe vídeo.
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
| `npm run test:app`       | Só os testes do app                           |
| `npm run test:worker`    | Só os testes do Worker (runtime workerd)      |

Na primeira vez, instale também as dependências do Worker com `npm ci --prefix worker`; `npm test` e `npm run typecheck` cobrem o app e o Worker. Instale o navegador do Playwright com `npx playwright install chromium`. Ele fica em `~/.cache/ms-playwright`, fora do projeto. O E2E sobe o dev server sozinho, ou reaproveita um que já esteja rodando na porta 5173.

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

### Câmera da sala, W0 (F1.5): spike sem rede

Objetivo: descobrir se o Meet e este app **dividem a mesma webcam** e qual resolução a câmera realmente entrega. O resultado decide se a W1 segue com o plano principal (câmera direta via WebRTC) ou com o plano B (sala só com áudio no Meet). A automação só cobre a câmera falsa do Chromium, então este teste no PC da SALA é obrigatório.

Preparação: no PC da sala, num navegador só (Chrome **ou** Edge), com o Meet aberto e **usando a câmera**.

1. Abra o app em **outra aba do MESMO navegador** (mesmo perfil) em que o Meet está aberto.
2. Em **Câmera deste computador**, clique no botão. O primeiro clique pede a permissão e lista as câmeras.
3. Escolha a câmera da sala e a qualidade **1080p**, e clique em **Usar câmera deste computador**.
4. Na Calibração, anote **Resolução da fonte** (do `<video>`) e **Entregue pela câmera** (`track.getSettings()`, com fps).
5. Volte para a aba do Meet e confira o vídeo da sala.
6. Repita com a qualidade **720p**.
7. Clique em **Parar captura**: a câmera deve continuar no Meet, e a luz só apaga quando o Meet também a liberar.
8. Repita tudo em outro navegador (Edge ↔ Chrome) e também com o app num navegador **diferente** do Meet, para registrar o comportamento.

Anote para cada combinação:

| Navegador do app       | Navegador do Meet | Funcionou?  | Resolução real (1080p / 720p)          | Meet manteve o vídeo? | Mensagem de erro |
| ---------------------- | ----------------- | ----------- | -------------------------------------- | --------------------- | ---------------- |
| Chrome (outra aba)     | Chrome            | Sim         | 1920×1080 a 30 fps / 1280×720 a 30 fps | Sim                   | —                |
| Edge                   | Edge              | não testado | —                                      | —                     | —                |
| Navegadores diferentes | —                 | não testado | —                                      | —                     | —                |

Se aparecer "A câmera está em uso por outro programa", é o `NotReadableError`: no Windows, programas (e às vezes navegadores) diferentes não compartilham a webcam. Esse resultado também vale como dado do gate.

### Sua webcam no card Remoto (F1.5)

O card "Remoto" pode usar a sua webcam, ao mesmo tempo que a captura do Meet alimenta os 5 retratos. São duas fontes independentes.

1. Capture a aba do Meet e vá em **Próximo: jogadores**.
2. No quadro "Jogador remoto (você)", escolha **Minha webcam**, clique em **Permitir e listar câmeras**, escolha a câmera e clique em **Ligar minha webcam**.
   - [ ] A prévia "Sua webcam" aparece e a moldura tracejada se arrasta sobre o seu rosto.
   - [ ] A resolução entregue aparece embaixo da prévia.
3. Clique em **Ir para a mesa**:
   - [ ] Os 5 retratos vêm do Meet e o card Remoto vem da sua webcam, os dois ao vivo.
   - [ ] O Meet continua mostrando o seu vídeo (use o MESMO navegador do Meet).
4. Desligue a webcam pelo sistema (ou desconecte-a):
   - [ ] Só o card Remoto fica em "Fonte perdida", com o botão **Reconectar webcam**. Os 5 retratos continuam.
5. Clique em **Parar captura**:
   - [ ] A luz da webcam apaga e o indicador de compartilhamento some.

### Mesa (F1)

1. Com a aba do Meet capturada, ajuste a moldura da câmera coletiva e clique em **Próximo: jogadores**.
2. Clique em **Distribuir automaticamente** e ajuste cada recorte sobre um rosto: arraste para mover e use a alça do canto ou o slider para o zoom.
   - [ ] As miniaturas do painel acompanham os recortes.
3. Preencha nomes e personagens. No 6º card, escolha **Recorte da captura** e posicione a moldura tracejada sobre o seu próprio vídeo no Meet, se ele aparecer.
4. Clique em **Ir para a mesa**:
   - [ ] Cinco retratos ao vivo, sem deformação, e o card "Remoto".
   - [ ] Os retratos **continuam se mexendo** depois de 1 minuto na mesa. O vídeo da fonte fica oculto nessa tela, e isso só pode ser confirmado no navegador real.
   - [ ] Tudo cabe na tela em 1080p.
5. Recarregue a página e capture o Meet de novo:
   - [ ] Abre direto na mesa, com os nomes mantidos.
6. Use **Parar compartilhamento** na barra do navegador:
   - [ ] A mesa continua, com "Fonte perdida", e **Reconectar** volta ao vivo.
7. Volte em **Calibrar → 1. Câmera coletiva** e mova a moldura:
   - [ ] Os 5 recortes acompanham.

## Deploy (Cloudflare)

São duas peças, numa conta Cloudflare só:

| Peça                                      | Onde                                | Como publica                                                                     |
| ----------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| Site (este app, estático)                 | Cloudflare Pages, `*.pages.dev`     | Integração Git do Pages: push na `main` = produção; outras branches = prévia     |
| Worker `vrt-signal` (sinalização da F1.5) | Cloudflare Workers, `*.workers.dev` | GitHub Actions, job `deploy-worker`: só na `main` e só depois de todo o CI verde |

**Onde fica cada segredo.** Nenhum vai para arquivo versionado nem leva o prefixo `VITE_` (o Vite embute essas variáveis no bundle público).

| Segredo                             | Fica em                                 | Para quê                                                                                   |
| ----------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------ |
| `TURN_KEY_ID`, `TURN_KEY_API_TOKEN` | Secrets do Worker, na Cloudflare        | **Opcionais, ainda não configurados (D-020).** O Worker pede credenciais TURN curtas (4 h) |
| `CLOUDFLARE_API_TOKEN`              | Secret do repositório no GitHub Actions | O CI publica o Worker                                                                      |
| `CLOUDFLARE_ACCOUNT_ID`             | Secret do repositório no GitHub Actions | Idem (não é sigiloso, mas fica junto)                                                      |

### Primeira configuração (uma vez)

1. **Pages.** No painel da Cloudflare, vá em **Workers & Pages → Create application → Pages → Connect to Git**. Autorize o GitHub só para o repositório `virtual-rpg-table` e preencha:
   - Project name: `virtual-rpg-table`. Ele vira o endereço `https://virtual-rpg-table.pages.dev`;
   - Production branch: `main`;
   - Framework preset: `None`;
   - Build command: `npm run build`;
   - Build output directory: `dist`.

   A versão do Node vem do arquivo `.node-version`.

2. **Origens.** Se o endereço do Pages saiu diferente, troque `ALLOWED_ORIGINS` em `worker/wrangler.toml` (o endereço exato e o `https://*.` das prévias) e rode `npm run types --prefix worker`.
3. **Token de API.** Vá em **My Profile → API Tokens → Create Token** e use o modelo **Edit Cloudflare Workers**. Deixe a conta como **Entire account**; as zonas ficam em **All zones** (sem domínio próprio, isso não dá acesso a nada). O token aparece uma vez só: guarde fora do repositório até o passo 6.
4. **Secrets do GitHub.** No repositório, vá em **Settings → Secrets and variables → Actions → New repository secret** e cadastre `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`. O Account ID aparece na página inicial da conta, em **Account details**.
5. **Chave TURN:** fica **pendente** (D-020). Ativar o Realtime exige cadastrar cartão ou PayPal, mesmo dentro da franquia grátis. Veja "Ativar o TURN" abaixo.
6. **Primeiro deploy do Worker.** Rode isto num terminal WSL seu, **não** colado em chat:

   ```bash
   cd ~/virtual-rpg-table/worker
   npm ci
   read -rs CLOUDFLARE_API_TOKEN && export CLOUDFLARE_API_TOKEN   # cole o token (não aparece)
   read -r CLOUDFLARE_ACCOUNT_ID && export CLOUDFLARE_ACCOUNT_ID  # cole o Account ID
   npx wrangler deploy
   unset CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
   ```

   A partir daqui, cada merge na `main` republica o Worker sozinho.

7. **Conferir:**
   - `curl https://vrt-signal.<seu-subdominio>.workers.dev/api/health` deve responder `{"ok":true}`;
   - o site abre em HTTPS no endereço do Pages.

### Ativar o TURN (decidir antes da W3)

1. No painel, vá em **Realtime**. Cadastre o meio de pagamento: o total é US$ 0,00 agora, a cobrança só acontece acima de 1.000 GB/mês, e a assinatura pode ser cancelada em **Billing → Subscriptions**.
2. Crie um alerta de cobrança em **Manage Account → Billing → Notifications**.
3. Vá em **TURN Server → Create** (nome: `vrt-turn`) e guarde o **Turn Token ID** e o **API Token**.
4. No seu terminal, com o token de API exportado como no passo 6, rode:

   ```bash
   npx wrangler secret put TURN_KEY_ID         # cole o Turn Token ID
   npx wrangler secret put TURN_KEY_API_TOKEN  # cole o API Token da TURN
   ```

   O `wrangler deploy` não apaga os secrets. Não declare esses secrets em `[secrets].required` no `wrangler.toml`: com eles obrigatórios, o deploy falha enquanto não existirem.

### Rotina e manutenção

- **Trocar a chave TURN:** crie uma chave nova no painel e rode `npx wrangler secret put` de novo, com o token de API exportado como no passo 6. Depois, apague a chave antiga.
- **Revogar o token de API:** em **My Profile → API Tokens**. Depois, cadastre um novo token no GitHub.
- **Worker local:** `npm run dev --prefix worker` sobe em `http://localhost:8787`. Para aceitar o app local, crie `worker/.dev.vars` (ignorado pelo git) com a linha `ALLOWED_ORIGINS=http://localhost:5173`. Sem os secrets TURN, a rota `/api/turn` responde 503.
- **Rotas do Worker:** `GET /api/health`, `POST /api/rooms`, `GET /api/signal` (WebSocket) e `POST /api/turn`. Os detalhes estão em `docs/ARCHITECTURE.md`.

## Documentação

- [`AGENTS.md`](AGENTS.md): regras e protocolo para os agentes (Claude e Codex).
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): módulos e pipeline.
- [`docs/DECISIONS.md`](docs/DECISIONS.md): decisões registradas.
- [`docs/tasks/`](docs/tasks): tarefas por fase.
