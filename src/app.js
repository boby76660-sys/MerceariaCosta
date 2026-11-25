require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const { getPool } = require('./db/pool');
const authRoutes = require('./routes/auth');
const produtosRoutes = require('./routes/produtos');
const carrinhoRoutes = require('./routes/carrinho');
const pedidosRoutes = require('./routes/pedidos');
const adminRoutes = require('./routes/admin');
const entregadorRoutes = require('./routes/entregador');

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Arquivos estaticos da vitrine e assets do Figma
app.use(express.static(path.join(__dirname, '..', 'public')));

// Healthcheck para testar servidor e conexao com banco
app.get('/api/health', async (_req, res) => {
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    return res.json({ ok: true, db: 'connected' });
  } catch (err) {
    return res.status(500).json({ ok: false, db: 'disconnected', error: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/produtos', produtosRoutes);
app.use('/api/carrinho', carrinhoRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/entregador', entregadorRoutes);

// Rota fallback para SPA/paginas HTML
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint não encontrado.' });
  }
  return res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

module.exports = app;
