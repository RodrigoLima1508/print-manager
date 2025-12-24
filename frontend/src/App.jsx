import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { 
  Monitor, CheckCircle, AlertTriangle, Plus, Trash2, 
  Search, Download, Printer as PrinterIcon, 
  LayoutDashboard, LogOut, MessageSquare, Edit3
} from 'lucide-react';

const API = "http://localhost:3001";

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [printers, setPrinters] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ model: '', ip: '', serial: '', status: 'Em uso', location: '' });
  
  // Estados de Modal/Edit/Log
  const [selectedPrinter, setSelectedPrinter] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [logs, setLogs] = useState([]);
  const [newLog, setNewLog] = useState('');

  const loadPrinters = () => axios.get(`${API}/printers`).then(res => setPrinters(res.data)).catch(() => setPrinters([]));

  useEffect(() => {
    if (token) {
      loadPrinters();
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

  // Dados para o Gráfico de Pizza
  const chartData = [
    { name: 'Online', value: printers.filter(p => p.online_status === 'Online').length, color: '#10b981' },
    { name: 'Offline', value: printers.filter(p => p.online_status === 'Offline').length, color: '#ef4444' },
    { name: 'Instável', value: printers.filter(p => p.online_status === 'Instável').length, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  if (!token) {
    return (
      <div style={loginScreenStyle}>
        <form onSubmit={handleLogin} style={loginCardStyle}>
          <PrinterIcon size={48} color="#2563eb" />
          <h2 style={{margin: '15px 0'}}>PrintManager Pro</h2>
          <input placeholder="Usuário" style={inputStyle} onChange={e => setUsername(e.target.value)} />
          <input type="password" placeholder="Senha" style={inputStyle} onChange={e => setPassword(e.target.value)} />
          <button type="submit" style={btnPrimaryFull}>Entrar</button>
        </form>
      </div>
    );
  }

  return (
    <div style={bodyStyle}>
      <aside style={sidebarStyle}>
        <div style={logoStyle}><PrinterIcon size={24}/> PrintManager</div>
        <nav style={{flex: 1}}><div style={navActive}><LayoutDashboard size={20}/> Painel Geral</div></nav>
        <button onClick={() => {localStorage.removeItem('token'); setToken(null)}} style={logoutBtn}><LogOut size={20}/> Sair</button>
      </aside>

      <main style={mainStyle}>
        <div style={headerStyle}>
          <h2>Painel de Monitoramento</h2>
          <button onClick={() => {
            const ws = XLSX.utils.json_to_sheet(printers);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Inventario");
            XLSX.writeFile(wb, "Relatorio.xlsx");
          }} style={btnExcel}><Download size={18}/> Exportar</button>
        </div>

        {/* Top Cards & Charts */}
        <div style={topGridStyle}>
          <div style={chartCardStyle}>
            <h4 style={{margin:0}}>Status da Rede</h4>
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie data={chartData} innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
                  {chartData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <StatCard title="Total" val={printers.length} color="#6366f1" />
          <StatCard title="Online" val={printers.filter(p => p.online_status === 'Online').length} color="#10b981" />
        </div>

        {/* Cadastro */}
        <div style={cardStyle}>
          <h4 style={{marginTop:0}}>Novo Equipamento</h4>
          <form onSubmit={async (e) => {
            e.preventDefault(); await axios.post(`${API}/printers`, form); loadPrinters();
            setForm({ model:'', ip:'', serial:'', status:'Em uso', location:'' });
          }} style={{display:'flex', gap:'10px'}}>
            <input placeholder="Modelo" value={form.model} onChange={e=>setForm({...form, model:e.target.value})} style={inputStyle} required/>
            <input placeholder="IP" value={form.ip} onChange={e=>setForm({...form, ip:e.target.value})} style={inputStyle} required/>
            <input placeholder="Serial" value={form.serial} onChange={e=>setForm({...form, serial:e.target.value})} style={inputStyle} required/>
            <button type="submit" style={btnAction}>Adicionar</button>
          </form>
        </div>

        {/* Tabela */}
        <div style={cardStyle}>
          <input placeholder="Pesquisar..." style={{...inputStyle, marginBottom:'20px'}} onChange={e=>setSearch(e.target.value)} />
          <table style={tableStyle}>
            <thead>
              <tr style={{textAlign:'left', borderBottom:'2px solid #f1f5f9'}}><th style={thStyle}>Modelo</th><th style={thStyle}>IP</th><th style={thStyle}>Status</th><th style={thStyle}>Ações</th></tr>
            </thead>
            <tbody>
              {printers.filter(p => p.model.toLowerCase().includes(search.toLowerCase()) || p.ip.includes(search)).map(p => (
                <tr key={p.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                  <td style={tdStyle}><b>{p.model}</b><br/><small>{p.serial}</small></td>
                  <td style={tdStyle}>{p.ip}</td>
                  <td style={tdStyle}>
                    <span style={{...badge, background: p.online_status==='Online'?'#dcfce7':'#fee2e2', color: p.online_status==='Online'?'#166534':'#991b1b'}}>
                      {p.online_status}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <button onClick={() => { setIsEditing(true); setEditForm(p); setSelectedPrinter(p.id); }} style={btnTool}><Edit3 size={16}/></button>
                    <button onClick={() => { setIsEditing(false); setSelectedPrinter(p.id); axios.get(`${API}/logs/${p.id}`).then(res=>setLogs(res.data)); }} style={btnTool}><MessageSquare size={16}/></button>
                    <button onClick={() => axios.delete(`${API}/printers/${p.id}`).then(loadPrinters)} style={{background:'none', border:'none', cursor:'pointer'}}><Trash2 size={18} color="red"/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal Único (Edição + Logs) */}
        {selectedPrinter && (
          <div style={overlayStyle}>
            <div style={modalStyle}>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                <h3>{isEditing ? "Editar Impressora" : "Histórico de Logs"}</h3>
                <button onClick={() => setSelectedPrinter(null)} style={{background:'none', border:'none', fontSize:'24px', cursor:'pointer'}}>×</button>
              </div>
              
              {isEditing ? (
                <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                  <input value={editForm.model} onChange={e=>setEditForm({...editForm, model:e.target.value})} style={inputStyle} />
                  <input value={editForm.ip} onChange={e=>setEditForm({...editForm, ip:e.target.value})} style={inputStyle} />
                  <input value={editForm.serial} onChange={e=>setEditForm({...editForm, serial:e.target.value})} style={inputStyle} />
                  <button onClick={async () => { await axios.put(`${API}/printers/${editForm.id}`, editForm); setSelectedPrinter(null); loadPrinters(); }} style={btnAction}>Salvar Alterações</button>
                </div>
              ) : (
                <>
                  <div style={logListStyle}>
                    {logs.map(l => <div key={l.id} style={logItemStyle}><small>{l.date}</small><br/>{l.content}</div>)}
                  </div>
                  <div style={{display:'flex', gap:'10px', marginTop:'15px'}}>
                    <input placeholder="Adicionar log..." style={inputStyle} value={newLog} onChange={e=>setNewLog(e.target.value)} />
                    <button onClick={async () => { await axios.post(`${API}/logs`, {printer_id:selectedPrinter, content:newLog}); setNewLog(''); axios.get(`${API}/logs/${selectedPrinter}`).then(res=>setLogs(res.data)); }} style={btnAction}>Gravar</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ESTILOS
const bodyStyle = { display:'flex', width:'100vw', height:'100vh', background:'#f8fafc', overflow:'hidden' };
const sidebarStyle = { width:'260px', background:'#1e293b', color:'white', padding:'30px', display:'flex', flexDirection:'column' };
const logoStyle = { fontSize:'22px', fontWeight:'bold', marginBottom:'40px', display:'flex', alignItems:'center', gap:'10px', color:'#38bdf8' };
const navActive = { display:'flex', alignItems:'center', gap:'12px', padding:'15px', background:'#334155', borderRadius:'12px' };
const logoutBtn = { background:'none', border:'none', color:'#f87171', cursor:'pointer', display:'flex', alignItems:'center', gap:'10px', fontSize:'16px' };
const mainStyle = { flex:1, padding:'40px', overflowY:'auto' };
const headerStyle = { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'30px' };
const topGridStyle = { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'20px', marginBottom:'30px' };
const chartCardStyle = { background:'white', padding:'20px', borderRadius:'16px', boxShadow:'0 2px 4px rgba(0,0,0,0.05)', display:'flex', flexDirection:'column', alignItems:'center' };
const cardStyle = { background:'white', padding:'25px', borderRadius:'16px', boxShadow:'0 2px 4px rgba(0,0,0,0.05)', marginBottom:'20px' };
const tableStyle = { width:'100%', borderCollapse:'collapse' };
const thStyle = { padding:'15px', color:'#64748b', fontSize:'13px' };
const tdStyle = { padding:'15px', fontSize:'14px' };
const inputStyle = { width:'100%', padding:'10px', borderRadius:'8px', border:'1px solid #e2e8f0', outline:'none' };
const btnAction = { background:'#2563eb', color:'white', border:'none', padding:'10px 20px', borderRadius:'8px', cursor:'pointer', fontWeight:'bold' };
const btnExcel = { background:'#10b981', color:'white', border:'none', padding:'10px 20px', borderRadius:'8px', cursor:'pointer', fontWeight:'bold', display:'flex', alignItems:'center', gap:'8px' };
const btnTool = { background:'#f1f5f9', border:'none', padding:'8px', borderRadius:'6px', cursor:'pointer', marginRight:'8px' };
const overlayStyle = { position:'fixed', top:0, left:0, width:'100vw', height:'100vh', background:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:1000 };
const modalStyle = { background:'white', padding:'30px', borderRadius:'20px', width:'500px' };
const logListStyle = { maxHeight:'250px', overflowY:'auto', padding:'15px', background:'#f8fafc', borderRadius:'12px' };
const logItemStyle = { background:'white', padding:'10px', borderRadius:'8px', marginBottom:'10px', border:'1px solid #e2e8f0' };
const loginScreenStyle = { width:'100vw', height:'100vh', background:'#0f172a', display:'flex', justifyContent:'center', alignItems:'center' };
const loginCardStyle = { background:'white', padding:'40px', borderRadius:'20px', width:'350px', textAlign:'center' };
const btnPrimaryFull = { width:'100%', padding:'12px', background:'#2563eb', color:'white', border:'none', borderRadius:'8px', fontWeight:'bold', cursor:'pointer', marginTop:'15px' };
const badge = { padding:'4px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:'bold' };

const StatCard = ({title, val, color}) => (
  <div style={{...chartCardStyle, alignItems:'flex-start'}}>
    <span style={{color:'#64748b', fontSize:'14px'}}>{title}</span>
    <h2 style={{margin:'10px 0', fontSize:'32px', color}}>{val}</h2>
  </div>
);

export default App;