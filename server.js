require("dotenv").config();

const crypto = require("node:crypto");
const path = require("node:path");
const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { Pool } = require("pg");

const requiredEnvironment = ["DATABASE_URL", "ADMIN_PASSWORD", "SESSION_SECRET"];
for (const name of requiredEnvironment) {
    if (!process.env[name]) {
        throw new Error(`A variável de ambiente ${name} é obrigatória.`);
    }
}
if (process.env.SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET precisa ter pelo menos 32 caracteres.");
}

const app = express();
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});
const root = __dirname;
const cookieName = "frase_auth";
const sessionDurationSeconds = 8 * 60 * 60;

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "10kb" }));
app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
});

const signSession = (expiresAt) => crypto
    .createHmac("sha256", process.env.SESSION_SECRET)
    .update(String(expiresAt))
    .digest("base64url");

const safeEqual = (left, right) => {
    const leftHash = crypto.createHmac("sha256", process.env.SESSION_SECRET).update(left).digest();
    const rightHash = crypto.createHmac("sha256", process.env.SESSION_SECRET).update(right).digest();
    return crypto.timingSafeEqual(leftHash, rightHash);
};

const getCookie = (req, name) => {
    const cookies = (req.headers.cookie || "").split(";");
    const entry = cookies.find((cookie) => cookie.trim().startsWith(`${name}=`));
    return entry ? entry.trim().slice(name.length + 1) : "";
};

const isAuthenticated = (req) => {
    const [expiresAt, signature, extra] = getCookie(req, cookieName).split(".");
    if (extra !== undefined || !/^\d+$/.test(expiresAt || "") || !signature) {
        return false;
    }
    const expiration = Number(expiresAt);
    return expiration > Date.now() && safeEqual(signature, signSession(expiresAt));
};

const requireAuthentication = (req, res, next) => {
    if (!isAuthenticated(req)) {
        res.status(401).json({ error: "É necessário digitar a senha novamente." });
        return;
    }
    next();
};

const requireSameOrigin = (req, res, next) => {
    try {
        if (new URL(req.get("origin")).host !== req.get("host")) {
            res.status(403).json({ error: "Origem da solicitação não permitida." });
            return;
        }
    } catch {
        res.status(403).json({ error: "Origem da solicitação não permitida." });
        return;
    }
    next();
};

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas tentativas. Aguarde 15 minutos e tente novamente." },
});

const sendPage = (file) => (_req, res) => res.sendFile(path.join(root, file));

app.get(["/", "/index.html"], sendPage("index.html"));
app.get("/historico.html", sendPage("historico.html"));
app.get("/senha.html", sendPage("senha.html"));
app.get("/editar.html", (req, res, next) => {
    if (!isAuthenticated(req)) {
        res.redirect(303, "/senha.html");
        return;
    }
    next();
}, sendPage("editar.html"));
app.get("/style.css", sendPage("style.css"));
app.get("/app.js", sendPage("app.js"));
app.use("/assets", express.static(path.join(root, "assets"), { dotfiles: "deny", index: false }));

app.get("/api/phrases/current", async (_req, res) => {
    const result = await pool.query(
        "SELECT id, phrase AS text, created_at AS \"createdAt\" FROM phrases ORDER BY id DESC LIMIT 1",
    );
    res.json({ phrase: result.rows[0] || null });
});

app.get("/api/phrases/history", async (_req, res) => {
    const result = await pool.query(
        `SELECT id, phrase AS text, created_at AS "createdAt"
         FROM phrases
         WHERE id < (SELECT COALESCE(MAX(id), 0) FROM phrases)
         ORDER BY id DESC`,
    );
    res.json({ phrases: result.rows });
});

app.post("/api/login", requireSameOrigin, loginLimiter, (req, res) => {
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!safeEqual(password, process.env.ADMIN_PASSWORD)) {
        res.status(401).json({ error: "Senha incorreta." });
        return;
    }

    const expiresAt = Date.now() + sessionDurationSeconds * 1000;
    const secure = req.secure ? "; Secure" : "";
    res.setHeader(
        "Set-Cookie",
        `${cookieName}=${expiresAt}.${signSession(expiresAt)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionDurationSeconds}${secure}`,
    );
    res.json({ authenticated: true });
});

app.post("/api/phrases", requireSameOrigin, requireAuthentication, async (req, res) => {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text || text.length > 500) {
        res.status(400).json({ error: "A frase precisa ter entre 1 e 500 caracteres." });
        return;
    }

    const result = await pool.query(
        `INSERT INTO phrases (phrase)
         VALUES ($1)
         RETURNING id, phrase AS text, created_at AS "createdAt"`,
        [text],
    );
    res.status(201).json({ phrase: result.rows[0] });
});

app.post("/api/logout", requireSameOrigin, (req, res) => {
    const secure = req.secure ? "; Secure" : "";
    res.setHeader("Set-Cookie", `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
    res.status(204).end();
});

app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
        res.status(404).json({ error: "Recurso não encontrado." });
        return;
    }
    res.status(404).send("Página não encontrada.");
});

app.use((error, _req, res, _next) => {
    console.error(error);
    if (res.headersSent) {
        return;
    }
    res.status(500).json({ error: "Erro interno do servidor." });
});

const initializeDatabase = async () => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(48392017)");
        await client.query(`
            CREATE TABLE IF NOT EXISTS phrases (
                id BIGSERIAL PRIMARY KEY,
                phrase TEXT NOT NULL CHECK (char_length(phrase) BETWEEN 1 AND 500),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        await client.query(
            `INSERT INTO phrases (phrase, created_at)
             SELECT $1, TIMESTAMPTZ '2026-11-13 12:00:00+00'
             WHERE NOT EXISTS (SELECT 1 FROM phrases)`,
            ["Não consigo ficar um minuto sem pensar em você, sinto a sua falta todos os dias."],
        );
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

const start = async () => {
    await initializeDatabase();
    const port = Number(process.env.PORT) || 3000;
    app.listen(port, "0.0.0.0", () => {
        console.log(`Servidor iniciado na porta ${port}.`);
    });
};

start().catch((error) => {
    console.error("Não foi possível iniciar o servidor:", error);
    process.exitCode = 1;
});
