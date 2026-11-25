const express = require('express');
const { getPool } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const METODOS_VALIDOS = new Set(['Dinheiro', 'Cartao', 'Pix', 'A Prazo']);

function buildWhatsappUrl(pedidoInfo, itens) {
  const lojaPhone = (process.env.WHATSAPP_LOJA || '553333161580').replace(/\D/g, '');
  const linhas = [
    `*Pedido #${pedidoInfo.id_pedido} - Mercearia Costa*`,
    `Cliente: ${pedidoInfo.nome}`,
    `Recebimento: ${pedidoInfo.tipo_recebimento}`,
  ];
  if (pedidoInfo.tipo_recebimento === 'Entrega') {
    linhas.push(`Endereço: ${pedidoInfo.endereco_entrega}${pedidoInfo.cep_entrega ? ` (CEP: ${pedidoInfo.cep_entrega})` : ''}`);
  }
  linhas.push(`Pagamento: ${pedidoInfo.metodo_pagamento}`);
  if (pedidoInfo.metodo_pagamento === 'Dinheiro' && pedidoInfo.troco_para) {
    linhas.push(`Troco para: R$ ${Number(pedidoInfo.troco_para).toFixed(2).replace('.', ',')}`);
  }
  linhas.push('', '*Itens:*');
  for (const it of itens) {
    linhas.push(`- ${it.quantidade}x ${it.nome} = R$ ${Number(it.subtotal).toFixed(2).replace('.', ',')}`);
  }
  linhas.push('', `*Total: R$ ${Number(pedidoInfo.valor_total).toFixed(2).replace('.', ',')}*`);
  return `https://wa.me/${lojaPhone}?text=${encodeURIComponent(linhas.join('\n'))}`;
}

// Finalizar pedido (Cliente - RF12, RNF1, RNF6)
router.post('/', requireAuth, requireRole('Cliente'), async (req, res) => {
  const {
    itens,
    tipo_recebimento,
    endereco_entrega,
    cep_entrega,
    metodo_pagamento,
    troco_para,
    cupom,
    observacoes,
  } = req.body || {};

  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ error: 'Seu carrinho está vazio.' });
  }
  const recebimento = tipo_recebimento === 'Retirada' ? 'Retirada' : 'Entrega';
  if (recebimento === 'Entrega' && !String(endereco_entrega || '').trim()) {
    return res.status(400).json({ error: 'Informe o endereço de entrega.' });
  }
  if (!METODOS_VALIDOS.has(metodo_pagamento)) {
    return res.status(400).json({ error: 'Selecione uma forma de pagamento válida.' });
  }

  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const itensValidados = [];
    let subtotalGeral = 0;

    for (const raw of itens) {
      const idProd = Number(raw.id_produto);
      const qtd = Number(raw.quantidade);
      if (!(idProd > 0) || !(qtd > 0)) {
        await conn.rollback();
        return res.status(400).json({ error: 'Item ou quantidade inválida no carrinho.' });
      }

      const [prodRows] = await conn.query(
        "SELECT id_produto, nome, preco, estoque, status FROM produto WHERE id_produto = ? FOR UPDATE",
        [idProd]
      );
      if (prodRows.length === 0 || prodRows[0].status !== 'Ativo') {
        await conn.rollback();
        return res.status(400).json({ error: 'Um dos produtos selecionados não está mais disponível.' });
      }

      const prod = prodRows[0];
      if (prod.estoque < qtd) {
        await conn.rollback();
        return res.status(400).json({
          error: `Estoque insuficiente para "${prod.nome}". Disponível: ${prod.estoque}.`,
        });
      }

      const subtotal = Number((Number(prod.preco) * qtd).toFixed(2));
      subtotalGeral += subtotal;
      itensValidados.push({
        id_produto: prod.id_produto,
        nome: prod.nome,
        quantidade: qtd,
        preco_unitario: Number(prod.preco),
        subtotal,
      });

      // Decremento imediato do estoque (RNF1)
      await conn.query('UPDATE produto SET estoque = estoque - ? WHERE id_produto = ?', [qtd, prod.id_produto]);
    }

    // Cupom simples opcional (ex: PRIMEIRACOMPRA = 10% de desconto)
    let valorTotal = Number(subtotalGeral.toFixed(2));
    if (String(cupom || '').trim().toUpperCase() === 'PRIMEIRACOMPRA') {
      valorTotal = Number((valorTotal * 0.9).toFixed(2));
    }
    if (valorTotal <= 0) valorTotal = 0.01;

    const endFinal =
      recebimento === 'Entrega'
        ? String(endereco_entrega).trim()
        : 'Retirada na loja - Rua Antônio Joaquim, 28, Pocrane';

    const [pedRes] = await conn.query(
      `INSERT INTO pedido (id_cliente, data_pedido, valor_total, tipo_recebimento, endereco_entrega, cep_entrega, status, observacoes)
       VALUES (?, NOW(), ?, ?, ?, ?, 'Pendente', ?)`,
      [
        req.user.id_usuario,
        valorTotal,
        recebimento,
        endFinal,
        cep_entrega ? String(cep_entrega).trim() : null,
        observacoes ? String(observacoes).trim() : null,
      ]
    );
    const idPedido = pedRes.insertId;

    for (const item of itensValidados) {
      await conn.query(
        'INSERT INTO item_pedido (id_pedido, id_produto, quantidade, preco_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
        [idPedido, item.id_produto, item.quantidade, item.preco_unitario, item.subtotal]
      );
    }

    await conn.query(
      'INSERT INTO pagamento (id_pedido, metodo_pagamento, status_pagamento, troco_para) VALUES (?, ?, ?, ?)',
      [
        idPedido,
        metodo_pagamento,
        'Pendente',
        metodo_pagamento === 'Dinheiro' && troco_para ? Number(troco_para) : null,
      ]
    );

    if (recebimento === 'Entrega') {
      await conn.query(
        "INSERT INTO entrega (id_pedido, endereco_entrega, status_entrega) VALUES (?, ?, 'Pendente')",
        [idPedido, endFinal]
      );
      // Atualiza endereço padrão do cliente caso ainda esteja 'A informar'
      await conn.query(
        "UPDATE cliente SET endereco = CASE WHEN endereco = 'A informar' OR endereco = '' THEN ? ELSE endereco END, cep = COALESCE(?, cep) WHERE id_cliente = ?",
        [endFinal, cep_entrega ? String(cep_entrega).trim() : null, req.user.id_usuario]
      );
    }

    // Limpa carrinho salvo do cliente
    await conn.query(
      `DELETE ic FROM item_carrinho ic
       JOIN carrinho c ON c.id_carrinho = ic.id_carrinho
       WHERE c.id_cliente = ?`,
      [req.user.id_usuario]
    );

    await conn.commit();

    const whatsappUrl = buildWhatsappUrl(
      {
        id_pedido: idPedido,
        nome: req.user.nome,
        tipo_recebimento: recebimento,
        endereco_entrega: endFinal,
        cep_entrega,
        metodo_pagamento,
        troco_para,
        valor_total: valorTotal,
      },
      itensValidados
    );

    return res.status(201).json({
      pedido: {
        id_pedido: idPedido,
        valor_total: valorTotal,
        tipo_recebimento: recebimento,
        endereco_entrega: endFinal,
        metodo_pagamento,
        status: 'Pendente',
        itens: itensValidados,
      },
      chave_pix: process.env.CHAVE_PIX_LOJA || '02.387.358/0001-44',
      whatsapp_url: whatsappUrl,
    });
  } catch (err) {
    await conn.rollback();
    console.error('Erro ao criar pedido:', err);
    return res.status(500).json({ error: 'Erro ao finalizar pedido.' });
  } finally {
    conn.release();
  }
});

// Meus pedidos (Cliente - acompanhamento e "Seu ultimo pedido")
router.get('/meus', requireAuth, async (req, res) => {
  const pool = getPool();
  try {
    const [pedidos] = await pool.query(
      `SELECT p.id_pedido, p.data_pedido, p.valor_total, p.tipo_recebimento, p.endereco_entrega, p.status,
              pg.metodo_pagamento, pg.status_pagamento,
              e.status_entrega
       FROM pedido p
       LEFT JOIN pagamento pg ON pg.id_pedido = p.id_pedido
       LEFT JOIN entrega e ON e.id_pedido = p.id_pedido
       WHERE p.id_cliente = ?
       ORDER BY p.id_pedido DESC
       LIMIT 20`,
      [req.user.id_usuario]
    );

    if (pedidos.length === 0) {
      return res.json({ pedidos: [] });
    }

    const ids = pedidos.map((p) => p.id_pedido);
    const [itens] = await pool.query(
      `SELECT ip.id_pedido, ip.id_produto, ip.quantidade, ip.preco_unitario, ip.subtotal,
              pr.nome, pr.imagem_url, pr.preco AS preco_atual, pr.estoque
       FROM item_pedido ip
       JOIN produto pr ON pr.id_produto = ip.id_produto
       WHERE ip.id_pedido IN (?)`,
      [ids]
    );

    const porPedido = {};
    for (const it of itens) {
      porPedido[it.id_pedido] = porPedido[it.id_pedido] || [];
      porPedido[it.id_pedido].push(it);
    }

    return res.json({
      pedidos: pedidos.map((p) => ({ ...p, itens: porPedido[p.id_pedido] || [] })),
    });
  } catch (err) {
    console.error('Erro ao listar meus pedidos:', err);
    return res.status(500).json({ error: 'Erro ao carregar seus pedidos.' });
  }
});

// Cancelar pedido pendente (Cliente - funcao 8)
router.post('/:id/cancelar', requireAuth, requireRole('Cliente'), async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      'SELECT id_pedido, status FROM pedido WHERE id_pedido = ? AND id_cliente = ? FOR UPDATE',
      [req.params.id, req.user.id_usuario]
    );
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }
    if (rows[0].status !== 'Pendente') {
      await conn.rollback();
      return res.status(400).json({ error: 'Somente pedidos pendentes podem ser cancelados.' });
    }

    const [itens] = await conn.query('SELECT id_produto, quantidade FROM item_pedido WHERE id_pedido = ?', [
      req.params.id,
    ]);
    for (const it of itens) {
      await conn.query('UPDATE produto SET estoque = estoque + ? WHERE id_produto = ?', [
        it.quantidade,
        it.id_produto,
      ]);
    }

    await conn.query("UPDATE pedido SET status = 'Cancelado' WHERE id_pedido = ?", [req.params.id]);
    await conn.commit();
    return res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    console.error('Erro ao cancelar pedido:', err);
    return res.status(500).json({ error: 'Erro ao cancelar pedido.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
