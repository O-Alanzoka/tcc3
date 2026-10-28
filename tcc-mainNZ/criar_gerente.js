const Database = require("better-sqlite3");
const crypto = require("crypto");
const path = require("path");
const readline = require("readline");

const banco = new Database(path.join(__dirname, "tcc-main", "banco.db"));

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function perguntar(pergunta) {
    return new Promise((resolve) => {
        rl.question(pergunta, resolve);
    });
}

function gerarHash(senha) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(senha, salt, 64).toString("hex");
    return `scrypt$${salt}$${hash}`;
}

async function main() {
    try {
        const email = "thomasfraiz@gmail.com";

        const existente = banco
            .prepare("SELECT id, nome, email, tipo FROM usuarios WHERE email = ?")
            .get(email);

        if (existente) {
            banco
                .prepare("UPDATE usuarios SET tipo = 'gerente' WHERE id = ?")
                .run(existente.id);

            console.log("O usuário já existia e agora é gerente.");
            console.log("A senha atual foi preservada.");
            return;
        }

        const senha = await perguntar(
            "Digite uma senha forte (mínimo 12 caracteres): ",
        );

        if (senha.length < 12) {
            console.log("A senha precisa ter pelo menos 12 caracteres.");
            return;
        }

        const confirmacao = await perguntar("Confirme sua senha: ");

        if (senha !== confirmacao) {
            console.log("As senhas não coincidem.");
            return;
        }

        banco
            .prepare(
                `
            INSERT INTO usuarios (nome, email, senha, tipo)
            VALUES (?, ?, ?, 'gerente')
        `,
            )
            .run("Thomás Fraiz", email, gerarHash(senha));

        console.log("\nGerente cadastrado com sucesso!");
        console.log("E-mail: " + email);
        console.log("Perfil: gerente");
    } catch (erro) {
        console.error("Erro ao cadastrar gerente:", erro.message);
        process.exitCode = 1;
    } finally {
        banco.close();
        rl.close();
    }
}

main();