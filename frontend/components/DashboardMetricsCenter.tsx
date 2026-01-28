'use client';

import React, { useState, useEffect } from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
  Legend,
  ComposedChart,
} from 'recharts';

// ============================================================================
// INDIAN ARMY CAMOUFLAGE THEME COLORS
// ============================================================================
const COLORS = {
  primary: '#22c55e',
  secondary: '#15803d',
  accent: '#fbbf24',
  danger: '#ef4444',
  warning: '#f97316',
  info: '#3b82f6',
  dark: '#0a0a0a',
  panel: 'rgba(0, 20, 0, 0.95)',
  border: 'rgba(34, 197, 94, 0.3)',
};

const THREAT_COLORS = {
  GREEN: '#22c55e',
  YELLOW: '#eab308',
  ORANGE: '#f97316',
  RED: '#ef4444',
};

const PRIORITY_COLORS = {
  FLASH: '#ef4444',
  IMMEDIATE: '#f97316',
  PRIORITY: '#eab308',
  ROUTINE: '#22c55e',
};

const API_URL = '/api/proxy/v1/scheduling';

interface DashboardMetrics {
  generated_at: string;
  data_source: string;
  summary: {
    total_convoys: number;
    active_convoys: number;
    halted_convoys: number;
    planned_convoys: number;
    total_vehicles_deployed: number;
    total_tcps: number;
    congested_tcps: number;
    total_routes: number;
    high_risk_routes: number;
    active_obstacles: number;
    blocking_obstacles: number;
    total_assets: number;
    available_assets: number;
    overall_readiness_percent: number;
    avg_fleet_fuel_percent: number;
    tcp_crossings_24h: number;
  };
  temporal: {
    time_of_day: string;
    is_daylight: boolean;
    current_hour: number;
    mission_day: string;
    mission_date: string;
  };
  convoys: {
    by_status: Record<string, number>;
    active_details: Array<{
      id: number;
      name: string;
      status: string;
      vehicle_count: number;
      origin: string;
      destination: string;
      start_time: string | null;
      route_name: string | null;
      route_threat: string;
    }>;
  };
  tcps: {
    by_traffic: Record<string, number>;
    congested_list: Array<{ name: string; code: string; current_traffic: string }>;
    all_tcps: Array<{ id: number; name: string; code: string; current_traffic: string }>;
  };
  routes: {
    by_threat: Record<string, number>;
    by_weather: Record<string, number>;
    by_status: Record<string, number>;
    high_risk_list: Array<{ name: string; threat_level: string }>;
    all_routes: Array<{ id: number; name: string; threat_level: string; weather_status: string; distance_km: number }>;
  };
  obstacles: {
    by_type: Record<string, number>;
    by_severity: Record<string, number>;
    blocking_list: Array<{ id: number; type: string; severity: string; impact_score: number; route_id: number | null; status: string }>;
  };
  fleet: {
    by_status: Record<string, number>;
    by_type: Record<string, number>;
    avg_fuel_percent: number;
  };
  readiness: {
    overall_percent: number;
    factors: Record<string, number>;
    status: string;
  };
}

interface ThreatTimeline {
  timeline: Array<{
    hour: number;
    threat_score: number;
    threat_level: string;
    period: string;
    is_current: boolean;
  }>;
  peak_threat_hours: number[];
  safest_hours: number[];
}

export default function DashboardMetricsCenter() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [threatTimeline, setThreatTimeline] = useState<ThreatTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Fetch real-time metrics
  const fetchMetrics = async () => {
    try {
      const [metricsRes, timelineRes] = await Promise.all([
        fetch(`${API_URL}/dashboard/realtime-metrics`),
        fetch(`${API_URL}/dashboard/threat-timeline`),
      ]);

      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data);
      }

      if (timelineRes.ok) {
        const data = await timelineRes.json();
        setThreatTimeline(data);
      }

      setLastUpdate(new Date());
      setLoading(false);
    } catch (e) {
      console.error('Failed to fetch metrics:', e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        background: COLORS.dark,
        color: COLORS.primary,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 10 }}>⚡</div>
          <div>Loading Real-Time Intelligence...</div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div style={{ padding: 20, color: COLORS.danger }}>
        Failed to load dashboard metrics. Check backend connectivity.
      </div>
    );
  }

  // Prepare chart data from live metrics
  const readinessRadarData = Object.entries(metrics.readiness.factors).map(([key, value]) => ({
    subject: key.replace(/_/g, ' ').toUpperCase(),
    value: value,
    fullMark: 100,
  }));

  const convoyStatusData = Object.entries(metrics.convoys.by_status)
    .filter(([_, v]) => v > 0)
    .map(([status, count]) => ({
      name: status.replace(/_/g, ' '),
      value: count,
      color: status === 'IN_TRANSIT' ? '#3b82f6' : status === 'COMPLETED' ? '#22c55e' : status === 'HALTED' ? '#eab308' : '#6b7280',
    }));

  // Fleet by type data (since priority is not in DB model)
  const fleetTypeData = Object.entries(metrics.fleet.by_type)
    .filter(([_, v]) => v > 0)
    .slice(0, 5) // Top 5 vehicle types
    .map(([type, count], i) => ({
      name: type.length > 12 ? type.substring(0, 12) + '...' : type,
      count: count,
      color: ['#22c55e', '#3b82f6', '#eab308', '#f97316', '#ef4444'][i % 5],
    }));

  const threatDistributionData = Object.entries(metrics.routes.by_threat).map(([level, count]) => ({
    name: level,
    value: count,
    color: THREAT_COLORS[level as keyof typeof THREAT_COLORS] || '#6b7280',
  }));

  const tcpTrafficData = Object.entries(metrics.tcps.by_traffic)
    .filter(([_, v]) => v > 0)
    .map(([traffic, count]) => ({
      name: traffic,
      count: count,
      color: traffic === 'LIGHT' ? '#22c55e' : traffic === 'MODERATE' ? '#3b82f6' : traffic === 'HEAVY' ? '#eab308' : traffic === 'CONGESTED' ? '#f97316' : '#ef4444',
    }));

  const obstacleData = Object.entries(metrics.obstacles.by_severity)
    .filter(([_, v]) => v > 0)
    .map(([severity, count]) => ({
      name: severity,
      count: count,
      color: severity === 'LOW' ? '#22c55e' : severity === 'MEDIUM' ? '#eab308' : severity === 'HIGH' ? '#f97316' : '#ef4444',
    }));

  const fleetStatusData = Object.entries(metrics.fleet.by_status)
    .filter(([_, v]) => v > 0)
    .map(([status, count]) => ({
      name: status.replace(/_/g, ' '),
      value: count,
    }));

  const threatTimelineData = threatTimeline?.timeline.filter((_, i) => i % 2 === 0).map(t => ({
    hour: `${t.hour.toString().padStart(2, '0')}:00`,
    threat: Math.round(t.threat_score * 100),
    period: t.period,
    isCurrent: t.is_current,
  })) || [];

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: COLORS.dark,
      padding: 15,
      overflow: 'auto',
    }}>
      {/* HEADER */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        padding: '10px 15px',
        background: 'linear-gradient(90deg, rgba(0,40,0,0.9) 0%, rgba(0,20,0,0.9) 100%)',
        borderRadius: 8,
        border: `1px solid ${COLORS.border}`,
      }}>
        <div>
          <div style={{ color: COLORS.primary, fontWeight: 'bold', fontSize: 16, letterSpacing: 2 }}>
            ⚡ REAL-TIME OPERATIONS DASHBOARD
          </div>
          <div style={{ color: '#9ca3af', fontSize: 11 }}>
            {metrics.temporal.mission_day}, {metrics.temporal.mission_date} | {metrics.temporal.time_of_day} OPERATIONS
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#6b7280', fontSize: 10 }}>LAST UPDATE</div>
          <div style={{ color: COLORS.primary, fontSize: 12, fontFamily: 'monospace' }}>
            {lastUpdate?.toLocaleTimeString() || '--:--:--'}
          </div>
          <div style={{
            fontSize: 9,
            color: metrics.data_source === 'LIVE_DATABASE' ? '#22c55e' : '#eab308',
            marginTop: 2,
          }}>
            ● {metrics.data_source}
          </div>
        </div>
      </div>

      {/* SUMMARY STATS ROW */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: 10,
        marginBottom: 15,
      }}>
        {[
          { label: 'ACTIVE CONVOYS', value: metrics.summary.active_convoys, total: metrics.summary.total_convoys, color: '#3b82f6', icon: '🚛' },
          { label: 'AVAILABLE ASSETS', value: metrics.summary.available_assets, total: metrics.summary.total_assets, color: '#22c55e', icon: '🚗' },
          { label: 'VEHICLES DEPLOYED', value: metrics.summary.total_vehicles_deployed, color: '#eab308', icon: '🚚' },
          { label: 'OPERATIONAL READINESS', value: `${metrics.summary.overall_readiness_percent}%`, color: metrics.summary.overall_readiness_percent >= 85 ? '#22c55e' : metrics.summary.overall_readiness_percent >= 70 ? '#eab308' : '#ef4444', icon: '⚡' },
          { label: 'HIGH RISK ROUTES', value: metrics.summary.high_risk_routes, total: metrics.summary.total_routes, color: '#f97316', icon: '⚠️' },
          { label: 'ACTIVE OBSTACLES', value: metrics.summary.blocking_obstacles, total: metrics.summary.active_obstacles, color: '#ef4444', icon: '🚧' },
        ].map((stat, i) => (
          <div key={i} style={{
            background: COLORS.panel,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            padding: 12,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 18 }}>{stat.icon}</div>
            <div style={{ color: stat.color, fontSize: 22, fontWeight: 'bold', fontFamily: 'monospace' }}>
              {stat.value}
              {stat.total !== undefined && <span style={{ fontSize: 12, color: '#6b7280' }}>/{stat.total}</span>}
            </div>
            <div style={{ color: '#9ca3af', fontSize: 9, letterSpacing: 1 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* MAIN CHARTS GRID */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 15,
        marginBottom: 15,
      }}>
        {/* OPERATIONAL READINESS RADAR */}
        <div style={{
          background: COLORS.panel,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          padding: 15,
        }}>
          <div style={{ color: COLORS.primary, fontWeight: 'bold', fontSize: 12, marginBottom: 10, letterSpacing: 1 }}>
            📊 OPERATIONAL READINESS FACTORS
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={readinessRadarData}>
              <PolarGrid stroke="#1e3a1e" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 8 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 8 }} />
              <Radar name="Readiness" dataKey="value" stroke="#22c55e" fill="#22c55e" fillOpacity={0.4} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
          <div style={{ textAlign: 'center', marginTop: 5 }}>
            <span style={{
              background: metrics.readiness.status === 'FULLY_OPERATIONAL' ? 'rgba(34,197,94,0.2)' : metrics.readiness.status === 'OPERATIONAL' ? 'rgba(234,179,8,0.2)' : 'rgba(239,68,68,0.2)',
              border: `1px solid ${metrics.readiness.status === 'FULLY_OPERATIONAL' ? '#22c55e' : metrics.readiness.status === 'OPERATIONAL' ? '#eab308' : '#ef4444'}`,
              color: metrics.readiness.status === 'FULLY_OPERATIONAL' ? '#22c55e' : metrics.readiness.status === 'OPERATIONAL' ? '#eab308' : '#ef4444',
              padding: '3px 10px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 'bold',
            }}>
              {metrics.readiness.status}
            </span>
          </div>
        </div>

        {/* THREAT TIMELINE */}
        <div style={{
          background: COLORS.panel,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          padding: 15,
        }}>
          <div style={{ color: COLORS.accent, fontWeight: 'bold', fontSize: 12, marginBottom: 10, letterSpacing: 1 }}>
            ⏱️ 24-HOUR THREAT TIMELINE
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={threatTimelineData}>
              <defs>
                <linearGradient id="threatGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.6}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a1e" />
              <XAxis dataKey="hour" tick={{ fill: '#6b7280', fontSize: 8 }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 8 }} />
              <Tooltip
                contentStyle={{ background: '#0a0a0a', border: '1px solid #22c55e', fontSize: 11 }}
                labelStyle={{ color: '#22c55e' }}
              />
              <Area type="monotone" dataKey="threat" stroke="#ef4444" fill="url(#threatGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* CONVOY STATUS PIE */}
        <div style={{
          background: COLORS.panel,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          padding: 15,
        }}>
          <div style={{ color: COLORS.info, fontWeight: 'bold', fontSize: 12, marginBottom: 10, letterSpacing: 1 }}>
            🚛 CONVOY STATUS DISTRIBUTION
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={convoyStatusData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {convoyStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#0a0a0a', border: '1px solid #22c55e', fontSize: 11 }}
              />
              <Legend
                wrapperStyle={{ fontSize: 9 }}
                formatter={(value) => <span style={{ color: '#9ca3af' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SECOND ROW CHARTS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 15,
        marginBottom: 15,
      }}>
        {/* FLEET TYPE DISTRIBUTION */}
        <div style={{
          background: COLORS.panel,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          padding: 15,
        }}>
          <div style={{ color: '#f97316', fontWeight: 'bold', fontSize: 11, marginBottom: 10, letterSpacing: 1 }}>
            🚗 FLEET BY VEHICLE TYPE
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={fleetTypeData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a1e" />
              <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 8 }} />
              <YAxis dataKey="name" type="category" tick={{ fill: '#9ca3af', fontSize: 8 }} width={90} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {fleetTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* THREAT DISTRIBUTION */}
        <div style={{
          background: COLORS.panel,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          padding: 15,
        }}>
          <div style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 11, marginBottom: 10, letterSpacing: 1 }}>
            ⚠️ ROUTE THREAT LEVELS
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie
                data={threatDistributionData}
                cx="50%"
                cy="50%"
                outerRadius={55}
                dataKey="value"
                label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                labelLine={false}
              >
                {threatDistributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* TCP TRAFFIC */}
        <div style={{
          background: COLORS.panel,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          padding: 15,
        }}>
          <div style={{ color: '#3b82f6', fontWeight: 'bold', fontSize: 11, marginBottom: 10, letterSpacing: 1 }}>
            🚦 TCP TRAFFIC STATUS
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={tcpTrafficData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a1e" />
              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 8 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 8 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {tcpTrafficData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* OBSTACLES */}
        <div style={{
          background: COLORS.panel,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          padding: 15,
        }}>
          <div style={{ color: '#eab308', fontWeight: 'bold', fontSize: 11, marginBottom: 10, letterSpacing: 1 }}>
            🚧 OBSTACLE SEVERITY
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={obstacleData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a1e" />
              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 8 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 8 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {obstacleData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ACTIVE CONVOYS TABLE */}
      <div style={{
        background: COLORS.panel,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        padding: 15,
        marginBottom: 15,
      }}>
        <div style={{ color: COLORS.primary, fontWeight: 'bold', fontSize: 12, marginBottom: 10, letterSpacing: 1 }}>
          🚛 ACTIVE CONVOY TRACKER
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                {['NAME', 'STATUS', 'VEHICLES', 'ORIGIN', 'DESTINATION', 'ROUTE', 'THREAT'].map(h => (
                  <th key={h} style={{ padding: '8px 6px', textAlign: 'left', color: '#9ca3af', fontWeight: 'normal', fontSize: 9, letterSpacing: 1 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.convoys.active_details.slice(0, 5).map((convoy, i) => (
                <tr key={convoy.id} style={{ borderBottom: `1px solid rgba(34,197,94,0.1)` }}>
                  <td style={{ padding: '8px 6px', color: COLORS.primary, fontWeight: 'bold', fontFamily: 'monospace' }}>
                    {convoy.name}
                  </td>
                  <td style={{ padding: '8px 6px' }}>
                    <span style={{
                      background: convoy.status === 'IN_TRANSIT' ? 'rgba(59,130,246,0.2)' : convoy.status === 'HALTED' ? 'rgba(234,179,8,0.2)' : 'rgba(107,114,128,0.2)',
                      border: `1px solid ${convoy.status === 'IN_TRANSIT' ? '#3b82f6' : convoy.status === 'HALTED' ? '#eab308' : '#6b7280'}`,
                      color: convoy.status === 'IN_TRANSIT' ? '#3b82f6' : convoy.status === 'HALTED' ? '#eab308' : '#6b7280',
                      padding: '2px 6px',
                      borderRadius: 3,
                      fontSize: 9,
                    }}>
                      {convoy.status}
                    </span>
                  </td>
                  <td style={{ padding: '8px 6px', color: '#fff', textAlign: 'center' }}>{convoy.vehicle_count}</td>
                  <td style={{ padding: '8px 6px', color: '#9ca3af', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {convoy.origin}
                  </td>
                  <td style={{ padding: '8px 6px', color: '#9ca3af', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {convoy.destination}
                  </td>
                  <td style={{ padding: '8px 6px', color: '#3b82f6', fontSize: 10, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {convoy.route_name || 'N/A'}
                  </td>
                  <td style={{ padding: '8px 6px' }}>
                    <span style={{
                      background: `${THREAT_COLORS[convoy.route_threat as keyof typeof THREAT_COLORS] || '#22c55e'}20`,
                      border: `1px solid ${THREAT_COLORS[convoy.route_threat as keyof typeof THREAT_COLORS] || '#22c55e'}`,
                      color: THREAT_COLORS[convoy.route_threat as keyof typeof THREAT_COLORS] || '#22c55e',
                      padding: '2px 6px',
                      borderRadius: 3,
                      fontSize: 9,
                    }}>
                      {convoy.route_threat}
                    </span>
                  </td>
                </tr>
              ))}
              {metrics.convoys.active_details.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>
                    No active convoys in the field
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ALERTS & WARNINGS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 15,
      }}>
        {/* HIGH RISK ROUTES */}
        <div style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8,
          padding: 12,
        }}>
          <div style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 11, marginBottom: 8 }}>
            ⚠️ HIGH RISK ROUTES ({metrics.routes.high_risk_list.length})
          </div>
          {metrics.routes.high_risk_list.slice(0, 3).map((route, i) => (
            <div key={i} style={{
              background: 'rgba(0,0,0,0.3)',
              padding: '6px 8px',
              borderRadius: 4,
              marginBottom: 4,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ color: '#fff', fontSize: 10 }}>{route.name}</span>
              <span style={{
                background: THREAT_COLORS[route.threat_level as keyof typeof THREAT_COLORS],
                color: '#000',
                padding: '1px 5px',
                borderRadius: 2,
                fontSize: 8,
                fontWeight: 'bold',
              }}>
                {route.threat_level}
              </span>
            </div>
          ))}
          {metrics.routes.high_risk_list.length === 0 && (
            <div style={{ color: '#22c55e', fontSize: 10 }}>✓ All routes within acceptable threat levels</div>
          )}
        </div>

        {/* CONGESTED TCPs */}
        <div style={{
          background: 'rgba(249,115,22,0.1)',
          border: '1px solid rgba(249,115,22,0.3)',
          borderRadius: 8,
          padding: 12,
        }}>
          <div style={{ color: '#f97316', fontWeight: 'bold', fontSize: 11, marginBottom: 8 }}>
            🚦 CONGESTED TCPs ({metrics.tcps.congested_list.length})
          </div>
          {metrics.tcps.congested_list.slice(0, 3).map((tcp, i) => (
            <div key={i} style={{
              background: 'rgba(0,0,0,0.3)',
              padding: '6px 8px',
              borderRadius: 4,
              marginBottom: 4,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ color: '#fff', fontSize: 10 }}>{tcp.name}</span>
              <span style={{ color: '#f97316', fontSize: 9 }}>{tcp.current_traffic}</span>
            </div>
          ))}
          {metrics.tcps.congested_list.length === 0 && (
            <div style={{ color: '#22c55e', fontSize: 10 }}>✓ All TCPs operating normally</div>
          )}
        </div>

        {/* BLOCKING OBSTACLES */}
        <div style={{
          background: 'rgba(234,179,8,0.1)',
          border: '1px solid rgba(234,179,8,0.3)',
          borderRadius: 8,
          padding: 12,
        }}>
          <div style={{ color: '#eab308', fontWeight: 'bold', fontSize: 11, marginBottom: 8 }}>
            🚧 BLOCKING OBSTACLES ({metrics.obstacles.blocking_list.length})
          </div>
          {metrics.obstacles.blocking_list.slice(0, 3).map((obs, i) => (
            <div key={i} style={{
              background: 'rgba(0,0,0,0.3)',
              padding: '6px 8px',
              borderRadius: 4,
              marginBottom: 4,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#fff', fontSize: 10 }}>{obs.type}</span>
                <span style={{
                  color: obs.severity === 'CRITICAL' ? '#ef4444' : obs.severity === 'HIGH' ? '#f97316' : '#eab308',
                  fontSize: 9,
                }}>
                  {obs.severity}
                </span>
              </div>
              <div style={{ color: '#6b7280', fontSize: 9, marginTop: 2 }}>Impact Score: {obs.impact_score}%</div>
            </div>
          ))}
          {metrics.obstacles.blocking_list.length === 0 && (
            <div style={{ color: '#22c55e', fontSize: 10 }}>✓ No route-blocking obstacles detected</div>
          )}
        </div>
      </div>
    </div>
  );
}
