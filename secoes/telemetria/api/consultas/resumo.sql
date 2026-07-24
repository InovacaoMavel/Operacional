-- KPIs da aba Telemetria. Devolve SEMPRE 1 linha.
--   total          = veículos com rastreador em alguma fonte (exclui 'Sem Rastreador')
--   online         = destes, os que têm posição dentro da janela %(horas)s
--   sem_rastreador = estado legítimo (o ingestor marca quem não achou em nenhuma fonte)
SELECT
    count(*) FILTER (WHERE fornecedor <> 'Sem Rastreador')                        AS total,
    count(*) FILTER (WHERE fornecedor <> 'Sem Rastreador'
                       AND event_date >= now() - make_interval(hours => %(horas)s)) AS online,
    count(*) FILTER (WHERE fornecedor  = 'Sem Rastreador')                        AS sem_rastreador
FROM telemetria;
