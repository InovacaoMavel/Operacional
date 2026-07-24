-- Pendências de revisão manual. %(tipo)s NULL = todos os tipos.
SELECT placa,
       tipo_problema,
       placa_ssx,
       placa_veiculo,
       fornecedor,
       hodometro_km,
       detalhe,
       detectado_em,
       updated_at
FROM telemetria_controle
WHERE (%(tipo)s IS NULL OR tipo_problema = %(tipo)s)
ORDER BY tipo_problema, placa;
