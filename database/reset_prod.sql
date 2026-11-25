-- Script para ZERAR os dados de demonstracao antes de usar na mercearia real.
-- ATENCAO: Apaga todos os pedidos, entregas, pagamentos, carrinhos, produtos e usuarios de teste!

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE entrega;
TRUNCATE TABLE pagamento;
TRUNCATE TABLE item_pedido;
TRUNCATE TABLE pedido;
TRUNCATE TABLE item_carrinho;
TRUNCATE TABLE carrinho;
TRUNCATE TABLE produto;
TRUNCATE TABLE entregador;
TRUNCATE TABLE caixa_dono;
TRUNCATE TABLE cliente;
TRUNCATE TABLE usuario;

SET FOREIGN_KEY_CHECKS = 1;

-- Depois de rodar este script, rode `node src/db/setup.js --prod`
-- ou cadastre a conta real de administrador diretamente no banco.
