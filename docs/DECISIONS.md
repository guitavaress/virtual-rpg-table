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

## D-013 — Validação de schema escrita à mão, sem biblioteca (2026-11-01)

- **Decisão:** `parseTableConfig` valida tipos e faixas, trunca textos longos e descarta campos desconhecidos. Ele será reaproveitado no import JSON da F3. Não entra Zod nem similar por enquanto.

## D-014 — Com configuração salva, a captura abre direto na mesa (2026-11-01)

- **Contexto:** o aceite da F3 pede sessão sem configuração técnica repetitiva.
- **Decisão:** se houver configuração válida salva, a próxima captura vai direto para a mesa. O botão "Calibrar" está sempre disponível, e o setup oferece "Apagar configuração salva".
- **Consequência:** se a fonte cair na mesa, a mesa permanece com o último quadro esmaecido e um botão "Reconectar". Se o seletor for cancelado na reconexão, a mesa também permanece.
