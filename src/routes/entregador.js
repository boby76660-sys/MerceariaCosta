const express = require('express');
const { getPool } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireRole('Entregador', 'CaixaDono'));

const STATUS_VALIDOS = new Set(['Pendente', 'Em rota de entrega', 'Concluido']);

// Listar entregas para o painel do entregador (RF13)
router.get('/entregas', async (req, res) => {
  const pool = getPool();
  try {
    const [rows] = await pool.query(
      `SELECT e.id_entrega, e.id_pedido, e.id_entregador, e.endereco_entrega, e.status_entrega, e.data_entrega,
              p.data_pedido, p.valor_total, p.status AS pedido_status, p.cep_entrega,
              u.nome AS cliente_nome, c.telefone AS cliente_telefone,
              pg.metodo_pagamento, pg.status_pagamento, pg.troco_para,
              ue.nome AS entregador_nome
       FROM entrega e
       JOIN pedido p ON p.id_pedido = e.id_pedido
       JOIN cliente c ON c.id_cliente = p.id_cliente
       JOIN usuario u ON u.id_usuario = c.id_cliente
       LEFT JOIN pagamento pg ON pg.id_pedido = p.id_pedido
       LEFT JOIN usuario ue ON ue.id_usuario = e.id_entregador
       WHERE p.status != 'Cancelado'
         ${req.user.tipo_usuario === 'Entregador' ? 'AND (e.id_entregador IS NULL OR e.id_entregador = ?)' : ''}
       ORDER BY FIELD(e.status_entrega, 'Em rota de entrega', 'Pendente', 'Concluido'), e.id_entrega DESC`,
      req.user.tipo_usuario === 'Entregador' ? [req.user.id_usuario] : []
    );
    return res.json({ entregas: rows });
  } catch (err) {
    console.error('Erro ao listar entregas:', err);
    return res.status(500).json({ error: 'Erro ao carregar entregas.' });
  }
});

// Atualizar status da entrega (RF14)
router.put('/entregas/:id', async (req, res) => {
  const { status_entrega } = req.body || {};
  if (!STATUS_VALIDOS.has(status_entrega)) {
    return res.status(400).json({ error: 'Status de entrega inválido.' });
  }

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT id_entrega, id_pedido FROM entrega WHERE id_entrega = ? FOR UPDATE', [
      req.params.id,
    ]);
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Entrega não encontrada.' });
    }

    const idPedido = rows[0].id_pedido;
    await conn.query(
      `UPDATE entrega
       SET status_entrega = ?,
           id_entregador = COALESCE(id_entregador, ?),
           data_entrega = CASE WHEN ? = 'Concluido' THEN NOW() ELSE data_entrega END
       WHERE id_entrega = ?`,
      [
        status_entrega,
        req.user.tipo_usuario === 'Entregador' ? req.user.id_usuario : null,
        status_entrega,
        req.params.id,
      ]
    );

    if (status_entrega === 'Em rota de entrega') {
      await conn.query("UPDATE pedido SET status = 'Em rota' WHERE id_pedido = ?", [idPedido]);
    } else if (status_entrega === 'Concluido') {
      await conn.query("UPDATE pedido SET status = 'Concluido' WHERE id_pedido = ?", [idPedido]);
      await conn.query(
        "UPDATE pagamento SET status_pagamento = 'Aprovado', data_pagamento = COALESCE(data_pagamento, NOW()) WHERE id_pedido = ?",
        [idPedido]
      );
    } else {
      await conn.query("UPDATE pedido SET status = 'Confirmado' WHERE id_pedido = ?", [idPedido]);
    }

    await conn.commit();
    return res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    console.error('Erro ao atualizar entrega:', err);
    return res.status(500).json({ error: 'Erro ao atualizar status da entrega.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
