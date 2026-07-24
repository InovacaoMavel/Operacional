# Seção: Telemetria

| | |
|---|---|
| Estado | ✅ **extraída** — front + rotas de API (é o molde das outras seções) |
| id da aba | `telemetria` (hash `#telemetria`) |
| Fonte de dados | `locavia.telemetria`, `locavia.telemetria_controle`, `locavia.vw_frota_telemetria` |
| Quem popula | ingestor **`integracao_rastrosiga`** (repo `Desktop/Rastrosiga`, stack própria na VPS) |
| Escreve no banco? | **Não.** Somente leitura |

**Objetivo:** rastreamento e saúde dos rastreadores da frota — quantos veículos
têm rastreador, quantos deram posição recente, e a fila de pendências que precisa
de revisão manual.

## Arquivos

| Arquivo | Papel |
|---|---|
| `front/aba-telemetria.js` | Render da aba. `carregar()` normaliza as duas fontes (mock/API) para um único contrato. |
| `api/rotas.py` | `/api/telemetria/{resumo,leituras,controle,frota}`. |
| `api/consultas/resumo.sql` | KPIs (rastreados / com posição recente / sem rastreador). |
| `api/consultas/por_fornecedor.sql` | Distribuição por fonte (Vai / RastroSiga / Sem Rastreador). |
| `api/consultas/controle.sql` | Pendências, com filtro opcional por `tipo_problema`. |
| `api/consultas/controle_por_tipo.sql` | Contagem agrupada por tipo (alimenta o donut). |
| `api/consultas/leituras.sql` | Últimas leituras (posição mais recente primeiro). |
| `api/consultas/frota.sql` | View frota×telemetria + `divergencia_km` (Locavia × fonte). |

## Rotas

| Rota | Devolve |
|---|---|
| `GET /api/telemetria/resumo?horas=48` | `{total, online, sem_rastreador, com_problema, por_fornecedor, problemas_por_tipo}` |
| `GET /api/telemetria/leituras?limite=25` | últimas leituras (placa, fornecedor, hodômetro, ignição, datas) |
| `GET /api/telemetria/controle?tipo=` | pendências de revisão manual (+ `detalhe_texto` pronto p/ tabela) |
| `GET /api/telemetria/frota?divergentes=false` | frota + telemetria pela view, com `divergencia_km` |

## Regras que vêm do ingestor — NÃO reimplementar aqui

Estas decisões são do `integracao_rastrosiga` (documentadas no `RUNBOOK.local.md`
do Rastrosiga, §17 a §20). Esta seção apenas **exibe** o resultado:

1. **Precedência `RastroSiga > VAI`** — carro presente nas duas fontes fica com o
   dado da RastroSiga (a VAI costuma devolver odômetro 0).
2. **Identidade pelo CHASSI**, não pela placa — a placa muda (provisória `ZZZ…`
   → definitiva), o chassi não. A view `vw_frota_telemetria` casa por chassi.
3. **`hodometro_km` é gravado CRU** — em alguns veículos a RastroSiga manda
   **metros** em vez de km. O caso é registrado como `hodometro_metros` em
   `telemetria_controle`; a normalização está pendente **com a SSX**. Ou seja:
   número alto demais na coluna hodômetro não é bug desta seção.
4. **`Sem Rastreador` é estado legítimo** (veículo sem rastreador em nenhuma
   fonte), não erro. Fica fora do KPI de dispositivos e é contado à parte.
5. **Tipos de pendência** em `telemetria_controle`: `dois_rastreadores`,
   `hodometro_metros`, `placa_nao_encontrada`, `casado_por_4digitos`. O front
   pinta os dois primeiros como críticos.
6. **Ritmo da ingestão** — a SSX aceita ~**1 requisição por minuto**, então o
   ciclo completo leva dezenas de minutos. Dado "velho" de alguns minutos é
   esperado; o cache da API (180s) é irrelevante ao lado disso.

## Pendências desta seção

- **Mapa** — hoje é um placeholder. `latitude`/`longitude` já vêm da RastroSiga
  (nulos para a VAI), então o mapa é viável sem tocar no ingestor. Falta escolher
  a biblioteca (Leaflet + tiles) e onde hospedar o asset (o front hoje usa CDN).
- **km rodado por dia** (gráfico previsto no PLANEJAMENTO §4.A.3) — `telemetria`
  guarda só a **última** leitura por veículo; não há série histórica no banco.
  Exigiria tabela de histórico no ingestor. **Fora de escopo do módulo.**
- **Cerca eletrônica / excesso de velocidade** — nada disso é ingerido hoje.
- **Divergência de KM** (`/frota?divergentes=true`) ainda não tem tela; é a
  ponte natural para a seção de Revisão Preventiva (que precisa do km real).
