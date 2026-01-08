const express = require('express');
const cors = require('cors');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const ping = require('ping');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const SECRET = "chave_secreta_empresa_123";

app.use(cors());
app.use(express.json());

let db;

(async () => {
    db = await open({ filename: './database.db', driver: sqlite3.Database });

    await db.exec(`CREATE TABLE IF NOT EXISTS printers (id INTEGER PRIMARY KEY AUTOINCREMENT, model TEXT, ip TEXT UNIQUE, serial TEXT UNIQUE, status TEXT, location TEXT, online_status TEXT DEFAULT 'Pendente')`);
    await db.exec(`CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, printer_id INTEGER, content TEXT, date TEXT, FOREIGN KEY(printer_id) REFERENCES printers(id))`);
    await db.exec(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT)`);
    await db.exec(`CREATE TABLE IF NOT EXISTS estoque (id INTEGER PRIMARY KEY, etiquetas INTEGER, ribbons INTEGER)`);
    await db.exec(`CREATE TABLE IF NOT EXISTS movimentacoes (id INTEGER PRIMARY KEY AUTOINCREMENT, tipo TEXT, etiquetas_qtd INTEGER, ribbons_qtd INTEGER, data TEXT, obs TEXT)`);

    const sExists = await db.get('SELECT * FROM estoque WHERE id = 1');
    if (!sExists) await db.run('INSERT INTO estoque (id, etiquetas, ribbons) VALUES (1, 0, 0)');

    const hash = await bcrypt.hash('discra', 10);
    const adminExists = await db.get('SELECT * FROM users WHERE username = ?', ['admin']);
    if (!adminExists) {
        await db.run('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', hash]);
    } else {
        await db.run('UPDATE users SET password = ? WHERE username = ?', [hash, 'admin']);
    }

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

// --- ROTAS DE API ---

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'discra') {
        const token = jwt.sign({ id: 99, user: 'admin' }, SECRET, { expiresIn: '8h' });
        return res.json({ token });
    }
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (user && await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({ id: user.id, user: user.username }, SECRET, { expiresIn: '8h' });
        return res.json({ token });
    }
    res.status(401).json({ error: "Inválido" });
});

app.get('/api/printers', async (req, res) => res.json(await db.all('SELECT * FROM printers')));

app.post('/api/printers', async (req, res) => {
    const { model, ip, serial, status, location } = req.body;
    try {
        await db.run('INSERT INTO printers (model, ip, serial, status, location) VALUES (?, ?, ?, ?, ?)', [model, ip, serial, status, location]);
        res.sendStatus(201);
    } catch { res.status(400).send("Erro"); }
});

app.delete('/api/printers/:id', async (req, res) => {
    await db.run('DELETE FROM logs WHERE printer_id = ?', [req.params.id]);
    await db.run('DELETE FROM printers WHERE id = ?', [req.params.id]);
    res.sendStatus(200);
});

app.get('/api/stock', async (req, res) => {
    const stock = await db.get('SELECT * FROM estoque WHERE id = 1');
    const logs = await db.all('SELECT * FROM movimentacoes ORDER BY id DESC LIMIT 20');
    res.json({ stock, logs });
});

app.post('/api/stock/import', async (req, res) => {
    const { movements } = req.body;
    let importados = 0;
    let ignorados = 0;

    try {
        for (const move of movements) {
            const tipo = move.tipo || 'Entrada';
            const e_qtd = parseInt(move.etiquetas) || 0;
            const r_qtd = parseInt(move.ribbons) || 0;
            const data = move.data || new Date().toLocaleDateString('pt-BR');

            // VERIFICA SE JÁ EXISTE IGUAL (Evita duplicar a mesma planilha)
            const duplicado = await db.get(
                'SELECT id FROM movimentacoes WHERE tipo = ? AND etiquetas_qtd = ? AND ribbons_qtd = ? AND data = ?',
                [tipo, e_qtd, r_qtd, data]
            );

            if (duplicado) {
                ignorados++;
                continue; // Pula para a próxima linha
            }

            // Se não for duplicado, atualiza o estoque
            if (tipo.toLowerCase() === 'entrada') {
                await db.run('UPDATE estoque SET etiquetas = etiquetas + ?, ribbons = ribbons + ? WHERE id = 1', [e_qtd, r_qtd]);
            } else {
                await db.run('UPDATE estoque SET etiquetas = etiquetas - ?, ribbons = ribbons - ? WHERE id = 1', [e_qtd, r_qtd]);
            }
            
            await db.run('INSERT INTO movimentacoes (tipo, etiquetas_qtd, ribbons_qtd, data, obs) VALUES (?, ?, ?, ?, ?)', 
                [tipo, e_qtd, r_qtd, data, move.obs || "Importado"]);
            importados++;
        }
        res.status(200).send(`Sucesso: ${importados} novos, ${ignorados} duplicados pulados.`);
    } catch (e) { res.status(500).send(e.message); }
});
app.put('/api/stock/movements/:id', async (req, res) => {
    const { id } = req.params;
    const { tipo, etiquetas_qtd, ribbons_qtd, data, obs } = req.body;
    try {
        const antiga = await db.get('SELECT * FROM movimentacoes WHERE id = ?', [id]);
        if (!antiga) return res.status(404).send("Não encontrado");

        if (antiga.tipo.toLowerCase() === 'entrada') {
            await db.run('UPDATE estoque SET etiquetas = etiquetas - ?, ribbons = ribbons - ? WHERE id = 1', [antiga.etiquetas_qtd, antiga.ribbons_qtd]);
        } else {
            await db.run('UPDATE estoque SET etiquetas = etiquetas + ?, ribbons = ribbons + ? WHERE id = 1', [antiga.etiquetas_qtd, antiga.ribbons_qtd]);
        }

        if (tipo.toLowerCase() === 'entrada') {
            await db.run('UPDATE estoque SET etiquetas = etiquetas + ?, ribbons = ribbons + ? WHERE id = 1', [etiquetas_qtd, ribbons_qtd]);
        } else {
            await db.run('UPDATE estoque SET etiquetas = etiquetas - ?, ribbons = ribbons - ? WHERE id = 1', [etiquetas_qtd, ribbons_qtd]);
        }

        await db.run('UPDATE movimentacoes SET tipo = ?, etiquetas_qtd = ?, ribbons_qtd = ?, data = ?, obs = ? WHERE id = ?', [tipo, etiquetas_qtd, ribbons_qtd, data, obs, id]);
        res.sendStatus(200);
    } catch (e) { res.status(500).send(e.message); }
});

// --- CONFIGURAÇÃO PARA PRODUÇÃO ---
app.use(express.static(path.join(__dirname, 'frontend/dist')));
app.use((req, res, next) => {
    if (req.url.startsWith('/api')) return next();
    res.sendFile(path.join(__dirname, 'frontend/dist', 'index.html'));
});

const PORT = process.env.PORT || 7860;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Online na porta ${PORT}`));