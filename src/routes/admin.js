const express = require('express');
const bcrypt = require('bcryptjs');
const { getPool } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireRole('CaixaDono'));

// Resumo do painel ADM (ADM - Painel | RF4, RF5)
router.get('/resumo', async (req, res) => {
  const { periodo } = req.query; // 'hoje' | 'semana' | 'mes' | 'todos'
  const pool = getPool();

  let filtroData = '';
  if (periodo === 'hoje') {
    filtroData = 'AND DATE(p.data_pedido) = CURDATE()';
  } else if (periodo === 'semana') {
    filtroData = 'AND p.data_pedido >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
  } else if (periodo === 'mes') {
    filtroData = 'AND p.data_pedido >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
  }

  try {
    const [[totais]] = await pool.query(
      `SELECT
         COUNT(CASE WHEN p.status != 'Cancelado' THEN 1 END) AS total_pedidos,
         COUNT(CASE WHEN e.status_entrega = 'Concluido' OR p.status = 'Concluido' THEN 1 END) AS entregas,
         COALESCE(SUM(CASE WHEN p.status != 'Cancelado' THEN p.valor_total ELSE 0 END), 0) AS receita_total
       FROM pedido p
       LEFT JOIN entrega e ON e.id_pedido = p.id_pedido
       WHERE 1=1 ${filtroData}`
    );

    const [porMetodo] = await pool.query(
      `SELECT pg.metodo_pagamento, COALESCE(SUM(p.valor_total), 0) AS total
       FROM pedido p
       JOIN pagamento pg ON pg.id_pedido = p.id_pedido
       WHERE p.status != 'Cancelado' ${filtroData}
       GROUP BY pg.metodo_pagamento`
    );

    const [pendentes] = await pool.query(
      `SELECT p.id_pedido, u.nome AS cliente_nome, p.endereco_entrega, p.valor_total, p.status
       FROM pedido p
       JOIN cliente c ON c.id_cliente = p.id_cliente
       JOIN usuario u ON u.id_usuario = c.id_cliente
       WHERE p.status IN ('Pendente', 'Confirmado', 'Em rota')
       ORDER BY p.id_pedido DESC
       LIMIT 6`
    );

    const [ultimasEntregas] = await pool.query(
      `SELECT p.id_pedido, u.nome AS cliente_nome, p.endereco_entrega, p.valor_total
       FROM pedido p
       JOIN cliente c ON c.id_cliente = p.id_cliente
       JOIN usuario u ON u.id_usuario = c.id_cliente
       WHERE p.status = 'Concluido'
       ORDER BY p.id_pedido DESC
       LIMIT 5`
    );

    const receitaPorMetodo = { Dinheiro: 0, Cartao: 0, Pix: 0, 'A Prazo': 0 };
    for (const row of porMetodo) {
      receitaPorMetodo[row.metodo_pagamento] = Number(row.total);
    }

    return res.json({
      entregas: Number(totais.entregas || 0),
      total_pedidos: Number(totais.total_pedidos || 0),
      receita_total: Number(totais.receita_total || 0),
      receita_por_metodo: receitaPorMetodo,
      pendentes,
      ultimas_entregas: ultimasEntregas,
    });
  } catch (err) {
    console.error('Erro no resumo ADM:', err);
    return res.status(500).json({ error: 'Erro ao carregar painel.' });
  }
});

// Listar todos os pedidos (ADM - Pedidos | RF4, RF5)
router.get('/pedidos', async (req, res) => {
  const { status, busca } = req.query;
  const pool = getPool();

  try {
    const where = [];
    const params = [];
    if (status && status !== 'TODOS') {
      where.push('p.status = ?');
      params.push(status);
    }
    if (busca) {
      where.push('(u.nome LIKE ? OR p.endereco_entrega LIKE ? OR CAST(p.id_pedido AS CHAR) = ?)');
      const term = `%${String(busca).trim()}%`;
      params.push(term, term, String(busca).trim());
    }

    const [rows] = await pool.query(
      `SELECT p.id_pedido, p.data_pedido, p.valor_total, p.tipo_recebimento, p.endereco_entrega, p.status,
              u.nome AS cliente_nome, c.telefone AS cliente_telefone,
              pg.metodo_pagamento, pg.status_pagamento,
              e.id_entrega, e.id_entregador, e.status_entrega,
              ue.nome AS entregador_nome
       FROM pedido p
       JOIN cliente c ON c.id_cliente = p.id_cliente
       JOIN usuario u ON u.id_usuario = c.id_cliente
       LEFT JOIN pagamento pg ON pg.id_pedido = p.id_pedido
       LEFT JOIN entrega e ON e.id_pedido = p.id_pedido
       LEFT JOIN usuario ue ON ue.id_usuario = e.id_entregador
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY p.id_pedido DESC`,
      params
    );
    return res.json({ pedidos: rows });
  } catch (err) {
    console.error('Erro ao listar pedidos ADM:', err);
    return res.status(500).json({ error: 'Erro ao carregar pedidos.' });
  }
});

// Detalhe do pedido (ADM - Pedido 1)
router.get('/pedidos/:id', async (req, res) => {
  const pool = getPool();
  try {
    const [rows] = await pool.query(
      `SELECT p.*, u.nome AS cliente_nome, u.email AS cliente_email, c.telefone AS cliente_telefone,
              pg.metodo_pagamento, pg.status_pagamento, pg.troco_para,
              e.id_entrega, e.id_entregador, e.status_entrega, ue.nome AS entregador_nome
       FROM pedido p
       JOIN cliente c ON c.id_cliente = p.id_cliente
       JOIN usuario u ON u.id_usuario = c.id_cliente
       LEFT JOIN pagamento pg ON pg.id_pedido = p.id_pedido
       LEFT JOIN entrega e ON e.id_pedido = p.id_pedido
       LEFT JOIN usuario ue ON ue.id_usuario = e.id_entregador
       WHERE p.id_pedido = ?`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }
    const [itens] = await pool.query(
      `SELECT ip.*, pr.nome, pr.imagem_url
       FROM item_pedido ip
       JOIN produto pr ON pr.id_produto = ip.id_produto
       WHERE ip.id_pedido = ?`,
      [req.params.id]
    );
    return res.json({ pedido: { ...rows[0], itens } });
  } catch (err) {
    console.error('Erro no detalhe do pedido:', err);
    return res.status(500).json({ error: 'Erro ao carregar detalhes do pedido.' });
  }
});

// Atualizar status do pedido / pagamento / entregador (RF4)
router.put('/pedidos/:id', async (req, res) => {
  const { status, status_pagamento, id_entregador } = req.body || {};
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    const [existing] = await conn.query('SELECT id_pedido, status FROM pedido WHERE id_pedido = ? FOR UPDATE', [
      req.params.id,
    ]);
    if (existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }
    const prevStatus = existing[0].status;

    if (status) {
      if (status === 'Cancelado' && prevStatus !== 'Cancelado') {
        const [itens] = await conn.query('SELECT id_produto, quantidade FROM item_pedido WHERE id_pedido = ?', [
          req.params.id,
        ]);
        for (const it of itens) {
          await conn.query('UPDATE produto SET estoque = estoque + ? WHERE id_produto = ?', [
            it.quantidade,
            it.id_produto,
          ]);
        }
      }
      await conn.query('UPDATE pedido SET status = ? WHERE id_pedido = ?', [status, req.params.id]);

      if (status === 'Concluido') {
        await conn.query(
          "UPDATE entrega SET status_entrega = 'Concluido', data_entrega = COALESCE(data_entrega, NOW()) WHERE id_pedido = ?",
          [req.params.id]
        );
        await conn.query(
          "UPDATE pagamento SET status_pagamento = 'Aprovado', data_pagamento = COALESCE(data_pagamento, NOW()) WHERE id_pedido = ?",
          [req.params.id]
        );
      } else if (status === 'Em rota') {
        await conn.query("UPDATE entrega SET status_entrega = 'Em rota de entrega' WHERE id_pedido = ?", [
          req.params.id,
        ]);
      }
    }

    if (status_pagamento) {
      await conn.query(
        'UPDATE pagamento SET status_pagamento = ?, data_pagamento = CASE WHEN ? = "Aprovado" THEN NOW() ELSE data_pagamento END WHERE id_pedido = ?',
        [status_pagamento, status_pagamento, req.params.id]
      );
    }

    if (id_entregador !== undefined) {
      await conn.query('UPDATE entrega SET id_entregador = ? WHERE id_pedido = ?', [
        id_entregador ? Number(id_entregador) : null,
        req.params.id,
      ]);
    }

    await conn.commit();
    return res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    console.error('Erro ao atualizar pedido ADM:', err);
    return res.status(500).json({ error: 'Erro ao atualizar pedido.' });
  } finally {
    conn.release();
  }
});

// Listar clientes (ADM - Clientes | RF6)
router.get('/clientes', async (req, res) => {
  const { busca } = req.query;
  const pool = getPool();
  try {
    const where = [];
    const params = [];
    if (busca) {
      where.push('(u.nome LIKE ? OR c.telefone LIKE ? OR c.endereco LIKE ?)');
      const t = `%${String(busca).trim()}%`;
      params.push(t, t, t);
    }
    const [rows] = await pool.query(
      `SELECT c.id_cliente, u.nome, u.email, u.data_cadastro, c.telefone, c.endereco, c.cep,
              COUNT(p.id_pedido) AS total_pedidos,
              COALESCE(SUM(CASE WHEN p.status != 'Cancelado' THEN p.valor_total ELSE 0 END), 0) AS total_gasto
       FROM cliente c
       JOIN usuario u ON u.id_usuario = c.id_cliente
       LEFT JOIN pedido p ON p.id_cliente = c.id_cliente
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       GROUP BY c.id_cliente, u.nome, u.email, u.data_cadastro, c.telefone, c.endereco, c.cep
       ORDER BY c.id_cliente DESC`,
      params
    );
    return res.json({ clientes: rows });
  } catch (err) {
    console.error('Erro ao listar clientes:', err);
    return res.status(500).json({ error: 'Erro ao carregar clientes.' });
  }
});

// Cadastrar novo cliente pelo ADM (ADM - Novo Cliente)
router.post('/clientes', async (req, res) => {
  const { nome, email, telefone, endereco, cep, senha } = req.body || {};
  if (!nome || !email || !endereco) {
    return res.status(400).json({ error: 'Informe nome, email e endereço.' });
  }

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const emailNorm = String(email).trim().toLowerCase();
    const [exists] = await conn.query('SELECT id_usuario FROM usuario WHERE email = ?', [emailNorm]);
    if (exists.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'Email já cadastrado.' });
    }
    const senhaHash = await bcrypt.hash(String(senha || 'Cliente@2026'), 10);
    const [uRes] = await conn.query(
      'INSERT INTO usuario (nome, email, senha_hash, tipo_usuario, data_cadastro) VALUES (?, ?, ?, ?, CURDATE())',
      [String(nome).trim(), emailNorm, senhaHash, 'Cliente']
    );
    await conn.query(
      'INSERT INTO cliente (id_cliente, telefone, endereco, cep) VALUES (?, ?, ?, ?)',
      [uRes.insertId, telefone ? String(telefone).trim() : null, String(endereco).trim(), cep ? String(cep).trim() : null]
    );
    await conn.commit();
    return res.status(201).json({ id_cliente: uRes.insertId });
  } catch (err) {
    await conn.rollback();
    console.error('Erro ao criar cliente ADM:', err);
    return res.status(500).json({ error: 'Erro ao cadastrar cliente.' });
  } finally {
    conn.release();
  }
});

router.get('/entregadores', async (_req, res) => {
  const pool = getPool();
  try {
    const [rows] = await pool.query(
      `SELECT e.id_entregador, u.nome, u.email, e.telefone
       FROM entregador e
       JOIN usuario u ON u.id_usuario = e.id_entregador
       ORDER BY u.nome ASC`
    );
    return res.json({ entregadores: rows });
  } catch (err) {
    console.error('Erro ao listar entregadores:', err);
    return res.status(500).json({ error: 'Erro ao carregar entregadores.' });
  }
});

module.exports = router;
