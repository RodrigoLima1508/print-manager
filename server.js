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
    
    // Criação das Tabelas
    await db.exec(`CREATE TABLE IF NOT EXISTS printers (id INTEGER PRIMARY KEY AUTOINCREMENT, model TEXT, ip TEXT UNIQUE, serial TEXT UNIQUE, status TEXT, location TEXT, online_status TEXT DEFAULT 'Pendente')`);
    await db.exec(`CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, printer_id INTEGER, content TEXT, date TEXT, FOREIGN KEY(printer_id) REFERENCES printers(id))`);
    await db.exec(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT)`);

    // Criar Usuário Admin Inicial (Senha: discra)
    const adminExists = await db.get('SELECT * FROM users WHERE username = ?', ['admin']);
    if (!adminExists) {
        const hash = await bcrypt.hash('discra', 10);
        await db.run('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', hash]);
    }

    // --- SISTEMA DE PING AUTOMÁTICO ---
    const updateNetworkStatus = async () => {
        const printers = await db.all('SELECT id, ip FROM printers');
        for (let p of printers) {
            try {
                const res = await ping.promise.probe(p.ip, { timeout: 2 });
                const status = res.alive ? (res.time > 150 ? 'Instável' : 'Online') : 'Offline';
                await db.run('UPDATE printers SET online_status = ? WHERE id = ?', [status, p.id]);
            } catch (err) { console.error("Erro ping:", p.ip); }
        }
        console.log("🔍 Status de rede atualizado!");
    };

    setInterval(updateNetworkStatus, 30000); // A cada 30 segundos
    setTimeout(updateNetworkStatus, 3000);   // Inicia 3 seg após ligar
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

app.get('/printers', async (req, res) => {
    const data = await db.all('SELECT * FROM printers');
    res.json(data);
});

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
    const logs = await db.all('SELECT * FROM logs WHERE printer_id = ? ORDER BY id DESC', [req.params.printerId]);
    res.json(logs);
});

app.post('/logs', async (req, res) => {
    const { printer_id, content } = req.body;
    const date = new Date().toLocaleString('pt-BR');
    await db.run('INSERT INTO logs (printer_id, content, date) VALUES (?, ?, ?)', [printer_id, content, date]);
    res.sendStatus(201);
});

app.listen(3001, () => console.log("🚀 Server ON: 3001"));