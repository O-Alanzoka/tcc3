require("dotenv").config();
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const session = require("express-session");
const nodemailer = require("nodemailer");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

const caminhoBanco = path.join(__dirname, "tcc-main", "banco.db");

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("Configure EMAIL_USER e EMAIL_PASS no arquivo .env.");
}

if (!process.env.SESSION_SECRET) {
    throw new Error("Configure SESSION_SECRET no arquivo .env.");
}

const banco = new Database(caminhoBanco);
banco.pragma("foreign_keys = ON");

/*
 * TABELA DE EVENTOS
 * Armazena as solicitações enviadas pelos representantes
 * e as decisões registradas pelo gerente.
 */
banco.exec(`
    CREATE TABLE IF NOT EXISTS eventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT NOT NULL,
        data_evento TEXT NOT NULL,
        horario TEXT,
        local TEXT NOT NULL,
        descricao TEXT,
        status_aprovacao TEXT NOT NULL DEFAULT 'pendente'
            CHECK (status_aprovacao IN ('pendente', 'aprovado', 'reprovado')),
        justificativa TEXT,
        usuario_id INTEGER NOT NULL,
        criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        atualizado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );

    CREATE INDEX IF NOT EXISTS idx_eventos_usuario
    ON eventos(usuario_id);

    CREATE INDEX IF NOT EXISTS idx_eventos_data
    ON eventos(data_evento);

    CREATE INDEX IF NOT EXISTS idx_eventos_status
    ON eventos(status_aprovacao);
`);

// ========================================
// ARMAZENAMENTO PERSISTENTE DAS SESSÕES
// ========================================

const prazoSessao = 7 * 24 * 60 * 60 * 1000;

banco.exec(`
    CREATE TABLE IF NOT EXISTS sessoes_login (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expires INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessoes_login_expires
    ON sessoes_login(expires);
`);

class SQLiteSessionStore extends session.Store {
    constructor(database) {
        super();
        this.banco = database;
    }

    get(sid, callback) {
        try {
            const agora = Date.now();

            const registro = this.banco
                .prepare(
                    `
                    SELECT sess, expires
                    FROM sessoes_login
                    WHERE sid = ?
                `,
                )
                .get(sid);

            if (!registro) {
                return callback(null, null);
            }

            if (registro.expires <= agora) {
                this.banco.prepare("DELETE FROM sessoes_login WHERE sid = ?").run(sid);

                return callback(null, null);
            }

            const sessao = JSON.parse(registro.sess);
            callback(null, sessao);
        } catch (erro) {
            callback(erro);
        }
    }

    set(sid, sessao, callback = () => {}) {
        try {
            const validade =
                sessao.cookie && sessao.cookie.expires ?
                new Date(sessao.cookie.expires).getTime() :
                Date.now() +
                ((sessao.cookie && sessao.cookie.maxAge) || prazoSessao);

            this.banco
                .prepare(
                    `
                    INSERT INTO sessoes_login (sid, sess, expires)
                    VALUES (?, ?, ?)
                    ON CONFLICT(sid) DO UPDATE SET
                        sess = excluded.sess,
                        expires = excluded.expires
                `,
                )
                .run(sid, JSON.stringify(sessao), validade);

            callback(null);
        } catch (erro) {
            callback(erro);
        }
    }

    destroy(sid, callback = () => {}) {
        try {
            this.banco.prepare("DELETE FROM sessoes_login WHERE sid = ?").run(sid);

            callback(null);
        } catch (erro) {
            callback(erro);
        }
    }

    touch(sid, sessao, callback = () => {}) {
        try {
            const validade =
                sessao.cookie && sessao.cookie.expires ?
                new Date(sessao.cookie.expires).getTime() :
                Date.now() +
                ((sessao.cookie && sessao.cookie.maxAge) || prazoSessao);

            this.banco
                .prepare(
                    `
                    UPDATE sessoes_login
                    SET sess = ?, expires = ?
                    WHERE sid = ?
                `,
                )
                .run(JSON.stringify(sessao), validade, sid);

            callback(null);
        } catch (erro) {
            callback(erro);
        }
    }
}

const armazenamentoSessoes = new SQLiteSessionStore(banco);

// ========================================
// HASH E VERIFICAÇÃO DAS SENHAS
// ========================================

function criarHashSenha(senha) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(senha, salt, 64).toString("hex");

    return `scrypt$${salt}$${hash}`;
}

function verificarSenha(senhaInformada, senhaBanco) {
    if (typeof senhaBanco !== "string") return false;

    if (senhaBanco.startsWith("scrypt$")) {
        const partes = senhaBanco.split("$");

        if (partes.length !== 3) return false;

        const [, salt, hashSalvo] = partes;

        try {
            const hashCalculado = crypto.scryptSync(senhaInformada, salt, 64);

            const hashEsperado = Buffer.from(hashSalvo, "hex");

            return (
                hashCalculado.length === hashEsperado.length &&
                crypto.timingSafeEqual(hashCalculado, hashEsperado)
            );
        } catch {
            return false;
        }
    }

    // Compatibilidade temporária com senhas antigas.
    return senhaInformada === senhaBanco;
}

// ========================================
// ENVIO DE E-MAILS
// ========================================

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    family: 4,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

transporter.verify((erro) => {
    if (erro) {
        console.error("Erro na conexão SMTP:", erro.message);
    } else {
        console.log("Conexão SMTP funcionando!");
    }
});

// ========================================
// MIDDLEWARES
// ========================================

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ========================================
// CONFIGURAÇÃO DA SESSÃO
// ========================================

app.use(
    session({
        name: "bellievie.sid",
        secret: process.env.SESSION_SECRET,
        store: armazenamentoSessoes,
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            maxAge: prazoSessao,
        },
    }),
);

// ========================================
// PROTEÇÃO DE ARQUIVOS INTERNOS
// ========================================

app.use((req, res, next) => {
    const caminho = decodeURIComponent(req.path).toLowerCase();

    if (
        /\.(db|sqlite|sqlite3|sql|py|env)$/i.test(caminho) ||
        /(^|\/)(package\.json|package-lock\.json|server\.js)$/i.test(caminho)
    ) {
        return res.sendStatus(404);
    }

    next();
});

// ========================================
// ARQUIVOS PÚBLICOS
// ========================================

app.use(express.static(path.join(__dirname, "tcc-main")));
app.use("/verificacao", express.static(path.join(__dirname, "verificacao")));

// ========================================
// CONTROLE DE ACESSO
// ========================================

function exigirLogin(req, res, next) {
    if (!req.session.usuario) {
        return res.redirect("/login.html");
    }

    next();
}

function exigirPerfil(perfil) {
    return (req, res, next) => {
        if (!req.session.usuario) {
            return res.redirect("/login.html");
        }

        if (req.session.usuario.tipo !== perfil) {
            return res.status(403).send("Acesso não autorizado.");
        }

        next();
    };
}

// ========================================
// PÁGINAS PROTEGIDAS POR PERFIL
// ========================================

app.use(
    "/Gerente",
    exigirPerfil("gerente"),
    express.static(path.join(__dirname, "Gerente"), {
        extensions: ["html"],
    }),
);

app.use(
    "/Usuarios",
    exigirPerfil("funcionario"),
    express.static(path.join(__dirname, "Usuários"), {
        extensions: ["html"],
    }),
);

// ========================================
// PÁGINA INICIAL
// ========================================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "tcc-main", "site.html"));
});

app.get("/login", (req, res) => {
    res.redirect("/login.html");
});

// ========================================
// ETAPA 1: LOGIN E ENVIO DO CÓDIGO
// ========================================

app.post("/login", async(req, res) => {
    const email = String(req.body.email || "")
        .trim()
        .toLowerCase();

    const senha = String(req.body.senha || "");

    if (!email || !senha || senha.length > 1024) {
        return res.status(400).send("Informe um e-mail e uma senha válidos.");
    }

    try {
        const usuario = banco
            .prepare(
                `
                SELECT id, nome, email, senha, tipo
                FROM usuarios
                WHERE email = ?
            `,
            )
            .get(email);

        if (!usuario || !verificarSenha(senha, usuario.senha)) {
            return res.status(401).send("E-mail ou senha incorretos.");
        }

        // Atualiza senhas antigas para hash após login válido.
        if (!usuario.senha.startsWith("scrypt$")) {
            banco
                .prepare(
                    `
                    UPDATE usuarios
                    SET senha = ?
                    WHERE id = ?
                `,
                )
                .run(criarHashSenha(senha), usuario.id);
        }

        const codigo = crypto.randomInt(100000, 1000000).toString();

        req.session.usuarioPendente = {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            tipo: usuario.tipo,
        };

        req.session.codigoVerificacao = codigo;
        req.session.expiracaoCodigo = Date.now() + 5 * 60 * 1000;
        req.session.tentativasCodigo = 0;

        req.session.save(async(erroSessao) => {
            if (erroSessao) {
                console.error("Erro ao salvar sessão:", erroSessao.message);
                return res.status(500).send("Não foi possível iniciar o login.");
            }

            try {
                await transporter.sendMail({
                    from: `"Bellievie" <${process.env.EMAIL_USER}>`,
                    to: usuario.email,
                    subject: "Código de verificação - Bellievie",
                    text: `Seu código de verificação é ${codigo}. Ele expira em 5 minutos.`,
                    html: `
                        <h2>Bellievie</h2>
                        <p>Seu código de verificação é:</p>
                        <h1>${codigo}</h1>
                        <p>Ele expira em 5 minutos. Se você não tentou entrar,
                        ignore este e-mail.</p>
                    `,
                });

                console.log("Código de verificação enviado para:", usuario.email);
                res.redirect("/verificacao/verify.html");
            } catch (erroEmail) {
                console.error("Erro ao enviar e-mail:", erroEmail.message);

                delete req.session.usuarioPendente;
                delete req.session.codigoVerificacao;
                delete req.session.expiracaoCodigo;
                delete req.session.tentativasCodigo;

                req.session.save(() => {
                    res
                        .status(500)
                        .send(
                            "Não foi possível enviar o código por e-mail. Tente novamente.",
                        );
                });
            }
        });
    } catch (erro) {
        console.error("Erro no login:", erro.message);
        res.status(500).send("Ocorreu um erro ao processar o login.");
    }
});

// ========================================
// ETAPA 2: VALIDAÇÃO DO CÓDIGO
// ========================================

app.post("/verificar-codigo", (req, res) => {
    const codigo = String(req.body.codigo || "");

    if (!/^\d{6}$/.test(codigo)) {
        return res.status(400).send("Digite um código de seis números.");
    }

    const pendente = req.session.usuarioPendente;
    const codigoCorreto = req.session.codigoVerificacao;
    const expiracao = req.session.expiracaoCodigo;

    if (!pendente || !codigoCorreto || !expiracao) {
        return res
            .status(400)
            .send("Nenhuma verificação pendente. Faça o login novamente.");
    }

    if (Date.now() > expiracao) {
        delete req.session.usuarioPendente;
        delete req.session.codigoVerificacao;
        delete req.session.expiracaoCodigo;
        delete req.session.tentativasCodigo;

        return req.session.save(() => {
            res.status(400).send("O código expirou. Faça o login novamente.");
        });
    }

    req.session.tentativasCodigo = (req.session.tentativasCodigo || 0) + 1;

    if (req.session.tentativasCodigo > 5) {
        delete req.session.usuarioPendente;
        delete req.session.codigoVerificacao;
        delete req.session.expiracaoCodigo;
        delete req.session.tentativasCodigo;

        return req.session.save(() => {
            res
                .status(429)
                .send("Limite de tentativas atingido. Faça o login novamente.");
        });
    }

    if (codigo !== codigoCorreto) {
        return req.session.save(() => {
            res.status(400).send("Código incorreto. Tente novamente.");
        });
    }

    const usuario = req.session.usuarioPendente;

    // Renova o identificador da sessão após autenticar.
    req.session.regenerate((erro) => {
        if (erro) {
            console.error("Erro ao renovar sessão:", erro.message);
            return res.status(500).send("Não foi possível concluir o login.");
        }

        req.session.usuario = usuario;

        req.session.save((erroSalvar) => {
            if (erroSalvar) {
                console.error("Erro ao salvar autenticação:", erroSalvar.message);
                return res.status(500).send("Não foi possível concluir o login.");
            }

            if (usuario.tipo === "gerente") {
                return res.redirect("/Gerente/Dashboard.html");
            }

            return res.redirect("/Usuarios/dashboarda.html");
        });
    });
});

// ========================================
// VISITAS: LISTAGEM
// Gerente vê todas; funcionário vê apenas as próprias
// ========================================

app.get("/api/visitas", exigirLogin, (req, res) => {
    try {
        const usuario = req.session.usuario;
        let visitas;

        if (usuario.tipo === "gerente") {
            visitas = banco
                .prepare(
                    `
                    SELECT v.*, u.nome AS responsavel
                    FROM visitas v
                    JOIN usuarios u ON u.id = v.usuario_id
                    ORDER BY v.data_visita, v.horario
                `,
                )
                .all();
        } else {
            visitas = banco
                .prepare(
                    `
                    SELECT v.*, u.nome AS responsavel
                    FROM visitas v
                    JOIN usuarios u ON u.id = v.usuario_id
                    WHERE v.usuario_id = ?
                    ORDER BY v.data_visita, v.horario
                `,
                )
                .all(usuario.id);
        }

        res.json(visitas);
    } catch (erro) {
        console.error("Erro ao listar visitas:", erro.message);
        res.status(500).json({
            erro: "Não foi possível listar as visitas.",
        });
    }
});

// ========================================
// CADASTRO DE VISITA
// ========================================

app.post("/api/visitas", exigirLogin, (req, res) => {
    try {
        const {
            titulo,
            data_visita,
            horario,
            endereco,
            nome_contato,
            empresa,
            telefone,
            finalidade,
            observacoes,
        } = req.body;

        const obrigatorios = [
            titulo,
            data_visita,
            horario,
            endereco,
            nome_contato,
            empresa,
            finalidade,
        ];

        if (
            obrigatorios.some((valor) => typeof valor !== "string" || !valor.trim())
        ) {
            return res.status(400).json({
                erro: "Preencha todos os campos obrigatórios.",
            });
        }

        const resultado = banco
            .prepare(
                `
                INSERT INTO visitas (
                    titulo,
                    data_visita,
                    horario,
                    endereco,
                    nome_contato,
                    empresa,
                    telefone,
                    finalidade,
                    observacoes,
                    usuario_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            )
            .run(
                titulo.trim(),
                data_visita,
                horario,
                endereco.trim(),
                nome_contato.trim(),
                empresa.trim(),
                telefone || null,
                finalidade.trim(),
                observacoes || null,
                req.session.usuario.id,
            );

        res.status(201).json({
            mensagem: "Visita cadastrada com sucesso.",
            id: resultado.lastInsertRowid,
        });
    } catch (erro) {
        console.error("Erro ao cadastrar visita:", erro.message);
        res.status(500).json({
            erro: "Não foi possível cadastrar a visita.",
        });
    }
});

// ========================================
// DETALHES DE UMA VISITA
// ========================================

app.get("/api/visitas/:id", exigirLogin, (req, res) => {
    try {
        const usuario = req.session.usuario;
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                erro: "ID inválido.",
            });
        }

        let visita;

        if (usuario.tipo === "gerente") {
            visita = banco
                .prepare(
                    `
                    SELECT v.*, u.nome AS responsavel
                    FROM visitas v
                    JOIN usuarios u ON u.id = v.usuario_id
                    WHERE v.id = ?
                `,
                )
                .get(id);
        } else {
            visita = banco
                .prepare(
                    `
                    SELECT v.*, u.nome AS responsavel
                    FROM visitas v
                    JOIN usuarios u ON u.id = v.usuario_id
                    WHERE v.id = ? AND v.usuario_id = ?
                `,
                )
                .get(id, usuario.id);
        }

        if (!visita) {
            return res.status(404).json({
                erro: "Visita não encontrada ou sem permissão de acesso.",
            });
        }

        res.json(visita);
    } catch (erro) {
        console.error("Erro ao consultar visita:", erro.message);
        res.status(500).json({
            erro: "Não foi possível consultar a visita.",
        });
    }
});

// ========================================
// EDIÇÃO DE VISITA
// ========================================

app.put("/api/visitas/:id", exigirLogin, (req, res) => {
    try {
        const usuario = req.session.usuario;
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                erro: "ID inválido.",
            });
        }

        const visita = banco.prepare("SELECT * FROM visitas WHERE id = ?").get(id);

        if (!visita) {
            return res.status(404).json({
                erro: "Visita não encontrada.",
            });
        }

        if (usuario.tipo !== "gerente" && visita.usuario_id !== usuario.id) {
            return res.status(403).json({
                erro: "Você não pode editar esta visita.",
            });
        }

        const campos = [
            "titulo",
            "data_visita",
            "horario",
            "endereco",
            "nome_contato",
            "empresa",
            "finalidade",
        ];

        if (
            campos.some(
                (campo) =>
                typeof req.body[campo] !== "string" || !req.body[campo].trim(),
            )
        ) {
            return res.status(400).json({
                erro: "Preencha todos os campos obrigatórios.",
            });
        }

        banco
            .prepare(
                `
                UPDATE visitas SET
                    titulo = ?,
                    data_visita = ?,
                    horario = ?,
                    endereco = ?,
                    nome_contato = ?,
                    empresa = ?,
                    telefone = ?,
                    finalidade = ?,
                    observacoes = ?,
                    atualizada_em = CURRENT_TIMESTAMP
                WHERE id = ?
            `,
            )
            .run(
                req.body.titulo.trim(),
                req.body.data_visita,
                req.body.horario,
                req.body.endereco.trim(),
                req.body.nome_contato.trim(),
                req.body.empresa.trim(),
                req.body.telefone || null,
                req.body.finalidade.trim(),
                req.body.observacoes || null,
                id,
            );

        res.json({
            mensagem: "Visita atualizada com sucesso.",
        });
    } catch (erro) {
        console.error("Erro ao editar visita:", erro.message);
        res.status(500).json({
            erro: "Não foi possível editar a visita.",
        });
    }
});

// ========================================
// CANCELAMENTO DE VISITA
// ========================================

app.patch("/api/visitas/:id/cancelar", exigirLogin, (req, res) => {
    try {
        const usuario = req.session.usuario;
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                erro: "ID inválido.",
            });
        }

        let resultado;

        if (usuario.tipo === "gerente") {
            resultado = banco
                .prepare(
                    `
                    UPDATE visitas
                    SET status = 'cancelada',
                        atualizada_em = CURRENT_TIMESTAMP
                    WHERE id = ?
                `,
                )
                .run(id);
        } else {
            resultado = banco
                .prepare(
                    `
                    UPDATE visitas
                    SET status = 'cancelada',
                        atualizada_em = CURRENT_TIMESTAMP
                    WHERE id = ? AND usuario_id = ?
                `,
                )
                .run(id, usuario.id);
        }

        if (resultado.changes === 0) {
            return res.status(404).json({
                erro: "Visita não encontrada ou sem permissão de acesso.",
            });
        }

        res.json({
            mensagem: "Visita cancelada com sucesso.",
        });
    } catch (erro) {
        console.error("Erro ao cancelar visita:", erro.message);
        res.status(500).json({
            erro: "Não foi possível cancelar a visita.",
        });
    }
});

// ========================================
// LOGOUT
// ========================================

app.get("/sair", exigirLogin, (req, res) => {
    req.session.destroy((erro) => {
        if (erro) {
            console.error("Erro ao encerrar sessão:", erro.message);

            return res.status(500).send("Não foi possível encerrar a sessão.");
        }

        res.clearCookie("bellievie.sid");
        res.redirect("/");
    });
});

// ========================================
// INICIALIZAÇÃO DO SERVIDOR
// ========================================

app.listen(PORT, () => {
    console.log(`Servidor Bellievie rodando em http://localhost:${PORT}`);
});