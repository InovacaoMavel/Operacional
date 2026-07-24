# Seção: Multas  ·  **RESERVADA**

| | |
|---|---|
| Estado | **Reservada** — ainda inline em `front/assets/app.js` (bloco `ABAS_INLINE`) |
| id da aba | `multas` (hash `#multas`) |
| Fonte de dados real | Locavia (multas) + órgão de trânsito — **não existe tabela no banco hoje** |
| Ordem de extração | ver RUNBOOK §9 |

**Objetivo:** Acompanhar multas, responsáveis e status de repasse, com o prazo de indicação.

## O que precisa existir aqui (quando for extraída)
```
multas/
├─ front/aba-multas.js        # render da aba (registra em window.OP_SECOES)
├─ api/rotas.py           # APIRouter(prefix="/api/multas") — montado sozinho pela API
├─ api/consultas/*.sql    # um arquivo por consulta, nunca SQL no Python
├─ migrations/*.sql       # SÓ se a seção precisar de tabela própria (idempotente)
└─ README.md              # este arquivo, atualizado
```
Molde pronto: `secoes/telemetria/`. Padrão da seção: `secoes/README.md`.

## Pendências antes de codar
- Confirmar se a Locavia expõe multas por endpoint (não há tabela de multas no schema `locavia`).
- Se não houver fonte, a seção precisa de tabela própria + entrada manual (escrita).
