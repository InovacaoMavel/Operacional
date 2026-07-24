-- Últimas leituras. NULLS LAST porque a VAI não manda event_date.
SELECT placa,
       fornecedor,
       hodometro_km,
       ignicao,
       event_date  AS ultima_posicao_em,
       updated_at  AS atualizada_em
FROM telemetria
WHERE fornecedor <> 'Sem Rastreador'
ORDER BY event_date DESC NULLS LAST, updated_at DESC
LIMIT %(limite)s;
