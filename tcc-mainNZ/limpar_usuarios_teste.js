const Database = require("better-sqlite3");
const path = require("path");

const banco = new Database(path.join(__dirname, "tcc-main", "banco.db"));

try {
    const resultado = banco
        .prepare(
            `
        DELETE FROM usuarios
        WHERE email IN (?, ?)
    `,
        )
        .run("joao@email.com", "maria@email.com");

    console.log(`Usuários de teste removidos: ${resultado.changes}`);

    console.log("Os demais dados do banco foram preservados.");
} catch (erro) {
    console.error("Erro ao remover usuários:", erro.message);
    process.exitCode = 1;
} finally {
    banco.close();
}