# Mercearia Costa — MVP (E-Commerce e Gerenciamento)

Sistema web completo desenvolvido com base na documentação do Projeto Integrador (Unileste) e no protótipo do Figma.

## O que o sistema faz
- **Cliente / Visitante:** vitrine com busca por texto e voz, categorias, ofertas da semana, mais vendidos, detalhe do produto, carrinho de compras, escolha entre **Retirada na loja** ou **Entrega**, **Pagamento Direto com a Mercearia** (Pix, Cartão na maquininha ou Dinheiro com troco), envio de resumo pelo WhatsApp, acompanhamento de pedidos e **Modo Escuro**.
- **Caixa / Dono (`ADM`):** painel de entregas e receita por forma de pagamento, gestão de pedidos com atribuição de entregador, cadastro/edição/remoção de produtos e cadastro de clientes.
- **Entregador:** lista de entregas com endereço, link direto para o Google Maps e atualização de status (`Pendente` → `Em rota de entrega` → `Concluido`).

---

## Como rodar localmente (para testar no seu computador)
1. Copie `.env.example` para `.env`.
2. Abra o **XAMPP** e ligue o módulo **MySQL**.
3. Instale as dependências (se ainda não instalou):
   ```bash
   npm install
   ```
4. Crie as tabelas e os dados de demonstração no banco:
   ```bash
   npm run db:setup
   ```
5. Inicie o site:
   ```bash
   npm start
   ```
6. Abra no navegador: `http://localhost:3000`

### Contas de demonstração criadas pelo `db:setup`
- **Caixa / Dono (ADM):** `admin@merceariacosta.com.br` | Senha: `Mercearia@2026`
- **Entregador:** `entregador@merceariacosta.com.br` | Senha: `Entregador@2026`
- **Cliente de teste:** `sebastiao@exemplo.com` | Senha: `Cliente@2026`

*(Altere essas senhas antes de colocar o sistema para uso real!)*

---

## Como publicar online (GitHub + Vercel + Banco MySQL na nuvem)
1. **Crie um banco MySQL gratuito na nuvem** (ex.: **Aiven**, **TiDB Cloud** ou **Clever Cloud**) e anote `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` e `DB_NAME`.
2. **Crie as tabelas nesse banco na nuvem** rodando localmente uma vez com os dados desse banco no seu `.env`:
   ```bash
   npm run db:setup
   ```
3. **Suba esta pasta para um repositório no GitHub** (o arquivo `.env` já está protegido no `.gitignore` e não vai para o GitHub).
4. **Na Vercel**, clique em **Add New Project**, escolha o repositório do GitHub e preencha as **Environment Variables**:
   - `NODE_ENV=production`
   - `JWT_SECRET` (uma frase secreta longa)
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
   - `DB_SSL=true` (se o banco na nuvem exigir SSL)
   - `WHATSAPP_LOJA` e `CHAVE_PIX_LOJA`
5. Clique em **Deploy**.

---

## Como limpar os dados de teste quando a Mercearia Costa for usar de verdade
1. Execute o script [database/reset_prod.sql](database/reset_prod.sql) no seu banco MySQL.
2. Rode:
   ```bash
   node src/db/setup.js --prod
   ```
   Isso cria apenas a conta do **Caixa / Dono** (defina uma senha forte antes em `ADMIN_INIT_PASSWORD`), deixando produtos, clientes e pedidos zerados para o uso real.
