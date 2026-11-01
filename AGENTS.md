# AGENTS.md — Virtual RPG Table

Regras para qualquer agente (Claude, GPT/Codex) que trabalhe neste repositório. A especificação de produto é [`docs/virtual-rpg-table-plano-claude-gpt.md`](docs/virtual-rpg-table-plano-claude-gpt.md). A tarefa da fase atual está em [`docs/tasks/`](docs/tasks).

## Papéis

- **Claude (implementador):** delimita o escopo da fase, define interfaces, implementa com testes e registra decisões em `docs/DECISIONS.md`.
- **GPT/Codex (revisor independente):** revisa o diff, procura riscos e escreve testes de edge cases em branch/worktree separado. Não edita ao mesmo tempo os arquivos que o Claude está mexendo.
- **Product owner (humano):** aprova a definição de pronto, faz o smoke test manual no Windows e conduz o piloto.

## Verificação obrigatória antes de entregar

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Relate o que rodou e o resultado real. **Não marque como aprovado o que não foi testado.** A captura real (`getDisplayMedia`) exige o smoke test manual descrito no README; a automação não simula o seletor.

## Regras de engenharia

- TypeScript `strict` + `noUncheckedIndexedAccess`. Sem `any` e sem desligar lint de forma indiscriminada.
- Separe captura (`features/capture`), calibração/geometria (`features/calibration`) e UI (`components`). Componentes de UI **não** importam MediaPipe; isso valerá para `features/face-detection` na F2.
- Geometria e tracking ficam em funções puras e testadas com dados geométricos.
- Toda permissão nasce de um clique explícito, com tratamento de negação, cancelamento e encerramento (`track.onended`).
- Todo caminho de saída libera tracks e object URLs: stop, troca de fonte, unmount, erro e corrida de request.
- Versões fixadas: nada de `@latest` em dependências nem em URLs de modelos.
- Implemente só o que a fase atual pede. Não crie diretórios "para depois".

## Privacidade (inegociável)

- Sem upload, gravação, screenshot automático ou analytics de vídeo. Nunca guardar frames, rostos ou landmarks.
- Sem áudio: não capturar e não reproduzir.
- Sem reconhecimento biométrico de identidade.
- Segredos (ex.: chave da TypeSafe/Jev) vão só em variável de ambiente lida por scripts Node. **Nunca** com prefixo `VITE_`, porque o Vite embute essas variáveis no bundle público. Nunca em arquivo versionado.

## Protocolo de handoff

1. Toda tarefa tem um arquivo em `docs/tasks/` com objetivo, escopo, fora de escopo, aceite e arquivos.
2. Implementação em branch `feat/fN-...` e PR para `main`.
3. Revisão do Codex sobre o diff (somente leitura) ou em worktree próprio. Se escrever testes, usa branch própria.
4. A PR traz:
   - o que mudou e o que não mudou;
   - riscos e limitações;
   - testes executados e resultados;
   - evidência visual feita com a fonte sintética ou vídeo consentido;
   - checklist de aceite e roteiro manual.
5. Decisões arquiteturais vão para `docs/DECISIONS.md`.

## Prompt de revisão (GPT/Codex)

> Você é o revisor técnico independente do projeto **Virtual RPG Table**. Leia `docs/virtual-rpg-table-plano-claude-gpt.md`, a tarefa da fase atual em `docs/tasks/` e o diff da implementação feita por Claude. Foque em:
>
> - erros reproduzíveis;
> - performance;
> - vazamentos de MediaStream;
> - estados de permissão e cancelamento de captura;
> - geometria/ROI;
> - segurança;
> - testes.
>
> Não redesenhe a arquitetura nem inclua features fora do escopo. **Priorize P0/P1.** Execute `lint`, `typecheck`, testes e build, e registre o que não pôde ser executado. Entregue uma revisão objetiva com severidade, arquivo/linha, passos de reprodução e correção recomendada. Se precisar de novos testes, use branch/worktree separado. Não marque como aprovado algo que não foi testado de verdade.
