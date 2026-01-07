const express = require('express');
const cors = require('cors');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const ping = require('ping');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const SECRET = "chave_secreta_empresa_123";

app.use(cors());
app.use(express.json());

let db;

(async () => {
    db = await open({ filename: './database.db', driver: sqlite3.Database });

    // --- TABELAS DE IMPRESSORAS ---
    await db.exec(`CREATE TABLE IF NOT EXISTS printers (id INTEGER PRIMARY KEY AUTOINCREMENT, model TEXT, ip TEXT UNIQUE, serial TEXT UNIQUE, status TEXT, location TEXT, online_status TEXT DEFAULT 'Pendente')`);
    await db.exec(`CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, printer_id INTEGER, content TEXT, date TEXT, FOREIGN KEY(printer_id) REFERENCES printers(id))`);
    await db.exec(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT)`);

    // --- TABELAS DE ESTOQUE ---
    await db.exec(`CREATE TABLE IF NOT EXISTS estoque (id INTEGER PRIMARY KEY, etiquetas INTEGER, ribbons INTEGER)`);
    await db.exec(`CREATE TABLE IF NOT EXISTS movimentacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        tipo TEXT, 
        etiquetas_qtd INTEGER, 
        ribbons_qtd INTEGER, 
        data TEXT,
        obs TEXT
    )`);

    // Inicializa o saldo se não existir
    const sExists = await db.get('SELECT * FROM estoque WHERE id = 1');
    if (!sExists) await db.run('INSERT INTO estoque (id, etiquetas, ribbons) VALUES (1, 0, 0)');

    // Usuário Admin
    const adminExists = await db.get('SELECT * FROM users WHERE username = ?', ['admin']);
    if (!adminExists) {
        const hash = await bcrypt.hash('discra', 10);
        await db.run('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', hash]);
    }

    // Ping
    const updateNetworkStatus = async () => {
        const printers = await db.all('SELECT id, ip FROM printers');
        for (let p of printers) {
            try {
                const res = await ping.promise.probe(p.ip, { timeout: 2 });
                const status = res.alive ? (res.time > 150 ? 'Instável' : 'Online') : 'Offline';
                await db.run('UPDATE printers SET online_status = ? WHERE id = ?', [status, p.id]);
            } catch (err) { console.error("Erro ping:", p.ip); }
        }
    };
    setInterval(updateNetworkStatus, 30000);
})();

// --- ROTAS ---
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (user && await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({ id: user.id, user: user.username }, SECRET, { expiresIn: '8h' });
        return res.json({ token });
    }
    res.status(401).json({ error: "Inválido" });
});

app.get('/printers', async (req, res) => res.json(await db.all('SELECT * FROM printers')));

app.post('/printers', async (req, res) => {
    const { model, ip, serial, status, location } = req.body;
    try {
        await db.run('INSERT INTO printers (model, ip, serial, status, location) VALUES (?, ?, ?, ?, ?)', [model, ip, serial, status, location]);
        res.sendStatus(201);
    } catch { res.status(400).send("Erro"); }
});

app.put('/printers/:id', async (req, res) => {
    const { id } = req.params;
    const { model, ip, serial, location } = req.body;
    await db.run('UPDATE printers SET model=?, ip=?, serial=?, location=? WHERE id=?', [model, ip, serial, location, id]);
    res.sendStatus(200);
});

app.delete('/printers/:id', async (req, res) => {
    await db.run('DELETE FROM logs WHERE printer_id = ?', [req.params.id]);
    await db.run('DELETE FROM printers WHERE id = ?', [req.params.id]);
    res.sendStatus(200);
});

app.get('/logs/:printerId', async (req, res) => {
    res.json(await db.all('SELECT * FROM logs WHERE printer_id = ? ORDER BY id DESC', [req.params.printerId]));
});

app.post('/logs', async (req, res) => {
    const { printer_id, content } = req.body;
    await db.run('INSERT INTO logs (printer_id, content, date) VALUES (?, ?, ?)', [printer_id, content, new Date().toLocaleString('pt-BR')]);
    res.sendStatus(201);
});

// --- ROTAS DE ESTOQUE ---
app.get('/stock', async (req, res) => {
    const stock = await db.get('SELECT * FROM estoque WHERE id = 1');
    const logs = await db.all('SELECT * FROM movimentacoes ORDER BY id DESC LIMIT 20');
    res.json({ stock, logs });
});

app.post('/stock/import', async (req, res) => {
    const { movements } = req.body;
    try {
        for (const move of movements) {
            const tipo = move.tipo || move.Tipo || 'Entrada';
            const e_qtd = parseInt(move.etiquetas || move.Etiquetas) || 0;
            const r_qtd = parseInt(move.ribbons || move.Ribbons) || 0;
            const obs = move.obs || move.Obs || "Importado via Planilha";
            const data = move.data || move.Data || new Date().toLocaleString('pt-BR');

            // Atualização do saldo
            if (tipo.toLowerCase() === 'entrada') {
                await db.run('UPDATE estoque SET etiquetas = etiquetas + ?, ribbons = ribbons + ? WHERE id = 1', [e_qtd, r_qtd]);
            } else if (tipo.toLowerCase() === 'saída' || tipo.toLowerCase() === 'saida') {
                await db.run('UPDATE estoque SET etiquetas = etiquetas - ?, ribbons = ribbons - ? WHERE id = 1', [e_qtd, r_qtd]);
            } else if (tipo.toLowerCase() === 'ajuste') {
                await db.run('UPDATE estoque SET etiquetas = ?, ribbons = ? WHERE id = 1', [e_qtd, r_qtd]);
            }

            // Registro no histórico
            await db.run('INSERT INTO movimentacoes (tipo, etiquetas_qtd, ribbons_qtd, data, obs) VALUES (?, ?, ?, ?, ?)', 
                [tipo, e_qtd, r_qtd, data, obs]);
        }
        res.status(200).send("Importação concluída com sucesso");
    } catch (error) {
        console.error(error);
        res.status(500).send("Erro ao processar: " + error.message);
    }
});

// Troque o app.listen(3001...) por isso:
const PORT = process.env.PORT || 7860;
app.listen(PORT, '0.0.0.0', () => console.log(`Online na porta ${PORT}`));