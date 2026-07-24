-- Pendências agrupadas: dois_rastreadores | hodometro_metros
--                       | placa_nao_encontrada | casado_por_4digitos
SELECT tipo_problema, count(*) AS qtd
FROM telemetria_controle
GROUP BY tipo_problema
ORDER BY qtd DESC;
