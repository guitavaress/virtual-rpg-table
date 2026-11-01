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

- **Decisão:** `CaptureController.start()` libera a fonte atual antes de abrir o seletor.
- **Consequência:** se o usuário cancelar o seletor durante a troca, o app volta ao setup com a mensagem de cancelamento, e a ROI é mantida. É mais simples e não há chance de duas capturas simultâneas. Pode ser revisto depois do piloto.

## D-008 — Jev (TypeSafe AI) fora do runtime (2026-11-01)

- **Contexto:** o Jev é um modelo de decisões tipadas (sim/não, escolha, nota, caixa em imagem) acessado por API na nuvem.
- **Decisão:** ele **não** entra no app, porque enviar frames da chamada viola a regra de processamento local sem upload. Fica como candidato para a F2/F4 como **avaliador offline de desenvolvimento**: um script em `scripts/` que dá nota à qualidade dos crops do auto-framing em vídeo de teste consentido.
- **Regra de segredos:** a chave fica numa variável de ambiente lida só por scripts Node. Nunca usar o prefixo `VITE_`, porque o Vite injeta essas variáveis no bundle público. Nunca versionar a chave.
