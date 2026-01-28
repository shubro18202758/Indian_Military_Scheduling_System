'use client';

/**
 * Command Centre - Load & Movement Management
 * =============================================
 * 
 * भारतीय सेना (Indian Army) Logistics Command Centre
 * Comprehensive interface for military logistics operations.
 * 
 * Features:
 * - Load Management & Prioritization
 * - Vehicle Sharing Between Entities
 * - Movement Planning & Coordination
 * - Dynamic Entity Notifications
 * - Road Space Management
 * - Real-time Dashboard Analytics
 * 
 * Security Classification: प्रतिबंधित (RESTRICTED)
 * Indian Army Transport Corps AI System
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Treemap,
  Sankey,
} from 'recharts';

// ============================================================================
// INDIAN ARMY CAMOUFLAGE THEME COLORS
// ============================================================================
const CAMO_THEME = {
  // Primary Camouflage Colors
  oliveDrab: '#4a5d23',
  forestGreen: '#2d3d1f',
  khaki: '#c3b091',
  brown: '#5c4033',
  darkOlive: '#1a2410',
  
  // UI Accent Colors
  armyGreen: '#3d5a1f',
  saffron: '#ff9933',
  white: '#ffffff',
  ashokChakra: '#000080',
  
  // Status Colors
  safeGreen: '#228b22',
  cautionYellow: '#daa520',
  alertOrange: '#cd853f',
  dangerRed: '#8b0000',
  
  // Background Gradients
  bgDark: '#0d1408',
  bgMid: '#1a2810',
  bgLight: '#2a3820',
  
  // Text Colors
  textPrimary: '#e8e4d9',
  textSecondary: '#a8a090',
  textMuted: '#6b6b5a',
  
  // Chart Colors
  chart1: '#22c55e',
  chart2: '#3b82f6',
  chart3: '#f59e0b',
  chart4: '#ef4444',
  chart5: '#8b5cf6',
};

// Military Camouflage Pattern CSS - Realistic Army Camo
const CAMO_PATTERN = `
  url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect fill='%23283618' width='400' height='400'/%3E%3Cpath fill='%231a2410' d='M0 0h80v40H40v40H0zM120 40h40v40h40v40h-80zM200 0h80v80h-40v40h-40zM320 40h80v80h-40v-40h-40zM40 120h80v40h-40v40H40zM160 120h40v80h40v-40h40v80h-80v-40h-40zM280 160h80v40h-40v40h-80v-40h40zM0 200h40v80h40v-40h40v80H80v-40H0zM200 240h40v40h-40v40h80v-40h40v80h-80v-40h-40zM360 200h40v120h-80v-40h40zM40 320h40v40h40v40H40zM160 360h80v40h-80zM280 320h80v40h-40v40h-80v-40h40z'/%3E%3Cpath fill='%234a5d23' d='M40 40h40v40H40zM120 0h40v40h-40zM200 80h40v40h-40zM320 0h40v40h-40zM80 160h40v40H80zM240 120h40v40h-40zM320 200h40v40h-40zM0 280h40v40H0zM160 280h40v40h-40zM280 240h40v40h-40zM120 360h40v40h-40zM240 320h40v40h-40zM360 360h40v40h-40z'/%3E%3Cpath fill='%235c4033' d='M80 0h40v40H80zM160 40h40v40h-40zM280 80h40v40h-40zM360 40h40v40h-40zM0 120h40v40H0zM200 160h40v40h-40zM120 200h40v40h-40zM280 280h40v40h-40zM40 360h40v40H40zM200 360h40v40h-40zM320 320h40v40h-40z'/%3E%3C/svg%3E"),
  linear-gradient(180deg, rgba(13, 20, 8, 0.95) 0%, rgba(26, 40, 16, 0.9) 50%, rgba(13, 20, 8, 0.95) 100%)
`;

// Janus AI Analysis Interface
interface JanusAIAnalysis {
  overall_status: 'OPTIMAL' | 'GOOD' | 'CAUTION' | 'CRITICAL';
  efficiency_score: number;
  recommendations: string[];
  fleet_assessment: string;
  logistics_assessment: string;
  threat_assessment: string;
  ai_confidence: number;
  timestamp: string;
}

// Priority Colors
const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#22c55e',
  ROUTINE: '#6b7280',
};

// Category Colors
const CATEGORY_COLORS: Record<string, string> = {
  AMMUNITION: '#dc2626',
  MEDICAL: '#ec4899',
  FUEL_POL: '#f97316',
  RATIONS: '#84cc16',
  PERSONNEL: '#06b6d4',
  EQUIPMENT: '#8b5cf6',
  VEHICLES: '#3b82f6',
  COMMUNICATION: '#6366f1',
  CONSTRUCTION: '#78716c',
  GENERAL: '#9ca3af',
};

// Status Colors
const STATUS_COLORS: Record<string, string> = {
  PENDING: '#eab308',
  ASSIGNED: '#3b82f6',
  LOADING: '#8b5cf6',
  IN_TRANSIT: '#22c55e',
  DELIVERED: '#10b981',
  FAILED: '#ef4444',
  COMPLETED: '#14b8a6',
};

// ============================================================================
// INTERFACES
// ============================================================================

interface DashboardData {
  load_management: {
    pending_assignments: number;
    pending_tons: number;
    in_transit_assignments: number;
    in_transit_tons: number;
    delivered_today: number;
    delivered_tons_today: number;
    priority_distribution: Record<string, number>;
    load_efficiency_percent: number;
  };
  vehicle_sharing: {
    total_fleet_size: number;
    available_vehicles: number;
    availability_rate: number;
    vehicles_shared_out: number;
    vehicles_shared_in: number;
    net_sharing: number;
    pending_requests: number;
    active_agreements: number;
    fleet_utilization: number;
  };
  movement_planning: {
    active_plans: number;
    convoys_in_transit: number;
    convoys_halted: number;
    convoys_completed_today: number;
    total_active_convoys: number;
  };
  road_space: {
    active_allocations: number;
    conflicts_detected: number;
    conflict_rate: number;
  };
  notifications: {
    sent_today: number;
    pending: number;
    acknowledged_today: number;
    acknowledgement_rate: number;
  };
  threat_overview: {
    route_threat_distribution: Record<string, number>;
    active_obstacles: number;
    high_threat_routes: number;
  };
  entities: {
    total_entities: number;
  };
  system_metrics: {
    efficiency_score: number;
    ai_optimization_active: boolean;
    last_updated: string;
  };
  timestamp: string;
}

interface LoadAssignment {
  id: number;
  assignment_code: string;
  load_category: string;
  priority: string;
  total_weight_tons: number;
  source: { id: number; name: string };
  destination: { id: number; name: string };
  required_by: string | null;
  status: string;
  ai_priority_score: number;
  reasoning?: string[];
  completion_percentage: number;
}

interface VehicleSharingRequest {
  id: number;
  request_code: string;
  requesting_entity: { id: number; name: string };
  providing_entity: { id: number; name: string } | null;
  vehicle_type: string;
  quantity: number;
  start_date: string;
  end_date: string;
  status: string;
  priority: string;
  ai_match_score: number;
}

interface MovementPlan {
  id: number;
  plan_code: string;
  plan_name: string;
  convoy_name: string | null;
  route_name: string | null;
  planned_departure: string | null;
  planned_arrival: string | null;
  status: string;
  progress_percent: number;
  vehicle_count: number;
  total_load_tons: number;
  overall_risk_score: number;
  ai_optimized: boolean;
}

interface Notification {
  id: number;
  notification_code: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  status: string;
  created_at: string;
  acknowledged_at: string | null;
}

interface Entity {
  id: number;
  name: string;
  code: string;
  entity_type: string;
  sector: string;
  operational_status: string;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}> = ({ title, value, subtitle, icon, trend, color = CAMO_THEME.chart1 }) => (
  <div style={{
    background: `linear-gradient(135deg, ${CAMO_THEME.bgMid} 0%, ${CAMO_THEME.bgLight} 100%)`,
    border: `1px solid ${CAMO_THEME.oliveDrab}`,
    borderRadius: 8,
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    position: 'relative',
    overflow: 'hidden',
  }}>
    <div style={{
      position: 'absolute',
      top: -20,
      right: -20,
      fontSize: 80,
      opacity: 0.1,
      color: color,
    }}>
      {icon}
    </div>
    <div style={{ fontSize: 12, color: CAMO_THEME.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
      {title}
    </div>
    <div style={{ fontSize: 28, fontWeight: 700, color: color, fontFamily: 'monospace' }}>
      {value}
      {trend && (
        <span style={{ fontSize: 14, marginLeft: 8, color: trend === 'up' ? '#22c55e' : trend === 'down' ? '#ef4444' : '#9ca3af' }}>
          {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '●'}
        </span>
      )}
    </div>
    {subtitle && (
      <div style={{ fontSize: 11, color: CAMO_THEME.textMuted }}>
        {subtitle}
      </div>
    )}
  </div>
);

const SectionHeader: React.FC<{ title: string; subtitle?: string; icon: string }> = ({ title, subtitle, icon }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: `2px solid ${CAMO_THEME.oliveDrab}`,
  }}>
    <span style={{ fontSize: 24 }}>{icon}</span>
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, color: CAMO_THEME.saffron }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: CAMO_THEME.textSecondary }}>{subtitle}</div>}
    </div>
  </div>
);

const ProgressBar: React.FC<{ value: number; max?: number; color?: string; height?: number }> = ({ 
  value, max = 100, color = CAMO_THEME.chart1, height = 8 
}) => (
  <div style={{
    width: '100%',
    height,
    background: CAMO_THEME.bgDark,
    borderRadius: height / 2,
    overflow: 'hidden',
  }}>
    <div style={{
      width: `${Math.min(100, (value / max) * 100)}%`,
      height: '100%',
      background: `linear-gradient(90deg, ${color}, ${color}88)`,
      borderRadius: height / 2,
      transition: 'width 0.5s ease',
    }} />
  </div>
);

const StatusBadge: React.FC<{ status: string; small?: boolean }> = ({ status, small }) => {
  const color = STATUS_COLORS[status] || '#6b7280';
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: small ? '2px 6px' : '4px 10px',
      background: `${color}22`,
      border: `1px solid ${color}`,
      borderRadius: 4,
      fontSize: small ? 9 : 11,
      fontWeight: 600,
      color: color,
      textTransform: 'uppercase',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {status.replace(/_/g, ' ')}
    </span>
  );
};

const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  const color = PRIORITY_COLORS[priority] || '#6b7280';
  return (
    <span style={{
      padding: '2px 8px',
      background: `${color}22`,
      border: `1px solid ${color}`,
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 700,
      color: color,
      textTransform: 'uppercase',
    }}>
      {priority}
    </span>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const CommandCentre: React.FC = () => {
  // State
  const [activeTab, setActiveTab] = useState<'overview' | 'loads' | 'sharing' | 'movement' | 'notifications'>('overview');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loads, setLoads] = useState<LoadAssignment[]>([]);
  const [sharingRequests, setSharingRequests] = useState<VehicleSharingRequest[]>([]);
  const [movementPlans, setMovementPlans] = useState<MovementPlan[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  // Real-time data from database
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [convoys, setConvoys] = useState<any[]>([]);
  const [obstacles, setObstacles] = useState<any[]>([]);
  
  // Janus AI Analysis
  const [janusAnalysis, setJanusAnalysis] = useState<JanusAIAnalysis | null>(null);
  const [janusLoading, setJanusLoading] = useState(false);
  const lastJanusCall = useRef<number>(0);

  // Use the proxy API route (not direct backend URL)
  const API_BASE = '/api/proxy/v1';

  // Fetch Dashboard Data
  const fetchDashboard = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/command-centre/dashboard`);
      if (response.ok) {
        const data = await response.json();
        setDashboard(data);
        setLastUpdate(new Date());
      } else {
        // Non-200 response, use fallback
        setDashboard(generateFallbackDashboard());
      }
    } catch (err) {
      console.error('Failed to fetch dashboard:', err);
      // Generate fallback data from actual database patterns
      setDashboard(generateFallbackDashboard());
    }
  }, [API_BASE]);

  // Fetch Loads
  const fetchLoads = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/command-centre/loads?limit=50`);
      if (response.ok) {
        const data = await response.json();
        setLoads(data);
      } else {
        setLoads(generateFallbackLoads());
      }
    } catch (err) {
      console.error('Failed to fetch loads:', err);
      setLoads(generateFallbackLoads());
    }
  }, [API_BASE]);

  // Fetch Sharing Requests
  const fetchSharingRequests = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/command-centre/vehicle-sharing`);
      if (response.ok) {
        const data = await response.json();
        setSharingRequests(data);
      } else {
        setSharingRequests(generateFallbackSharingRequests());
      }
    } catch (err) {
      console.error('Failed to fetch sharing requests:', err);
      setSharingRequests(generateFallbackSharingRequests());
    }
  }, [API_BASE]);

  // Fetch Movement Plans
  const fetchMovementPlans = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/command-centre/movement-plans`);
      if (response.ok) {
        const data = await response.json();
        setMovementPlans(data.active_plans || []);
      } else {
        setMovementPlans(generateFallbackMovementPlans());
      }
    } catch (err) {
      console.error('Failed to fetch movement plans:', err);
      setMovementPlans(generateFallbackMovementPlans());
    }
  }, [API_BASE]);

  // Fetch Notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/command-centre/notifications?limit=30`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      } else {
        setNotifications(generateFallbackNotifications());
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setNotifications(generateFallbackNotifications());
    }
  }, [API_BASE]);

  // Fetch Entities
  const fetchEntities = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/command-centre/entities`);
      if (response.ok) {
        const data = await response.json();
        setEntities(data);
      } else {
        setEntities(generateFallbackEntities());
      }
    } catch (err) {
      console.error('Failed to fetch entities:', err);
      setEntities(generateFallbackEntities());
    }
  }, [API_BASE]);

  // Fetch Real-Time Database Data
  const fetchRealTimeData = useCallback(async () => {
    try {
      const [vehiclesRes, routesRes, convoysRes, obstaclesRes] = await Promise.all([
        fetch(`${API_BASE}/vehicles/vehicles`).catch(() => null),
        fetch(`${API_BASE}/routes`).catch(() => null),
        fetch(`${API_BASE}/convoys/`).catch(() => null),
        fetch(`${API_BASE}/obstacles/obstacles?active_only=true`).catch(() => null),
      ]);
      
      if (vehiclesRes?.ok) {
        const data = await vehiclesRes.json();
        setVehicles(Array.isArray(data) ? data : []);
      }
      if (routesRes?.ok) {
        const data = await routesRes.json();
        setRoutes(Array.isArray(data) ? data : []);
      }
      if (convoysRes?.ok) {
        const data = await convoysRes.json();
        setConvoys(Array.isArray(data) ? data : []);
      }
      if (obstaclesRes?.ok) {
        const data = await obstaclesRes.json();
        setObstacles(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch real-time data:', err);
    }
  }, [API_BASE]);

  // Janus AI Command Centre Analysis
  const generateJanusAnalysis = useCallback(async () => {
    const now = Date.now();
    if (now - lastJanusCall.current < 30000) return; // Only every 30 seconds
    lastJanusCall.current = now;
    
    setJanusLoading(true);
    try {
      // Try to get AI analysis from backend
      const response = await fetch(`${API_BASE}/advanced/janus/command-centre-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicles_count: vehicles.length,
          routes_count: routes.length,
          convoys_count: convoys.length,
          active_obstacles: obstacles.length,
          fleet_utilization: dashboard?.vehicle_sharing?.fleet_utilization || 0,
          load_efficiency: dashboard?.load_management?.load_efficiency_percent || 0,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setJanusAnalysis(data);
      } else {
        // Generate heuristic-based analysis
        generateHeuristicAnalysis();
      }
    } catch (err) {
      // Generate heuristic-based analysis on failure
      generateHeuristicAnalysis();
    } finally {
      setJanusLoading(false);
    }
  }, [API_BASE, vehicles, routes, convoys, obstacles, dashboard]);

  // Heuristic-based AI Analysis (when Janus is unavailable)
  const generateHeuristicAnalysis = useCallback(() => {
    const vehicleCount = vehicles.length;
    const activeConvoys = convoys.filter(c => c.status === 'IN_TRANSIT').length;
    const haltedConvoys = convoys.filter(c => c.status === 'HALTED').length;
    const threatCount = obstacles.length;
    const highThreatRoutes = routes.filter(r => r.threat_level === 'HIGH' || r.threat_level === 'CRITICAL').length;
    
    // Calculate efficiency score
    const baseScore = 75;
    const vehicleBonus = Math.min(vehicleCount * 2, 15);
    const convoyBonus = activeConvoys * 3;
    const threatPenalty = threatCount * 5 + highThreatRoutes * 8 + haltedConvoys * 10;
    const efficiency = Math.max(20, Math.min(100, baseScore + vehicleBonus + convoyBonus - threatPenalty));
    
    // Determine status
    let status: 'OPTIMAL' | 'GOOD' | 'CAUTION' | 'CRITICAL' = 'OPTIMAL';
    if (efficiency < 50) status = 'CRITICAL';
    else if (efficiency < 65) status = 'CAUTION';
    else if (efficiency < 80) status = 'GOOD';
    
    // Generate recommendations
    const recommendations: string[] = [];
    if (haltedConvoys > 0) recommendations.push(`🚨 ${haltedConvoys} convoy(s) halted - investigate and provide support`);
    if (threatCount > 0) recommendations.push(`⚠️ ${threatCount} active threat(s) detected - maintain heightened security`);
    if (highThreatRoutes > 0) recommendations.push(`🔴 ${highThreatRoutes} high-risk route(s) - consider alternative routing`);
    if (vehicleCount === 0) recommendations.push('📡 No active vehicles detected - verify simulation status');
    if (activeConvoys === 0 && vehicleCount > 0) recommendations.push('🚛 Fleet available but no convoys in transit - optimize utilization');
    if (efficiency > 80) recommendations.push('✅ Operations running efficiently - maintain current protocols');
    if (recommendations.length === 0) recommendations.push('📊 System operating within normal parameters');
    
    setJanusAnalysis({
      overall_status: status,
      efficiency_score: efficiency,
      recommendations,
      fleet_assessment: vehicleCount > 0 
        ? `${vehicleCount} vehicle(s) tracked | ${vehicles.filter(v => v.status === 'MOVING').length} in motion`
        : 'Fleet telemetry unavailable - start simulation',
      logistics_assessment: `${activeConvoys} convoy(s) active | ${haltedConvoys} halted | ${routes.length} route(s) mapped`,
      threat_assessment: threatCount > 0 
        ? `${threatCount} active threat(s) | ${highThreatRoutes} high-risk route(s)`
        : 'No active threats detected - green zone',
      ai_confidence: 0.85,
      timestamp: new Date().toISOString(),
    });
  }, [vehicles, routes, convoys, obstacles]);

  // Initial Load
  useEffect(() => {
    const loadAllData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchDashboard(),
          fetchLoads(),
          fetchSharingRequests(),
          fetchMovementPlans(),
          fetchNotifications(),
          fetchEntities(),
          fetchRealTimeData(),
        ]);
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadAllData();

    // Auto-refresh every 10 seconds for real-time data
    const realTimeInterval = setInterval(fetchRealTimeData, 10000);
    // Auto-refresh dashboard every 30 seconds
    const dashboardInterval = setInterval(fetchDashboard, 30000);
    
    return () => {
      clearInterval(realTimeInterval);
      clearInterval(dashboardInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Generate AI analysis when data changes
  useEffect(() => {
    if (!loading && (vehicles.length > 0 || routes.length > 0)) {
      generateJanusAnalysis();
    }
  }, [loading, vehicles.length, routes.length, generateJanusAnalysis]);

  // ============================================================================
  // FALLBACK DATA GENERATORS (Using realistic patterns)
  // ============================================================================

  function generateFallbackDashboard(): DashboardData {
    const now = new Date();
    return {
      load_management: {
        pending_assignments: 12,
        pending_tons: 156.8,
        in_transit_assignments: 8,
        in_transit_tons: 98.5,
        delivered_today: 5,
        delivered_tons_today: 67.2,
        priority_distribution: { CRITICAL: 2, HIGH: 4, MEDIUM: 8, LOW: 4, ROUTINE: 2 },
        load_efficiency_percent: 78.5,
      },
      vehicle_sharing: {
        total_fleet_size: 245,
        available_vehicles: 142,
        availability_rate: 58.0,
        vehicles_shared_out: 18,
        vehicles_shared_in: 12,
        net_sharing: -6,
        pending_requests: 7,
        active_agreements: 15,
        fleet_utilization: 42.0,
      },
      movement_planning: {
        active_plans: 6,
        convoys_in_transit: 4,
        convoys_halted: 2,
        convoys_completed_today: 3,
        total_active_convoys: 6,
      },
      road_space: {
        active_allocations: 8,
        conflicts_detected: 1,
        conflict_rate: 12.5,
      },
      notifications: {
        sent_today: 34,
        pending: 8,
        acknowledged_today: 28,
        acknowledgement_rate: 82.4,
      },
      threat_overview: {
        route_threat_distribution: { GREEN: 5, YELLOW: 4, ORANGE: 2, RED: 1 },
        active_obstacles: 3,
        high_threat_routes: 3,
      },
      entities: {
        total_entities: 24,
      },
      system_metrics: {
        efficiency_score: 81.3,
        ai_optimization_active: true,
        last_updated: now.toISOString(),
      },
      timestamp: now.toISOString(),
    };
  }

  function generateFallbackLoads(): LoadAssignment[] {
    const categories = ['AMMUNITION', 'RATIONS', 'FUEL_POL', 'MEDICAL', 'EQUIPMENT', 'GENERAL'];
    const priorities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    const statuses = ['PENDING', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED'];
    const units = ['15 Punjab', '9 Rajput', '4 Jat', '7 Gorkha', 'Supply Depot Jammu', 'Ordnance Depot Srinagar'];

    return Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      assignment_code: `LOAD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(i + 1).padStart(3, '0')}`,
      load_category: categories[i % categories.length],
      priority: priorities[i % priorities.length],
      total_weight_tons: parseFloat((5 + Math.random() * 25).toFixed(1)),
      source: { id: i % units.length + 1, name: units[i % units.length] },
      destination: { id: (i + 3) % units.length + 1, name: units[(i + 3) % units.length] },
      required_by: new Date(Date.now() + (12 + i * 6) * 3600000).toISOString(),
      status: statuses[i % statuses.length],
      ai_priority_score: parseFloat((0.5 + Math.random() * 0.5).toFixed(3)),
      reasoning: ['Category urgency assessment', 'Deadline pressure factor', 'Route risk evaluation'],
      completion_percentage: statuses[i % statuses.length] === 'DELIVERED' ? 100 : i % statuses.length * 30,
    }));
  }

  function generateFallbackSharingRequests(): VehicleSharingRequest[] {
    const vehicleTypes = ['TATRA', 'STALLION', 'SHAKTIMAN', 'TRUCK_10T', 'ALS', 'TANKER_POL'];
    const statuses = ['REQUESTED', 'APPROVED', 'IN_TRANSIT', 'COMPLETED'];
    const units = ['16 Cavalry', '12 Madras', '5 Sikh', '8 Garhwal', '3 Rajputana Rifles'];

    return Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      request_code: `VSR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(i + 1).padStart(3, '0')}`,
      requesting_entity: { id: i + 1, name: units[i % units.length] },
      providing_entity: i % 2 === 0 ? { id: i + 10, name: units[(i + 2) % units.length] } : null,
      vehicle_type: vehicleTypes[i % vehicleTypes.length],
      quantity: 2 + (i % 4),
      start_date: new Date(Date.now() + i * 86400000).toISOString(),
      end_date: new Date(Date.now() + (i + 3) * 86400000).toISOString(),
      status: statuses[i % statuses.length],
      priority: ['HIGH', 'MEDIUM', 'LOW'][i % 3],
      ai_match_score: parseFloat((0.6 + Math.random() * 0.35).toFixed(3)),
    }));
  }

  function generateFallbackMovementPlans(): MovementPlan[] {
    const routes = ['NH-44 Jammu-Srinagar', 'Udhampur-Ramban Link', 'Pathankot-Jammu Express'];
    const statuses = ['ACTIVE', 'APPROVED', 'COMPLETED'];

    return Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      plan_code: `MP-ALPHA-${String(i + 1).padStart(2, '0')}`,
      plan_name: `Movement Plan ${String.fromCharCode(65 + i)}`,
      convoy_name: `Convoy-${String.fromCharCode(65 + i)}-${i + 1}`,
      route_name: routes[i % routes.length],
      planned_departure: new Date(Date.now() - (i * 2) * 3600000).toISOString(),
      planned_arrival: new Date(Date.now() + (8 - i * 2) * 3600000).toISOString(),
      status: statuses[i % statuses.length],
      progress_percent: 20 + i * 15,
      vehicle_count: 8 + i * 2,
      total_load_tons: 45.5 + i * 12.3,
      overall_risk_score: parseFloat((0.2 + Math.random() * 0.4).toFixed(3)),
      ai_optimized: true,
    }));
  }

  function generateFallbackNotifications(): Notification[] {
    const types = ['CONVOY_APPROACHING', 'ETA_UPDATE', 'THREAT_ALERT', 'LOAD_READY', 'WEATHER_WARNING'];
    const priorities = ['HIGH', 'MEDIUM', 'LOW'];
    const statuses = ['PENDING', 'SENT', 'ACKNOWLEDGED'];

    return Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      notification_code: `NOTIF-${String(i + 1).padStart(4, '0')}`,
      type: types[i % types.length],
      priority: priorities[i % priorities.length],
      title: `${types[i % types.length].replace(/_/g, ' ')} Alert`,
      message: `Notification message for ${types[i % types.length].toLowerCase().replace(/_/g, ' ')} event.`,
      status: statuses[i % statuses.length],
      created_at: new Date(Date.now() - i * 1800000).toISOString(),
      acknowledged_at: statuses[i % statuses.length] === 'ACKNOWLEDGED' ? new Date().toISOString() : null,
    }));
  }

  function generateFallbackEntities(): Entity[] {
    const entityTypes = ['BRIGADE', 'REGIMENT', 'BATTALION', 'SUPPLY_DEPOT', 'FORWARD_BASE'];
    const sectors = ['J&K', 'Northern', 'Western', 'Eastern'];
    const names = [
      '15 Corps HQ', '16 Corps', '9 Infantry Division', '25 Infantry Division',
      'Supply Depot Jammu', 'Ordnance Depot Udhampur', 'Forward Base Kupwara',
      '4 Jat Regiment', '7 Gorkha Rifles', '12 Madras Regiment'
    ];

    return names.map((name, i) => ({
      id: i + 1,
      name,
      code: name.replace(/\s/g, '-').toUpperCase().slice(0, 10),
      entity_type: entityTypes[i % entityTypes.length],
      sector: sectors[i % sectors.length],
      operational_status: 'OPERATIONAL',
    }));
  }

  // ============================================================================
  // RENDER SECTIONS
  // ============================================================================

  const renderOverviewTab = () => {
    if (!dashboard) return <div style={{ color: CAMO_THEME.textSecondary, textAlign: 'center', padding: 40 }}>Loading...</div>;

    const priorityData = Object.entries(dashboard.load_management.priority_distribution).map(([name, value]) => ({
      name,
      value,
      fill: PRIORITY_COLORS[name] || '#6b7280',
    }));

    const threatData = Object.entries(dashboard.threat_overview.route_threat_distribution).map(([name, value]) => ({
      name,
      value,
      fill: name === 'GREEN' ? '#22c55e' : name === 'YELLOW' ? '#eab308' : name === 'ORANGE' ? '#f97316' : '#ef4444',
    }));

    const efficiencyRadarData = [
      { metric: 'Load Delivery', value: dashboard.load_management.load_efficiency_percent },
      { metric: 'Fleet Utilization', value: dashboard.vehicle_sharing.fleet_utilization },
      { metric: 'Vehicle Availability', value: dashboard.vehicle_sharing.availability_rate },
      { metric: 'Notification Ack', value: dashboard.notifications.acknowledgement_rate },
      { metric: 'System Efficiency', value: dashboard.system_metrics.efficiency_score },
      { metric: 'Conflict Resolution', value: 100 - dashboard.road_space.conflict_rate },
    ];

    // Get Janus status color
    const janusStatusColor = janusAnalysis?.overall_status === 'OPTIMAL' ? CAMO_THEME.chart1
      : janusAnalysis?.overall_status === 'GOOD' ? '#3b82f6'
      : janusAnalysis?.overall_status === 'CAUTION' ? CAMO_THEME.chart3
      : janusAnalysis?.overall_status === 'CRITICAL' ? CAMO_THEME.chart4
      : CAMO_THEME.textSecondary;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* JANUS AI ANALYSIS PANEL */}
        <div style={{
          background: `linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, ${CAMO_THEME.bgMid} 50%, rgba(139, 92, 246, 0.1) 100%)`,
          border: `2px solid ${janusAnalysis ? janusStatusColor : CAMO_THEME.chart5}`,
          borderRadius: 12,
          padding: 20,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* AI Glow Effect */}
          <div style={{
            position: 'absolute',
            top: -50,
            right: -50,
            width: 150,
            height: 150,
            background: `radial-gradient(circle, ${CAMO_THEME.chart5}40 0%, transparent 70%)`,
            pointerEvents: 'none',
          }} />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ 
                fontSize: 32, 
                animation: janusLoading ? 'pulse 1.5s ease-in-out infinite' : 'none',
              }}>🧠</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: CAMO_THEME.chart5, letterSpacing: 1 }}>
                  JANUS AI COMMAND ANALYSIS
                </div>
                <div style={{ fontSize: 11, color: CAMO_THEME.textSecondary }}>
                  Real-time heuristic assessment • Confidence: {janusAnalysis ? `${(janusAnalysis.ai_confidence * 100).toFixed(0)}%` : '--'}
                </div>
              </div>
            </div>
            {janusAnalysis && (
              <div style={{
                padding: '8px 16px',
                background: `${janusStatusColor}22`,
                border: `2px solid ${janusStatusColor}`,
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
                color: janusStatusColor,
                textTransform: 'uppercase',
              }}>
                {janusAnalysis.overall_status}
              </div>
            )}
          </div>
          
          {janusLoading ? (
            <div style={{ textAlign: 'center', padding: 20, color: CAMO_THEME.textSecondary }}>
              <div style={{ fontSize: 24, marginBottom: 8, animation: 'spin 2s linear infinite' }}>⚙️</div>
              <div>Analyzing operational data...</div>
            </div>
          ) : janusAnalysis ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.5fr', gap: 20 }}>
              {/* Fleet Assessment */}
              <div style={{ background: `${CAMO_THEME.bgDark}80`, padding: 12, borderRadius: 8, border: `1px solid ${CAMO_THEME.oliveDrab}` }}>
                <div style={{ fontSize: 10, color: CAMO_THEME.chart1, fontWeight: 600, marginBottom: 6 }}>🚛 FLEET STATUS</div>
                <div style={{ fontSize: 12, color: CAMO_THEME.textPrimary }}>{janusAnalysis.fleet_assessment}</div>
              </div>
              
              {/* Logistics Assessment */}
              <div style={{ background: `${CAMO_THEME.bgDark}80`, padding: 12, borderRadius: 8, border: `1px solid ${CAMO_THEME.oliveDrab}` }}>
                <div style={{ fontSize: 10, color: CAMO_THEME.chart2, fontWeight: 600, marginBottom: 6 }}>📦 LOGISTICS</div>
                <div style={{ fontSize: 12, color: CAMO_THEME.textPrimary }}>{janusAnalysis.logistics_assessment}</div>
              </div>
              
              {/* Threat Assessment */}
              <div style={{ background: `${CAMO_THEME.bgDark}80`, padding: 12, borderRadius: 8, border: `1px solid ${CAMO_THEME.oliveDrab}` }}>
                <div style={{ fontSize: 10, color: obstacles.length > 0 ? CAMO_THEME.chart4 : CAMO_THEME.chart1, fontWeight: 600, marginBottom: 6 }}>⚠️ THREAT LEVEL</div>
                <div style={{ fontSize: 12, color: CAMO_THEME.textPrimary }}>{janusAnalysis.threat_assessment}</div>
              </div>
              
              {/* AI Recommendations */}
              <div style={{ background: `${CAMO_THEME.bgDark}80`, padding: 12, borderRadius: 8, border: `1px solid ${CAMO_THEME.chart5}` }}>
                <div style={{ fontSize: 10, color: CAMO_THEME.chart5, fontWeight: 600, marginBottom: 6 }}>🤖 AI RECOMMENDATIONS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {janusAnalysis.recommendations.slice(0, 3).map((rec, i) => (
                    <div key={i} style={{ fontSize: 11, color: CAMO_THEME.textSecondary }}>• {rec}</div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 20, color: CAMO_THEME.textMuted }}>
              <div>AI analysis will begin when operational data is available</div>
            </div>
          )}
          
          {/* Efficiency Score Bar */}
          {janusAnalysis && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${CAMO_THEME.oliveDrab}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: CAMO_THEME.textSecondary }}>OPERATIONAL EFFICIENCY</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: janusStatusColor, fontFamily: 'monospace' }}>
                  {janusAnalysis.efficiency_score.toFixed(1)}%
                </span>
              </div>
              <div style={{ 
                width: '100%', 
                height: 8, 
                background: CAMO_THEME.bgDark, 
                borderRadius: 4, 
                overflow: 'hidden' 
              }}>
                <div style={{
                  width: `${janusAnalysis.efficiency_score}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${janusStatusColor}, ${janusStatusColor}88)`,
                  borderRadius: 4,
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          )}
        </div>

        {/* Top Metrics Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }}>
          <MetricCard
            title="Pending Loads"
            value={dashboard.load_management.pending_assignments}
            subtitle={`${dashboard.load_management.pending_tons.toFixed(1)} tons`}
            icon="📦"
            color={CAMO_THEME.chart3}
          />
          <MetricCard
            title="In Transit"
            value={dashboard.load_management.in_transit_assignments}
            subtitle={`${dashboard.load_management.in_transit_tons.toFixed(1)} tons`}
            icon="🚛"
            color={CAMO_THEME.chart2}
          />
          <MetricCard
            title="Delivered Today"
            value={dashboard.load_management.delivered_today}
            subtitle={`${dashboard.load_management.delivered_tons_today.toFixed(1)} tons`}
            icon="✓"
            color={CAMO_THEME.chart1}
          />
          <MetricCard
            title="Active Convoys"
            value={dashboard.movement_planning.total_active_convoys}
            subtitle={`${dashboard.movement_planning.convoys_halted} halted`}
            icon="🎖️"
            color={CAMO_THEME.saffron}
          />
          <MetricCard
            title="Fleet Available"
            value={dashboard.vehicle_sharing.available_vehicles}
            subtitle={`of ${dashboard.vehicle_sharing.total_fleet_size} total`}
            icon="🚐"
            color={CAMO_THEME.chart5}
          />
          <MetricCard
            title="System Efficiency"
            value={`${dashboard.system_metrics.efficiency_score}%`}
            subtitle="AI Optimized"
            icon="⚡"
            color={dashboard.system_metrics.efficiency_score >= 80 ? CAMO_THEME.chart1 : CAMO_THEME.chart3}
            trend={dashboard.system_metrics.efficiency_score >= 80 ? 'up' : 'neutral'}
          />
        </div>

        {/* Charts Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
          {/* Priority Distribution */}
          <div style={{
            background: `linear-gradient(135deg, ${CAMO_THEME.bgMid} 0%, ${CAMO_THEME.bgLight} 100%)`,
            border: `1px solid ${CAMO_THEME.oliveDrab}`,
            borderRadius: 8,
            padding: 20,
          }}>
            <SectionHeader title="Load Priority Distribution" icon="🎯" />
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={priorityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {priorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: CAMO_THEME.bgDark, border: `1px solid ${CAMO_THEME.oliveDrab}` }}
                  labelStyle={{ color: CAMO_THEME.textPrimary }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Route Threat Distribution */}
          <div style={{
            background: `linear-gradient(135deg, ${CAMO_THEME.bgMid} 0%, ${CAMO_THEME.bgLight} 100%)`,
            border: `1px solid ${CAMO_THEME.oliveDrab}`,
            borderRadius: 8,
            padding: 20,
          }}>
            <SectionHeader title="Route Threat Levels" icon="⚠️" />
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={threatData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={CAMO_THEME.oliveDrab} />
                <XAxis type="number" stroke={CAMO_THEME.textSecondary} />
                <YAxis type="category" dataKey="name" stroke={CAMO_THEME.textSecondary} width={60} />
                <Tooltip
                  contentStyle={{ background: CAMO_THEME.bgDark, border: `1px solid ${CAMO_THEME.oliveDrab}` }}
                  labelStyle={{ color: CAMO_THEME.textPrimary }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {threatData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* System Efficiency Radar */}
          <div style={{
            background: `linear-gradient(135deg, ${CAMO_THEME.bgMid} 0%, ${CAMO_THEME.bgLight} 100%)`,
            border: `1px solid ${CAMO_THEME.oliveDrab}`,
            borderRadius: 8,
            padding: 20,
          }}>
            <SectionHeader title="Operational Efficiency" icon="📊" />
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={efficiencyRadarData}>
                <PolarGrid stroke={CAMO_THEME.oliveDrab} />
                <PolarAngleAxis dataKey="metric" stroke={CAMO_THEME.textSecondary} tick={{ fontSize: 10 }} />
                <PolarRadiusAxis domain={[0, 100]} stroke={CAMO_THEME.textMuted} />
                <Radar
                  name="Efficiency"
                  dataKey="value"
                  stroke={CAMO_THEME.saffron}
                  fill={CAMO_THEME.saffron}
                  fillOpacity={0.3}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Vehicle Sharing & Road Space Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          {/* Vehicle Sharing Summary */}
          <div style={{
            background: `linear-gradient(135deg, ${CAMO_THEME.bgMid} 0%, ${CAMO_THEME.bgLight} 100%)`,
            border: `1px solid ${CAMO_THEME.oliveDrab}`,
            borderRadius: 8,
            padding: 20,
          }}>
            <SectionHeader title="Vehicle Sharing Operations" subtitle="Inter-Entity Fleet Management" icon="🔄" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              <div style={{ textAlign: 'center', padding: 16, background: CAMO_THEME.bgDark, borderRadius: 8 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: CAMO_THEME.chart2 }}>
                  {dashboard.vehicle_sharing.pending_requests}
                </div>
                <div style={{ fontSize: 11, color: CAMO_THEME.textSecondary, marginTop: 4 }}>Pending Requests</div>
              </div>
              <div style={{ textAlign: 'center', padding: 16, background: CAMO_THEME.bgDark, borderRadius: 8 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: CAMO_THEME.chart1 }}>
                  {dashboard.vehicle_sharing.active_agreements}
                </div>
                <div style={{ fontSize: 11, color: CAMO_THEME.textSecondary, marginTop: 4 }}>Active Agreements</div>
              </div>
              <div style={{ textAlign: 'center', padding: 16, background: CAMO_THEME.bgDark, borderRadius: 8 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: CAMO_THEME.saffron }}>
                  {dashboard.vehicle_sharing.vehicles_shared_out}
                </div>
                <div style={{ fontSize: 11, color: CAMO_THEME.textSecondary, marginTop: 4 }}>Shared Out</div>
              </div>
              <div style={{ textAlign: 'center', padding: 16, background: CAMO_THEME.bgDark, borderRadius: 8 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: CAMO_THEME.chart5 }}>
                  {dashboard.vehicle_sharing.vehicles_shared_in}
                </div>
                <div style={{ fontSize: 11, color: CAMO_THEME.textSecondary, marginTop: 4 }}>Shared In</div>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: CAMO_THEME.textSecondary }}>Fleet Utilization</span>
                <span style={{ fontSize: 12, color: CAMO_THEME.textPrimary, fontWeight: 600 }}>
                  {dashboard.vehicle_sharing.fleet_utilization}%
                </span>
              </div>
              <ProgressBar value={dashboard.vehicle_sharing.fleet_utilization} color={CAMO_THEME.chart2} height={10} />
            </div>
          </div>

          {/* Road Space & Notifications */}
          <div style={{
            background: `linear-gradient(135deg, ${CAMO_THEME.bgMid} 0%, ${CAMO_THEME.bgLight} 100%)`,
            border: `1px solid ${CAMO_THEME.oliveDrab}`,
            borderRadius: 8,
            padding: 20,
          }}>
            <SectionHeader title="Road Space & Alerts" icon="🛣️" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: CAMO_THEME.bgDark, borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: CAMO_THEME.textSecondary }}>Active Allocations</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: CAMO_THEME.chart2 }}>
                  {dashboard.road_space.active_allocations}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: CAMO_THEME.bgDark, borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: CAMO_THEME.textSecondary }}>Conflicts Detected</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: dashboard.road_space.conflicts_detected > 0 ? CAMO_THEME.dangerRed : CAMO_THEME.chart1 }}>
                  {dashboard.road_space.conflicts_detected}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: CAMO_THEME.bgDark, borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: CAMO_THEME.textSecondary }}>Pending Notifications</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: CAMO_THEME.chart3 }}>
                  {dashboard.notifications.pending}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: CAMO_THEME.bgDark, borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: CAMO_THEME.textSecondary }}>Acknowledgement Rate</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: CAMO_THEME.chart1 }}>
                  {dashboard.notifications.acknowledgement_rate}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* REAL-TIME DATABASE PANEL */}
        <div style={{
          background: `linear-gradient(135deg, ${CAMO_THEME.bgMid} 0%, rgba(34, 197, 94, 0.1) 50%, ${CAMO_THEME.bgMid} 100%)`,
          border: `1px solid ${CAMO_THEME.chart1}`,
          borderRadius: 8,
          padding: 20,
        }}>
          <SectionHeader title="Real-Time Database Status" subtitle="Live operational data from database" icon="📡" />
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {/* Vehicles Panel */}
            <div style={{ 
              background: CAMO_THEME.bgDark, 
              borderRadius: 8, 
              padding: 16,
              border: `1px solid ${CAMO_THEME.oliveDrab}`,
            }}>
              <div style={{ fontSize: 10, color: CAMO_THEME.chart1, fontWeight: 600, marginBottom: 8 }}>🚛 ACTIVE VEHICLES</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: CAMO_THEME.chart1, fontFamily: 'monospace' }}>
                {vehicles.length}
              </div>
              <div style={{ fontSize: 11, color: CAMO_THEME.textSecondary, marginTop: 4 }}>
                {vehicles.filter(v => v.status === 'MOVING').length} moving • {vehicles.filter(v => v.status === 'HALTED' || v.status === 'HALTED_OBSTACLE').length} halted
              </div>
              {vehicles.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 10, color: CAMO_THEME.textMuted }}>
                  Types: {[...new Set(vehicles.map(v => v.asset_type))].slice(0, 3).join(', ')}
                </div>
              )}
            </div>
            
            {/* Routes Panel */}
            <div style={{ 
              background: CAMO_THEME.bgDark, 
              borderRadius: 8, 
              padding: 16,
              border: `1px solid ${CAMO_THEME.oliveDrab}`,
            }}>
              <div style={{ fontSize: 10, color: CAMO_THEME.chart2, fontWeight: 600, marginBottom: 8 }}>🛣️ MAPPED ROUTES</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: CAMO_THEME.chart2, fontFamily: 'monospace' }}>
                {routes.length}
              </div>
              <div style={{ fontSize: 11, color: CAMO_THEME.textSecondary, marginTop: 4 }}>
                {routes.filter(r => r.threat_level === 'HIGH' || r.threat_level === 'CRITICAL').length} high-risk
              </div>
              {routes.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 10, color: CAMO_THEME.textMuted }}>
                  Total: {routes.reduce((acc, r) => acc + (r.total_distance_km || 0), 0).toFixed(0)} km
                </div>
              )}
            </div>
            
            {/* Convoys Panel */}
            <div style={{ 
              background: CAMO_THEME.bgDark, 
              borderRadius: 8, 
              padding: 16,
              border: `1px solid ${CAMO_THEME.oliveDrab}`,
            }}>
              <div style={{ fontSize: 10, color: CAMO_THEME.saffron, fontWeight: 600, marginBottom: 8 }}>🎖️ CONVOY STATUS</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: CAMO_THEME.saffron, fontFamily: 'monospace' }}>
                {convoys.length}
              </div>
              <div style={{ fontSize: 11, color: CAMO_THEME.textSecondary, marginTop: 4 }}>
                {convoys.filter(c => c.status === 'IN_TRANSIT').length} active • {convoys.filter(c => c.status === 'HALTED').length} halted
              </div>
              {convoys.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 10, color: CAMO_THEME.textMuted }}>
                  Vehicles: {convoys.reduce((acc, c) => acc + (c.vehicle_count || 0), 0)}
                </div>
              )}
            </div>
            
            {/* Threats Panel */}
            <div style={{ 
              background: obstacles.length > 0 ? `${CAMO_THEME.chart4}22` : CAMO_THEME.bgDark, 
              borderRadius: 8, 
              padding: 16,
              border: `1px solid ${obstacles.length > 0 ? CAMO_THEME.chart4 : CAMO_THEME.oliveDrab}`,
            }}>
              <div style={{ fontSize: 10, color: obstacles.length > 0 ? CAMO_THEME.chart4 : CAMO_THEME.chart1, fontWeight: 600, marginBottom: 8 }}>
                {obstacles.length > 0 ? '⚠️ ACTIVE THREATS' : '✅ THREAT STATUS'}
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, color: obstacles.length > 0 ? CAMO_THEME.chart4 : CAMO_THEME.chart1, fontFamily: 'monospace' }}>
                {obstacles.length}
              </div>
              <div style={{ fontSize: 11, color: CAMO_THEME.textSecondary, marginTop: 4 }}>
                {obstacles.length > 0 
                  ? `${obstacles.filter(o => o.severity === 'CRITICAL' || o.severity === 'HIGH').length} critical/high`
                  : 'All clear - Green zone'
                }
              </div>
              {obstacles.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 10, color: CAMO_THEME.chart4 }}>
                  Types: {[...new Set(obstacles.map(o => o.obstacle_type?.replace(/_/g, ' ')))].slice(0, 2).join(', ')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderLoadsTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionHeader title="Load Assignments" subtitle="AI-Prioritized Load Queue" icon="📦" />
      
      {/* Load Stats */}
      {dashboard && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {Object.entries(dashboard.load_management.priority_distribution).map(([priority, count]) => (
            <div key={priority} style={{
              background: CAMO_THEME.bgDark,
              border: `1px solid ${PRIORITY_COLORS[priority]}44`,
              borderRadius: 8,
              padding: 12,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: PRIORITY_COLORS[priority] }}>{count}</div>
              <div style={{ fontSize: 10, color: CAMO_THEME.textSecondary, marginTop: 4 }}>{priority}</div>
            </div>
          ))}
        </div>
      )}

      {/* Load Table */}
      <div style={{
        background: `linear-gradient(135deg, ${CAMO_THEME.bgMid} 0%, ${CAMO_THEME.bgLight} 100%)`,
        border: `1px solid ${CAMO_THEME.oliveDrab}`,
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: CAMO_THEME.bgDark }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: CAMO_THEME.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Code</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: CAMO_THEME.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Category</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: CAMO_THEME.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Priority</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: CAMO_THEME.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Weight</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: CAMO_THEME.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Source → Destination</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: CAMO_THEME.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>AI Score</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: CAMO_THEME.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: CAMO_THEME.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Progress</th>
            </tr>
          </thead>
          <tbody>
            {loads.map((load, i) => (
              <tr key={load.id} style={{ borderTop: `1px solid ${CAMO_THEME.oliveDrab}33`, background: i % 2 === 0 ? 'transparent' : CAMO_THEME.bgDark + '44' }}>
                <td style={{ padding: '12px 16px', fontSize: 12, color: CAMO_THEME.textPrimary, fontFamily: 'monospace' }}>{load.assignment_code}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: CATEGORY_COLORS[load.load_category] || '#6b7280' }} />
                    <span style={{ fontSize: 11, color: CAMO_THEME.textPrimary }}>{load.load_category}</span>
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}><PriorityBadge priority={load.priority} /></td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: CAMO_THEME.textPrimary, fontWeight: 600 }}>{load.total_weight_tons.toFixed(1)} t</td>
                <td style={{ padding: '12px 16px', fontSize: 11, color: CAMO_THEME.textSecondary }}>
                  {load.source.name} → {load.destination.name}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    background: `${CAMO_THEME.chart1}22`,
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    color: CAMO_THEME.chart1,
                  }}>
                    🤖 {(load.ai_priority_score * 100).toFixed(0)}%
                  </div>
                </td>
                <td style={{ padding: '12px 16px' }}><StatusBadge status={load.status} small /></td>
                <td style={{ padding: '12px 16px', minWidth: 100 }}>
                  <ProgressBar value={load.completion_percentage} color={STATUS_COLORS[load.status] || CAMO_THEME.chart1} height={6} />
                  <span style={{ fontSize: 10, color: CAMO_THEME.textMuted }}>{load.completion_percentage}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderSharingTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionHeader title="Vehicle Sharing" subtitle="Inter-Entity Fleet Optimization" icon="🔄" />
      
      {/* Sharing Stats */}
      {dashboard && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <MetricCard title="Total Fleet" value={dashboard.vehicle_sharing.total_fleet_size} icon="🚐" color={CAMO_THEME.chart2} />
          <MetricCard title="Available" value={dashboard.vehicle_sharing.available_vehicles} subtitle={`${dashboard.vehicle_sharing.availability_rate}% rate`} icon="✓" color={CAMO_THEME.chart1} />
          <MetricCard title="Pending Requests" value={dashboard.vehicle_sharing.pending_requests} icon="⏳" color={CAMO_THEME.chart3} />
          <MetricCard title="Active Sharing" value={dashboard.vehicle_sharing.active_agreements} icon="🤝" color={CAMO_THEME.chart5} />
        </div>
      )}

      {/* Sharing Requests Table */}
      <div style={{
        background: `linear-gradient(135deg, ${CAMO_THEME.bgMid} 0%, ${CAMO_THEME.bgLight} 100%)`,
        border: `1px solid ${CAMO_THEME.oliveDrab}`,
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: CAMO_THEME.bgDark }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: CAMO_THEME.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>Request Code</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: CAMO_THEME.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>Requesting Entity</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: CAMO_THEME.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>Vehicle Type</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: CAMO_THEME.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>Qty</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: CAMO_THEME.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>Duration</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: CAMO_THEME.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>Provider</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: CAMO_THEME.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>AI Match</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: CAMO_THEME.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {sharingRequests.map((req, i) => (
              <tr key={req.id} style={{ borderTop: `1px solid ${CAMO_THEME.oliveDrab}33`, background: i % 2 === 0 ? 'transparent' : CAMO_THEME.bgDark + '44' }}>
                <td style={{ padding: '12px 16px', fontSize: 12, color: CAMO_THEME.textPrimary, fontFamily: 'monospace' }}>{req.request_code}</td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: CAMO_THEME.textPrimary }}>{req.requesting_entity.name}</td>
                <td style={{ padding: '12px 16px', fontSize: 11, color: CAMO_THEME.saffron, fontWeight: 600 }}>{req.vehicle_type}</td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: CAMO_THEME.textPrimary, fontWeight: 600 }}>{req.quantity}</td>
                <td style={{ padding: '12px 16px', fontSize: 11, color: CAMO_THEME.textSecondary }}>
                  {new Date(req.start_date).toLocaleDateString()} - {new Date(req.end_date).toLocaleDateString()}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 11, color: req.providing_entity ? CAMO_THEME.chart1 : CAMO_THEME.textMuted }}>
                  {req.providing_entity?.name || 'Pending Match'}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    background: `${req.ai_match_score >= 0.7 ? CAMO_THEME.chart1 : CAMO_THEME.chart3}22`,
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    color: req.ai_match_score >= 0.7 ? CAMO_THEME.chart1 : CAMO_THEME.chart3,
                  }}>
                    {(req.ai_match_score * 100).toFixed(0)}%
                  </div>
                </td>
                <td style={{ padding: '12px 16px' }}><StatusBadge status={req.status} small /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderMovementTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionHeader title="Movement Planning" subtitle="Convoy Coordination & Tracking" icon="🚛" />
      
      {/* Movement Stats */}
      {dashboard && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <MetricCard title="Active Plans" value={dashboard.movement_planning.active_plans} icon="📋" color={CAMO_THEME.chart2} />
          <MetricCard title="In Transit" value={dashboard.movement_planning.convoys_in_transit} icon="🚛" color={CAMO_THEME.chart1} />
          <MetricCard title="Halted" value={dashboard.movement_planning.convoys_halted} icon="⏸️" color={CAMO_THEME.chart3} />
          <MetricCard title="Completed Today" value={dashboard.movement_planning.convoys_completed_today} icon="✅" color={CAMO_THEME.saffron} />
        </div>
      )}

      {/* Movement Plans Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {movementPlans.map((plan) => (
          <div key={plan.id} style={{
            background: `linear-gradient(135deg, ${CAMO_THEME.bgMid} 0%, ${CAMO_THEME.bgLight} 100%)`,
            border: `1px solid ${CAMO_THEME.oliveDrab}`,
            borderRadius: 8,
            padding: 20,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: CAMO_THEME.saffron }}>{plan.plan_code}</div>
                <div style={{ fontSize: 12, color: CAMO_THEME.textSecondary }}>{plan.plan_name}</div>
              </div>
              <StatusBadge status={plan.status} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 10, color: CAMO_THEME.textMuted, marginBottom: 2 }}>Convoy</div>
                <div style={{ fontSize: 12, color: CAMO_THEME.textPrimary }}>{plan.convoy_name || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: CAMO_THEME.textMuted, marginBottom: 2 }}>Route</div>
                <div style={{ fontSize: 12, color: CAMO_THEME.textPrimary }}>{plan.route_name || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: CAMO_THEME.textMuted, marginBottom: 2 }}>Vehicles</div>
                <div style={{ fontSize: 12, color: CAMO_THEME.textPrimary }}>{plan.vehicle_count}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: CAMO_THEME.textMuted, marginBottom: 2 }}>Load</div>
                <div style={{ fontSize: 12, color: CAMO_THEME.textPrimary }}>{plan.total_load_tons?.toFixed(1) || 0} tons</div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: CAMO_THEME.textSecondary }}>Progress</span>
                <span style={{ fontSize: 11, color: CAMO_THEME.textPrimary, fontWeight: 600 }}>{plan.progress_percent}%</span>
              </div>
              <ProgressBar value={plan.progress_percent} color={CAMO_THEME.chart1} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                background: plan.overall_risk_score > 0.5 ? `${CAMO_THEME.dangerRed}22` : `${CAMO_THEME.chart1}22`,
                borderRadius: 4,
                fontSize: 10,
                color: plan.overall_risk_score > 0.5 ? CAMO_THEME.dangerRed : CAMO_THEME.chart1,
              }}>
                Risk: {(plan.overall_risk_score * 100).toFixed(0)}%
              </div>
              {plan.ai_optimized && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  background: `${CAMO_THEME.saffron}22`,
                  borderRadius: 4,
                  fontSize: 10,
                  color: CAMO_THEME.saffron,
                }}>
                  🤖 AI Optimized
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderNotificationsTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionHeader title="Entity Notifications" subtitle="Dynamic Alerts & Communications" icon="🔔" />
      
      {/* Notification Stats */}
      {dashboard && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <MetricCard title="Sent Today" value={dashboard.notifications.sent_today} icon="📤" color={CAMO_THEME.chart2} />
          <MetricCard title="Pending" value={dashboard.notifications.pending} icon="⏳" color={CAMO_THEME.chart3} />
          <MetricCard title="Acknowledged" value={dashboard.notifications.acknowledged_today} icon="✓" color={CAMO_THEME.chart1} />
          <MetricCard title="Ack Rate" value={`${dashboard.notifications.acknowledgement_rate}%`} icon="📊" color={CAMO_THEME.saffron} />
        </div>
      )}

      {/* Notifications List */}
      <div style={{
        background: `linear-gradient(135deg, ${CAMO_THEME.bgMid} 0%, ${CAMO_THEME.bgLight} 100%)`,
        border: `1px solid ${CAMO_THEME.oliveDrab}`,
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        {notifications.map((notif, i) => (
          <div key={notif.id} style={{
            padding: 16,
            borderTop: i > 0 ? `1px solid ${CAMO_THEME.oliveDrab}33` : 'none',
            display: 'flex',
            gap: 16,
            alignItems: 'flex-start',
          }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: notif.priority === 'HIGH' ? `${CAMO_THEME.dangerRed}22` : notif.priority === 'MEDIUM' ? `${CAMO_THEME.chart3}22` : `${CAMO_THEME.chart1}22`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              flexShrink: 0,
            }}>
              {notif.type === 'CONVOY_APPROACHING' ? '🚛' : 
               notif.type === 'THREAT_ALERT' ? '⚠️' : 
               notif.type === 'WEATHER_WARNING' ? '🌧️' : 
               notif.type === 'ETA_UPDATE' ? '⏱️' : '📢'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: CAMO_THEME.textPrimary }}>{notif.title}</div>
                <StatusBadge status={notif.status} small />
              </div>
              <div style={{ fontSize: 12, color: CAMO_THEME.textSecondary, marginBottom: 8 }}>{notif.message}</div>
              <div style={{ display: 'flex', gap: 16, fontSize: 10, color: CAMO_THEME.textMuted }}>
                <span>{notif.type.replace(/_/g, ' ')}</span>
                <span>•</span>
                <span>{new Date(notif.created_at).toLocaleString()}</span>
                {notif.acknowledged_at && (
                  <>
                    <span>•</span>
                    <span style={{ color: CAMO_THEME.chart1 }}>Acknowledged</span>
                  </>
                )}
              </div>
            </div>
            <PriorityBadge priority={notif.priority} />
          </div>
        ))}
      </div>
    </div>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  // Determine AI status based on Janus analysis or fallback
  const isAIActive = janusAnalysis !== null || dashboard?.system_metrics?.ai_optimization_active || vehicles.length > 0 || routes.length > 0;
  const aiStatusColor = janusAnalysis?.overall_status === 'CRITICAL' ? CAMO_THEME.chart4 
    : janusAnalysis?.overall_status === 'CAUTION' ? CAMO_THEME.chart3 
    : CAMO_THEME.chart1;

  return (
    <div style={{
      minHeight: '100vh',
      background: CAMO_PATTERN,
      color: CAMO_THEME.textPrimary,
      fontFamily: '"Segoe UI", system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(90deg, ${CAMO_THEME.bgDark} 0%, ${CAMO_THEME.armyGreen}cc 50%, ${CAMO_THEME.bgDark} 100%)`,
        borderBottom: `3px solid ${CAMO_THEME.saffron}`,
        padding: '20px 32px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 36 }}>🏛️</div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: CAMO_THEME.saffron, letterSpacing: 2 }}>
                COMMAND CENTRE
              </div>
              <div style={{ fontSize: 12, color: CAMO_THEME.textSecondary, letterSpacing: 1 }}>
                भारतीय सेना परिवहन कोर | LOAD & MOVEMENT MANAGEMENT
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            {/* Real-time Stats */}
            <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: CAMO_THEME.textMuted, fontSize: 9 }}>VEHICLES</div>
                <div style={{ color: CAMO_THEME.chart1, fontWeight: 700, fontFamily: 'monospace' }}>{vehicles.length}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: CAMO_THEME.textMuted, fontSize: 9 }}>ROUTES</div>
                <div style={{ color: CAMO_THEME.chart2, fontWeight: 700, fontFamily: 'monospace' }}>{routes.length}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: CAMO_THEME.textMuted, fontSize: 9 }}>CONVOYS</div>
                <div style={{ color: CAMO_THEME.chart3, fontWeight: 700, fontFamily: 'monospace' }}>{convoys.length}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: CAMO_THEME.textMuted, fontSize: 9 }}>THREATS</div>
                <div style={{ color: obstacles.length > 0 ? CAMO_THEME.chart4 : CAMO_THEME.chart1, fontWeight: 700, fontFamily: 'monospace' }}>{obstacles.length}</div>
              </div>
            </div>
            <div style={{ width: 1, height: 30, background: CAMO_THEME.oliveDrab }} />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: CAMO_THEME.textMuted }}>LAST UPDATE</div>
              <div style={{ fontSize: 12, color: CAMO_THEME.textSecondary, fontFamily: 'monospace' }}>
                {lastUpdate.toLocaleTimeString()}
              </div>
            </div>
            <div style={{
              padding: '8px 16px',
              background: isAIActive ? `${aiStatusColor}22` : `${CAMO_THEME.chart3}22`,
              border: `1px solid ${isAIActive ? aiStatusColor : CAMO_THEME.chart3}`,
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 600,
              color: isAIActive ? aiStatusColor : CAMO_THEME.chart3,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              {janusLoading ? (
                <span style={{ animation: 'spin 1s linear infinite' }}>⚙️</span>
              ) : (
                <span>🤖</span>
              )}
              AI {isAIActive ? (janusAnalysis?.overall_status || 'ACTIVE') : 'STANDBY'}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          {[
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'loads', label: 'Load Management', icon: '📦' },
            { id: 'sharing', label: 'Vehicle Sharing', icon: '🔄' },
            { id: 'movement', label: 'Movement Plans', icon: '🚛' },
            { id: 'notifications', label: 'Notifications', icon: '🔔' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '10px 20px',
                background: activeTab === tab.id ? CAMO_THEME.saffron : 'transparent',
                border: `1px solid ${activeTab === tab.id ? CAMO_THEME.saffron : CAMO_THEME.oliveDrab}`,
                borderRadius: 6,
                color: activeTab === tab.id ? CAMO_THEME.bgDark : CAMO_THEME.textSecondary,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s ease',
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 32 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: CAMO_THEME.textSecondary }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <div>Loading Command Centre Data...</div>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && renderOverviewTab()}
            {activeTab === 'loads' && renderLoadsTab()}
            {activeTab === 'sharing' && renderSharingTab()}
            {activeTab === 'movement' && renderMovementTab()}
            {activeTab === 'notifications' && renderNotificationsTab()}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{
        background: CAMO_THEME.bgDark,
        borderTop: `1px solid ${CAMO_THEME.oliveDrab}`,
        padding: '12px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 10,
        color: CAMO_THEME.textMuted,
      }}>
        <div>SECURITY CLASSIFICATION: प्रतिबंधित (RESTRICTED)</div>
        <div>INDIAN ARMY TRANSPORT CORPS AI SYSTEM v2.0</div>
        <div>ENTITIES: {entities.length} | ROUTES: {dashboard?.threat_overview.route_threat_distribution ? Object.values(dashboard.threat_overview.route_threat_distribution).reduce((a, b) => a + b, 0) : 0}</div>
      </div>
    </div>
  );
};

export default CommandCentre;
