# Virtual RPG Table — Plano de Produto, Arquitetura e Execução com Claude + GPT/Codex

**Versão:** 1.0 — 01/11/2026  
**Status:** pronto para iniciar a implementação  
**Plataforma de desenvolvimento:** WSL2 / Ubuntu + VS Code  
**Plataforma prioritária de uso:** Chrome ou Edge no Windows  
**Produto:** aplicação web responsiva, independente do Game-Hub

---

## 1. Contexto e objetivo

Uma sessão de RPG ocorre por Google Meet, com **duas conexões de vídeo**: uma câmera coletiva mostrando **cinco pessoas na mesma mesa física** e uma câmera do **jogador remoto**. A experiência de hoje faz o remoto assistir a um único quadro coletivo, com pouco destaque para cada participante.

Construir uma interface web que transforme a transmissão coletiva em **cinco retratos animados individuais**, mantendo um sexto espaço para o jogador remoto, compondo visualmente uma mesa de RPG (VTT social). O primeiro objetivo é **enquadramento inteligente e identidade visual da mesa**, e não implementar regras de combate, dados 3D ou substituir o Meet.

**Princípio de produto:** a conversa continua no Meet; nosso aplicativo funciona inicialmente como uma camada visual local, sem retransmitir vídeo para terceiros.

### O que é sucesso no MVP

1. Usuário abre o site no Chrome/Edge Windows e clica em **Compartilhar fonte**.
2. Escolhe conscientemente a aba/janela/tela do Google Meet que mostra a câmera coletiva.
3. Seleciona manualmente uma **região de interesse (ROI)** que contém os cinco jogadores — não depender da posição fixa dos tiles do Meet.
4. Cria cinco cards com crop de vídeo independente; a primeira versão pode usar crops manuais.
5. Ativa a detecção de rostos para preencher os cinco cards de forma automática, com possibilidade de corrigir manualmente.
6. O rastreador preserva os slots/nomes durante pequenos movimentos e perdas breves de detecção; pessoas não são reatribuídas a cada frame.
7. O jogador remoto aparece em um sexto card, usando uma região de seu próprio preview do Meet **se visível**, câmera local **se disponível sem conflito com o Meet**, ou avatar estático como fallback. **Não prometer seis feeds independentes quando só existem duas fontes.**
8. O áudio permanece no Meet. O site não reproduz áudio capturado, não cria eco e não grava vídeo.

### Restrições

- Usar somente APIs públicas do navegador, com permissão explícita.
- Não depender da Meet Media API nem de APIs internas, scraping de DOM do Meet ou extensão do navegador para o MVP.
- Não depender de Python, OBS, Electron, Unity, Omarchy, Wayland ou WSL no computador do usuário final.
- Funcionar localmente e em hospedagem HTTPS; sem necessidade de login/servidor para o MVP.
- Não fazer reconhecimento biométrico de identidade; nomes/associações são definidos manualmente na interface.
- Não implementar rastreamento de quem fala baseado exclusivamente no áudio coletivo como se fosse confiável.
- Compatibilidade futura com Linux/Omarchy e integração eventual com Game-Hub, mas **sem acoplamento agora**.

---

## 2. Arquitetura proposta

```text
  Câmera coletiva (cinco pessoas)       Câmera/preview do jogador remoto
                │                                     │
          Google Meet                         Meet ou câmera local
                │                                     │
                └──────────────┬──────────────────────┘
                               │
        getDisplayMedia() — escolha pelo usuário
                               │
              <video> local com MediaStream
                               │
                 Calibração da ROI coletiva
                               │
         ┌─────────────────────┴─────────────────────┐
         │                                           │
    Crops manuais (MVP-0)                     Face Detector (MVP-1)
         │                                           │
         │                              Rastreador temporal de 5 slots
         │                                           │
         └─────────────────────┬─────────────────────┘
                               │
                   Canvas 2D / compositor
                               │
            Cards individuais e mesa virtual React
                               │
                Layout + personalização local
```

### Stack de base

| Domínio | Escolha | Motivo |
|---|---|---|
| Aplicação | React + TypeScript + Vite | Desenvolvimento rápido, portabilidade e tipagem |
| Interface | Tailwind CSS, componentes acessíveis | Layout de mesa responsivo e rápido de iterar |
| Estado | React hooks/context; Zustand apenas se necessário | Evitar abstração prematura |
| Captura | `navigator.mediaDevices.getDisplayMedia()` | Seleção autorizada de aba, janela ou tela |
| Câmera local opcional | `navigator.mediaDevices.getUserMedia()` | Apenas se não conflitar com o Meet |
| Visão computacional | `@mediapipe/tasks-vision` / Face Detector | Bounding boxes e pontos faciais no navegador |
| Versão avançada | MediaPipe Face Landmarker | Expressões e landmarks, somente se necessário |
| Composição | Canvas 2D + CSS, sem PixiJS inicialmente | Baixa complexidade para retratos |
| Testes | Vitest, Testing Library, Playwright | Unidade, componentes e integração de UX |
| Formatação/qualidade | ESLint, Prettier, TypeScript strict | Padronização e qualidade |
| Distribuição | Hospedagem estática HTTPS | Sem backend no MVP |
| Evolução opcional | WebRTC/LiveKit, PixiJS | Streaming direto e cenas VTT futuras |

**Nota de implementação:** `detectForVideo()` pode bloquear a thread principal. Fazer um pequeno estudo de viabilidade de execução em Web Worker + `OffscreenCanvas`; oferecer fallback com inferência limitada a poucos FPS se o worker não for viável na plataforma-alvo. Renderizar retratos independentemente da cadência de inferência.

### Pipeline de vídeo

1. Um clique explícito do usuário inicia `getDisplayMedia({video: true, audio: false})`.
2. Nunca escolher a janela silenciosamente: o navegador apresenta sua própria seleção. A permissão precisa ser renovada nas próximas sessões.
3. Exibir prévia e editor da região do quadro coletivo, com dimensões normalizadas em `[0,1]`.
4. Capturar frames do `<video>` conforme `requestVideoFrameCallback()` (fallback apropriado se necessário).
5. Para o MVP manual, aplicar cinco crops configuráveis (position/size), sem IA.
6. No modo automático, inferir rostos somente na ROI coletiva, em frequência inicial de referência de **5–10 inferências/s**, adaptando conforme capacidade e qualidade do vídeo.
7. Associar faces detectadas a slots persistentes usando bounding box, distância entre centros e IoU, com limiar de rejeição, tolerância a desaparecimento e suavização EMA; começar com associação gulosa se suficiente, implementar matching global se houver trocas de ID frequentes.
8. Compor crops estáveis com folga de cabeça/ombros, limites da ROI e transição suave. Manter proporção e evitar recortes bruscos.
9. Renderizar cinco cards animados e um card do remoto (origem independente/opcional/fallback).
10. Liberar tracks em `stop()`, desmontagem, troca da fonte e quando o usuário encerra o compartilhamento via navegador (`track.onended`).

### Atenção ao Google Meet

- O Meet é uma **fonte visual externa**, não uma integração formal. Tiles podem mudar de lugar ou perder resolução; por isso a ROI manual é um requisito, não um extra.
- A janela capturada precisa estar visível/disponível conforme o comportamento do navegador/SO. Testar aba vs. janela vs. tela.
- Se a câmera coletiva vier pequena demais na chamada, cinco recortes serão borrados. O app **não consegue recuperar detalhes que não vieram na transmissão**.
- O preview local do jogador remoto pode não aparecer no layout, estar espelhado ou ser ocultado; um avatar é fallback explícito.
- **Evitar recursão visual:** a fonte selecionada deve ser o Meet, não a aba do próprio VTT.
- Não capturar ou retransmitir a reunião sem consentimento dos participantes.

---

## 3. Experiência e telas

### Tela A — Primeiro acesso / setup

- Botão principal **Selecionar fonte de vídeo**.
- Texto curto explicando permissão de captura e processamento local.
- Estados: aguardando permissão, carregando, fonte conectada, fonte encerrada, erro recuperável.
- Opção **Carregar vídeo local de teste**, útil para desenvolver sem chamar cinco pessoas.

### Tela B — Calibração

- Preview original da fonte, com moldura arrastável para a câmera coletiva.
- Alternar **Modo manual** e **Detecção automática**.
- Mostrar bounding boxes encontradas, confiança e contador de rostos detectados.
- Editar margem/zoom de cada crop; nomear Jogador 1 a Jogador 5.
- Ação para associar manualmente cada slot ao rosto correspondente.
- Botão **Congelar configuração** (os frames continuam em movimento; congela apenas posições/associações de calibração).
- Recalibrar quando a câmera mover ou o Meet mudar o layout.

### Tela C — Mesa virtual

- Layout inicial: cinco retratos do grupo + um retrato/avatar remoto, organizados ao redor de uma área central.
- Nome e campo opcional de personagem em cada card.
- Estados: conectado, rosto temporariamente indisponível, fonte perdida, placeholder.
- Alternar grade, modo foco e modo mestre.
- Área central inicialmente ilustrativa/placeholder, pronta para mapas e overlays posteriormente.
- Painel de configurações discreto, sem obstruir a sessão.
- Alternar tema claro/escuro, com preferência inicial por tema escuro de RPG, legível e sem exagero visual.

### Tela D — Diagnóstico

- FPS da fonte, FPS da inferência, FPS do render, resolução e tempo médio de inferência.
- Quantidade de faces detectadas/slots estáveis, status da permissão e da fonte.
- Modo economia de recursos e controle da frequência de inferência.
- Diagnósticos locais sem envio de imagens, biometria, áudio ou tokens.

---

## 4. Fases e entregáveis

### Fase 0 — Fundação e prova de captura

**Objetivo:** validar que a captura do Meet funciona no Windows e que a tela web consegue desenhar a imagem capturada.

**Tarefas:**
- Inicializar repo Vite + React + TypeScript strict, package manager único, lockfile e scripts.
- README com setup WSL2, testes no navegador Windows e limites do produto.
- Implementar `CaptureController` com iniciar, parar, trocar fonte e `onended`.
- Seleção de ROI manual e preview com overlay.
- Modo de vídeo local para testes determinísticos.
- Testes básicos de estados/permissões.

**Aceite:** abrir o site no Chrome/Edge Windows, selecionar fonte com consentimento, visualizar vídeo, ajustar ROI e encerrá-la sem tracks pendentes.

### Fase 1 — MVP funcional sem IA (prioridade absoluta)

**Objetivo:** demonstrar os cinco retratos animados, ainda que com crops manuais.

**Tarefas:**
- Editor com cinco regiões arrastáveis/ajustáveis dentro da ROI coletiva.
- Compositor de retratos e layout de seis cards.
- Sexto card com avatar ou fonte opcional, claramente marcado.
- Persistência **local de configurações não sensíveis** (nomes, crop, layout), evitando armazenar frames.
- UI responsiva 1080p e telas menores.
- Testes de crop com aspect ratios, redimensionamento e bordas.

**Aceite:** cinco crops podem ser configurados manualmente a partir de um único vídeo e exibidos simultaneamente sem gravar ou retransmitir a fonte.

### Fase 2 — Auto-framing e rastreamento

**Objetivo:** transformar os crops manuais em recortes que seguem os rostos.

**Tarefas:**
- Integrar MediaPipe Face Detector.
- Inferir até os cinco rostos presentes, sem assumir sucesso se a imagem estiver ruim.
- Implementar IDs **temporários de rastreamento**, não reconhecimento biométrico.
- Associar slots a detecções; suavizar bounding boxes e impedir saltos.
- Placeholder ou último crop estabilizado quando a face desaparecer, com limite e indicação visual de perda.
- Permitir correção manual imediata se dois jogadores trocarem de slot.
- Instrumentar latência/FPS e throttle adaptativo.

**Aceite:** em vídeo de teste autorizado com cinco pessoas visíveis, o aplicativo encontra e acompanha a maioria dos rostos sem reordenar constantemente os cards; há fallback manual quando falhar. Critérios quantitativos de estabilidade serão estabelecidos após benchmark no hardware-alvo.

### Fase 3 — Experiência de RPG

**Objetivo:** o resultado deve parecer uma mesa virtual, não um monitor de câmeras.

**Tarefas:**
- Nome do jogador, personagem, classe e avatar opcionais.
- Layouts: mesa, grade, foco e mestre.
- Área central com cena/arte estática fornecida pelo usuário.
- Animações discretas ao selecionar um jogador.
- Acessibilidade de teclado, contraste e reduced-motion.
- Exportar/importar configuração da mesa em JSON validado, sem dados de vídeo.

**Aceite:** uma sessão pode ser configurada e apresentada em layout de RPG sem configuração técnica repetitiva além da autorização de captura e eventual recalibração.

### Fase 4 — Piloto com dois computadores

**Objetivo:** validar a situação real: 5 pessoas na mesa + 1 remoto.

**Tarefas:**
- Testar com Chrome e Edge Windows; conferir localhost de WSL2 e versão publicada HTTPS.
- Avaliar 720p/1080p da fonte, distância dos rostos, oclusão e iluminação.
- Medir uso de CPU/RAM, FPS, latência percebida e estabilidade dos IDs.
- Testar fechamento do Meet, interrupção de compartilhamento e alteração dos tiles.
- Documentar decisão técnica: **seguir com captura do Meet** ou **priorizar câmera direta via WebRTC**.

**Aceite:** piloto realizado com checklist; limitações documentadas e próximos passos decididos com base no resultado, sem afirmar qualidade superior à fonte de vídeo original.

### Fase 5 — Evoluções fora do MVP

**Somente após o piloto:**
- WebRTC/LiveKit/VDO.Ninja como fonte direta opcional da câmera da sala, para melhorar qualidade e independência do layout do Meet.
- Destaque de quem fala com confirmação manual ou abordagem multimodal validada (não presumir inferência confiável pelo microfone compartilhado).
- Dados, iniciativa, fichas, overlays, mapas e integração opcional com Foundry/Owlbear ou formato aberto.
- Múltiplas mesas e perfis; armazenamento com consentimento; autenticação apenas se surgir uma necessidade real.
- Plugin/módulo de experiência social eventualmente conectado ao Game-Hub.
- Desktop Electron/Tauri somente diante de limitação concreta do navegador.

---

## 5. Regras de engenharia e testes

### Qualidade

- TypeScript `strict: true`; não mascarar erros com `any` ou comentários que desliguem lint indiscriminadamente.
- Componentes de UI não devem importar diretamente MediaPipe; separar captura, visão, tracking e renderização.
- Toda permissão precisa de ação explícita do usuário e tratamento de negação/cancelamento.
- Abstrair fontes via interface (`CapturedDisplaySource`, `LocalVideoFileSource`, `OptionalCameraSource`).
- Isolar tracking em módulo testável por dados geométricos puros; não usar reconhecimento de identidade.
- Guardar no repositório modelos/licenças compatíveis e versions pinadas; não usar `@latest` em produção.
- Cobertura principalmente dos algoritmos: crop, transformações, normalização de coordenadas, associação, suavização e cleanup.
- Não permitir regressão de captura quando adicionarmos IA.

### Testes automatizados mínimos

- Unitários: escalonamento de ROI, conversão de bounding boxes para canvas, associação de tracks, clipping, estados de perda.
- Componentes: captura cancelada, encerrada, sem câmera, sem permissão, sem rostos.
- Playwright: fluxo com vídeo de teste local, cinco crops, alterações de layout, export/import, pausa.
- **Teste manual obrigatório:** permissão real `getDisplayMedia` no navegador Windows; automação E2E pode não reproduzir fielmente o seletor de janela do navegador.

### Segurança e privacidade

- `getDisplayMedia` somente após clique e usando fluxo nativo do navegador.
- Processamento local de vídeo no MVP, sem uploads, gravações, screenshots automáticos ou analytics invasivo.
- O áudio do Meet **não** deve ser reproduzido em duplicidade nem capturado sem necessidade.
- Nunca armazenar imagens de rosto, landmarks, frames nem dados de identificação biométrica.
- Se introduzir upload ou transmissão no futuro, exigir consentimento contextual, especificar retenção e controlar acesso.
- Configuração compartilhável JSON com validação de schema; sem `eval`, sem secrets.
- Hospedar HTTPS em produção e conferir requisitos de permissões/cross-origin dos modelos.

### Métricas sugeridas (objetivos de projeto, não garantias)

- Renderização perceptivelmente fluida, ideal 24–30 FPS ou mais.
- Inferência inicial 5–10 FPS, com ajuste dinâmico conforme CPU e latência.
- Preview e retratos sem atraso perceptível adicional excessivo no hardware do piloto.
- Sem travamentos sustentados na UI durante inferência.
- Reconexão/recalibração viável sem recarregar a página.
- Medir estabilidade dos slots antes de fixar meta numérica.

---

## 6. Estrutura sugerida do repositório

```text
virtual-rpg-table/
├── .github/workflows/ci.yml
├── docs/
│   ├── ARCHITECTURE.md
│   ├── PRODUCT_REQUIREMENTS.md
│   ├── PILOT_CHECKLIST.md
│   ├── DECISIONS.md
│   └── AGENTS.md
├── public/
│   └── models/                 # modelos licenciados e versões fixadas
├── src/
│   ├── app/
│   ├── components/
│   │   ├── PlayerCard/
│   │   ├── VirtualTable/
│   │   ├── CaptureSetup/
│   │   └── Diagnostics/
│   ├── features/
│   │   ├── capture/
│   │   ├── calibration/
│   │   ├── face-detection/
│   │   ├── face-tracking/
│   │   ├── compositor/
│   │   └── table-layout/
│   ├── lib/
│   ├── types/
│   └── test/
├── tests/e2e/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

Não criar todos os diretórios de uma vez sem necessidade. Implementar somente o necessário para a fase atual.

---

## 7. Organização de agentes Claude + GPT/Codex

### Responsabilidades

**Claude — implementador e guardião da coerência do produto**
- Ler requisitos e delimitar escopo da fase.
- Definir interfaces e plano de arquivos antes de codificar.
- Implementar UI, captura, calibração e integrações incrementais.
- Acrescentar testes com cada funcionalidade.
- Registrar decisões e problemas abertos.

**GPT/Codex — revisor e agente de validação independente**
- Revisar o plano de cada fase quanto a riscos e simplificações.
- Implementar testes de unidade/integração e edge cases, em branch/worktree separado.
- Auditar vazamentos de MediaStream, loops de processamento, throttling, permissões e segurança.
- Executar checks e apontar regressões com passos reproduzíveis.
- Sugerir mudanças pequenas e verificáveis; não alterar simultaneamente arquivos que Claude está editando.

**Você — product owner**
- Aprovar a definição de pronto para cada fase.
- Executar os testes manuais de captura no Windows.
- Conduzir o piloto real com os participantes e indicar ajustes de UX.

### Protocolo de handoff

1. Criar issue ou arquivo de tarefa com **objetivo, escopo, fora de escopo, critérios de aceite e arquivos candidatos**.
2. Claude implementa em branch isolada (`feat/f0-capture`, `feat/f1-manual-crops` etc.) e entrega um resumo técnico.
3. GPT/Codex revisa em outro worktree ou sobre diff somente leitura; se escrever testes, usar branch isolada e coordenação explícita.
4. Executar `lint`, `typecheck`, testes unitários, build e E2E apropriados.
5. Só integrar se os critérios da fase forem cumpridos; não aceitar features futuras sem valor imediato.
6. Atualizar `docs/DECISIONS.md` com decisões arquiteturais significativas.

### Entrega mínima de cada PR

- Resumo do que mudou e do que não mudou.
- Riscos/limitações conhecidas.
- Testes executados e resultados.
- Evidência de UI (imagem ou vídeo de teste consentido, **não** trecho da sessão real sem autorização).
- Checklist de aceite e instruções para testar manualmente.

---

## 8. Primeiras tarefas para o board

| ID | Prioridade | Dono inicial | Tarefa | Critério resumido |
|---|---|---|---|---|
| F0-01 | P0 | Claude | Scaffold Vite/React/TS | Dev/build/test funcionando |
| F0-02 | P0 | Claude | Captura `getDisplayMedia` + cleanup | Start/stop/erro tratados |
| F0-03 | P0 | Claude | Prévia e seleção de ROI | Região arrastável alinhada ao vídeo |
| F0-04 | P0 | GPT/Codex | Testes de estados e geometria | Cenários de erro cobertos |
| F0-05 | P0 | Você | Smoke test Chrome/Edge Windows | Captura real validada |
| F1-01 | P0 | Claude | Editor de 5 crops manuais | 5 retratos simultâneos |
| F1-02 | P0 | Claude | Layout 6 cards + placeholder | Mesa utilizável |
| F1-03 | P1 | GPT/Codex | Testes crop e aspect ratio | Sem deformação/overflow |
| F2-01 | P0 | Claude | Detector MediaPipe na ROI | Bounding boxes visíveis |
| F2-02 | P0 | Claude | Tracker com slots persistentes | IDs não trocam facilmente |
| F2-03 | P0 | GPT/Codex | Testes tracking com casos adversos | Oclusão/perda cobertas |
| F2-04 | P1 | Claude | Benchmark e worker spike | UI responsiva |
| F3-01 | P1 | Claude | Templates de mesa RPG | Modo grade/mesa/foco |
| F4-01 | P0 | Você | Piloto 5+1 | Checklist e decisões registrados |

**Dependência crítica:** concluir Fase 1 antes de investir muito tempo em detecção ou efeitos visuais.

---

## 9. Setup inicial no WSL2

Executar no terminal Ubuntu/WSL2 após instalar uma versão LTS suportada de Node.js e habilitar seu package manager:

```bash
mkdir -p ~/projects
cd ~/projects
npm create vite@latest virtual-rpg-table -- --template react-ts
cd virtual-rpg-table
npm install
npm run dev -- --host 127.0.0.1
```

Abrir a URL mostrada pelo Vite no Chrome/Edge **do Windows**. Depois, instalar dependências específicas conforme a etapa exigir, evitando bibliotecas desnecessárias já no scaffold. Preservar o projeto no filesystem Linux (por exemplo, `~/projects`), não em `/mnt/c`, para ter melhor fluxo de ferramentas WSL.

Adicionar scripts `typecheck`, `lint`, `test`, `test:e2e` quando a configuração correspondente estiver instalada. Não fingir que esses scripts já existem no template.

**Teste de produção:** publicar a aplicação com HTTPS antes de compartilhar a URL com o outro computador. `localhost` do desenvolvedor não é URL pública para o colega.

---

## 10. Riscos e respostas

| Risco | Impacto | Resposta |
|---|---|---|
| Meet rearranja tiles/oculta preview | ROI fica inválida | Calibração visual e recaptura rápida |
| Cinco rostos muito pequenos | Detecção falha e crops borrados | Modo manual e câmera direta numa fase posterior |
| Dois jogadores se cruzam | IDs trocam | Associação persistente, timeout e correção manual |
| MediaPipe sobrecarrega CPU | UI trava | Inferência limitada, worker spike, ajuste adaptativo |
| Meet usa câmera em exclusividade | Sexto card sem vídeo | Usar self-preview da captura ou avatar fallback |
| Permissão de compartilhamento encerrada | Vídeo some | `track.onended`, estado visível e reconexão |
| Dados visuais inadvertidos | Problema de privacidade | Nenhuma gravação/upload por padrão; consentimento |
| Escopo explode para VTT completo | MVP nunca termina | Bloquear features extras até piloto 5+1 |

---

## 11. Prompt de inicialização — enviar ao Claude (orquestrador/implementador)

> Você é o agente principal de implementação do projeto **Virtual RPG Table**. Leia integralmente `virtual-rpg-table-plano-claude-gpt.md` e trate esse arquivo como a especificação inicial. O produto é uma aplicação web em React + TypeScript + Vite, desenvolvida no WSL2 Ubuntu e utilizada prioritariamente no Chrome/Edge do Windows. Deve converter uma câmera coletiva do Meet com cinco pessoas em cinco retratos individuais, mantendo sexto card para o participante remoto. O áudio continua no Meet. Privacidade e permissão explícita de captura são requisitos obrigatórios.
>
> **Execute somente a Fase 0 nesta primeira interação.** Primeiro, inspecione o repositório e apresente um plano enxuto com arquivos a criar/alterar e riscos. Em seguida, implemente scaffold, captura `getDisplayMedia`, preview, ROI manual, limpeza de tracks, fonte de vídeo de teste e documentação mínima. Use TypeScript strict, testes e uma arquitetura modular simples. Não introduza backend, IA facial, VTT de combate, autenticação, Electron, OBS ou dependências desnecessárias na Fase 0.
>
> Ao final, execute verificações disponíveis e apresente: arquivos alterados, comandos executados, resultado de testes, limitações verificadas e roteiro para smoke test manual no Chrome/Edge Windows. Se uma API depender de permissão ou interação humana, não simule sucesso. Deixe um handoff curto para o agente GPT/Codex revisar.

## 12. Prompt de revisão — enviar ao GPT/Codex

> Você é o revisor técnico independente do projeto **Virtual RPG Table**. Leia `virtual-rpg-table-plano-claude-gpt.md`, a especificação da fase atual e o diff da implementação feita por Claude. Foque em erros reproduzíveis, performance, vazamentos de MediaStream, estados de permissão, tratamento de cancelamento de captura, geometria/ROI, segurança e testes. Não redesenhe a arquitetura nem inclua features fora do escopo. **Priorize P0/P1**, execute `lint`, `typecheck`, testes e build se disponíveis, e registre quais verificações não puderam ser executadas. Entregue uma revisão objetiva com severidade, arquivo/linha, passos de reprodução e correção recomendada. Se forem necessários novos testes, use branch/worktree separado e não edite os mesmos arquivos simultaneamente sem coordenação. Não marque como aprovado algo que não foi testado de verdade.

---

## 13. Referências técnicas oficiais

- MDN — `getDisplayMedia`: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia
- MDN — `requestVideoFrameCallback`: https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback
- Google AI Edge — Face Detector Web: https://developers.google.com/edge/mediapipe/solutions/vision/face_detector/web_js
- Google AI Edge — Face Landmarker Web: https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js

**Observações:** a API de captura exige gesto explícito, seleção de fonte e autorização renovada; o navegador não permite selecionar uma janela de forma silenciosa. O Face Landmarker tem configuração `numFaces`, mas sua suavização automática só se aplica quando configurado para um rosto; para cinco, implementar suavização própria. A inferência síncrona pode bloquear a UI, então medir desde cedo. Revalidar versões de pacotes e documentação no dia da implementação.

---

## 14. Definição de pronto do MVP

Marcar como concluído somente quando:

- [ ] Captura real do Meet funciona por seleção e consentimento no Windows.
- [ ] Escolha da câmera coletiva funciona mesmo com mudanças de tamanho de janela via ROI.
- [ ] Cinco retratos de vídeo podem ser exibidos com crops manuais.
- [ ] Auto-framing é opcional, utilizável e não remove o modo manual de contingência.
- [ ] Slots são estáveis em movimentos normais, com correção manual para falhas.
- [ ] Sexto card opera com fonte disponível ou avatar fallback claro.
- [ ] Não há gravação, upload ou duplicação de áudio.
- [ ] Parar captura libera todas as tracks e limpa a UI adequadamente.
- [ ] Testes de unidade, build e smoke test manual estão documentados.
- [ ] Piloto com cinco pessoas presencialmente e uma remota foi realizado e suas limitações registradas.

**Regra de prioridade:** é melhor ter cinco retratos manuais confiáveis em uma sessão real do que um detector sofisticado que falha durante o jogo.
