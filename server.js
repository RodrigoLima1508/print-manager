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

const app = express();
const upload = multer({ dest: 'uploads/' });
const SECRET = "chave_secreta_empresa_123";

// Função para converter data do Excel (número) para DD/MM/AAAA
function excelDateToJS(serial) {
    if (!serial || isNaN(serial)) return serial; 
    const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
    return date.toLocaleDateString('pt-BR');
}

app.use(cors());
app.use(express.json());

let db;

(async () => {
    db = await open({ filename: './database.db', driver: sqlite3.Database });

    await db.exec(`CREATE TABLE IF NOT EXISTS printers (id INTEGER PRIMARY KEY AUTOINCREMENT, model TEXT, ip TEXT UNIQUE, serial TEXT UNIQUE, status TEXT, location TEXT, online_status TEXT DEFAULT 'Pendente')`);
    await db.exec(`CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, printer_id INTEGER, content TEXT, date TEXT, FOREIGN KEY(printer_id) REFERENCES printers(id))`);
    await db.exec(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT)`);
    await db.exec(`CREATE TABLE IF NOT EXISTS stock_history (id INTEGER PRIMARY KEY AUTOINCREMENT, data_hora TEXT, mes TEXT, tipo_movimentacao TEXT, etiqueta_entrada INTEGER, etiqueta_saida INTEGER, ribbon_entrada INTEGER, ribbon_saida INTEGER)`);
    await db.exec(`CREATE TABLE IF NOT EXISTS stock_settings (item TEXT PRIMARY KEY, min_stock INTEGER)`);

    const settingsExist = await db.get('SELECT * FROM stock_settings LIMIT 1');
    if (!settingsExist) {
        await db.run('INSERT INTO stock_settings (item, min_stock) VALUES (?, ?)', ['Etiquetas', 130]);
        await db.run('INSERT INTO stock_settings (item, min_stock) VALUES (?, ?)', ['Ribbon', 20]);
    }

    const hash = await bcrypt.hash('discra', 10);
    const adminExists = await db.get('SELECT * FROM users WHERE username = ?', ['admin']);
    if (!adminExists) await db.run('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', hash]);

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
    try {
        const settings = await db.all('SELECT * FROM stock_settings');
        const minLabels = settings.find(s => s.item === 'Etiquetas')?.min_stock || 130;
        const minRibbons = settings.find(s => s.item === 'Ribbon')?.min_stock || 20;
        const data = await db.get(`SELECT SUM(etiqueta_entrada) - SUM(etiqueta_saida) as labels, SUM(ribbon_entrada) - SUM(ribbon_saida) as ribbons FROM stock_history`);
        const logs = await db.all('SELECT * FROM stock_history ORDER BY id DESC LIMIT 20');
        res.json({
            labels: { current: data.labels || 0, min: minLabels, percent: Math.round(((data.labels || 0) / minLabels) * 100) },
            ribbons: { current: data.ribbons || 0, min: minRibbons, percent: Math.round(((data.ribbons || 0) / minRibbons) * 100) },
            logs
        });
    } catch (e) { res.status(500).send(e.message); }
});

app.post('/api/stock/import', upload.single('file'), async (req, res) => {
    try {
        let movements;
        if (req.file) {
            const workbook = xlsx.readFile(req.file.path);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            movements = xlsx.utils.sheet_to_json(sheet, { range: 1 });
        } else {
            movements = req.body.movements;
        }

        for (const row of movements) {
            // Pula linhas de cabeçalho ou totais da planilha
            if (!row['DATA e HORA'] || row['DATA e HORA'] === 'TOTAL FINAL' || row['DATA e HORA'] === 'DATA e HORA') continue;

            await db.run(`INSERT INTO stock_history (data_hora, mes, tipo_movimentacao, etiqueta_entrada, etiqueta_saida, ribbon_entrada, ribbon_saida) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    excelDateToJS(row['DATA e HORA']),
                    row['MÊS'] || '',
                    row['TIPO DE MOVIMENTAÇÃO'] || 'Manual',
                    parseInt(row['ENTRADA']) || 0,
                    parseInt(row['SAIDA']) || 0,
                    parseInt(row['ENTRADA_1']) || 0,
                    parseInt(row['SAIDA_1']) || 0
                ]
            );
        }
        res.json({ message: "Sucesso!" });
    } catch (e) { res.status(500).send(e.message); }
});

app.use(express.static(path.join(__dirname, 'frontend/dist')));
app.use((req, res, next) => {
    if (req.url.startsWith('/api')) return next();
    res.sendFile(path.join(__dirname, 'frontend/dist', 'index.html'));
});

app.listen(7860, '0.0.0.0', () => console.log(`🚀 Online na porta 7860`));