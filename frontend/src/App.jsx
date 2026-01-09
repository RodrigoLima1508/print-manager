import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Printer as PrinterIcon, LayoutDashboard, LogOut, Activity, FileUp, Trash2, Edit3, X, Save, Info } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const API = `http://${window.location.hostname}:7860/api`;

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [printers, setPrinters] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [form, setForm] = useState({ model: '', ip: '', serial: '', obs: '' });
  const [stockData, setStockData] = useState({ labels: {current:0, min:130, percent:0}, ribbons: {current:0, min:20, percent:0}, logs: [] });
  const [editingLog, setEditingLog] = useState(null);

  const loadPrinters = () => axios.get(`${API}/printers`).then(res => setPrinters(res.data)).catch(() => setPrinters([]));
  const loadStock = () => axios.get(`${API}/stock`).then(res => setStockData(res.data)).catch(() => {});

  useEffect(() => {
    if (token) {
      loadPrinters();
      loadStock();
      const interval = setInterval(loadPrinters, 10000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      await axios.post(`${API}/stock/import`, formData);
      loadStock();
      alert("Sucesso!");
    } catch { alert("Erro!"); }
    finally { e.target.value = null; }
  };

  const handleDeleteLog = async (id) => {
    if (window.confirm("Excluir esta movimentação?")) {
      await axios.delete(`${API}/stock/logs/${id}`);
      loadStock();
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API}/stock/logs/${editingLog.id}`, editingLog);
      setEditingLog(null);
      loadStock();
    } catch { alert("Erro ao salvar"); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API}/login`, { username, password });
      localStorage.setItem('token', res.data.token);
      setToken(res.data.token);
    } catch { alert("Login Inválido!"); }
  };

  const StockCard = ({ title, data, color }) => (
    <div style={{ ...cardStyle, flex: 1, borderTop: `4px solid ${color}` }}>
      <span style={labelStyle}>{title}</span>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '32px', margin: '8px 0' }}>{data.current}</h2>
        <span style={{ color, fontWeight: 'bold' }}>{data.percent}%</span>
      </div>
      <div style={{ width: '100%', height: '6px', background: '#222', borderRadius: '4px' }}>
        <div style={{ width: `${Math.min(data.percent, 100)}%`, height: '100%', background: color, borderRadius: '4px' }}></div>
      </div>
    </div>
  );

  if (!token) return (
    <div style={loginScreenStyle}>
      <form onSubmit={handleLogin} style={loginCardStyle}>
        <PrinterIcon size={48} color="#2563eb" />
        <h2 style={{color: '#000', margin: '15px 0'}}>PrintManager</h2>
        <input placeholder="Usuário" style={inputStyleLight} onChange={e => setUsername(e.target.value)} />
        <input type="password" placeholder="Senha" style={inputStyleLight} onChange={e => setPassword(e.target.value)} />
        <button type="submit" style={btnPrimaryFull}>Entrar</button>
      </form>
    </div>
  );

  return (
    <div style={bodyStyle}>
      <aside style={sidebarStyle}>
        <div style={logoStyle}><PrinterIcon size={22}/> PrintManager</div>
        <nav style={{flex: 1}}>
          <div onClick={() => setActiveTab('dashboard')} style={activeTab === 'dashboard' ? navActive : navItem}><LayoutDashboard size={18}/> Painel</div>
          <div onClick={() => setActiveTab('estoque')} style={activeTab === 'estoque' ? navActive : navItem}><Activity size={18}/> Estoque</div>
        </nav>
        <button onClick={() => {localStorage.removeItem('token'); setToken(null)}} style={logoutBtn}><LogOut size={18}/> Sair</button>
      </aside>

      <main style={mainStyle}>
        {activeTab === 'dashboard' ? (
          <>
            <div style={headerStyle}>
              <h2>Monitoramento</h2>
              <div style={{display: 'flex', gap: '10px'}}>
                <div style={miniStat}><span style={{color: '#10b981'}}>●</span> {printers.filter(p => p.online_status === 'Online').length} Online</div>
                <div style={miniStat}><span style={{color: '#ef4444'}}>●</span> {printers.filter(p => p.online_status === 'Offline').length} Offline</div>
                <div style={miniStat}><span style={{color: '#64748b'}}>●</span> {printers.filter(p => !p.ip).length} Backup</div>
              </div>
            </div>
            
            <div style={{display: 'flex', gap: '20px', marginBottom: '20px', alignItems: 'stretch'}}>
              {/* GRÁFICO DE DISPONIBILIDADE */}
              <div style={{...cardStyle, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '250px'}}>
                <div style={{width: '120px', height: '120px', position: 'relative'}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Online', value: printers.filter(p => p.online_status === 'Online').length },
                          { name: 'Offline', value: printers.filter(p => p.online_status === 'Offline').length },
                          { name: 'Backup', value: printers.filter(p => !p.ip).length }
                        ]}
                        innerRadius={40}
                        outerRadius={55}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell fill="#10b981" stroke="none" />
                        <Cell fill="#ef4444" stroke="none" />
                        <Cell fill="#334155" stroke="none" />
                      </Pie>
                      <Tooltip contentStyle={{background: '#000', border: '1px solid #222', fontSize: '12px'}} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center'}}>
                    <div style={{fontSize: '18px', fontWeight: 'bold'}}>
                      {printers.length > 0 ? Math.round((printers.filter(p => p.online_status === 'Online').length / printers.length) * 100) : 0}%
                    </div>
                  </div>
                </div>
                <div style={{marginLeft: '15px'}}>
                   <div style={{fontSize: '10px', color: '#444', fontWeight: 'bold'}}>SAÚDE DA REDE</div>
                   <div style={{fontSize: '12px', color: '#94a3b8'}}>Status Geral</div>
                </div>
              </div>

              {/* FORMULÁRIO DE ADIÇÃO */}
              <div style={{...cardStyle, flex: 2.5}}>
                <form onSubmit={async (e) => {
                  e.preventDefault(); await axios.post(`${API}/printers`, form); loadPrinters();
                  setForm({ model:'', ip:'', serial:'', obs:'' });
                }} style={{display:'flex', flexDirection:'column', gap:'10px', height: '100%', justifyContent: 'center'}}>
                  <div style={rowStyle}>
                      <input placeholder="Modelo / Setor" value={form.model} onChange={e=>setForm({...form, model:e.target.value})} style={{...inputFlat, flex: 2}} required/>
                      <input placeholder="IP (Vazio = Backup)" value={form.ip} onChange={e=>setForm({...form, ip:e.target.value})} style={{...inputFlat, flex: 1}}/>
                      <input placeholder="Serial" value={form.serial} onChange={e=>setForm({...form, serial:e.target.value})} style={{...inputFlat, flex: 1}}/>
                  </div>
                  <div style={rowStyle}>
                      <input placeholder="Observações (Opcional)" value={form.obs} onChange={e=>setForm({...form, obs:e.target.value})} style={{...inputFlat, flex: 1}}/>
                      <button type="submit" style={{...btnAction, height: '38px'}}>Adicionar</button>
                  </div>
                </form>
              </div>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px'}}>
              {printers.map(p => (
                <div key={p.id} style={{...cardStyle, borderLeft: `4px solid ${!p.ip ? '#444' : (p.online_status === 'Online' ? '#10b981' : '#ef4444')}`}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                    <div>
                      <h3 style={{margin: '0 0 4px 0', fontSize: '15px'}}>{p.model}</h3>
                      <p style={{margin: 0, fontSize: '11px', color: '#64748b'}}>{p.ip || 'DISPOSITIVO BACKUP'} • {p.serial || 'S/N'}</p>
                    </div>
                    <button onClick={() => axios.delete(`${API}/printers/${p.id}`).then(loadPrinters)} style={btnGhost}><Trash2 size={16} color="#444"/></button>
                  </div>
                  
                  {p.obs && (
                    <div style={{marginTop: '10px', fontSize: '11px', color: '#94a3b8', background: '#050505', padding: '6px', borderRadius: '4px', display:'flex', gap:'5px', alignItems:'center', border: '1px solid #111'}}>
                      <Info size={12} color="#38bdf8"/> {p.obs}
                    </div>
                  )}

                  <div style={{marginTop: '15px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <div style={{
                        width: '8px', height: '8px', borderRadius: '50%', 
                        background: !p.ip ? '#444' : (p.online_status === 'Online' ? '#10b981' : '#ef4444'),
                        boxShadow: p.online_status === 'Online' && p.ip ? '0 0 8px #10b981' : 'none'
                    }}></div>
                    <span style={{fontSize: '11px', fontWeight: 'bold', color: !p.ip ? '#64748b' : (p.online_status === 'Online' ? '#10b981' : '#ef4444')}}>
                      {!p.ip ? 'DISPONÍVEL' : p.online_status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Seção de Estoque */
          <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
            <div style={headerStyle}>
              <h2>Estoque</h2>
              <label style={btnImport}><FileUp size={18}/> Importar <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} /></label>
            </div>
            
            <div style={topGridStyle}>
              <StockCard title="ETIQUETAS" data={stockData.labels} color="#6366f1" />
              <StockCard title="RIBBONS" data={stockData.ribbons} color="#ec4899" />
            </div>

            <div style={cardStyle}>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const tipo = e.target.tipo.value;
                const valE = parseInt(e.target.etiq.value) || 0;
                const valR = parseInt(e.target.rib.value) || 0;
                const dataM = e.target.data.value || new Date().toLocaleDateString('pt-BR');
                await axios.post(`${API}/stock/manual`, {
                  data_hora: dataM, mes: 'MANUAL', tipo_movimentacao: tipo,
                  etiqueta_entrada: tipo === 'Entrada' ? valE : 0, etiqueta_saida: tipo === 'Saída' ? valE : 0,
                  ribbon_entrada: tipo === 'Entrada' ? valR : 0, ribbon_saida: tipo === 'Saída' ? valR : 0
                });
                loadStock(); e.target.reset();
              }} style={rowStyle}>
                <select name="tipo" style={{...inputFlat, width: 'auto'}}><option>Entrada</option><option>Saída</option></select>
                <input name="etiq" placeholder="Etiquetas" type="number" style={inputFlat}/>
                <input name="rib" placeholder="Ribbons" type="number" style={inputFlat}/>
                <input name="data" placeholder="DD/MM/AAAA" style={inputFlat} maxLength="10"/>
                <button type="submit" style={btnAction}>Lançar</button>
              </form>
            </div>

            <div style={cardStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr style={{ color: '#64748b', fontSize: '12px' }}>
                    <th>Data</th><th>Tipo</th><th style={{textAlign:'center'}}>Etiquetas</th><th style={{textAlign:'center'}}>Ribbons</th><th style={{textAlign:'right'}}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {stockData.logs?.map((log) => (
                    <tr key={log.id} style={trStyle}>
                      <td style={{ color: '#94a3b8' }}>{log.data_hora}</td>
                      <td><span style={{ ...badge, background: log.tipo_movimentacao === 'Entrada' ? '#064e3b' : '#450a0a' }}>{log.tipo_movimentacao}</span></td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: log.etiqueta_entrada > 0 ? '#10b981' : '#ef4444' }}>{log.etiqueta_entrada > 0 ? `+${log.etiqueta_entrada}` : `-${log.etiqueta_saida}`}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: log.ribbon_entrada > 0 ? '#10b981' : '#ef4444' }}>{log.ribbon_entrada > 0 ? `+${log.ribbon_entrada}` : `-${log.ribbon_saida}`}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                          <button onClick={() => setEditingLog(log)} style={btnGhost}><Edit3 size={16} color="#38bdf8"/></button>
                          <button onClick={() => handleDeleteLog(log.id)} style={btnGhost}><Trash2 size={16} color="#ef4444"/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {editingLog && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
              <h3 style={{margin:0}}>Editar</h3>
              <button onClick={() => setEditingLog(null)} style={btnGhost}><X size={20}/></button>
            </div>
            <form onSubmit={handleSaveEdit} style={{display:'flex', flexDirection:'column', gap:'15px'}}>
              <div style={rowStyle}>
                <div style={{flex:1}}><label style={miniLabel}>Data</label><input value={editingLog.data_hora} style={inputFlat} onChange={e => setEditingLog({...editingLog, data_hora: e.target.value})}/></div>
                <div style={{flex:1}}><label style={miniLabel}>Tipo</label><select value={editingLog.tipo_movimentacao} style={inputFlat} onChange={e => setEditingLog({...editingLog, tipo_movimentacao: e.target.value})}><option>Entrada</option><option>Saída</option></select></div>
              </div>
              <div style={rowStyle}>
                <div style={{flex:1}}><label style={miniLabel}>Etiq. Ent.</label><input type="number" value={editingLog.etiqueta_entrada} style={inputFlat} onChange={e => setEditingLog({...editingLog, etiqueta_entrada: parseInt(e.target.value)||0})}/></div>
                <div style={{flex:1}}><label style={miniLabel}>Etiq. Sai.</label><input type="number" value={editingLog.etiqueta_saida} style={inputFlat} onChange={e => setEditingLog({...editingLog, etiqueta_saida: parseInt(e.target.value)||0})}/></div>
              </div>
              <div style={rowStyle}>
                <div style={{flex:1}}><label style={miniLabel}>Ribbon Ent.</label><input type="number" value={editingLog.ribbon_entrada} style={inputFlat} onChange={e => setEditingLog({...editingLog, ribbon_entrada: parseInt(e.target.value)||0})}/></div>
                <div style={{flex:1}}><label style={miniLabel}>Ribbon Sai.</label><input type="number" value={editingLog.ribbon_saida} style={inputFlat} onChange={e => setEditingLog({...editingLog, ribbon_saida: parseInt(e.target.value)||0})}/></div>
              </div>
              <button type="submit" style={btnPrimaryFull}><Save size={18} style={{marginRight:'8px'}}/> Salvar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ESTILOS
const miniStat = { background: '#111', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #222' };
const bodyStyle = { display:'flex', width:'100vw', height:'100vh', background:'#000', color:'#fff', overflow:'hidden', fontFamily:'sans-serif' };
const sidebarStyle = { width:'220px', background:'#050505', padding:'20px', display:'flex', flexDirection:'column', borderRight:'1px solid #111' };
const logoStyle = { fontSize:'18px', fontWeight:'bold', marginBottom:'30px', color:'#38bdf8', display:'flex', alignItems:'center', gap:'8px' };
const navItem = { display:'flex', alignItems:'center', gap:'10px', padding:'10px', borderRadius:'6px', cursor:'pointer', marginBottom:'4px', color:'#555', fontSize:'14px' };
const navActive = { ...navItem, background:'#111', color:'#38bdf8' };
const mainStyle = { flex:1, padding:'25px', overflowY:'auto' };
const headerStyle = { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px' };
const cardStyle = { background:'#080808', padding:'18px', borderRadius:'10px', border:'1px solid #111' };
const topGridStyle = { display:'flex', gap:'15px' };
const rowStyle = { display:'flex', gap:'10px', alignItems:'flex-end', width: '100%' };
const inputFlat = { background:'#000', border:'1px solid #222', padding:'10px', borderRadius:'6px', color:'#fff', fontSize:'13px' };
const miniLabel = { fontSize:'10px', color:'#444', textTransform:'uppercase', marginBottom:'5px', display:'block', fontWeight:'bold' };
const btnAction = { background:'#2563eb', color:'#fff', border:'none', padding:'10px 20px', borderRadius:'6px', cursor:'pointer', fontWeight:'600', fontSize:'13px', whiteSpace: 'nowrap' };
const btnPrimaryFull = { width:'100%', padding:'12px', background:'#2563eb', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:'bold', display:'flex', alignItems:'center', justifyContent:'center' };
const btnGhost = { background:'none', border:'none', cursor:'pointer', padding:'5px' };
const btnImport = { background:'#1e1b4b', color:'#38bdf8', padding:'8px 16px', borderRadius:'6px', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px', fontSize:'13px', border:'1px solid #312e81' };
const tableStyle = { width:'100%', borderCollapse:'collapse', fontSize:'13px' };
const trStyle = { borderBottom:'1px solid #0f0f0f', height:'45px' };
const badge = { padding:'3px 8px', borderRadius:'4px', fontSize:'10px', color:'#fff', fontWeight:'bold' };
const labelStyle = { color:'#444', fontSize:'10px', fontWeight:'bold', letterSpacing:'1px' };
const logoutBtn = { background:'none', border:'none', color:'#444', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px', marginTop:'auto', fontSize:'14px' };
const modalOverlay = { position:'fixed', top:0, left:0, width:'100vw', height:'100vh', background:'rgba(0,0,0,0.9)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:1000 };
const modalContent = { background:'#080808', padding:'25px', borderRadius:'12px', border:'1px solid #111', width:'420px' };
const loginScreenStyle = { width:'100vw', height:'100vh', background:'#000', display:'flex', justifyContent:'center', alignItems:'center' };
const loginCardStyle = { background:'#fff', padding:'30px', borderRadius:'12px', width:'300px', textAlign:'center' };
const inputStyleLight = { width:'100%', padding:'10px', marginBottom:'10px', borderRadius:'6px', border:'1px solid #ddd', boxSizing:'border-box' };

export default App;