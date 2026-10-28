const Database = require("better-sqlite3");
const path = require("path");

const banco = new Database(path.join(__dirname, "tcc-main", "banco.db"), {
    readonly: true,
});

try {
    const usuarios = banco
        .prepare(
            `
        SELECT id, nome, email, tipo
        FROM usuarios
        ORDER BY id
    `,
        )
        .all();

    console.log("\nUSUÁRIOS CADASTRADOS\n");
    console.table(usuarios);
    console.log(`Total de usuários: ${usuarios.length}`);
} catch (erro) {
    console.error("Erro ao consultar usuários:", erro.message);
} finally {
    banco.close();
}