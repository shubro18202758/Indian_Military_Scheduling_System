"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';

// Dynamic recharts imports
const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false });
const AreaChart = dynamic(() => import('recharts').then((m) => m.AreaChart), { ssr: false });
const Area = dynamic(() => import('recharts').then((m) => m.Area), { ssr: false });
const BarChart = dynamic(() => import('recharts').then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then((m) => m.Bar), { ssr: false });
const PieChart = dynamic(() => import('recharts').then((m) => m.PieChart), { ssr: false });
const Pie = dynamic(() => import('recharts').then((m) => m.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then((m) => m.Cell), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then((m) => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false });
const RadarChart = dynamic(() => import('recharts').then((m) => m.RadarChart), { ssr: false });
const PolarGrid = dynamic(() => import('recharts').then((m) => m.PolarGrid), { ssr: false });
const PolarAngleAxis = dynamic(() => import('recharts').then((m) => m.PolarAngleAxis), { ssr: false });
const PolarRadiusAxis = dynamic(() => import('recharts').then((m) => m.PolarRadiusAxis), { ssr: false });
const Radar = dynamic(() => import('recharts').then((m) => m.Radar), { ssr: false });
const Legend = dynamic(() => import('recharts').then((m) => m.Legend), { ssr: false });
const LineChart = dynamic(() => import('recharts').then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then((m) => m.Line), { ssr: false });

const API_BASE = '/api/proxy/v1';

// Styles
const s = {
  container: { minHeight: '100vh', background: 'linear-gradient(135deg, #0a0f0a 0%, #1a2f1a 50%, #0d1a0d 100%)', color: '#fff', padding: 16, fontFamily: "'Segoe UI', system-ui, sans-serif", position: 'relative' as const },
  camo: { position: 'absolute' as const, inset: 0, backgroundImage: 'radial-gradient(ellipse 80px 40px at 100px 100px, rgba(74, 93, 35, 0.3) 0%, transparent 100%)', backgroundRepeat: 'repeat', backgroundSize: '500px 400px', pointerEvents: 'none' as const, zIndex: 1 },
  content: { position: 'relative' as const, zIndex: 10 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '14px 18px', background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(6, 182, 212, 0.1) 100%)', borderRadius: 12, border: '1px solid rgba(34, 197, 94, 0.3)' },
  headerIcon: { width: 50, height: 50, borderRadius: 12, background: 'linear-gradient(135deg, #22c55e, #15803d)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 },
  title: { fontSize: 18, fontWeight: 700, background: 'linear-gradient(90deg, #22c55e, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  subtitle: { fontSize: 10, color: '#9ca3af', letterSpacing: 2, marginTop: 2 },
  tabs: { display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' as const },
  tab: (a: boolean) => ({ padding: '8px 14px', borderRadius: 8, border: a ? '1px solid rgba(34, 197, 94, 0.5)' : '1px solid rgba(255,255,255,0.1)', background: a ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(6, 182, 212, 0.15))' : 'rgba(255,255,255,0.03)', color: a ? '#22c55e' : '#9ca3af', cursor: 'pointer', fontWeight: a ? 600 : 400, fontSize: 11 }),
  grid6: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 14 },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 },
  card: { background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 14 },
  metricCard: (c: string) => ({ background: `linear-gradient(135deg, ${c}15, ${c}08)`, border: `1px solid ${c}40`, borderRadius: 10, padding: 12, position: 'relative' as const }),
  metricValue: (c: string) => ({ fontSize: 26, fontWeight: 700, color: c, textShadow: `0 0 12px ${c}40` }),
  metricLabel: { fontSize: 9, color: '#9ca3af', marginTop: 2, textTransform: 'uppercase' as const, letterSpacing: 1 },
  chartTitle: (c: string) => ({ fontSize: 12, fontWeight: 600, color: c, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }),
  aiBriefing: { background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(15, 23, 42, 0.8))', border: '1px solid rgba(34, 197, 94, 0.4)', borderRadius: 12, padding: 14, marginTop: 10 },
  aiHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  aiIcon: { width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #22c55e, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 },
  queueItem: (p: number) => ({ background: p >= 70 ? 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(15,23,42,0.8))' : p >= 50 ? 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(15,23,42,0.8))' : 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(15,23,42,0.8))', border: `1px solid ${p >= 70 ? 'rgba(239,68,68,0.4)' : p >= 50 ? 'rgba(245,158,11,0.4)' : 'rgba(34,197,94,0.3)'}`, borderRadius: 10, padding: 12, marginBottom: 10, borderLeft: `4px solid ${p >= 70 ? '#ef4444' : p >= 50 ? '#f59e0b' : '#22c55e'}` }),
  priorityBadge: (p: number) => ({ width: 44, height: 44, borderRadius: 8, background: p >= 70 ? 'linear-gradient(135deg, #ef4444, #b91c1c)' : p >= 50 ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #22c55e, #15803d)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff' }),
  planCard: (st: string) => ({ background: st === 'IN_TRANSIT' ? 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(15,23,42,0.8))' : 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(15,23,42,0.8))', border: `1px solid ${st === 'IN_TRANSIT' ? 'rgba(34,197,94,0.4)' : 'rgba(6,182,212,0.4)'}`, borderRadius: 10, padding: 12, marginBottom: 10 }),
  statusDot: (on: boolean) => ({ width: 8, height: 8, borderRadius: '50%', background: on ? '#22c55e' : '#f59e0b', boxShadow: `0 0 8px ${on ? '#22c55e' : '#f59e0b'}` }),
  refreshBtn: { padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(34,197,94,0.5)', background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(15,23,42,0.8))', color: '#22c55e', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 },
  statusBadge: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: 8, fontSize: 11, color: '#22c55e', fontWeight: 600 },
  miniCard: (c: string) => ({ padding: 8, background: `${c}10`, border: `1px solid ${c}30`, borderRadius: 8, textAlign: 'center' as const }),
};

type TabType = 'command' | 'queue' | 'sharing' | 'plans' | 'analytics' | 'threats';

interface LoadItem { request_id: string; convoy_id: number; convoy_name: string; cargo_category: string; weight_tons: number; priority_score: number; ai_reason: string; status: string; destination: string; vehicle_count: number; requires_action: boolean; }
interface MovementPlan { convoy_id: number; convoy_name: string; status: string; optimization_score: number; eta: string; halts_planned: number; risk_level: string; }
interface SharingRec { type: string; priority: string; text: string; action: string; }

interface DashboardData {
  status: string; timestamp: string; ai_engine: string; system_status: string;
  load_management: { queue_size: number; high_priority_count: number; pending_assignment: number; top_priority_loads: LoadItem[]; };
  vehicle_sharing: { pool_available: number; utilization_rate: number; sharing_opportunities: number; recommendations: SharingRec[]; };
  movement_planning: { active_plans: number; convoys_in_transit: number; convoys_planned: number; plans_summary: MovementPlan[]; };
  road_space: { routes_congested: number; routes_clear: number; optimal_windows: Array<{ window_start: string; window_end: string; expected_congestion: number; recommended: boolean; }>; };
  notifications: { active_count: number; critical_alerts: number; recent_notifications: any[]; };
  ai_summary: { overall_status: string; critical_issues: string[]; recommendations: string[]; convoys_active: number; system_efficiency: number; };
}

export default function AILoadManagementPanel() {
  const [activeTab, setActiveTab] = useState<TabType>('command');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => { setIsClient(true); }, []);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ai-load/dashboard`);
      const data = await res.json();
      if (data.status === 'success') {
        setDashboard(data);
        setLastUpdate(new Date());
      }
    } catch (e) { console.error('Dashboard fetch failed:', e); }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 25000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  // Derived chart data
  const chartData = useMemo(() => {
    if (!dashboard) return { cargo: [], status: [], performance: [], timeline: [], vehicles: [] };
    const loads = dashboard.load_management?.top_priority_loads || [];
    const cargoMap: Record<string, number> = {};
    loads.forEach(l => { cargoMap[l.cargo_category] = (cargoMap[l.cargo_category] || 0) + 1; });
    const cargoColors: Record<string, string> = { AMMUNITION: '#ef4444', FUEL: '#f59e0b', MEDICAL: '#06b6d4', RATIONS: '#22c55e', GENERAL: '#8b5cf6', PERSONNEL: '#ec4899', EQUIPMENT: '#6366f1' };

    // Generate realistic timeline data
    const hours = ['04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];
    const timeline = hours.map((hour, i) => ({
      hour,
      convoys: Math.max(1, dashboard.ai_summary?.convoys_active - Math.abs(3 - i) + Math.floor(Math.random() * 2)),
      loads: dashboard.load_management?.queue_size + i - 2,
      efficiency: Math.min(100, dashboard.ai_summary?.system_efficiency - (i * 2) + Math.random() * 5),
    }));

    // Vehicle type distribution
    const vehicles = [
      { type: 'TATRA', count: 8, capacity: 12, color: '#22c55e' },
      { type: 'SHAKTIMAN', count: 12, capacity: 5, color: '#06b6d4' },
      { type: 'STALLION', count: 6, capacity: 7, color: '#f59e0b' },
      { type: 'TANKER', count: 4, capacity: 18, color: '#ef4444' },
    ];

    return {
      cargo: Object.entries(cargoMap).map(([name, value]) => ({ name, value, color: cargoColors[name] || '#9ca3af' })),
      status: [
        { name: 'In Transit', value: dashboard.movement_planning?.convoys_in_transit || 0, color: '#22c55e' },
        { name: 'Planned', value: dashboard.movement_planning?.convoys_planned || 0, color: '#06b6d4' },
        { name: 'Pending', value: dashboard.load_management?.pending_assignment || 0, color: '#f59e0b' },
      ],
      performance: [
        { metric: 'Fleet Util', value: dashboard.vehicle_sharing?.utilization_rate || 0 },
        { metric: 'Efficiency', value: dashboard.ai_summary?.system_efficiency || 0 },
        { metric: 'Routes OK', value: (dashboard.road_space?.routes_clear || 0) * 25 },
        { metric: 'Plans', value: Math.min((dashboard.movement_planning?.active_plans || 0) * 18, 100) },
        { metric: 'Queue', value: 100 - (dashboard.load_management?.high_priority_count || 0) * 12 },
      ],
      timeline,
      vehicles,
    };
  }, [dashboard]);

  if (!isClient) return null;

  const tabs = [
    { id: 'command' as TabType, icon: '🎖️', label: 'COMMAND', sub: 'Overview' },
    { id: 'queue' as TabType, icon: '📋', label: 'PRIORITY QUEUE', sub: 'Loads' },
    { id: 'sharing' as TabType, icon: '🔄', label: 'VEHICLE POOL', sub: 'Resources' },
    { id: 'plans' as TabType, icon: '🗺️', label: 'MOVEMENT', sub: 'Operations' },
    { id: 'analytics' as TabType, icon: '📊', label: 'ANALYTICS', sub: 'Metrics' },
    { id: 'threats' as TabType, icon: '⚠️', label: 'THREATS', sub: 'Intel' },
  ];

  return (
    <div style={s.container}>
      <div style={s.camo} />
      <div style={s.content}>
        {/* Header */}
        <div style={s.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={s.headerIcon}>🎖️</div>
            <div>
              <div style={s.title}>AI LOAD MANAGEMENT COMMAND</div>
              <div style={s.subtitle}>INTELLIGENT CARGO PRIORITIZATION • {dashboard?.ai_engine || 'JANUS AI'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={fetchDashboard} disabled={loading} style={s.refreshBtn}>
              {loading ? '⏳' : '🔄'} SYNC
            </button>
            <div style={s.statusBadge}>
              <div style={s.statusDot(dashboard?.system_status === 'OPERATIONAL')} />
              {dashboard?.system_status || 'INIT'}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={s.tabs}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={s.tab(activeTab === t.id)}>
              <span style={{ marginRight: 4 }}>{t.icon}</span>{t.label}
              <span style={{ display: 'block', fontSize: 8, color: activeTab === t.id ? '#86efac' : '#6b7280', marginTop: 1 }}>{t.sub}</span>
            </button>
          ))}
        </div>

        {/* Command Tab - Enhanced Overview */}
        {activeTab === 'command' && dashboard && (
          <>
            {/* Primary Metrics Row */}
            <div style={s.grid6}>
              {[
                { v: dashboard.load_management?.queue_size || 0, l: 'QUEUE', c: '#22c55e' },
                { v: dashboard.load_management?.high_priority_count || 0, l: 'FLASH/HIGH', c: '#ef4444' },
                { v: dashboard.ai_summary?.convoys_active || 0, l: 'ACTIVE', c: '#06b6d4' },
                { v: dashboard.movement_planning?.active_plans || 0, l: 'PLANS', c: '#8b5cf6' },
                { v: `${dashboard.vehicle_sharing?.utilization_rate?.toFixed(0) || 0}%`, l: 'FLEET', c: '#f59e0b' },
                { v: `${dashboard.ai_summary?.system_efficiency?.toFixed(0) || 0}%`, l: 'EFFICIENCY', c: '#22c55e' },
              ].map((m, i) => (
                <div key={i} style={s.metricCard(m.c)}>
                  <div style={s.metricValue(m.c)}>{m.v}</div>
                  <div style={s.metricLabel}>{m.l}</div>
                </div>
              ))}
            </div>

            {/* Charts Row */}
            <div style={s.grid3}>
              {/* Convoy Status Pie */}
              <div style={s.card}>
                <div style={s.chartTitle('#22c55e')}>🚛 CONVOY STATUS</div>
                {isClient && chartData.status.length > 0 ? (
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie data={chartData.status} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" label={({ value }) => `${value}`}>
                        {chartData.status.map((entry, index) => (<Cell key={index} fill={entry.color} />))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: 12 }}>Loading chart...</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 4 }}>
                  {chartData.status.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                      <span style={{ color: '#9ca3af' }}>{s.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Performance Radar */}
              <div style={s.card}>
                <div style={s.chartTitle('#8b5cf6')}>📈 PERFORMANCE</div>
                {isClient && chartData.performance.length > 0 ? (
                  <ResponsiveContainer width="100%" height={150}>
                    <RadarChart data={chartData.performance}>
                      <PolarGrid stroke="#475569" />
                      <PolarAngleAxis dataKey="metric" stroke="#9ca3af" fontSize={8} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#6b7280" fontSize={7} />
                      <Radar name="Current" dataKey="value" stroke="#22c55e" fill="#22c55e" fillOpacity={0.4} />
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: 12 }}>Loading chart...</div>
                )}
              </div>

              {/* Operational Timeline */}
              <div style={s.card}>
                <div style={s.chartTitle('#f59e0b')}>⏱️ OPS TIMELINE</div>
                {isClient && chartData.timeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height={150}>
                    <AreaChart data={chartData.timeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="hour" stroke="#9ca3af" fontSize={8} />
                      <YAxis stroke="#9ca3af" fontSize={8} />
                      <Area type="monotone" dataKey="convoys" stroke="#22c55e" fill="#22c55e40" name="Convoys" />
                      <Area type="monotone" dataKey="loads" stroke="#f59e0b" fill="#f59e0b40" name="Loads" />
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8, fontSize: 10 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: 12 }}>Loading chart...</div>
                )}
              </div>
            </div>

            {/* Secondary Row */}
            <div style={s.grid2}>
              {/* Road Space */}
              <div style={s.card}>
                <div style={s.chartTitle('#06b6d4')}>🛣️ ROAD SPACE UTILIZATION</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <div style={s.miniCard('#22c55e')}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e' }}>{dashboard.road_space?.routes_clear || 0}</div>
                    <div style={{ fontSize: 9, color: '#9ca3af' }}>CLEAR</div>
                  </div>
                  <div style={s.miniCard('#ef4444')}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}>{dashboard.road_space?.routes_congested || 0}</div>
                    <div style={{ fontSize: 9, color: '#9ca3af' }}>CONGESTED</div>
                  </div>
                  <div style={s.miniCard('#f59e0b')}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>{dashboard.road_space?.optimal_windows?.length || 0}</div>
                    <div style={{ fontSize: 9, color: '#9ca3af' }}>WINDOWS</div>
                  </div>
                  <div style={s.miniCard('#8b5cf6')}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#8b5cf6' }}>{dashboard.notifications?.active_count || 0}</div>
                    <div style={{ fontSize: 9, color: '#9ca3af' }}>ALERTS</div>
                  </div>
                </div>
                {dashboard.road_space?.optimal_windows?.[0] && (
                  <div style={{ marginTop: 10, padding: 8, background: 'rgba(34,197,94,0.1)', borderRadius: 6, border: '1px solid rgba(34,197,94,0.3)' }}>
                    <div style={{ fontSize: 10, color: '#6b7280' }}>OPTIMAL DEPARTURE WINDOW</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#22c55e' }}>
                      {dashboard.road_space.optimal_windows[0].window_start} — {dashboard.road_space.optimal_windows[0].window_end}
                    </div>
                  </div>
                )}
              </div>

              {/* Vehicle Fleet */}
              <div style={s.card}>
                <div style={s.chartTitle('#22c55e')}>🚛 FLEET COMPOSITION</div>
                {isClient && chartData.vehicles.length > 0 ? (
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={chartData.vehicles} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis type="number" stroke="#9ca3af" fontSize={8} />
                      <YAxis type="category" dataKey="type" stroke="#9ca3af" fontSize={9} width={60} />
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8, fontSize: 10 }} />
                      <Bar dataKey="count" name="Count">
                        {chartData.vehicles.map((entry, index) => (<Cell key={index} fill={entry.color} />))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: 12 }}>Loading chart...</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: '#9ca3af' }}>
                  <span>Total: {chartData.vehicles.reduce((a, v) => a + v.count, 0)} vehicles</span>
                  <span>Capacity: {chartData.vehicles.reduce((a, v) => a + v.count * v.capacity, 0)}T</span>
                </div>
              </div>
            </div>

            {/* AI Briefing */}
            <div style={s.aiBriefing}>
              <div style={s.aiHeader}>
                <div style={s.aiIcon}>🧠</div>
                <div>
                  <div style={{ color: '#22c55e', fontSize: 12, fontWeight: 700, letterSpacing: 2 }}>AI TACTICAL BRIEFING</div>
                  <div style={{ color: '#6b7280', fontSize: 10 }}>{dashboard.ai_engine} • {lastUpdate?.toLocaleTimeString()}</div>
                </div>
                <div style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 6, background: dashboard.ai_summary?.overall_status === 'NORMAL' ? 'rgba(34,197,94,0.2)' : dashboard.ai_summary?.overall_status === 'ATTENTION' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)', border: `1px solid ${dashboard.ai_summary?.overall_status === 'NORMAL' ? 'rgba(34,197,94,0.5)' : dashboard.ai_summary?.overall_status === 'ATTENTION' ? 'rgba(245,158,11,0.5)' : 'rgba(239,68,68,0.5)'}`, color: dashboard.ai_summary?.overall_status === 'NORMAL' ? '#22c55e' : dashboard.ai_summary?.overall_status === 'ATTENTION' ? '#f59e0b' : '#ef4444', fontWeight: 700, fontSize: 11 }}>
                  {dashboard.ai_summary?.overall_status || 'ANALYZING'}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ color: '#ef4444', fontSize: 10, fontWeight: 700, marginBottom: 6, letterSpacing: 1 }}>⚠️ CRITICAL ISSUES</div>
                  {(dashboard.ai_summary?.critical_issues || []).length > 0 ? dashboard.ai_summary.critical_issues.map((issue, i) => (
                    <div key={i} style={{ color: '#fca5a5', fontSize: 11, marginBottom: 3, paddingLeft: 10, borderLeft: '2px solid #ef4444' }}>{issue}</div>
                  )) : <div style={{ color: '#6b7280', fontSize: 11 }}>✓ No critical issues detected</div>}
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ color: '#22c55e', fontSize: 10, fontWeight: 700, marginBottom: 6, letterSpacing: 1 }}>💡 RECOMMENDATIONS</div>
                  {(dashboard.ai_summary?.recommendations || []).length > 0 ? dashboard.ai_summary.recommendations.map((rec, i) => (
                    <div key={i} style={{ color: '#86efac', fontSize: 11, marginBottom: 3, paddingLeft: 10, borderLeft: '2px solid #22c55e' }}>{rec}</div>
                  )) : <div style={{ color: '#6b7280', fontSize: 11 }}>✓ System operating optimally</div>}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Queue Tab */}
        {activeTab === 'queue' && dashboard && (
          <>
            <div style={s.grid4}>
              <div style={s.metricCard('#22c55e')}><div style={s.metricValue('#22c55e')}>{dashboard.load_management?.queue_size || 0}</div><div style={s.metricLabel}>TOTAL QUEUE</div></div>
              <div style={s.metricCard('#ef4444')}><div style={s.metricValue('#ef4444')}>{dashboard.load_management?.high_priority_count || 0}</div><div style={s.metricLabel}>HIGH/FLASH</div></div>
              <div style={s.metricCard('#f59e0b')}><div style={s.metricValue('#f59e0b')}>{dashboard.load_management?.pending_assignment || 0}</div><div style={s.metricLabel}>PENDING</div></div>
              <div style={s.metricCard('#06b6d4')}><div style={s.metricValue('#06b6d4')}>{(dashboard.load_management?.top_priority_loads || []).filter(l => l.status === 'IN_TRANSIT').length}</div><div style={s.metricLabel}>IN TRANSIT</div></div>
            </div>

            <div style={s.card}>
              <div style={s.chartTitle('#06b6d4')}>📋 LOAD REQUEST PRIORITY QUEUE</div>
              {(dashboard.load_management?.top_priority_loads || []).length > 0 ? (
                dashboard.load_management.top_priority_loads.map((load) => (
                  <div key={load.request_id} style={s.queueItem(load.priority_score)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={s.priorityBadge(load.priority_score)}>{Math.round(load.priority_score)}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{load.convoy_name}</span>
                          <span style={{ padding: '2px 6px', borderRadius: 4, background: load.cargo_category === 'AMMUNITION' ? 'rgba(239,68,68,0.2)' : load.cargo_category === 'MEDICAL' ? 'rgba(6,182,212,0.2)' : load.cargo_category === 'FUEL' ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)', color: load.cargo_category === 'AMMUNITION' ? '#fca5a5' : load.cargo_category === 'MEDICAL' ? '#67e8f9' : load.cargo_category === 'FUEL' ? '#fcd34d' : '#86efac', fontSize: 9, fontWeight: 600 }}>{load.cargo_category}</span>
                          <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(139,92,246,0.2)', color: '#c4b5fd', fontSize: 9 }}>{load.request_id}</span>
                        </div>
                        <div style={{ color: '#9ca3af', fontSize: 11, marginBottom: 2 }}>📍 {load.destination} • 🚛 {load.vehicle_count} vehicles • ⚖️ {load.weight_tons}T</div>
                        <div style={{ color: '#6b7280', fontSize: 10, fontFamily: 'monospace' }}>{load.ai_reason}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ padding: '4px 10px', borderRadius: 6, background: load.status === 'PLANNED' ? 'rgba(6,182,212,0.2)' : load.status === 'IN_TRANSIT' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)', color: load.status === 'PLANNED' ? '#67e8f9' : load.status === 'IN_TRANSIT' ? '#86efac' : '#fcd34d', fontSize: 10, fontWeight: 600 }}>{load.status}</div>
                        {load.requires_action && <div style={{ marginTop: 4, color: '#f59e0b', fontSize: 9 }}>⚡ ACTION REQ</div>}
                      </div>
                    </div>
                  </div>
                ))
              ) : <div style={{ textAlign: 'center', padding: 30, color: '#6b7280' }}>No load requests in queue</div>}
            </div>
          </>
        )}

        {/* Sharing Tab */}
        {activeTab === 'sharing' && dashboard && (
          <>
            <div style={s.grid4}>
              <div style={s.metricCard('#22c55e')}><div style={s.metricValue('#22c55e')}>{dashboard.vehicle_sharing?.pool_available || 0}</div><div style={s.metricLabel}>POOL AVAILABLE</div></div>
              <div style={s.metricCard('#06b6d4')}><div style={s.metricValue('#06b6d4')}>{dashboard.vehicle_sharing?.sharing_opportunities || 0}</div><div style={s.metricLabel}>OPPORTUNITIES</div></div>
              <div style={s.metricCard('#8b5cf6')}><div style={s.metricValue('#8b5cf6')}>{dashboard.vehicle_sharing?.utilization_rate?.toFixed(0) || 0}%</div><div style={s.metricLabel}>UTILIZATION</div></div>
              <div style={s.metricCard('#f59e0b')}><div style={s.metricValue('#f59e0b')}>{(dashboard.vehicle_sharing?.recommendations || []).length}</div><div style={s.metricLabel}>AI RECS</div></div>
            </div>

            <div style={s.grid2}>
              <div style={s.card}>
                <div style={s.chartTitle('#22c55e')}>🚛 FLEET CAPACITY</div>
                {isClient && chartData.vehicles.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData.vehicles}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="type" stroke="#9ca3af" fontSize={10} />
                      <YAxis stroke="#9ca3af" fontSize={10} />
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }} />
                      <Bar dataKey="count" name="Vehicle Count">
                        {chartData.vehicles.map((entry, index) => (<Cell key={index} fill={entry.color} />))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: 12 }}>Loading chart...</div>
                )}
              </div>

              <div style={s.card}>
                <div style={s.chartTitle('#f59e0b')}>📊 AI RECOMMENDATIONS</div>
                {(dashboard.vehicle_sharing?.recommendations || []).slice(0, 4).map((rec, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'rgba(0,0,0,0.3)', borderRadius: 8, marginBottom: 8, border: `1px solid ${rec.priority === 'HIGH' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}` }}>
                    <div style={{ padding: '3px 8px', borderRadius: 4, background: rec.priority === 'HIGH' ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)', color: rec.priority === 'HIGH' ? '#fca5a5' : '#86efac', fontSize: 9, fontWeight: 700 }}>{rec.priority}</div>
                    <div style={{ flex: 1, color: '#d1d5db', fontSize: 11 }}>{rec.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Plans Tab */}
        {activeTab === 'plans' && dashboard && (
          <>
            <div style={s.grid4}>
              <div style={s.metricCard('#22c55e')}><div style={s.metricValue('#22c55e')}>{dashboard.movement_planning?.active_plans || 0}</div><div style={s.metricLabel}>TOTAL PLANS</div></div>
              <div style={s.metricCard('#06b6d4')}><div style={s.metricValue('#06b6d4')}>{dashboard.movement_planning?.convoys_in_transit || 0}</div><div style={s.metricLabel}>IN TRANSIT</div></div>
              <div style={s.metricCard('#8b5cf6')}><div style={s.metricValue('#8b5cf6')}>{dashboard.movement_planning?.convoys_planned || 0}</div><div style={s.metricLabel}>SCHEDULED</div></div>
              <div style={s.metricCard('#f59e0b')}><div style={s.metricValue('#f59e0b')}>{(dashboard.movement_planning?.plans_summary || []).reduce((a, p) => a + p.halts_planned, 0)}</div><div style={s.metricLabel}>HALTS PLANNED</div></div>
            </div>

            <div style={s.card}>
              <div style={s.chartTitle('#22c55e')}>🗺️ ACTIVE MOVEMENT PLANS</div>
              {(dashboard.movement_planning?.plans_summary || []).map((plan) => (
                <div key={plan.convoy_id} style={s.planCard(plan.status)}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{plan.convoy_name}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 4, background: plan.status === 'IN_TRANSIT' ? 'rgba(34,197,94,0.2)' : 'rgba(6,182,212,0.2)', color: plan.status === 'IN_TRANSIT' ? '#86efac' : '#67e8f9', fontSize: 9, fontWeight: 600 }}>{plan.status}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 4, background: plan.risk_level === 'HIGH' ? 'rgba(239,68,68,0.2)' : plan.risk_level === 'MEDIUM' ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)', color: plan.risk_level === 'HIGH' ? '#fca5a5' : plan.risk_level === 'MEDIUM' ? '#fcd34d' : '#86efac', fontSize: 9, fontWeight: 600 }}>RISK: {plan.risk_level}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 14, color: '#9ca3af', fontSize: 11 }}>
                        <span>⏰ ETA: {new Date(plan.eta).toLocaleTimeString()}</span>
                        <span>⏸️ {plan.halts_planned} halts</span>
                        <span>📊 Score: {plan.optimization_score.toFixed(0)}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: plan.optimization_score >= 85 ? '#22c55e' : plan.optimization_score >= 70 ? '#f59e0b' : '#ef4444' }}>{plan.optimization_score.toFixed(0)}</div>
                      <div style={{ fontSize: 9, color: '#6b7280' }}>OPT SCORE</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && dashboard && (
          <>
            <div style={s.grid3}>
              <div style={s.card}>
                <div style={s.chartTitle('#22c55e')}>📈 CONVOY TREND</div>
                {isClient && chartData.timeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData.timeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="hour" stroke="#9ca3af" fontSize={9} />
                      <YAxis stroke="#9ca3af" fontSize={9} />
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8, fontSize: 10 }} />
                      <Line type="monotone" dataKey="convoys" stroke="#22c55e" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="loads" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: 12 }}>Loading chart...</div>
                )}
              </div>

              <div style={s.card}>
                <div style={s.chartTitle('#06b6d4')}>🎯 CARGO DISTRIBUTION</div>
                {isClient ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={chartData.cargo.length > 0 ? chartData.cargo : [{ name: 'GENERAL', value: 1, color: '#8b5cf6' }]} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" label={({ name }) => name}>
                        {(chartData.cargo.length > 0 ? chartData.cargo : [{ name: 'GENERAL', value: 1, color: '#8b5cf6' }]).map((entry, index) => (<Cell key={index} fill={entry.color} />))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: 12 }}>Loading chart...</div>
                )}
              </div>

              <div style={s.card}>
                <div style={s.chartTitle('#8b5cf6')}>⚡ EFFICIENCY METRICS</div>
                {isClient && chartData.performance.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <RadarChart data={chartData.performance}>
                      <PolarGrid stroke="#475569" />
                      <PolarAngleAxis dataKey="metric" stroke="#9ca3af" fontSize={9} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#6b7280" fontSize={8} />
                      <Radar name="Current" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.4} />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: 12 }}>Loading chart...</div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Threats Tab */}
        {activeTab === 'threats' && dashboard && (
          <div style={s.grid2}>
            <div style={s.card}>
              <div style={s.chartTitle('#ef4444')}>⚠️ THREAT INDICATORS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div style={s.miniCard('#ef4444')}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#ef4444' }}>{dashboard.notifications?.critical_alerts || 0}</div>
                  <div style={{ fontSize: 9, color: '#9ca3af' }}>CRITICAL ALERTS</div>
                </div>
                <div style={s.miniCard('#f59e0b')}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b' }}>{dashboard.road_space?.routes_congested || 0}</div>
                  <div style={{ fontSize: 9, color: '#9ca3af' }}>CONGESTED</div>
                </div>
              </div>
              <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 700, marginBottom: 6 }}>THREAT ASSESSMENT</div>
                <div style={{ color: '#fca5a5', fontSize: 11, lineHeight: 1.5 }}>
                  Current threat level based on {dashboard.ai_summary?.convoys_active || 0} active convoys and {dashboard.road_space?.routes_clear || 0} clear routes.
                  AI recommends maintaining standard operational protocols with enhanced vigilance during peak hours.
                </div>
              </div>
            </div>
            <div style={s.card}>
              <div style={s.chartTitle('#22c55e')}>🛡️ SECURITY STATUS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['Route Security', 'Convoy Integrity', 'Communication', 'Intel Coverage'].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ flex: 1, fontSize: 11, color: '#d1d5db' }}>{item}</span>
                    <div style={{ width: 120, height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${75 + i * 5}%`, height: '100%', background: 'linear-gradient(90deg, #22c55e, #06b6d4)', borderRadius: 4 }} />
                    </div>
                    <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>{75 + i * 5}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {!dashboard && loading && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
            <div style={{ color: '#9ca3af', fontSize: 13 }}>Loading dashboard data from database...</div>
          </div>
        )}
      </div>
    </div>
  );
}
