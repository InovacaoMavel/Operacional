# LOG — Módulo Operacional

Registro do que foi construído e das alterações. Mais recente primeiro.
Planejamento das seções: `Mock-geral/docs/PLANEJAMENTO.md` (§4.A).
Operação e deploy: `RUNBOOK.local.md` (local, fora do git).

---

## 2026-07-24 — Projeto criado: front, casca e seção Telemetria

### Contexto
Saída do mockup (`Mock-geral/`) para um projeto executável, mantendo a
identidade visual e o comportamento já validados.

### Front
- `front/index.html` = cópia do `Mock-geral/operacional/index.html` com **2
  desvios**, comentados no arquivo: botões Home/Hub apontando para o Hub no ar,
  e o `<script>` da seção Telemetria.
- `front/assets/styles.css` = cópia idêntica.
- `front/assets/app.js` reescrito como **casca**: helpers de render expostos em
  `ui`, registro de seções por `window.OP_SECOES`, ordem fixa das abas
  (`ORDEM_ABAS`, preserva os hashes do mock), `render` podendo ser assíncrono,
  erro isolado por aba e badge de procedência (Ilustrativo / CSV / API).
  As 6 abas ainda não extraídas seguem no bloco `ABAS_INLINE`, intocadas.

### Arquitetura de pastas
Fatia vertical por seção: `secoes/<secao>/{front,api,api/consultas,migrations}`.
Contratos de front e de API documentados em `secoes/README.md`. As 6 seções
restantes ganharam pasta + README com objetivo, fonte pretendida e pendências.

### Seção Telemetria (a 1ª extraída)
- `secoes/telemetria/front/aba-telemetria.js` — normaliza mock e API no mesmo
  contrato de dados.
- `secoes/telemetria/api/rotas.py` — `/resumo`, `/leituras`, `/controle`, `/frota`.
- 6 consultas em `api/consultas/*.sql` sobre `locavia.telemetria`,
  `locavia.telemetria_controle` e `locavia.vw_frota_telemetria`.
- Nada de ingestão: quem popula essas tabelas é o `integracao_rastrosiga`
  (repo Rastrosiga, stack própria). O módulo só lê.

### API
- `api/main.py` — casca: `/api/health`, descoberta automática de
  `secoes/*/api/rotas.py` (carregada por caminho, porque pasta com hífen não é
  módulo Python válido), front + `/secoes` + `/dados-mock` como estáticos.
- `api/dados.py` — conexão **read-only**, cache de 180s, leitura dos `.sql`.

### Deploy (escrito, não executado)
`docker-compose.yml` (build) + `docker-stack.yml` (Swarm + Traefik, host
`operacional.mavellocadora.com.br`, Basic Auth) no mesmo padrão do Hub. Receita e
pré-checagens no `RUNBOOK.local.md` §7.

### Pendências
- Deploy nunca rodado (confirmar nome da rede `frota_internal`, atach cross-stack
  e DNS em nuvem cinza).
- 6 seções ainda no mock; fila de extração no RUNBOOK §9 (próxima: Revisão
  Preventiva).
- Mapa da telemetria e km/dia: ver `secoes/telemetria/README.md`.
