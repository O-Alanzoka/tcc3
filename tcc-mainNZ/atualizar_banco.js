const Database = require("better-sqlite3");
const path = require("path");

const caminhoBanco = path.join(__dirname, "tcc-main", "banco.db");

const banco = new Database(caminhoBanco);

try {
    banco.pragma("foreign_keys = ON");

    const colunas = banco.prepare("PRAGMA table_info(usuarios)").all();

    if (colunas.length === 0) {
        throw new Error(
            "A tabela usuarios não foi encontrada. Nenhuma alteração foi feita.",
        );
    }

    const tipoExiste = colunas.some((coluna) => coluna.name === "tipo");

    if (!tipoExiste) {
        banco.exec(`
            ALTER TABLE usuarios
            ADD COLUMN tipo TEXT NOT NULL DEFAULT 'funcionario'
            CHECK (tipo IN ('gerente', 'funcionario'));
        `);

        console.log("Coluna tipo adicionada com sucesso.");
    } else {
        console.log("A coluna tipo já existe.");
    }

    const usuarios = banco
        .prepare(
            `
        SELECT id, nome, email, tipo
        FROM usuarios
        ORDER BY id
    `,
        )
        .all();

    console.log("\nUsuários após a atualização:");

    for (const usuario of usuarios) {
        console.log(usuario);
    }

    console.log("\nMigração concluída.");
} catch (erro) {
    console.error("Erro ao atualizar o banco:", erro.message);
    process.exitCode = 1;
} finally {
    banco.close();
}