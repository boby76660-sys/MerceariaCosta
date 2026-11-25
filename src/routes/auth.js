const express = require('express');
const bcrypt = require('bcryptjs');
const { getPool } = require('../db/pool');
const {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
} = require('../middleware/auth');

const router = express.Router();

// Cadastro de novo cliente (RF11, RNF5, RNF6)
router.post('/register', async (req, res) => {
  const { nome, email, telefone, senha, confirmarSenha, endereco, cep } = req.body || {};

  if (!email || !telefone || !senha) {
    return res.status(400).json({ error: 'Preencha email, celular e senha.' });
  }
  if (confirmarSenha !== undefined && senha !== confirmarSenha) {
    return res.status(400).json({ error: 'As senhas não conferem.' });
  }
  if (String(senha).length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
  }

  const emailNorm = String(email).trim().toLowerCase();
  const nomeFinal = String(nome || emailNorm.split('@')[0]).trim();
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    const [existing] = await conn.query('SELECT id_usuario FROM usuario WHERE email = ?', [emailNorm]);
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'Este email já está cadastrado.' });
    }

    const senhaHash = await bcrypt.hash(String(senha), 10);
    const [userRes] = await conn.query(
      'INSERT INTO usuario (nome, email, senha_hash, tipo_usuario, data_cadastro) VALUES (?, ?, ?, ?, CURDATE())',
      [nomeFinal, emailNorm, senhaHash, 'Cliente']
    );

    const idUsuario = userRes.insertId;
    await conn.query(
      'INSERT INTO cliente (id_cliente, telefone, endereco, cep) VALUES (?, ?, ?, ?)',
      [idUsuario, String(telefone).trim(), String(endereco || 'A informar').trim(), cep ? String(cep).trim() : null]
    );

    await conn.commit();

    const user = {
      id_usuario: idUsuario,
      nome: nomeFinal,
      email: emailNorm,
      tipo_usuario: 'Cliente',
      telefone: String(telefone).trim(),
      endereco: String(endereco || 'A informar').trim(),
      cep: cep ? String(cep).trim() : null,
    };
    const token = signToken({
      id_usuario: user.id_usuario,
      email: user.email,
      nome: user.nome,
      tipo_usuario: user.tipo_usuario,
    });
    setAuthCookie(res, token);
    return res.status(201).json({ user });
  } catch (err) {
    await conn.rollback();
    console.error('Erro no cadastro:', err);
    return res.status(500).json({ error: 'Erro interno ao cadastrar usuário.' });
  } finally {
    conn.release();
  }
});

// Login para Cliente, CaixaDono e Entregador
router.post('/login', async (req, res) => {
  const { email, senha } = req.body || {};
  if (!email || !senha) {
    return res.status(400).json({ error: 'Informe email e senha.' });
  }

  const emailNorm = String(email).trim().toLowerCase();
  const pool = getPool();

  try {
    const [rows] = await pool.query(
      `SELECT u.id_usuario, u.nome, u.email, u.senha_hash, u.tipo_usuario,
              c.telefone AS cli_tel, c.endereco AS cli_end, c.cep AS cli_cep,
              e.telefone AS ent_tel
       FROM usuario u
       LEFT JOIN cliente c ON c.id_cliente = u.id_usuario
       LEFT JOIN entregador e ON e.id_entregador = u.id_usuario
       WHERE u.email = ?`,
      [emailNorm]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Email ou senha inválidos.' });
    }

    const row = rows[0];
    const ok = await bcrypt.compare(String(senha), row.senha_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Email ou senha inválidos.' });
    }

    const user = {
      id_usuario: row.id_usuario,
      nome: row.nome,
      email: row.email,
      tipo_usuario: row.tipo_usuario,
      telefone: row.cli_tel || row.ent_tel || '',
      endereco: row.cli_end || '',
      cep: row.cli_cep || '',
    };

    const token = signToken({
      id_usuario: user.id_usuario,
      email: user.email,
      nome: user.nome,
      tipo_usuario: user.tipo_usuario,
    });
    setAuthCookie(res, token);
    return res.json({ user });
  } catch (err) {
    console.error('Erro no login:', err);
    return res.status(500).json({ error: 'Erro interno ao fazer login.' });
  }
});

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const pool = getPool();
  try {
    const [rows] = await pool.query(
      `SELECT u.id_usuario, u.nome, u.email, u.tipo_usuario, u.data_cadastro,
              c.telefone AS cli_tel, c.endereco AS cli_end, c.cep AS cli_cep,
              e.telefone AS ent_tel
       FROM usuario u
       LEFT JOIN cliente c ON c.id_cliente = u.id_usuario
       LEFT JOIN entregador e ON e.id_entregador = u.id_usuario
       WHERE u.id_usuario = ?`,
      [req.user.id_usuario]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    const r = rows[0];
    return res.json({
      user: {
        id_usuario: r.id_usuario,
        nome: r.nome,
        email: r.email,
        tipo_usuario: r.tipo_usuario,
        telefone: r.cli_tel || r.ent_tel || '',
        endereco: r.cli_end || '',
        cep: r.cli_cep || '',
      },
    });
  } catch (err) {
    console.error('Erro em /me:', err);
    return res.status(500).json({ error: 'Erro ao consultar perfil.' });
  }
});

// Atualizar dados pessoais (RF9.3)
router.put('/profile', requireAuth, async (req, res) => {
  const { nome, telefone, endereco, cep } = req.body || {};
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (nome) {
      await conn.query('UPDATE usuario SET nome = ? WHERE id_usuario = ?', [
        String(nome).trim(),
        req.user.id_usuario,
      ]);
    }
    if (req.user.tipo_usuario === 'Cliente') {
      await conn.query(
        'UPDATE cliente SET telefone = COALESCE(?, telefone), endereco = COALESCE(?, endereco), cep = COALESCE(?, cep) WHERE id_cliente = ?',
        [
          telefone !== undefined ? String(telefone).trim() : null,
          endereco !== undefined ? String(endereco).trim() : null,
          cep !== undefined ? String(cep).trim() : null,
          req.user.id_usuario,
        ]
      );
    }
    await conn.commit();
    return res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    console.error('Erro ao atualizar perfil:', err);
    return res.status(500).json({ error: 'Erro ao atualizar perfil.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
