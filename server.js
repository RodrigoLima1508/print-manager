const express = require('express');
const cors = require('cors');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const ping = require('ping');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const cron = require('node-cron');

// --- CONFIGURAÇÃO DE BACKUP ---
const realizarBackup = () => {
    const dataAtual = new Date().toISOString().replace(/[:.]/g, '-');
    const diretorioBackup = path.join(__dirname, 'backups');

    if (!fs.existsSync(diretorioBackup)) fs.mkdirSync(diretorioBackup);

    const destino = path.join(diretorioBackup, `backup-${dataAtual}.db`);

    try {
        fs.copyFileSync('./database.db', destino);
        console.log(`✅ Backup gerado com sucesso: ${destino}`);
    } catch (err) {
        console.error('❌ Erro ao realizar backup:', err);
    }
};

cron.schedule('30 12 * * *', () => {
    console.log('Executando backup agendado das 12h30...');
    realizarBackup();
}, {
    scheduled: true,
    timezone: "America/Sao_Paulo"
});

// --- APP SETUP ---
const app = express();
const upload = multer({ dest: 'uploads/' });
const SECRET = "chave_secreta_empresa_123";

function excelDateToJS(serial) {
    if (!serial) return "";
    if (typeof serial === 'string' && serial.includes('/')) return serial;
    if (typeof serial === 'number') {
        if (serial < 1) return new Date().toLocaleDateString('pt-BR');
        const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
        if (date.getFullYear() < 1990) return new Date().toLocaleDateString('pt-BR');
        return date.toLocaleDateString('pt-BR');
    }
    return serial.toString();
}

app.use(cors());
app.use(express.json());

let db;

async function checkPrinters() {
    if (!db) return;
    const printers = await db.all('SELECT id, ip FROM printers');
    for (let p of printers) {
        if (!p.ip || p.ip.trim() === "") {
            await db.run('UPDATE printers SET online_status = ? WHERE id = ?', ['Disponível', p.id]);
            continue;
        }
        try {
            const res = await ping.promise.probe(p.ip, { timeout: 2 });
            const status = res.alive ? (res.time > 150 ? 'Instável' : 'Online') : 'Offline';
            await db.run('UPDATE printers SET online_status = ? WHERE id = ?', [status, p.id]);
        } catch (err) {
            console.error(`Erro ao pingar ${p.ip}:`, err);
        }
    }
}

// --- DATABASE E INICIALIZAÇÃO ---
(async () => {
    db = await open({ filename: './database.db', driver: sqlite3.Database });
    
    realizarBackup();

    await db.exec(`CREATE TABLE IF NOT EXISTS printers (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        model TEXT, 
        ip TEXT, 
        serial TEXT, 
        status TEXT, 
        location TEXT, 
        online_status TEXT DEFAULT 'Pendente',
        obs TEXT
    )`);

    // NOVA TABELA DE OCORRÊNCIAS
    await db.exec(`CREATE TABLE IF NOT EXISTS printer_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        printer_id INTEGER,
        date TEXT,
        description TEXT,
        FOREIGN KEY(printer_id) REFERENCES printers(id) ON DELETE CASCADE
    )`);
    
    await db.exec(`CREATE TABLE IF NOT EXISTS stock_history (id INTEGER PRIMARY KEY AUTOINCREMENT, data_hora TEXT, mes TEXT, tipo_movimentacao TEXT, etiqueta_entrada INTEGER, etiqueta_saida INTEGER, ribbon_entrada INTEGER, ribbon_saida INTEGER)`);
    await db.exec(`CREATE TABLE IF NOT EXISTS stock_settings (item TEXT PRIMARY KEY, min_stock INTEGER)`);
    await db.exec(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT)`);

    const settingsExist = await db.get('SELECT * FROM stock_settings LIMIT 1');
    if (!settingsExist) {
        await db.run('INSERT INTO stock_settings (item, min_stock) VALUES (?, ?)', ['Etiquetas', 130]);
        await db.run('INSERT INTO stock_settings (item, min_stock) VALUES (?, ?)', ['Ribbon', 20]);
    }

    const hash = await bcrypt.hash('discra', 10);
    const adminExists = await db.get('SELECT * FROM users WHERE username = ?', ['admin']);
    if (!adminExists) await db.run('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', hash]);

    setInterval(checkPrinters, 10000);
})();

// --- ROTAS API ---

// AUTH
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'discra') {
        const token = jwt.sign({ id: 99, user: 'admin' }, SECRET, { expiresIn: '8h' });
        return res.json({ token });
    }
    res.status(401).json({ error: "Inválido" });
});

// PRINTERS
app.get('/api/printers', async (req, res) => res.json(await db.all('SELECT * FROM printers')));

app.post('/api/printers', async (req, res) => {
    const { model, ip, serial, status, location, obs } = req.body;
    await db.run(
        'INSERT INTO printers (model, ip, serial, status, location, obs) VALUES (?, ?, ?, ?, ?, ?)', 
        [model, ip, serial, status, location, obs || '']
    );
    checkPrinters(); 
    res.sendStatus(201);
});

app.put('/api/printers/:id', async (req, res) => {
    try {
        const { model, ip, serial, status, location, obs } = req.body;
        const { id } = req.params;
        await db.run(
            `UPDATE printers SET model = ?, ip = ?, serial = ?, status = ?, location = ?, obs = ? WHERE id = ?`,
            [model, ip, serial, status, location, obs, id]
        );
        checkPrinters();
        res.json({ message: "Impressora atualizada com sucesso!" });
    } catch (e) { res.status(500).send(e.message); }
});

app.delete('/api/printers/:id', async (req, res) => {
    await db.run('DELETE FROM printers WHERE id = ?', [req.params.id]);
    res.sendStatus(200);
});

// --- NOVAS ROTAS DE OCORRÊNCIAS ---
app.get('/api/printers/:id/events', async (req, res) => {
    const events = await db.all('SELECT * FROM printer_events WHERE printer_id = ? ORDER BY id DESC', [req.params.id]);
    res.json(events);
});

app.post('/api/printers/:id/events', async (req, res) => {
    const { date, description } = req.body;
    await db.run('INSERT INTO printer_events (printer_id, date, description) VALUES (?, ?, ?)', [req.params.id, date, description]);
    res.sendStatus(201);
});

app.put('/api/events/:id', async (req, res) => {
    const { date, description } = req.body;
    await db.run('UPDATE printer_events SET date = ?, description = ? WHERE id = ?', [date, description, req.params.id]);
    res.sendStatus(200);
});

app.delete('/api/events/:id', async (req, res) => {
    await db.run('DELETE FROM printer_events WHERE id = ?', [req.params.id]);
    res.sendStatus(200);
});

// STOCK
app.get('/api/stock', async (req, res) => {
    try {
        const settings = await db.all('SELECT * FROM stock_settings');
        const minLabels = settings.find(s => s.item === 'Etiquetas')?.min_stock || 130;
        const minRibbons = settings.find(s => s.item === 'Ribbon')?.min_stock || 20;
        const data = await db.get(`SELECT (SUM(CAST(IFNULL(etiqueta_entrada, 0) AS INTEGER)) - SUM(CAST(IFNULL(etiqueta_saida, 0) AS INTEGER))) as labels, (SUM(CAST(IFNULL(ribbon_entrada, 0) AS INTEGER)) - SUM(CAST(IFNULL(ribbon_saida, 0) AS INTEGER))) as ribbons FROM stock_history WHERE etiqueta_entrada != 13455 AND tipo_movimentacao IS NOT NULL AND tipo_movimentacao != 'null'`);
        const logs = await db.all(`SELECT * FROM stock_history WHERE etiqueta_entrada != 13455 AND tipo_movimentacao IS NOT NULL AND tipo_movimentacao != 'null' ORDER BY id DESC LIMIT 50`);
        res.json({ labels: { current: data.labels || 0, min: minLabels, percent: Math.round(((data.labels || 0) / minLabels) * 100) }, ribbons: { current: data.ribbons || 0, min: minRibbons, percent: Math.round(((data.ribbons || 0) / minRibbons) * 100) }, logs: logs || [] });
    } catch (e) { res.status(500).send(e.message); }
});

app.post('/api/stock/import', upload.single('file'), async (req, res) => {
    try {
        const workbook = xlsx.readFile(req.file.path);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet);
        for (const row of data) {
            const dataRaw = row['DATA']; if (!dataRaw || dataRaw === 'DATA') continue;
            await db.run(`INSERT INTO stock_history (data_hora, mes, tipo_movimentacao, etiqueta_entrada, etiqueta_saida, ribbon_entrada, ribbon_saida) VALUES (?,?,?,?,?,?,?)`, [excelDateToJS(dataRaw), row['MES'] || '', row['TIPO'] || 'Importado', parseInt(row['ETIQUETA_ENTRADA']) || 0, parseInt(row['ETIQUETA_SAIDA']) || 0, parseInt(row['RIBBON_ENTRADA']) || 0, parseInt(row['RIBBON_SAIDA']) || 0]);
        }
        res.json({ message: "Sucesso" });
    } catch (e) { res.status(500).send(e.message); }
});

app.post('/api/stock/manual', async (req, res) => {
    try {
        const { data_hora, mes, tipo_movimentacao, etiqueta_entrada, etiqueta_saida, ribbon_entrada, ribbon_saida } = req.body;
        await db.run(`INSERT INTO stock_history (data_hora, mes, tipo_movimentacao, etiqueta_entrada, etiqueta_saida, ribbon_entrada, ribbon_saida) VALUES (?,?,?,?,?,?,?)`, [data_hora, mes, tipo_movimentacao, etiqueta_entrada, etiqueta_saida, ribbon_entrada, ribbon_saida]);
        res.sendStatus(201);
    } catch (e) { res.status(500).send(e.message); }
});

app.delete('/api/stock/logs/:id', async (req, res) => {
    try { await db.run('DELETE FROM stock_history WHERE id = ?', [req.params.id]); res.sendStatus(200); } catch (e) { res.status(500).send(e.message); }
});

app.put('/api/stock/logs/:id', async (req, res) => {
    try {
        const { data_hora, tipo_movimentacao, etiqueta_entrada, etiqueta_saida, ribbon_entrada, ribbon_saida } = req.body;
        await db.run(`UPDATE stock_history SET data_hora = ?, tipo_movimentacao = ?, etiqueta_entrada = ?, etiqueta_saida = ?, ribbon_entrada = ?, ribbon_saida = ? WHERE id = ?`, [data_hora, tipo_movimentacao, etiqueta_entrada, etiqueta_saida, ribbon_entrada, ribbon_saida, req.params.id]);
        res.sendStatus(200);
    } catch (e) { res.status(500).send(e.message); }
});

app.use(express.static(path.join(__dirname, 'frontend/dist')));
app.get(/^(?!\/api).+/, (req, res) => { res.sendFile(path.join(__dirname, 'frontend/dist', 'index.html')); });

app.listen(7860, '0.0.0.0', () => console.log(`🚀 Serviço online na porta 7860`));