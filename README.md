# Hub-locadora — Módulo Operacional

Visão específica **operacional** do Hub-locadora (Mavel / Seta Locadora): frota,
alertas, telemetria, renovação, multas, revisões preventivas e pedidos de frota.

**É um módulo de leitura.** Não integra API externa e não alimenta banco: lê o
Postgres `frota` (schema `locavia`) já alimentado pelo
[Hub-Locadora](https://github.com/InovacaoMavel/Hub-Locadora) (Locavia) e pelo
ingestor de telemetria (VAI + RastroSiga/SSX).

## Como abrir agora

Duplo clique em `front/index.html`. Em `file://` a SPA usa os dados de mock de
`dados-mock/` e todas as 7 abas renderizam.

Com a API (dado ao vivo na aba Telemetria) — precisa de túnel para o banco:

```powershell
copy .env.example .env      # preencher DB_*
pip install -r api\requirements.txt
cd api; uvicorn main:app --reload --port 8010     # http://localhost:8010
```

## Estrutura

```
front/            casca da SPA (index.html + app.js + styles.css)
secoes/<secao>/   uma pasta por seção: front/ + api/ + api/consultas/*.sql
api/              casca da API (descobre as seções, serve o front, /api/health)
dados-mock/       CSVs + mock-data.js (window.HUB_MOCK) — temporário
Mock-geral/       o mockup original (referência)
```

- Padrão de uma seção, com os contratos de front e API: **`secoes/README.md`**
- Seção pronta, para usar de molde: **`secoes/telemetria/`**
- Operação, deploy, armadilhas e fila das próximas seções: **`RUNBOOK.local.md`**
  (arquivo local, fora do git)
