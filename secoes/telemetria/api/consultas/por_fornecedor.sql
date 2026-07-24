-- Distribuição por fonte do dado (Vai | RastroSiga | Sem Rastreador).
SELECT fornecedor, count(*) AS qtd
FROM telemetria
GROUP BY fornecedor
ORDER BY qtd DESC;
