const Database = require("better-sqlite3");
const crypto = require("crypto");
const path = require("path");
const readline = require("readline");

const banco = new Database(path.join(__dirname, "tcc-main", "banco.db"));

const funcionarios = [{
        nome: "Felipe Navarro Godoy",
        email: "felipe.navarro.godoy@gmail.com",
    },
    {
        nome: "Marco Malinovski Souza",
        email: "malinovskisouza08@gmail.com",
    },
];

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
        for (const funcionario of funcionarios) {
            const existente = banco
                .prepare("SELECT id FROM usuarios WHERE email = ?")
                .get(funcionario.email);

            if (existente) {
                console.log(`O e-mail ${funcionario.email} já está cadastrado.`);
                continue;
            }

            console.log(`\nCadastro: ${funcionario.nome}`);
            console.log(`E-mail: ${funcionario.email}`);

            const senha = await perguntar(
                "Digite a senha inicial (mínimo 12 caracteres): ",
            );

            if (senha.length < 12) {
                console.log("Senha muito curta. Cadastro ignorado.");
                continue;
            }

            const confirmacao = await perguntar("Confirme a senha: ");

            if (senha !== confirmacao) {
                console.log("As senhas não coincidem. Cadastro ignorado.");
                continue;
            }

            banco
                .prepare(
                    `
                INSERT INTO usuarios (nome, email, senha, tipo)
                VALUES (?, ?, ?, 'funcionario')
            `,
                )
                .run(funcionario.nome, funcionario.email, gerarHash(senha));

            console.log("Funcionário cadastrado com sucesso!");
        }
    } catch (erro) {
        console.error("Erro ao cadastrar funcionário:", erro.message);
        process.exitCode = 1;
    } finally {
        banco.close();
        rl.close();
    }
}

main();