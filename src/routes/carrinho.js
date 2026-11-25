const express = require('express');
const { getPool } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Busca carrinho persistido no banco para o cliente logado (RF9.2)
router.get('/', requireAuth, requireRole('Cliente'), async (req, res) => {
  const pool = getPool();
  try {
    const [carrinhos] = await pool.query(
      'SELECT id_carrinho FROM carrinho WHERE id_cliente = ? ORDER BY id_carrinho DESC LIMIT 1',
      [req.user.id_usuario]
    );
    if (carrinhos.length === 0) {
      return res.json({ itens: [] });
    }
    const [itens] = await pool.query(
      `SELECT ic.id_produto, ic.quantidade, p.nome, p.preco, p.preco_original, p.desconto, p.imagem_url, p.estoque, p.medida
       FROM item_carrinho ic
       JOIN produto p ON p.id_produto = ic.id_produto
       WHERE ic.id_carrinho = ?`,
      [carrinhos[0].id_carrinho]
    );
    return res.json({ itens });
  } catch (err) {
    console.error('Erro ao carregar carrinho:', err);
    return res.status(500).json({ error: 'Erro ao carregar carrinho.' });
  }
});

// Sincroniza itens do carrinho no banco
router.put('/', requireAuth, requireRole('Cliente'), async (req, res) => {
  const { itens } = req.body || {};
  if (!Array.isArray(itens)) {
    return res.status(400).json({ error: 'Formato de carrinho inválido.' });
  }

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let [carrinhos] = await conn.query(
      'SELECT id_carrinho FROM carrinho WHERE id_cliente = ? ORDER BY id_carrinho DESC LIMIT 1',
      [req.user.id_usuario]
    );
    let idCarrinho;
    if (carrinhos.length === 0) {
      const [ins] = await conn.query(
        'INSERT INTO carrinho (id_cliente, data_criacao) VALUES (?, NOW())',
        [req.user.id_usuario]
      );
      idCarrinho = ins.insertId;
    } else {
      idCarrinho = carrinhos[0].id_carrinho;
      await conn.query('DELETE FROM item_carrinho WHERE id_carrinho = ?', [idCarrinho]);
    }

    for (const item of itens) {
      const idProd = Number(item.id_produto);
      const qtd = Number(item.quantidade);
      if (idProd > 0 && qtd > 0) {
        await conn.query(
          'INSERT INTO item_carrinho (id_carrinho, id_produto, quantidade) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantidade = VALUES(quantidade)',
          [idCarrinho, idProd, qtd]
        );
      }
    }
    await conn.commit();
    return res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    console.error('Erro ao salvar carrinho:', err);
    return res.status(500).json({ error: 'Erro ao salvar carrinho.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
