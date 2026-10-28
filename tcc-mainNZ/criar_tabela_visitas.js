const Database = require("better-sqlite3");
const path = require("path");

const caminhoBanco = path.join(__dirname, "tcc-main", "banco.db");
const banco = new Database(caminhoBanco);

try {
    banco.pragma("foreign_keys = ON");

    banco.exec(`
        CREATE TABLE IF NOT EXISTS visitas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT NOT NULL,
            data_visita TEXT NOT NULL,
            horario TEXT NOT NULL,
            endereco TEXT NOT NULL,
            nome_contato TEXT NOT NULL,
            empresa TEXT NOT NULL,
            telefone TEXT,
            finalidade TEXT NOT NULL,
            observacoes TEXT,
            status TEXT NOT NULL DEFAULT 'agendada'
                CHECK (status IN ('agendada', 'realizada', 'cancelada')),
            usuario_id INTEGER NOT NULL,
            criada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            atualizada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        );
    `);

    console.log("Tabela de visitas criada ou já existente.");

    const tabela = banco.prepare("PRAGMA table_info(visitas)").all();

    console.log("Colunas:", tabela.map((coluna) => coluna.name).join(", "));
} catch (erro) {
    console.error("Erro ao criar tabela de visitas:", erro.message);
    process.exitCode = 1;
} finally {
    banco.close();
}