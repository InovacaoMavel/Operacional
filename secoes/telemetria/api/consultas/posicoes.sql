-- Pinos do mapa: um por veículo COM coordenada válida.
--
-- Sem endereço de propósito. Geocodificar os ~200 pontos a cada carga da tela
-- seria "consulta sistemática" no Nominatim — proibido pela política de uso e
-- motivo de banimento. O endereço é resolvido em /veiculo/{placa}, para UM
-- veículo, quando o usuário abre o painel lateral. Ver api/geocoding.py.
--
-- (0,0) é o "ilha nula" no Atlântico: rastreador que ainda não fixou posição
-- manda zero, e o pino cairia no meio do oceano.
SELECT placa,
       chassi,
       descricao_modelo,
       descricao_status,
       fornecedor,
       latitude,
       longitude,
       ignicao,
       hodometro_fonte,
       ultima_posicao_em
FROM vw_frota_telemetria
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND latitude BETWEEN -90 AND 90
  AND longitude BETWEEN -180 AND 180
  AND NOT (latitude = 0 AND longitude = 0)
ORDER BY placa;
