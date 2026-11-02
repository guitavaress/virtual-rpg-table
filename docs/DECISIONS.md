# Decisões

Formato: contexto → decisão → consequência. Entradas mais novas no fim.

## D-001 — npm como package manager (2026-11-01)

- **Contexto:** o plano pede um único package manager com lockfile.
- **Decisão:** npm 11 com `package-lock.json` versionado. O CI usa `npm ci`.
- **Consequência:** funciona sem configuração extra no CI e no ambiente do Codex.

## D-002 — `AGENTS.md` na raiz, não em `docs/` (2026-11-01)

- **Contexto:** o plano previa `docs/AGENTS.md`, mas o Codex lê `AGENTS.md` automaticamente da raiz.
- **Decisão:** `AGENTS.md` fica na raiz. O `CLAUDE.md` aponta para ele.

## D-003 — Template Vite 9: oxlint em vez de ESLint (2026-11-01)

- **Contexto:** o template `react-ts` do `create-vite@9.3.3` já vem com Vite 8, React 19, TypeScript 7 e **oxlint**.
- **Decisão:** manter o oxlint, com as regras de hooks do React Compiler ligadas e `--deny-warnings`. Somar Prettier para formatação.
- **Consequência:** o plano fala em ESLint, mas o objetivo (lint estrito no CI) continua atendido.

## D-004 — Tailwind CSS v4 desde a F0 (2026-11-01)

- **Decisão:** usar `@tailwindcss/vite`, com tema escuro por padrão. Evita reestilizar a UI na F1.

## D-005 — Playwright adiado para a F1 (2026-11-01)

- **Contexto:** na F0 o fluxo é curto e o seletor real de `getDisplayMedia` não é automatizável.
- **Decisão:** a F0 usa Vitest com jsdom e fakes de `MediaStream`. O E2E com Playwright entra na F1 junto com o fluxo dos 5 crops, rodando sobre a fonte sintética.

## D-006 — Fonte sintética via `canvas.captureStream()` (2026-11-01)

- **Decisão:** além do vídeo local, há uma fonte sintética: cinco "jogadores" desenhados, 1280×720 a 30 fps.
- **Consequência:** permite desenvolver e testar sem chamada real, sem permissão e sem expor rostos de ninguém. Não serve para validar a detecção facial da F2, que vai precisar de vídeo consentido.

## D-007 — Trocar fonte encerra a anterior antes de pedir a nova (2026-11-01)

- **Decisão:** `CaptureSession.start()` libera a fonte atual antes de abrir o seletor.
- **Consequência:** se o usuário cancelar o seletor durante a troca, o app volta ao setup com a mensagem de cancelamento, e a ROI é mantida. É mais simples e não há chance de duas capturas simultâneas. Pode ser revisto depois do piloto.

## D-008 — Jev (TypeSafe AI) fora do runtime (2026-11-01)

- **Contexto:** o Jev é um modelo de decisões tipadas (sim/não, escolha, nota, caixa em imagem) acessado por API na nuvem.
- **Decisão:** ele **não** entra no app, porque enviar frames da chamada viola a regra de processamento local sem upload. Fica como candidato para a F2/F4 como **avaliador offline de desenvolvimento**: um script em `scripts/` que dá nota à qualidade dos crops do auto-framing em vídeo de teste consentido.
- **Regra de segredos:** a chave fica numa variável de ambiente lida só por scripts Node. Nunca usar o prefixo `VITE_`, porque o Vite injeta essas variáveis no bundle público. Nunca versionar a chave.

## D-009 — Revisão da F0 feita por Opus, como exceção (2026-11-01)

- **Contexto:** o limite de uso do Codex estourou durante a revisão da F0.
- **Decisão:** o product owner autorizou, como exceção, que a revisão independente fosse feita por um agente Claude Opus em esforço alto, com o mesmo prompt de revisão do `AGENTS.md`, sem acesso de escrita e sem ter participado da implementação.
- **Consequência:** a revisão é menos independente do que com outro fornecedor. Nas próximas fases o revisor volta a ser o GPT/Codex.

## D-010 — `CaptureController` da especificação passa a se chamar `CaptureSession` (2026-11-01)

- **Contexto:** `CaptureController` é também o nome de um global nativo do navegador. Ele é usado, por exemplo, em `setFocusBehavior`, que impede o Chrome de trocar o foco para a aba capturada.
- **Decisão:** a classe do app se chama `CaptureSession`. A especificação original continua citando `CaptureController` e não foi alterada.

## D-011 — Retrato 3:4 modelado como centro + altura (2026-11-01)

- **Contexto:** o PO escolheu retratos 3:4 verticais. Um retângulo livre normalizado não preserva a proporção quando a ROI ou a resolução mudam.
- **Decisão:** cada recorte é `{cx, cy, size}`, com a largura derivada em pixels. Os recortes dos jogadores são relativos à ROI; o do remoto, ao frame inteiro.
- **Consequência:** nenhum card deforma, e recalibrar a ROI leva os recortes junto. O zoom é simétrico em torno do centro.

## D-012 — Um `<video>` por tela (2026-11-01)

- **Decisão:** a calibração e a mesa têm cada uma o seu `<video>`. O da mesa fica oculto, com 1 px e opacidade 0, para o `requestVideoFrameCallback` continuar disparando. Cada tela tem um único loop de desenho para todos os seus canvases.
- **Consequência:** é mais simples que mover um elemento entre telas. Na troca de tela há uma reanexação rápida do mesmo stream.
- **Risco aberto:** o Chromium headless dispara rVFC até com `display:none`, então o E2E não prova essa premissa. Ela precisa ser confirmada no smoke manual no Edge/Chrome do Windows.

## D-013 — Validação de schema escrita à mão, sem biblioteca (2026-11-01)

- **Decisão:** `parseTableConfig` valida tipos e faixas, trunca textos longos e descarta campos desconhecidos. Ele será reaproveitado no import JSON da F3. Não entra Zod nem similar por enquanto.

## D-014 — Com configuração salva, a captura abre direto na mesa (2026-11-01)

- **Contexto:** o aceite da F3 pede sessão sem configuração técnica repetitiva.
- **Decisão:** se houver configuração válida salva, a próxima captura vai direto para a mesa. O botão "Calibrar" está sempre disponível, e o setup oferece "Apagar configuração salva".
- **Consequência:** se a fonte cair na mesa, a mesa permanece com o último quadro esmaecido e um botão "Reconectar". Se o seletor for cancelado na reconexão, a mesa também permanece.

## D-015 — Persistência começa no primeiro "Ir para a mesa" (2026-11-01, revisão da F1)

- **Contexto:** a revisão apontou que qualquer ajuste na calibração já salvava. Assim, depois de um reload, uma calibração inacabada abria direto como mesa.
- **Decisão:** nada é salvo até o primeiro "Ir para a mesa". A partir daí, cada alteração é salva. O aviso "está salva neste navegador" só aparece se o storage aceita escrita (testado uma vez com uma chave de sonda).
- **Consequência:** se a página for recarregada antes de ir para a mesa, a calibração se perde. Isso é aceitável, porque são poucos ajustes.

## D-016 — Câmera direta adiantada para F1.5, antes da F2 (2026-11-01)

- **Contexto:** na especificação, a câmera direta via WebRTC é a Fase 5, depois do piloto. A captura do Meet limita a nitidez de cada retrato: compressão do Meet, tile reduzido e recaptura da tela.
- **Decisão:** o PO adiantou a fonte direta para a F1.5, antes da detecção facial. Ela entra como fonte **opcional**; a captura do Meet continua disponível.
- **Consequência:** a F2 já poderá usar imagem melhor. A F1.5 publica o app em HTTPS, o que antecipa um pré-requisito da F4. Plano: `docs/tasks/F1.5.md`.

## D-017 — Infraestrutura WebRTC na Cloudflare (2026-11-01)

- **Contexto:** as opções eram:
  - **Cloudflare:** Pages + Worker/Durable Object + Realtime TURN;
  - **LiveKit Cloud:** SFU, com a mídia sempre passando pelo servidor deles;
  - **PeerJS público:** sem garantia de funcionamento e sem TURN.
- **Decisão:** usar a Cloudflare. Uma única conta cobre hospedagem HTTPS, sinalização e TURN. A mídia vai P2P e só usa o relay TURN quando a rede bloqueia; mesmo no relay, continua cifrada.
- **Consequência:**
  - o PO precisa de uma conta Cloudflare;
  - o Worker guarda a chave TURN e emite credenciais curtas;
  - o plano gratuito do TURN, na data desta decisão, era 1.000 GB/mês somado ao SFU, com o excedente a US$ 0,05/GB. Revalidar os limites na W1.

## D-018 — Desenho da infraestrutura da W1 (2026-11-01)

- **Site:** Cloudflare Pages com integração Git. Cada push na `main` publica em produção e cada branch ganha uma prévia. A página de limites do Pages (atualizada em 2026-09-05) não fala em descontinuação; ela só indica Workers Static Assets para quem hospeda mais de 100 sites.
- **Worker `vrt-signal`:** publicado pelo GitHub Actions (job `deploy-worker`), só na `main` e só depois de lint, testes, E2E e testes do Worker verdes. O site e o Worker ficam em origens diferentes (`*.pages.dev` e `*.workers.dev`). Por isso o Worker tem lista de origens (`ALLOWED_ORIGINS`) e CORS.
  - A alternativa era um único Worker com assets estáticos e a mesma origem. Ela foi descartada porque o plano e o PO pediram o Pages.
- **Pacote próprio em `worker/`:** os testes rodam no runtime real (`@cloudflare/vitest-plugin`, workerd com Durable Object de verdade), com o mesmo vitest 5.0.5 do app. O `@cloudflare/vitest-pool-workers` foi renomeado para esse pacote e só aceitava vitest 4.
- **Token:** gerado no Worker (16 bytes de `crypto.getRandomValues`, base64url). O navegador nunca o põe em URL: no WebSocket ele vai como segundo item do `Sec-WebSocket-Protocol` (`vrt-signal-v1, <token>`), e no TURN, no corpo do POST.
- **Dois peers:** uma vaga por papel. O teste de mutação mostrou que uma checagem separada de "sala cheia" era inalcançável, e ela foi removida.
- **Origem não é autenticação:** um cliente fora do navegador forja o `Origin`. A checagem impede que outro site use a sinalização a partir do navegador de alguém. Abuso por script ficaria limitado pelos tetos diários do plano gratuito, e rate limit fica para quando houver sinal disso.
- **Privacidade:** `observability.enabled = false`, `send_metrics = false`, `Cache-Control: no-store`. O DO guarda só `{ expiresAt, turnIssued }`.
- **Limitação conhecida:** se a rede de um peer cair sem fechar o socket, a vaga dele fica ocupada até o runtime perceber. Heartbeat e reconexão são da W3.

## D-019 — Limites do plano gratuito revalidados (2026-11-01)

Fonte: páginas oficiais da Cloudflare, lidas em 2026-11-01. A data de atualização de cada página está na lista.

- **Workers Free** (Workers → Platform → Limits): 100.000 requisições/dia (zera à 00:00 UTC; acima disso, erro 1027), 10 ms de CPU por requisição e 50 subrequisições por invocação.
- **Durable Objects Free** (Pricing, atualizada em 2026-10-18):
  - 100.000 requisições/dia e 13.000 GB-s/dia de duração;
  - só backend SQLite, com 5 GB no total, 5 milhões de linhas lidas/dia e 100.000 linhas escritas/dia;
  - abrir um WebSocket conta como requisição. Mensagens recebidas contam na proporção 20:1, e as enviadas não contam;
  - com a API de hibernação, o socket ocioso não é cobrado por duração;
  - limite de mensagem recebida: 32 MiB (Limits).
- **Realtime TURN** (Pricing, atualizada em 2026-09-22): os primeiros 1.000 GB de cada mês são grátis, e SFU e TURN dividem essa franquia; acima disso, US$ 0,05/GB. Só conta o egress do servidor TURN para o cliente. STUN (`stun.cloudflare.com`) é grátis e sem limite.
- **Pages Free** (Limits, atualizada em 2026-09-05): 500 builds/mês, 1 build por vez, 20 min por build, 20.000 arquivos e 25 MiB por arquivo.
- **Estimativa para nós:**
  - uma sessão gasta poucas dezenas de requisições (criar sala, 2 conexões e algumas mensagens), muito longe das 100.000/dia;
  - o relay só entra quando o P2P falha. A 1080p (≈ 4 Mbps) são ≈ 1,8 GB/h por perna relayada, ou até ≈ 3,6 GB/h se os dois lados usarem TURN. Isso dá ≥ 275 h de relay por mês dentro da franquia;
  - D-017 continua valendo.
