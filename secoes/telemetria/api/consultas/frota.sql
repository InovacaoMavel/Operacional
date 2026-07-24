-- Frota + telemetria pela view oficial (casamento por CHASSI, não por placa).
-- divergencia_km compara o hodômetro do Locavia com o da fonte de telemetria;
-- com %(divergentes)s = true, devolve só os casos que merecem conferência
-- (>1.000 km de diferença OU veículo sem leitura de telemetria).
SELECT codigo_veiculo,
       placa,
       chassi,
       descricao_modelo,
       descricao_status,
       hodometro_locavia,
       fornecedor,
       hodometro_fonte,
       ultima_posicao_em,
       latitude,
       longitude,
       ignicao,
       telemetria_atualizada_em,
       (hodometro_fonte - hodometro_locavia) AS divergencia_km
FROM vw_frota_telemetria
WHERE NOT %(divergentes)s
   OR hodometro_fonte IS NULL
   OR abs(coalesce(hodometro_fonte, 0) - coalesce(hodometro_locavia, 0)) > 1000
ORDER BY placa;
