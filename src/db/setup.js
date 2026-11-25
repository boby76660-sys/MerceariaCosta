require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const DEMO_PRODUCTS = [
  {
    nome: 'Nutella 350g',
    descricao: 'Creme de avelã com cacau Ferrero Nutella pote 350g.',
    preco: 26.90,
    preco_original: 29.90,
    estoque: 25,
    categoria: 'Doces',
    medida: 'UNIDADE',
    desconto: 10.00,
    imagem_url: '/assets/prod-nutella-350g.png',
    oferta: 1,
    mais_vendido: 1,
  },
  {
    nome: 'Ervilha em Conserva Quero 3,100g',
    descricao: 'Ervilha em conserva Quero lata grande 3,100g.',
    preco: 18.38,
    preco_original: 19.98,
    estoque: 38,
    categoria: 'Alimentos',
    medida: 'UNIDADE',
    desconto: 8.00,
    imagem_url: '/assets/prod-ervilha-quero.png',
    oferta: 1,
    mais_vendido: 0,
  },
  {
    nome: 'Macarrão Instantâneo Nissin 80g - Tomate',
    descricao: 'Macarrão instantâneo Nissin Miojo sabor Tomate 80g.',
    preco: 3.22,
    preco_original: 3.39,
    estoque: 26,
    categoria: 'Alimentos',
    medida: 'UNIDADE',
    desconto: 5.00,
    imagem_url: '/assets/prod-nissin-tomate.png',
    oferta: 1,
    mais_vendido: 0,
  },
  {
    nome: 'Leite Integral Piracanjuba 1L',
    descricao: 'Leite UHT Integral Piracanjuba caixa 1 litro.',
    preco: 4.72,
    preco_original: 5.30,
    estoque: 120,
    categoria: 'Bebidas',
    medida: 'UNIDADE',
    desconto: 9.00,
    imagem_url: '/assets/prod-leite-piracanjuba.png',
    oferta: 1,
    mais_vendido: 0,
  },
  {
    nome: 'Café Caratinga Extra Forte 500g',
    descricao: 'Café torrado e moído Caratinga Extra Forte pacote 500g.',
    preco: 18.38,
    preco_original: 19.98,
    estoque: 15,
    categoria: 'Alimentos',
    medida: 'UNIDADE',
    desconto: 8.00,
    imagem_url: '/assets/prod-cafe-caratinga.png',
    oferta: 1,
    mais_vendido: 0,
  },
  {
    nome: 'Salgadinho Gulão - Queijo Suíço 120g',
    descricao: 'Salgadinho de milho assado Gulão sabor Queijo Suíço 120g.',
    preco: 4.99,
    preco_original: null,
    estoque: 45,
    categoria: 'Alimentos',
    medida: 'UNIDADE',
    desconto: 0.00,
    imagem_url: '/assets/prod-salgadinho-gulao.png',
    oferta: 0,
    mais_vendido: 1,
  },
  {
    nome: 'Margarina Doriana Sem Sal 500 G',
    descricao: 'Margarina cremosa Doriana sem sal pote 500g.',
    preco: 8.19,
    preco_original: null,
    estoque: 30,
    categoria: 'Alimentos',
    medida: 'UNIDADE',
    desconto: 0.00,
    imagem_url: '/assets/prod-margarina-doriana.png',
    oferta: 0,
    mais_vendido: 1,
  },
  {
    nome: 'Milho De Pipoca Tradicional Pachá 500g',
    descricao: 'Milho para pipoca tradicional selecionado Pachá 500g.',
    preco: 3.99,
    preco_original: null,
    estoque: 50,
    categoria: 'Alimentos',
    medida: 'UNIDADE',
    desconto: 0.00,
    imagem_url: '/assets/prod-pipoca-pacha.png',
    oferta: 0,
    mais_vendido: 1,
  },
  {
    nome: 'Banana Prata',
    descricao: 'Banana prata fresca selecionada (preço por 100g / kg).',
    preco: 2.99,
    preco_original: null,
    estoque: 40,
    categoria: 'Frutas e Legumes',
    medida: 'KG',
    desconto: 0.00,
    imagem_url: '/assets/prod-banana-prata.png',
    oferta: 0,
    mais_vendido: 1,
  },
  {
    nome: 'Maçã Nacional Fuji',
    descricao: 'Maçã nacional Fuji crocante e adocicada (preço por kg).',
    preco: 18.99,
    preco_original: null,
    estoque: 32,
    categoria: 'Frutas e Legumes',
    medida: 'KG',
    desconto: 0.00,
    imagem_url: '/assets/prod-maca-fuji.png',
    oferta: 0,
    mais_vendido: 0,
  },
  {
    nome: 'Batata Inglesa',
    descricao: 'Batata inglesa lavada selecionada (preço por kg).',
    preco: 8.98,
    preco_original: null,
    estoque: 48,
    categoria: 'Frutas e Legumes',
    medida: 'KG',
    desconto: 0.00,
    imagem_url: '/assets/prod-batata-inglesa.png',
    oferta: 0,
    mais_vendido: 0,
  },
  {
    nome: 'Coca Cola 2L',
    descricao: 'Refrigerante Coca-Cola original garrafa PET 2 litros.',
    preco: 11.99,
    preco_original: null,
    estoque: 60,
    categoria: 'Bebidas',
    medida: 'UNIDADE',
    desconto: 0.00,
    imagem_url: '/assets/prod-coca-cola-2l.png',
    oferta: 0,
    mais_vendido: 0,
  },
  {
    nome: 'Água Mineral Gravatal 510 ml',
    descricao: 'Água mineral natural sem gás Gravatal 510ml.',
    preco: 1.45,
    preco_original: null,
    estoque: 140,
    categoria: 'Bebidas',
    medida: 'UNIDADE',
    desconto: 0.00,
    imagem_url: '/assets/prod-agua-gravatal.png',
    oferta: 0,
    mais_vendido: 0,
  },
  {
    nome: 'Desengordurante Spray Azulim 500ml',
    descricao: 'Limpador desengordurante multiuso spray Azulim 500ml.',
    preco: 12.56,
    preco_original: 13.81,
    estoque: 22,
    categoria: 'Produtos de Limpeza',
    medida: 'UNIDADE',
    desconto: 10.00,
    imagem_url: '/assets/prod-desengordurante-azulim.png',
    oferta: 1,
    mais_vendido: 0,
  },
  {
    nome: 'Desinfetante Facilita Lavanda 500ml',
    descricao: 'Desinfetante perfumado Facilita aroma Lavanda 500ml.',
    preco: 7.29,
    preco_original: 7.94,
    estoque: 35,
    categoria: 'Produtos de Limpeza',
    medida: 'UNIDADE',
    desconto: 9.00,
    imagem_url: '/assets/prod-desinfetante-facilita.png',
    oferta: 1,
    mais_vendido: 0,
  },
  {
    nome: 'Detergente Neutro Ypê 500ml',
    descricao: 'Detergente líquido neutro Ypê 500ml.',
    preco: 3.15,
    preco_original: 3.43,
    estoque: 70,
    categoria: 'Produtos de Limpeza',
    medida: 'UNIDADE',
    desconto: 9.00,
    imagem_url: '/assets/prod-detergente-ype.png',
    oferta: 1,
    mais_vendido: 0,
  },
  {
    nome: 'Pacote de Casadinho',
    descricao: 'Biscoito casadinho artesanal recheado com goiabada.',
    preco: 24.65,
    preco_original: null,
    estoque: 18,
    categoria: 'Padaria',
    medida: 'UNIDADE',
    desconto: 0.00,
    imagem_url: '/assets/prod-casadinho.png',
    oferta: 0,
    mais_vendido: 0,
  },
  {
    nome: 'Bolo de Laranja 400g',
    descricao: 'Bolo caseiro fofinho sabor laranja 400g.',
    preco: 17.90,
    preco_original: 19.90,
    estoque: 12,
    categoria: 'Padaria',
    medida: 'UNIDADE',
    desconto: 10.00,
    imagem_url: '/assets/prod-bolo-laranja.png',
    oferta: 1,
    mais_vendido: 0,
  },
  {
    nome: 'Picanha Friboi',
    descricao: 'Picanha bovina resfriada a vácuo Friboi (preço por kg).',
    preco: 69.90,
    preco_original: null,
    estoque: 20,
    categoria: 'Carnes',
    medida: 'KG',
    desconto: 0.00,
    imagem_url: '/assets/prod-picanha-friboi.png',
    oferta: 0,
    mais_vendido: 0,
  },
  {
    nome: 'Coxão Duro',
    descricao: 'Carne bovina Coxão Duro selecionada (preço por kg).',
    preco: 39.99,
    preco_original: null,
    estoque: 23,
    categoria: 'Carnes',
    medida: 'KG',
    desconto: 0.00,
    imagem_url: '/assets/prod-coxao-duro.png',
    oferta: 0,
    mais_vendido: 0,
  },
  {
    nome: 'Doce de Leite Tradicional Itambé 395g',
    descricao: 'Doce de leite pastoso tradicional Itambé lata 395g.',
    preco: 13.49,
    preco_original: 14.70,
    estoque: 17,
    categoria: 'Doces',
    medida: 'UNIDADE',
    desconto: 9.00,
    imagem_url: '/assets/prod-doce-leite-itambe.png',
    oferta: 1,
    mais_vendido: 0,
  },
  {
    nome: 'Goiabada Predilecta 300g',
    descricao: 'Goiabada cremosa/corte Predilecta embalagem 300g.',
    preco: 5.99,
    preco_original: 6.53,
    estoque: 28,
    categoria: 'Doces',
    medida: 'UNIDADE',
    desconto: 9.00,
    imagem_url: '/assets/prod-goiabada-predilecta.png',
    oferta: 1,
    mais_vendido: 0,
  },
  {
    nome: 'Mel Silvestre Florada Laranjeira 1,3kg',
    descricao: 'Mel puro silvestre florada de laranjeira garrafa 1,3kg.',
    preco: 36.29,
    preco_original: 39.90,
    estoque: 14,
    categoria: 'Alimentos',
    medida: 'UNIDADE',
    desconto: 9.00,
    imagem_url: '/assets/prod-mel-silvestre.png',
    oferta: 1,
    mais_vendido: 0,
  },
];

async function createConnectionForSetup() {
  const useSsl = process.env.DB_SSL === 'true' || process.env.DB_SSL === '1';
  const ssl = useSsl ? { rejectUnauthorized: false } : undefined;

  if (process.env.DATABASE_URL) {
    return mysql.createConnection({
      uri: process.env.DATABASE_URL,
      multipleStatements: true,
      ssl,
    });
  }

  const dbName = process.env.DB_NAME || process.env.DB_DATABASE || 'mercearia_costa';
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
    ssl,
  });
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
  );
  await conn.changeUser({ database: dbName });
  return conn;
}

async function runSetup() {
  const isProdOnly = process.argv.includes('--prod');
  const conn = await createConnectionForSetup();

  try {
    const schemaSql = fs.readFileSync(
      path.join(__dirname, '..', '..', 'database', 'schema.sql'),
      'utf8'
    );
    await conn.query(schemaSql);
    console.log('Tabelas criadas/verificadas com sucesso.');

    const [[{ totalUsers }]] = await conn.query('SELECT COUNT(*) AS totalUsers FROM usuario');
    if (totalUsers === 0) {
      const adminHash = await bcrypt.hash(process.env.ADMIN_INIT_PASSWORD || 'Mercearia@2026', 10);
      const [resAdmin] = await conn.query(
        'INSERT INTO usuario (nome, email, senha_hash, tipo_usuario, data_cadastro) VALUES (?, ?, ?, ?, CURDATE())',
        ['Administrador Mercearia Costa', 'admin@merceariacosta.com.br', adminHash, 'CaixaDono']
      );
      await conn.query(
        'INSERT INTO caixa_dono (id_caixa_dono, cpf, login_admin) VALUES (?, ?, ?)',
        [resAdmin.insertId, '000.000.000-00', 'admin']
      );

      if (!isProdOnly) {
        const clienteHash = await bcrypt.hash('Cliente@2026', 10);
        const entregadorHash = await bcrypt.hash('Entregador@2026', 10);

        const clientesDemo = [
          ['Sebastião Ferreira', 'sebastiao@exemplo.com', '(33) 99798-1659', 'Cônego Ricardo, Antônio Joaquim, 155 - Pocrane', '36960-000'],
          ['Rosa Martins', 'rosa@exemplo.com', '(33) 99636-4643', 'Centro, Rua São Vicente, 42 - Pocrane', '36960-000'],
          ['Joana Soares', 'joana@exemplo.com', '(33) 99629-8300', 'Centro, Rua Aimorés, 102 - Pocrane', '36960-000'],
          ['Iago Miranda', 'iago@exemplo.com', '(33) 98822-9312', 'Centro, Rua 2, 6 - Pocrane', '36960-000'],
          ['Maria José', 'maria@exemplo.com', '(33) 99241-8728', 'São Mateus, Rua Principal, 32 - Pocrane', '36960-000'],
        ];

        const clienteIds = [];
        for (const [nome, email, tel, end, cep] of clientesDemo) {
          const [uRes] = await conn.query(
            'INSERT INTO usuario (nome, email, senha_hash, tipo_usuario, data_cadastro) VALUES (?, ?, ?, ?, CURDATE())',
            [nome, email, clienteHash, 'Cliente']
          );
          await conn.query(
            'INSERT INTO cliente (id_cliente, telefone, endereco, cep) VALUES (?, ?, ?, ?)',
            [uRes.insertId, tel, end, cep]
          );
          clienteIds.push({ id: uRes.insertId, end, cep });
        }

        const [entRes] = await conn.query(
          'INSERT INTO usuario (nome, email, senha_hash, tipo_usuario, data_cadastro) VALUES (?, ?, ?, ?, CURDATE())',
          ['Carlos Entregador', 'entregador@merceariacosta.com.br', entregadorHash, 'Entregador']
        );
        await conn.query('INSERT INTO entregador (id_entregador, telefone) VALUES (?, ?)', [
          entRes.insertId,
          '(33) 99100-2000',
        ]);

        const [[{ totalProds }]] = await conn.query('SELECT COUNT(*) AS totalProds FROM produto');
        if (totalProds === 0) {
          for (const p of DEMO_PRODUCTS) {
            await conn.query(
              `INSERT INTO produto (nome, descricao, preco, preco_original, estoque, categoria, medida, desconto, imagem_url, oferta, mais_vendido, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Ativo')`,
              [
                p.nome,
                p.descricao,
                p.preco,
                p.preco_original,
                p.estoque,
                p.categoria,
                p.medida,
                p.desconto,
                p.imagem_url,
                p.oferta,
                p.mais_vendido,
              ]
            );
          }
        }

        // Pedidos de demonstracao para popular Painel ADM e Entregador
        const pedidosDemo = [
          { cli: clienteIds[0], total: 153.90, metodo: 'Cartao', status: 'Pendente', statusEnt: 'Pendente', atribuido: null },
          { cli: clienteIds[1], total: 69.20, metodo: 'Dinheiro', status: 'Pendente', statusEnt: 'Pendente', atribuido: entRes.insertId },
          { cli: clienteIds[2], total: 256.53, metodo: 'Pix', status: 'Confirmado', statusEnt: 'Em rota de entrega', atribuido: entRes.insertId },
          { cli: clienteIds[3], total: 93.70, metodo: 'Cartao', status: 'Concluido', statusEnt: 'Concluido', atribuido: entRes.insertId },
          { cli: clienteIds[4], total: 493.00, metodo: 'A Prazo', status: 'Concluido', statusEnt: 'Concluido', atribuido: entRes.insertId },
        ];

        const [prods] = await conn.query('SELECT id_produto, preco FROM produto LIMIT 3');
        for (const pd of pedidosDemo) {
          const [pedRes] = await conn.query(
            `INSERT INTO pedido (id_cliente, data_pedido, valor_total, tipo_recebimento, endereco_entrega, cep_entrega, status)
             VALUES (?, NOW(), ?, 'Entrega', ?, ?, ?)`,
            [pd.cli.id, pd.total, pd.cli.end, pd.cli.cep, pd.status]
          );
          if (prods[0]) {
            await conn.query(
              'INSERT INTO item_pedido (id_pedido, id_produto, quantidade, preco_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
              [pedRes.insertId, prods[0].id_produto, 1, prods[0].preco, prods[0].preco]
            );
          }
          await conn.query(
            'INSERT INTO pagamento (id_pedido, metodo_pagamento, status_pagamento, data_pagamento) VALUES (?, ?, ?, ?)',
            [
              pedRes.insertId,
              pd.metodo,
              pd.status === 'Concluido' ? 'Aprovado' : 'Pendente',
              pd.status === 'Concluido' ? new Date() : null,
            ]
          );
          await conn.query(
            'INSERT INTO entrega (id_pedido, id_entregador, endereco_entrega, status_entrega, data_entrega) VALUES (?, ?, ?, ?, ?)',
            [
              pedRes.insertId,
              pd.atribuido,
              pd.cli.end,
              pd.statusEnt,
              pd.statusEnt === 'Concluido' ? new Date() : null,
            ]
          );
        }
      }
      console.log(isProdOnly ? 'Banco inicializado em modo producao.' : 'Dados de demonstracao inseridos com sucesso.');
    } else {
      console.log('Banco ja possui usuarios; seed ignorado.');
    }
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  runSetup()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Erro ao configurar banco:', err.message);
      process.exit(1);
    });
}

module.exports = { runSetup };
