const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const caminhoBanco = path.join(__dirname, "tcc-main", "banco.db");

if (!fs.existsSync(caminhoBanco)) {
    console.error("Banco de dados não encontrado:");
    console.error(caminhoBanco);
    process.exit(1);
}

const banco = new Database(caminhoBanco, {
    readonly: true,
});

try {
    const tabelas = banco
        .prepare(
            `
        SELECT name, sql
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY name
    `,
        )
        .all();

    console.log("\nESTRUTURA DO BANCO BELLIEVIE\n");

    if (tabelas.length === 0) {
        console.log("Nenhuma tabela encontrada.");
    }

    for (const tabela of tabelas) {
        console.log(`\nTabela: ${tabela.name}`);
        console.log(tabela.sql);

        const colunas = banco.prepare(`PRAGMA table_info("${tabela.name}")`).all();

        console.log("Colunas:", colunas.map((coluna) => coluna.name).join(", "));
    }
} catch (erro) {
    console.error("Erro ao consultar o banco:", erro.message);
} finally {
    banco.close();
}