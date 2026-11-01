# CLAUDE.md

Leia e siga [`AGENTS.md`](AGENTS.md): regras, verificação obrigatória, privacidade e handoff. A especificação de produto é [`docs/virtual-rpg-table-plano-claude-gpt.md`](docs/virtual-rpg-table-plano-claude-gpt.md), e a tarefa da fase atual fica em [`docs/tasks/`](docs/tasks).

Notas específicas para o Claude:

- Responder em português do Brasil.
- Trabalhar sempre numa branch `feat/fN-...`, nunca direto na `main`.
- Para testar a UI sem chamada real, usar a **fonte sintética** (botão no setup). O seletor real de `getDisplayMedia` só é validado pelo smoke test manual do README.
