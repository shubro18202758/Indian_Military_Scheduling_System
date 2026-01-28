"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from 'next/dynamic';

// Dynamic chart imports
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
const AreaChart = dynamic(() => import('recharts').then(m => m.AreaChart), { ssr: false });
const Area = dynamic(() => import('recharts').then(m => m.Area), { ssr: false });
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false });
const PieChart = dynamic(() => import('recharts').then(m => m.PieChart), { ssr: false });
const Pie = dynamic(() => import('recharts').then(m => m.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then(m => m.Cell), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import('recharts').then(m => m.Legend), { ssr: false });
const RadarChart = dynamic(() => import('recharts').then(m => m.RadarChart), { ssr: false });
const PolarGrid = dynamic(() => import('recharts').then(m => m.PolarGrid), { ssr: false });
const PolarAngleAxis = dynamic(() => import('recharts').then(m => m.PolarAngleAxis), { ssr: false });
const PolarRadiusAxis = dynamic(() => import('recharts').then(m => m.PolarRadiusAxis), { ssr: false });
const Radar = dynamic(() => import('recharts').then(m => m.Radar), { ssr: false });

const API_BASE = '/api/proxy/v1';

// Styles object
const s = {
  container: { minHeight: '100vh', background: 'linear-gradient(135deg, #0a0f0a 0%, #1a2f1a 50%, #0d1a0d 100%)', color: '#fff', padding: 20, fontFamily: "'Segoe UI', system-ui, sans-serif", position: 'relative' as const },
  camo: { position: 'absolute' as const, inset: 0, backgroundImage: 'radial-gradient(ellipse 80px 40px at 100px 100px, rgba(74, 93, 35, 0.3) 0%, transparent 100%), radial-gradient(ellipse 60px 35px at 300px 150px, rgba(45, 58, 27, 0.3) 0%, transparent 100%)', backgroundRepeat: 'repeat', backgroundSize: '500px 400px', pointerEvents: 'none' as const, zIndex: 1 },
  content: { position: 'relative' as const, zIndex: 10 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, padding: '16px 20px', background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(6, 182, 212, 0.1) 100%)', borderRadius: 12, border: '1px solid rgba(34, 197, 94, 0.3)' },
  headerIcon: { width: 56, height: 56, borderRadius: 12, background: 'linear-gradient(135deg, #22c55e, #15803d)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 },
  title: { fontSize: 20, fontWeight: 700, background: 'linear-gradient(90deg, #22c55e, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  subtitle: { fontSize: 11, color: '#9ca3af', letterSpacing: 2, marginTop: 4 },
  tabs: { display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' as const },
  tab: (a: boolean) => ({ padding: '10px 16px', borderRadius: 8, border: a ? '1px solid rgba(34, 197, 94, 0.5)' : '1px solid rgba(255,255,255,0.1)', background: a ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(6, 182, 212, 0.15))' : 'rgba(255,255,255,0.03)', color: a ? '#22c55e' : '#9ca3af', cursor: 'pointer', fontWeight: a ? 600 : 400, fontSize: 12 }),
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 },
  grid5: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 },
  card: { background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16 },
  metricCard: (c: string) => ({ background: `linear-gradient(135deg, ${c}15, ${c}08)`, border: `1px solid ${c}40`, borderRadius: 12, padding: 14, position: 'relative' as const }),
  metricValue: (c: string) => ({ fontSize: 28, fontWeight: 700, color: c, textShadow: `0 0 15px ${c}40` }),
  metricLabel: { fontSize: 10, color: '#9ca3af', marginTop: 4, textTransform: 'uppercase' as const, letterSpacing: 1 },
  chartTitle: (c: string) => ({ fontSize: 14, fontWeight: 600, color: c, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }),
  inputGroup: { marginBottom: 12 },
  label: { display: 'block', fontSize: 11, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: 1 },
  input: { width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#fff', fontSize: 14, fontFamily: 'monospace' },
  select: { width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#fff', fontSize: 13 },
  button: (c: string) => ({ width: '100%', padding: '12px 16px', background: `linear-gradient(135deg, ${c}, ${c}cc)`, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: `0 4px 15px ${c}40` }),
  aiBriefing: { background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(15, 23, 42, 0.8))', border: '1px solid rgba(34, 197, 94, 0.4)', borderRadius: 12, padding: 16, marginTop: 12 },
  aiHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  aiIcon: { width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #22c55e, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 },
  badge: (c: string) => ({ padding: '6px 12px', borderRadius: 6, background: `${c}20`, border: `1px solid ${c}`, color: c, fontWeight: 700, fontSize: 12, textAlign: 'center' as const }),
  tcpRow: { display: 'flex', alignItems: 'center', gap: 12, padding: 10, background: 'rgba(0,0,0,0.3)', borderRadius: 8, marginBottom: 8, border: '1px solid rgba(255,255,255,0.05)' },
  haltRow: (t: string) => ({ padding: 12, borderRadius: 8, marginBottom: 8, border: `1px solid ${t === 'NIGHT' ? '#8b5cf6' : t === 'LONG' ? '#f59e0b' : '#22c55e'}40`, background: `${t === 'NIGHT' ? '#8b5cf6' : t === 'LONG' ? '#f59e0b' : '#22c55e'}10` }),
  status: (on: boolean) => ({ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: on ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)', border: `1px solid ${on ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'}`, borderRadius: 8, fontSize: 12 }),
};

type TabType = 'analytics' | 'vtkm' | 'fol' | 'macp' | 'tcp' | 'halt' | 'threat';

export default function DeliverablesPanel() {
  const [activeTab, setActiveTab] = useState<TabType>('analytics');
  const [loading, setLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [gpuStatus, setGpuStatus] = useState<any>(null);

  // VTKM State
  const [vtkmInput, setVtkmInput] = useState({ vehicle_count: 20, inter_vehicle_distance_m: 100, threat_level: 'GREEN', terrain: 'PLAINS', formation: 'COLUMN', cargo_category: 'GENERAL', day_night: 'DAY', altitude_m: 0 });
  const [vtkmResult, setVtkmResult] = useState<any>(null);

  // FOL State
  const [folInput, setFolInput] = useState({ vehicles: [{ vehicle_type: 'SHAKTIMAN', count: 10, load_tons: 3 }, { vehicle_type: 'TATRA', count: 5, load_tons: 6 }], distance_km: 200, terrain: 'PLAINS', altitude_m: 0, buffer_percent: 20, return_journey: false, reserve_days: 0 });
  const [folResult, setFolResult] = useState<any>(null);

  // MACP State
  const [macpInput, setMacpInput] = useState({ cargo_weight_tons: 50, distance_km: 150, urgency: 'ROUTINE', terrain: 'PLAINS', ammo_category: '' });
  const [macpResult, setMacpResult] = useState<any>(null);

  // TCP State
  const [tcpInput, setTcpInput] = useState({ route_distance_km: 200, route_type: 'MSR', threat_level: 'GREEN', include_fuel: true, include_medical: true });
  const [tcpResult, setTcpResult] = useState<any>(null);

  // Halt State
  const [haltInput, setHaltInput] = useState({ total_distance_km: 300, avg_speed_kmph: 30, start_time: '06:00', include_night_halt: true, terrain: 'PLAINS' });
  const [haltResult, setHaltResult] = useState<any>(null);

  // Threat State
  const [threatInput, setThreatInput] = useState({ terrain: 'PLAINS', route_length_km: 150, time_of_day: 'DAY', historical_incidents: 0, nearby_hostile_zones: 0 });
  const [threatResult, setThreatResult] = useState<any>(null);
  const [monteCarloResult, setMonteCarloResult] = useState<any>(null);

  useEffect(() => { setIsClient(true); fetchGpuStatus(); }, []);

  const fetchGpuStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/deliverables/gpu/status`);
      const data = await res.json();
      setGpuStatus(data);
    } catch (e) { console.error(e); }
  };

  const calculateVTKM = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/deliverables/vtkm/calculate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(vtkmInput) });
      const data = await res.json();
      if (data.status === 'success') setVtkmResult(data.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const calculateFOL = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/deliverables/fol/calculate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(folInput) });
      const data = await res.json();
      if (data.status === 'success') setFolResult(data.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const calculateMACP = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/deliverables/macp/calculate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(macpInput) });
      const data = await res.json();
      if (data.status === 'success') setMacpResult(data.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const planTCP = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/deliverables/tcp/plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tcpInput) });
      const data = await res.json();
      if (data.status === 'success') setTcpResult(data.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const generateHaltSchedule = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/deliverables/halt/schedule`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(haltInput) });
      const data = await res.json();
      if (data.status === 'success') setHaltResult(data.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const assessThreat = async () => {
    setLoading(true);
    try {
      const [threatRes, mcRes] = await Promise.all([
        fetch(`${API_BASE}/deliverables/threat/assess`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(threatInput) }),
        fetch(`${API_BASE}/deliverables/threat/monte-carlo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base_threat: 0.3, terrain_variance: 0.1, time_variance: 0.05, intel_variance: 0.1, simulations: 10000 }) })
      ]);
      const [threatData, mcData] = await Promise.all([threatRes.json(), mcRes.json()]);
      if (threatData.status === 'success') setThreatResult(threatData.data);
      if (mcData.status === 'success') setMonteCarloResult(mcData.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const tabs = [
    { id: 'analytics' as TabType, icon: '📊', label: 'STRATEGIC ANALYTICS' },
    { id: 'vtkm' as TabType, icon: '📐', label: 'VTKM' },
    { id: 'fol' as TabType, icon: '⛽', label: 'FOL ANALYSIS' },
    { id: 'macp' as TabType, icon: '🎯', label: 'MACP' },
    { id: 'tcp' as TabType, icon: '🚧', label: 'TCP PLANNING' },
    { id: 'halt' as TabType, icon: '⏸️', label: 'HALT SCHEDULE' },
    { id: 'threat' as TabType, icon: '⚠️', label: 'THREAT' },
  ];

  if (!isClient) return null;

  return (
    <div style={s.container}>
      <div style={s.camo} />
      <div style={s.content}>
        {/* Header */}
        <div style={s.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={s.headerIcon}>🎖️</div>
            <div>
              <div style={s.title}>ARMY DESIGN BUREAU — MILITARY LOGISTICS SUITE</div>
              <div style={s.subtitle}>DEEP AI INTEGRATION • GPU ACCELERATED • HEURISTIC OPTIMIZATION</div>
            </div>
          </div>
          <div style={s.status(gpuStatus?.gpu_ops?.gpu_available)}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: gpuStatus?.gpu_ops?.gpu_available ? '#22c55e' : '#f59e0b', boxShadow: `0 0 8px ${gpuStatus?.gpu_ops?.gpu_available ? '#22c55e' : '#f59e0b'}` }} />
            <span style={{ color: gpuStatus?.gpu_ops?.gpu_available ? '#22c55e' : '#f59e0b', fontWeight: 600 }}>{gpuStatus?.gpu_ops?.backend || 'INITIALIZING...'}</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={s.tabs}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={s.tab(activeTab === t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <>
            <div style={s.grid5}>
              {[{ v: '15', l: 'ALGORITHMS', c: '#22c55e' }, { v: '10K', l: 'SIMULATIONS', c: '#06b6d4' }, { v: '847', l: 'CONVOYS', c: '#8b5cf6' }, { v: '98.2%', l: 'ACCURACY', c: '#f59e0b' }, { v: 'ONLINE', l: 'JANUS AI', c: '#22c55e' }].map((m, i) => (
                <div key={i} style={s.metricCard(m.c)}>
                  <div style={s.metricValue(m.c)}>{m.v}</div>
                  <div style={s.metricLabel}>{m.l}</div>
                </div>
              ))}
            </div>
            <div style={s.aiBriefing}>
              <div style={s.aiHeader}>
                <div style={s.aiIcon}>🧠</div>
                <div>
                  <div style={{ color: '#22c55e', fontSize: 13, fontWeight: 700, letterSpacing: 2 }}>SYSTEM CAPABILITIES</div>
                  <div style={{ color: '#6b7280', fontSize: 11 }}>JANUS PRO 7B — INTEGRATED</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {['VTKM - Convoy spacing optimization', 'FOL - Fuel/lubricant calculations', 'MACP - Ammunition credit points', 'TCP - Traffic control post planning', 'HALT - Rest schedule generation', 'THREAT - Monte Carlo simulation'].map((c, i) => (
                  <div key={i} style={{ padding: 10, background: 'rgba(0,0,0,0.3)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)', fontSize: 12, color: '#d1d5db' }}>✓ {c}</div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* VTKM Tab */}
        {activeTab === 'vtkm' && (
          <div style={s.grid2}>
            <div style={s.card}>
              <div style={s.chartTitle('#06b6d4')}>📐 VTKM PARAMETERS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={s.inputGroup}><label style={s.label}>Vehicles</label><input type="number" value={vtkmInput.vehicle_count} onChange={e => setVtkmInput({ ...vtkmInput, vehicle_count: +e.target.value })} style={s.input} /></div>
                <div style={s.inputGroup}><label style={s.label}>Spacing (m)</label><input type="number" value={vtkmInput.inter_vehicle_distance_m} onChange={e => setVtkmInput({ ...vtkmInput, inter_vehicle_distance_m: +e.target.value })} style={s.input} /></div>
                <div style={s.inputGroup}><label style={s.label}>Threat</label><select value={vtkmInput.threat_level} onChange={e => setVtkmInput({ ...vtkmInput, threat_level: e.target.value })} style={s.select}>{['GREEN', 'YELLOW', 'ORANGE', 'RED'].map(o => <option key={o}>{o}</option>)}</select></div>
                <div style={s.inputGroup}><label style={s.label}>Terrain</label><select value={vtkmInput.terrain} onChange={e => setVtkmInput({ ...vtkmInput, terrain: e.target.value })} style={s.select}>{['PLAINS', 'MOUNTAINOUS', 'HIGH_ALTITUDE', 'DESERT', 'JUNGLE', 'URBAN'].map(o => <option key={o}>{o}</option>)}</select></div>
                <div style={s.inputGroup}><label style={s.label}>Formation</label><select value={vtkmInput.formation} onChange={e => setVtkmInput({ ...vtkmInput, formation: e.target.value })} style={s.select}>{['COLUMN', 'ECHELON_LEFT', 'WEDGE', 'DIAMOND', 'STAGGERED'].map(o => <option key={o}>{o}</option>)}</select></div>
                <div style={s.inputGroup}><label style={s.label}>Day/Night</label><select value={vtkmInput.day_night} onChange={e => setVtkmInput({ ...vtkmInput, day_night: e.target.value })} style={s.select}>{['DAY', 'NIGHT'].map(o => <option key={o}>{o}</option>)}</select></div>
                <div style={s.inputGroup}><label style={s.label}>Altitude (m)</label><input type="number" value={vtkmInput.altitude_m} onChange={e => setVtkmInput({ ...vtkmInput, altitude_m: +e.target.value })} style={s.input} /></div>
                <div style={s.inputGroup}><label style={s.label}>Cargo</label><select value={vtkmInput.cargo_category} onChange={e => setVtkmInput({ ...vtkmInput, cargo_category: e.target.value })} style={s.select}>{['GENERAL', 'AMMUNITION', 'FUEL', 'MEDICAL', 'TROOPS'].map(o => <option key={o}>{o}</option>)}</select></div>
              </div>
              <button onClick={calculateVTKM} disabled={loading} style={s.button('#06b6d4')}>{loading ? '⏳ COMPUTING...' : '🎯 CALCULATE VTKM'}</button>
            </div>
            <div>
              {vtkmResult ? (
                <>
                  <div style={s.grid3}>
                    <div style={s.metricCard('#06b6d4')}><div style={s.metricValue('#06b6d4')}>{vtkmResult.vtkm}</div><div style={s.metricLabel}>VTKM</div></div>
                    <div style={s.metricCard('#22c55e')}><div style={s.metricValue('#22c55e')}>{vtkmResult.convoy_length_km?.toFixed(2)} km</div><div style={s.metricLabel}>Length</div></div>
                    <div style={s.metricCard('#f59e0b')}><div style={s.metricValue('#f59e0b')}>{vtkmResult.recommended_spacing_m}m</div><div style={s.metricLabel}>Spacing</div></div>
                  </div>
                  <div style={{ ...s.card, marginBottom: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                      <div style={{ color: '#9ca3af' }}>Effective Speed: <span style={{ color: '#22c55e', fontWeight: 600 }}>{vtkmResult.effective_speed_kmph} km/h</span></div>
                      <div style={{ color: '#9ca3af' }}>Crossing Time: <span style={{ color: '#f59e0b', fontWeight: 600 }}>{vtkmResult.crossing_time_min} min</span></div>
                      <div style={{ color: '#9ca3af' }}>Terrain Factor: <span style={{ color: '#06b6d4', fontWeight: 600 }}>{vtkmResult.terrain_factor}</span></div>
                      <div style={{ color: '#9ca3af' }}>Confidence: <span style={{ color: '#8b5cf6', fontWeight: 600 }}>{(vtkmResult.confidence_score * 100).toFixed(1)}%</span></div>
                    </div>
                  </div>
                  <div style={s.badge(vtkmResult.threat_level === 'RED' ? '#ef4444' : vtkmResult.threat_level === 'ORANGE' ? '#f97316' : vtkmResult.threat_level === 'YELLOW' ? '#eab308' : '#22c55e')}>THREAT: {vtkmResult.threat_level}</div>
                  {vtkmResult.ai_recommendation && <div style={s.aiBriefing}><div style={s.aiHeader}><div style={s.aiIcon}>🧠</div><div style={{ color: '#22c55e', fontWeight: 700 }}>AI RECOMMENDATION</div></div><p style={{ color: '#d1d5db', fontSize: 12, fontFamily: 'monospace', lineHeight: 1.5 }}>{vtkmResult.ai_recommendation}</p></div>}
                </>
              ) : <div style={{ ...s.card, textAlign: 'center', padding: 50 }}><div style={{ fontSize: 48, marginBottom: 12 }}>📐</div><p style={{ color: '#9ca3af' }}>Configure parameters and calculate</p></div>}
            </div>
          </div>
        )}

        {/* FOL Tab */}
        {activeTab === 'fol' && (
          <div style={s.grid2}>
            <div style={s.card}>
              <div style={s.chartTitle('#f59e0b')}>⛽ FOL PARAMETERS</div>
              <div style={s.inputGroup}><label style={s.label}>Distance (km)</label><input type="number" value={folInput.distance_km} onChange={e => setFolInput({ ...folInput, distance_km: +e.target.value })} style={s.input} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={s.inputGroup}><label style={s.label}>Terrain</label><select value={folInput.terrain} onChange={e => setFolInput({ ...folInput, terrain: e.target.value })} style={s.select}>{['PLAINS', 'MOUNTAINOUS', 'HIGH_ALTITUDE', 'DESERT'].map(o => <option key={o}>{o}</option>)}</select></div>
                <div style={s.inputGroup}><label style={s.label}>Altitude (m)</label><input type="number" value={folInput.altitude_m} onChange={e => setFolInput({ ...folInput, altitude_m: +e.target.value })} style={s.input} /></div>
                <div style={s.inputGroup}><label style={s.label}>Buffer %</label><input type="number" value={folInput.buffer_percent} onChange={e => setFolInput({ ...folInput, buffer_percent: +e.target.value })} style={s.input} /></div>
                <div style={s.inputGroup}><label style={s.label}>Reserve Days</label><input type="number" value={folInput.reserve_days} onChange={e => setFolInput({ ...folInput, reserve_days: +e.target.value })} style={s.input} /></div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, background: 'rgba(0,0,0,0.3)', borderRadius: 8, marginBottom: 12, cursor: 'pointer' }}><input type="checkbox" checked={folInput.return_journey} onChange={e => setFolInput({ ...folInput, return_journey: e.target.checked })} /><span style={{ color: '#d1d5db', fontSize: 12 }}>Return Journey</span></label>
              <button onClick={calculateFOL} disabled={loading} style={s.button('#f59e0b')}>{loading ? '⏳ COMPUTING...' : '⛽ CALCULATE FOL'}</button>
            </div>
            <div>
              {folResult ? (
                <>
                  <div style={s.grid3}>
                    <div style={s.metricCard('#f59e0b')}><div style={s.metricValue('#f59e0b')}>{folResult.diesel_liters}L</div><div style={s.metricLabel}>Diesel</div></div>
                    <div style={s.metricCard('#06b6d4')}><div style={s.metricValue('#06b6d4')}>{folResult.petrol_liters}L</div><div style={s.metricLabel}>Petrol</div></div>
                    <div style={s.metricCard('#8b5cf6')}><div style={s.metricValue('#8b5cf6')}>{folResult.engine_oil_liters}L</div><div style={s.metricLabel}>Engine Oil</div></div>
                  </div>
                  <div style={{ ...s.card, marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>CORRECTIONS</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div style={{ color: '#d1d5db', fontSize: 12 }}>Altitude: <span style={{ color: '#f59e0b' }}>×{folResult.altitude_correction}</span></div>
                      <div style={{ color: '#d1d5db', fontSize: 12 }}>Terrain: <span style={{ color: '#8b5cf6' }}>×{folResult.terrain_correction}</span></div>
                    </div>
                  </div>
                  <div style={s.badge('#22c55e')}>COST: ₹{folResult.cost_estimate_inr?.toLocaleString()}</div>
                  {folResult.ai_recommendation && <div style={s.aiBriefing}><div style={s.aiHeader}><div style={s.aiIcon}>⛽</div><div style={{ color: '#f59e0b', fontWeight: 700 }}>FOL ANALYSIS</div></div><p style={{ color: '#d1d5db', fontSize: 12, fontFamily: 'monospace' }}>{folResult.ai_recommendation}</p></div>}
                </>
              ) : <div style={{ ...s.card, textAlign: 'center', padding: 50 }}><div style={{ fontSize: 48, marginBottom: 12 }}>⛽</div><p style={{ color: '#9ca3af' }}>Configure FOL parameters</p></div>}
            </div>
          </div>
        )}

        {/* MACP Tab */}
        {activeTab === 'macp' && (
          <div style={s.grid2}>
            <div style={s.card}>
              <div style={s.chartTitle('#ef4444')}>🎯 MACP PARAMETERS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={s.inputGroup}><label style={s.label}>Weight (tons)</label><input type="number" value={macpInput.cargo_weight_tons} onChange={e => setMacpInput({ ...macpInput, cargo_weight_tons: +e.target.value })} style={s.input} /></div>
                <div style={s.inputGroup}><label style={s.label}>Distance (km)</label><input type="number" value={macpInput.distance_km} onChange={e => setMacpInput({ ...macpInput, distance_km: +e.target.value })} style={s.input} /></div>
                <div style={s.inputGroup}><label style={s.label}>Urgency</label><select value={macpInput.urgency} onChange={e => setMacpInput({ ...macpInput, urgency: e.target.value })} style={s.select}>{['ROUTINE', 'PRIORITY', 'IMMEDIATE', 'FLASH'].map(o => <option key={o}>{o}</option>)}</select></div>
                <div style={s.inputGroup}><label style={s.label}>Terrain</label><select value={macpInput.terrain} onChange={e => setMacpInput({ ...macpInput, terrain: e.target.value })} style={s.select}>{['PLAINS', 'MOUNTAINOUS', 'HIGH_ALTITUDE', 'DESERT'].map(o => <option key={o}>{o}</option>)}</select></div>
              </div>
              <div style={s.inputGroup}><label style={s.label}>Ammo Category (optional)</label><select value={macpInput.ammo_category} onChange={e => setMacpInput({ ...macpInput, ammo_category: e.target.value })} style={s.select}><option value="">None</option>{['SAA', 'MORTAR', 'ARTILLERY', 'MISSILE', 'EXPLOSIVE'].map(o => <option key={o}>{o}</option>)}</select></div>
              <button onClick={calculateMACP} disabled={loading} style={s.button('#ef4444')}>{loading ? '⏳ COMPUTING...' : '🎯 CALCULATE MACP'}</button>
            </div>
            <div>
              {macpResult ? (
                <>
                  <div style={s.grid3}>
                    <div style={s.metricCard('#ef4444')}><div style={s.metricValue('#ef4444')}>{macpResult.credit_points?.toFixed(0)}</div><div style={s.metricLabel}>Credit Points</div></div>
                    <div style={s.metricCard('#f59e0b')}><div style={s.metricValue('#f59e0b')}>{macpResult.priority_score?.toFixed(0)}</div><div style={s.metricLabel}>Priority Score</div></div>
                    <div style={s.metricCard('#22c55e')}><div style={s.metricValue('#22c55e')}>{macpResult.estimated_time_hours?.toFixed(1)}h</div><div style={s.metricLabel}>Est. Time</div></div>
                  </div>
                  {macpResult.recommended_vehicles && (
                    <div style={{ ...s.card, marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>RECOMMENDED VEHICLES</div>
                      {macpResult.recommended_vehicles.map((v: any, i: number) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: 8, background: 'rgba(0,0,0,0.3)', borderRadius: 6, marginBottom: 4 }}>
                          <span style={{ color: '#d1d5db' }}>{v.vehicle_type}</span>
                          <span style={{ color: '#22c55e', fontWeight: 600 }}>{v.count} × {v.capacity_tons}T</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {macpResult.special_handling?.length > 0 && (
                    <div style={{ ...s.card, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                      <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 700, marginBottom: 8 }}>⚠️ SPECIAL HANDLING</div>
                      {macpResult.special_handling.map((h: string, i: number) => <div key={i} style={{ color: '#fca5a5', fontSize: 11, marginBottom: 4 }}>• {h}</div>)}
                    </div>
                  )}
                </>
              ) : <div style={{ ...s.card, textAlign: 'center', padding: 50 }}><div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div><p style={{ color: '#9ca3af' }}>Configure MACP parameters</p></div>}
            </div>
          </div>
        )}

        {/* TCP Tab */}
        {activeTab === 'tcp' && (
          <div style={s.grid2}>
            <div style={s.card}>
              <div style={s.chartTitle('#22c55e')}>🚧 TCP PARAMETERS</div>
              <div style={s.inputGroup}><label style={s.label}>Route Distance (km)</label><input type="number" value={tcpInput.route_distance_km} onChange={e => setTcpInput({ ...tcpInput, route_distance_km: +e.target.value })} style={s.input} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={s.inputGroup}><label style={s.label}>Route Type</label><select value={tcpInput.route_type} onChange={e => setTcpInput({ ...tcpInput, route_type: e.target.value })} style={s.select}>{['MSR', 'TACTICAL', 'URBAN'].map(o => <option key={o}>{o}</option>)}</select></div>
                <div style={s.inputGroup}><label style={s.label}>Threat</label><select value={tcpInput.threat_level} onChange={e => setTcpInput({ ...tcpInput, threat_level: e.target.value })} style={s.select}>{['GREEN', 'YELLOW', 'ORANGE', 'RED'].map(o => <option key={o}>{o}</option>)}</select></div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><input type="checkbox" checked={tcpInput.include_fuel} onChange={e => setTcpInput({ ...tcpInput, include_fuel: e.target.checked })} /><span style={{ color: '#d1d5db', fontSize: 12 }}>Fuel Posts</span></label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><input type="checkbox" checked={tcpInput.include_medical} onChange={e => setTcpInput({ ...tcpInput, include_medical: e.target.checked })} /><span style={{ color: '#d1d5db', fontSize: 12 }}>Medical Posts</span></label>
              </div>
              <button onClick={planTCP} disabled={loading} style={s.button('#22c55e')}>{loading ? '⏳ PLANNING...' : '🚧 PLAN TCPs'}</button>
            </div>
            <div>
              {tcpResult ? (
                <>
                  <div style={s.grid3}>
                    <div style={s.metricCard('#22c55e')}><div style={s.metricValue('#22c55e')}>{tcpResult.total_tcps}</div><div style={s.metricLabel}>Total TCPs</div></div>
                    <div style={s.metricCard('#06b6d4')}><div style={s.metricValue('#06b6d4')}>{tcpResult.route_distance_km}km</div><div style={s.metricLabel}>Distance</div></div>
                    <div style={s.metricCard('#8b5cf6')}><div style={s.metricValue('#8b5cf6')}>{(tcpResult.route_distance_km / tcpResult.total_tcps).toFixed(0)}km</div><div style={s.metricLabel}>Avg Spacing</div></div>
                  </div>
                  <div style={{ ...s.card, maxHeight: 280, overflowY: 'auto' }}>
                    {tcpResult.tcps?.slice(0, 8).map((tcp: any, i: number) => (
                      <div key={i} style={s.tcpRow}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: tcp.post_type === 'CONTROL' ? '#22c55e20' : tcp.post_type === 'FUEL' ? '#f59e0b20' : tcp.post_type === 'MEDICAL' ? '#ef444420' : '#06b6d420', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                          {tcp.post_type === 'CONTROL' ? '🚧' : tcp.post_type === 'FUEL' ? '⛽' : tcp.post_type === 'MEDICAL' ? '🏥' : 'ℹ️'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{tcp.post_id}</div>
                          <div style={{ color: '#9ca3af', fontSize: 11 }}>{tcp.post_type} @ {tcp.location_km}km</div>
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>
                          {Object.entries(tcp.personnel).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : <div style={{ ...s.card, textAlign: 'center', padding: 50 }}><div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div><p style={{ color: '#9ca3af' }}>Configure TCP parameters</p></div>}
            </div>
          </div>
        )}

        {/* Halt Tab */}
        {activeTab === 'halt' && (
          <div style={s.grid2}>
            <div style={s.card}>
              <div style={s.chartTitle('#8b5cf6')}>⏸️ HALT PARAMETERS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={s.inputGroup}><label style={s.label}>Distance (km)</label><input type="number" value={haltInput.total_distance_km} onChange={e => setHaltInput({ ...haltInput, total_distance_km: +e.target.value })} style={s.input} /></div>
                <div style={s.inputGroup}><label style={s.label}>Speed (km/h)</label><input type="number" value={haltInput.avg_speed_kmph} onChange={e => setHaltInput({ ...haltInput, avg_speed_kmph: +e.target.value })} style={s.input} /></div>
                <div style={s.inputGroup}><label style={s.label}>Start Time</label><input type="text" value={haltInput.start_time} onChange={e => setHaltInput({ ...haltInput, start_time: e.target.value })} style={s.input} placeholder="HH:MM" /></div>
                <div style={s.inputGroup}><label style={s.label}>Terrain</label><select value={haltInput.terrain} onChange={e => setHaltInput({ ...haltInput, terrain: e.target.value })} style={s.select}>{['PLAINS', 'MOUNTAINOUS', 'HIGH_ALTITUDE'].map(o => <option key={o}>{o}</option>)}</select></div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, background: 'rgba(0,0,0,0.3)', borderRadius: 8, marginBottom: 12, cursor: 'pointer' }}><input type="checkbox" checked={haltInput.include_night_halt} onChange={e => setHaltInput({ ...haltInput, include_night_halt: e.target.checked })} /><span style={{ color: '#d1d5db', fontSize: 12 }}>Include Night Halts</span></label>
              <button onClick={generateHaltSchedule} disabled={loading} style={s.button('#8b5cf6')}>{loading ? '⏳ GENERATING...' : '⏸️ GENERATE SCHEDULE'}</button>
            </div>
            <div>
              {haltResult ? (
                <>
                  <div style={s.grid3}>
                    <div style={s.metricCard('#22c55e')}><div style={s.metricValue('#22c55e')}>{haltResult.halt_summary?.short_halts || 0}</div><div style={s.metricLabel}>Short Halts</div></div>
                    <div style={s.metricCard('#f59e0b')}><div style={s.metricValue('#f59e0b')}>{haltResult.halt_summary?.long_halts || 0}</div><div style={s.metricLabel}>Long Halts</div></div>
                    <div style={s.metricCard('#8b5cf6')}><div style={s.metricValue('#8b5cf6')}>{haltResult.halt_summary?.night_halts || 0}</div><div style={s.metricLabel}>Night Halts</div></div>
                  </div>
                  <div style={{ ...s.card, maxHeight: 280, overflowY: 'auto' }}>
                    {haltResult.halts?.slice(0, 8).map((h: any, i: number) => (
                      <div key={i} style={s.haltRow(h.halt_type)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, color: h.halt_type === 'NIGHT' ? '#8b5cf6' : h.halt_type === 'LONG' ? '#f59e0b' : '#22c55e' }}>{h.halt_type} HALT</span>
                          <span style={{ color: '#9ca3af', fontSize: 11 }}>@ {h.start_km}km • {h.duration_min}min</span>
                        </div>
                        <div style={{ color: '#d1d5db', fontSize: 11 }}>{h.purpose?.join(' • ')}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : <div style={{ ...s.card, textAlign: 'center', padding: 50 }}><div style={{ fontSize: 48, marginBottom: 12 }}>⏸️</div><p style={{ color: '#9ca3af' }}>Configure halt parameters</p></div>}
            </div>
          </div>
        )}

        {/* Threat Tab */}
        {activeTab === 'threat' && (
          <div style={s.grid2}>
            <div style={s.card}>
              <div style={s.chartTitle('#ef4444')}>⚠️ THREAT PARAMETERS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={s.inputGroup}><label style={s.label}>Terrain</label><select value={threatInput.terrain} onChange={e => setThreatInput({ ...threatInput, terrain: e.target.value })} style={s.select}>{['PLAINS', 'MOUNTAINOUS', 'JUNGLE', 'URBAN'].map(o => <option key={o}>{o}</option>)}</select></div>
                <div style={s.inputGroup}><label style={s.label}>Distance (km)</label><input type="number" value={threatInput.route_length_km} onChange={e => setThreatInput({ ...threatInput, route_length_km: +e.target.value })} style={s.input} /></div>
                <div style={s.inputGroup}><label style={s.label}>Time</label><select value={threatInput.time_of_day} onChange={e => setThreatInput({ ...threatInput, time_of_day: e.target.value })} style={s.select}>{['DAY', 'NIGHT'].map(o => <option key={o}>{o}</option>)}</select></div>
                <div style={s.inputGroup}><label style={s.label}>Incidents</label><input type="number" value={threatInput.historical_incidents} onChange={e => setThreatInput({ ...threatInput, historical_incidents: +e.target.value })} style={s.input} /></div>
              </div>
              <div style={s.inputGroup}><label style={s.label}>Hostile Zones Nearby</label><input type="number" value={threatInput.nearby_hostile_zones} onChange={e => setThreatInput({ ...threatInput, nearby_hostile_zones: +e.target.value })} style={s.input} /></div>
              <button onClick={assessThreat} disabled={loading} style={s.button('#ef4444')}>{loading ? '⏳ ASSESSING...' : '⚠️ ASSESS THREAT (10K SIMULATIONS)'}</button>
            </div>
            <div>
              {threatResult || monteCarloResult ? (
                <>
                  {threatResult && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={s.badge(threatResult.threat_level === 'RED' ? '#ef4444' : threatResult.threat_level === 'ORANGE' ? '#f97316' : threatResult.threat_level === 'YELLOW' ? '#eab308' : '#22c55e')}>
                        THREAT LEVEL: {threatResult.threat_level} ({threatResult.threat_score}%)
                      </div>
                      {threatResult.recommendations?.length > 0 && (
                        <div style={{ ...s.card, marginTop: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                          {threatResult.recommendations.map((r: string, i: number) => <div key={i} style={{ color: '#fca5a5', fontSize: 11, marginBottom: 4 }}>⚠️ {r}</div>)}
                        </div>
                      )}
                    </div>
                  )}
                  {monteCarloResult && (
                    <div style={s.aiBriefing}>
                      <div style={s.aiHeader}><div style={s.aiIcon}>🎲</div><div><div style={{ color: '#06b6d4', fontWeight: 700 }}>MONTE CARLO ANALYSIS</div><div style={{ color: '#6b7280', fontSize: 11 }}>{monteCarloResult.simulations_run?.toLocaleString()} simulations</div></div></div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 12 }}>
                        {Object.entries(monteCarloResult.threat_distribution || {}).map(([k, v]) => (
                          <div key={k} style={{ textAlign: 'center', padding: 8, background: 'rgba(0,0,0,0.3)', borderRadius: 6 }}>
                            <div style={{ fontSize: 18, fontWeight: 700, color: k === 'RED' ? '#ef4444' : k === 'ORANGE' ? '#f97316' : k === 'YELLOW' ? '#eab308' : '#22c55e' }}>{v as number}%</div>
                            <div style={{ fontSize: 10, color: '#9ca3af' }}>{k}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 12, padding: 10, background: 'rgba(0,0,0,0.3)', borderRadius: 8 }}>
                        <div style={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}>95% CONFIDENCE INTERVAL</div>
                        <div style={{ color: '#d1d5db', fontSize: 13, fontWeight: 600 }}>{monteCarloResult.confidence_interval_95?.lower}% — {monteCarloResult.confidence_interval_95?.upper}%</div>
                      </div>
                    </div>
                  )}
                </>
              ) : <div style={{ ...s.card, textAlign: 'center', padding: 50 }}><div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div><p style={{ color: '#9ca3af' }}>Configure threat parameters</p></div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
