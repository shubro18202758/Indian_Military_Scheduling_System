"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';

// ============================================================================
// INDIAN ARMY TACTICAL METRICS HUD - ULTRA HIGH FREQUENCY
// Version: 4.0 - Military Grade Real-Time Telemetry System
// Optimized for: Kashmir, Ladakh, Siachen, and Naxal Corridor Operations
// ============================================================================

const API_V1 = '/api/proxy/v1';

// Military color scheme - Indian Army
const COLORS = {
  primary: '#1a472a',      // Deep military green
  secondary: '#2d5a3f',    // Forest green
  background: '#0a1f0a',   // Dark operations
  panel: 'rgba(26, 71, 42, 0.85)',
  border: 'rgba(196, 163, 90, 0.4)',
  accent: '#c4a35a',       // Brass/Gold
  text: '#e8e8e8',
  muted: '#7a8a7a',
  success: '#4ade80',      // Green
  warning: '#cd7f32',      // Bronze/Orange
  alert: '#dc2626',        // Red
  info: '#4682b4',         // Steel blue
  cyan: '#00d4ff',
  magenta: '#ff00ff',
  neon: '#00ff88',
  orange: '#ff8c00',
  critical: '#ff0000',
  ice: '#a5f3fc',          // For Siachen ops
  sand: '#d4a574',         // For desert ops
};

// Operation zones for Indian Army
type OperationZone = 'KASHMIR' | 'LADAKH' | 'SIACHEN' | 'NORTH_EAST' | 'NAXAL_CORRIDOR' | 'RAJASTHAN' | 'GENERAL';

interface ExtendedTelemetry {
  // Core Motion
  velocity_ms: number;
  velocity_kmh: number;
  acceleration_ms2: number;
  heading_deg: number;
  yaw_rate_dps: number;
  
  // Position
  latitude: number;
  longitude: number;
  altitude_m: number;
  gradient_deg: number;
  
  // Engine Dynamics
  engine_rpm: number;
  engine_temp_c: number;
  engine_load_pct: number;
  throttle_position: number;
  turbo_boost_psi: number;
  oil_pressure_psi: number;
  oil_temp_c: number;
  coolant_temp_c: number;
  exhaust_temp_c: number;
  
  // Transmission
  gear: number;
  torque_nm: number;
  clutch_slip_pct: number;
  transmission_temp_c: number;
  diff_temp_c: number;
  
  // Fuel System
  fuel_liters: number;
  fuel_percent: number;
  fuel_flow_lph: number;
  fuel_efficiency_kpl: number;
  range_remaining_km: number;
  fuel_temp_c: number;
  
  // Tires (4 wheels)
  tire_pressures_psi: number[];
  tire_temps_c: number[];
  tire_wear_pct: number[];
  tire_traction: number[];
  
  // Brakes
  brake_temps_c: number[];
  brake_wear_pct: number[];
  abs_active: boolean;
  brake_pressure_bar: number;
  
  // Suspension
  suspension_travel_mm: number[];
  damper_force_n: number[];
  ride_height_mm: number;
  
  // Electrical
  battery_voltage: number;
  battery_soc_pct: number;
  alternator_output_a: number;
  total_electrical_load_w: number;
  
  // Thermal & Signatures
  thermal_signature_level: string;
  acoustic_db: number;
  radar_cross_section_m2: number;
  ir_signature_level: string;
  
  // Crew Status
  driver_fatigue_pct: number;
  driver_stress_level: number;
  crew_alertness: number;
  
  // Combat Systems
  armor_integrity_pct: number;
  smoke_charges: number;
  flare_count: number;
  jammer_active: boolean;
  iff_status: string;
  
  // Environment
  ambient_temp_c: number;
  humidity_pct: number;
  wind_speed_ms: number;
  wind_direction_deg: number;
  visibility_m: number;
  precipitation_mm_hr: number;
  road_friction: number;
  
  // Indian Army Specific
  altitude_acclimatization_status: string;
  oxygen_level_cabin_pct: number;
  heater_status: string;
  de_icing_active: boolean;
  snow_chain_mounted: boolean;
  
  // Supply Status
  ration_days_remaining: number;
  water_liters: number;
  ammo_status_pct: number;
  medical_kit_status: string;
  
  // Communication
  radio_signal_strength_pct: number;
  satcom_active: boolean;
  encryption_status: string;
  network_latency_ms: number;
  
  // Convoy Formation
  inter_vehicle_distance_m: number;
  formation_integrity_pct: number;
  visual_contact_status: boolean;
  
  // AI Analysis
  threat_level: string;
  threat_direction: string | null;
  breakdown_probability: number;
  eta_minutes: number;
  fuel_at_destination_pct: number;
  route_risk_score: number;
  ai_recommendation: string;
}

interface AITacticalAnalysis {
  threatLevel: 'ALPHA' | 'BRAVO' | 'CHARLIE' | 'DELTA';
  operationZone: OperationZone;
  situationalAwareness: {
    ied_threat_probability: number;
    ambush_risk_sectors: string[];
    safe_sectors: string[];
    nearest_qrf_km: number;
    nearest_medical_km: number;
    artillery_coverage: boolean;
    air_support_eta_min: number;
  };
  predictions: {
    eta_destination: string;
    fuel_at_arrival_pct: number;
    breakdown_probability: number;
    weather_impact: string;
    terrain_difficulty: string;
    oxygen_required: boolean;
  };
  logistics: {
    next_refuel_km: number;
    next_rest_halt_km: number;
    supply_status: 'GREEN' | 'AMBER' | 'RED';
    medevac_capability: boolean;
  };
  alerts: Array<{
    severity: 'info' | 'warning' | 'critical' | 'emergency';
    category: string;
    message: string;
    action_required: string;
    timestamp: string;
  }>;
  recommendations: string[];
  tacticalAdvice: string;
  commandNotes: string;
}

interface TacticalMetricsHUDEnhancedProps {
  vehicleId: number | null;
  vehicleName?: string;
  mode: 'compact' | 'expanded' | 'full';
  onClose?: () => void;
  operationZone?: OperationZone;
  isSimulationRunning?: boolean;  // Controls whether metrics update
}

// Animated value with ultra-smooth interpolation
const AnimatedValue: React.FC<{
  value: number;
  prevValue: number;
  format?: (v: number) => string;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showDelta?: boolean;
}> = ({ value, prevValue, format = (v) => v.toFixed(1), color = COLORS.text, size = 'md', showDelta = true }) => {
  const delta = value - prevValue;
  const sizes = { xs: 'text-[9px]', sm: 'text-[10px]', md: 'text-xs', lg: 'text-sm' };
  
  return (
    <span className={`font-mono font-bold ${sizes[size]} transition-all duration-50`} style={{ color }}>
      {format(value)}
      {showDelta && Math.abs(delta) > 0.1 && (
        <span className={`ml-0.5 ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
          {delta > 0 ? '↑' : '↓'}
        </span>
      )}
    </span>
  );
};

// Ultra-high-frequency gauge with instant response
const UHFGauge: React.FC<{
  value: number;
  max: number;
  min?: number;
  label: string;
  unit?: string;
  icon?: string;
  status?: 'normal' | 'warning' | 'critical' | 'optimal';
  showNeedle?: boolean;
  prevValue?: number;
}> = ({ value, max, min = 0, label, unit = '', icon, status = 'normal', showNeedle = true, prevValue }) => {
  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const angle = -90 + (percentage * 1.8); // -90 to 90 degrees
  const delta = (prevValue !== undefined) ? value - prevValue : 0;
  
  const statusColors: Record<string, string> = {
    normal: COLORS.success,
    warning: COLORS.warning,
    critical: COLORS.alert,
    optimal: COLORS.cyan
  };
  
  return (
    <div className="flex flex-col items-center">
      <svg width="70" height="45" viewBox="0 0 70 45">
        <defs>
          <filter id={`uhf-glow-${label}`}>
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <linearGradient id={`uhf-gradient-${label}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={COLORS.success} />
            <stop offset="60%" stopColor={COLORS.warning} />
            <stop offset="100%" stopColor={COLORS.alert} />
          </linearGradient>
        </defs>
        
        {/* Background arc */}
        <path
          d="M 8 40 A 28 28 0 0 1 62 40"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        
        {/* Value arc */}
        <path
          d="M 8 40 A 28 28 0 0 1 62 40"
          fill="none"
          stroke={statusColors[status]}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${percentage * 0.88} 88`}
          filter={`url(#uhf-glow-${label})`}
          className="transition-all duration-50"
        />
        
        {/* Needle */}
        {showNeedle && (
          <line
            x1="35"
            y1="40"
            x2={35 + Math.cos((angle * Math.PI) / 180) * 20}
            y2={40 + Math.sin((angle * Math.PI) / 180) * 20}
            stroke={COLORS.accent}
            strokeWidth="2"
            strokeLinecap="round"
            className="transition-all duration-50"
          />
        )}
        
        {/* Center point */}
        <circle cx="35" cy="40" r="2" fill={COLORS.accent} />
        
        {/* Value text */}
        <text x="35" y="32" textAnchor="middle" fill={COLORS.text} fontSize="10" fontWeight="bold" fontFamily="monospace">
          {value.toFixed(0)}
        </text>
      </svg>
      
      <div className="flex items-center gap-1 -mt-1">
        {icon && <span className="text-[9px]">{icon}</span>}
        <span className="text-[7px] uppercase tracking-wider" style={{ color: COLORS.accent }}>{label}</span>
        {Math.abs(delta) > 0.3 && (
          <span className={`text-[7px] ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {delta > 0 ? '▲' : '▼'}
          </span>
        )}
      </div>
    </div>
  );
};

// Micro metric for dense displays
const MicroMetric: React.FC<{
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
  pulse?: boolean;
  trend?: 'up' | 'down' | 'stable';
}> = ({ label, value, unit = '', color = COLORS.text, pulse = false, trend }) => (
  <div className={`px-1.5 py-1 rounded text-center ${pulse ? 'animate-pulse' : ''}`} style={{ background: 'rgba(0,0,0,0.5)' }}>
    <div className="text-[7px] uppercase" style={{ color: COLORS.muted }}>{label}</div>
    <div className="flex items-center justify-center gap-0.5">
      <span className="text-[10px] font-mono font-bold" style={{ color }}>{value}{unit}</span>
      {trend === 'up' && <span className="text-[8px] text-green-400">↑</span>}
      {trend === 'down' && <span className="text-[8px] text-red-400">↓</span>}
    </div>
  </div>
);

// Real-time oscilloscope-style display
const Oscilloscope: React.FC<{
  data: number[];
  color?: string;
  height?: number;
  label?: string;
  currentValue?: number;
  unit?: string;
  gridLines?: number;
}> = ({ data, color = COLORS.success, height = 30, label, currentValue, unit = '', gridLines = 4 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const h = canvas.height;
    const padding = 2;
    const min = Math.min(...data) * 0.9;
    const max = Math.max(...data) * 1.1;
    
    // Clear
    ctx.clearRect(0, 0, width, h);
    
    // Scan line effect
    const scanLineY = (Date.now() % 2000) / 2000 * h;
    ctx.fillStyle = `${color}10`;
    ctx.fillRect(0, scanLineY - 2, width, 4);
    
    // Grid lines
    ctx.strokeStyle = 'rgba(196, 163, 90, 0.08)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < gridLines; i++) {
      const y = (h / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Vertical grid
    for (let i = 1; i < 8; i++) {
      const x = (width / 8) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    
    // Data line with glow
    ctx.shadowBlur = 6;
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
    
    // Current value dot with pulse
    if (data.length > 0) {
      const lastX = width - padding;
      const lastY = h - padding - ((data[data.length - 1] - min) / (max - min || 1)) * (h - padding * 2);
      
      // Pulse ring
      ctx.beginPath();
      ctx.arc(lastX, lastY, 5, 0, Math.PI * 2);
      ctx.strokeStyle = color + '40';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Center dot
      ctx.beginPath();
      ctx.arc(lastX, lastY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
    
    ctx.shadowBlur = 0;
  }, [data, color, height, gridLines]);
  
  return (
    <div className="relative">
      {label && (
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-[7px] uppercase" style={{ color: COLORS.muted }}>{label}</span>
          {currentValue !== undefined && (
            <span className="text-[9px] font-mono font-bold" style={{ color }}>
              {currentValue.toFixed(1)}{unit}
            </span>
          )}
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={200}
        height={height}
        className="w-full rounded"
        style={{ height: `${height}px`, background: 'rgba(0,0,0,0.6)' }}
      />
    </div>
  );
};

// Threat indicator with direction
const ThreatIndicator: React.FC<{
  level: 'ALPHA' | 'BRAVO' | 'CHARLIE' | 'DELTA';
  direction?: string | null;
  sectors?: string[];
}> = ({ level, direction, sectors = [] }) => {
  const colors = {
    ALPHA: COLORS.success,
    BRAVO: COLORS.info,
    CHARLIE: COLORS.warning,
    DELTA: COLORS.alert
  };
  
  const labels = {
    ALPHA: 'ALL CLEAR',
    BRAVO: 'ELEVATED',
    CHARLIE: 'HIGH ALERT',
    DELTA: 'CRITICAL'
  };
  
  return (
    <div className={`p-2 rounded border ${level === 'DELTA' ? 'animate-pulse' : ''}`}
         style={{ background: `${colors[level]}15`, borderColor: colors[level] }}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: colors[level] }} />
          <span className="text-[10px] font-bold" style={{ color: colors[level] }}>{labels[level]}</span>
        </div>
        <span className="text-[9px] font-mono" style={{ color: colors[level] }}>{level}</span>
      </div>
      
      {direction && (
        <div className="flex items-center gap-1 text-[9px]" style={{ color: COLORS.alert }}>
          <span>⚠ THREAT:</span>
          <span className="font-bold">{direction}</span>
        </div>
      )}
      
      {sectors.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {sectors.map((sector, i) => (
            <span key={i} className="px-1 py-0.5 rounded text-[7px]"
                  style={{ background: 'rgba(220, 38, 38, 0.3)', color: COLORS.alert }}>
              {sector}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// Supply chain status
const SupplyStatus: React.FC<{
  rations: number;
  water: number;
  ammo: number;
  medical: string;
  fuel: number;
}> = ({ rations, water, ammo, medical, fuel }) => {
  const getColor = (value: number, thresholds: [number, number]) => {
    if (value < thresholds[0]) return COLORS.alert;
    if (value < thresholds[1]) return COLORS.warning;
    return COLORS.success;
  };
  
  return (
    <div className="grid grid-cols-5 gap-1">
      <MicroMetric label="RATION" value={`${rations}D`} color={getColor(rations, [2, 5])} pulse={rations < 2} />
      <MicroMetric label="WATER" value={`${water}L`} color={getColor(water, [10, 30])} pulse={water < 10} />
      <MicroMetric label="AMMO" value={`${ammo}%`} color={getColor(ammo, [25, 50])} pulse={ammo < 25} />
      <MicroMetric label="MED" value={medical} color={medical === 'RED' ? COLORS.alert : medical === 'AMBER' ? COLORS.warning : COLORS.success} />
      <MicroMetric label="FUEL" value={`${fuel}%`} color={getColor(fuel, [15, 30])} pulse={fuel < 15} />
    </div>
  );
};

// Convoy formation display
const FormationDisplay: React.FC<{
  distance: number;
  integrity: number;
  visualContact: boolean;
  vehicleCount?: number;
}> = ({ distance, integrity, visualContact, vehicleCount = 4 }) => (
  <div className="grid grid-cols-4 gap-1">
    <MicroMetric label="SPACING" value={distance.toFixed(0)} unit="m" color={distance < 50 ? COLORS.warning : distance > 200 ? COLORS.alert : COLORS.success} />
    <MicroMetric label="FORMATION" value={`${integrity.toFixed(0)}%`} color={integrity < 70 ? COLORS.warning : COLORS.success} />
    <MicroMetric label="VISUAL" value={visualContact ? 'YES' : 'NO'} color={visualContact ? COLORS.success : COLORS.alert} pulse={!visualContact} />
    <MicroMetric label="CONVOY" value={`${vehicleCount}V`} color={COLORS.info} />
  </div>
);

// Altitude & environmental hazards for high-altitude ops
const AltitudeHazards: React.FC<{
  altitude: number;
  o2Level: number;
  acclimatization: string;
  temperature: number;
  deIcing: boolean;
  snowChains: boolean;
}> = ({ altitude, o2Level, acclimatization, temperature, deIcing, snowChains }) => {
  const isHighAltitude = altitude > 3000;
  const isExtreme = altitude > 5000;
  
  return (
    <div className="p-2 rounded border" style={{ 
      background: isExtreme ? 'rgba(165, 243, 252, 0.1)' : isHighAltitude ? 'rgba(100, 150, 200, 0.1)' : 'rgba(0,0,0,0.3)',
      borderColor: isExtreme ? COLORS.ice : isHighAltitude ? COLORS.info : COLORS.border
    }}>
      <div className="flex items-center gap-2 mb-1.5">
        <span>{isExtreme ? '🏔️' : isHighAltitude ? '⛰️' : '🛤️'}</span>
        <span className="text-[8px] font-bold uppercase" style={{ color: isExtreme ? COLORS.ice : COLORS.accent }}>
          {isExtreme ? 'EXTREME ALTITUDE' : isHighAltitude ? 'HIGH ALTITUDE OPS' : 'STANDARD ALT'}
        </span>
      </div>
      
      <div className="grid grid-cols-6 gap-1">
        <MicroMetric label="ALT" value={altitude.toFixed(0)} unit="m" color={isExtreme ? COLORS.ice : isHighAltitude ? COLORS.info : COLORS.success} />
        <MicroMetric label="O₂" value={`${o2Level.toFixed(0)}%`} color={o2Level < 85 ? COLORS.alert : o2Level < 92 ? COLORS.warning : COLORS.success} pulse={o2Level < 85} />
        <MicroMetric label="ACCL" value={acclimatization} color={acclimatization === 'OK' ? COLORS.success : acclimatization === 'ADAPTING' ? COLORS.warning : COLORS.alert} />
        <MicroMetric label="TEMP" value={`${temperature}°`} color={temperature < -10 ? COLORS.ice : temperature < 0 ? COLORS.info : COLORS.success} />
        <MicroMetric label="DE-ICE" value={deIcing ? 'ON' : 'OFF'} color={deIcing ? COLORS.warning : COLORS.muted} />
        <MicroMetric label="CHAINS" value={snowChains ? 'ON' : 'OFF'} color={snowChains ? COLORS.info : COLORS.muted} />
      </div>
    </div>
  );
};

// QRF & Support availability
const SupportStatus: React.FC<{
  qrfDistance: number;
  medicalDistance: number;
  artilleryCoverage: boolean;
  airSupportEta: number;
}> = ({ qrfDistance, medicalDistance, artilleryCoverage, airSupportEta }) => (
  <div className="grid grid-cols-4 gap-1">
    <MicroMetric label="QRF" value={`${qrfDistance.toFixed(0)}km`} color={qrfDistance > 30 ? COLORS.warning : COLORS.success} />
    <MicroMetric label="MEDEVAC" value={`${medicalDistance.toFixed(0)}km`} color={medicalDistance > 20 ? COLORS.warning : COLORS.success} />
    <MicroMetric label="ARTY" value={artilleryCoverage ? 'COVER' : 'NONE'} color={artilleryCoverage ? COLORS.success : COLORS.warning} />
    <MicroMetric label="AIR" value={`${airSupportEta}min`} color={airSupportEta > 30 ? COLORS.warning : COLORS.success} />
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TacticalMetricsHUDEnhanced({ 
  vehicleId, 
  vehicleName, 
  mode,
  onClose,
  operationZone = 'KASHMIR',
  isSimulationRunning = true  // Default true for backward compatibility
}: TacticalMetricsHUDEnhancedProps) {
  // State
  const [telemetry, setTelemetry] = useState<ExtendedTelemetry | null>(null);
  const [prevTelemetry, setPrevTelemetry] = useState<ExtendedTelemetry | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AITacticalAnalysis | null>(null);
  const [janusAnalysis, setJanusAnalysis] = useState<{
    analysis_type: string;
    generated_by: string;
    gpu_accelerated: boolean;
    model: string;
    confidence: number;
    recommendations: Array<{ text: string; priority: string; source: string }>;
    threat_assessment: { threat_level: string; threat_score: number; factors: string[]; vehicle_status: string };
    timestamp: string;
    note?: string;
  } | null>(null);
  const [janusLoading, setJanusLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [updateCount, setUpdateCount] = useState(0);
  const [frameTime, setFrameTime] = useState(0);
  
  // History buffers for oscilloscopes (120 samples = ~6 seconds at 50ms)
  const [history, setHistory] = useState<Record<string, number[]>>({
    speed: [],
    rpm: [],
    fuel: [],
    engineTemp: [],
    throttle: [],
    torque: [],
    acceleration: [],
    altitude: [],
    fuelFlow: [],
    brakePressure: []
  });
  
  // Persistent state
  const persistentState = useRef({
    missionStartTime: Date.now(),
    totalDistance: 0,
    smokeCharges: 4,
    flares: 8,
    lastThreatTime: 0
  });
  
  // Janus AI last call timestamp to throttle requests
  const lastJanusCall = useRef<number>(0);
  
  // Call Janus AI for deep analysis (throttled to every 10 seconds)
  const fetchJanusAnalysis = useCallback(async (telemetryData: ExtendedTelemetry) => {
    const now = Date.now();
    if (now - lastJanusCall.current < 10000) return; // Only call every 10 seconds
    lastJanusCall.current = now;
    
    setJanusLoading(true);
    try {
      const response = await fetch(`${API_V1}/advanced/ai/analyze-telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: vehicleId,
          telemetry: {
            velocity_kmh: telemetryData.velocity_kmh,
            engine_rpm: telemetryData.engine_rpm,
            engine_temp_c: telemetryData.engine_temp_c,
            engine_load_pct: telemetryData.engine_load_pct,
            fuel_percent: telemetryData.fuel_percent,
            fuel_flow_lph: telemetryData.fuel_flow_lph,
            range_remaining_km: telemetryData.range_remaining_km,
            altitude_m: telemetryData.altitude_m,
            gradient_deg: telemetryData.gradient_deg,
            driver_fatigue_pct: telemetryData.driver_fatigue_pct,
            visibility_m: telemetryData.visibility_m,
            ambient_temp_c: telemetryData.ambient_temp_c,
            tire_pressures_psi: telemetryData.tire_pressures_psi,
            brake_temps_c: telemetryData.brake_temps_c,
            battery_voltage: telemetryData.battery_voltage,
            battery_soc_pct: telemetryData.battery_soc_pct
          },
          vehicle_name: vehicleName || `Vehicle ${vehicleId}`,
          vehicle_type: 'MILITARY_TRANSPORT',
          operation_zone: operationZone,
          threat_level: telemetryData.threat_level || 'LOW'
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
  }, [vehicleId, vehicleName, operationZone]);
  
  // Calculate optimal update interval based on criticality
  const getUpdateInterval = useCallback((): number => {
    if (!telemetry) return 200;
    
    // Ultra-fast updates for critical situations
    if (aiAnalysis?.threatLevel === 'DELTA') return 50;
    if (aiAnalysis?.threatLevel === 'CHARLIE') return 75;
    
    // Fast updates during high-speed/high-load
    const speed = telemetry.velocity_kmh;
    const engineLoad = telemetry.engine_load_pct;
    
    if (speed > 70 || engineLoad > 85) return 100;
    if (speed > 50 || engineLoad > 70) return 125;
    if (speed > 30) return 150;
    
    return 200; // Standard ops
  }, [telemetry, aiAnalysis]);
  
  // Time update (high frequency for milliseconds display)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 50);
    return () => clearInterval(timer);
  }, []);
  
  // Generate AI analysis from telemetry
  const generateAIAnalysis = useCallback((data: ExtendedTelemetry): AITacticalAnalysis => {
    const alerts: AITacticalAnalysis['alerts'] = [];
    let threatScore = 0;
    
    // Fuel analysis
    if (data.fuel_percent < 15) {
      alerts.push({ severity: 'critical', category: 'FUEL', message: `FUEL CRITICAL: ${data.fuel_percent.toFixed(1)}%`, action_required: 'IMMEDIATE REFUEL', timestamp: new Date().toISOString() });
      threatScore += 35;
    } else if (data.fuel_percent < 25) {
      alerts.push({ severity: 'warning', category: 'FUEL', message: `Low fuel: ${data.fuel_percent.toFixed(1)}%`, action_required: 'Plan refuel stop', timestamp: new Date().toISOString() });
      threatScore += 15;
    }
    
    // Engine analysis
    if (data.engine_temp_c > 110) {
      alerts.push({ severity: 'critical', category: 'ENGINE', message: `ENGINE OVERHEAT: ${data.engine_temp_c.toFixed(0)}°C`, action_required: 'REDUCE SPEED/STOP', timestamp: new Date().toISOString() });
      threatScore += 30;
    } else if (data.engine_temp_c > 95) {
      alerts.push({ severity: 'warning', category: 'ENGINE', message: `Engine temp elevated: ${data.engine_temp_c.toFixed(0)}°C`, action_required: 'Monitor closely', timestamp: new Date().toISOString() });
      threatScore += 10;
    }
    
    // Driver fatigue
    if (data.driver_fatigue_pct > 70) {
      alerts.push({ severity: 'critical', category: 'CREW', message: `DRIVER FATIGUE: ${data.driver_fatigue_pct.toFixed(0)}%`, action_required: 'MANDATORY REST', timestamp: new Date().toISOString() });
      threatScore += 25;
    } else if (data.driver_fatigue_pct > 50) {
      alerts.push({ severity: 'warning', category: 'CREW', message: `Driver fatigue: ${data.driver_fatigue_pct.toFixed(0)}%`, action_required: 'Schedule rest break', timestamp: new Date().toISOString() });
      threatScore += 10;
    }
    
    // High altitude hazards
    if (data.altitude_m > 4500 && data.oxygen_level_cabin_pct < 90) {
      alerts.push({ severity: 'warning', category: 'ALTITUDE', message: `Low O₂ at altitude: ${data.oxygen_level_cabin_pct.toFixed(0)}%`, action_required: 'Check cabin seal', timestamp: new Date().toISOString() });
      threatScore += 15;
    }
    
    // Visibility
    if (data.visibility_m < 200) {
      alerts.push({ severity: 'critical', category: 'WEATHER', message: `POOR VISIBILITY: ${data.visibility_m.toFixed(0)}m`, action_required: 'REDUCE SPEED', timestamp: new Date().toISOString() });
      threatScore += 20;
    }
    
    // Communications
    if (data.radio_signal_strength_pct < 20) {
      alerts.push({ severity: 'warning', category: 'COMMS', message: `Weak radio signal: ${data.radio_signal_strength_pct.toFixed(0)}%`, action_required: 'Move to high ground', timestamp: new Date().toISOString() });
      threatScore += 10;
    }
    
    // Convoy formation
    if (data.formation_integrity_pct < 60) {
      alerts.push({ severity: 'warning', category: 'CONVOY', message: `Formation integrity: ${data.formation_integrity_pct.toFixed(0)}%`, action_required: 'Tighten formation', timestamp: new Date().toISOString() });
      threatScore += 15;
    }
    
    // Jamming detected
    if (data.jammer_active) {
      alerts.push({ severity: 'emergency', category: 'EW', message: 'ELECTRONIC JAMMING DETECTED', action_required: 'COUNTER MEASURES', timestamp: new Date().toISOString() });
      threatScore += 40;
    }
    
    // Determine threat level
    let threatLevel: 'ALPHA' | 'BRAVO' | 'CHARLIE' | 'DELTA' = 'ALPHA';
    if (threatScore >= 60) threatLevel = 'DELTA';
    else if (threatScore >= 40) threatLevel = 'CHARLIE';
    else if (threatScore >= 20) threatLevel = 'BRAVO';
    
    // Calculate predictions
    const etaHours = data.range_remaining_km / Math.max(data.velocity_kmh, 30);
    const etaString = `${Math.floor(etaHours)}h ${Math.round((etaHours % 1) * 60)}m`;
    const fuelAtArrival = Math.max(0, data.fuel_percent - (etaHours * data.fuel_flow_lph * 100 / 300));
    
    // Generate INTELLIGENT recommendations based on ACTUAL data values
    const recommendations: string[] = [];
    
    // Fuel analysis with specific values
    if (data.fuel_percent < 20) {
      recommendations.push(`🔴 FUEL CRITICAL at ${data.fuel_percent.toFixed(0)}% - Immediate refuel required`);
    } else if (data.fuel_percent < 40) {
      recommendations.push(`🟡 Fuel at ${data.fuel_percent.toFixed(0)}% - Plan refueling within ${(data.range_remaining_km * 0.3).toFixed(0)}km`);
    } else if (data.fuel_percent > 90) {
      recommendations.push(`✅ Fuel optimal at ${data.fuel_percent.toFixed(0)}% - Range: ${data.range_remaining_km.toFixed(0)}km`);
    }
    
    // Engine temperature analysis with context
    if (data.engine_temp_c > 105) {
      recommendations.push(`🔴 ENGINE HOT ${data.engine_temp_c.toFixed(0)}°C - Reduce load immediately`);
    } else if (data.engine_temp_c > 95) {
      recommendations.push(`🟡 Engine warm at ${data.engine_temp_c.toFixed(0)}°C - Monitor cooling system`);
    } else if (data.engine_temp_c >= 80 && data.engine_temp_c <= 95) {
      recommendations.push(`✅ Engine temp optimal at ${data.engine_temp_c.toFixed(0)}°C`);
    } else if (data.engine_temp_c < 70) {
      recommendations.push(`🟡 Engine cold at ${data.engine_temp_c.toFixed(0)}°C - Allow warmup before high load`);
    }
    
    // Speed and driving analysis
    if (data.velocity_kmh > 80) {
      recommendations.push(`⚡ High speed ${data.velocity_kmh.toFixed(0)}km/h - Maintain awareness`);
    } else if (data.velocity_kmh >= 40 && data.velocity_kmh <= 80) {
      recommendations.push(`✅ Speed nominal at ${data.velocity_kmh.toFixed(0)}km/h for terrain`);
    } else if (data.velocity_kmh > 0 && data.velocity_kmh < 30) {
      recommendations.push(`🔄 Low speed ${data.velocity_kmh.toFixed(0)}km/h - Check for obstacles`);
    }
    
    // Altitude specific recommendations
    if (data.altitude_m > 4500) {
      recommendations.push(`🏔️ EXTREME ALT ${data.altitude_m.toFixed(0)}m - O₂ levels critical, crew check every 30min`);
    } else if (data.altitude_m > 3500) {
      recommendations.push(`🏔️ High altitude ${data.altitude_m.toFixed(0)}m - Monitor for altitude sickness`);
    } else if (data.altitude_m > 2000) {
      recommendations.push(`📍 Elevated terrain ${data.altitude_m.toFixed(0)}m - Adjust braking distance`);
    }
    
    // Driver fatigue with specific action
    if (data.driver_fatigue_pct > 70) {
      recommendations.push(`🔴 CREW FATIGUE ${data.driver_fatigue_pct.toFixed(0)}% - Mandatory rest required`);
    } else if (data.driver_fatigue_pct > 40) {
      recommendations.push(`🟡 Driver fatigue at ${data.driver_fatigue_pct.toFixed(0)}% - Rest break in ${(80 - data.driver_fatigue_pct).toFixed(0)}min`);
    } else if (data.driver_fatigue_pct <= 20) {
      recommendations.push(`✅ Crew alert status: ${(100 - data.driver_fatigue_pct).toFixed(0)}%`);
    }
    
    // RPM and gear analysis
    if (data.engine_rpm > 4000) {
      recommendations.push(`⚙️ High RPM ${data.engine_rpm} - Consider upshift to reduce strain`);
    } else if (data.engine_rpm < 1000 && data.velocity_kmh > 20) {
      recommendations.push(`⚙️ Low RPM ${data.engine_rpm} - Downshift for better torque`);
    }
    
    // Visibility conditions
    if (data.visibility_m < 200) {
      recommendations.push(`🔴 POOR VISIBILITY ${data.visibility_m.toFixed(0)}m - Reduce speed, use fog lights`);
    } else if (data.visibility_m < 1000) {
      recommendations.push(`🟡 Reduced visibility ${data.visibility_m.toFixed(0)}m - Increase following distance`);
    }
    
    // Load/cargo analysis
    if (data.cargo_weight_kg > 0) {
      const loadPercent = (data.cargo_weight_kg / 10000) * 100; // Assume 10 ton capacity
      if (loadPercent > 90) {
        recommendations.push(`📦 Heavy load ${(data.cargo_weight_kg/1000).toFixed(1)}T - Reduce speed on gradients`);
      }
    }
    
    // Brake temperature
    if (data.brake_temp_avg_c > 300) {
      recommendations.push(`🔴 BRAKES HOT ${data.brake_temp_avg_c.toFixed(0)}°C - Engine brake, reduce speed`);
    } else if (data.brake_temp_avg_c > 200) {
      recommendations.push(`🟡 Brake temp elevated ${data.brake_temp_avg_c.toFixed(0)}°C`);
    }
    
    // Gradient analysis
    if (data.gradient_deg > 15) {
      recommendations.push(`⛰️ Steep grade ${data.gradient_deg.toFixed(0)}° - Low gear, engine brake`);
    } else if (data.gradient_deg < -10) {
      recommendations.push(`⬇️ Steep descent ${Math.abs(data.gradient_deg).toFixed(0)}° - Control speed, engine brake`);
    }
    
    // If everything is optimal, provide a summary
    if (recommendations.length === 0) {
      recommendations.push(`✅ All ${Object.keys(data).length} parameters within optimal range`);
      recommendations.push(`📊 Fuel: ${data.fuel_percent.toFixed(0)}% | Temp: ${data.engine_temp_c.toFixed(0)}°C | Speed: ${data.velocity_kmh.toFixed(0)}km/h`);
    }
    
    // Tactical advice based on threat level AND actual data
    let tacticalAdvice = `✅ All systems GREEN. Speed: ${data.velocity_kmh.toFixed(0)}km/h, Fuel: ${data.fuel_percent.toFixed(0)}%, Temp: ${data.engine_temp_c.toFixed(0)}°C`;
    if (threatLevel === 'DELTA') tacticalAdvice = `🚨 CONDITION RED: ${alerts.length} critical alerts. Fuel: ${data.fuel_percent.toFixed(0)}%, Temp: ${data.engine_temp_c.toFixed(0)}°C - IMMEDIATE ACTION`;
    else if (threatLevel === 'CHARLIE') tacticalAdvice = `⚠️ CONDITION AMBER: ${alerts.length} alerts active. Monitor: Fuel ${data.fuel_percent.toFixed(0)}%, Engine ${data.engine_temp_c.toFixed(0)}°C`;
    else if (threatLevel === 'BRAVO') tacticalAdvice = `📡 CONDITION YELLOW: ${alerts.length} minor concerns. Current: ${data.velocity_kmh.toFixed(0)}km/h at ${data.altitude_m.toFixed(0)}m`;
    
    // Command notes based on operation zone AND current conditions
    let commandNotes = '';
    if (operationZone === 'KASHMIR' || operationZone === 'LADAKH') {
      if (data.altitude_m > 3000) {
        commandNotes = `High alt ops at ${data.altitude_m.toFixed(0)}m. O₂: ${data.oxygen_level_cabin_pct?.toFixed(0) || '21'}%. IED vigilance. Radio silence in sensitive zones.`;
      } else {
        commandNotes = `Kashmir sector. Alt: ${data.altitude_m.toFixed(0)}m. Maintain convoy discipline. Current speed: ${data.velocity_kmh.toFixed(0)}km/h.`;
      }
    } else if (operationZone === 'SIACHEN') {
      commandNotes = `EXTREME COLD OPS. Alt: ${data.altitude_m.toFixed(0)}m. Temp: ${data.ambient_temp_c?.toFixed(0) || -20}°C. Frostbite protocol active.`;
    } else if (operationZone === 'NAXAL_CORRIDOR') {
      commandNotes = `Red corridor. Speed: ${data.velocity_kmh.toFixed(0)}km/h. Maintain 75m spacing. QRF on standby.`;
    } else {
      commandNotes = `Standard ops. Vehicle status: ${threatLevel}. ETA destination: ${etaString}. Range: ${data.range_remaining_km.toFixed(0)}km.`;
    }
    
    return {
      threatLevel,
      operationZone,
      situationalAwareness: {
        ied_threat_probability: threatLevel === 'DELTA' ? 0.35 : threatLevel === 'CHARLIE' ? 0.2 : threatLevel === 'BRAVO' ? 0.1 : 0.05,
        ambush_risk_sectors: threatLevel === 'DELTA' ? ['N', 'NE'] : threatLevel === 'CHARLIE' ? ['N'] : [],
        safe_sectors: ['S', 'SW', 'W'],
        nearest_qrf_km: 15 + Math.random() * 20,
        nearest_medical_km: 10 + Math.random() * 15,
        artillery_coverage: threatLevel !== 'DELTA',
        air_support_eta_min: 15 + Math.floor(Math.random() * 20)
      },
      predictions: {
        eta_destination: etaString,
        fuel_at_arrival_pct: fuelAtArrival,
        breakdown_probability: data.breakdown_probability,
        weather_impact: data.precipitation_mm_hr > 5 ? 'SIGNIFICANT' : data.precipitation_mm_hr > 2 ? 'MODERATE' : 'MINIMAL',
        terrain_difficulty: data.gradient_deg > 15 ? 'SEVERE' : data.gradient_deg > 8 ? 'DIFFICULT' : 'MODERATE',
        oxygen_required: data.altitude_m > 4000
      },
      logistics: {
        next_refuel_km: Math.max(10, data.range_remaining_km * 0.3),
        next_rest_halt_km: Math.max(20, 80 - (data.driver_fatigue_pct * 0.6)),
        supply_status: data.ration_days_remaining < 2 || data.ammo_status_pct < 25 ? 'RED' : data.ration_days_remaining < 4 || data.ammo_status_pct < 50 ? 'AMBER' : 'GREEN',
        medevac_capability: true
      },
      alerts: alerts.slice(0, 5), // Show top 5 alerts
      recommendations,
      tacticalAdvice,
      commandNotes
    };
  }, [operationZone]);
  
  // Fetch telemetry data using Indian Army specialized endpoint
  const fetchTelemetry = useCallback(async () => {
    if (!vehicleId) return;
    
    const startTime = performance.now();
    
    try {
      // Try the enhanced Indian Army endpoint first
      let response = await fetch(`${API_V1}/advanced/indian-army/full-operational-telemetry/${vehicleId}?operation_zone=${operationZone}`);
      
      // Fall back to standard endpoint if Indian Army endpoint fails
      if (!response.ok) {
        response = await fetch(`${API_V1}/advanced/metrics/full-telemetry/${vehicleId}`);
      }
      
      if (response.ok) {
        const rawData = await response.json();
        
        // Check if this is from the Indian Army endpoint (has high_altitude_ops)
        const isIndianArmyData = !!rawData.high_altitude_ops;
        
        // Transform to extended telemetry format
        const data: ExtendedTelemetry = isIndianArmyData ? {
          // Direct mapping from Indian Army endpoint
          velocity_ms: rawData.motion?.velocity_ms || 0,
          velocity_kmh: rawData.motion?.velocity_kmh || 0,
          acceleration_ms2: rawData.motion?.acceleration_ms2 || 0,
          heading_deg: rawData.position?.bearing_deg || 0,
          yaw_rate_dps: rawData.motion?.yaw_rate_dps || 0,
          
          latitude: rawData.position?.latitude || 0,
          longitude: rawData.position?.longitude || 0,
          altitude_m: rawData.position?.altitude_m || 0,
          gradient_deg: rawData.position?.gradient_deg || 0,
          
          engine_rpm: rawData.engine?.rpm || 0,
          engine_temp_c: rawData.engine?.temperature_c || 80,
          engine_load_pct: rawData.engine?.load_percent || 0,
          throttle_position: rawData.engine?.throttle_position_percent || 0,
          turbo_boost_psi: rawData.engine?.turbo_boost_psi || 0,
          oil_pressure_psi: rawData.engine?.oil_pressure_psi || 45,
          oil_temp_c: rawData.engine?.oil_temp_c || 90,
          coolant_temp_c: rawData.engine?.coolant_temp_c || 80,
          exhaust_temp_c: rawData.engine?.exhaust_temp_c || 350,
          
          gear: rawData.transmission?.current_gear || 1,
          torque_nm: rawData.engine?.torque_nm || 0,
          clutch_slip_pct: rawData.transmission?.clutch_slip_pct || 0,
          transmission_temp_c: rawData.transmission?.temp_c || 70,
          diff_temp_c: rawData.transmission?.diff_temp_c || 65,
          
          fuel_liters: rawData.fuel?.level_liters || 0,
          fuel_percent: rawData.fuel?.level_percent || 0,
          fuel_flow_lph: rawData.fuel?.consumption_rate_lph || 0,
          fuel_efficiency_kpl: rawData.fuel?.efficiency_kpl || 0,
          range_remaining_km: rawData.fuel?.range_remaining_km || 0,
          fuel_temp_c: rawData.fuel?.temp_c || 25,
          
          tire_pressures_psi: rawData.tires?.pressures_psi || [35, 35, 35, 35],
          tire_temps_c: rawData.tires?.temperatures_c || [40, 40, 40, 40],
          tire_wear_pct: rawData.tires?.wear_percent || [10, 10, 10, 10],
          tire_traction: rawData.tires?.traction || [0.8, 0.8, 0.8, 0.8],
          
          brake_temps_c: rawData.brakes?.temperatures_c || [100, 100, 100, 100],
          brake_wear_pct: rawData.brakes?.wear_percent || [15, 15, 15, 15],
          abs_active: rawData.brakes?.abs_active || false,
          brake_pressure_bar: rawData.brakes?.pressure_bar || 0,
          
          suspension_travel_mm: rawData.suspension?.travel_mm || [80, 80, 80, 80],
          damper_force_n: rawData.suspension?.damper_force_n || [500, 500, 500, 500],
          ride_height_mm: rawData.suspension?.ride_height_mm || 250,
          
          battery_voltage: rawData.electrical?.battery_voltage || 24,
          battery_soc_pct: rawData.electrical?.battery_soc_percent || 95,
          alternator_output_a: rawData.electrical?.alternator_output_a || 60,
          total_electrical_load_w: rawData.electrical?.total_load_w || 800,
          
          thermal_signature_level: rawData.defensive?.thermal_signature_level || 'MEDIUM',
          acoustic_db: rawData.defensive?.acoustic_db || 75,
          radar_cross_section_m2: rawData.defensive?.radar_cross_section_m2 || 15,
          ir_signature_level: rawData.defensive?.ir_signature_level || 'MEDIUM',
          
          driver_fatigue_pct: rawData.crew?.driver_fatigue_pct || 0,
          driver_stress_level: rawData.crew?.driver_stress_level || 0.3,
          crew_alertness: rawData.crew?.crew_alertness || 1,
          
          armor_integrity_pct: rawData.defensive?.armor_integrity_pct || 98,
          smoke_charges: rawData.defensive?.smoke_charges || 4,
          flare_count: rawData.defensive?.flare_count || 8,
          jammer_active: rawData.communications?.jammer_detected || false,
          iff_status: rawData.communications?.iff_status || 'ACTIVE',
          
          ambient_temp_c: rawData.environment?.ambient_temp_c || 25,
          humidity_pct: rawData.environment?.humidity_pct || 60,
          wind_speed_ms: rawData.environment?.wind_speed_ms || 5,
          wind_direction_deg: rawData.environment?.wind_direction_deg || 0,
          visibility_m: rawData.environment?.visibility_m || 10000,
          precipitation_mm_hr: rawData.environment?.precipitation_mm_hr || 0,
          road_friction: rawData.environment?.road_friction_coef || 0.7,
          
          // Indian Army specific
          altitude_acclimatization_status: rawData.high_altitude_ops?.altitude_acclimatization_status || 'N/A',
          oxygen_level_cabin_pct: rawData.high_altitude_ops?.oxygen_level_cabin_pct || 98,
          heater_status: rawData.high_altitude_ops?.heater_status || 'STANDBY',
          de_icing_active: rawData.high_altitude_ops?.de_icing_active || false,
          snow_chain_mounted: rawData.high_altitude_ops?.snow_chain_mounted || false,
          
          ration_days_remaining: rawData.supply_status?.ration_days_remaining || 5,
          water_liters: rawData.supply_status?.water_liters || 40,
          ammo_status_pct: rawData.supply_status?.ammo_status_pct || 85,
          medical_kit_status: rawData.supply_status?.medical_kit_status || 'GREEN',
          
          radio_signal_strength_pct: rawData.communications?.radio_signal_strength_pct || 90,
          satcom_active: rawData.communications?.satcom_active || true,
          encryption_status: rawData.communications?.encryption_status || 'AES-256',
          network_latency_ms: rawData.communications?.network_latency_ms || 45,
          
          inter_vehicle_distance_m: rawData.convoy?.inter_vehicle_distance_m || 100,
          formation_integrity_pct: rawData.convoy?.formation_integrity_pct || 90,
          visual_contact_status: rawData.convoy?.visual_contact_status || true,
          
          threat_level: rawData.threat_assessment?.threat_level || 'BRAVO',
          threat_direction: rawData.threat_assessment?.threat_direction || null,
          breakdown_probability: rawData.ai_analysis?.breakdown_probability || 0.02,
          eta_minutes: rawData.ai_analysis?.eta_minutes || 120,
          fuel_at_destination_pct: rawData.ai_analysis?.fuel_at_destination_pct || 30,
          route_risk_score: rawData.ai_analysis?.route_risk_score || 0.2,
          ai_recommendation: rawData.ai_analysis?.recommendation || 'Continue mission',
        } : {
          // Fallback mapping from standard full-telemetry endpoint
          // Motion
          velocity_ms: (rawData.motion?.velocity_kmh || 0) / 3.6,
          velocity_kmh: rawData.motion?.velocity_kmh || 0,
          acceleration_ms2: rawData.motion?.acceleration_ms2 || 0,
          heading_deg: rawData.position?.bearing_deg || 0,
          yaw_rate_dps: rawData.motion?.yaw_rate_dps || 0,
          
          // Position
          latitude: rawData.position?.latitude || 0,
          longitude: rawData.position?.longitude || 0,
          altitude_m: rawData.position?.altitude_m || 0,
          gradient_deg: rawData.position?.gradient_deg || 0,
          
          // Engine
          engine_rpm: rawData.engine?.rpm || 0,
          engine_temp_c: rawData.engine?.temperature_c || 80,
          engine_load_pct: rawData.engine?.load_percent || 0,
          throttle_position: rawData.engine?.throttle_position_percent || 0,
          turbo_boost_psi: rawData.engine?.turbo_boost_psi || 0,
          oil_pressure_psi: rawData.engine?.oil_pressure_psi || 45,
          oil_temp_c: rawData.engine?.oil_temp_c || 90,
          coolant_temp_c: rawData.engine?.coolant_temp_c || rawData.engine?.temperature_c || 80,
          exhaust_temp_c: rawData.engine?.exhaust_temp_c || 350,
          
          // Transmission
          gear: rawData.transmission?.current_gear || 1,
          torque_nm: rawData.engine?.torque_nm || 0,
          clutch_slip_pct: rawData.transmission?.clutch_slip_pct || 0,
          transmission_temp_c: rawData.transmission?.temp_c || 70,
          diff_temp_c: rawData.transmission?.diff_temp_c || 65,
          
          // Fuel
          fuel_liters: rawData.fuel?.level_liters || 0,
          fuel_percent: rawData.fuel?.level_percent || 0,
          fuel_flow_lph: rawData.fuel?.consumption_rate_lph || 0,
          fuel_efficiency_kpl: rawData.fuel?.efficiency_kpl || 0,
          range_remaining_km: rawData.fuel?.range_remaining_km || 0,
          fuel_temp_c: rawData.fuel?.temp_c || 25,
          
          // Tires
          tire_pressures_psi: rawData.tires?.pressures_psi || [35, 35, 35, 35],
          tire_temps_c: rawData.tires?.temperatures_c || [40, 40, 40, 40],
          tire_wear_pct: rawData.tires?.wear_percent || [10, 10, 10, 10],
          tire_traction: rawData.tires?.traction || [0.8, 0.8, 0.8, 0.8],
          
          // Brakes
          brake_temps_c: rawData.brakes?.temperatures_c || [100, 100, 100, 100],
          brake_wear_pct: rawData.brakes?.wear_percent || [15, 15, 15, 15],
          abs_active: rawData.brakes?.abs_active || false,
          brake_pressure_bar: rawData.brakes?.pressure_bar || 0,
          
          // Suspension
          suspension_travel_mm: rawData.suspension?.travel_mm || [80, 80, 80, 80],
          damper_force_n: rawData.suspension?.damper_force_n || [500, 500, 500, 500],
          ride_height_mm: rawData.suspension?.ride_height_mm || 250,
          
          // Electrical
          battery_voltage: rawData.electrical?.battery_voltage || 24,
          battery_soc_pct: rawData.electrical?.battery_soc_percent || 95,
          alternator_output_a: rawData.electrical?.alternator_output_a || 60,
          total_electrical_load_w: rawData.electrical?.total_load_w || 800,
          
          // Signatures
          thermal_signature_level: rawData.signatures?.thermal || 'MEDIUM',
          acoustic_db: rawData.signatures?.acoustic_db || 75,
          radar_cross_section_m2: rawData.signatures?.rcs_m2 || 15,
          ir_signature_level: rawData.signatures?.ir || 'MEDIUM',
          
          // Crew
          driver_fatigue_pct: rawData.crew?.driver_fatigue_percent || 0,
          driver_stress_level: rawData.crew?.stress_level || 0.3,
          crew_alertness: 1 - (rawData.crew?.driver_fatigue_percent || 0) / 100,
          
          // Combat
          armor_integrity_pct: rawData.combat?.armor_integrity_pct || 98,
          smoke_charges: persistentState.current.smokeCharges,
          flare_count: persistentState.current.flares,
          jammer_active: rawData.communications?.is_jammed || false,
          iff_status: 'ACTIVE',
          
          // Environment
          ambient_temp_c: rawData.environment?.ambient_temp_c || 25,
          humidity_pct: rawData.environment?.humidity_pct || 60,
          wind_speed_ms: rawData.environment?.wind_speed_ms || 5,
          wind_direction_deg: rawData.environment?.wind_direction_deg || 0,
          visibility_m: rawData.environment?.visibility_m || 10000,
          precipitation_mm_hr: rawData.environment?.precipitation_mm_hr || 0,
          road_friction: rawData.environment?.road_friction_coef || 0.7,
          
          // Indian Army Specific
          altitude_acclimatization_status: rawData.position?.altitude_m > 4500 ? 'ADAPTING' : rawData.position?.altitude_m > 3000 ? 'OK' : 'N/A',
          oxygen_level_cabin_pct: rawData.position?.altitude_m > 4000 ? 88 + Math.random() * 7 : 98,
          heater_status: rawData.environment?.ambient_temp_c < 5 ? 'ON' : 'STANDBY',
          de_icing_active: rawData.environment?.ambient_temp_c < 0,
          snow_chain_mounted: rawData.environment?.road_friction_coef < 0.4,
          
          // Supply
          ration_days_remaining: 5 + Math.floor(Math.random() * 3),
          water_liters: 40 + Math.floor(Math.random() * 20),
          ammo_status_pct: 85 + Math.floor(Math.random() * 15),
          medical_kit_status: 'GREEN',
          
          // Comms
          radio_signal_strength_pct: rawData.communications?.radio_strength || 90,
          satcom_active: true,
          encryption_status: rawData.communications?.encryption || 'AES-256',
          network_latency_ms: rawData.communications?.latency_ms || 45,
          
          // Formation
          inter_vehicle_distance_m: 80 + Math.random() * 40,
          formation_integrity_pct: 85 + Math.random() * 15,
          visual_contact_status: true,
          
          // AI
          threat_level: rawData.ai_analysis?.threat_level || 'BRAVO',
          threat_direction: rawData.ai_analysis?.threat_direction || null,
          breakdown_probability: rawData.ai_analysis?.breakdown_probability || 0.02,
          eta_minutes: rawData.ai_analysis?.eta_minutes || 120,
          fuel_at_destination_pct: rawData.ai_analysis?.fuel_at_destination_pct || 30,
          route_risk_score: rawData.ai_analysis?.route_risk_score || 0.2,
          ai_recommendation: rawData.ai_analysis?.recommendation || 'Continue mission'
        };
        
        setPrevTelemetry(telemetry);
        setTelemetry(data);
        setUpdateCount(c => c + 1);
        
        // Update history
        setHistory(prev => ({
          speed: [...prev.speed, data.velocity_kmh].slice(-120),
          rpm: [...prev.rpm, data.engine_rpm].slice(-120),
          fuel: [...prev.fuel, data.fuel_percent].slice(-120),
          engineTemp: [...prev.engineTemp, data.engine_temp_c].slice(-120),
          throttle: [...prev.throttle, data.throttle_position].slice(-120),
          torque: [...prev.torque, data.torque_nm].slice(-120),
          acceleration: [...prev.acceleration, data.acceleration_ms2].slice(-120),
          altitude: [...prev.altitude, data.altitude_m].slice(-120),
          fuelFlow: [...prev.fuelFlow, data.fuel_flow_lph].slice(-120),
          brakePressure: [...prev.brakePressure, data.brake_pressure_bar].slice(-120)
        }));
        
        // Generate AI analysis
        setAiAnalysis(generateAIAnalysis(data));
        
        // Also call Janus AI for deep analysis (throttled)
        fetchJanusAnalysis(data);
      }
    } catch (err) {
      console.error('Telemetry fetch error:', err);
    } finally {
      setLoading(false);
      setFrameTime(performance.now() - startTime);
    }
  }, [vehicleId, telemetry, generateAIAnalysis, operationZone, fetchJanusAnalysis]);
  
  // ALWAYS fetch on vehicle change - this ensures data loads even without simulation
  useEffect(() => {
    if (!vehicleId) return;
    
    console.log('[VehicleMetrics] Vehicle useEffect triggered. VehicleId:', vehicleId);
    
    // Reset state for new vehicle
    setLoading(true);
    setTelemetry(null);
    setAiAnalysis(null);
    setHistory({ speed: [], rpm: [], fuel: [], engineTemp: [], throttle: [], torque: [], acceleration: [], altitude: [], fuelFlow: [], brakePressure: [] });
    
    // Fetch immediately
    console.log('[VehicleMetrics] Fetching telemetry for vehicle:', vehicleId);
    fetchTelemetry();
    
    // Also set up a one-time retry after 1 second in case first fetch fails
    const retryTimeout = setTimeout(() => {
      if (!telemetry) {
        fetchTelemetry();
      }
    }, 1000);
    
    return () => clearTimeout(retryTimeout);
  }, [vehicleId]); // Only depend on vehicleId to trigger on each selection
  
  // Continuous updates when simulation is running
  useEffect(() => {
    if (!vehicleId || !isSimulationRunning) return;
    
    let cancelled = false;
    let frameId: number;
    
    const tick = async () => {
      if (cancelled || !isSimulationRunning) return;
      await fetchTelemetry();
      if (!cancelled && isSimulationRunning) {
        frameId = window.setTimeout(tick, getUpdateInterval()) as unknown as number;
      }
    };
    
    tick();
    
    return () => {
      cancelled = true;
      if (frameId) clearTimeout(frameId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId, isSimulationRunning]);
  
  // Loading state
  if (!vehicleId) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: `linear-gradient(180deg, ${COLORS.background} 0%, rgba(13, 27, 13, 0.95) 100%)` }}>
        <div className="text-center p-8">
          <div className="text-6xl mb-4">🎖️</div>
          <div className="text-xl font-bold mb-2" style={{ color: COLORS.accent }}>INDIAN ARMY TACTICAL COMMAND</div>
          <div className="text-sm" style={{ color: COLORS.muted }}>Select a vehicle for telemetry</div>
        </div>
      </div>
    );
  }
  
  if (loading && !telemetry) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: `linear-gradient(180deg, ${COLORS.background} 0%, rgba(13, 27, 13, 0.95) 100%)` }}>
        <div className="text-center">
          <div className="text-4xl mb-4 animate-spin">⚙️</div>
          <div className="font-bold" style={{ color: COLORS.accent }}>ESTABLISHING TACTICAL UPLINK...</div>
          <div className="text-sm mt-2" style={{ color: COLORS.muted }}>Connecting to vehicle systems</div>
        </div>
      </div>
    );
  }
  
  // Show simulation paused state
  const simulationPausedBanner = !isSimulationRunning && (
    <div className="p-3 border-b text-center" style={{ background: 'rgba(205, 127, 50, 0.2)', borderColor: COLORS.warning }}>
      <div className="flex items-center justify-center gap-2">
        <span className="text-xl">⏸️</span>
        <span className="font-bold" style={{ color: COLORS.warning }}>SIMULATION PAUSED - LIVE UPDATES DISABLED</span>
      </div>
      <div className="text-[10px] mt-1" style={{ color: COLORS.muted }}>Start the demo to resume real-time telemetry</div>
    </div>
  );
  
  const threatColors = {
    ALPHA: COLORS.success,
    BRAVO: COLORS.info,
    CHARLIE: COLORS.warning,
    DELTA: COLORS.alert
  };
  
  return (
    <div className="flex-1 overflow-y-auto" style={{ 
      background: `linear-gradient(180deg, ${COLORS.background} 0%, rgba(13, 27, 13, 0.98) 100%)`,
      fontFamily: "'Courier New', 'Consolas', monospace"
    }}>
      {/* SIMULATION PAUSED BANNER */}
      {simulationPausedBanner}
      
      {/* HEADER - Ultra compact with live indicators */}
      <div className="sticky top-0 z-10 p-1.5 border-b" style={{ 
        background: `linear-gradient(180deg, ${COLORS.panel} 0%, rgba(26, 71, 42, 0.95) 100%)`,
        borderColor: COLORS.border
      }}>
        <div className="flex items-center justify-between text-[8px] mb-1" style={{ color: COLORS.muted }}>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${isSimulationRunning ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
              {isSimulationRunning ? 'LIVE' : 'PAUSED'}
            </span>
            <span className="text-green-400">{getUpdateInterval()}ms</span>
            <span>|</span>
            <span>{frameTime.toFixed(0)}ms</span>
          </div>
          <span className="font-mono">
            {currentTime.toLocaleTimeString('en-GB', { hour12: false })}.{String(currentTime.getMilliseconds()).padStart(3, '0')}
          </span>
          <div className="flex items-center gap-2">
            <span className="px-1 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.4)' }}>{operationZone}</span>
            <span style={{ color: COLORS.neon }}>◉ {updateCount}</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded flex items-center justify-center text-lg" 
                 style={{ 
                   background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.secondary} 100%)`,
                   border: `2px solid ${COLORS.accent}`
                 }}>
              🚛
            </div>
            <div>
              <div className="font-bold text-sm" style={{ color: COLORS.text }}>
                {vehicleName || `UNIT-${vehicleId}`}
              </div>
              <div className="text-[8px]" style={{ color: COLORS.muted }}>
                {telemetry?.velocity_kmh.toFixed(0)} km/h • ALT: {telemetry?.altitude_m.toFixed(0)}m
              </div>
            </div>
          </div>
          
          {aiAnalysis && (
            <div className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1.5 ${aiAnalysis.threatLevel === 'DELTA' ? 'animate-pulse' : ''}`}
                 style={{ 
                   background: threatColors[aiAnalysis.threatLevel] + '30',
                   border: `1px solid ${threatColors[aiAnalysis.threatLevel]}`,
                   color: threatColors[aiAnalysis.threatLevel]
                 }}>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" 
                   style={{ background: threatColors[aiAnalysis.threatLevel] }} />
              {aiAnalysis.threatLevel}
            </div>
          )}
        </div>
      </div>
      
      <div className="p-1.5 space-y-1.5">
        {/* THREAT ASSESSMENT */}
        {aiAnalysis && (
          <ThreatIndicator 
            level={aiAnalysis.threatLevel}
            direction={telemetry?.threat_direction}
            sectors={aiAnalysis.situationalAwareness.ambush_risk_sectors}
          />
        )}
        
        {/* AI TACTICAL ADVICE */}
        {aiAnalysis && (
          <div className="rounded-lg p-2 border" style={{ background: 'rgba(70, 130, 180, 0.15)', borderColor: COLORS.info }}>
            <div className="flex items-center gap-2 mb-1.5">
              <span>🤖</span>
              <span className="text-[8px] font-bold uppercase" style={{ color: COLORS.info }}>AI TACTICAL ANALYSIS</span>
            </div>
            
            <div className="p-1.5 rounded mb-2" style={{ background: 'rgba(0,0,0,0.4)' }}>
              <div className="text-[10px] mb-1" style={{ color: COLORS.text }}>{aiAnalysis.tacticalAdvice}</div>
              <div className="text-[8px]" style={{ color: COLORS.muted }}>{aiAnalysis.commandNotes}</div>
            </div>
            
            <div className="grid grid-cols-5 gap-1 mb-2">
              <MicroMetric label="ETA" value={aiAnalysis.predictions.eta_destination} color={COLORS.accent} />
              <MicroMetric label="FUEL@DST" value={`${aiAnalysis.predictions.fuel_at_arrival_pct.toFixed(0)}%`} 
                          color={aiAnalysis.predictions.fuel_at_arrival_pct < 15 ? COLORS.alert : COLORS.success} />
              <MicroMetric label="BRKDN%" value={`${(aiAnalysis.predictions.breakdown_probability * 100).toFixed(1)}%`}
                          color={aiAnalysis.predictions.breakdown_probability > 0.1 ? COLORS.warning : COLORS.success} />
              <MicroMetric label="TERRAIN" value={aiAnalysis.predictions.terrain_difficulty} 
                          color={aiAnalysis.predictions.terrain_difficulty === 'SEVERE' ? COLORS.alert : COLORS.info} />
              <MicroMetric label="WEATHER" value={aiAnalysis.predictions.weather_impact}
                          color={aiAnalysis.predictions.weather_impact === 'SIGNIFICANT' ? COLORS.warning : COLORS.success} />
            </div>
            
            {/* Alerts */}
            {aiAnalysis.alerts.slice(0, 3).map((alert, i) => (
              <div key={i} className={`flex items-center gap-2 p-1.5 rounded text-[9px] mb-1 ${alert.severity === 'critical' || alert.severity === 'emergency' ? 'animate-pulse' : ''}`}
                   style={{ 
                     background: alert.severity === 'critical' || alert.severity === 'emergency' ? 'rgba(220, 38, 38, 0.2)' : 
                               alert.severity === 'warning' ? 'rgba(205, 127, 50, 0.2)' : 'rgba(70, 130, 180, 0.2)',
                     borderLeft: `3px solid ${alert.severity === 'critical' || alert.severity === 'emergency' ? COLORS.alert : 
                                              alert.severity === 'warning' ? COLORS.warning : COLORS.info}`
                   }}>
                <span>{alert.severity === 'critical' || alert.severity === 'emergency' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️'}</span>
                <div className="flex-1">
                  <span style={{ color: COLORS.text }}>{alert.message}</span>
                  <span className="ml-2" style={{ color: COLORS.muted }}>→ {alert.action_required}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* JANUS PRO 7B DEEP AI ANALYSIS */}
        {janusAnalysis && (
          <div className="rounded-lg p-2 border" style={{ 
            background: 'linear-gradient(135deg, rgba(138, 43, 226, 0.15) 0%, rgba(75, 0, 130, 0.2) 100%)', 
            borderColor: '#9932CC'
          }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">🧠</span>
                <span className="text-[8px] font-bold uppercase" style={{ color: '#9932CC' }}>JANUS PRO 7B AI</span>
                {janusLoading && <span className="text-[8px] animate-pulse" style={{ color: '#00FFFF' }}>ANALYZING...</span>}
              </div>
              <div className="flex items-center gap-2 text-[7px]" style={{ color: COLORS.muted }}>
                <span className={`w-1.5 h-1.5 rounded-full ${janusAnalysis.gpu_accelerated ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <span>{janusAnalysis.gpu_accelerated ? 'GPU' : 'CPU'}</span>
                <span style={{ color: '#00FFFF' }}>{janusAnalysis.model}</span>
              </div>
            </div>
            
            {/* Threat Assessment */}
            <div className="mb-2 p-1.5 rounded" style={{
              background: janusAnalysis.threat_assessment.threat_level === 'CRITICAL' ? 'rgba(220,38,38,0.3)' :
                         janusAnalysis.threat_assessment.threat_level === 'HIGH' ? 'rgba(205,127,50,0.3)' :
                         janusAnalysis.threat_assessment.threat_level === 'MEDIUM' ? 'rgba(70,130,180,0.3)' : 'rgba(34,139,34,0.3)'
            }}>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold" style={{
                  color: janusAnalysis.threat_assessment.threat_level === 'CRITICAL' ? COLORS.alert :
                         janusAnalysis.threat_assessment.threat_level === 'HIGH' ? COLORS.warning : COLORS.success
                }}>
                  {janusAnalysis.threat_assessment.threat_level} THREAT
                </span>
                <span className="text-[8px]" style={{ color: COLORS.muted }}>
                  Score: {janusAnalysis.threat_assessment.threat_score}/100 | {janusAnalysis.threat_assessment.vehicle_status}
                </span>
              </div>
              {janusAnalysis.threat_assessment.factors.slice(0, 2).map((factor, i) => (
                <div key={i} className="text-[8px] pl-2 mt-0.5" style={{ color: COLORS.text }}>• {factor}</div>
              ))}
            </div>
            
            {/* AI Recommendations */}
            <div className="space-y-1 mb-2">
              {janusAnalysis.recommendations.slice(0, 4).map((rec, i) => (
                <div key={i} className="text-[8px] p-1 rounded flex items-start gap-1.5" style={{
                  background: rec.priority === 'CRITICAL' ? 'rgba(220,38,38,0.15)' :
                             rec.priority === 'HIGH' ? 'rgba(205,127,50,0.15)' :
                             rec.priority === 'TACTICAL' ? 'rgba(138,43,226,0.15)' : 'rgba(0,0,0,0.3)'
                }}>
                  <span className="text-[7px] font-bold whitespace-nowrap" style={{
                    color: rec.priority === 'CRITICAL' ? COLORS.alert :
                           rec.priority === 'HIGH' ? COLORS.warning :
                           rec.priority === 'TACTICAL' ? '#9932CC' : COLORS.info
                  }}>
                    [{rec.priority}]
                  </span>
                  <span style={{ color: COLORS.text }}>{rec.text}</span>
                </div>
              ))}
            </div>
            
            <div className="text-[7px] flex justify-between pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)', color: COLORS.muted }}>
              <span>Generated by: {janusAnalysis.generated_by}</span>
              <span>Confidence: {(janusAnalysis.confidence * 100).toFixed(0)}%</span>
            </div>
          </div>
        )}
        
        {/* PRIMARY TELEMETRY GAUGES */}
        <div className="rounded-lg p-2 border" style={{ background: COLORS.panel, borderColor: COLORS.border }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span>⚡</span>
            <span className="text-[8px] font-bold uppercase" style={{ color: COLORS.accent }}>REAL-TIME TELEMETRY</span>
          </div>
          
          <div className="grid grid-cols-6 gap-0.5">
            <UHFGauge value={telemetry?.velocity_kmh || 0} max={120} label="SPEED" icon="🏎️" 
                      prevValue={prevTelemetry?.velocity_kmh}
                      status={(telemetry?.velocity_kmh || 0) > 80 ? 'warning' : 'normal'} />
            <UHFGauge value={telemetry?.engine_rpm || 0} max={4500} label="RPM" icon="⚙️"
                      prevValue={prevTelemetry?.engine_rpm}
                      status={(telemetry?.engine_rpm || 0) > 3500 ? 'warning' : 'normal'} />
            <UHFGauge value={telemetry?.engine_temp_c || 0} max={130} label="ENG°C" icon="🌡️"
                      prevValue={prevTelemetry?.engine_temp_c}
                      status={(telemetry?.engine_temp_c || 0) > 100 ? 'critical' : (telemetry?.engine_temp_c || 0) > 90 ? 'warning' : 'normal'} />
            <UHFGauge value={telemetry?.fuel_percent || 0} max={100} label="FUEL" icon="⛽"
                      prevValue={prevTelemetry?.fuel_percent}
                      status={(telemetry?.fuel_percent || 0) < 20 ? 'critical' : (telemetry?.fuel_percent || 0) < 35 ? 'warning' : 'normal'} />
            <UHFGauge value={telemetry?.throttle_position || 0} max={100} label="THRTL" icon="🎚️"
                      prevValue={prevTelemetry?.throttle_position} />
            <UHFGauge value={telemetry?.engine_load_pct || 0} max={100} label="LOAD" icon="📊"
                      prevValue={prevTelemetry?.engine_load_pct}
                      status={(telemetry?.engine_load_pct || 0) > 85 ? 'warning' : 'normal'} />
          </div>
        </div>
        
        {/* OSCILLOSCOPE DISPLAYS */}
        <div className="rounded-lg p-2 border" style={{ background: COLORS.panel, borderColor: COLORS.border }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span>📊</span>
            <span className="text-[8px] font-bold uppercase" style={{ color: COLORS.accent }}>REAL-TIME WAVEFORMS</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <Oscilloscope data={history.speed} color={COLORS.success} label="VELOCITY" 
                         currentValue={telemetry?.velocity_kmh} unit="km/h" />
            <Oscilloscope data={history.rpm} color={COLORS.cyan} label="ENGINE RPM"
                         currentValue={telemetry?.engine_rpm} unit="" />
            <Oscilloscope data={history.acceleration} color={COLORS.warning} label="ACCELERATION"
                         currentValue={telemetry?.acceleration_ms2} unit="m/s²" />
            <Oscilloscope data={history.fuelFlow} color={COLORS.orange} label="FUEL FLOW"
                         currentValue={telemetry?.fuel_flow_lph} unit="L/h" />
          </div>
        </div>
        
        {/* DRIVETRAIN */}
        <div className="rounded-lg p-2 border" style={{ background: COLORS.panel, borderColor: COLORS.border }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span>🔧</span>
            <span className="text-[8px] font-bold uppercase" style={{ color: COLORS.accent }}>DRIVETRAIN & BRAKES</span>
          </div>
          
          <div className="grid grid-cols-8 gap-1 mb-2">
            <MicroMetric label="GEAR" value={telemetry?.gear || 0} color={COLORS.cyan} />
            <MicroMetric label="TRQ" value={(telemetry?.torque_nm || 0).toFixed(0)} unit="Nm" color={COLORS.warning} />
            <MicroMetric label="TRANS" value={`${telemetry?.transmission_temp_c || 0}°`} 
                        color={(telemetry?.transmission_temp_c || 0) > 100 ? COLORS.warning : COLORS.success} />
            <MicroMetric label="FR-BRK" value={`${telemetry?.brake_temps_c?.[0]?.toFixed(0) || 0}°`}
                        color={(telemetry?.brake_temps_c?.[0] || 0) > 200 ? COLORS.alert : COLORS.success}
                        pulse={(telemetry?.brake_temps_c?.[0] || 0) > 200} />
            <MicroMetric label="RR-BRK" value={`${telemetry?.brake_temps_c?.[2]?.toFixed(0) || 0}°`}
                        color={(telemetry?.brake_temps_c?.[2] || 0) > 180 ? COLORS.alert : COLORS.success} />
            <MicroMetric label="ABS" value={telemetry?.abs_active ? 'ACTIVE' : 'STBY'}
                        color={telemetry?.abs_active ? COLORS.warning : COLORS.muted}
                        pulse={telemetry?.abs_active} />
            <MicroMetric label="OIL-P" value={(telemetry?.oil_pressure_psi || 0).toFixed(0)} unit="psi"
                        color={(telemetry?.oil_pressure_psi || 0) < 30 ? COLORS.alert : COLORS.success} />
            <MicroMetric label="OIL-T" value={`${telemetry?.oil_temp_c || 0}°`}
                        color={(telemetry?.oil_temp_c || 0) > 110 ? COLORS.warning : COLORS.success} />
          </div>
          
          {/* Tire status */}
          <div className="text-[7px] uppercase mb-1" style={{ color: COLORS.muted }}>TIRE STATUS (FL/FR/RL/RR)</div>
          <div className="grid grid-cols-4 gap-1">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="p-1 rounded text-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
                <div className="text-[7px]" style={{ color: COLORS.muted }}>{['FL', 'FR', 'RL', 'RR'][i]}</div>
                <div className="text-[9px] font-mono" style={{ color: COLORS.success }}>
                  {telemetry?.tire_pressures_psi?.[i]?.toFixed(0) || 35}psi
                </div>
                <div className="text-[8px]" style={{ color: (telemetry?.tire_temps_c?.[i] || 0) > 60 ? COLORS.warning : COLORS.muted }}>
                  {telemetry?.tire_temps_c?.[i]?.toFixed(0) || 40}°C
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* ALTITUDE & ENVIRONMENTAL HAZARDS */}
        {telemetry && (
          <AltitudeHazards 
            altitude={telemetry.altitude_m}
            o2Level={telemetry.oxygen_level_cabin_pct}
            acclimatization={telemetry.altitude_acclimatization_status}
            temperature={telemetry.ambient_temp_c}
            deIcing={telemetry.de_icing_active}
            snowChains={telemetry.snow_chain_mounted}
          />
        )}
        
        {/* SUPPLY CHAIN STATUS */}
        <div className="rounded-lg p-2 border" style={{ background: COLORS.panel, borderColor: COLORS.border }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span>📦</span>
            <span className="text-[8px] font-bold uppercase" style={{ color: COLORS.accent }}>SUPPLY & LOGISTICS</span>
            {aiAnalysis && (
              <span className="ml-auto px-1 py-0.5 rounded text-[7px]" 
                    style={{ 
                      background: aiAnalysis.logistics.supply_status === 'GREEN' ? 'rgba(74, 222, 128, 0.2)' :
                                 aiAnalysis.logistics.supply_status === 'AMBER' ? 'rgba(205, 127, 50, 0.2)' : 'rgba(220, 38, 38, 0.2)',
                      color: aiAnalysis.logistics.supply_status === 'GREEN' ? COLORS.success :
                             aiAnalysis.logistics.supply_status === 'AMBER' ? COLORS.warning : COLORS.alert
                    }}>
                {aiAnalysis.logistics.supply_status}
              </span>
            )}
          </div>
          
          {telemetry && (
            <SupplyStatus 
              rations={telemetry.ration_days_remaining}
              water={telemetry.water_liters}
              ammo={telemetry.ammo_status_pct}
              medical={telemetry.medical_kit_status}
              fuel={telemetry.fuel_percent}
            />
          )}
        </div>
        
        {/* CONVOY FORMATION */}
        <div className="rounded-lg p-2 border" style={{ background: COLORS.panel, borderColor: COLORS.border }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span>🚛</span>
            <span className="text-[8px] font-bold uppercase" style={{ color: COLORS.accent }}>CONVOY FORMATION</span>
          </div>
          
          {telemetry && (
            <FormationDisplay 
              distance={telemetry.inter_vehicle_distance_m}
              integrity={telemetry.formation_integrity_pct}
              visualContact={telemetry.visual_contact_status}
            />
          )}
        </div>
        
        {/* TACTICAL SUPPORT */}
        {aiAnalysis && (
          <div className="rounded-lg p-2 border" style={{ background: 'rgba(139, 0, 0, 0.1)', borderColor: COLORS.alert }}>
            <div className="flex items-center gap-2 mb-1.5">
              <span>🎖️</span>
              <span className="text-[8px] font-bold uppercase" style={{ color: COLORS.alert }}>TACTICAL SUPPORT</span>
            </div>
            
            <SupportStatus 
              qrfDistance={aiAnalysis.situationalAwareness.nearest_qrf_km}
              medicalDistance={aiAnalysis.situationalAwareness.nearest_medical_km}
              artilleryCoverage={aiAnalysis.situationalAwareness.artillery_coverage}
              airSupportEta={aiAnalysis.situationalAwareness.air_support_eta_min}
            />
          </div>
        )}
        
        {/* COMMUNICATIONS */}
        <div className="rounded-lg p-2 border" style={{ background: COLORS.panel, borderColor: COLORS.border }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span>📡</span>
            <span className="text-[8px] font-bold uppercase" style={{ color: COLORS.accent }}>COMMS & EW</span>
          </div>
          
          <div className="grid grid-cols-6 gap-1">
            <MicroMetric label="RADIO" value={`${telemetry?.radio_signal_strength_pct || 0}%`}
                        color={(telemetry?.radio_signal_strength_pct || 0) < 30 ? COLORS.warning : COLORS.success} />
            <MicroMetric label="SATCOM" value={telemetry?.satcom_active ? 'LINK' : 'N/C'}
                        color={telemetry?.satcom_active ? COLORS.success : COLORS.alert} />
            <MicroMetric label="CRYPTO" value={telemetry?.encryption_status || 'AES'}
                        color={COLORS.info} />
            <MicroMetric label="LAT" value={(telemetry?.network_latency_ms || 0).toFixed(0)} unit="ms"
                        color={(telemetry?.network_latency_ms || 0) > 100 ? COLORS.warning : COLORS.success} />
            <MicroMetric label="IFF" value={telemetry?.iff_status || 'OFF'}
                        color={telemetry?.iff_status === 'ACTIVE' ? COLORS.success : COLORS.muted} />
            <MicroMetric label="JAM" value={telemetry?.jammer_active ? 'DETCTD' : 'CLEAR'}
                        color={telemetry?.jammer_active ? COLORS.alert : COLORS.success}
                        pulse={telemetry?.jammer_active} />
          </div>
          
          {telemetry?.jammer_active && (
            <div className="mt-2 p-1.5 rounded animate-pulse" 
                 style={{ background: 'rgba(220, 38, 38, 0.3)', border: `1px solid ${COLORS.alert}` }}>
              <div className="text-[10px] font-bold text-center" style={{ color: COLORS.alert }}>
                ⚠️ ELECTRONIC WARFARE ACTIVITY DETECTED
              </div>
            </div>
          )}
        </div>
        
        {/* DEFENSIVE SYSTEMS */}
        <div className="rounded-lg p-2 border" style={{ background: 'rgba(139, 0, 0, 0.15)', borderColor: COLORS.alert }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span>🛡️</span>
            <span className="text-[8px] font-bold uppercase" style={{ color: COLORS.alert }}>DEFENSIVE SYSTEMS</span>
          </div>
          
          <div className="grid grid-cols-6 gap-1 mb-1.5">
            <MicroMetric label="ARMOR" value={`${telemetry?.armor_integrity_pct || 0}%`}
                        color={(telemetry?.armor_integrity_pct || 0) < 80 ? COLORS.warning : COLORS.success} />
            <MicroMetric label="THERMAL" value={telemetry?.thermal_signature_level || 'MED'}
                        color={telemetry?.thermal_signature_level === 'HIGH' ? COLORS.warning : COLORS.success} />
            <MicroMetric label="ACOUSTIC" value={`${telemetry?.acoustic_db || 0}dB`}
                        color={(telemetry?.acoustic_db || 0) > 80 ? COLORS.warning : COLORS.success} />
            <MicroMetric label="RCS" value={(telemetry?.radar_cross_section_m2 || 0).toFixed(1)} unit="m²"
                        color={COLORS.info} />
            <MicroMetric label="SMOKE" value={telemetry?.smoke_charges || 0}
                        color={(telemetry?.smoke_charges || 0) < 2 ? COLORS.warning : COLORS.success} />
            <MicroMetric label="FLARE" value={telemetry?.flare_count || 0}
                        color={(telemetry?.flare_count || 0) < 3 ? COLORS.warning : COLORS.success} />
          </div>
          
          {telemetry?.threat_direction && (
            <div className="p-1.5 rounded animate-pulse" 
                 style={{ background: 'rgba(220, 38, 38, 0.3)' }}>
              <div className="text-[10px] font-bold text-center" style={{ color: COLORS.alert }}>
                ⚠️ THREAT DETECTED: {telemetry.threat_direction}
              </div>
            </div>
          )}
        </div>
        
        {/* CREW STATUS */}
        <div className="rounded-lg p-2 border" style={{ background: COLORS.panel, borderColor: COLORS.border }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span>👥</span>
            <span className="text-[8px] font-bold uppercase" style={{ color: COLORS.accent }}>CREW STATUS</span>
          </div>
          
          <div className="grid grid-cols-4 gap-1">
            <MicroMetric label="FATIGUE" value={`${telemetry?.driver_fatigue_pct || 0}%`}
                        color={(telemetry?.driver_fatigue_pct || 0) > 60 ? COLORS.alert : 
                               (telemetry?.driver_fatigue_pct || 0) > 40 ? COLORS.warning : COLORS.success}
                        pulse={(telemetry?.driver_fatigue_pct || 0) > 60} />
            <MicroMetric label="ALERT" value={`${((telemetry?.crew_alertness || 1) * 100).toFixed(0)}%`}
                        color={(telemetry?.crew_alertness || 1) < 0.6 ? COLORS.warning : COLORS.success} />
            <MicroMetric label="STRESS" value={`${((telemetry?.driver_stress_level || 0) * 100).toFixed(0)}%`}
                        color={(telemetry?.driver_stress_level || 0) > 0.7 ? COLORS.warning : COLORS.success} />
            <MicroMetric label="O₂ LVL" value={`${telemetry?.oxygen_level_cabin_pct?.toFixed(0) || 98}%`}
                        color={(telemetry?.oxygen_level_cabin_pct || 98) < 90 ? COLORS.warning : COLORS.success} />
          </div>
        </div>
        
        {/* NAVIGATION */}
        <div className="rounded-lg p-2 border" style={{ background: COLORS.panel, borderColor: COLORS.border }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span>🛰️</span>
            <span className="text-[8px] font-bold uppercase" style={{ color: COLORS.accent }}>NAVIGATION</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="p-1.5 rounded" style={{ background: 'rgba(0,0,0,0.4)' }}>
              <div className="text-[7px]" style={{ color: COLORS.muted }}>POSITION (WGS84)</div>
              <div className="text-[10px] font-mono" style={{ color: COLORS.success }}>
                {(telemetry?.latitude || 0).toFixed(6)}°N
              </div>
              <div className="text-[10px] font-mono" style={{ color: COLORS.success }}>
                {(telemetry?.longitude || 0).toFixed(6)}°E
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <MicroMetric label="HDG" value={`${telemetry?.heading_deg?.toFixed(0) || 0}°`} color={COLORS.info} />
              <MicroMetric label="ALT" value={(telemetry?.altitude_m || 0).toFixed(0)} unit="m" color={COLORS.info} />
              <MicroMetric label="GRAD" value={`${telemetry?.gradient_deg?.toFixed(1) || 0}°`} 
                          color={(telemetry?.gradient_deg || 0) > 15 ? COLORS.warning : COLORS.success} />
              <MicroMetric label="RANGE" value={(telemetry?.range_remaining_km || 0).toFixed(0)} unit="km"
                          color={(telemetry?.range_remaining_km || 0) < 50 ? COLORS.warning : COLORS.success} />
            </div>
          </div>
        </div>
        
        {/* POWER SYSTEMS */}
        <div className="rounded-lg p-2 border" style={{ background: COLORS.panel, borderColor: COLORS.border }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span>🔋</span>
            <span className="text-[8px] font-bold uppercase" style={{ color: COLORS.accent }}>POWER SYSTEMS</span>
          </div>
          
          <div className="grid grid-cols-5 gap-1">
            <MicroMetric label="BAT-V" value={(telemetry?.battery_voltage || 0).toFixed(1)} unit="V"
                        color={(telemetry?.battery_voltage || 0) < 22 ? COLORS.warning : COLORS.success} />
            <MicroMetric label="SOC" value={`${telemetry?.battery_soc_pct || 0}%`}
                        color={(telemetry?.battery_soc_pct || 0) < 30 ? COLORS.warning : COLORS.success} />
            <MicroMetric label="ALT-A" value={(telemetry?.alternator_output_a || 0).toFixed(0)} unit="A"
                        color={COLORS.info} />
            <MicroMetric label="LOAD" value={(telemetry?.total_electrical_load_w || 0).toFixed(0)} unit="W"
                        color={(telemetry?.total_electrical_load_w || 0) > 1200 ? COLORS.warning : COLORS.success} />
            <MicroMetric label="HEAT" value={telemetry?.heater_status || 'OFF'}
                        color={telemetry?.heater_status === 'ON' ? COLORS.orange : COLORS.muted} />
          </div>
        </div>
        
        {/* ENVIRONMENT */}
        <div className="rounded-lg p-2 border" style={{ background: COLORS.panel, borderColor: COLORS.border }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span>🌤️</span>
            <span className="text-[8px] font-bold uppercase" style={{ color: COLORS.accent }}>ENVIRONMENT</span>
          </div>
          
          <div className="grid grid-cols-6 gap-1">
            <MicroMetric label="TEMP" value={`${telemetry?.ambient_temp_c || 0}°`}
                        color={(telemetry?.ambient_temp_c || 0) < 0 ? COLORS.ice : 
                               (telemetry?.ambient_temp_c || 0) > 40 ? COLORS.orange : COLORS.success} />
            <MicroMetric label="HUMID" value={`${telemetry?.humidity_pct || 0}%`} color={COLORS.info} />
            <MicroMetric label="VIS" value={((telemetry?.visibility_m || 10000) / 1000).toFixed(1)} unit="km"
                        color={(telemetry?.visibility_m || 10000) < 500 ? COLORS.alert : COLORS.success} />
            <MicroMetric label="WIND" value={(telemetry?.wind_speed_ms || 0).toFixed(0)} unit="m/s"
                        color={(telemetry?.wind_speed_ms || 0) > 15 ? COLORS.warning : COLORS.success} />
            <MicroMetric label="RAIN" value={(telemetry?.precipitation_mm_hr || 0).toFixed(1)} unit="mm/h"
                        color={(telemetry?.precipitation_mm_hr || 0) > 5 ? COLORS.warning : COLORS.success} />
            <MicroMetric label="GRIP" value={`${((telemetry?.road_friction || 0.7) * 100).toFixed(0)}%`}
                        color={(telemetry?.road_friction || 0.7) < 0.5 ? COLORS.warning : COLORS.success} />
          </div>
        </div>
        
        {/* AI RECOMMENDATIONS */}
        {aiAnalysis && aiAnalysis.recommendations.length > 0 && (
          <div className="rounded-lg p-2 border" style={{ background: 'rgba(70, 130, 180, 0.1)', borderColor: COLORS.info }}>
            <div className="flex items-center gap-2 mb-1.5">
              <span>💡</span>
              <span className="text-[8px] font-bold uppercase" style={{ color: COLORS.info }}>AI RECOMMENDATIONS</span>
            </div>
            
            <div className="space-y-1">
              {aiAnalysis.recommendations.map((rec, i) => (
                <div key={i} className="flex items-center gap-2 text-[9px] p-1 rounded"
                     style={{ background: 'rgba(0,0,0,0.3)' }}>
                  <span style={{ color: COLORS.accent }}>▸</span>
                  <span style={{ color: COLORS.text }}>{rec}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* FOOTER */}
        <div className="text-center py-1.5 text-[7px]" style={{ color: COLORS.muted }}>
          INDIAN ARMY TACTICAL METRICS v4.0 • {getUpdateInterval()}ms REFRESH • {updateCount} FRAMES • {frameTime.toFixed(0)}ms LATENCY
        </div>
      </div>
    </div>
  );
}
