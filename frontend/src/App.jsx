import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Printer as PrinterIcon, LayoutDashboard, LogOut, Activity, FileUp, Trash2, Download } from 'lucide-react';

const API = window.location.hostname === "localhost" ? "http://localhost:7860/api" : "/api";

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [printers, setPrinters] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [form, setForm] = useState({ model: '', ip: '', serial: '' });
  const [stockData, setStockData] = useState({ labels: {current:0, min:130, percent:0}, ribbons: {current:0, min:20, percent:0}, logs: [] });
  
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

  const handleDateChange = (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 8);
    if (v.length >= 5) v = `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`;
    else if (v.length >= 3) v = `${v.slice(0, 2)}/${v.slice(2)}`;
    e.target.value = v;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      await axios.post(`${API}/stock/import`, formData);
      loadStock();
      alert("Planilha importada com sucesso!");
    } catch { alert("Erro na importação!"); }
    finally { e.target.value = null; }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API}/login`, { username, password });
      localStorage.setItem('token', res.data.token);
      setToken(res.data.token);
    } catch { alert("Login Inválido!"); }
  };

  const StockCard = ({ title, data, color }) => {
    const isLow = data.percent < 100;
    return (
      <div style={{ ...cardStyle, flex: 1, borderTop: `4px solid ${isLow ? '#ef4444' : color}` }}>
        <span style={labelStyle}>{title}</span>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '36px', margin: '10px 0' }}>{data.current} <small style={{fontSize:'14px'}}>un</small></h2>
          <span style={{ color: isLow ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>{data.percent}%</span>
        </div>
        <div style={{ width: '100%', height: '8px', background: '#222', borderRadius: '4px', marginTop: '10px' }}>
          <div style={{ width: `${Math.min(data.percent, 100)}%`, height: '100%', background: isLow ? '#ef4444' : color, borderRadius: '4px' }}></div>
        </div>
        <p style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>Mínimo: {data.min}</p>
      </div>
    );
  };

  const chartData = [
    { name: 'Online', value: (printers || []).filter(p => p.online_status === 'Online').length, color: '#10b981' },
    { name: 'Offline', value: (printers || []).filter(p => p.online_status === 'Offline').length, color: '#ef4444' },
    { name: 'Instável', value: (printers || []).filter(p => p.online_status === 'Instável').length, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  if (!token) return (
    <div style={loginScreenStyle}>
      <form onSubmit={handleLogin} style={loginCardStyle}>
        <PrinterIcon size={48} color="#2563eb" />
        <h2 style={{color: '#000', marginBottom: '20px'}}>PrintManager Pro</h2>
        <input placeholder="Usuário" style={inputStyleLight} onChange={e => setUsername(e.target.value)} />
        <input type="password" placeholder="Senha" style={inputStyleLight} onChange={e => setPassword(e.target.value)} />
        <button type="submit" style={btnPrimaryFull}>Entrar</button>
      </form>
    </div>
  );

  return (
    <div style={bodyStyle}>
      <aside style={sidebarStyle}>
        <div style={logoStyle}><PrinterIcon size={24}/> PrintManager</div>
        <nav style={{flex: 1}}>
          <div onClick={() => setActiveTab('dashboard')} style={activeTab === 'dashboard' ? navActive : navItem}><LayoutDashboard size={20}/> Painel Geral</div>
          <div onClick={() => setActiveTab('estoque')} style={activeTab === 'estoque' ? navActive : navItem}><Activity size={20}/> Etiquetas e Ribbons</div>
        </nav>
        <button onClick={() => {localStorage.removeItem('token'); setToken(null)}} style={logoutBtn}><LogOut size={20}/> Sair</button>
      </aside>

      <main style={mainStyle}>
        {activeTab === 'dashboard' ? (
          <>
            <div style={headerStyle}>
              <h2>Monitoramento</h2>
              <button onClick={() => {
                const ws = XLSX.utils.json_to_sheet(printers);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Inventario");
                XLSX.writeFile(wb, "Relatorio.xlsx");
              }} style={btnExcel}><Download size={18}/> Exportar Excel</button>
            </div>
            <div style={cardStyle}>
              <h4 style={{marginTop:0, color: '#38bdf8'}}>Adicionar Novo</h4>
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
            <div style={cardStyle}>
              <table style={tableStyle}>
                <thead><tr><th>Setor</th><th>IP</th><th>Status</th><th>Ações</th></tr></thead>
                <tbody>
                  {printers.map(p => (
                    <tr key={p.id} style={{borderBottom:'1px solid #222'}}>
                      <td>{p.model}</td><td>{p.ip}</td>
                      <td><span style={{...badge, background: p.online_status==='Online'?'#064e3b':'#7f1d1d'}}>{p.online_status}</span></td>
                      <td><button onClick={() => axios.delete(`${API}/printers/${p.id}`).then(loadPrinters)} style={{background:'none', border:'none'}}><Trash2 size={18} color="#ef4444"/></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div>
            <div style={headerStyle}>
              <h2>Controle de Estoque</h2>
              <label style={btnImport}><FileUp size={18}/> Importar Planilha <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} /></label>
            </div>
            <div style={topGridStyle}>
                <StockCard title="ETIQUETAS" data={stockData.labels} color="#6366f1" />
                <StockCard title="RIBBONS" data={stockData.ribbons} color="#ec4899" />
            </div>

            <div style={cardStyle}>
                <h4 style={{marginTop:0, color: '#38bdf8'}}>Nova Movimentação Manual</h4>
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    const tipo = e.target.tipo.value;
                    const etiqVal = parseInt(e.target.etiq.value) || 0;
                    const ribVal = parseInt(e.target.rib.value) || 0;
                    const move = {
                        'DATA e HORA': e.target.data.value || new Date().toLocaleDateString('pt-BR'),
                        'MÊS': new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date()).toUpperCase(),
                        'TIPO DE MOVIMENTAÇÃO': tipo,
                        'ENTRADA': tipo === 'Entrada' ? etiqVal : 0, 'SAIDA': tipo === 'Saida' ? etiqVal : 0,
                        'ENTRADA_1': tipo === 'Entrada' ? ribVal : 0, 'SAIDA_1': tipo === 'Saida' ? ribVal : 0
                    };
                    try {
                        await axios.post(`${API}/stock/import`, { movements: [move] }); 
                        loadStock();
                        e.target.reset();
                        alert("Salvo com sucesso!");
                    } catch { alert("Erro ao salvar!"); }
                }} style={{display:'flex', gap:'10px', flexWrap:'wrap'}}>
                    <select name="tipo" style={inputStyleDark} required>
                        <option value="Entrada">Entrada</option>
                        <option value="Saida">Saída</option>
                    </select>
                    <input name="etiq" type="number" placeholder="Etiquetas" style={inputStyleDark} />
                    <input name="rib" type="number" placeholder="Ribbons" style={inputStyleDark} />
                    <input name="data" type="text" placeholder="Data (DD/MM/AAAA)" style={inputStyleDark} onChange={handleDateChange} maxLength="10" />
                    <button type="submit" style={btnAction}>Lançar</button>
                </form>
            </div>

            <div style={cardStyle}>
              <h3 style={{ marginBottom: '20px', color: '#94a3b8' }}>Histórico Consolidado</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#64748b', borderBottom: '2px solid #222' }}>
                    <th style={{ padding: '12px' }}>Data</th>
                    <th style={{ padding: '12px' }}>Tipo</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Etiquetas</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Ribbons</th>
                  </tr>
                </thead>
                <tbody>
                  {stockData.logs?.map((log) => {
                    const etiqValue = log.etiqueta_entrada > 0 ? `+${log.etiqueta_entrada}` : (log.etiqueta_saida > 0 ? `-${log.etiqueta_saida}` : null);
                    const ribValue = log.ribbon_entrada > 0 ? `+${log.ribbon_entrada}` : (log.ribbon_saida > 0 ? `-${log.ribbon_saida}` : null);
                    
                    const etiqColor = log.etiqueta_entrada > 0 ? '#10b981' : (log.etiqueta_saida > 0 ? '#ef4444' : 'transparent');
                    const ribColor = log.ribbon_entrada > 0 ? '#10b981' : (log.ribbon_saida > 0 ? '#ef4444' : 'transparent');

                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid #111', fontSize: '14px' }}>
                        <td style={{ padding: '12px', color: '#94a3b8' }}>{log.data_hora}</td>
                        <td style={{ padding: '12px' }}>
                          {log.tipo_movimentacao && (
                            <span style={{ 
                              ...badge, 
                              background: log.tipo_movimentacao === 'Entrada' ? '#064e3b' : '#450a0a', 
                              color: log.tipo_movimentacao === 'Entrada' ? '#34d399' : '#fca5a5' 
                            }}>
                              {log.tipo_movimentacao}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', color: etiqColor, fontWeight: 'bold' }}>
                          {etiqValue || '-'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', color: ribColor, fontWeight: 'bold' }}>
                          {ribValue || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

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
const inputStyleLight = { width:'100%', padding:'12px', borderRadius:'8px', border:'1px solid #ddd', marginBottom:'10px', color:'#000' };
const btnAction = { background:'#2563eb', color:'white', border:'none', padding:'0 25px', borderRadius:'8px', cursor:'pointer', fontWeight:'bold' };
const btnExcel = { background:'#10b981', color:'white', border:'none', padding:'10px 20px', borderRadius:'8px', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px' };
const btnImport = { background:'#6366f1', color:'white', border:'none', padding:'12px 25px', borderRadius:'10px', cursor:'pointer', display:'flex', alignItems:'center', gap:'10px', fontWeight:'bold' };
const logoutBtn = { background:'none', border:'none', color:'#f87171', cursor:'pointer', display:'flex', alignItems:'center', gap:'10px', marginTop:'auto' };
const tableStyle = { width:'100%', borderCollapse:'collapse' };
const badge = { padding:'5px 12px', borderRadius:'20px', fontSize:'12px', fontWeight:'bold' };
const labelStyle = { color:'#94a3b8', fontSize:'12px', fontWeight:'bold' };
const loginScreenStyle = { width:'100vw', height:'100vh', background:'#000', display:'flex', justifyContent:'center', alignItems:'center' };
const loginCardStyle = { background:'white', padding:'40px', borderRadius:'20px', width:'320px', textAlign:'center', color:'#000' };
const btnPrimaryFull = { width:'100%', padding:'12px', background:'#2563eb', color:'white', border:'none', borderRadius:'8px', fontWeight:'bold', cursor:'pointer' };

const StatCard = ({title, val, color}) => (
  <div style={{...cardStyle, flex:1, marginBottom:0}}>
    <span style={{color:'#64748b', fontSize:'12px', fontWeight:'bold'}}>{title}</span>
    <h2 style={{color, fontSize:'32px', margin:'10px 0'}}>{val}</h2>
  </div>
);

export default App;