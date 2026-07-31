# Seção: Telemetria

| | |
|---|---|
| Estado | ✅ **extraída** — e a 1ª a virar **microsserviço** (`telemetria-svc`) |
| id da aba | `telemetria` (hash `#telemetria`) |
| Fonte de dados | `locavia.telemetria`, `locavia.telemetria_controle`, `locavia.vw_frota_telemetria`, `locavia.contratos`, `locavia.clientes` |
| Quem popula | ingestor **`integracao_rastrosiga`** (repo `Desktop/Rastrosiga`, stack própria na VPS) |
| Serviço externo | **Nominatim/OpenStreetMap** — reverse geocoding (ver §Cache) |
| Escreve no banco? | **Não.** Somente leitura |

**Objetivo:** rastreamento e saúde dos rastreadores da frota — quantos veículos
têm rastreador, quantos deram posição recente, onde cada um está, e a fila de
pendências que precisa de revisão manual.

---

## 1. Arquitetura

```
Frontend
   │
   ▼
Operacional API (BFF / gateway)        ← único publicado pelo Traefik (Basic Auth)
   │  proxy: TELEMETRIA_URL=http://telemetria:8000
   ▼
telemetria-svc                          ← rede interna do Swarm, sem porta exposta
   ├──► Postgres 'frota' (somente leitura)
   └──► Nominatim/OSM (reverse geocoding, 1 ponto por clique)
```

O BFF (`api/main.py` + `api/proxy.py`) não conhece regra de negócio: repassa
`/api/telemetria/*` sem reescrever o caminho. A URL é idêntica com ou sem proxy,
então o front não muda quando uma seção migra.

**Modo embutido (dev).** Sem `TELEMETRIA_URL` no ambiente, o BFF monta o
`rotas.py` no próprio processo e tudo roda num container só. É o mesmo código —
só não tem o hop de rede. Útil para depurar sem subir dois serviços.

> **Réplica única, e não é sobre capacidade.** O `telemetria-svc` roda com
> `replicas: 1` porque o cache de geocoding e o limitador de 1 req/s vivem na
> memória do processo. Duas réplicas = dois caches frios e **2 req/s** no
> Nominatim — violação da política de uso, que dá banimento de IP. Escalar exige
> primeiro mover o cache para fora (§2.4) ou subir Nominatim próprio.

## 2. Endereço a partir de lat/long — o Nominatim e o cache

### 2.1 A política de uso não é sugestão

Fonte: **https://operations.osmfoundation.org/policies/nominatim/**

| Regra | Como esta seção cumpre |
|---|---|
| Máximo **1 requisição por segundo** | `_LIMITE` (Lock global) + intervalo mínimo de 1,1 s em `geocoding.py`. Chamadas em série, nunca em paralelo. |
| **User-Agent identificando a aplicação** | `NOMINATIM_USER_AGENT` no `.env`, com URL e e-mail de contato. Default de biblioteca é motivo de bloqueio. |
| **Cachear os resultados** | `_cache` em `geocoding.py` — §2.2 abaixo. |
| **Proibido**: autocomplete, consultas sistemáticas/em grade, varredura da base, revenda | Geocodifica-se **1 ponto, no clique do usuário**. Os pinos do mapa **não** são geocodificados. |

⚠️ **O ponto que mais importa no desenho:** a tentação óbvia era mandar o
endereço já em `/posicoes`, junto de cada pino. Isso seriam ~200 requisições a
cada carga da tela — a definição literal de "consulta sistemática" que a política
proíbe, e a 1 req/s levaria **mais de 3 minutos** para desenhar o mapa. Por isso
`/posicoes` devolve só coordenada, e o endereço sai em `/veiculo/{placa}`.

### 2.2 O cache — viabilidade, vantagens e desvantagens

**O problema que ele resolve.** Medido contra o Nominatim público, em julho/2026:

| | Latência | Origem |
|---|---|---|
| 1ª consulta de uma coordenada | **~750 ms** | rede + Nominatim |
| Mesma coordenada de novo | **~0 ms** | cache |
| Coordenada 5 m ao lado | **~0 ms** | cache (mesma chave) |

Sem cache, **todo** clique custaria ~750 ms — e, pior, dois usuários clicando ao
mesmo tempo virariam fila: o segundo esperaria ~750 ms do primeiro **mais** o
1,1 s do limitador. Com cache, o segundo clique no mesmo carro é instantâneo.

**Como funciona.**

```
chave  = "lat,lon" arredondado para 4 casas decimais   (≈ 11 metros)
valor  = (timestamp, endereço)
TTL    = 7 dias          (GEOCACHE_TTL_SECONDS)
teto   = 5.000 chaves    (GEOCACHE_MAX), descarte do mais antigo
```

O **arredondamento é a peça central**. O GPS de um carro parado oscila alguns
metros entre leituras; sem arredondar, cada leitura vira uma chave nova e o
cache teria ~0% de acerto — existiria no papel e não serviria para nada. 4 casas
≈ 11 m: fino o bastante para não trocar de rua, grosso o bastante para absorver
o jitter. Está em `GEOCACHE_PRECISAO` se precisar calibrar.

**TTL de 7 dias é seguro** porque endereço de uma coordenada não muda — rua não
se move. O que muda é o carro estar lá, e isso vem do banco, não do cache.

**Falha não entra no cache.** Nominatim fora do ar devolve `origem:
"indisponivel"` e nada é gravado; o próximo clique tenta de novo. Cachear erro
por 7 dias transformaria um blip de rede em "endereço sumiu e não volta".

**Vantagens**

- Latência de ~750 ms → ~0 ms na repetição, que é o caso comum (a operação
  clica nos mesmos carros o dia todo).
- Reduz drasticamente as chamadas ao serviço público — que é exatamente o que a
  política pede, e o que nos mantém longe de um bloqueio.
- Custo zero de infra: é um `dict` com Lock. Sem Redis, sem tabela, sem migração.
- Absorve o pior caso do limitador: um carro já consultado nunca entra na fila
  de 1 req/s.

**Desvantagens — e são reais**

1. **Morre a cada deploy/restart.** Cache em memória zera junto com o processo.
   Depois de um `docker service update`, os primeiros cliques voltam a custar
   ~750 ms até reaquecer. Para o volume atual (poucos usuários, dezenas de
   veículos consultados por dia) isso é irrelevante — mas é a limitação nº 1.
2. **Não é compartilhado entre réplicas.** Por isso `replicas: 1` no stack. É uma
   restrição de arquitetura escondida numa escolha de cache: quem for escalar o
   serviço precisa ler isto antes.
3. **Ocupa memória do processo.** 5.000 chaves × ~150 bytes ≈ 1 MB. Desprezível,
   mas o teto existe para não crescer sem limite num cenário inesperado.
4. **Descarte é "o mais antigo", não LRU.** Um endereço muito usado pode ser
   descartado antes de um usado uma vez só. Com teto de 5.000 e o volume atual,
   o teto nunca deve ser atingido — implementar LRU agora seria complexidade sem
   problema correspondente.
5. **O primeiro clique ainda custa ~750 ms.** Cache não resolve cache-miss. O
   painel abre imediatamente com placa/modelo/cliente e mostra "Buscando…" só no
   endereço, para a espera não travar a tela inteira.

**Viabilidade: sim, para agora.** O desenho atual é adequado ao volume declarado
(poucos usuários, uso interno). Ele foi escolhido por ser o único que **não
quebra a premissa somente-leitura do módulo** — ver §2.3.

### 2.3 Por que o cache não é persistente

A opção óbvia para resolver a desvantagem nº 1 seria uma tabela
`operacional.geocache (lat, lon, endereco, consultado_em)`. Ela **não foi feita**
porque este módulo é **somente leitura** por decisão registrada no RUNBOOK: a
conexão abre com `read_only = True` e qualquer INSERT levanta erro. Criar essa
tabela é o tipo de mudança que o próprio RUNBOOK manda decidir **antes** de
codar, não no meio de uma feature.

Se/quando valer a pena, o caminho é: migração idempotente em
`secoes/telemetria/migrations/`, uma conexão de escrita separada (a read-only
continua para o resto), e `geocoding.py` passa a consultar a tabela antes do
`dict`. A interface `endereco_de()` não muda — o resto do código não fica sabendo.

### 2.4 Quando trocar de abordagem

| Sintoma | O que fazer |
|---|---|
| Reaquecer depois do deploy incomoda | Cache persistente em tabela (§2.3) |
| Precisar de mais de 1 réplica | Redis compartilhado, ou Nominatim próprio |
| Volume passar de ~1 consulta/s sustentada | **Nominatim próprio** (`mediagis/nominatim`): mesma API, sem limite de taxa. Só trocar `NOMINATIM_URL` — nenhum código muda |
| Precisar de endereço em massa (relatório) | Nominatim próprio. Em massa no serviço público é banimento |

Acompanhe pelo `GET /api/telemetria/geocoding/status`: taxa de acerto,
chamadas feitas e falhas. Taxa de acerto baixa = arredondamento mal calibrado ou
frota muito dispersa.

## 3. Arquivos

| Arquivo | Papel |
|---|---|
| `Dockerfile` | Imagem do `telemetria-svc`. Copia `secoes/telemetria/api/` + `api/dados.py` (única peça compartilhada com o BFF). |
| `requirements.txt` | Deps do serviço (inclui `httpx`, para o Nominatim). |
| `api/servico.py` | App FastAPI do microsserviço: monta `rotas.py` e expõe `/health`. |
| `api/rotas.py` | As rotas `/api/telemetria/*`. |
| `api/geocoding.py` | Cliente Nominatim: limitador de 1 req/s, cache, formatação do endereço. |
| `api/consultas/resumo.sql` | KPIs (rastreados / com posição recente / sem rastreador). |
| `api/consultas/por_fornecedor.sql` | Distribuição por fonte (Vai / RastroSiga / Sem Rastreador). |
| `api/consultas/controle.sql` | Pendências, com filtro opcional por `tipo_problema`. |
| `api/consultas/controle_por_tipo.sql` | Contagem agrupada por tipo (alimenta o donut). |
| `api/consultas/leituras.sql` | Últimas leituras (posição mais recente primeiro). |
| `api/consultas/frota.sql` | View frota×telemetria + `divergencia_km` (Locavia × fonte). |
| `api/consultas/posicoes.sql` | Pinos do mapa: veículos com coordenada válida. Sem endereço. |
| `api/consultas/veiculo.sql` | Ficha do painel lateral: telemetria + contrato vigente + cliente. |
| `front/aba-telemetria.js` | Render da aba: KPIs, donut, mapa Leaflet, tabelas e painel lateral. |

## 4. Rotas

| Rota | Devolve |
|---|---|
| `GET /api/telemetria/resumo?horas=48` | `{total, online, sem_rastreador, com_problema, por_fornecedor, problemas_por_tipo}` |
| `GET /api/telemetria/leituras?limite=25` | últimas leituras (placa, fornecedor, hodômetro, ignição, datas) |
| `GET /api/telemetria/controle?tipo=` | pendências de revisão manual (+ `detalhe_texto` pronto p/ tabela) |
| `GET /api/telemetria/frota?divergentes=false` | frota + telemetria pela view, com `divergencia_km` |
| `GET /api/telemetria/posicoes` | pinos do mapa: placa, modelo, status, lat/long, ignição. **Sem endereço** (§2.1) |
| `GET /api/telemetria/veiculo/{placa}` | ficha do painel: dados do veículo + `cliente_nome` + `endereco` + `origem` |
| `GET /api/telemetria/geocoding/status` | diagnóstico do cache de endereços |
| `GET /health` | (só no serviço, não passa pelo BFF) banco + cache |

`origem` em `/veiculo/{placa}` diz de onde veio o endereço: `cache`, `nominatim`,
`indisponivel` (serviço fora) ou `sem_coordenada`. O front usa isso para explicar
a ausência em vez de mostrar um campo vazio.

## 5. A tela

**Mapa** (Leaflet + tiles do OpenStreetMap). Um pino por veículo com coordenada
válida; verde = ignição ligada, cinza = desligada. Hover mostra placa e modelo;
**clique abre o painel lateral**. Coordenada `(0,0)` é filtrada no SQL — é o que
um rastreador manda antes de fixar posição, e o pino cairia no Atlântico.

> A [Tile Usage Policy da OSM](https://operations.osmfoundation.org/policies/tiles/)
> exige a atribuição que está no canto do mapa (**não remover**) e proíbe uso
> pesado. Uso interno e leve está dentro; se o mapa virar tela pública, migrar
> para tiles próprios ou um provedor pago.

**Painel lateral** (offcanvas à direita). Abre pelo pino do mapa **ou** clicando
numa linha das tabelas "Últimas leituras" e "Controle". Mostra:

- **placa** e modelo, com status e ignição;
- **onde está** — o endereço escrito;
- coordenada + link para abrir no mapa (a saída quando o geocoding falha);
- **cliente com o carro** — só o nome;
- última posição, hodômetro da telemetria e fonte.

O painel é criado no `<body>`, não dentro da aba: a casca troca o `innerHTML` ao
mudar de aba, e um offcanvas aberto ali deixaria o backdrop preso na tela.

**Privacidade:** o painel mostra **só o nome** do cliente. CPF/CNPJ, e-mail e
telefone estão na mesma tabela e foram deixados de fora de propósito — a tela de
operação não precisa deles, e dado pessoal que não aparece não vaza.

## 6. Regras que vêm do ingestor — NÃO reimplementar aqui

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

## 7. Pendências desta seção

- **⚠️ `contratos.codigo_status = '1'` = contrato vigente** — é a regra que
  decide **qual cliente aparece no painel**, e ela veio do agregador do mock
  (`dados-mock/agregar.js`), **não** de confirmação com a Locavia. Se estiver
  errada, o painel mostra o cliente errado. É a pendência mais urgente daqui:
  no mock já aparecem veículos com status `Disponível` e cliente associado, o que
  sugere que `'1'` sozinho não basta (provável necessidade de filtrar também por
  `data_hora_termino`). **Confirmar antes de a tela virar operação de verdade.**
- **Cache de geocoding não persiste** entre deploys — §2.2, desvantagem 1. Custo
  atual aceitável; a saída está em §2.3.
- **km rodado por dia** (gráfico previsto no PLANEJAMENTO §4.A.3) — `telemetria`
  guarda só a **última** leitura por veículo; não há série histórica no banco.
  Exigiria tabela de histórico no ingestor. **Fora de escopo do módulo.**
- **Cerca eletrônica / excesso de velocidade** — nada disso é ingerido hoje.
- **Divergência de KM** (`/frota?divergentes=true`) ainda não tem tela; é a
  ponte natural para a seção de Revisão Preventiva (que precisa do km real).
- **Agrupar pinos** (clustering) — com ~60 veículos posicionados o mapa está
  legível. Passando de algumas centenas, avaliar `Leaflet.markercluster`.
