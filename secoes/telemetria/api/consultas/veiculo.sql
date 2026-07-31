-- Ficha de UM veículo para o painel lateral: telemetria + contrato vigente + cliente.
--
-- Cadeia do "quem está com o carro":
--     vw_frota_telemetria.codigo_veiculo -> contratos.codigo_veiculo
--     contratos.codigo_cliente           -> clientes.codigo_cliente
--
-- ATENÇÃO — `codigo_status = '1'` significa CONTRATO VIGENTE. Essa convenção veio
-- do agregador do mock (dados-mock/agregar.js, receita mensal) e ainda NÃO foi
-- confirmada contra o domínio real da Locavia. Se estiver errada, o painel mostra
-- o cliente errado — está registrado como pendência no README da seção.
-- O literal fica entre aspas para funcionar com a coluna sendo text ou integer.
--
-- LEFT JOIN em tudo: veículo sem contrato (disponível, em manutenção) precisa
-- aparecer no painel do mesmo jeito, só que sem cliente.
SELECT v.codigo_veiculo,
       v.placa,
       v.chassi,
       v.descricao_modelo,
       v.descricao_status,
       v.fornecedor,
       v.latitude,
       v.longitude,
       v.ignicao,
       v.hodometro_fonte,
       v.hodometro_locavia,
       v.ultima_posicao_em,
       v.telemetria_atualizada_em,
       c.numero_contrato,
       c.data_hora_inicio       AS contrato_inicio,
       c.data_hora_termino      AS contrato_termino,
       cli.codigo_cliente,
       -- Nome comercial primeiro; razão social como reserva. O painel mostra
       -- SÓ o nome — sem CPF/CNPJ, e-mail ou telefone (dado pessoal não vai
       -- para uma tela de operação que não precisa dele).
       coalesce(nullif(cli.nome_fantasia, ''), cli.razao_social) AS cliente_nome
FROM vw_frota_telemetria v
LEFT JOIN LATERAL (
    SELECT ct.numero_contrato, ct.codigo_cliente, ct.data_hora_inicio, ct.data_hora_termino
    FROM contratos ct
    WHERE ct.codigo_veiculo = v.codigo_veiculo
      AND ct.codigo_status = '1'
    ORDER BY ct.data_hora_inicio DESC NULLS LAST
    LIMIT 1
) c ON true
LEFT JOIN clientes cli ON cli.codigo_cliente = c.codigo_cliente
WHERE upper(v.placa) = upper(%(placa)s)
LIMIT 1;
