'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

const API_V1 = '/api/proxy/v1';

// ============================================================================
// INTERFACES
// ============================================================================

interface MetricsData {
  vehicle_id: number;
  vehicle_type: string;
  timestamp: string;
  position: { lat: number; lng: number; altitude_m: number; bearing_degrees: number; speed_kmh: number };
  gps: { accuracy_m: number; satellites: number; signal_strength: number; hdop: number; fix_type: string };
  engine: { rpm: number; temperature_c: number; oil_pressure_psi: number; throttle_percent: number; load_percent: number; stress_level: number; efficiency: number };
  fuel: { level_liters: number; level_percent: number; consumption_lph: number; consumption_kpl: number; range_km: number; fuel_type: string };
  communications: { radio_strength: number; frequency_mhz: number; latency_ms: number; data_rate_kbps: number; encryption: string; is_jammed: boolean };
  environment: { temperature_c: number; humidity_percent: number; visibility_km: number; road_condition: string; traction: number; wind_speed_kmh: number };
  maintenance: { breakdown_probability: number; next_service_km: number; alerts: string[] };
  operational: { total_distance_km: number; load_weight_kg: number; terrain: string; weather: string };
}

interface TCPData {
  id: string;
  name: string;
  location: { lat: number; lng: number };
  type: 'CHECKPOINT' | 'REFUEL' | 'REST' | 'MEDICAL' | 'COMMAND';
  status: 'ACTIVE' | 'STANDBY' | 'ALERT';
  eta_minutes?: number;
  distance_km?: number;
}

interface AIAnalysis {
  threatLevel: 'ALPHA' | 'BRAVO' | 'CHARLIE' | 'DELTA';
  missionStatus: string;
  predictions: {
    eta: string;
    fuelAtDestination: number;
    weatherImpact: string;
    threatProbability: number;
    maintenanceRisk: string;
    routeEfficiency: number;
  };
  alerts: Array<{ severity: string; message: string; timestamp: string }>;
  recommendations: string[];
  tacticalAdvice: string;
}

// Extended metrics for surreal experience
interface ExtendedMetrics {
  transmission: { gear: number; torque_nm: number; clutch_temp_c: number; shift_quality: number };
  brakes: { front_temp_c: number; rear_temp_c: number; pad_wear_percent: number; abs_active: boolean };
  suspension: { travel_mm: number; damping_rate: number; load_distribution: number };
  armor: { integrity_percent: number; threat_direction: string | null; last_impact: string | null };
  countermeasures: { smoke_charges: number; flares: number; jammer_active: boolean };
  thermalSignature: number;
  acousticSignature: number;
  radarCrossSection: number;
  waypointDistance: number;
  headingError: number;
  crossTrackError: number;
  battery: { voltage: number; current_a: number; soc_percent: number; temp_c: number };
  alternator: { output_v: number; load_percent: number };
  crew: { alertness: number; fatigue_hours: number; morale: number };
  missionProgress: number;
  objectiveDistance: number;
  timeOnTarget: string;
}

interface TacticalMetricsHUDProps {
  vehicleId: number | null;
  vehicleName?: string;
  routeId?: string | null;
  mode: 'vehicle' | 'route';
  onClose?: () => void;
}

// ============================================================================
// MILITARY THEME CONSTANTS
// ============================================================================

const MILITARY_COLORS = {
  primary: '#1a472a',
  secondary: '#2d5016',
  accent: '#c4a35a',
  alert: '#8b0000',
  warning: '#cd7f32',
  success: '#228b22',
  info: '#4682b4',
  text: '#f5f5dc',
  muted: '#808080',
  background: '#0d1b0d',
  panel: 'rgba(26, 71, 42, 0.85)',
  border: 'rgba(196, 163, 90, 0.4)',
  glow: 'rgba(196, 163, 90, 0.3)',
  neon: '#00ff41',
  cyan: '#00ffff',
  magenta: '#ff00ff',
};

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

// Animated value with delta indicator
const AnimatedValue: React.FC<{
  value: number;
  prevValue: number;
  format?: (v: number) => string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}> = ({ value, prevValue, format = (v) => v.toFixed(1), color = MILITARY_COLORS.text, size = 'md' }) => {
  const delta = value - prevValue;
  const showDelta = Math.abs(delta) > 0.01;
  const sizes = { sm: 'text-xs', md: 'text-sm', lg: 'text-lg' };
  
  return (
    <div className="flex items-center gap-1">
      <span className={`font-mono font-bold ${sizes[size]}`} style={{ color }}>{format(value)}</span>
      {showDelta && (
        <span className={`text-[9px] ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
          {delta > 0 ? '▲' : '▼'}{Math.abs(delta).toFixed(1)}
        </span>
      )}
    </div>
  );
};

// High-frequency gauge with glow effect
const HFGauge: React.FC<{
  value: number;
  max: number;
  label: string;
  unit: string;
  icon: string;
  status?: 'normal' | 'warning' | 'critical';
  prevValue?: number;
}> = ({ value, max, label, unit, icon, status = 'normal', prevValue = value }) => {
  const percentage = Math.min((value / max) * 100, 100);
  const angle = (percentage / 100) * 180 - 90;
  const delta = value - prevValue;
  
  const statusColors = { normal: MILITARY_COLORS.success, warning: MILITARY_COLORS.warning, critical: MILITARY_COLORS.alert };
  const glowIntensity = Math.abs(delta) > 1 ? 15 : 8;
  
  return (
    <div className="relative flex flex-col items-center p-1">
      <svg width="80" height="50" viewBox="0 0 80 50">
        <defs>
          <filter id={`glow-${label}`}>
            <feGaussianBlur stdDeviation={glowIntensity / 4} result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <path d="M 8 45 A 32 32 0 0 1 72 45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" strokeLinecap="round"/>
        <path d="M 8 45 A 32 32 0 0 1 72 45" fill="none" stroke={statusColors[status]} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${percentage * 1.01} 101`} filter={`url(#glow-${label})`} className="transition-all duration-150"/>
        <line x1="40" y1="45" x2={40 + Math.cos((angle * Math.PI) / 180) * 24} y2={45 + Math.sin((angle * Math.PI) / 180) * 24} stroke={MILITARY_COLORS.accent} strokeWidth="2" strokeLinecap="round" className="transition-all duration-100"/>
        <circle cx="40" cy="45" r="3" fill={MILITARY_COLORS.accent} />
        <text x="40" y="38" textAnchor="middle" fill={MILITARY_COLORS.text} fontSize="11" fontWeight="bold" fontFamily="monospace">{value.toFixed(0)}</text>
      </svg>
      <div className="flex items-center gap-1 -mt-1">
        <span className="text-[10px]">{icon}</span>
        <span className="text-[8px] uppercase tracking-wider" style={{ color: MILITARY_COLORS.accent }}>{label}</span>
        {Math.abs(delta) > 0.5 && <span className={`text-[8px] ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}>{delta > 0 ? '↑' : '↓'}</span>}
      </div>
    </div>
  );
};

// Mini metric display
const MiniMetric: React.FC<{ label: string; value: string | number; unit?: string; color?: string; flash?: boolean }> = ({ label, value, unit = '', color = MILITARY_COLORS.text, flash = false }) => (
  <div className={`p-1.5 rounded text-center ${flash ? 'animate-pulse' : ''}`} style={{ background: 'rgba(0,0,0,0.4)' }}>
    <div className="text-[8px] uppercase" style={{ color: MILITARY_COLORS.muted }}>{label}</div>
    <div className="text-xs font-mono font-bold" style={{ color }}>{value}{unit}</div>
  </div>
);

// Real-time sparkline with higher resolution
const RTSparkline: React.FC<{ data: number[]; color?: string; height?: number; showGrid?: boolean }> = ({ data, color = MILITARY_COLORS.success, height = 25, showGrid = true }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const h = canvas.height;
    const padding = 2;
    const min = Math.min(...data) * 0.95;
    const max = Math.max(...data) * 1.05;
    
    ctx.clearRect(0, 0, width, h);
    
    if (showGrid) {
      ctx.strokeStyle = 'rgba(196, 163, 90, 0.1)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 4; i++) {
        const y = (h / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }
    
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, color + '60');
    gradient.addColorStop(1, 'transparent');
    
    ctx.beginPath();
    ctx.moveTo(padding, h - padding);
    data.forEach((val, i) => {
      const x = padding + (i / (data.length - 1)) * (width - padding * 2);
      const y = h - padding - ((val - min) / (max - min || 1)) * (h - padding * 2);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(width - padding, h - padding);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    
    ctx.shadowBlur = 4;
    ctx.shadowColor = color;
    ctx.beginPath();
    data.forEach((val, i) => {
      const x = padding + (i / (data.length - 1)) * (width - padding * 2);
      const y = h - padding - ((val - min) / (max - min || 1)) * (h - padding * 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    if (data.length > 0) {
      const lastX = width - padding;
      const lastY = h - padding - ((data[data.length - 1] - min) / (max - min || 1)) * (h - padding * 2);
      ctx.beginPath();
      ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }, [data, color, height, showGrid]);
  
  return <canvas ref={canvasRef} width={160} height={height} style={{ width: '100%', height: `${height}px` }} />;
};

// TCP Marker
const TCPMarker: React.FC<{ tcp: TCPData; isNext?: boolean }> = ({ tcp, isNext }) => {
  const typeIcons: Record<string, string> = { CHECKPOINT: '🛡️', REFUEL: '⛽', REST: '🏕️', MEDICAL: '🏥', COMMAND: '🎖️' };
  const statusColors = { ACTIVE: MILITARY_COLORS.success, STANDBY: MILITARY_COLORS.warning, ALERT: MILITARY_COLORS.alert };
  
  return (
    <div className={`flex items-center gap-2 p-1.5 rounded border transition-all ${isNext ? 'scale-[1.02]' : ''}`} style={{ background: isNext ? 'rgba(196, 163, 90, 0.15)' : 'rgba(0,0,0,0.3)', borderColor: isNext ? MILITARY_COLORS.accent : 'transparent' }}>
      <span className="text-lg">{typeIcons[tcp.type]}</span>
      <div className="flex-1">
        <div className="text-[10px] font-bold" style={{ color: MILITARY_COLORS.text }}>{tcp.name}</div>
        <div className="text-[9px]" style={{ color: MILITARY_COLORS.muted }}>{tcp.distance_km?.toFixed(1)}km • {tcp.eta_minutes?.toFixed(0)}min</div>
      </div>
      <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: statusColors[tcp.status] }} />
    </div>
  );
};

// Tactical Alert
const TacticalAlert: React.FC<{ severity: 'info' | 'warning' | 'critical'; message: string }> = ({ severity, message }) => {
  const colors = { info: { bg: 'rgba(70, 130, 180, 0.2)', border: MILITARY_COLORS.info, icon: 'ℹ️' }, warning: { bg: 'rgba(205, 127, 50, 0.2)', border: MILITARY_COLORS.warning, icon: '⚠️' }, critical: { bg: 'rgba(139, 0, 0, 0.3)', border: MILITARY_COLORS.alert, icon: '🚨' } };
  const { bg, border, icon } = colors[severity];
  
  return (
    <div className={`flex items-center gap-2 p-1.5 rounded text-[10px] mb-1 ${severity === 'critical' ? 'animate-pulse' : ''}`} style={{ background: bg, borderLeft: `3px solid ${border}` }}>
      <span>{icon}</span>
      <span style={{ color: MILITARY_COLORS.text }}>{message}</span>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

// Interface for Janus AI response
interface JanusAIAnalysis {
  analysis_type: string;
  generated_by: string;
  gpu_accelerated: boolean;
  model: string;
  confidence: number;
  raw_analysis?: string;
  recommendations: Array<{
    text: string;
    priority: string;
    source: string;
  }>;
  threat_assessment: {
    threat_level: string;
    threat_score: number;
    factors: string[];
    vehicle_status: string;
  };
  timestamp: string;
  note?: string;
}

export default function TacticalMetricsHUD({ vehicleId, vehicleName, mode, onClose }: TacticalMetricsHUDProps) {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [prevMetrics, setPrevMetrics] = useState<MetricsData | null>(null);
  const [extended, setExtended] = useState<ExtendedMetrics | null>(null);
  const [tcps, setTcps] = useState<TCPData[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [janusAnalysis, setJanusAnalysis] = useState<JanusAIAnalysis | null>(null);
  const [janusLoading, setJanusLoading] = useState(false);
  const [history, setHistory] = useState<Record<string, number[]>>({ speed: [], fuel: [], temp: [], rpm: [], throttle: [], torque: [], gforce: [] });
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [updateCount, setUpdateCount] = useState(0);
  const [lastSpeed, setLastSpeed] = useState(0);
  
  // Janus AI last call timestamp to throttle requests
  const lastJanusCall = useRef<number>(0);
  
  // Call Janus AI for deep analysis
  const fetchJanusAnalysis = useCallback(async (telemetry: any, vehicleInfo: any) => {
    const now = Date.now();
    // Only call Janus AI every 10 seconds to avoid overloading
    if (now - lastJanusCall.current < 10000) return;
    lastJanusCall.current = now;
    
    setJanusLoading(true);
    try {
      const response = await fetch('/api/proxy/advanced/ai/analyze-telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: vehicleId,
          telemetry: {
            velocity_kmh: telemetry.position?.speed_kmh || 0,
            engine_rpm: telemetry.engine?.rpm || 0,
            engine_temp_c: telemetry.engine?.temperature_c || 0,
            engine_load_pct: telemetry.engine?.load_percent || 50,
            fuel_percent: telemetry.fuel?.level_percent || 0,
            fuel_flow_lph: telemetry.fuel?.consumption_lph || 0,
            range_remaining_km: telemetry.fuel?.range_remaining_km || 0,
            altitude_m: telemetry.position?.altitude_m || 0,
            gradient_deg: telemetry.position?.gradient || 0,
            driver_fatigue_pct: telemetry.crew?.driver_fatigue_percent || 0,
            visibility_m: (telemetry.environment?.visibility_km || 10) * 1000,
            ambient_temp_c: telemetry.environment?.temperature_c || 25,
            tire_pressures_psi: telemetry.tires?.pressures_psi || [35, 35, 35, 35],
            brake_temps_c: telemetry.brakes?.temperatures_c || [80, 80, 80, 80],
            battery_voltage: telemetry.electrical?.battery_voltage || 24,
            battery_soc_pct: telemetry.electrical?.battery_soc_percent || 95
          },
          vehicle_name: vehicleName || `Vehicle ${vehicleId}`,
          vehicle_type: telemetry.vehicle_type || 'TRANSPORT',
          operation_zone: vehicleInfo.operation_zone || 'GENERAL',
          threat_level: telemetry.ai_analysis?.threat_level || 'LOW'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setJanusAnalysis(data);
      }
    } catch (error) {
      console.error('Janus AI analysis error:', error);
    } finally {
      setJanusLoading(false);
    }
  }, [vehicleId, vehicleName]);
  
  // Calculate update interval based on speed
  const getUpdateInterval = useCallback(() => {
    const speed = metrics?.position?.speed_kmh || 0;
    if (speed > 60) return 300;
    if (speed > 30) return 500;
    if (speed > 10) return 750;
    return 1000;
  }, [metrics?.position?.speed_kmh]);
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 100);
    return () => clearInterval(timer);
  }, []);
  
  const formatETA = (distance: number, speed: number): string => {
    if (speed <= 0) return '--:--';
    const hours = distance / speed;
    return `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`;
  };
  
  const generateExtendedMetrics = useCallback((data: MetricsData, prev: MetricsData | null): ExtendedMetrics => {
    const speed = data.position?.speed_kmh || 0;
    const prevSpeed = prev?.position?.speed_kmh || speed;
    const acceleration = (speed - prevSpeed) / Math.max(1, getUpdateInterval() / 1000);
    const rpm = data.engine?.rpm || 2000;
    const gear = speed < 10 ? 1 : speed < 25 ? 2 : speed < 40 ? 3 : speed < 55 ? 4 : speed < 70 ? 5 : 6;
    const torque = Math.round(rpm * 0.15 + Math.max(0, acceleration) * 40);
    const brakeTemp = speed > 0 && acceleration < -1 ? 120 + Math.abs(acceleration) * 25 : 80 + speed * 0.2;

    const ps = persistentState.current;
    ps.crewFatigue = Math.min(12, ps.crewFatigue + 0.002);
    ps.crewAlertness = Math.max(0.4, ps.crewAlertness - 0.0006 - (ps.crewFatigue > 6 ? 0.0008 : 0));
    ps.crewMorale = Math.max(0.5, Math.min(1, ps.crewMorale - (ps.crewFatigue > 6 ? 0.0004 : 0.0001)));
    ps.batterySOC = Math.max(15, ps.batterySOC - 0.006 - (rpm > 3000 ? 0.003 : 0));
    ps.brakeWear = Math.min(100, ps.brakeWear + (acceleration < -2 ? 0.02 : 0.002));

    if (data.operational?.terrain === 'MOUNTAIN' || data.operational?.terrain === 'FOREST') {
      ps.armorIntegrity = Math.max(85, ps.armorIntegrity - 0.002);
    }

    const bearing = data.position?.bearing_degrees || 0;
    const compass = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((bearing % 360) / 45)) % 8];
    const threatActive = data.communications?.is_jammed || (data.environment?.visibility_km || 10) < 3;
    const threatDir = threatActive ? compass : null;

    const totalDistance = data.operational?.total_distance_km || 0;
    const objectiveDistance = Math.max(0, 105 - totalDistance);
    const missionProgress = Math.min(100, (totalDistance / 105) * 100);

    return {
      transmission: { gear, torque_nm: torque, clutch_temp_c: 45 + speed * 0.3, shift_quality: 0.9 },
      brakes: { front_temp_c: Math.round(brakeTemp), rear_temp_c: Math.round(brakeTemp * 0.8), pad_wear_percent: Math.round(ps.brakeWear), abs_active: acceleration < -3 },
      suspension: { travel_mm: 80 + speed * 0.6, damping_rate: 0.75, load_distribution: 0.5 },
      armor: { integrity_percent: ps.armorIntegrity, threat_direction: threatDir, last_impact: threatActive ? 'RECENT' : null },
      countermeasures: { smoke_charges: ps.smokeCharges, flares: ps.flares, jammer_active: data.communications?.is_jammed || false },
      thermalSignature: 0.3 + (rpm / 5000) * 0.4,
      acousticSignature: 0.2 + (speed / 100) * 0.5,
      radarCrossSection: 16,
      waypointDistance: Math.max(0.1, objectiveDistance * 0.08),
      headingError: Math.max(-4, Math.min(4, (bearing - (prev?.position?.bearing_degrees || bearing)) / 10)),
      crossTrackError: Math.max(-2, Math.min(2, acceleration / 4)),
      battery: { voltage: 24.5, current_a: 15 + rpm * 0.005, soc_percent: ps.batterySOC, temp_c: 25 + rpm * 0.004 },
      alternator: { output_v: 27.8, load_percent: 40 + rpm * 0.01 },
      crew: { alertness: ps.crewAlertness, fatigue_hours: ps.crewFatigue, morale: ps.crewMorale },
      missionProgress,
      objectiveDistance,
      timeOnTarget: formatETA(objectiveDistance, speed || 45)
    };
  }, [getUpdateInterval]);
  
  // Persistent state for values that change over time in real operations
  const persistentState = useRef({
    smokeCharges: 4,
    flares: 8,
    armorIntegrity: 98,
    brakeWear: 72,
    crewFatigue: 0.5,
    crewAlertness: 0.92,
    crewMorale: 0.88,
    batterySOC: 94,
    missionStartTime: Date.now(),
    lastThreatEvent: 0
  });
  
  const mapVehicleType = (assetType?: string) => {
    const type = (assetType || '').toUpperCase();
    if (type.includes('FUEL')) return 'TRUCK_FUEL';
    if (type.includes('APC') || type.includes('ARMORED')) return 'APC';
    if (type.includes('MRAP')) return 'MRAP';
    return 'TRUCK_CARGO';
  };

  const initializeVehicleFromDb = useCallback(async () => {
    if (!vehicleId) return;
    try {
      const vehiclesRes = await fetch(`${API_V1}/vehicles/vehicles`);
      const vehicles = vehiclesRes.ok ? await vehiclesRes.json() : [];
      const asset = vehicles.find((v: any) => v.id === vehicleId);
      const vehicleType = mapVehicleType(asset?.asset_type);
      const fuelPercent = Math.max(10, Math.min(100, asset?.fuel_percent ?? 80));
      const loadKg = Math.max(1000, (asset?.capacity_tons || 3) * 1000);

      await fetch(`${API_V1}/advanced/metrics/initialize/${vehicleId}?vehicle_type=${vehicleType}&fuel_percent=${fuelPercent}&load_kg=${loadKg}`, { method: 'POST' });
    } catch (err) {
      console.error('Init error:', err);
    }
  }, [vehicleId]);

  const updateTcpsFromDb = useCallback(async (speedKmh: number) => {
    if (!vehicleId) return;
    try {
      const vehiclesRes = await fetch(`${API_V1}/vehicles/vehicles`);
      if (!vehiclesRes.ok) return;
      const vehicles = await vehiclesRes.json();
      const vehicle = vehicles.find((v: any) => v.id === vehicleId);
      const convoyId = vehicle?.convoy_id;
      if (!convoyId) { setTcps([]); return; }

      const convoysRes = await fetch(`${API_V1}/convoys/`);
      if (!convoysRes.ok) return;
      const convoys = await convoysRes.json();
      const convoy = convoys.find((c: any) => c.id === convoyId);
      const routeId = convoy?.route_id;
      if (!routeId) { setTcps([]); return; }

      const tcpsRes = await fetch(`${API_V1}/tcps/?route_id=${routeId}`);
      if (!tcpsRes.ok) return;
      const tcpRows = await tcpsRes.json();

      const etaFactor = speedKmh > 0 ? 60 / speedKmh : 0;
      const mapType = (name: string): TCPPoint['type'] => {
        const upper = name.toUpperCase();
        if (upper.includes('FUEL') || upper.includes('DEPOT')) return 'REFUEL';
        if (upper.includes('REST')) return 'REST';
        if (upper.includes('MED')) return 'MEDICAL';
        if (upper.includes('COMMAND')) return 'COMMAND';
        return 'CHECKPOINT';
      };

      setTcps(tcpRows.map((tcp: any) => ({
        id: String(tcp.id),
        name: tcp.name,
        type: mapType(tcp.name),
        location: { lat: tcp.latitude, lng: tcp.longitude },
        distance_km: tcp.route_km_marker ?? undefined,
        eta_minutes: tcp.route_km_marker && etaFactor ? Math.max(1, tcp.route_km_marker * etaFactor) : undefined,
        status: tcp.status === 'ACTIVE' ? 'ACTIVE' : tcp.status === 'INACTIVE' ? 'STANDBY' : 'ALERT',
        facilities: ['Comms', 'First Aid'],
        capacity: tcp.max_convoy_capacity || 0,
        current_occupancy: tcp.current_traffic === 'CONGESTED' ? Math.round((tcp.max_convoy_capacity || 5) * 0.8) : Math.round((tcp.max_convoy_capacity || 5) * 0.3)
      })));
    } catch (err) {
      console.error('TCP fetch error:', err);
    }
  }, [vehicleId]);

  const fetchMetrics = useCallback(async () => {
    if (!vehicleId) return;
    try {
      // Use the new physics-based full telemetry endpoint
      const response = await fetch(`${API_V1}/advanced/metrics/full-telemetry/${vehicleId}`);
      if (response.ok) {
        const rawData = await response.json();
        
        // Transform physics-based response to component's expected format
        const data: MetricsData = {
          vehicle_id: rawData.vehicle_id,
          vehicle_type: rawData.asset_type || 'TRUCK',
          timestamp: rawData.timestamp,
          position: {
            lat: rawData.position?.latitude || 0,
            lng: rawData.position?.longitude || 0,
            altitude_m: rawData.position?.altitude_m || 0,
            bearing_degrees: rawData.position?.bearing_deg || 0,
            speed_kmh: rawData.motion?.velocity_kmh || 0,
          },
          gps: {
            accuracy_m: 2.5,
            satellites: 12,
            signal_strength: 95,
            hdop: 0.8,
            fix_type: '3D_FIX',
          },
          engine: {
            rpm: rawData.engine?.rpm || 0,
            temperature_c: rawData.engine?.temperature_c || 75,
            oil_pressure_psi: 45,
            throttle_percent: rawData.engine?.throttle_position_percent || 0,
            load_percent: rawData.engine?.load_percent || 0,
            stress_level: rawData.engine?.load_percent > 80 ? 0.8 : 0.3,
            efficiency: (100 - (rawData.engine?.load_percent || 0)) / 100,
          },
          fuel: {
            level_liters: rawData.fuel?.level_liters || 0,
            level_percent: rawData.fuel?.level_percent || 0,
            consumption_lph: rawData.fuel?.consumption_rate_lph || 0,
            consumption_kpl: rawData.fuel?.efficiency_kpl || 0,
            range_km: rawData.fuel?.range_remaining_km || 0,
            fuel_type: 'DIESEL',
          },
          communications: {
            radio_strength: 90,
            frequency_mhz: 150.5,
            latency_ms: 45,
            data_rate_kbps: 9600,
            encryption: 'AES256',
            is_jammed: false,
          },
          environment: {
            temperature_c: rawData.environment?.ambient_temp_c || 25,
            humidity_percent: 65,
            visibility_km: (rawData.environment?.visibility_m || 10000) / 1000,
            road_condition: rawData.environment?.road_friction_coef > 0.6 ? 'DRY' : 'WET',
            traction: rawData.environment?.road_friction_coef || 0.7,
            wind_speed_kmh: 15,
          },
          maintenance: {
            breakdown_probability: rawData.ai_analysis?.breakdown_probability || 0.02,
            next_service_km: 5000 - (rawData.motion?.distance_traveled_km || 0),
            alerts: [],
          },
          operational: {
            total_distance_km: rawData.motion?.distance_traveled_km || 0,
            load_weight_kg: rawData.cargo?.weight_kg || 0,
            terrain: 'MOUNTAIN',
            weather: rawData.environment?.precipitation_mm_hr > 0 ? 'RAIN' : 'CLEAR',
          },
        };
        
        // Add maintenance alerts based on physics data
        if ((rawData.fuel?.level_percent || 100) < 25) {
          data.maintenance.alerts.push('LOW_FUEL');
        }
        if ((rawData.engine?.temperature_c || 75) > 95) {
          data.maintenance.alerts.push('HIGH_ENGINE_TEMP');
        }
        if ((rawData.tires?.average_pressure_psi || 35) < 30) {
          data.maintenance.alerts.push('LOW_TIRE_PRESSURE');
        }
        if ((rawData.crew?.driver_fatigue_percent || 0) > 60) {
          data.maintenance.alerts.push('DRIVER_FATIGUE');
        }
        
        setPrevMetrics(metrics);
        setMetrics(data);
        setUpdateCount(c => c + 1);
        
        // Generate extended metrics from physics data
        const extData = generateExtendedMetrics(data, metrics);
        
        // Override with real physics values from API
        if (rawData.tires) {
          extData.brakes.front_temp_c = rawData.brakes?.temperatures_c?.[0] || 100;
          extData.brakes.rear_temp_c = rawData.brakes?.temperatures_c?.[2] || 90;
          extData.brakes.pad_wear_percent = rawData.brakes?.wear_percent?.[0] || 10;
          extData.brakes.abs_active = rawData.brakes?.abs_active || false;
        }
        if (rawData.transmission) {
          extData.transmission.gear = rawData.transmission?.current_gear || 1;
        }
        if (rawData.engine) {
          extData.transmission.torque_nm = rawData.engine?.torque_nm || 0;
        }
        if (rawData.electrical) {
          extData.battery.voltage = rawData.electrical?.battery_voltage || 24;
          extData.battery.soc_percent = rawData.electrical?.battery_soc_percent || 100;
          extData.alternator.output_v = rawData.electrical?.battery_voltage || 24;
        }
        if (rawData.signatures) {
          extData.thermalSignature = rawData.signatures?.thermal === 'HIGH' ? 0.9 : rawData.signatures?.thermal === 'MEDIUM' ? 0.5 : 0.2;
          extData.acousticSignature = (rawData.signatures?.acoustic_db || 60) / 100;
        }
        if (rawData.crew) {
          extData.crew.fatigue_hours = (rawData.crew?.driver_fatigue_percent || 0) / 10;
          extData.crew.alertness = 1 - (rawData.crew?.driver_fatigue_percent || 0) / 100;
        }
        if (rawData.ai_analysis) {
          extData.armor.threat_direction = rawData.ai_analysis?.threat_level === 'CHARLIE' || rawData.ai_analysis?.threat_level === 'DELTA' ? 'N' : null;
        }
        
        setExtended(extData);

        const newSpeed = data.position?.speed_kmh || 0;
        setHistory(prev => ({
          speed: [...prev.speed, newSpeed].slice(-60),
          fuel: [...prev.fuel, data.fuel?.level_percent || 0].slice(-60),
          temp: [...prev.temp, data.engine?.temperature_c || 0].slice(-60),
          rpm: [...prev.rpm, data.engine?.rpm || 0].slice(-60),
          throttle: [...prev.throttle, data.engine?.throttle_percent || 0].slice(-60),
          torque: [...prev.torque, extData.transmission.torque_nm].slice(-60),
          gforce: [...prev.gforce, (newSpeed - lastSpeed) / 10].slice(-60)
        }));
        setLastSpeed(newSpeed);
        
        // Generate local AI analysis using physics data (fast, always available)
        generateAIAnalysisFromPhysics(data, rawData);
        
        // Also call Janus AI for deep analysis (throttled to every 10 seconds)
        fetchJanusAnalysis(rawData, { operation_zone: data.operational?.terrain || 'GENERAL' });
        
        updateTcpsFromDb(newSpeed);
      } else if (response.status === 404) {
        await initializeVehicleFromDb();
      }
    } catch (err) {
      console.error('Metrics fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [vehicleId, metrics, generateExtendedMetrics, lastSpeed, initializeVehicleFromDb, updateTcpsFromDb, fetchJanusAnalysis]);
  
  // Generate AI analysis from physics-based data
  const generateAIAnalysisFromPhysics = (data: MetricsData, rawData: any) => {
    const alerts: Array<{ severity: string; message: string; timestamp: string }> = [];
    let threatScore = 0;
    const fuelPercent = data.fuel?.level_percent || 0;
    const engineTemp = data.engine?.temperature_c || 0;
    const speed = data.position?.speed_kmh || 0;
    const breakdownProb = (rawData.ai_analysis?.breakdown_probability || 0) * 100;
    const driverFatigue = rawData.crew?.driver_fatigue_percent || 0;
    const backendThreat = rawData.ai_analysis?.threat_level || 'BRAVO';
    
    // Use backend AI analysis if available
    if (rawData.ai_analysis?.recommendation) {
      alerts.push({ severity: 'info', message: rawData.ai_analysis.recommendation, timestamp: new Date().toISOString() });
    }
    
    if (fuelPercent < 25) { alerts.push({ severity: 'critical', message: `FUEL CRITICAL: ${fuelPercent.toFixed(1)}%`, timestamp: new Date().toISOString() }); threatScore += 30; }
    else if (fuelPercent < 40) { alerts.push({ severity: 'warning', message: `Low fuel: ${fuelPercent.toFixed(1)}%`, timestamp: new Date().toISOString() }); threatScore += 15; }
    
    if (engineTemp > 105) { alerts.push({ severity: 'critical', message: `ENGINE OVERHEAT: ${engineTemp.toFixed(0)}°C`, timestamp: new Date().toISOString() }); threatScore += 25; }
    else if (engineTemp > 95) { alerts.push({ severity: 'warning', message: `Engine temp elevated: ${engineTemp.toFixed(0)}°C`, timestamp: new Date().toISOString() }); threatScore += 10; }
    
    if (driverFatigue > 70) { alerts.push({ severity: 'critical', message: `DRIVER FATIGUE: ${driverFatigue.toFixed(0)}%`, timestamp: new Date().toISOString() }); threatScore += 20; }
    else if (driverFatigue > 50) { alerts.push({ severity: 'warning', message: `Driver fatigue: ${driverFatigue.toFixed(0)}%`, timestamp: new Date().toISOString() }); threatScore += 10; }
    
    if (breakdownProb > 15) { alerts.push({ severity: 'warning', message: `Mechanical risk: ${breakdownProb.toFixed(1)}%`, timestamp: new Date().toISOString() }); threatScore += 15; }
    
    // Use backend threat level if available, else calculate
    let threatLevel: 'ALPHA' | 'BRAVO' | 'CHARLIE' | 'DELTA' = backendThreat as any;
    if (!['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA'].includes(backendThreat)) {
      if (threatScore >= 60) threatLevel = 'DELTA';
      else if (threatScore >= 40) threatLevel = 'CHARLIE';
      else if (threatScore >= 20) threatLevel = 'BRAVO';
      else threatLevel = 'ALPHA';
    }
    
    const rangeKm = rawData.fuel?.range_remaining_km || 0;
    const etaHours = rangeKm / Math.max(speed, 30);
    const fuelAtDestination = Math.max(0, fuelPercent - (etaHours * (data.fuel?.consumption_lph || 15) * 100 / 300));
    
    let tacticalAdvice = 'All systems nominal. Continue mission.';
    if (threatLevel === 'DELTA') tacticalAdvice = '⚠️ CONDITION RED: Immediate attention required.';
    else if (threatLevel === 'CHARLIE') tacticalAdvice = '⚡ CONDITION AMBER: Multiple parameters need monitoring.';
    else if (threatLevel === 'BRAVO') tacticalAdvice = '📡 CONDITION YELLOW: Minor concerns detected.';
    
    setAiAnalysis({
      threatLevel, missionStatus: threatLevel,
      predictions: { 
        eta: `${Math.floor(etaHours)}h ${Math.round((etaHours % 1) * 60)}m`, 
        fuelAtDestination: Math.round(fuelAtDestination), 
        weatherImpact: rawData.environment?.precipitation_mm_hr > 5 ? 'SIGNIFICANT' : 'MINIMAL', 
        threatProbability: Math.min(95, threatScore + 5), 
        maintenanceRisk: breakdownProb > 10 ? 'ELEVATED' : 'LOW', 
        routeEfficiency: Math.round((rawData.fuel?.efficiency_kpl || 3) / 5 * 100)
      },
      alerts, 
      recommendations: [
        rangeKm < 50 ? 'Plan refueling stop' : 'Fuel reserves adequate',
        driverFatigue > 40 ? 'Consider rest break' : 'Driver alert',
      ], 
      tacticalAdvice
    });
  };
  
  const generateAIAnalysis = (data: MetricsData) => {
    const alerts: Array<{ severity: string; message: string; timestamp: string }> = [];
    let threatScore = 0;
    const fuelPercent = data.fuel?.level_percent || 0;
    const engineTemp = data.engine?.temperature_c || 0;
    const speed = data.position?.speed_kmh || 0;
    const breakdownProb = (data.maintenance?.breakdown_probability || 0) * 100;
    
    if (fuelPercent < 25) { alerts.push({ severity: 'critical', message: 'FUEL CRITICAL', timestamp: new Date().toISOString() }); threatScore += 30; }
    else if (fuelPercent < 40) { alerts.push({ severity: 'warning', message: 'Low fuel', timestamp: new Date().toISOString() }); threatScore += 15; }
    if (engineTemp > 105) { alerts.push({ severity: 'critical', message: 'ENGINE OVERHEAT', timestamp: new Date().toISOString() }); threatScore += 25; }
    else if (engineTemp > 95) { alerts.push({ severity: 'warning', message: 'Engine temp elevated', timestamp: new Date().toISOString() }); threatScore += 10; }
    if (speed > 70) { alerts.push({ severity: 'warning', message: 'Speed exceeds limit', timestamp: new Date().toISOString() }); threatScore += 5; }
    if (data.communications?.is_jammed) { alerts.push({ severity: 'critical', message: 'JAMMING DETECTED', timestamp: new Date().toISOString() }); threatScore += 40; }
    if (breakdownProb > 10) { alerts.push({ severity: 'warning', message: 'Mechanical risk', timestamp: new Date().toISOString() }); threatScore += 15; }
    
    let threatLevel: 'ALPHA' | 'BRAVO' | 'CHARLIE' | 'DELTA' = 'ALPHA';
    if (threatScore >= 60) threatLevel = 'DELTA';
    else if (threatScore >= 40) threatLevel = 'CHARLIE';
    else if (threatScore >= 20) threatLevel = 'BRAVO';
    
    const etaHours = 105 / (speed || 45);
    const fuelAtDestination = Math.max(0, fuelPercent - (etaHours * (data.fuel?.consumption_lph || 15) * 100 / 300));
    
    let tacticalAdvice = 'All systems nominal.';
    if (threatLevel === 'DELTA') tacticalAdvice = '⚠️ CONDITION RED: Multiple warnings.';
    else if (threatLevel === 'CHARLIE') tacticalAdvice = '⚡ CONDITION AMBER: Elevated risk.';
    else if (threatLevel === 'BRAVO') tacticalAdvice = '📡 CONDITION YELLOW: Monitor closely.';
    
    setAiAnalysis({
      threatLevel, missionStatus: threatLevel,
      predictions: { eta: `${Math.floor(etaHours)}h ${Math.round((etaHours % 1) * 60)}m`, fuelAtDestination: Math.round(fuelAtDestination), weatherImpact: 'MINIMAL', threatProbability: Math.min(95, threatScore + 5), maintenanceRisk: breakdownProb > 10 ? 'ELEVATED' : 'LOW', routeEfficiency: Math.round((data.engine?.efficiency || 0.85) * 100) },
      alerts, recommendations: ['Maintain parameters', 'Continue mission'], tacticalAdvice
    });
  };
  
  useEffect(() => {
    if (vehicleId) { setLoading(true); setHistory({ speed: [], fuel: [], temp: [], rpm: [], throttle: [], torque: [], gforce: [] }); fetchMetrics(); }
  }, [vehicleId]);
  
  useEffect(() => {
    if (!vehicleId) return;
    let cancelled = false;
    const tick = async () => {
      await fetchMetrics();
      if (!cancelled) {
        setTimeout(tick, getUpdateInterval());
      }
    };
    tick();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);
  
  if (!vehicleId) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: `linear-gradient(180deg, ${MILITARY_COLORS.background} 0%, rgba(13, 27, 13, 0.95) 100%)` }}>
        <div className="text-center p-8">
          <div className="text-6xl mb-4">🎖️</div>
          <div className="text-xl font-bold mb-2" style={{ color: MILITARY_COLORS.accent }}>TACTICAL COMMAND</div>
          <div className="text-sm" style={{ color: MILITARY_COLORS.muted }}>Select a vehicle</div>
        </div>
      </div>
    );
  }
  
  if (loading && !metrics) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: `linear-gradient(180deg, ${MILITARY_COLORS.background} 0%, rgba(13, 27, 13, 0.95) 100%)` }}>
        <div className="text-center">
          <div className="text-4xl mb-4 animate-spin">⚙️</div>
          <div className="font-bold" style={{ color: MILITARY_COLORS.accent }}>ESTABLISHING UPLINK...</div>
        </div>
      </div>
    );
  }
  
  const threatColors = { ALPHA: MILITARY_COLORS.success, BRAVO: MILITARY_COLORS.info, CHARLIE: MILITARY_COLORS.warning, DELTA: MILITARY_COLORS.alert };
  const speed = metrics?.position?.speed_kmh || 0;
  const prevSpeed = prevMetrics?.position?.speed_kmh || speed;
  
  return (
    <div className="flex-1 overflow-y-auto" style={{ background: `linear-gradient(180deg, ${MILITARY_COLORS.background} 0%, rgba(13, 27, 13, 0.98) 100%)`, fontFamily: "'Courier New', monospace" }}>
      {/* HEADER */}
      <div className="sticky top-0 z-10 p-2 border-b" style={{ background: `linear-gradient(180deg, ${MILITARY_COLORS.panel} 0%, rgba(26, 71, 42, 0.95) 100%)`, borderColor: MILITARY_COLORS.border }}>
        <div className="flex items-center justify-between mb-1 text-[9px]" style={{ color: MILITARY_COLORS.muted }}>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />LIVE</span>
          <span className="font-mono">{currentTime.toLocaleTimeString('en-GB', { hour12: false })}.{String(currentTime.getMilliseconds()).padStart(3, '0').slice(0, 2)}</span>
          <span className="text-green-400">{getUpdateInterval()}ms</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded flex items-center justify-center text-xl" style={{ background: `linear-gradient(135deg, ${MILITARY_COLORS.primary} 0%, ${MILITARY_COLORS.secondary} 100%)`, border: `2px solid ${MILITARY_COLORS.accent}` }}>🚛</div>
            <div>
              <div className="font-bold text-sm" style={{ color: MILITARY_COLORS.text }}>{vehicleName || `UNIT-${vehicleId}`}</div>
              <div className="text-[9px]" style={{ color: MILITARY_COLORS.muted }}>{metrics?.vehicle_type} • {metrics?.operational?.terrain}</div>
            </div>
          </div>
          {aiAnalysis && (
            <div className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1.5 ${aiAnalysis.threatLevel === 'DELTA' ? 'animate-pulse' : ''}`} style={{ background: threatColors[aiAnalysis.threatLevel] + '30', border: `1px solid ${threatColors[aiAnalysis.threatLevel]}`, color: threatColors[aiAnalysis.threatLevel] }}>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: threatColors[aiAnalysis.threatLevel] }} />{aiAnalysis.threatLevel}
            </div>
          )}
        </div>
      </div>
      
      <div className="p-2 space-y-2">
        {/* AI ANALYSIS */}
        {aiAnalysis && (
          <div className="rounded-lg p-2 border" style={{ background: 'rgba(70, 130, 180, 0.1)', borderColor: MILITARY_COLORS.info }}>
            <div className="flex items-center gap-2 mb-2"><span>🤖</span><span className="text-[9px] font-bold uppercase" style={{ color: MILITARY_COLORS.info }}>AI ANALYSIS</span></div>
            <div className="p-1.5 rounded mb-2" style={{ background: 'rgba(0,0,0,0.3)' }}><div className="text-[10px]" style={{ color: MILITARY_COLORS.text }}>{aiAnalysis.tacticalAdvice}</div></div>
            <div className="grid grid-cols-4 gap-1 mb-2">
              <MiniMetric label="ETA" value={aiAnalysis.predictions.eta} color={MILITARY_COLORS.accent} />
              <MiniMetric label="FUEL@DEST" value={`${aiAnalysis.predictions.fuelAtDestination}%`} color={aiAnalysis.predictions.fuelAtDestination < 20 ? MILITARY_COLORS.alert : MILITARY_COLORS.success} />
              <MiniMetric label="ROUTE" value={`${aiAnalysis.predictions.routeEfficiency}%`} color={MILITARY_COLORS.info} />
              <MiniMetric label="THREAT" value={`${aiAnalysis.predictions.threatProbability}%`} color={aiAnalysis.predictions.threatProbability > 30 ? MILITARY_COLORS.warning : MILITARY_COLORS.success} />
            </div>
            {aiAnalysis.alerts.slice(0, 3).map((alert, i) => <TacticalAlert key={i} severity={alert.severity as 'info' | 'warning' | 'critical'} message={alert.message} />)}
          </div>
        )}
        
        {/* JANUS PRO 7B DEEP AI RECOMMENDATIONS */}
        <div className="rounded-lg p-2 border" style={{ background: 'linear-gradient(135deg, rgba(138, 43, 226, 0.15) 0%, rgba(75, 0, 130, 0.2) 100%)', borderColor: MILITARY_COLORS.magenta }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span>🧠</span>
              <span className="text-[9px] font-bold uppercase" style={{ color: MILITARY_COLORS.magenta }}>JANUS PRO 7B AI</span>
              {janusLoading && <span className="animate-spin text-[10px]">⚙️</span>}
            </div>
            {janusAnalysis && (
              <div className="flex items-center gap-2 text-[8px]" style={{ color: MILITARY_COLORS.muted }}>
                <span className={janusAnalysis.gpu_accelerated ? 'text-green-400' : 'text-gray-400'}>
                  {janusAnalysis.gpu_accelerated ? '🟢 GPU' : '🟡 CPU'}
                </span>
                <span style={{ color: MILITARY_COLORS.cyan }}>{janusAnalysis.model}</span>
                <span>{Math.round(janusAnalysis.confidence * 100)}% conf</span>
              </div>
            )}
          </div>
          
          {/* Threat Assessment */}
          {janusAnalysis?.threat_assessment && (
            <div className="mb-2 p-1.5 rounded" style={{ 
              background: janusAnalysis.threat_assessment.threat_level === 'CRITICAL' ? 'rgba(255,0,0,0.2)' :
                         janusAnalysis.threat_assessment.threat_level === 'HIGH' ? 'rgba(255,165,0,0.2)' :
                         janusAnalysis.threat_assessment.threat_level === 'MEDIUM' ? 'rgba(255,255,0,0.15)' : 'rgba(0,255,0,0.1)',
              border: `1px solid ${janusAnalysis.threat_assessment.threat_level === 'CRITICAL' ? MILITARY_COLORS.alert : 
                                   janusAnalysis.threat_assessment.threat_level === 'HIGH' ? MILITARY_COLORS.warning : MILITARY_COLORS.success}`
            }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-bold" style={{ 
                  color: janusAnalysis.threat_assessment.threat_level === 'CRITICAL' ? MILITARY_COLORS.alert :
                         janusAnalysis.threat_assessment.threat_level === 'HIGH' ? MILITARY_COLORS.warning : MILITARY_COLORS.success
                }}>
                  ⚠️ THREAT: {janusAnalysis.threat_assessment.threat_level}
                </span>
                <span className="text-[8px]" style={{ color: MILITARY_COLORS.muted }}>
                  Score: {janusAnalysis.threat_assessment.threat_score}/100
                </span>
              </div>
              {janusAnalysis.threat_assessment.factors.slice(0, 3).map((factor, i) => (
                <div key={i} className="text-[9px] pl-2" style={{ color: MILITARY_COLORS.text }}>• {factor}</div>
              ))}
            </div>
          )}
          
          {/* AI Recommendations */}
          {janusAnalysis?.recommendations && janusAnalysis.recommendations.length > 0 ? (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {janusAnalysis.recommendations.slice(0, 5).map((rec, i) => (
                <div key={i} className="text-[9px] p-1.5 rounded flex items-start gap-1.5" style={{ 
                  background: rec.priority === 'CRITICAL' ? 'rgba(255,0,0,0.15)' :
                             rec.priority === 'HIGH' ? 'rgba(255,165,0,0.15)' :
                             rec.priority === 'TACTICAL' ? 'rgba(138,43,226,0.15)' : 'rgba(0,255,0,0.1)',
                  borderLeft: `2px solid ${rec.priority === 'CRITICAL' ? MILITARY_COLORS.alert :
                                          rec.priority === 'HIGH' ? MILITARY_COLORS.warning :
                                          rec.priority === 'TACTICAL' ? MILITARY_COLORS.magenta : MILITARY_COLORS.success}`
                }}>
                  <span className="text-[8px] font-bold whitespace-nowrap" style={{
                    color: rec.priority === 'CRITICAL' ? MILITARY_COLORS.alert :
                           rec.priority === 'HIGH' ? MILITARY_COLORS.warning :
                           rec.priority === 'TACTICAL' ? MILITARY_COLORS.magenta : MILITARY_COLORS.success
                  }}>
                    {rec.priority}
                  </span>
                  <span style={{ color: MILITARY_COLORS.text }}>{rec.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-center p-2" style={{ color: MILITARY_COLORS.muted }}>
              {janusLoading ? 'Analyzing telemetry with JANUS PRO 7B...' : 'Waiting for vehicle data...'}
            </div>
          )}
          
          {/* AI Analysis Source */}
          {janusAnalysis && (
            <div className="mt-2 pt-1 border-t text-[8px] flex justify-between" style={{ borderColor: 'rgba(255,255,255,0.1)', color: MILITARY_COLORS.muted }}>
              <span>Generated by: {janusAnalysis.generated_by}</span>
              <span>{new Date(janusAnalysis.timestamp).toLocaleTimeString()}</span>
            </div>
          )}
        </div>
        
        {/* PRIMARY GAUGES */}
        <div className="rounded-lg p-2 border" style={{ background: MILITARY_COLORS.panel, borderColor: MILITARY_COLORS.border }}>
          <div className="flex items-center gap-2 mb-1"><span>⚡</span><span className="text-[9px] font-bold uppercase" style={{ color: MILITARY_COLORS.accent }}>TELEMETRY</span><span className="text-[8px] ml-auto" style={{ color: MILITARY_COLORS.neon }}>◉ {updateCount}</span></div>
          <div className="grid grid-cols-5 gap-0.5">
            <HFGauge value={speed} max={120} label="SPD" unit="km/h" icon="🏎️" prevValue={prevSpeed} />
            <HFGauge value={metrics?.engine?.rpm || 0} max={5000} label="RPM" unit="" icon="⚙️" prevValue={prevMetrics?.engine?.rpm} status={(metrics?.engine?.rpm || 0) > 4000 ? 'warning' : 'normal'} />
            <HFGauge value={metrics?.engine?.temperature_c || 0} max={150} label="ENG" unit="°C" icon="🌡️" prevValue={prevMetrics?.engine?.temperature_c} status={(metrics?.engine?.temperature_c || 0) > 100 ? 'critical' : (metrics?.engine?.temperature_c || 0) > 90 ? 'warning' : 'normal'} />
            <HFGauge value={metrics?.fuel?.level_percent || 0} max={100} label="FUEL" unit="%" icon="⛽" prevValue={prevMetrics?.fuel?.level_percent} status={(metrics?.fuel?.level_percent || 0) < 25 ? 'critical' : (metrics?.fuel?.level_percent || 0) < 40 ? 'warning' : 'normal'} />
            <HFGauge value={metrics?.engine?.throttle_percent || 0} max={100} label="THR" unit="%" icon="🎚️" prevValue={prevMetrics?.engine?.throttle_percent} />
          </div>
        </div>
        
        {/* DRIVETRAIN */}
        {extended && (
          <div className="rounded-lg p-2 border" style={{ background: MILITARY_COLORS.panel, borderColor: MILITARY_COLORS.border }}>
            <div className="flex items-center gap-2 mb-2"><span>🔧</span><span className="text-[9px] font-bold uppercase" style={{ color: MILITARY_COLORS.accent }}>DRIVETRAIN</span></div>
            <div className="grid grid-cols-6 gap-1 mb-2">
              <MiniMetric label="GEAR" value={extended.transmission.gear} color={MILITARY_COLORS.cyan} />
              <MiniMetric label="TORQUE" value={extended.transmission.torque_nm} unit="Nm" color={MILITARY_COLORS.warning} />
              <MiniMetric label="FR BRK" value={`${extended.brakes.front_temp_c}°`} color={extended.brakes.front_temp_c > 200 ? MILITARY_COLORS.alert : MILITARY_COLORS.success} flash={extended.brakes.front_temp_c > 200} />
              <MiniMetric label="RR BRK" value={`${extended.brakes.rear_temp_c}°`} color={extended.brakes.rear_temp_c > 180 ? MILITARY_COLORS.alert : MILITARY_COLORS.success} />
              <MiniMetric label="SUSP" value={extended.suspension.travel_mm.toFixed(0)} unit="mm" color={MILITARY_COLORS.info} />
              <MiniMetric label="ABS" value={extended.brakes.abs_active ? 'ON' : 'OFF'} color={extended.brakes.abs_active ? MILITARY_COLORS.warning : MILITARY_COLORS.muted} flash={extended.brakes.abs_active} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><div className="text-[8px] mb-1" style={{ color: MILITARY_COLORS.muted }}>TORQUE</div><RTSparkline data={history.torque.length > 2 ? history.torque : [200, 220, 210]} color={MILITARY_COLORS.warning} height={22} /></div>
              <div><div className="text-[8px] mb-1" style={{ color: MILITARY_COLORS.muted }}>THROTTLE</div><RTSparkline data={history.throttle.length > 2 ? history.throttle : [30, 35, 32]} color={MILITARY_COLORS.cyan} height={22} /></div>
            </div>
          </div>
        )}
        
        {/* COMBAT SYSTEMS */}
        {extended && (
          <div className="rounded-lg p-2 border" style={{ background: 'rgba(139, 0, 0, 0.15)', borderColor: MILITARY_COLORS.alert }}>
            <div className="flex items-center gap-2 mb-2"><span>🛡️</span><span className="text-[9px] font-bold uppercase" style={{ color: MILITARY_COLORS.alert }}>DEFENSIVE</span></div>
            <div className="grid grid-cols-5 gap-1 mb-2">
              <MiniMetric label="ARMOR" value={`${extended.armor.integrity_percent.toFixed(0)}%`} color={MILITARY_COLORS.success} />
              <MiniMetric label="THERMAL" value={`${(extended.thermalSignature * 100).toFixed(0)}%`} color={extended.thermalSignature > 0.6 ? MILITARY_COLORS.warning : MILITARY_COLORS.success} />
              <MiniMetric label="ACOUSTIC" value={`${(extended.acousticSignature * 100).toFixed(0)}%`} color={extended.acousticSignature > 0.5 ? MILITARY_COLORS.warning : MILITARY_COLORS.success} />
              <MiniMetric label="RCS" value={extended.radarCrossSection.toFixed(1)} unit="m²" color={MILITARY_COLORS.info} />
              <MiniMetric label="JAM" value={extended.countermeasures.jammer_active ? 'ON' : 'OFF'} color={extended.countermeasures.jammer_active ? MILITARY_COLORS.magenta : MILITARY_COLORS.muted} flash={extended.countermeasures.jammer_active} />
            </div>
            <div className="flex gap-2 text-[9px]">
              <span style={{ color: MILITARY_COLORS.muted }}>CM:</span>
              <span style={{ color: MILITARY_COLORS.warning }}>SMOKE: {extended.countermeasures.smoke_charges}</span>
              <span style={{ color: MILITARY_COLORS.alert }}>FLARES: {extended.countermeasures.flares}</span>
              {extended.armor.threat_direction && <span className="animate-pulse" style={{ color: MILITARY_COLORS.alert }}>⚠ {extended.armor.threat_direction}</span>}
            </div>
          </div>
        )}
        
        {/* POWER */}
        {extended && (
          <div className="rounded-lg p-2 border" style={{ background: MILITARY_COLORS.panel, borderColor: MILITARY_COLORS.border }}>
            <div className="flex items-center gap-2 mb-2"><span>🔋</span><span className="text-[9px] font-bold uppercase" style={{ color: MILITARY_COLORS.accent }}>POWER</span></div>
            <div className="grid grid-cols-6 gap-1">
              <MiniMetric label="BAT V" value={extended.battery.voltage.toFixed(1)} unit="V" color={MILITARY_COLORS.success} />
              <MiniMetric label="BAT A" value={extended.battery.current_a.toFixed(1)} unit="A" color={MILITARY_COLORS.warning} />
              <MiniMetric label="SOC" value={`${extended.battery.soc_percent.toFixed(0)}%`} color={extended.battery.soc_percent < 30 ? MILITARY_COLORS.alert : MILITARY_COLORS.success} />
              <MiniMetric label="ALT" value={extended.alternator.output_v.toFixed(1)} unit="V" color={MILITARY_COLORS.info} />
              <MiniMetric label="LOAD" value={`${extended.alternator.load_percent.toFixed(0)}%`} color={extended.alternator.load_percent > 80 ? MILITARY_COLORS.warning : MILITARY_COLORS.success} />
              <MiniMetric label="TEMP" value={`${extended.battery.temp_c.toFixed(0)}°`} color={extended.battery.temp_c > 45 ? MILITARY_COLORS.warning : MILITARY_COLORS.success} />
            </div>
          </div>
        )}
        
        {/* NAVIGATION */}
        {extended && (
          <div className="rounded-lg p-2 border" style={{ background: MILITARY_COLORS.panel, borderColor: MILITARY_COLORS.border }}>
            <div className="flex items-center gap-2 mb-2"><span>🛰️</span><span className="text-[9px] font-bold uppercase" style={{ color: MILITARY_COLORS.accent }}>NAV & MISSION</span></div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="p-1.5 rounded" style={{ background: 'rgba(0,0,0,0.3)' }}>
                <div className="text-[8px]" style={{ color: MILITARY_COLORS.muted }}>POSITION</div>
                <div className="text-[10px] font-mono" style={{ color: MILITARY_COLORS.success }}>{(metrics?.position?.lat || 0).toFixed(5)}°N, {(metrics?.position?.lng || 0).toFixed(5)}°E</div>
                <div className="text-[9px] font-mono" style={{ color: MILITARY_COLORS.info }}>ALT: {(metrics?.position?.altitude_m || 0).toFixed(0)}m | HDG: {(metrics?.position?.bearing_degrees || 0).toFixed(0)}°</div>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <MiniMetric label="WPT" value={extended.waypointDistance.toFixed(1)} unit="km" color={MILITARY_COLORS.accent} />
                <MiniMetric label="HDG ERR" value={`${extended.headingError.toFixed(1)}°`} color={Math.abs(extended.headingError) > 2 ? MILITARY_COLORS.warning : MILITARY_COLORS.success} />
                <MiniMetric label="XTE" value={`${extended.crossTrackError.toFixed(1)}m`} color={Math.abs(extended.crossTrackError) > 1 ? MILITARY_COLORS.warning : MILITARY_COLORS.success} />
                <MiniMetric label="TOT" value={extended.timeOnTarget} color={MILITARY_COLORS.info} />
              </div>
            </div>
            <div className="mb-1"><div className="flex justify-between text-[8px] mb-0.5" style={{ color: MILITARY_COLORS.muted }}><span>MISSION</span><span>{extended.missionProgress.toFixed(1)}%</span></div><div className="h-1.5 rounded overflow-hidden" style={{ background: 'rgba(0,0,0,0.5)' }}><div className="h-full transition-all" style={{ width: `${extended.missionProgress}%`, background: `linear-gradient(90deg, ${MILITARY_COLORS.success}, ${MILITARY_COLORS.accent})` }} /></div></div>
          </div>
        )}
        
        {/* CREW */}
        {extended && (
          <div className="rounded-lg p-2 border" style={{ background: MILITARY_COLORS.panel, borderColor: MILITARY_COLORS.border }}>
            <div className="flex items-center gap-2 mb-2"><span>👥</span><span className="text-[9px] font-bold uppercase" style={{ color: MILITARY_COLORS.accent }}>CREW</span></div>
            <div className="grid grid-cols-3 gap-1">
              <MiniMetric label="ALERT" value={`${(extended.crew.alertness * 100).toFixed(0)}%`} color={extended.crew.alertness < 0.7 ? MILITARY_COLORS.warning : MILITARY_COLORS.success} />
              <MiniMetric label="FATIGUE" value={`${extended.crew.fatigue_hours.toFixed(1)}h`} color={extended.crew.fatigue_hours > 4 ? MILITARY_COLORS.warning : MILITARY_COLORS.success} />
              <MiniMetric label="MORALE" value={`${(extended.crew.morale * 100).toFixed(0)}%`} color={extended.crew.morale < 0.6 ? MILITARY_COLORS.warning : MILITARY_COLORS.success} />
            </div>
          </div>
        )}
        
        {/* TCPs */}
        <div className="rounded-lg p-2 border" style={{ background: MILITARY_COLORS.panel, borderColor: MILITARY_COLORS.border }}>
          <div className="flex items-center gap-2 mb-2"><span>🗺️</span><span className="text-[9px] font-bold uppercase" style={{ color: MILITARY_COLORS.accent }}>ROUTE & TCPs</span></div>
          <div className="flex items-center gap-2 mb-2 p-1.5 rounded" style={{ background: 'rgba(0,0,0,0.3)' }}>
            <div className="text-center flex-1"><div className="text-[8px]" style={{ color: MILITARY_COLORS.muted }}>ORIGIN</div><div className="text-[10px] font-bold" style={{ color: MILITARY_COLORS.success }}>BASE ALPHA</div></div>
            <div className="flex items-center gap-0.5"><div className="w-6 h-0.5" style={{ background: MILITARY_COLORS.accent }} /><span style={{ color: MILITARY_COLORS.accent }}>▶</span><div className="w-6 h-0.5" style={{ background: MILITARY_COLORS.accent }} /></div>
            <div className="text-center flex-1"><div className="text-[8px]" style={{ color: MILITARY_COLORS.muted }}>DEST</div><div className="text-[10px] font-bold" style={{ color: MILITARY_COLORS.alert }}>FWD CMD</div></div>
          </div>
          <div className="mb-2"><div className="flex justify-between text-[8px] mb-0.5" style={{ color: MILITARY_COLORS.muted }}><span>PROGRESS</span><span>{extended ? extended.objectiveDistance.toFixed(1) : 105}km</span></div><div className="h-1.5 rounded overflow-hidden" style={{ background: 'rgba(0,0,0,0.5)' }}><div className="h-full transition-all" style={{ width: `${extended ? extended.missionProgress : 8}%`, background: `linear-gradient(90deg, ${MILITARY_COLORS.success}, ${MILITARY_COLORS.accent})` }} /></div></div>
          <div className="space-y-1">{tcps.slice(0, 4).map((tcp, i) => <TCPMarker key={tcp.id} tcp={tcp} isNext={i === 0} />)}</div>
        </div>
        
        {/* CHARTS */}
        <div className="rounded-lg p-2 border" style={{ background: MILITARY_COLORS.panel, borderColor: MILITARY_COLORS.border }}>
          <div className="flex items-center gap-2 mb-2"><span>📈</span><span className="text-[9px] font-bold uppercase" style={{ color: MILITARY_COLORS.accent }}>TRENDS</span></div>
          <div className="space-y-2">
            <div><div className="flex justify-between text-[8px] mb-0.5"><span style={{ color: MILITARY_COLORS.muted }}>SPEED</span><AnimatedValue value={speed} prevValue={prevSpeed} format={(v) => `${v.toFixed(1)} km/h`} color={MILITARY_COLORS.success} size="sm" /></div><RTSparkline data={history.speed.length > 2 ? history.speed : [40, 42, 38]} color={MILITARY_COLORS.success} /></div>
            <div><div className="flex justify-between text-[8px] mb-0.5"><span style={{ color: MILITARY_COLORS.muted }}>RPM</span><AnimatedValue value={metrics?.engine?.rpm || 0} prevValue={prevMetrics?.engine?.rpm || 0} format={(v) => v.toFixed(0)} color={MILITARY_COLORS.cyan} size="sm" /></div><RTSparkline data={history.rpm.length > 2 ? history.rpm : [2000, 2100, 1950]} color={MILITARY_COLORS.cyan} /></div>
            <div><div className="flex justify-between text-[8px] mb-0.5"><span style={{ color: MILITARY_COLORS.muted }}>FUEL</span><AnimatedValue value={metrics?.fuel?.level_percent || 0} prevValue={prevMetrics?.fuel?.level_percent || 0} format={(v) => `${v.toFixed(0)}%`} color={MILITARY_COLORS.warning} size="sm" /></div><RTSparkline data={history.fuel.length > 2 ? history.fuel : [86, 85.9, 85.8]} color={MILITARY_COLORS.warning} /></div>
            <div><div className="flex justify-between text-[8px] mb-0.5"><span style={{ color: MILITARY_COLORS.muted }}>TEMP</span><AnimatedValue value={metrics?.engine?.temperature_c || 0} prevValue={prevMetrics?.engine?.temperature_c || 0} format={(v) => `${v.toFixed(0)}°C`} color={(metrics?.engine?.temperature_c || 0) > 95 ? MILITARY_COLORS.alert : MILITARY_COLORS.info} size="sm" /></div><RTSparkline data={history.temp.length > 2 ? history.temp : [92, 93, 91]} color={(metrics?.engine?.temperature_c || 0) > 95 ? MILITARY_COLORS.alert : MILITARY_COLORS.info} /></div>
          </div>
        </div>
        
        {/* COMMS */}
        <div className="rounded-lg p-2 border" style={{ background: MILITARY_COLORS.panel, borderColor: MILITARY_COLORS.border }}>
          <div className="flex items-center gap-2 mb-2"><span>📡</span><span className="text-[9px] font-bold uppercase" style={{ color: MILITARY_COLORS.accent }}>COMMS</span></div>
          <div className="grid grid-cols-4 gap-1">
            <MiniMetric label="RADIO" value={`${((metrics?.communications?.radio_strength || 0) * 100).toFixed(0)}%`} color={MILITARY_COLORS.success} />
            <MiniMetric label="ENCRYPT" value={metrics?.communications?.encryption || 'AES-256'} color={MILITARY_COLORS.info} />
            <MiniMetric label="FREQ" value={(metrics?.communications?.frequency_mhz || 156.8).toFixed(1)} unit="MHz" color={MILITARY_COLORS.muted} />
            <MiniMetric label="LAT" value={(metrics?.communications?.latency_ms || 0).toFixed(0)} unit="ms" color={(metrics?.communications?.latency_ms || 0) > 100 ? MILITARY_COLORS.warning : MILITARY_COLORS.success} />
          </div>
          {metrics?.communications?.is_jammed && <div className="mt-2 p-1.5 rounded animate-pulse" style={{ background: 'rgba(139, 0, 0, 0.4)', border: `1px solid ${MILITARY_COLORS.alert}` }}><div className="text-[10px] font-bold text-center" style={{ color: MILITARY_COLORS.alert }}>⚠️ JAMMING</div></div>}
        </div>
        
        <div className="text-center py-1 text-[8px]" style={{ color: MILITARY_COLORS.muted }}>TACTICAL v3.0 • {getUpdateInterval()}ms • {updateCount} frames</div>
      </div>
    </div>
  );
}
