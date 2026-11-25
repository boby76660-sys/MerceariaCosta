-- Schema oficial do MVP Mercearia Costa (MySQL / MariaDB)
-- Baseado no Dicionario de Dados (Secao 15) do Projeto PI - 1.2026

CREATE TABLE IF NOT EXISTS usuario (
  id_usuario INT NOT NULL AUTO_INCREMENT,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  tipo_usuario VARCHAR(20) NOT NULL DEFAULT 'Cliente',
  data_cadastro DATE NOT NULL,
  CONSTRAINT pk_usuario PRIMARY KEY (id_usuario),
  CONSTRAINT uq_usuario_email UNIQUE (email),
  CONSTRAINT chk_usuario_tipo CHECK (tipo_usuario IN ('Cliente', 'CaixaDono', 'Entregador'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cliente (
  id_cliente INT NOT NULL,
  telefone VARCHAR(20) NULL,
  endereco VARCHAR(150) NOT NULL DEFAULT 'A informar',
  cep VARCHAR(12) NULL,
  CONSTRAINT pk_cliente PRIMARY KEY (id_cliente),
  CONSTRAINT fk_cliente_usuario FOREIGN KEY (id_cliente) REFERENCES usuario(id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS caixa_dono (
  id_caixa_dono INT NOT NULL,
  cpf VARCHAR(14) NOT NULL,
  login_admin VARCHAR(50) NOT NULL,
  CONSTRAINT pk_caixa_dono PRIMARY KEY (id_caixa_dono),
  CONSTRAINT uq_caixa_dono_cpf UNIQUE (cpf),
  CONSTRAINT uq_caixa_dono_login UNIQUE (login_admin),
  CONSTRAINT fk_caixa_dono_usuario FOREIGN KEY (id_caixa_dono) REFERENCES usuario(id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS entregador (
  id_entregador INT NOT NULL,
  telefone VARCHAR(20) NULL,
  CONSTRAINT pk_entregador PRIMARY KEY (id_entregador),
  CONSTRAINT fk_entregador_usuario FOREIGN KEY (id_entregador) REFERENCES usuario(id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS produto (
  id_produto INT NOT NULL AUTO_INCREMENT,
  nome VARCHAR(100) NOT NULL,
  descricao VARCHAR(255) NULL,
  preco DECIMAL(10, 2) NOT NULL,
  preco_original DECIMAL(10, 2) NULL,
  estoque INT NOT NULL DEFAULT 0,
  categoria VARCHAR(50) NOT NULL,
  medida VARCHAR(20) NOT NULL DEFAULT 'UNIDADE',
  desconto DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  imagem_url VARCHAR(255) NULL,
  oferta TINYINT(1) NOT NULL DEFAULT 0,
  mais_vendido TINYINT(1) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'Ativo',
  CONSTRAINT pk_produto PRIMARY KEY (id_produto),
  CONSTRAINT chk_produto_preco CHECK (preco > 0),
  CONSTRAINT chk_produto_estoque CHECK (estoque >= 0),
  CONSTRAINT chk_produto_status CHECK (status IN ('Ativo', 'Inativo')),
  INDEX idx_produto_categoria (categoria)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS carrinho (
  id_carrinho INT NOT NULL AUTO_INCREMENT,
  id_cliente INT NOT NULL,
  data_criacao DATETIME NOT NULL,
  CONSTRAINT pk_carrinho PRIMARY KEY (id_carrinho),
  CONSTRAINT fk_carrinho_cliente FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS item_carrinho (
  id_carrinho INT NOT NULL,
  id_produto INT NOT NULL,
  quantidade INT NOT NULL,
  CONSTRAINT pk_item_carrinho PRIMARY KEY (id_carrinho, id_produto),
  CONSTRAINT fk_item_carrinho_carrinho FOREIGN KEY (id_carrinho) REFERENCES carrinho(id_carrinho) ON DELETE CASCADE,
  CONSTRAINT fk_item_carrinho_produto FOREIGN KEY (id_produto) REFERENCES produto(id_produto) ON DELETE CASCADE,
  CONSTRAINT chk_item_carrinho_qtd CHECK (quantidade > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pedido (
  id_pedido INT NOT NULL AUTO_INCREMENT,
  id_cliente INT NOT NULL,
  data_pedido DATETIME NOT NULL,
  valor_total DECIMAL(10, 2) NOT NULL,
  tipo_recebimento VARCHAR(20) NOT NULL DEFAULT 'Entrega',
  endereco_entrega VARCHAR(200) NULL,
  cep_entrega VARCHAR(12) NULL,
  status VARCHAR(25) NOT NULL DEFAULT 'Pendente',
  observacoes VARCHAR(255) NULL,
  CONSTRAINT pk_pedido PRIMARY KEY (id_pedido),
  CONSTRAINT fk_pedido_cliente FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente),
  CONSTRAINT chk_pedido_valor CHECK (valor_total > 0),
  CONSTRAINT chk_pedido_recebimento CHECK (tipo_recebimento IN ('Entrega', 'Retirada')),
  CONSTRAINT chk_pedido_status CHECK (status IN ('Pendente', 'Confirmado', 'Em rota', 'Concluido', 'Cancelado')),
  INDEX idx_pedido_cliente (id_cliente),
  INDEX idx_pedido_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS item_pedido (
  id_pedido INT NOT NULL,
  id_produto INT NOT NULL,
  quantidade INT NOT NULL,
  preco_unitario DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  CONSTRAINT pk_item_pedido PRIMARY KEY (id_pedido, id_produto),
  CONSTRAINT fk_item_pedido_pedido FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido) ON DELETE CASCADE,
  CONSTRAINT fk_item_pedido_produto FOREIGN KEY (id_produto) REFERENCES produto(id_produto),
  CONSTRAINT chk_item_pedido_qtd CHECK (quantidade > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pagamento (
  id_pagamento INT NOT NULL AUTO_INCREMENT,
  id_pedido INT NOT NULL,
  metodo_pagamento VARCHAR(30) NOT NULL,
  status_pagamento VARCHAR(20) NOT NULL DEFAULT 'Pendente',
  troco_para DECIMAL(10, 2) NULL,
  data_pagamento DATETIME NULL,
  CONSTRAINT pk_pagamento PRIMARY KEY (id_pagamento),
  CONSTRAINT fk_pagamento_pedido FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido) ON DELETE CASCADE,
  CONSTRAINT chk_pagamento_metodo CHECK (metodo_pagamento IN ('Dinheiro', 'Cartao', 'Pix', 'A Prazo')),
  CONSTRAINT chk_pagamento_status CHECK (status_pagamento IN ('Pendente', 'Aprovado', 'Recusado'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS entrega (
  id_entrega INT NOT NULL AUTO_INCREMENT,
  id_pedido INT NOT NULL,
  id_entregador INT NULL,
  endereco_entrega VARCHAR(200) NOT NULL,
  status_entrega VARCHAR(30) NOT NULL DEFAULT 'Pendente',
  data_entrega DATETIME NULL,
  CONSTRAINT pk_entrega PRIMARY KEY (id_entrega),
  CONSTRAINT fk_entrega_pedido FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido) ON DELETE CASCADE,
  CONSTRAINT fk_entrega_entregador FOREIGN KEY (id_entregador) REFERENCES entregador(id_entregador) ON DELETE SET NULL,
  CONSTRAINT chk_entrega_status CHECK (status_entrega IN ('Pendente', 'Em rota de entrega', 'Concluido')),
  INDEX idx_entrega_status (status_entrega)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
