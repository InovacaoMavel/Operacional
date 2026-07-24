# Hub‑locadora — Planejamento do Mockup

> **Tipo de documento:** planejamento de mockup (não é implementação).
> **Objetivo:** descrever a estrutura de telas, componentes e dados **mocados** do Hub‑locadora, para validar a experiência antes de codar.
> **Local sugerido:** `/docs/hub-locadora-mockup-plan.md`
> **Status:** rascunho para validação
> **Todos os números abaixo são fictícios/mocados**, ancorados na ordem de grandeza real do FrotaBI (frota de ~165 veículos) apenas para dar realismo ao protótipo.

---

## 1. Conceito

O **Hub‑locadora** é o ponto de entrada único da gestão da locadora. Ele **não** é uma tela cheia de detalhe: é uma **visão executiva geral** (o dashboard **FrotaBI** de hoje) que consolida poucos indicadores de cada área e serve de porta para as **visões específicas**, onde mora o detalhe.

Princípio de navegação: **resumo no Hub → detalhe na visão específica.**

```
                       ┌─────────────────────────────┐
                       │   HUB (Visão Executiva)     │
                       │   = FrotaBI atual           │
                       │   poucos KPIs por área      │
                       └───────────┬─────────────────┘
                                   │  drill-down
                 ┌─────────────────┴──────────────────┐
                 ▼                                     ▼
        ┌─────────────────┐                 ┌────────────────────┐
        │  OPERACIONAL    │                 │    FINANCEIRO      │
        ├─────────────────┤                 ├────────────────────┤
        │ Frota & Ocupação│                 │ Receita            │
        │ Alertas         │                 │ Previsibilidade    │
        │ Telemetria      │                 │ Patrimônio         │
        │ Renovação Frota │                 │ Alertas            │
        │ Multas          │                 │ Contratos (detalhe)│
        │ Revisão Prevent.│                 │ Inadimplentes      │
        │ Pedido de Frota │                 │ Análise Financeira │
        └─────────────────┘                 └────────────────────┘
```

### Regra do que "sobe" para o Hub
Cada visão específica **empurra 1 a 2 indicadores‑chave** para o Hub. O gerente vê o pulso geral e clica para investigar. A matriz completa está na [seção 5](#5-matriz--o-que-sobe-para-o-hub).

---

## 2. Personas e uso

| Persona | Onde vive | O que precisa |
|---|---|---|
| **Gerência / Diretoria** | Hub (executivo) | Pulso geral em 10 segundos, sem ruído. |
| **Time Operacional** | Módulo Operacional | Frota, alertas, telemetria, manutenção, compras. |
| **Time Financeiro** | Módulo Financeiro | Receita, previsão, inadimplência, contratos. |

---

## 3. Visão Executiva Geral (Hub / FrotaBI)

**Objetivo:** panorama consolidado da locadora. Densidade baixa, leitura rápida, cada bloco é clicável e leva à visão específica.

### 3.1 Faixa de KPIs principais (topo)

| Card | Valor mocado | Sublinha | Leva para |
|---|---|---|---|
| Frota total | **165** veículos | 119 alugados · 13 disp. · 21 em trânsito | Frota & Ocupação |
| Ocupação | **85,6%** | base efetiva 139 veículos | Frota & Ocupação |
| Receita mensal | **R$ 326.514** | +4,2% vs. mês anterior | Receita |
| Patrimônio (FIPE ativa) | **R$ 13,83 mi** | NF: R$ 14,74 mi | Patrimônio |
| Inadimplência | **R$ 48.900** | 6 contratos em atraso | Inadimplentes |
| Alertas críticos | **7** | 3 operacionais · 4 financeiros | Alertas |

### 3.2 Blocos-resumo (grade 2×3)

- **Composição da frota** (donut): Alugados 119 · Disponíveis 13 · Em trânsito 21 · Prep. venda 3 · Consignados 2.
- **Receita por tipo de contrato** (barras): FLEET · CAAS · RAC · APP.
- **Ocupação — tendência** (linha, últimos 6 meses): 79% → 81% → 83% → 84% → 85% → 85,6%.
- **Idade média da frota**: 11,6 meses (excl. trânsito) · hodômetro médio 14.599 km.
- **Top 3 alertas** (lista): resumo dos mais urgentes de Operacional + Financeiro.
- **Previsão de receita** (mini-linha): projeção dos próximos 3 meses.

### 3.3 Dados mocados de referência (base para todo o mockup)

```json
{
  "frota": {
    "total": 165,
    "alugados": 119,
    "disponiveis": 13,
    "em_transito": 21,
    "prep_venda": 3,
    "consignados": 2,
    "ocupacao_pct": 85.6,
    "base_efetiva": 139,
    "idade_media_meses": 11.6,
    "hodometro_medio_km": 14599
  },
  "patrimonio": {
    "valor_nf": 14743649,
    "valor_fipe_ativa": 13825853,
    "valor_revenda_a_vender": 458970
  },
  "receita_mensal": {
    "total": 326514,
    "por_tipo": { "FLEET": 158200, "CAAS": 96300, "RAC": 54088, "APP": 17926 }
  }
}
```

---

## 4. Visões específicas

Cada visão segue o mesmo template de planejamento: **Objetivo · KPIs (cards) · Componentes · Fonte de dados · Sobe para o Hub**.

---

### 4.A MÓDULO OPERACIONAL

#### 4.A.1 Frota & Ocupação
- **Objetivo:** enxergar cada veículo, status e taxa de ocupação em detalhe.
- **KPIs:** Frota 165 · Ocupação 85,6% · Disponíveis 13 · Em trânsito 21.
- **Componentes:**
  - Tabela mestre de veículos (placa, modelo, grupo, status, contrato, hodômetro, FIPE).
  - Donut de composição + linha de ocupação (12 meses).
  - Filtros: status, grupo, filial, tipo de contrato.
  - Heatmap de ocupação por grupo de veículo.
- **Fonte:** Locavia (frota/contratos) + Airtable (FROTA).
- **Sobe para o Hub:** Frota total, Ocupação.

#### 4.A.2 Alertas (operacionais)
- **Objetivo:** central de exceções operacionais que exigem ação.
- **KPIs:** Alertas ativos 3 · Críticos 1 · Resolvidos na semana 12.
- **Componentes (dados mocados):**

  | Alerta | Severidade | Veículo | Detalhe |
  |---|---|---|---|
  | Revisão vencida | Alta | ABC1D23 | 2.400 km acima do limite |
  | Veículo offline > 48h | Média | EFG4H56 | Sem sinal desde 15/07 |
  | CNH do condutor a vencer | Baixa | JKL7M89 | Vence em 9 dias |

  - Lista priorizada + filtro por severidade + ação "marcar como tratado".
- **Fonte:** Traccar (telemetria) + Locavia (revisões/documentos).
- **Sobe para o Hub:** contagem de alertas críticos operacionais.

#### 4.A.3 Telemetria
- **Objetivo:** rastreamento e saúde dos dispositivos GPS da frota.
- **KPIs:** Dispositivos online 152 · Offline 13 · Em movimento agora 88.
- **Componentes:**
  - Mapa com a frota em tempo real (pins por status).
  - Tabela: dispositivo, última posição, velocidade, ignição, bateria.
  - Gráfico de km rodado por dia (frota agregada).
  - Alertas de cerca eletrônica / excesso de velocidade.
- **Fonte:** Traccar (`traccar` stack).
- **Sobe para o Hub:** nº de veículos offline (entra em Alertas do Hub).

#### 4.A.4 Renovação de Frota
- **Objetivo:** identificar veículos que devem sair (idade/km/FIPE) e planejar a troca.
- **KPIs:** Elegíveis para renovação 18 · Idade média elegíveis 22 meses · Valor revenda estimado R$ 458.970.
- **Componentes (dados mocados):**

  | Placa | Modelo | Idade (m) | Hodômetro | FIPE atual | Recomendação |
  |---|---|---|---|---|---|
  | NOP1Q23 | Onix 1.0 | 24 | 62.300 | R$ 61.200 | Revender |
  | RST4U56 | HB20 | 23 | 58.900 | R$ 58.400 | Revender |
  | VWX7Y89 | Kwid | 20 | 49.100 | R$ 41.700 | Avaliar |

  - Régua de política (ex.: renovar aos 24 meses **ou** 60.000 km).
  - Simulador: impacto no patrimônio ao renovar N veículos.
- **Fonte:** Locavia + tabela FIPE + Airtable.
- **Sobe para o Hub:** nº de veículos elegíveis para renovação.

#### 4.A.5 Multas
- **Objetivo:** acompanhar multas, responsáveis e status de repasse.
- **KPIs (mocados):** Multas no mês 9 · Valor total R$ 3.420 · Pendentes de indicação 4 · Repassadas ao cliente 5.
- **Componentes:**

  | Data | Placa | Infração | Valor | Condutor | Status |
  |---|---|---|---|---|---|
  | 03/07 | ABC1D23 | Velocidade | R$ 195,23 | Cliente FLEET | Repassada |
  | 08/07 | EFG4H56 | Zona azul | R$ 88,38 | RAC | Pend. indicação |
  | 11/07 | JKL7M89 | Rodízio | R$ 293,47 | CAAS | Em recurso |

  - Filtro por status/tipo, prazo de indicação (contador regressivo).
- **Fonte:** Locavia (multas) + órgão de trânsito.
- **Sobe para o Hub:** multas pendentes de indicação (prazo crítico).

#### 4.A.6 Revisão Preventiva
- **Objetivo:** garantir manutenção em dia e reduzir parada não planejada.
- **KPIs (mocados):** Revisões vencidas 4 · A vencer em 15 dias 11 · Em oficina agora 3.
- **Componentes:**

  | Placa | Próxima revisão | Base | Situação |
  |---|---|---|---|
  | ABC1D23 | 40.000 km | -2.400 km | Vencida |
  | MNO2P34 | 30.000 km | +800 km | A vencer |
  | QRS5T67 | 12 meses | 9 dias | A vencer |

  - Calendário de revisões + timeline por veículo.
  - Custo médio de revisão (entra na Análise Financeira).
- **Fonte:** Locavia (ordens de serviço/hodômetro) + Traccar (km real).
- **Sobe para o Hub:** revisões vencidas (entra em Alertas do Hub).

#### 4.A.7 Pedido de Frota (requisição de compra)
- **Objetivo:** planejar e acompanhar a aquisição de novos veículos.
- **KPIs (mocados):** Pedidos abertos 3 · Veículos em pedido 22 · Previsão de entrega 45 dias · Investimento previsto R$ 2,1 mi.
- **Componentes:**

  | Pedido | Modelo | Qtd | Status | Entrega prevista |
  |---|---|---|---|---|
  | #1042 | Onix Plus | 10 | Aprovado | 30 dias |
  | #1043 | HB20S | 8 | Em cotação | 60 dias |
  | #1044 | Kardian | 4 | Rascunho | — |

  - Funil de status (Rascunho → Cotação → Aprovado → Entregue).
  - Ligação com **Renovação de Frota** (pedidos que substituem veículos elegíveis).
- **Fonte:** módulo interno do Hub (mocado) + Locavia.
- **Sobe para o Hub:** investimento previsto em novos veículos.

---

### 4.B MÓDULO FINANCEIRO

#### 4.B.1 Receita
- **Objetivo:** detalhar a receita por tipo de contrato e evolução.
- **KPIs:** Receita mensal R$ 326.514 · Ticket médio R$ 2.683 · Carros gerando receita 119.
- **Componentes:**
  - Barras por tipo: **FLEET R$ 158.200 · CAAS R$ 96.300 · RAC R$ 54.088 · APP R$ 17.926**.
  - Linha de receita (12 meses) com meta.
  - Tabela de receita por contrato/cliente.
  - Segmentação APP vs. CAAS pela regra de combustível (já definida no backend).
- **Fonte:** Locavia (contratos/faturamento).
- **Sobe para o Hub:** receita mensal total + variação %.

#### 4.B.2 Previsibilidade
- **Objetivo:** projetar receita futura com base em contratos vigentes e renovações.
- **KPIs (mocados):** Receita contratada próximos 90 dias R$ 940.000 · Contratos a renovar 14 · Risco de churn R$ 62.000.
- **Componentes:**
  - Linha projetada 6 meses (cenário base / otimista / pessimista).
  - Waterfall: receita atual → renovações → novos contratos → churn → projetada.
  - Tabela de contratos por data de término.
- **Fonte:** Locavia (vigência de contratos) + histórico.
- **Sobe para o Hub:** projeção de receita dos próximos 3 meses.

#### 4.B.3 Patrimônio
- **Objetivo:** valor do ativo imobilizado (frota) e sua evolução.
- **KPIs:** Valor NF R$ 14.743.649 · FIPE ativa R$ 13.825.853 · Depreciação acumulada R$ 917.796 · Revenda a vender R$ 458.970.
- **Componentes:**
  - Comparativo NF × FIPE por grupo de veículo.
  - Curva de depreciação da frota.
  - Distribuição de valor por faixa etária.
- **Fonte:** Locavia + tabela FIPE + NF de compra.
- **Sobe para o Hub:** patrimônio FIPE ativa.

#### 4.B.4 Alertas (financeiros)
- **Objetivo:** exceções financeiras que pedem ação.
- **KPIs (mocados):** Alertas ativos 4 · Críticos 2.
- **Componentes:**

  | Alerta | Severidade | Detalhe |
  |---|---|---|
  | Contrato vencido não faturado | Alta | Cliente #221 · R$ 8.900 |
  | Inadimplência > 30 dias | Alta | 3 contratos · R$ 31.400 |
  | Reajuste contratual pendente | Média | 2 contratos FLEET |
  | Nota fiscal não emitida | Baixa | 5 faturas |

- **Fonte:** Locavia (financeiro) + regras internas.
- **Sobe para o Hub:** nº de alertas financeiros críticos.

#### 4.B.5 Contratos (detalhado)
- **Objetivo:** visão granular de cada contrato ativo.
- **KPIs (mocados):** Contratos ativos 142 · FLEET 61 · CAAS 44 · RAC 33 · APP 4.
- **Componentes:**

  | Contrato | Cliente | Tipo | Veículos | Início | Fim | Mensal |
  |---|---|---|---|---|---|---|
  | #1201 | Empresa Alfa | FLEET | 12 | 01/24 | 01/26 | R$ 34.800 |
  | #1202 | Cliente Bravo | CAAS | 1 | 03/25 | 03/26 | R$ 2.690 |
  | #1203 | Locação Charlie | RAC | 1 | 10/07 | 24/07 | R$ 1.180 |

  - Filtros por tipo, cliente, status, vigência.
  - Detalhe do contrato: veículos vinculados, faturas, aditivos.
- **Fonte:** Locavia (get master + get contrato).
- **Sobe para o Hub:** total de contratos ativos.

#### 4.B.6 Inadimplentes  ✅ *já existe — reaproveitar*
- **Status:** **esta visão já está pronta.** É um **dashboard HTML** renderizado no fim de um **fluxo n8n** de 3 Code nodes. A automação já roda e atualiza o painel. No mockup, basta alimentar o passo final com **dados mocados** no formato de saída real (abaixo), mantendo layout, KPIs e lógica.
- **Objetivo:** acompanhar boletos em atraso, enriquecidos com tempo de cliente e situação do contrato, e conduzir a régua de cobrança.

- **Pipeline real da automação (n8n):**

  | # | Node | O que faz | Fonte |
  |---|---|---|---|
  | 1 | `Calcular Tempo de Cliente` | Deduplica contratos por cliente e calcula há quanto tempo é cliente (funde contratos com gap ≤ **60 dias** = mesmo relacionamento; gap maior conta como novo). Também monta o mapa `numeroFatura → codigoCliente`. | Locavia (`GET contratos`, `GET faturas`) |
  | 2 | `Verificar Master por Cliente` | Consulta o master de cada grupo e decide se o cliente está **Ativo / Encerrado / Indeterminado** pelo **grupo mais recente** (`codigoSituacao` 1 = Aberto, 3 = Encerrado). | Locavia `contratos-grupos/contratos-master` |
  | 3 | `Calcular inadimplentes com master` | Lê os boletos, calcula atraso/juros, cruza com tempo de cliente e situação do master, ordena por valor e monta as linhas + totalizador do painel. | **ClickUp** (tasks) + saídas dos nós 1 e 2 |

- **Regras de negócio embutidas (não reinventar):**
  - Boleto entra se estiver **vencido** (`due_date` < hoje) e com **saldo > 0** (`parcela − pago`).
  - **Multa** = 2% do saldo · **Juros** = 1% a.m. compostos por dia (`saldo·(1+0,01/30)^diasAtraso − saldo`). **Total** = saldo + multa + juros.
  - **Exclusão:** clientes que começam com `RZD`/`Rezende` são ignorados (`EXCLUIR_REZENDE = true`).
  - **PF e PJ:** nome vem de `razaoSocial` → `nomeFantasia` → `nome`.
  - Linha final **`TOTALIZADOR GERAL`** com soma de principal e total (`dias = null`).

- **Contrato de dados REAL (saída do node 3 → consumida pelo HTML):**
  O node retorna **um único item** com metadados + o array `rows`. Cada linha de `rows` tem:

  | Campo | Descrição |
  |---|---|
  | `cliente` | Nome do cliente |
  | `principal` | Saldo em atraso, formatado BRL |
  | `totalJuros` | Total com multa + juros, formatado BRL |
  | `pct` | % sobre o total geral |
  | `dias` | Dias de atraso (`null` na linha totalizador) |
  | `previsao` | Data de previsão de recebimento (dd/mm/aaaa) |
  | `clienteDesde` | Data de início do relacionamento |
  | `tempoComoCliente` | Ex.: "28 meses" / "12 dias" |
  | `clienteAtivo` | `Sim` / `Não` / `—` |
  | `situacaoCliente` | `Cliente ativo` / `Master encerrado` / `Indeterminado` |
  | `grupoAtual`, `situacaoGrupoAtual`, `gruposResumo` | Colunas de auditoria |

  Metadados no mesmo item: `geradoEm`, `horaAtt`, `hojeISO`, `matchRate` (% de clientes casados com tempo), `boletosClienteAtivo`, `boletosMasterEncerrado`, `boletosMasterIndef`, `semTempo`.

- **Dados mocados no formato exato de saída (plugar direto no passo de render):**

  ```json
  [{
    "geradoEm": "17/07/2026",
    "horaAtt": "14:30",
    "hojeISO": "2026-07-17",
    "matchRate": 92,
    "boletosClienteAtivo": 4,
    "boletosMasterEncerrado": 1,
    "boletosMasterIndef": 1,
    "semTempo": [],
    "rows": [
      { "cliente": "Empresa Delta", "principal": "R$ 15.200,00", "totalJuros": "R$ 17.400,00", "pct": "35,58%", "dias": 41, "previsao": "05/06/2026", "clienteDesde": "12/03/2024", "tempoComoCliente": "28 meses", "clienteAtivo": "Sim", "situacaoCliente": "Cliente ativo", "grupoAtual": "1024", "situacaoGrupoAtual": "Aberto", "gruposResumo": "1024:Aberto" },
      { "cliente": "Cliente Echo", "principal": "R$ 9.100,00", "totalJuros": "R$ 9.900,00", "pct": "20,25%", "dias": 28, "previsao": "18/06/2026", "clienteDesde": "01/09/2025", "tempoComoCliente": "10 meses", "clienteAtivo": "Sim", "situacaoCliente": "Cliente ativo", "grupoAtual": "1188", "situacaoGrupoAtual": "Aberto", "gruposResumo": "1188:Aberto" },
      { "cliente": "Cliente Foxtrot", "principal": "R$ 7.800,00", "totalJuros": "R$ 8.100,00", "pct": "16,56%", "dias": 15, "previsao": "01/07/2026", "clienteDesde": "20/11/2025", "tempoComoCliente": "8 meses", "clienteAtivo": "Não", "situacaoCliente": "Master encerrado", "grupoAtual": "1201", "situacaoGrupoAtual": "Encerrado", "gruposResumo": "1201:Encerrado" },
      { "cliente": "TOTALIZADOR GERAL", "principal": "R$ 45.100,00", "totalJuros": "R$ 48.900,00", "pct": "100,00%", "dias": null, "previsao": "", "clienteDesde": "", "tempoComoCliente": "", "clienteAtivo": "", "situacaoCliente": "", "grupoAtual": "", "situacaoGrupoAtual": "", "gruposResumo": "" }
    ]
  }]
  ```

- **Estratégia de mock (2 opções):**
  1. **Mais limpa:** desligar os 3 Code nodes e injetar o objeto acima direto no node que renderiza o HTML (via *pin data* ou um Code node de mock). Zero chamadas a ClickUp/Locavia.
  2. **Mais realista:** usar *pin data* no node de tasks do **ClickUp** (`Get many tasks - Inadimplentes e bloqueio2`) e deixar o pipeline calcular — testa também multa/juros e o cruzamento.

- **O que o painel HTML já entrega (não refazer):** aging bar clicável, KPIs executivos, top devedores, gráfico por faixa de atraso, tabela ordenável com linha crítica (>30 dias), filtros (busca/cliente/faixa/previsão), export CSV, modo PDF (`?pdf=1`) e layout responsivo (tabela vira cards no celular).

- **Régua de cobrança (contexto do negócio):**

  | Marco | Gatilho | Ação |
  |---|---|---|
  | Previsão de Recebimento | Dia 0 (faturado, a vencer) | Acompanhamento |
  | Inadimplentes | 1 dia de atraso | Cobrança intensiva |
  | Aviso Serasa | 20 dias | Notificação de possível inclusão |
  | Bloqueio | 25 dias | Notificação extrajudicial (prazo 5 dias) |
  | Protestado / negativação | 30 dias | Bloqueio/coleta + inclusão no órgão de crédito |

- **KPIs (mocados):** Inadimplência total R$ 48.900 · Boletos em atraso 6 · Atraso médio 22 dias · Match de tempo 92%.
- **Fontes reais:** **ClickUp** (boletos/tasks) + **Locavia** (contratos, faturas, master). Ações de negativação (**CredCheck**) e cobrança (**Chatwoot + Evolution**) ficam simuladas no mockup.
- **Sobe para o Hub:** valor total inadimplente (linha `TOTALIZADOR GERAL`).

#### 4.B.7 Análise Financeira
- **Objetivo:** rentabilidade e saúde financeira consolidada.
- **KPIs (mocados):** Margem operacional 34% · Custo/veículo/mês R$ 1.290 · ROI frota 18% a.a. · EBITDA R$ 111.000/mês.
- **Componentes:**
  - DRE simplificada (receita − custos operacionais − manutenção − depreciação).
  - Receita × Custo por tipo de contrato (rentabilidade por linha).
  - Custo de manutenção (vem de Revisão Preventiva) × receita.
  - Break-even por veículo.
- **Fonte:** consolidação de Receita + Patrimônio + Revisão Preventiva + Multas.
- **Sobe para o Hub:** margem operacional (indicador executivo).

---

## 5. Matriz — o que sobe para o Hub

| Visão específica | Indicador que sobe | Card no Hub |
|---|---|---|
| Frota & Ocupação | Frota total + Ocupação % | Frota / Ocupação | ## Separar Frota e Ocupação -> frota possibilidade de alterar status manualmente(listagem de frota) e Ocupação (view atual de frota&ocupação)
| Alertas (op.) | Nº alertas críticos | Alertas críticos |
| Telemetria | Veículos offline | (feed de Alertas) |
| Renovação Frota | Elegíveis p/ renovação | (bloco frota) |
| Multas | Pendentes de indicação | (feed de Alertas) |
| Revisão Preventiva | Revisões vencidas | (feed de Alertas) |
| Pedido de Frota | Investimento previsto | (bloco patrimônio) |
| Receita | Receita mensal + var. % | Receita mensal |
| Previsibilidade | Projeção 3 meses | Mini-linha previsão |
| Patrimônio | FIPE ativa | Patrimônio |
| Alertas (fin.) | Nº alertas críticos | Alertas críticos |
| Contratos | Contratos ativos | (bloco receita) |
| Inadimplentes | Valor inadimplente | Inadimplência |
| Análise Financeira | Margem operacional | (indicador executivo) |

---

## 6. Fontes de dados (para trocar mock por real depois)

| Domínio | Fonte real | Status no mockup |
|---|---|---|
| Frota, contratos, receita, multas, revisões | **Locavia API** | Mocado |
| Telemetria / GPS | **Traccar** (stack Swarm) | Mocado |
| Base histórica de frota / FIPE | **Airtable** | Mocado |
| **Inadimplentes** | **ClickUp (boletos) + Locavia (contratos/master) → n8n → HTML** | **✅ pronto, com dados mocados** |
| Negativação | **CredCheck** | Mocado |
| Cobrança / mensageria | **Chatwoot + Evolution API** | Mocado |

> No mockup, cada visão consome um **JSON de mock** (como o da seção 3.3). A troca para dados reais é só substituir a fonte, mantendo o mesmo contrato de dados.

---

## 7. Próximos passos sugeridos

1. Validar a lista de visões e o que "sobe" para o Hub (seção 5).
2. Confirmar as regras de política (renovação, prazo de multa, aging de inadimplência).
3. Definir o layout visual do Hub (baixa densidade) vs. visões específicas (alta densidade).
4. Gerar os JSONs de mock por visão em `/docs/mocks/`.
5. **Inadimplentes:** apenas plugar o JSON mocado na automação n8n existente (visão já pronta) e embutir/linkar o HTML no Hub.
6. Prototipar o Hub + 1 visão de cada módulo para validar a navegação drill-down.

---

*Documento de planejamento — dados fictícios para fins de mockup.*