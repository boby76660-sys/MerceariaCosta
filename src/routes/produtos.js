const express = require('express');
const { getPool } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Listar produtos (suporta busca, categoria, ofertas, ordenacao e filtro admin)
router.get('/', async (req, res) => {
  const { busca, categoria, oferta, ordem, incluirInativos } = req.query;
  const pool = getPool();

  try {
    const where = [];
    const params = [];

    if (incluirInativos !== 'true') {
      where.push("status = 'Ativo'");
    }
    if (categoria && categoria !== 'TODOS') {
      where.push('categoria = ?');
      params.push(categoria);
    }
    if (oferta === 'true') {
      where.push('(oferta = 1 OR desconto > 0)');
    }
    if (busca) {
      where.push('(nome LIKE ? OR descricao LIKE ? OR categoria LIKE ?)');
      const term = `%${String(busca).trim()}%`;
      params.push(term, term, term);
    }

    let orderBy = 'id_produto ASC';
    if (ordem === 'menor_preco') orderBy = 'preco ASC';
    else if (ordem === 'maior_preco') orderBy = 'preco DESC';
    else if (ordem === 'nome') orderBy = 'nome ASC';

    const sql = `SELECT id_produto, nome, descricao, preco, preco_original, estoque, categoria, medida, desconto, imagem_url, oferta, mais_vendido, status
                 FROM produto
                 ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY ${orderBy}`;

    const [rows] = await pool.query(sql, params);
    return res.json({ produtos: rows });
  } catch (err) {
    console.error('Erro ao listar produtos:', err);
    return res.status(500).json({ error: 'Erro ao carregar produtos.' });
  }
});

router.get('/:id', async (req, res) => {
  const pool = getPool();
  try {
    const [rows] = await pool.query('SELECT * FROM produto WHERE id_produto = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }
    return res.json({ produto: rows[0] });
  } catch (err) {
    console.error('Erro ao buscar produto:', err);
    return res.status(500).json({ error: 'Erro ao carregar produto.' });
  }
});

// Cadastrar produto (Caixa/Dono - RF1, RF2, RF3)
router.post('/', requireAuth, requireRole('CaixaDono'), async (req, res) => {
  const {
    nome,
    descricao,
    preco,
    preco_original,
    estoque,
    categoria,
    medida,
    desconto,
    imagem_url,
    oferta,
    mais_vendido,
  } = req.body || {};

  if (!nome || !preco || !categoria) {
    return res.status(400).json({ error: 'Informe nome, preço e categoria do produto.' });
  }
  const precoNum = Number(preco);
  const estoqueNum = Number(estoque ?? 0);
  if (!(precoNum > 0) || estoqueNum < 0) {
    return res.status(400).json({ error: 'Preço deve ser maior que zero e estoque não pode ser negativo.' });
  }

  const pool = getPool();
  try {
    const [result] = await pool.query(
      `INSERT INTO produto (nome, descricao, preco, preco_original, estoque, categoria, medida, desconto, imagem_url, oferta, mais_vendido, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Ativo')`,
      [
        String(nome).trim(),
        descricao ? String(descricao).trim() : null,
        precoNum,
        preco_original ? Number(preco_original) : null,
        estoqueNum,
        String(categoria).trim(),
        medida ? String(medida).trim() : 'UNIDADE',
        Number(desconto || 0),
        imagem_url ? String(imagem_url).trim() : '/assets/logo-mercearia-costa.png',
        oferta ? 1 : 0,
        mais_vendido ? 1 : 0,
      ]
    );
    const [rows] = await pool.query('SELECT * FROM produto WHERE id_produto = ?', [result.insertId]);
    return res.status(201).json({ produto: rows[0] });
  } catch (err) {
    console.error('Erro ao criar produto:', err);
    return res.status(500).json({ error: 'Erro ao cadastrar produto.' });
  }
});

// Editar produto / estoque / oferta (Caixa/Dono - RF1, RF2, RF3)
router.put('/:id', requireAuth, requireRole('CaixaDono'), async (req, res) => {
  const {
    nome,
    descricao,
    preco,
    preco_original,
    estoque,
    categoria,
    medida,
    desconto,
    imagem_url,
    oferta,
    mais_vendido,
    status,
  } = req.body || {};

  const pool = getPool();
  try {
    const [existing] = await pool.query('SELECT * FROM produto WHERE id_produto = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }
    const cur = existing[0];
    const precoFinal = preco !== undefined ? Number(preco) : cur.preco;
    const estoqueFinal = estoque !== undefined ? Number(estoque) : cur.estoque;
    if (!(precoFinal > 0) || estoqueFinal < 0) {
      return res.status(400).json({ error: 'Preço inválido ou estoque negativo.' });
    }

    await pool.query(
      `UPDATE produto
       SET nome = ?, descricao = ?, preco = ?, preco_original = ?, estoque = ?, categoria = ?, medida = ?, desconto = ?, imagem_url = ?, oferta = ?, mais_vendido = ?, status = ?
       WHERE id_produto = ?`,
      [
        nome !== undefined ? String(nome).trim() : cur.nome,
        descricao !== undefined ? (descricao ? String(descricao).trim() : null) : cur.descricao,
        precoFinal,
        preco_original !== undefined ? (preco_original ? Number(preco_original) : null) : cur.preco_original,
        estoqueFinal,
        categoria !== undefined ? String(categoria).trim() : cur.categoria,
        medida !== undefined ? String(medida).trim() : cur.medida,
        desconto !== undefined ? Number(desconto) : cur.desconto,
        imagem_url !== undefined ? String(imagem_url).trim() : cur.imagem_url,
        oferta !== undefined ? (oferta ? 1 : 0) : cur.oferta,
        mais_vendido !== undefined ? (mais_vendido ? 1 : 0) : cur.mais_vendido,
        status !== undefined ? status : cur.status,
        req.params.id,
      ]
    );
    const [rows] = await pool.query('SELECT * FROM produto WHERE id_produto = ?', [req.params.id]);
    return res.json({ produto: rows[0] });
  } catch (err) {
    console.error('Erro ao atualizar produto:', err);
    return res.status(500).json({ error: 'Erro ao atualizar produto.' });
  }
});

// Remover (desativar/excluir se sem historico) produto (Caixa/Dono - RF1)
router.delete('/:id', requireAuth, requireRole('CaixaDono'), async (req, res) => {
  const pool = getPool();
  try {
    const [used] = await pool.query('SELECT COUNT(*) AS cnt FROM item_pedido WHERE id_produto = ?', [
      req.params.id,
    ]);
    if (used[0].cnt > 0) {
      await pool.query("UPDATE produto SET status = 'Inativo' WHERE id_produto = ?", [req.params.id]);
      return res.json({ ok: true, softDeleted: true });
    }
    await pool.query('DELETE FROM produto WHERE id_produto = ?', [req.params.id]);
    return res.json({ ok: true, softDeleted: false });
  } catch (err) {
    console.error('Erro ao remover produto:', err);
    return res.status(500).json({ error: 'Erro ao remover produto.' });
  }
});

module.exports = router;
