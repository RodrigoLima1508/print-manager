import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { 
  Monitor, CheckCircle, AlertTriangle, Plus, Trash2, 
  Search, Download, Printer as PrinterIcon, 
  LayoutDashboard, LogOut, MessageSquare, Edit3, Activity, FileUp
} from 'lucide-react';

// Removi o localhost e deixe apenas o prefixo /api que configurei no server.js
const API = "/api";

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [printers, setPrinters] = useState([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState('dashboard');
  const [form, setForm] = useState({ model: '', ip: '', serial: '' });
  const [stockData, setStockData] = useState({ stock: { etiquetas: 0, ribbons: 0 }, logs: [] });
  
  const loadPrinters = () => axios.get(`${API}/printers`).then(res => setPrinters(res.data)).catch(() => setPrinters([]));
  const loadStock = () => axios.get(`${API}/stock`).then(res => setStockData(res.data)).catch(() => {});

  useEffect(() => {
    if (token) {
      loadPrinters();
      loadStock();
      const interval = setInterval(loadPrinters, 5000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API}/login`, { username, password });
      localStorage.setItem('token', res.data.token);
      setToken(res.data.token);
    } catch { alert("Login Inválido!"); }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const data = XLSX.utils.sheet_to_json(XLSX.read(evt.target.result, { type: 'binary' }).Sheets[XLSX.read(evt.target.result, { type: 'binary' }).SheetNames[0]]);
      try {
        await axios.post(`${API}/stock/import`, { movements: data });
        loadStock();
        alert("Importação concluída!");
      } catch { alert("Erro na importação."); }
    };
    reader.readAsBinaryString(file);
  };

  // Dados do Gráfico (Restauração)
  const chartData = [
    { name: 'Online', value: printers.filter(p => p.online_status === 'Online').length, color: '#10b981' },
    { name: 'Offline', value: printers.filter(p => p.online_status === 'Offline').length, color: '#ef4444' },
    { name: 'Instável', value: printers.filter(p => p.online_status === 'Instável').length, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  if (!token) return (
    <div style={loginScreenStyle}>
      <form onSubmit={handleLogin} style={loginCardStyle}>
        <PrinterIcon size={48} color="#2563eb" />
        <h2 style={{margin: '15px 0', color: '#000'}}>PrintManager Pro</h2>
        <input placeholder="Usuário" style={inputStyleLight} onChange={e => setUsername(e.target.value)} />
        <input type="password" placeholder="Senha" style={inputStyleLight} onChange={e => setPassword(e.target.value)} />
        <button type="submit" style={btnPrimaryFull}>Entrar</button>
      </form>
    </div>
  );

  return (
    <div style={bodyStyle}>
      {/* Sidebar - Preto Total */}
      <aside style={sidebarStyle}>
        <div style={logoStyle}><PrinterIcon size={24}/> PrintManager</div>
        <nav style={{flex: 1}}>
          <div onClick={() => setActiveTab('dashboard')} style={activeTab === 'dashboard' ? navActive : navItem}>
            <LayoutDashboard size={20}/> Painel Geral
          </div>
          <div onClick={() => setActiveTab('estoque')} style={activeTab === 'estoque' ? navActive : navItem}>
            <Activity size={20}/> Etiquetas e Ribbons
          </div>
        </nav>
        <button onClick={() => {localStorage.removeItem('token'); setToken(null)}} style={logoutBtn}><LogOut size={20}/> Sair</button>
      </aside>

      <main style={mainStyle}>
        {activeTab === 'dashboard' ? (
          <>
            <div style={headerStyle}>
              <h2>Monitoramento em Tempo Real</h2>
              <button onClick={() => {
                const ws = XLSX.utils.json_to_sheet(printers);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Inventario");
                XLSX.writeFile(wb, "Relatorio.xlsx");
              }} style={btnExcel}><Download size={18}/> Exportar Excel</button>
            </div>

            {/* Seção do Gráfico */}
            <div style={topGridStyle}>
              <div style={chartCardStyle}>
                <h4 style={{margin:0, color:'#94a3b8'}}>Status da Rede</h4>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={chartData} innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value">
                      {chartData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{background:'#111', border:'none', color:'white'}} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <StatCard title="Total Equipamentos" val={printers.length} color="#6366f1" />
              <StatCard title="Status Online" val={printers.filter(p => p.online_status === 'Online').length} color="#10b981" />
            </div>

            {/* Cadastro de Impressoras */}
            <div style={cardStyle}>
              <h4 style={{marginTop:0, color: '#38bdf8'}}>Adicionar Novo Equipamento</h4>
              <form onSubmit={async (e) => {
                e.preventDefault(); await axios.post(`${API}/printers`, form); loadPrinters();
                setForm({ model:'', ip:'', serial:'' });
              }} style={{display:'flex', gap:'15px'}}>
                <input placeholder="Setor" value={form.model} onChange={e=>setForm({...form, model:e.target.value})} style={inputStyleDark} required/>
                <input placeholder="IP" value={form.ip} onChange={e=>setForm({...form, ip:e.target.value})} style={inputStyleDark} required/>
                <input placeholder="Serial" value={form.serial} onChange={e=>setForm({...form, serial:e.target.value})} style={inputStyleDark} required/>
                <button type="submit" style={btnAction}>Adicionar</button>
              </form>
            </div>

            {/* Tabela de Impressoras */}
            <div style={cardStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr style={{textAlign:'left', color:'#94a3b8', borderBottom:'1px solid #333'}}>
                    <th style={tdStyle}>Setor / Serial</th>
                    <th style={tdStyle}>IP</th>
                    <th style={tdStyle}>Status</th>
                    <th style={tdStyle}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {printers.map(p => (
                    <tr key={p.id} style={{borderBottom:'1px solid #222'}}>
                      <td style={tdStyle}><b>{p.model}</b><br/><small style={{color:'#64748b'}}>{p.serial}</small></td>
                      <td style={tdStyle}>{p.ip}</td>
                      <td style={tdStyle}>
                        <span style={{...badge, background: p.online_status==='Online'?'#064e3b':'#7f1d1d', color: p.online_status==='Online'?'#34d399':'#fca5a5'}}>
                          {p.online_status}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <button onClick={() => axios.delete(`${API}/printers/${p.id}`).then(loadPrinters)} style={{background:'none', border:'none', cursor:'pointer'}}><Trash2 size={18} color="#ef4444"/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            <div style={headerStyle}>
              <h2>Controle de Insumos</h2>
              <label style={btnImport}>
                <FileUp size={18}/> Importar Planilha <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>
            <div style={topGridStyle}>
              <div style={{ ...cardStyle, flex: 1, borderLeft: '6px solid #6366f1' }}>
                <span style={labelStyle}>SALDO ETIQUETAS</span>
                <h2 style={{ fontSize: '42px', margin: '10px 0' }}>{stockData.stock?.etiquetas || 0}</h2>
              </div>
              <div style={{ ...cardStyle, flex: 1, borderLeft: '6px solid #ec4899' }}>
                <span style={labelStyle}>SALDO RIBBONS</span>
                <h2 style={{ fontSize: '42px', margin: '10px 0' }}>{stockData.stock?.ribbons || 0}</h2>
              </div>
            </div>
            <div style={cardStyle}>
              <h3>Histórico de Movimentações</h3>
              <table style={tableStyle}>
                <thead><tr style={{textAlign:'left', color:'#94a3b8', borderBottom:'1px solid #333'}}><th style={tdStyle}>Data</th><th style={tdStyle}>Tipo</th><th style={tdStyle}>Etiq.</th><th style={tdStyle}>Rib.</th><th style={tdStyle}>Obs</th></tr></thead>
                <tbody>
                  {stockData.logs?.map(log => (
                    <tr key={log.id} style={{borderBottom:'1px solid #222'}}><td style={tdStyle}><small>{log.data}</small></td><td style={tdStyle}>{log.tipo}</td><td style={tdStyle}>{log.etiquetas_qtd}</td><td style={tdStyle}>{log.ribbons_qtd}</td><td style={tdStyle}><small>{log.obs}</small></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ESTILOS - PRETO TOTAL
const bodyStyle = { display:'flex', width:'100vw', height:'100vh', background:'#000000', color:'#fff', overflow:'hidden' };
const sidebarStyle = { width:'260px', background:'#0a0a0a', padding:'30px', display:'flex', flexDirection:'column', borderRight:'1px solid #222' };
const logoStyle = { fontSize:'22px', fontWeight:'bold', marginBottom:'40px', color:'#38bdf8', display:'flex', alignItems:'center', gap:'10px' };
const navItem = { display:'flex', alignItems:'center', gap:'12px', padding:'15px', borderRadius:'12px', cursor:'pointer', marginBottom:'10px', color:'#64748b' };
const navActive = { ...navItem, background:'#1a1a1a', color:'#38bdf8' };
const mainStyle = { flex:1, padding:'40px', overflowY:'auto' };
const headerStyle = { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'30px' };
const cardStyle = { background:'#0f0f0f', padding:'25px', borderRadius:'16px', border:'1px solid #222', marginBottom:'20px' };
const chartCardStyle = { ...cardStyle, flex:1, display:'flex', flexDirection:'column', alignItems:'center', marginBottom:0 };
const topGridStyle = { display:'flex', gap:'20px', marginBottom:'30px' };
const inputStyleDark = { flex:1, padding:'12px', borderRadius:'8px', border:'1px solid #333', background:'#000', color:'white', outline:'none' };
const inputStyleLight = { width:'100%', padding:'12px', borderRadius:'8px', border:'1px solid #ddd', marginBottom:'10px' };
const btnAction = { background:'#2563eb', color:'white', border:'none', padding:'0 25px', borderRadius:'8px', cursor:'pointer', fontWeight:'bold' };
const btnExcel = { background:'#10b981', color:'white', border:'none', padding:'10px 20px', borderRadius:'8px', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px' };
const btnImport = { background:'#6366f1', color:'white', border:'none', padding:'12px 25px', borderRadius:'10px', cursor:'pointer', display:'flex', alignItems:'center', gap:'10px', fontWeight:'bold' };
const logoutBtn = { background:'none', border:'none', color:'#f87171', cursor:'pointer', display:'flex', alignItems:'center', gap:'10px', marginTop:'auto' };
const tableStyle = { width:'100%', borderCollapse:'collapse' };
const tdStyle = { padding:'15px' };
const badge = { padding:'5px 12px', borderRadius:'20px', fontSize:'12px', fontWeight:'bold' };
const labelStyle = { color:'#94a3b8', fontSize:'12px', fontWeight:'bold' };
const loginScreenStyle = { width:'100vw', height:'100vh', background:'#000', display:'flex', justifyContent:'center', alignItems:'center' };
const loginCardStyle = { background:'white', padding:'40px', borderRadius:'20px', width:'320px', textAlign:'center' };
const btnPrimaryFull = { width:'100%', padding:'12px', background:'#2563eb', color:'white', border:'none', borderRadius:'8px', fontWeight:'bold', cursor:'pointer' };

const StatCard = ({title, val, color}) => (
  <div style={{...cardStyle, flex:1, marginBottom:0}}>
    <span style={{color:'#64748b', fontSize:'12px', fontWeight:'bold'}}>{title}</span>
    <h2 style={{color, fontSize:'32px', margin:'10px 0'}}>{val}</h2>
  </div>
);

export default App;