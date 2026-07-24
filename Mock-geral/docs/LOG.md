# LOG — Hub-locadora (mockup)

Registro do que foi construído e das alterações. Ordenado do mais recente para o mais antigo.
Documento de planejamento: [`PLANEJAMENTO.md`](PLANEJAMENTO.md).

---

## 2026-07-17 — Botão "Home" nas telas

Adicionado botão **Home** (`bi-house-door-fill`) na navbar de `visao-executiva`, `operacional` e
`financeiro`, apontando para `../Login-home/home.html` (launcher). Fica ao lado dos botões de
navegação já existentes (Hub / Operacional / Financeiro).

---

## 2026-07-17 — Montagem dos módulos (Visão Executiva, Operacional, Financeiro)

### Contexto
Construção do mockup navegável do Hub-locadora a partir do `PLANEJAMENTO.md`, reaproveitando a
**identidade visual do FrotaBI** e alimentado pelos **dados de mock reais** em `dados-mock/`.

### Identidade visual (herdada do FrotaBI)
- **Stack:** Bootstrap 5.3.3 (+ integrity/crossorigin) · Bootstrap Icons 1.11.3 · Google Fonts *Inter* · Chart.js 4.4.3.
- **Paleta (variáveis CSS `--cor-*`):** primária `#0d2440` (azul petróleo), acento `#00b8a9` (teal),
  fundo `#f4f6fa`, semáforo ok `#16a34a` / alerta `#f59e0b` / crítico `#dc2626`.
- **Componentes:** `.dash-navbar` (gradiente), `.dash-card`, `.kpi` (borda-esquerda semáforo),
  `.dash-table`, `.pill`, `.topbar` fixo. Nomenclatura BEM; CSS custom só onde o Bootstrap não cobre.
- Referências: `../Login-home/assets/styles.css` e `Hub-Locadora/front/assets/{styles.css,dashboard.js}`.

### Estrutura criada
```
hub-geral/
├─ visao-executiva/          # Hub — visão executiva (entrada)
│  ├─ index.html
│  └─ assets/{styles.css, hub.js}
├─ operacional/              # Módulo Operacional (SPA, 7 abas)
│  ├─ index.html
│  └─ assets/{styles.css, app.js}
├─ financeiro/               # Módulo Financeiro (SPA, 7 abas)
│  ├─ index.html
│  └─ assets/{styles.css, app.js}
├─ dados-mock/               # dados de mock (CSV) + agregador + saída
│  ├─ *.csv                  # veiculos, fipe, contratos, master, clientes, telemetria...
│  ├─ agregar.js             # Node: lê os CSVs e gera mock-data.js
│  └─ mock-data.js           # window.HUB_MOCK (gerado — não editar à mão)
└─ Login-home/               # launcher (login + home) — cards atualizados
```

### Pipeline de dados
- `dados-mock/agregar.js` (Node) lê os 7 CSVs e calcula os KPIs reais, gravando
  `dados-mock/mock-data.js` como `window.HUB_MOCK`. Cada página carrega esse `<script>`
  (funciona em `file://`, sem CORS) antes do seu JS.
- **Regerar:** `node dados-mock/agregar.js dados-mock` (a partir da raiz `hub-geral`).
- Regras aplicadas: marca normalizada (VW→Volkswagen, GM→Chevrolet); receita só de contratos
  **vigentes** (`codigo_status = 1`), APP semanal→mensal (×4,33); FIPE deduplicada por chassi;
  ocupação = alugados / (alugados + disponíveis).

### Números reais apurados (dos CSVs, base 2026-07-17)
| Indicador | Valor |
|---|---|
| Frota total | 202 veículos (135 alugados · 24 disp. · 23 em preparação · 4 prep. venda) |
| Ocupação | 84,9% |
| Idade média / hodômetro médio | 11,5 meses · 12.753 km |
| Receita mensal | R$ 394.556 (FLEET 172.908 · CAAS 208.268 · APP 13.380) |
| Patrimônio | FIPE ativa R$ 20,06 mi · NF R$ 17,90 mi |
| Contratos master | 104 (82 em vigência · 22 encerrados) · 142 contratos vigentes |
| Telemetria | 175 rastreados · 14 com problema (controle) |
| Clientes | 407 (279 PF · 128 PJ) |

### Dados reais × ilustrativos (marcado com badge em cada aba)
- **Reais (CSV):** Hub (frota/receita/patrimônio); Operacional → Frota, Telemetria, Renovação;
  Financeiro → Receita, Patrimônio, Contratos.
- **Ilustrativos** (sem fonte nos CSVs): Alertas (op./fin.), Multas, Revisão Preventiva,
  Pedido de Frota, Previsibilidade, Análise Financeira.
- **Inadimplentes:** reproduz o **contrato de saída real** da automação n8n (badge "Automação n8n"),
  com o JSON mocado do `PLANEJAMENTO.md` (§4.B.6).

### Navegação
- `Login-home/home.html`: cards adicionados → Hub-locadora, Operacional, Financeiro
  (+ Estratégico/FrotaBI mantido).
- Hub → módulos via navbar e via clique nos KPIs (drill-down, âncoras `#frota`, `#receita`, etc.).
- Módulos ↔ Hub via botão na navbar. Roteamento por hash dentro de cada SPA.

### Pendências / próximos passos
- Abas ilustrativas: definir fonte real (Locavia multas/revisões, módulo interno de pedidos,
  ClickUp inadimplência) e trocar mock por dados.
- Embutir/linkar o HTML real de Inadimplentes (n8n) no lugar da reprodução.
- Validar layout responsivo em telas reais e acessibilidade (contraste/teclado).
