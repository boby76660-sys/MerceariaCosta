(() => {
  const CATEGORIES = [
    { name: 'Alimentos', label: 'ALIMENTOS', img: '/assets/cat-alimentos.png' },
    { name: 'Frutas e Legumes', label: 'FRUTAS E LEGUMES', img: '/assets/cat-frutas-legumes.png' },
    { name: 'Bebidas', label: 'BEBIDAS', img: '/assets/prod-leite-piracanjuba.png' },
    { name: 'Produtos de Limpeza', label: 'PRODUTOS DE LIMPEZA', img: '/assets/prod-desinfetante-facilita.png' },
    { name: 'Padaria', label: 'PADARIA', img: '/assets/cat-padaria-1.png' },
    { name: 'Carnes', label: 'CARNES', img: '/assets/cat-carnes-1.png' },
    { name: 'Doces', label: 'DOCES', img: '/assets/prod-nutella-350g.png' },
  ];

  const BANNERS = [
    { src: '/assets/banner-festival-cafes.png', alt: 'Festival de Cafés & Chocolates Nestlé' },
    { src: '/assets/banner-hot-friday.png', alt: 'Hot Friday Seara até 50% OFF' },
  ];

  const state = {
    user: null,
    produtos: [],
    cart: JSON.parse(sessionStorage.getItem('mc_cart') || '[]'),
    delivery: JSON.parse(
      localStorage.getItem('mc_delivery') ||
        JSON.stringify({ mode: 'Entrega', cep: '36960-000', address: 'R. São José, 308 - Pocrane' })
    ),
    bannerIndex: 0,
    checkoutStep: 'carrinho', // carrinho | envio | pagamento | concluido
    checkoutPayment: 'Pix',
    checkoutTroco: '',
    checkoutCupom: '',
    lastOrderResult: null,
    admTab: 'painel',
    admPeriodo: 'todos',
    admOrderFilter: 'TODOS',
    pollTimer: null,
  };

  const $ = (sel) => document.querySelector(sel);

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function brl(val) {
    return `R$ ${Number(val || 0).toFixed(2).replace('.', ',')}`;
  }

  function toast(msg, isError = false) {
    const el = $('#toast');
    el.textContent = msg;
    el.style.background = isError ? '#991b1b' : '#1f2937';
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      el.hidden = true;
    }, 3200);
  }

  // MODO ESCURO (RNF4)
  function initTheme() {
    const saved = localStorage.getItem('mc_theme') || 'light';
    applyTheme(saved);
    $('#theme-toggle-btn').addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mc_theme', theme);
    $('#theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  // CARRINHO (SessionStorage + DB quando logado)
  function saveCart() {
    sessionStorage.setItem('mc_cart', JSON.stringify(state.cart));
    updateCartBadge();
    if (state.user && state.user.tipo_usuario === 'Cliente') {
      API.put('/api/carrinho', {
        itens: state.cart.map((c) => ({ id_produto: c.id_produto, quantidade: c.quantidade })),
      }).catch(() => {});
    }
  }

  function updateCartBadge() {
    const totalQtd = state.cart.reduce((acc, it) => acc + it.quantidade, 0);
    $('#cart-badge').textContent = totalQtd;
  }

  function addToCart(produto, qtd = 1) {
    if (!produto || produto.estoque <= 0) {
      return toast('Produto esgotado no momento.', true);
    }
    const idx = state.cart.findIndex((i) => i.id_produto === produto.id_produto);
    const novaQtd = (idx >= 0 ? state.cart[idx].quantidade : 0) + qtd;
    if (novaQtd > produto.estoque) {
      return toast(`Estoque máximo disponível: ${produto.estoque} unidade(s).`, true);
    }
    if (idx >= 0) {
      state.cart[idx].quantidade = novaQtd;
    } else {
      state.cart.push({
        id_produto: produto.id_produto,
        nome: produto.nome,
        preco: Number(produto.preco),
        preco_original: produto.preco_original ? Number(produto.preco_original) : null,
        imagem_url: produto.imagem_url || '/assets/logo-mercearia-costa.png',
        estoque: Number(produto.estoque),
        quantidade: qtd,
      });
    }
    saveCart();
    renderCartDrawer();
    toast(`"${produto.nome}" adicionado ao carrinho!`);
  }

  function updateCartQty(idProduto, delta) {
    const idx = state.cart.findIndex((i) => i.id_produto === idProduto);
    if (idx < 0) return;
    const item = state.cart[idx];
    const next = item.quantidade + delta;
    if (next <= 0) {
      state.cart.splice(idx, 1);
    } else if (next > item.estoque) {
      return toast(`Limite de estoque atingido (${item.estoque}).`, true);
    } else {
      item.quantidade = next;
    }
    saveCart();
    renderCartDrawer();
    if (location.hash.startsWith('#checkout')) renderCheckout();
  }

  function renderCartDrawer() {
    const box = $('#cart-drawer-items');
    if (state.cart.length === 0) {
      box.innerHTML = '<p class="mt-md" style="color:var(--text-muted);text-align:center;">Seu carrinho está vazio.</p>';
      $('#cart-drawer-total').textContent = brl(0);
      return;
    }
    let total = 0;
    box.innerHTML = state.cart
      .map((it) => {
        const sub = it.preco * it.quantidade;
        total += sub;
        return `
          <div class="cart-row" style="grid-template-columns:56px 1fr auto;">
            <img class="thumb" src="${esc(it.imagem_url)}" alt="${esc(it.nome)}" style="width:56px;height:56px;" />
            <div>
              <strong style="font-size:13px;">${esc(it.nome)}</strong>
              <div style="font-size:13px;color:var(--brand-red);font-weight:700;">${brl(it.preco)} un.</div>
              <div class="qty-stepper mt-sm">
                <button type="button" data-cart-dec="${it.id_produto}">-</button>
                <span>${it.quantidade}</span>
                <button type="button" data-cart-inc="${it.id_produto}">+</button>
              </div>
            </div>
            <div style="text-align:right;">
              <button type="button" class="icon-btn" data-cart-rm="${it.id_produto}" title="Remover">
                <img src="/assets/icon-lixeira.png" alt="Remover" />
              </button>
              <div style="font-weight:800;font-size:14px;margin-top:6px;">${brl(sub)}</div>
            </div>
          </div>`;
      })
      .join('');
    $('#cart-drawer-total').textContent = brl(total);
  }

  // CABECALHO & SESSAO
  function updateHeaderState() {
    $('#delivery-pill-title').textContent = state.delivery.mode === 'Retirada' ? 'Retirar na loja' : 'Entregar em';
    $('#delivery-pill-address').textContent =
      state.delivery.mode === 'Retirada'
        ? 'Rua Antônio Joaquim, 28 - Pocrane'
        : state.delivery.address || 'Informar endereço';

    const navAdm = $('#nav-adm');
    const navEnt = $('#nav-entregador');
    const navPedidos = $('#nav-meus-pedidos');

    if (state.user) {
      $('#user-label').textContent = state.user.nome.split(' ')[0];
      navPedidos.hidden = false;
      navAdm.hidden = state.user.tipo_usuario !== 'CaixaDono';
      navEnt.hidden = !['Entregador', 'CaixaDono'].includes(state.user.tipo_usuario);
    } else {
      $('#user-label').textContent = 'Login / Registro';
      navPedidos.hidden = true;
      navAdm.hidden = true;
      navEnt.hidden = true;
    }
  }

  async function bootstrapAuth() {
    try {
      const { user } = await API.get('/api/auth/me');
      state.user = user;
      if (user.endereco && user.endereco !== 'A informar') {
        state.delivery.address = user.endereco;
        if (user.cep) state.delivery.cep = user.cep;
      }
      if (user.tipo_usuario === 'Cliente' && state.cart.length === 0) {
        const res = await API.get('/api/carrinho').catch(() => ({ itens: [] }));
        if (res.itens && res.itens.length > 0) {
          state.cart = res.itens;
          sessionStorage.setItem('mc_cart', JSON.stringify(state.cart));
        }
      }
    } catch {
      state.user = null;
    }
    updateHeaderState();
    updateCartBadge();
  }

  async function loadProdutos(params = '') {
    const { produtos } = await API.get(`/api/produtos${params}`);
    if (!params) state.produtos = produtos;
    return produtos;
  }

  // CARD DE PRODUTO
  function productCardHtml(p) {
    const esgotado = Number(p.estoque) <= 0;
    const oldHtml = p.preco_original ? `<span class="old-price">${brl(p.preco_original)}</span>` : '';
    const unitHint = p.medida === 'KG' ? `<span class="unit-hint">Preço por kg</span>` : '';
    const descHtml = Number(p.desconto) > 0 ? `<span class="discount-badge">${Math.round(p.desconto)}% OFF</span>` : '<span></span>';

    return `
      <article class="product-card" data-pid="${p.id_produto}">
        <div>
          <button type="button" class="product-img-btn" data-open-product="${p.id_produto}">
            <img src="${esc(p.imagem_url || '/assets/logo-mercearia-costa.png')}" alt="${esc(p.nome)}" />
          </button>
          <button type="button" class="product-title-btn" data-open-product="${p.id_produto}">
            ${esc(p.nome)}
          </button>
          <div class="product-meta-row">
            ${descHtml}
            <span class="stock-badge ${esgotado ? 'out' : ''}">
              ${esgotado ? 'Esgotado' : `${p.estoque} disp.`}
            </span>
          </div>
        </div>
        <div>
          <div class="price-controls-row">
            <div>
              ${oldHtml}
              ${unitHint}
              <strong class="current-price">${brl(p.preco)}</strong>
            </div>
            <div class="qty-stepper">
              <button type="button" data-card-dec="${p.id_produto}" ${esgotado ? 'disabled' : ''}>-</button>
              <span id="card-qty-${p.id_produto}">1</span>
              <button type="button" data-card-inc="${p.id_produto}" ${esgotado ? 'disabled' : ''}>+</button>
            </div>
          </div>
          <button type="button" class="btn-primary btn-block" data-card-buy="${p.id_produto}" ${esgotado ? 'disabled' : ''}>
            ${esgotado ? 'Indisponível' : 'Comprar'}
          </button>
        </div>
      </article>`;
  }

  // PAGINA PRINCIPAL (Principal do Figma)
  async function renderHome() {
    const root = $('#app-root');
    root.innerHTML = '<div class="container"><p>Carregando catálogo...</p></div>';
    try {
      const produtos = await loadProdutos();
      const ofertas = produtos.filter((p) => p.oferta || Number(p.desconto) > 0).slice(0, 5);
      const maisVendidos = produtos.filter((p) => p.mais_vendido).slice(0, 5);
      let ultimoPedidoItens = [];
      if (state.user) {
        const res = await API.get('/api/pedidos/meus').catch(() => ({ pedidos: [] }));
        if (res.pedidos && res.pedidos.length > 0) {
          ultimoPedidoItens = res.pedidos[0].itens || [];
        }
      }

      const banner = BANNERS[state.bannerIndex % BANNERS.length];

      root.innerHTML = `
        <div class="container">
          <section class="hero-banner">
            <img src="${banner.src}" alt="${esc(banner.alt)}" id="hero-banner-img" />
            <div class="hero-controls">
              ${BANNERS.map(
                (_b, idx) =>
                  `<button type="button" class="hero-dot ${idx === state.bannerIndex ? 'active' : ''}" data-banner="${idx}">${
                    idx + 1
                  }</button>`
              ).join('')}
            </div>
          </section>

          <section class="categories-grid" aria-label="Categorias">
            ${CATEGORIES.map(
              (c) => `
              <button type="button" class="category-tile" data-cat="${esc(c.name)}">
                <span>${esc(c.label)}</span>
                <img src="${esc(c.img)}" alt="${esc(c.name)}" />
              </button>`
            ).join('')}
          </section>

          <div class="section-header">
            <h2 class="section-title">Ofertas da Semana</h2>
          </div>
          <section class="products-grid">
            ${(ofertas.length ? ofertas : produtos.slice(0, 5)).map(productCardHtml).join('')}
          </section>

          <div class="section-header">
            <h2 class="section-title">Mais Vendidos</h2>
          </div>
          <section class="products-grid">
            ${(maisVendidos.length ? maisVendidos : produtos.slice(5, 10)).map(productCardHtml).join('')}
          </section>

          <section class="promo-strip-banner">
            <img src="/assets/banner-hot-friday.png" alt="Hot Friday até 50% OFF" />
          </section>

          ${
            ultimoPedidoItens.length > 0
              ? `
            <div class="section-header">
              <h2 class="section-title">Seu Último Pedido</h2>
              <button type="button" class="btn-primary" id="reorder-last-btn">Pedir Novamente</button>
            </div>
            <section class="products-grid">
              ${ultimoPedidoItens
                .map((it) => {
                  const full = state.produtos.find((p) => p.id_produto === it.id_produto);
                  return full ? productCardHtml(full) : '';
                })
                .join('')}
            </section>`
              : ''
          }
        </div>`;

      const reorderBtn = $('#reorder-last-btn');
      if (reorderBtn) {
        reorderBtn.addEventListener('click', () => {
          ultimoPedidoItens.forEach((it) => {
            const p = state.produtos.find((x) => x.id_produto === it.id_produto);
            if (p && p.estoque > 0) addToCart(p, Math.min(it.quantidade, p.estoque));
          });
          $('#cart-drawer').hidden = false;
        });
      }
    } catch (err) {
      root.innerHTML = `<div class="container"><div class="surface-card">Não foi possível carregar os produtos (${esc(err.message)}). Verifique se o banco de dados está configurado.</div></div>`;
    }
  }

  // CATALOGO / CATEGORIA / BUSCA / OFERTAS
  async function renderCatalog(opts = {}) {
    const root = $('#app-root');
    const qs = new URLSearchParams();
    if (opts.categoria && opts.categoria !== 'TODOS') qs.set('categoria', opts.categoria);
    if (opts.busca) qs.set('busca', opts.busca);
    if (opts.oferta) qs.set('oferta', 'true');
    if (opts.ordem) qs.set('ordem', opts.ordem);

    const queryStr = qs.toString() ? `?${qs.toString()}` : '';
    const produtos = await loadProdutos(queryStr);

    const titulo = opts.oferta
      ? 'Ofertas da Semana'
      : opts.busca
      ? `Busca: "${opts.busca}"`
      : opts.categoria || 'Catálogo Completo';

    root.innerHTML = `
      <div class="container">
        <div class="section-header left">
          <h2 class="section-title">${esc(titulo)}</h2>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <select id="cat-filter-select" class="input-full" style="width:auto;">
              <option value="TODOS">Todas as categorias</option>
              ${CATEGORIES.map(
                (c) => `<option value="${esc(c.name)}" ${opts.categoria === c.name ? 'selected' : ''}>${esc(c.name)}</option>`
              ).join('')}
            </select>
            <select id="order-filter-select" class="input-full" style="width:auto;">
              <option value="">Ordenar por padrão</option>
              <option value="menor_preco" ${opts.ordem === 'menor_preco' ? 'selected' : ''}>Menor preço</option>
              <option value="maior_preco" ${opts.ordem === 'maior_preco' ? 'selected' : ''}>Maior preço</option>
              <option value="nome" ${opts.ordem === 'nome' ? 'selected' : ''}>Nome (A-Z)</option>
            </select>
          </div>
        </div>
        ${
          produtos.length === 0
            ? '<div class="surface-card">Nenhum produto encontrado para este filtro.</div>'
            : `<div class="products-grid">${produtos.map(productCardHtml).join('')}</div>`
        }
      </div>`;

    $('#cat-filter-select').addEventListener('change', (e) => {
      renderCatalog({ ...opts, categoria: e.target.value, oferta: false });
    });
    $('#order-filter-select').addEventListener('change', (e) => {
      renderCatalog({ ...opts, ordem: e.target.value });
    });
  }

  // DETALHE DO PRODUTO (Podruto no Figma)
  async function renderProductDetail(id) {
    const root = $('#app-root');
    try {
      const { produto } = await API.get(`/api/produtos/${id}`);
      const esgotado = Number(produto.estoque) <= 0;
      const sugestoes = state.produtos.filter((p) => p.id_produto !== produto.id_produto).slice(0, 4);

      root.innerHTML = `
        <div class="container">
          <button type="button" class="btn-secondary" onclick="history.back()">← Voltar</button>
          <div class="surface-card detail-grid mt-md">
            <div class="detail-img-wrap">
              <img src="${esc(produto.imagem_url || '/assets/logo-mercearia-costa.png')}" alt="${esc(produto.nome)}" />
            </div>
            <div>
              <span class="discount-badge">${esc(produto.categoria)}</span>
              <h1 class="mt-sm" style="font-size:28px;">${esc(produto.nome)}</h1>
              <p class="mt-sm" style="color:var(--text-muted);line-height:1.5;">
                ${esc(produto.descricao || 'Produto selecionado Mercearia Costa.')}
              </p>
              <div class="mt-md">
                ${produto.preco_original ? `<span class="old-price">${brl(produto.preco_original)}</span>` : ''}
                <strong class="current-price" style="font-size:32px;">${brl(produto.preco)}</strong>
                <span class="unit-hint">Medida: ${esc(produto.medida)} • Estoque: ${produto.estoque}</span>
              </div>
              <div class="mt-md" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                <div class="qty-stepper">
                  <button type="button" id="detail-dec" ${esgotado ? 'disabled' : ''}>-</button>
                  <span id="detail-qty">1</span>
                  <button type="button" id="detail-inc" ${esgotado ? 'disabled' : ''}>+</button>
                </div>
                <button type="button" class="btn-primary" id="detail-buy-btn" ${esgotado ? 'disabled' : ''}>
                  ${esgotado ? 'Produto Esgotado' : 'Adicionar ao Carrinho'}
                </button>
              </div>
            </div>
          </div>

          <div class="section-header"><h2 class="section-title">Compre Também</h2></div>
          <div class="products-grid">${sugestoes.map(productCardHtml).join('')}</div>
        </div>`;

      let q = 1;
      $('#detail-dec').addEventListener('click', () => {
        if (q > 1) {
          q--;
          $('#detail-qty').textContent = q;
        }
      });
      $('#detail-inc').addEventListener('click', () => {
        if (q < produto.estoque) {
          q++;
          $('#detail-qty').textContent = q;
        }
      });
      $('#detail-buy-btn').addEventListener('click', () => addToCart(produto, q));
    } catch (err) {
      root.innerHTML = `<div class="container"><div class="surface-card">${esc(err.message)}</div></div>`;
    }
  }

  // LOGIN / REGISTRO (Figma 133:249)
  function renderAuth() {
    if (state.user) {
      location.hash = state.user.tipo_usuario === 'CaixaDono' ? '#adm' : state.user.tipo_usuario === 'Entregador' ? '#entregador' : '#meus-pedidos';
      return;
    }
    $('#app-root').innerHTML = `
      <div class="container">
        <div class="auth-grid">
          <section class="surface-card">
            <h2 class="section-title" style="text-align:center;">Registro</h2>
            <form id="register-form" class="mt-md">
              <div class="form-group">
                <label>Nome completo *</label>
                <input type="text" id="reg-nome" placeholder="Ex: João Costa" required />
              </div>
              <div class="form-group">
                <label>Email *</label>
                <input type="email" id="reg-email" placeholder="Ex: joaocosta123@hotmail.com" required />
              </div>
              <div class="form-group">
                <label>Celular *</label>
                <input type="text" id="reg-tel" placeholder="Ex: 33912344321" required />
              </div>
              <div class="form-group">
                <label>Endereço de entrega</label>
                <input type="text" id="reg-end" placeholder="Rua, número e bairro - Pocrane" />
              </div>
              <div class="form-group">
                <label>Senha *</label>
                <input type="password" id="reg-senha" placeholder="Mínimo 6 caracteres" required minlength="6" />
              </div>
              <div class="form-group">
                <label>Confirmar senha *</label>
                <input type="password" id="reg-conf" placeholder="Repita sua senha" required minlength="6" />
              </div>
              <button type="submit" class="btn-primary btn-block">Registrar</button>
            </form>
          </section>

          <section class="surface-card">
            <h2 class="section-title" style="text-align:center;">Login</h2>
            <form id="login-form" class="mt-md">
              <div class="form-group">
                <label>Email *</label>
                <input type="email" id="log-email" placeholder="seuemail@exemplo.com" required />
              </div>
              <div class="form-group">
                <label>Senha *</label>
                <input type="password" id="log-senha" placeholder="Sua senha" required />
              </div>
              <button type="submit" class="btn-primary btn-block">Entrar</button>
            </form>
            <p class="mt-md" style="font-size:12px;color:var(--text-muted);">
              Clientes, Caixa/Dono e Entregadores utilizam esta mesma tela de login.
            </p>
          </section>
        </div>
      </div>`;

    $('#register-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const { user } = await API.post('/api/auth/register', {
          nome: $('#reg-nome').value,
          email: $('#reg-email').value,
          telefone: $('#reg-tel').value,
          endereco: $('#reg-end').value,
          senha: $('#reg-senha').value,
          confirmarSenha: $('#reg-conf').value,
        });
        state.user = user;
        updateHeaderState();
        saveCart();
        toast('Conta criada com sucesso!');
        location.hash = state.cart.length > 0 ? '#checkout' : '#home';
      } catch (err) {
        toast(err.message, true);
      }
    });

    $('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const { user } = await API.post('/api/auth/login', {
          email: $('#log-email').value,
          senha: $('#log-senha').value,
        });
        state.user = user;
        updateHeaderState();
        toast(`Bem-vindo(a), ${user.nome}!`);
        if (user.tipo_usuario === 'CaixaDono') location.hash = '#adm';
        else if (user.tipo_usuario === 'Entregador') location.hash = '#entregador';
        else location.hash = state.cart.length > 0 ? '#checkout' : '#home';
      } catch (err) {
        toast(err.message, true);
      }
    });
  }

  // CHECKOUT COMPLETO (Figma Finalizar Pedido + Escopo MVP Pagamento Direto)
  function renderCheckout() {
    const root = $('#app-root');
    if (state.checkoutStep === 'concluido' && state.lastOrderResult) {
      const r = state.lastOrderResult;
      root.innerHTML = `
        <div class="container">
          <div class="surface-card" style="max-width:680px;margin:0 auto;text-align:center;">
            <div style="font-size:46px;">✅</div>
            <h2 class="section-title mt-sm">Pedido #${r.pedido.id_pedido} Realizado!</h2>
            <p class="mt-sm" style="color:var(--text-muted);">
              Total: <strong>${brl(r.pedido.valor_total)}</strong> • Forma de pagamento: <strong>${esc(r.pedido.metodo_pagamento)}</strong>
            </p>
            <p class="mt-sm">Recebimento: <strong>${esc(r.pedido.tipo_recebimento)}</strong> — ${esc(r.pedido.endereco_entrega)}</p>
            ${
              r.pedido.metodo_pagamento === 'Pix'
                ? `<div class="surface-card mt-md" style="background:var(--bg-card);">
                    <strong>Pagamento Direto via Pix</strong>
                    <p class="mt-sm">Chave Pix da Mercearia Costa (CNPJ): <strong>${esc(r.chave_pix)}</strong></p>
                    <button type="button" class="btn-secondary mt-sm" id="copy-pix-btn">Copiar Chave Pix</button>
                  </div>`
                : ''
            }
            <div class="mt-lg" style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
              <a href="${esc(r.whatsapp_url)}" target="_blank" rel="noopener" class="btn-whatsapp">
                Enviar prévia no WhatsApp da Mercearia
              </a>
              <a href="#meus-pedidos" class="btn-secondary">Acompanhar Pedido</a>
              <a href="#home" class="btn-primary">Voltar às compras</a>
            </div>
          </div>
        </div>`;
      const copyBtn = $('#copy-pix-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          navigator.clipboard?.writeText(r.chave_pix);
          toast('Chave Pix copiada!');
        });
      }
      return;
    }

    if (state.cart.length === 0) {
      root.innerHTML = `
        <div class="container">
          <div class="surface-card" style="text-align:center;">
            <h2>Seu carrinho está vazio</h2>
            <a href="#home" class="btn-primary mt-md" style="display:inline-block;">Ver produtos</a>
          </div>
        </div>`;
      return;
    }

    const subtotal = state.cart.reduce((s, it) => s + it.preco * it.quantidade, 0);
    const descontoCupom = state.checkoutCupom.trim().toUpperCase() === 'PRIMEIRACOMPRA' ? subtotal * 0.1 : 0;
    const total = Math.max(0.01, subtotal - descontoCupom);

    root.innerHTML = `
      <div class="container">
        <div class="stepper-bar">
          <span class="step-pill ${state.checkoutStep === 'carrinho' ? 'active' : ''}">1. Carrinho</span>
          <span class="step-pill ${state.checkoutStep === 'envio' ? 'active' : ''}">2. Entrega / Retirada</span>
          <span class="step-pill ${state.checkoutStep === 'pagamento' ? 'active' : ''}">3. Pagamento Direto</span>
        </div>

        <div class="checkout-layout">
          <section class="surface-card">
            ${
              state.checkoutStep === 'carrinho'
                ? `
              <h3>Itens no Carrinho</h3>
              ${state.cart
                .map(
                  (it) => `
                <div class="cart-row">
                  <img class="thumb" src="${esc(it.imagem_url)}" alt="${esc(it.nome)}" />
                  <div>
                    <strong>${esc(it.nome)}</strong>
                    <div style="font-size:13px;color:var(--text-muted);">${brl(it.preco)} cada</div>
                  </div>
                  <div class="qty-stepper">
                    <button type="button" data-cart-dec="${it.id_produto}">-</button>
                    <span>${it.quantidade}</span>
                    <button type="button" data-cart-inc="${it.id_produto}">+</button>
                  </div>
                  <strong>${brl(it.preco * it.quantidade)}</strong>
                  <button type="button" class="icon-btn" data-cart-rm="${it.id_produto}">
                    <img src="/assets/icon-lixeira.png" alt="Remover" />
                  </button>
                </div>`
                )
                .join('')}`
                : state.checkoutStep === 'envio'
                ? `
              <h3>Como deseja receber seu pedido?</h3>
              <div class="toggle-grid">
                <button type="button" class="choice-btn ${state.delivery.mode === 'Entrega' ? 'active' : ''}" id="chk-mode-entrega">🚚 Entrega no endereço</button>
                <button type="button" class="choice-btn ${state.delivery.mode === 'Retirada' ? 'active' : ''}" id="chk-mode-retirada">🏪 Retirar na loja</button>
              </div>
              ${
                state.delivery.mode === 'Entrega'
                  ? `
                <div class="form-group">
                  <label>CEP</label>
                  <input type="text" id="chk-cep" value="${esc(state.delivery.cep)}" placeholder="36960-000" />
                </div>
                <div class="form-group">
                  <label>Endereço completo (Rua, número, bairro) *</label>
                  <input type="text" id="chk-address" value="${esc(state.delivery.address)}" required />
                </div>`
                  : `<p style="color:var(--text-muted);">Retirada gratuita no balcão: <strong>Rua Antônio Joaquim, 28, Pocrane - MG</strong>.</p>`
              }
              <div class="form-group mt-md">
                <label>Observações do pedido (opcional)</label>
                <input type="text" id="chk-obs" placeholder="Ex: Portão azul, deixar na portaria" />
              </div>
              <button type="button" class="btn-secondary mt-sm" id="back-to-cart">← Voltar ao carrinho</button>`
                : `
              <h3>Pagamento 100% Direto com a Mercearia</h3>
              <p class="mt-sm" style="font-size:13px;color:var(--text-muted);">
                O acerto é feito diretamente com a Mercearia Costa (na entrega ou retirada). Nenhum dado de cartão é armazenado no site.
              </p>
              <div class="toggle-grid" style="grid-template-columns:repeat(3,1fr);">
                <button type="button" class="choice-btn ${state.checkoutPayment === 'Pix' ? 'active' : ''}" data-pay="Pix">PIX Direto</button>
                <button type="button" class="choice-btn ${state.checkoutPayment === 'Cartao' ? 'active' : ''}" data-pay="Cartao">Cartão (Maquininha)</button>
                <button type="button" class="choice-btn ${state.checkoutPayment === 'Dinheiro' ? 'active' : ''}" data-pay="Dinheiro">Dinheiro</button>
              </div>
              ${
                state.checkoutPayment === 'Dinheiro'
                  ? `<div class="form-group">
                      <label>Precisa de troco para quanto? (Opcional)</label>
                      <input type="number" step="0.01" id="chk-troco" value="${esc(state.checkoutTroco)}" placeholder="Ex: 100.00" />
                    </div>`
                  : state.checkoutPayment === 'Pix'
                  ? `<p style="font-size:13px;">A chave Pix da Mercearia Costa será exibida na confirmação do pedido.</p>`
                  : `<p style="font-size:13px;">Levamos a maquininha (débito/crédito) na entrega ou você passa no caixa na retirada.</p>`
              }
              <button type="button" class="btn-secondary mt-md" id="back-to-envio">← Voltar</button>`
            }
          </section>

          <aside class="surface-card">
            <h3>Resumo do Pedido</h3>
            <div class="summary-line mt-md"><span>Subtotal</span><span>${brl(subtotal)}</span></div>
            <div class="summary-line"><span>Frete</span><span style="color:#15803d;font-weight:700;">Grátis</span></div>
            ${descontoCupom > 0 ? `<div class="summary-line"><span>Cupom (10%)</span><span>-${brl(descontoCupom)}</span></div>` : ''}
            <div class="cep-row mt-sm">
              <input type="text" id="cupom-input" value="${esc(state.checkoutCupom)}" placeholder="Cupom (ex: PRIMEIRACOMPRA)" />
              <button type="button" class="btn-secondary" id="apply-cupom-btn">Aplicar</button>
            </div>
            <div class="summary-total"><span>Total</span><span>${brl(total)}</span></div>
            <button type="button" class="btn-primary btn-block mt-md" id="checkout-next-btn">
              ${state.checkoutStep === 'pagamento' ? 'Confirmar Pedido' : 'Continuar'}
            </button>
          </aside>
        </div>
      </div>`;

    $('#apply-cupom-btn').addEventListener('click', () => {
      state.checkoutCupom = $('#cupom-input').value;
      renderCheckout();
    });

    if (state.checkoutStep === 'envio') {
      $('#chk-mode-entrega').addEventListener('click', () => {
        state.delivery.mode = 'Entrega';
        renderCheckout();
      });
      $('#chk-mode-retirada').addEventListener('click', () => {
        state.delivery.mode = 'Retirada';
        renderCheckout();
      });
      $('#back-to-cart').addEventListener('click', () => {
        state.checkoutStep = 'carrinho';
        renderCheckout();
      });
    }

    if (state.checkoutStep === 'pagamento') {
      document.querySelectorAll('[data-pay]').forEach((btn) =>
        btn.addEventListener('click', () => {
          state.checkoutPayment = btn.dataset.pay;
          renderCheckout();
        })
      );
      const trocoEl = $('#chk-troco');
      if (trocoEl) trocoEl.addEventListener('input', (e) => (state.checkoutTroco = e.target.value));
      $('#back-to-envio').addEventListener('click', () => {
        state.checkoutStep = 'envio';
        renderCheckout();
      });
    }

    $('#checkout-next-btn').addEventListener('click', async () => {
      if (state.checkoutStep === 'carrinho') {
        if (!state.user) {
          toast('Entre ou crie sua conta antes de finalizar o pedido (RF11).');
          location.hash = '#login';
          return;
        }
        state.checkoutStep = 'envio';
        renderCheckout();
        return;
      }
      if (state.checkoutStep === 'envio') {
        if (state.delivery.mode === 'Entrega') {
          state.delivery.cep = $('#chk-cep').value;
          state.delivery.address = $('#chk-address').value.trim();
          if (!state.delivery.address) return toast('Informe seu endereço de entrega.', true);
          localStorage.setItem('mc_delivery', JSON.stringify(state.delivery));
          updateHeaderState();
        }
        state.obsTemp = $('#chk-obs').value;
        state.checkoutStep = 'pagamento';
        renderCheckout();
        return;
      }
      // Finalizar pedido no backend
      try {
        const res = await API.post('/api/pedidos', {
          itens: state.cart.map((c) => ({ id_produto: c.id_produto, quantidade: c.quantidade })),
          tipo_recebimento: state.delivery.mode,
          endereco_entrega: state.delivery.address,
          cep_entrega: state.delivery.cep,
          metodo_pagamento: state.checkoutPayment,
          troco_para: state.checkoutTroco || null,
          cupom: state.checkoutCupom,
          observacoes: state.obsTemp || null,
        });
        state.lastOrderResult = res;
        state.cart = [];
        saveCart();
        state.checkoutStep = 'concluido';
        renderCheckout();
      } catch (err) {
        toast(err.message, true);
      }
    });
  }

  // MEUS PEDIDOS & CONFIGURACOES (RF9.3, RF12)
  async function renderMeusPedidos() {
    if (!state.user) return (location.hash = '#login');
    const { pedidos } = await API.get('/api/pedidos/meus');
    $('#app-root').innerHTML = `
      <div class="container">
        <div class="section-header left">
          <h2 class="section-title">Meus Pedidos</h2>
          <button type="button" class="btn-secondary" id="logout-btn">Sair da Conta</button>
        </div>
        ${
          pedidos.length === 0
            ? '<div class="surface-card">Você ainda não realizou nenhum pedido.</div>'
            : pedidos
                .map(
                  (p) => `
              <article class="surface-card mt-md">
                <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;">
                  <div>
                    <strong>Pedido #${p.id_pedido}</strong> • ${new Date(p.data_pedido).toLocaleString('pt-BR')}
                    <div style="font-size:13px;color:var(--text-muted);">${esc(p.tipo_recebimento)} — ${esc(p.endereco_entrega)}</div>
                  </div>
                  <div style="text-align:right;">
                    <span class="status-pill status-${esc(p.status)}">${esc(p.status)}</span>
                    <div style="font-weight:800;font-size:18px;color:var(--brand-red);">${brl(p.valor_total)}</div>
                  </div>
                </div>
                <ul class="mt-sm" style="padding-left:18px;font-size:13px;">
                  ${(p.itens || []).map((it) => `<li>${it.quantidade}x ${esc(it.nome)} — ${brl(it.subtotal)}</li>`).join('')}
                </ul>
                ${
                  p.status === 'Pendente'
                    ? `<button type="button" class="btn-danger mt-sm" data-cancel-order="${p.id_pedido}">Cancelar Pedido</button>`
                    : ''
                }
              </article>`
                )
                .join('')
        }
      </div>`;

    $('#logout-btn').addEventListener('click', logoutUser);
    document.querySelectorAll('[data-cancel-order]').forEach((b) =>
      b.addEventListener('click', async () => {
        try {
          await API.post(`/api/pedidos/${b.dataset.cancelOrder}/cancelar`, {});
          toast('Pedido cancelado e estoque restaurado.');
          renderMeusPedidos();
        } catch (err) {
          toast(err.message, true);
        }
      })
    );
  }

  function renderConfiguracoes() {
    $('#app-root').innerHTML = `
      <div class="container">
        <h2 class="section-title">Configurações & Sobre</h2>
        <div class="auth-grid mt-md">
          <section class="surface-card">
            <h3>Perfil do Usuário</h3>
            ${
              state.user
                ? `<form id="profile-form" class="mt-md">
                    <div class="form-group"><label>Nome</label><input type="text" id="prof-nome" value="${esc(state.user.nome)}" /></div>
                    <div class="form-group"><label>Telefone</label><input type="text" id="prof-tel" value="${esc(state.user.telefone || '')}" /></div>
                    <div class="form-group"><label>Endereço padrão</label><input type="text" id="prof-end" value="${esc(state.user.endereco || '')}" /></div>
                    <button type="submit" class="btn-primary">Salvar Dados</button>
                    <button type="button" class="btn-secondary" id="cfg-logout-btn">Sair</button>
                  </form>`
                : `<p class="mt-md">Você está navegando como visitante. <a href="#login" style="color:var(--brand-red);font-weight:700;">Faça login ou registre-se</a>.</p>`
            }
          </section>
          <section class="surface-card">
            <h3>Mercearia Costa & LGPD</h3>
            <p class="mt-sm" style="font-size:13px;line-height:1.6;color:var(--text-muted);">
              <strong>Endereço:</strong> Rua Antônio Joaquim, 28, Bairro Cônego Ricardo, Pocrane - MG | CEP 36.960-000<br/>
              <strong>Telefone:</strong> (33) 3316-1580 | <strong>CNPJ:</strong> 02.387.358/0001-44<br/>
              <strong>Termos & Privacidade (LGPD - Lei nº 13.709):</strong> Coletamos apenas dados essenciais de perfil e endereço para entrega. Nenhuma senha é salva em texto puro (Bcrypt) e nenhum dado de cartão é armazenado no sistema.
            </p>
          </section>
        </div>
      </div>`;

    if (state.user) {
      $('#cfg-logout-btn').addEventListener('click', logoutUser);
      $('#profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await API.put('/api/auth/profile', {
            nome: $('#prof-nome').value,
            telefone: $('#prof-tel').value,
            endereco: $('#prof-end').value,
          });
          state.user.nome = $('#prof-nome').value;
          state.user.telefone = $('#prof-tel').value;
          state.user.endereco = $('#prof-end').value;
          updateHeaderState();
          toast('Perfil atualizado!');
        } catch (err) {
          toast(err.message, true);
        }
      });
    }
  }

  // PAINEL ADM (Caixa/Dono - Figma ADM Painel, Pedidos, Produtos, Clientes)
  async function renderAdmin() {
    if (!state.user || state.user.tipo_usuario !== 'CaixaDono') {
      toast('Acesso restrito ao Caixa/Dono.', true);
      return (location.hash = '#login');
    }

    const root = $('#app-root');
    root.innerHTML = `
      <div class="container">
        <div class="adm-layout">
          <aside class="adm-sidebar">
            <button type="button" class="adm-nav-btn ${state.admTab === 'painel' ? 'active' : ''}" data-adm-tab="painel">PAINEL</button>
            <button type="button" class="adm-nav-btn ${state.admTab === 'pedidos' ? 'active' : ''}" data-adm-tab="pedidos">PEDIDOS</button>
            <button type="button" class="adm-nav-btn ${state.admTab === 'produtos' ? 'active' : ''}" data-adm-tab="produtos">PRODUTOS</button>
            <button type="button" class="adm-nav-btn ${state.admTab === 'clientes' ? 'active' : ''}" data-adm-tab="clientes">CLIENTES</button>
            <button type="button" class="adm-nav-btn" id="adm-logout">SAIR</button>
          </aside>
          <section id="adm-content" class="surface-card">Carregando...</section>
        </div>
      </div>`;

    document.querySelectorAll('[data-adm-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        state.admTab = b.dataset.admTab;
        renderAdmin();
      })
    );
    $('#adm-logout').addEventListener('click', logoutUser);

    const content = $('#adm-content');

    if (state.admTab === 'painel') {
      const r = await API.get(`/api/admin/resumo?periodo=${state.admPeriodo}`);
      content.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <h2 class="section-title">PAINEL</h2>
          <select id="adm-periodo-sel" class="input-full" style="width:auto;">
            <option value="todos" ${state.admPeriodo === 'todos' ? 'selected' : ''}>Todo período</option>
            <option value="hoje" ${state.admPeriodo === 'hoje' ? 'selected' : ''}>Hoje</option>
            <option value="semana" ${state.admPeriodo === 'semana' ? 'selected' : ''}>Últimos 7 dias</option>
            <option value="mes" ${state.admPeriodo === 'mes' ? 'selected' : ''}>Últimos 30 dias</option>
          </select>
        </div>
        <div class="kpi-grid mt-md">
          <div class="kpi-card">
            <strong>ENTREGAS CONCLUÍDAS</strong>
            <div class="kpi-value">${r.entregas}</div>
            <small>Total de pedidos: ${r.total_pedidos}</small>
          </div>
          <div class="kpi-card">
            <strong>RECEITA</strong>
            <div class="kpi-value">${brl(r.receita_total)}</div>
            <div style="font-size:12px;display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:8px;">
              <span>DINHEIRO: <strong>${brl(r.receita_por_metodo.Dinheiro)}</strong></span>
              <span>CARTÃO: <strong>${brl(r.receita_por_metodo.Cartao)}</strong></span>
              <span>PIX: <strong>${brl(r.receita_por_metodo.Pix)}</strong></span>
              <span>À PRAZO: <strong>${brl(r.receita_por_metodo['A Prazo'])}</strong></span>
            </div>
          </div>
        </div>
        <div class="auth-grid">
          <div class="surface-card">
            <h3>PEDIDOS PENDENTES</h3>
            ${
              r.pendentes.length === 0
                ? '<p class="mt-sm">Nenhum pedido pendente.</p>'
                : r.pendentes
                    .map(
                      (p) => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-color);">
                        <div><strong>#${p.id_pedido} ${esc(p.cliente_nome)}</strong><br/><small>${esc(p.endereco_entrega)}</small></div>
                        <div style="text-align:right;"><strong>${brl(p.valor_total)}</strong><br/><span class="status-pill status-${esc(p.status)}">${esc(p.status)}</span></div>
                      </div>`
                    )
                    .join('')
            }
          </div>
          <div class="surface-card">
            <h3>ÚLTIMAS ENTREGAS</h3>
            ${
              r.ultimas_entregas.length === 0
                ? '<p class="mt-sm">Sem entregas concluídas.</p>'
                : r.ultimas_entregas
                    .map(
                      (p) => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-color);">
                        <div><strong>${esc(p.cliente_nome)}</strong><br/><small>${esc(p.endereco_entrega)}</small></div>
                        <strong>${brl(p.valor_total)}</strong>
                      </div>`
                    )
                    .join('')
            }
          </div>
        </div>`;
      $('#adm-periodo-sel').addEventListener('change', (e) => {
        state.admPeriodo = e.target.value;
        renderAdmin();
      });
    } else if (state.admTab === 'pedidos') {
      const [{ pedidos }, { entregadores }] = await Promise.all([
        API.get(`/api/admin/pedidos?status=${encodeURIComponent(state.admOrderFilter)}`),
        API.get('/api/admin/entregadores'),
      ]);
      content.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <h2 class="section-title">PEDIDOS</h2>
          <select id="adm-order-status-filter" class="input-full" style="width:auto;">
            <option value="TODOS" ${state.admOrderFilter === 'TODOS' ? 'selected' : ''}>Todos os status</option>
            <option value="Pendente" ${state.admOrderFilter === 'Pendente' ? 'selected' : ''}>Pendente</option>
            <option value="Confirmado" ${state.admOrderFilter === 'Confirmado' ? 'selected' : ''}>Confirmado</option>
            <option value="Em rota" ${state.admOrderFilter === 'Em rota' ? 'selected' : ''}>Em rota</option>
            <option value="Concluido" ${state.admOrderFilter === 'Concluido' ? 'selected' : ''}>Concluído</option>
            <option value="Cancelado" ${state.admOrderFilter === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
          </select>
        </div>
        <div class="table-wrap mt-md">
          <table class="data-table">
            <thead>
              <tr><th>ID</th><th>Situação</th><th>Cliente</th><th>Endereço</th><th>Pagamento</th><th>Total</th><th>Entregador / Ação</th></tr>
            </thead>
            <tbody>
              ${pedidos
                .map(
                  (p) => `
                <tr>
                  <td>#${p.id_pedido}</td>
                  <td>
                    <select class="adm-set-status" data-id="${p.id_pedido}">
                      ${['Pendente', 'Confirmado', 'Em rota', 'Concluido', 'Cancelado']
                        .map((st) => `<option value="${st}" ${p.status === st ? 'selected' : ''}>${st}</option>`)
                        .join('')}
                    </select>
                  </td>
                  <td><strong>${esc(p.cliente_nome)}</strong><br/><small>${esc(p.cliente_telefone || '')}</small></td>
                  <td>${esc(p.endereco_entrega)}</td>
                  <td>${esc(p.metodo_pagamento || '-')}</td>
                  <td><strong>${brl(p.valor_total)}</strong></td>
                  <td>
                    <select class="adm-set-driver" data-id="${p.id_pedido}">
                      <option value="">Sem entregador</option>
                      ${entregadores
                        .map((e) => `<option value="${e.id_entregador}" ${p.id_entregador === e.id_entregador ? 'selected' : ''}>${esc(e.nome)}</option>`)
                        .join('')}
                    </select>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`;

      $('#adm-order-status-filter').addEventListener('change', (e) => {
        state.admOrderFilter = e.target.value;
        renderAdmin();
      });
      document.querySelectorAll('.adm-set-status').forEach((sel) =>
        sel.addEventListener('change', async () => {
          try {
            await API.put(`/api/admin/pedidos/${sel.dataset.id}`, { status: sel.value });
            toast('Status do pedido atualizado!');
          } catch (err) {
            toast(err.message, true);
          }
        })
      );
      document.querySelectorAll('.adm-set-driver').forEach((sel) =>
        sel.addEventListener('change', async () => {
          try {
            await API.put(`/api/admin/pedidos/${sel.dataset.id}`, { id_entregador: sel.value || null });
            toast('Entregador atribuído!');
          } catch (err) {
            toast(err.message, true);
          }
        })
      );
    } else if (state.admTab === 'produtos') {
      const { produtos } = await API.get('/api/produtos?incluirInativos=true');
      content.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <h2 class="section-title">PRODUTOS</h2>
          <button type="button" class="btn-primary" id="adm-new-prod-btn">+ Novo Produto</button>
        </div>
        <div id="adm-prod-form-box" class="surface-card mt-md" hidden>
          <h3 id="adm-prod-form-title">Novo Produto</h3>
          <form id="adm-prod-form" class="mt-sm">
            <input type="hidden" id="fp-id" />
            <div class="auth-grid">
              <div class="form-group"><label>Nome *</label><input type="text" id="fp-nome" required /></div>
              <div class="form-group"><label>Categoria *</label>
                <select id="fp-cat">${CATEGORIES.map((c) => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('')}</select>
              </div>
              <div class="form-group"><label>Preço (R$) *</label><input type="number" step="0.01" id="fp-preco" required /></div>
              <div class="form-group"><label>Estoque *</label><input type="number" id="fp-estoque" required /></div>
              <div class="form-group"><label>Desconto (%)</label><input type="number" step="0.01" id="fp-desconto" value="0" /></div>
              <div class="form-group"><label>Medida</label><select id="fp-medida"><option value="UNIDADE">UNIDADE</option><option value="KG">KG</option></select></div>
              <div class="form-group"><label>URL da Imagem</label><input type="text" id="fp-img" value="/assets/logo-mercearia-costa.png" /></div>
              <div class="form-group"><label>Descrição</label><input type="text" id="fp-desc" /></div>
            </div>
            <label style="display:inline-flex;gap:8px;align-items:center;margin-right:16px;"><input type="checkbox" id="fp-oferta" /> Exibir em Ofertas da Semana</label>
            <label style="display:inline-flex;gap:8px;align-items:center;"><input type="checkbox" id="fp-vendido" /> Exibir em Mais Vendidos</label>
            <div class="mt-md">
              <button type="submit" class="btn-primary">Salvar Produto</button>
              <button type="button" class="btn-secondary" id="fp-cancel">Cancelar</button>
            </div>
          </form>
        </div>
        <div class="table-wrap mt-md">
          <table class="data-table">
            <thead>
              <tr><th>ID</th><th>Produto</th><th>Categoria</th><th>Estoque</th><th>Medida</th><th>Preço</th><th>Ações</th></tr>
            </thead>
            <tbody>
              ${produtos
                .map(
                  (p) => `
                <tr>
                  <td>${p.id_produto}</td>
                  <td><strong>${esc(p.nome)}</strong>${p.status === 'Inativo' ? ' <small>(Inativo)</small>' : ''}</td>
                  <td>${esc(p.categoria)}</td>
                  <td>${p.estoque}</td>
                  <td>${esc(p.medida)}</td>
                  <td>${brl(p.preco)}</td>
                  <td style="white-space:nowrap;">
                    <button type="button" class="btn-secondary adm-edit-prod" data-id="${p.id_produto}">Editar</button>
                    <button type="button" class="btn-danger adm-del-prod" data-id="${p.id_produto}">Excluir</button>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`;

      const formBox = $('#adm-prod-form-box');
      $('#adm-new-prod-btn').addEventListener('click', () => {
        $('#fp-id').value = '';
        $('#adm-prod-form').reset();
        $('#fp-img').value = '/assets/logo-mercearia-costa.png';
        $('#adm-prod-form-title').textContent = 'Novo Produto';
        formBox.hidden = false;
      });
      $('#fp-cancel').addEventListener('click', () => (formBox.hidden = true));

      document.querySelectorAll('.adm-edit-prod').forEach((b) =>
        b.addEventListener('click', () => {
          const p = produtos.find((x) => x.id_produto === Number(b.dataset.id));
          if (!p) return;
          $('#fp-id').value = p.id_produto;
          $('#fp-nome').value = p.nome;
          $('#fp-cat').value = p.categoria;
          $('#fp-preco').value = p.preco;
          $('#fp-estoque').value = p.estoque;
          $('#fp-desconto').value = p.desconto;
          $('#fp-medida').value = p.medida;
          $('#fp-img').value = p.imagem_url || '';
          $('#fp-desc').value = p.descricao || '';
          $('#fp-oferta').checked = Boolean(p.oferta);
          $('#fp-vendido').checked = Boolean(p.mais_vendido);
          $('#adm-prod-form-title').textContent = `Editar Produto #${p.id_produto}`;
          formBox.hidden = false;
        })
      );

      document.querySelectorAll('.adm-del-prod').forEach((b) =>
        b.addEventListener('click', async () => {
          if (!confirm('Remover este produto do catálogo?')) return;
          try {
            await API.del(`/api/produtos/${b.dataset.id}`);
            toast('Produto removido!');
            renderAdmin();
          } catch (err) {
            toast(err.message, true);
          }
        })
      );

      $('#adm-prod-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = $('#fp-id').value;
        const payload = {
          nome: $('#fp-nome').value,
          categoria: $('#fp-cat').value,
          preco: Number($('#fp-preco').value),
          estoque: Number($('#fp-estoque').value),
          desconto: Number($('#fp-desconto').value || 0),
          medida: $('#fp-medida').value,
          imagem_url: $('#fp-img').value,
          descricao: $('#fp-desc').value,
          oferta: $('#fp-oferta').checked,
          mais_vendido: $('#fp-vendido').checked,
        };
        try {
          if (id) await API.put(`/api/produtos/${id}`, payload);
          else await API.post('/api/produtos', payload);
          toast('Produto salvo com sucesso!');
          renderAdmin();
        } catch (err) {
          toast(err.message, true);
        }
      });
    } else if (state.admTab === 'clientes') {
      const { clientes } = await API.get('/api/admin/clientes');
      content.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <h2 class="section-title">CLIENTES</h2>
          <button type="button" class="btn-primary" id="adm-new-cli-btn">+ Novo Cliente</button>
        </div>
        <div id="adm-cli-form-box" class="surface-card mt-md" hidden>
          <h3>Novo Cliente</h3>
          <form id="adm-cli-form" class="mt-sm">
            <div class="auth-grid">
              <div class="form-group"><label>Nome *</label><input type="text" id="fc-nome" required /></div>
              <div class="form-group"><label>Email *</label><input type="email" id="fc-email" required /></div>
              <div class="form-group"><label>Telefone</label><input type="text" id="fc-tel" /></div>
              <div class="form-group"><label>Endereço *</label><input type="text" id="fc-end" required /></div>
            </div>
            <button type="submit" class="btn-primary">Cadastrar Cliente</button>
            <button type="button" class="btn-secondary" id="fc-cancel">Cancelar</button>
          </form>
        </div>
        <div class="table-wrap mt-md">
          <table class="data-table">
            <thead>
              <tr><th>ID</th><th>Cliente</th><th>Telefone</th><th>Endereço</th><th>Pedidos</th><th>Total Gasto</th></tr>
            </thead>
            <tbody>
              ${clientes
                .map(
                  (c) => `
                <tr>
                  <td>${c.id_cliente}</td>
                  <td><strong>${esc(c.nome)}</strong><br/><small>${esc(c.email)}</small></td>
                  <td>${esc(c.telefone || '-')}</td>
                  <td>${esc(c.endereco)}</td>
                  <td>${c.total_pedidos}</td>
                  <td><strong>${brl(c.total_gasto)}</strong></td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`;

      $('#adm-new-cli-btn').addEventListener('click', () => ($('#adm-cli-form-box').hidden = false));
      $('#fc-cancel').addEventListener('click', () => ($('#adm-cli-form-box').hidden = true));
      $('#adm-cli-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await API.post('/api/admin/clientes', {
            nome: $('#fc-nome').value,
            email: $('#fc-email').value,
            telefone: $('#fc-tel').value,
            endereco: $('#fc-end').value,
          });
          toast('Cliente cadastrado!');
          renderAdmin();
        } catch (err) {
          toast(err.message, true);
        }
      });
    }
  }

  // AREA DO ENTREGADOR (RF13, RF14)
  async function renderEntregador() {
    if (!state.user || !['Entregador', 'CaixaDono'].includes(state.user.tipo_usuario)) {
      toast('Acesso restrito ao Entregador.', true);
      return (location.hash = '#login');
    }
    const { entregas } = await API.get('/api/entregador/entregas');
    $('#app-root').innerHTML = `
      <div class="container">
        <div class="section-header left">
          <h2 class="section-title">Área do Entregador — Rotas e Entregas</h2>
          <button type="button" class="btn-secondary" id="ent-logout-btn">Sair</button>
        </div>
        ${
          entregas.length === 0
            ? '<div class="surface-card">Nenhuma entrega atribuída no momento.</div>'
            : entregas
                .map((e) => {
                  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    e.endereco_entrega
                  )}`;
                  return `
                    <article class="surface-card mt-md">
                      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;">
                        <div>
                          <span class="status-pill status-${esc(e.status_entrega)}">${esc(e.status_entrega)}</span>
                          <h3 class="mt-sm">Pedido #${e.id_pedido} — ${esc(e.cliente_nome)}</h3>
                          <p><strong>Endereço:</strong> ${esc(e.endereco_entrega)} ${e.cep_entrega ? `(CEP: ${esc(e.cep_entrega)})` : ''}</p>
                          <p style="font-size:13px;color:var(--text-muted);">
                            Telefone: ${esc(e.cliente_telefone || 'Não informado')} • Pagamento: <strong>${esc(e.metodo_pagamento || '-')}</strong>
                            ${e.troco_para ? `(Troco p/ ${brl(e.troco_para)})` : ''} • Total: <strong>${brl(e.valor_total)}</strong>
                          </p>
                        </div>
                        <div style="display:flex;flex-direction:column;gap:8px;justify-content:center;">
                          <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn-secondary" style="text-align:center;">📍 Abrir Rota no Mapa</a>
                          ${
                            e.status_entrega === 'Pendente'
                              ? `<button type="button" class="btn-primary" data-ent-status="${e.id_entrega}" data-next="Em rota de entrega">Iniciar Entrega</button>`
                              : ''
                          }
                          ${
                            e.status_entrega !== 'Concluido'
                              ? `<button type="button" class="btn-whatsapp" data-ent-status="${e.id_entrega}" data-next="Concluido">Confirmar Entrega</button>`
                              : ''
                          }
                        </div>
                      </div>
                    </article>`;
                })
                .join('')
        }
      </div>`;

    $('#ent-logout-btn').addEventListener('click', logoutUser);
    document.querySelectorAll('[data-ent-status]').forEach((b) =>
      b.addEventListener('click', async () => {
        try {
          await API.put(`/api/entregador/entregas/${b.dataset.entStatus}`, {
            status_entrega: b.dataset.next,
          });
          toast(`Status atualizado para "${b.dataset.next}"!`);
          renderEntregador();
        } catch (err) {
          toast(err.message, true);
        }
      })
    );
  }

  async function logoutUser() {
    await API.post('/api/auth/logout', {}).catch(() => {});
    state.user = null;
    updateHeaderState();
    toast('Você saiu da sua conta.');
    location.hash = '#home';
  }

  // EVENTOS GLOBAIS & ROTEAMENTO
  function bindGlobalEvents() {
    // Busca por texto e voz
    $('#search-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = $('#search-input').value.trim();
      location.hash = q ? `#busca/${encodeURIComponent(q)}` : '#catalogo';
    });

    $('#voice-search-btn').addEventListener('click', () => {
      const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Rec) return toast('Seu navegador não suporta pesquisa por voz.', true);
      const rec = new Rec();
      rec.lang = 'pt-BR';
      toast('Fale o nome do produto...');
      rec.onresult = (ev) => {
        const text = ev.results[0][0].transcript;
        $('#search-input').value = text;
        location.hash = `#busca/${encodeURIComponent(text)}`;
      };
      rec.start();
    });

    // Modais e Drawer
    $('#delivery-mode-btn').addEventListener('click', () => ($('#delivery-modal').hidden = false));
    $('#mode-entrega-btn').addEventListener('click', () => {
      state.delivery.mode = 'Entrega';
      $('#mode-entrega-btn').classList.add('active');
      $('#mode-retirada-btn').classList.remove('active');
      $('#cep-box').hidden = false;
    });
    $('#mode-retirada-btn').addEventListener('click', () => {
      state.delivery.mode = 'Retirada';
      $('#mode-retirada-btn').classList.add('active');
      $('#mode-entrega-btn').classList.remove('active');
      $('#cep-box').hidden = true;
      localStorage.setItem('mc_delivery', JSON.stringify(state.delivery));
      updateHeaderState();
      $('#delivery-modal').hidden = true;
    });
    $('#save-cep-btn').addEventListener('click', () => {
      state.delivery.cep = $('#cep-input').value.trim() || state.delivery.cep;
      const addr = $('#quick-address-input').value.trim();
      if (addr) state.delivery.address = addr;
      localStorage.setItem('mc_delivery', JSON.stringify(state.delivery));
      updateHeaderState();
      $('#delivery-modal').hidden = true;
      toast('Endereço atualizado!');
    });

    $('#cart-open-btn').addEventListener('click', () => {
      renderCartDrawer();
      $('#cart-drawer').hidden = false;
    });
    $('#go-checkout-btn').addEventListener('click', () => {
      $('#cart-drawer').hidden = true;
      state.checkoutStep = 'carrinho';
      location.hash = '#checkout';
    });
    $('#user-menu-btn').addEventListener('click', () => {
      if (!state.user) location.hash = '#login';
      else if (state.user.tipo_usuario === 'CaixaDono') location.hash = '#adm';
      else if (state.user.tipo_usuario === 'Entregador') location.hash = '#entregador';
      else location.hash = '#meus-pedidos';
    });

    document.querySelectorAll('[data-close]').forEach((btn) =>
      btn.addEventListener('click', () => {
        $(`#${btn.dataset.close}`).hidden = true;
      })
    );

    // Delegacao de cliques para cards, categorias, banners e carrinho
    document.body.addEventListener('click', (e) => {
      const t = e.target.closest('[data-banner],[data-cat],[data-open-product],[data-card-dec],[data-card-inc],[data-card-buy],[data-cart-dec],[data-cart-inc],[data-cart-rm]');
      if (!t) return;

      if (t.dataset.banner !== undefined) {
        state.bannerIndex = Number(t.dataset.banner);
        $('#hero-banner-img').src = BANNERS[state.bannerIndex].src;
        document.querySelectorAll('.hero-dot').forEach((d, idx) => d.classList.toggle('active', idx === state.bannerIndex));
      } else if (t.dataset.cat) {
        location.hash = `#categoria/${encodeURIComponent(t.dataset.cat)}`;
      } else if (t.dataset.openProduct) {
        location.hash = `#produto/${t.dataset.openProduct}`;
      } else if (t.dataset.cardDec || t.dataset.cardInc) {
        const id = Number(t.dataset.cardDec || t.dataset.cardInc);
        const span = $(`#card-qty-${id}`);
        const prod = state.produtos.find((p) => p.id_produto === id);
        if (!span || !prod) return;
        let q = Number(span.textContent);
        q = t.dataset.cardDec ? Math.max(1, q - 1) : Math.min(prod.estoque, q + 1);
        span.textContent = q;
      } else if (t.dataset.cardBuy) {
        const id = Number(t.dataset.cardBuy);
        const prod = state.produtos.find((p) => p.id_produto === id);
        const q = Number($(`#card-qty-${id}`)?.textContent || 1);
        addToCart(prod, q);
      } else if (t.dataset.cartDec) {
        updateCartQty(Number(t.dataset.cartDec), -1);
      } else if (t.dataset.cartInc) {
        updateCartQty(Number(t.dataset.cartInc), 1);
      } else if (t.dataset.cartRm) {
        const id = Number(t.dataset.cartRm);
        state.cart = state.cart.filter((i) => i.id_produto !== id);
        saveCart();
        renderCartDrawer();
        if (location.hash.startsWith('#checkout')) renderCheckout();
      }
    });
  }

  async function router() {
    clearInterval(state.pollTimer);
    const hash = location.hash || '#home';

    document.querySelectorAll('.sub-nav-link').forEach((a) => {
      a.classList.toggle('active', hash === a.getAttribute('href'));
    });

    if (hash === '#home') {
      await renderHome();
    } else if (hash === '#ofertas') {
      await renderCatalog({ oferta: true });
    } else if (hash === '#catalogo') {
      await renderCatalog({});
    } else if (hash.startsWith('#categoria/')) {
      await renderCatalog({ categoria: decodeURIComponent(hash.slice('#categoria/'.length)) });
    } else if (hash.startsWith('#busca/')) {
      await renderCatalog({ busca: decodeURIComponent(hash.slice('#busca/'.length)) });
    } else if (hash.startsWith('#produto/')) {
      await renderProductDetail(hash.slice('#produto/'.length));
    } else if (hash === '#login') {
      renderAuth();
    } else if (hash === '#checkout') {
      renderCheckout();
    } else if (hash === '#meus-pedidos') {
      await renderMeusPedidos();
    } else if (hash === '#configuracoes') {
      renderConfiguracoes();
    } else if (hash === '#adm') {
      await renderAdmin();
      state.pollTimer = setInterval(() => {
        if (location.hash === '#adm' && state.admTab === 'painel') renderAdmin();
      }, 15000);
    } else if (hash === '#entregador') {
      await renderEntregador();
      state.pollTimer = setInterval(() => {
        if (location.hash === '#entregador') renderEntregador();
      }, 15000);
    } else {
      await renderHome();
    }
  }

  async function init() {
    initTheme();
    bindGlobalEvents();
    await bootstrapAuth();
    window.addEventListener('hashchange', router);
    await router();
  }

  init();
})();
