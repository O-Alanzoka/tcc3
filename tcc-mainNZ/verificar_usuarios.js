const Database = require("better-sqlite3");
const path = require("path");

const banco = new Database(path.join(__dirname, "tcc-main", "banco.db"), {
    readonly: true,
});

try {
    const usuarios = banco
        .prepare(
            `
        SELECT id, nome, email, length(senha) AS tamanho_senha
        FROM usuarios
        ORDER BY id
    `,
        )
        .all();

    console.log("\nVERIFICAÇÃO DAS SENHAS\n");

    for (const usuario of usuarios) {
        console.log({
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            tamanhoSenha: usuario.tamanho_senha,
        });
    }
} finally {
    banco.close();
}