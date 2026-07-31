# LOG — Módulo Operacional

Registro do que foi construído e das alterações. Mais recente primeiro.
Planejamento das seções: `Mock-geral/docs/PLANEJAMENTO.md` (§4.A).
Operação e deploy: `RUNBOOK.local.md` (local, fora do git).

---

## 2026-07-30 — Telemetria vira microsserviço; mapa e painel do veículo

### Contexto
Definida a arquitetura-alvo do módulo — **BFF + microsserviços por seção**:

```
Frontend -> Operacional API (BFF) -> Telemetria / Ocupação / Multas -> Frota -> Banco(s)
```

Foco desta entrega: **Telemetria**. As demais seções continuam embutidas no BFF e
migram uma a uma, sem mudança no front.

### Escopo da navegação reduzido para 4 abas
`Frota & Ocupação` foi separada em **Frota** (inventário) e **Ocupação**
(aproveitamento da base locável). Restaram na navbar: Frota, Ocupação, Telemetria
e Multas. Alertas, Renovação, Revisão Preventiva e Pedido de Frota saíram do
`ABAS_INLINE` — pastas e READMEs seguem versionados.
`secoes/frota-ocupacao/` → `secoes/frota/` (git mv) + `secoes/ocupacao/` nova.

### BFF
- `api/proxy.py` — repasse para os serviços de seção. Não reescreve o prefixo:
  `/api/telemetria/*` chega no serviço com o mesmo caminho, então a URL é
  idêntica com ou sem proxy e o front não sabe onde a seção roda.
- `api/main.py` — decide por seção: com `<SECAO>_URL` no ambiente monta o proxy;
  sem ela, importa `rotas.py` no próprio processo (modo dev, um container só).
  `/api/health` passou a devolver `secoes` **e** `servicos`.
- Passou a inserir `secoes/<secao>/api/` no `sys.path`, para o `rotas.py` poder
  importar módulos vizinhos da própria seção.

### telemetria-svc
- `secoes/telemetria/{Dockerfile,requirements.txt}` + `api/servico.py`.
  Imagem `operacional_telemetria:latest`; só `api/dados.py` é compartilhado com
  o BFF. Sem Traefik, sem porta publicada — vive na rede `interna` do stack.
- Rotas novas: `/posicoes` (pinos do mapa), `/veiculo/{placa}` (ficha do painel)
  e `/geocoding/status` (saúde do cache).
- `api/consultas/posicoes.sql` e `veiculo.sql`. A segunda cruza
  `vw_frota_telemetria → contratos → clientes` para achar quem está com o carro.

### Reverse geocoding (Nominatim/OSM)
- `api/geocoding.py`: limitador de **1 req/s** (Lock global), **User-Agent**
  identificando a aplicação e **cache** de 7 dias com chave arredondada a 4 casas
  decimais (~11 m, para absorver o jitter do GPS parado).
- Os três itens são exigência da
  [política de uso](https://operations.osmfoundation.org/policies/nominatim/),
  que também **proíbe consulta sistemática**. Por isso `/posicoes` **não**
  geocodifica: seriam ~200 chamadas por carga de tela, o que além de banível
  levaria >3 min a 1 req/s. Geocodifica-se 1 ponto, no clique.
- Medido: **~750 ms** a 1ª consulta, **~0 ms** em cache. Análise completa
  (viabilidade, vantagens, desvantagens, quando trocar) em
  `secoes/telemetria/README.md` §2.
- Cache é **em memória** — some no redeploy. Persistir exigiria tabela própria,
  o que quebra a premissa somente-leitura; decisão adiada e documentada.
- Por causa do cache e do limitador locais, o serviço roda com `replicas: 1`.

### Front
- Mapa **Leaflet** (CDN com SRI) com tiles do OSM substituiu o placeholder. Pino
  por veículo, verde/cinza por ignição; `(0,0)` filtrado no SQL.
- **Painel lateral** (offcanvas) abre pelo pino **ou** por clique nas linhas das
  tabelas: placa, endereço escrito, **nome** do cliente com o carro, coordenada
  com link para o mapa, última posição, hodômetro e fonte.
  Só o nome do cliente — CPF/CNPJ, e-mail e telefone ficaram de fora.
- Painel montado no `<body>` (a casca troca o `innerHTML` da aba, e um offcanvas
  aberto ali deixaria o backdrop preso). Leaflet ganha `.remove()` explícito.
- `card()` da casca aceita um `id` opcional no wrapper.
- `dados-mock/agregar.js` passou a gerar `telemetria.posicoes` (com cliente), para
  o mapa e o painel funcionarem também em `file://`.

### Pendências abertas
- ⚠️ **`contratos.codigo_status = '1'` = vigente não foi confirmado** com a
  Locavia — é a regra que decide qual cliente aparece no painel. No mock já há
  veículo `Disponível` com cliente associado, sinal de que falta filtrar também
  `data_hora_termino`.
- Cache de geocoding não persiste entre deploys.
- Deploy dos dois serviços ainda não executado na VPS.

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
