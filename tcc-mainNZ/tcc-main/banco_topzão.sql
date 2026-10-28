-- ============================================================
-- EXEMPLO COMPLETO SQLITE
-- ASSUNTOS:
-- 1. CREATE TABLE
-- 2. PRIMARY KEY
-- 3. FOREIGN KEY
-- 4. INSERT
-- 5. JOIN
-- 6. TRIGGERS
-- ============================================================




-- ============================================================
-- 0. ATIVANDO AS FOREIGN KEYS NO SQLITE
-- ============================================================

-- No SQLite, as chaves estrangeiras precisam ser ativadas.
PRAGMA foreign_keys = ON;



-- ============================================================
-- 1. APAGANDO AS TABELAS CASO JÁ EXISTAM
-- ============================================================

-- Isso serve apenas para permitir executar este arquivo
-- várias vezes sem dar erro.


DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS Log_Preco;
DROP TABLE IF EXISTS Item_Pedido;
DROP TABLE IF EXISTS Pedido;
DROP TABLE IF EXISTS Produto;
DROP TABLE IF EXISTS Cliente;



-- ============================================================
-- 2. CRIANDO A TABELA CLIENTE
-- ============================================================

CREATE TABLE Cliente (

    -- INTEGER PRIMARY KEY AUTOINCREMENT cria um ID automático.
    id_cliente INTEGER PRIMARY KEY AUTOINCREMENT,

    nome TEXT NOT NULL,

    email TEXT NOT NULL UNIQUE
);


-- ============================================================
-- TABELA DE USUÁRIOS DO LOGIN
-- ============================================================

CREATE TABLE usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'usuario',
    confirmado INTEGER DEFAULT 0
);

INSERT INTO usuarios (nome, email, senha, tipo)
VALUES ('Thomas', 'thomas@bellievie.org', '2110', 'gerente');

INSERT INTO usuarios (nome, email, senha, tipo)
VALUES ('Allany', 'allany@bellievie.org', '1210', 'gerente');

INSERT INTO usuarios (nome, email, senha, tipo)
VALUES ('Marco', 'marco@bellievie.org', '2112', 'usuario');

INSERT INTO usuarios (nome, email, senha, tipo)
VALUES ('Felipe', 'felipe@bellievie.org', '1802', 'usuario');

confirmado INTEGER DEFAULT 0

-- ============================================================
-- 3. CRIANDO A TABELA PRODUTO
-- ============================================================

CREATE TABLE Produto (

    id_produto INTEGER PRIMARY KEY AUTOINCREMENT,

    nome TEXT NOT NULL,

    -- REAL é usado para valores com casas decimais.
    preco REAL NOT NULL,

    estoque INTEGER NOT NULL DEFAULT 0
);



-- ============================================================
-- 4. CRIANDO A TABELA PEDIDO
-- ============================================================

CREATE TABLE Pedido (

    id_pedido INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Guarda qual cliente fez o pedido.
    id_cliente INTEGER NOT NULL,

    data_pedido TEXT NOT NULL,

    -- FOREIGN KEY liga Pedido com Cliente.
    FOREIGN KEY (id_cliente)
        REFERENCES Cliente(id_cliente)
);



-- ============================================================
-- 5. CRIANDO A TABELA ITEM_PEDIDO
-- ============================================================

-- Essa tabela representa os produtos que estão dentro
-- de cada pedido.

CREATE TABLE Item_Pedido (

    id_item INTEGER PRIMARY KEY AUTOINCREMENT,

    id_pedido INTEGER NOT NULL,

    id_produto INTEGER NOT NULL,

    quantidade INTEGER NOT NULL,

    -- Guarda o preço do produto no momento da compra.
    preco_unitario REAL NOT NULL,

    FOREIGN KEY (id_pedido)
        REFERENCES Pedido(id_pedido),

    FOREIGN KEY (id_produto)
        REFERENCES Produto(id_produto)
);



-- ============================================================
-- 6. TABELA DE LOG
-- ============================================================

-- Essa tabela será utilizada por uma TRIGGER.
--
-- Sempre que o preço de um produto mudar,
-- será salvo um histórico aqui.

CREATE TABLE Log_Preco (

    id_log INTEGER PRIMARY KEY AUTOINCREMENT,

    id_produto INTEGER NOT NULL,

    preco_antigo REAL,

    preco_novo REAL,

    data_alteracao TEXT NOT NULL
);



-- ============================================================
-- 7. INSERINDO CLIENTES
-- ============================================================

INSERT INTO Cliente (nome, email)
VALUES ('João', 'joao@email.com');

INSERT INTO Cliente (nome, email)
VALUES ('Maria', 'maria@email.com');

INSERT INTO Cliente (nome, email)
VALUES ('Carlos', 'carlos@email.com');



-- ============================================================
-- 8. INSERINDO PRODUTOS
-- ============================================================

INSERT INTO Produto (nome, preco, estoque)
VALUES ('Notebook', 3500.00, 10);

INSERT INTO Produto (nome, preco, estoque)
VALUES ('Mouse', 80.00, 50);

INSERT INTO Produto (nome, preco, estoque)
VALUES ('Teclado', 150.00, 30);

INSERT INTO Produto (nome, preco, estoque)
VALUES ('Monitor', 900.00, 20);

INSERT INTO Produto (nome, preco, estoque)
VALUES ('Webcam', 250.00, 15);



-- ============================================================
-- 9. INSERINDO PEDIDOS
-- ============================================================

-- João fez o pedido 1.
INSERT INTO Pedido (id_cliente, data_pedido)
VALUES (1, '2026-08-30');

-- Maria fez o pedido 2.
INSERT INTO Pedido (id_cliente, data_pedido)
VALUES (2, '2026-08-30');

-- João fez outro pedido.
INSERT INTO Pedido (id_cliente, data_pedido)
VALUES (1, '2026-08-31');



-- ============================================================
--                    TRIGGERS
-- ============================================================


-- ============================================================
-- TRIGGER 1
-- IMPEDIR UMA VENDA COM QUANTIDADE INVÁLIDA OU SEM ESTOQUE
-- ============================================================

-- BEFORE INSERT
--
-- Significa:
-- "ANTES de inserir um Item_Pedido, execute esta trigger."

CREATE TRIGGER TR_ValidarEstoque
BEFORE INSERT ON Item_Pedido

BEGIN

    -- NEW representa os dados que ESTÃO SENDO inseridos.
    --
    -- Exemplo:
    --
    -- INSERT INTO Item_Pedido (..., quantidade)
    -- VALUES (..., 5);
    --
    -- NEW.quantidade será 5.


    -- --------------------------------------------------------
    -- Verificando se a quantidade é válida
    -- --------------------------------------------------------

    SELECT CASE

        WHEN NEW.quantidade <= 0 THEN

            RAISE(
                ABORT,
                'ERRO: A quantidade deve ser maior que zero.'
            )

    END;


    -- --------------------------------------------------------
    -- Verificando se existe estoque suficiente
    -- --------------------------------------------------------

    SELECT CASE

        WHEN (
            SELECT estoque
            FROM Produto
            WHERE id_produto = NEW.id_produto
        ) < NEW.quantidade

        THEN

            RAISE(
                ABORT,
                'ERRO: Estoque insuficiente.'
            )

    END;

END;



-- ============================================================
-- TRIGGER 2
-- DIMINUIR ESTOQUE AUTOMATICAMENTE DEPOIS DE UMA VENDA
-- ============================================================

-- AFTER INSERT
--
-- Essa trigger acontece DEPOIS que um Item_Pedido é inserido.

CREATE TRIGGER TR_BaixarEstoque
AFTER INSERT ON Item_Pedido

BEGIN

    UPDATE Produto

    SET estoque = estoque - NEW.quantidade

    WHERE id_produto = NEW.id_produto;

END;



-- ============================================================
-- TRIGGER 3
-- DEVOLVER O ESTOQUE CASO UM ITEM DO PEDIDO SEJA EXCLUÍDO
-- ============================================================

-- Neste caso usamos OLD.
--
-- OLD representa os dados que existiam ANTES da exclusão.

CREATE TRIGGER TR_DevolverEstoque
AFTER DELETE ON Item_Pedido

BEGIN

    UPDATE Produto

    SET estoque = estoque + OLD.quantidade

    WHERE id_produto = OLD.id_produto;

END;



-- ============================================================
-- TRIGGER 4
-- CRIAR LOG QUANDO O PREÇO DE UM PRODUTO FOR ALTERADO
-- ============================================================

-- UPDATE OF preco
--
-- Significa que esta trigger somente será executada
-- quando a coluna "preco" for alterada.

CREATE TRIGGER TR_LogAlteracaoPreco
AFTER UPDATE OF preco ON Produto

BEGIN

    INSERT INTO Log_Preco
    (
        id_produto,
        preco_antigo,
        preco_novo,
        data_alteracao
    )

    VALUES
    (
        OLD.id_produto,

        -- OLD = valor antigo
        OLD.preco,

        -- NEW = valor novo
        NEW.preco,

        -- datetime('now') pega data e hora atual
        datetime('now')
    );

END;



-- ============================================================
-- 10. INSERINDO ITENS NOS PEDIDOS
-- ============================================================

-- IMPORTANTE:
--
-- Ao inserir esses itens, a TRIGGER TR_BaixarEstoque
-- será executada automaticamente.


-- Pedido 1 - João comprou 1 Notebook.
INSERT INTO Item_Pedido
(
    id_pedido,
    id_produto,
    quantidade,
    preco_unitario
)
VALUES
(
    1,
    1,
    1,
    3500.00
);


-- Pedido 1 - João comprou 2 Mouses.
INSERT INTO Item_Pedido
(
    id_pedido,
    id_produto,
    quantidade,
    preco_unitario
)
VALUES
(
    1,
    2,
    2,
    80.00
);


-- Pedido 2 - Maria comprou 1 Monitor.
INSERT INTO Item_Pedido
(
    id_pedido,
    id_produto,
    quantidade,
    preco_unitario
)
VALUES
(
    2,
    4,
    1,
    900.00
);


-- Pedido 3 - João comprou 1 Teclado.
INSERT INTO Item_Pedido
(
    id_pedido,
    id_produto,
    quantidade,
    preco_unitario
)
VALUES
(
    3,
    3,
    1,
    150.00
);



-- ============================================================
--                      JOIN
-- ============================================================


-- ============================================================
-- EXEMPLO 1
-- INNER JOIN ENTRE CLIENTE E PEDIDO
-- ============================================================

-- Queremos descobrir:
--
-- "Quem fez cada pedido?"
--
-- Pedido possui id_cliente.
-- Cliente também possui id_cliente.
--
-- Então fazemos a ligação:
--
-- Pedido.id_cliente = Cliente.id_cliente


SELECT
    Pedido.id_pedido,
    Cliente.nome,
    Pedido.data_pedido

FROM Pedido

INNER JOIN Cliente
    ON Pedido.id_cliente = Cliente.id_cliente;



-- ============================================================
-- O RESULTADO SERÁ ALGO PARECIDO COM:
-- ============================================================
--
-- id_pedido | nome  | data_pedido
-- --------------------------------
-- 1         | João  | 2026-08-30
-- 2         | Maria | 2026-08-30
-- 3         | João  | 2026-08-31
--



-- ============================================================
-- EXEMPLO 2
-- JOIN ENTRE 3 TABELAS
-- ============================================================

-- Agora queremos:
--
-- Cliente
-- Pedido
-- Produto
--
-- Para isso precisamos passar pela tabela Item_Pedido.


SELECT

    Cliente.nome AS cliente,

    Pedido.id_pedido,

    Produto.nome AS produto,

    Item_Pedido.quantidade,

    Item_Pedido.preco_unitario

FROM Pedido


-- Ligando Pedido com Cliente.
INNER JOIN Cliente
    ON Pedido.id_cliente = Cliente.id_cliente


-- Ligando Pedido com Item_Pedido.
INNER JOIN Item_Pedido
    ON Pedido.id_pedido = Item_Pedido.id_pedido


-- Ligando Item_Pedido com Produto.
INNER JOIN Produto
    ON Item_Pedido.id_produto = Produto.id_produto;



-- ============================================================
-- EXEMPLO 3
-- CALCULANDO O TOTAL DE CADA ITEM
-- ============================================================

SELECT

    Cliente.nome AS cliente,

    Produto.nome AS produto,

    Item_Pedido.quantidade,

    Item_Pedido.preco_unitario,

    -- quantidade * preço
    Item_Pedido.quantidade
        * Item_Pedido.preco_unitario AS total_item

FROM Pedido

INNER JOIN Cliente
    ON Pedido.id_cliente = Cliente.id_cliente

INNER JOIN Item_Pedido
    ON Pedido.id_pedido = Item_Pedido.id_pedido

INNER JOIN Produto
    ON Item_Pedido.id_produto = Produto.id_produto;



-- ============================================================
-- EXEMPLO 4
-- TOTAL DE CADA PEDIDO
-- ============================================================

-- SUM() soma os valores.
--
-- GROUP BY agrupa os registros que pertencem ao mesmo pedido.


SELECT

    Pedido.id_pedido,

    Cliente.nome AS cliente,

    SUM(
        Item_Pedido.quantidade
        * Item_Pedido.preco_unitario
    ) AS total_pedido

FROM Pedido

INNER JOIN Cliente
    ON Pedido.id_cliente = Cliente.id_cliente

INNER JOIN Item_Pedido
    ON Pedido.id_pedido = Item_Pedido.id_pedido

GROUP BY
    Pedido.id_pedido,
    Cliente.nome;



-- ============================================================
-- EXEMPLO 5
-- LEFT JOIN
-- ============================================================

-- O LEFT JOIN mostra TODOS os clientes,
-- mesmo aqueles que NÃO possuem pedidos.
--
-- Carlos não possui pedido.
--
-- Mesmo assim ele aparecerá no resultado.


SELECT

    Cliente.id_cliente,

    Cliente.nome,

    Pedido.id_pedido

FROM Cliente

LEFT JOIN Pedido
    ON Cliente.id_cliente = Pedido.id_cliente;



-- ============================================================
-- INNER JOIN x LEFT JOIN
-- ============================================================

-- INNER JOIN:
--
-- Só mostra registros que possuem correspondência
-- nas duas tabelas.
--
--
-- LEFT JOIN:
--
-- Mostra TODOS os registros da tabela da esquerda,
-- mesmo que não exista correspondência na tabela da direita.



-- ============================================================
-- EXEMPLO 6
-- MOSTRAR ESTOQUE ATUAL
-- ============================================================

-- Como alguns produtos já foram vendidos,
-- o estoque foi alterado automaticamente pelas triggers.

SELECT
    id_produto,
    nome,
    preco,
    estoque

FROM Produto;



-- ============================================================
-- TESTANDO A TRIGGER DE LOG
-- ============================================================

-- O Notebook atualmente custa 3500.
--
-- Vamos mudar para 3700.

UPDATE Produto

SET preco = 3700.00

WHERE id_produto = 1;



-- Agora olhamos a tabela de log.

SELECT *
FROM Log_Preco;



-- Deve aparecer aproximadamente:
--
-- id_log | id_produto | preco_antigo | preco_novo
-- ------------------------------------------------
-- 1      | 1          | 3500         | 3700
--



-- ============================================================
-- TESTANDO A TRIGGER DE DEVOLUÇÃO DE ESTOQUE
-- ============================================================

-- Antes da exclusão, podemos olhar o estoque:

SELECT *
FROM Produto
WHERE id_produto = 2;


-- Excluindo o item 2.
--
-- Esse item representa os 2 mouses que João comprou.

DELETE FROM Item_Pedido
WHERE id_item = 2;


-- A trigger TR_DevolverEstoque será executada.
--
-- Os 2 mouses voltarão automaticamente para o estoque.

SELECT *
FROM Produto
WHERE id_produto = 2;



-- ============================================================
-- TESTE DE ERRO
-- ============================================================

-- O estoque do Notebook é muito menor que 99999.
--
-- Portanto a trigger TR_ValidarEstoque bloquearia
-- esse INSERT.
--
-- O código está comentado para não interromper
-- a execução do arquivo inteiro.


/*

INSERT INTO Item_Pedido
(
    id_pedido,
    id_produto,
    quantidade,
    preco_unitario
)

VALUES
(
    1,
    1,
    99999,
    3700.00
);

*/


-- O SQLite retornaria:
--
-- ERRO: Estoque insuficiente.



-- ============================================================
-- RESUMO FINAL
-- ============================================================

-- INNER JOIN
-- ==========
-- Junta apenas registros que possuem correspondência.
--
--
-- LEFT JOIN
-- =========
-- Mostra todos os registros da tabela da esquerda,
-- mesmo quando não existe correspondência.
--
--
-- BEFORE INSERT
-- =============
-- Executa ANTES de inserir.
-- Ótimo para validações.
--
--
-- AFTER INSERT
-- ============
-- Executa DEPOIS de inserir.
-- Pode ser usado para atualizar outras tabelas.
--
--
-- AFTER UPDATE
-- ============
-- Executa depois de uma alteração.
--
--
-- AFTER DELETE
-- ============
-- Executa depois de uma exclusão.
--
--
-- NEW
-- ===
-- Representa os NOVOS valores.
--
-- Exemplo:
--
-- NEW.quantidade
-- NEW.preco
--
--
-- OLD
-- ===
-- Representa os valores ANTIGOS.
--
-- Exemplo:
--
-- OLD.preco
-- OLD.quantidade
--
--
-- RAISE(ABORT, 'mensagem')
-- ========================
-- Cancela uma operação dentro de uma trigger
-- e mostra uma mensagem de erro.