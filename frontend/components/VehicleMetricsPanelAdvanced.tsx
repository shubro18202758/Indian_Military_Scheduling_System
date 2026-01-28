'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

const API_V1 = '/api/proxy/v1';

// ============================================================================
// INTERFACES
// ============================================================================

interface VehicleTelemetry {
  id: number;
  name: string;
  callsign?: string;
  asset_type: string;
  category: string;
  lat: number;
  lng: number;
  bearing: number;
  speed_kmh: number;
  status: string;
  formation_position: number;
  fuel_percent: number;
  fuel_type: string;
  range_remaining_km: number;
  capacity_tons: number;
  max_personnel: number;
  max_speed_kmh: number;
  has_radio: boolean;
  has_gps: boolean;
  convoy_id: number;
}

interface MetricsData {
  vehicle_id: number;
  vehicle_type: string;
  timestamp: string;
  position: { lat: number; lng: number; altitude_m: number; bearing_degrees: number; speed_kmh: number };
  gps: { accuracy_m: number; satellites: number; signal_strength: number; hdop: number; fix_type: string };
  engine: { rpm: number; temperature_c: number; oil_pressure_psi: number; throttle_percent: number; load_percent: number; stress_level: number; efficiency: number };
  fuel: { level_liters: number; level_percent: number; consumption_lph: number; consumption_kpl: number; range_km: number; fuel_type: string };
  communications: { radio_strength: number; frequency_mhz: number; latency_ms: number; data_rate_kbps: number; encryption: string; is_jammed: boolean };
  environment: { temperature_c: number; humidity_percent: number; visibility_km: number; road_condition: string; traction: number; wind_speed_kmh: number; precipitation_mm_hr: number };
  maintenance: { engine_hours: number; km_since_service: number; next_service_km: number; brake_wear_percent: number; tire_wear_percent: number; breakdown_probability: number; alerts: string[] };
  operational: { total_distance_km: number; load_weight_kg: number; personnel_count: number; terrain: string; weather: string; gradient_percent: number };
}

interface HistoryPoint {
  timestamp: number;
  speed_kmh: number;
  fuel_percent: number;
  engine_temp_celsius: number;
  rpm: number;
  signal_strength: number;
  altitude_m: number;
}

interface VehicleMetricsPanelAdvancedProps {
  vehicleId: number | null;
  vehicleName?: string;
  onClose?: () => void;
}

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

// Animated Circular Gauge
const CircularGauge: React.FC<{
  value: number;
  max: number;
  label: string;
  unit: string;
  color: string;
  warningThreshold?: number;
  criticalThreshold?: number;
  size?: number;
  showTrend?: 'up' | 'down' | 'stable';
}> = ({ value, max, label, unit, color, warningThreshold, criticalThreshold, size = 90, showTrend }) => {
  const percentage = Math.min((value / max) * 100, 100);
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  const getColor = () => {
    if (criticalThreshold && value >= criticalThreshold) return '#ef4444';
    if (warningThreshold && value >= warningThreshold) return '#f59e0b';
    return color;
  };
  
  const trendIcon = showTrend === 'up' ? '↑' : showTrend === 'down' ? '↓' : '→';
  const trendColor = showTrend === 'up' ? '#22c55e' : showTrend === 'down' ? '#ef4444' : '#6b7280';
  
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox="0 0 90 90">
        <defs>
          <filter id={`glow-${label}`}>
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        {/* Background circle */}
        <circle cx="45" cy="45" r="36" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6"/>
        {/* Progress circle */}
        <circle
          cx="45" cy="45" r="36" fill="none"
          stroke={getColor()}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 45 45)"
          filter={`url(#glow-${label})`}
          style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
        />
        {/* Center value */}
        <text x="45" y="40" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold" fontFamily="monospace">
          {value.toFixed(0)}
        </text>
        <text x="45" y="54" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="9" fontFamily="monospace">
          {unit}
        </text>
        {/* Trend indicator */}
        {showTrend && (
          <text x="45" y="68" textAnchor="middle" fill={trendColor} fontSize="10">
            {trendIcon}
          </text>
        )}
      </svg>
      <div className="text-gray-400 text-[10px] mt-1 uppercase tracking-wider text-center">{label}</div>
    </div>
  );
};

// Real-time Sparkline Chart
const SparklineChart: React.FC<{
  data: number[];
  color: string;
  height?: number;
  showArea?: boolean;
}> = ({ data, color, height = 40, showArea = true }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const h = canvas.height;
    const min = Math.min(...data) * 0.9;
    const max = Math.max(...data) * 1.1;
    
    ctx.clearRect(0, 0, width, h);
    
    // Draw area
    if (showArea) {
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, color + '40');
      gradient.addColorStop(1, 'transparent');
      
      ctx.beginPath();
      ctx.moveTo(0, h);
      data.forEach((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = h - ((val - min) / (max - min)) * h;
        ctx.lineTo(x, y);
      });
      ctx.lineTo(width, h);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
    }
    
    // Draw line
    ctx.beginPath();
    data.forEach((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = h - ((val - min) / (max - min)) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    
    // Glow effect
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.stroke();
    
  }, [data, color, height, showArea]);
  
  return <canvas ref={canvasRef} width={200} height={height} style={{ width: '100%', height: `${height}px` }} />;
};

// Advanced Analysis Card
const AnalysisCard: React.FC<{
  title: string;
  icon: string;
  value: string | number;
  subValue?: string;
  status: 'good' | 'warning' | 'critical' | 'info';
  prediction?: string;
}> = ({ title, icon, value, subValue, status, prediction }) => {
  const statusColors = {
    good: { bg: 'rgba(34, 197, 94, 0.1)', border: '#22c55e', text: '#22c55e' },
    warning: { bg: 'rgba(245, 158, 11, 0.1)', border: '#f59e0b', text: '#f59e0b' },
    critical: { bg: 'rgba(239, 68, 68, 0.1)', border: '#ef4444', text: '#ef4444' },
    info: { bg: 'rgba(59, 130, 246, 0.1)', border: '#3b82f6', text: '#3b82f6' }
  };
  
  const colors = statusColors[status];
  
  return (
    <div 
      className="rounded-lg p-3 border transition-all hover:scale-[1.02]"
      style={{ background: colors.bg, borderColor: colors.border + '50' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg">{icon}</span>
        <div className={`w-2 h-2 rounded-full animate-pulse`} style={{ background: colors.border }} />
      </div>
      <div className="text-white font-bold text-xl font-mono" style={{ color: colors.text }}>
        {value}
      </div>
      <div className="text-gray-400 text-xs uppercase tracking-wider mt-1">{title}</div>
      {subValue && <div className="text-gray-500 text-xs mt-1">{subValue}</div>}
      {prediction && (
        <div className="mt-2 pt-2 border-t border-white/10">
          <div className="text-xs text-cyan-400 flex items-center gap-1">
            <span>🤖</span> {prediction}
          </div>
        </div>
      )}
    </div>
  );
};

// Status Bar with Segments
const SegmentedBar: React.FC<{
  value: number;
  max: number;
  label: string;
  color: string;
  showValue?: boolean;
}> = ({ value, max, label, color, showValue = true }) => {
  const percentage = Math.min((value / max) * 100, 100);
  const segments = 25;
  const filledSegments = Math.round((percentage / 100) * segments);
  
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-gray-400 text-xs uppercase tracking-wider">{label}</span>
        {showValue && <span className="font-mono text-xs" style={{ color }}>{value.toFixed(0)} / {max}</span>}
      </div>
      <div className="flex gap-0.5 h-2">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm transition-all duration-300"
            style={{
              background: i < filledSegments ? color : 'rgba(255,255,255,0.1)',
              boxShadow: i < filledSegments ? `0 0 4px ${color}60` : 'none'
            }}
          />
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function VehicleMetricsPanelAdvanced({ vehicleId, vehicleName, onClose }: VehicleMetricsPanelAdvancedProps) {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<{
    threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    missionReadiness: number;
    predictedIssues: string[];
    recommendations: string[];
    overallScore: number;
  } | null>(null);
  
  // Fetch metrics with dynamic simulation updates
  const fetchMetrics = useCallback(async () => {
    if (!vehicleId) return;
    
    try {
      // First push dynamic update to simulate movement
      const sim = simState.current;
      sim.updateCount++;
      
      // Simulate speed fluctuations
      sim.speedTrend += (Math.random() - 0.5) * 3;
      sim.speedTrend = Math.max(-12, Math.min(12, sim.speedTrend));
      const currentSpeed = Math.max(5, Math.min(85, sim.baseSpeed + sim.speedTrend + (Math.random() - 0.5) * 5));
      
      // Simulate position movement
      sim.baseLat += (currentSpeed / 111000) * 2 * (0.8 + Math.random() * 0.4);
      sim.baseLng += (currentSpeed / 111000) * 2 * (0.8 + Math.random() * 0.4);
      
      // Cycle through terrains and weather
      sim.terrainIndex += 0.02;
      sim.weatherIndex += 0.008;
      const terrains = ['MOUNTAIN', 'PLAINS', 'FOREST', 'URBAN', 'MOUNTAIN'];
      const weathers = ['CLEAR', 'CLEAR', 'OVERCAST', 'LIGHT_RAIN', 'CLEAR', 'FOG'];
      
      // Push update to backend
      await fetch(`${API_V1}/advanced/metrics/update/${vehicleId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          speed_kmh: currentSpeed,
          lat: sim.baseLat + (Math.random() - 0.5) * 0.0005,
          lng: sim.baseLng + (Math.random() - 0.5) * 0.0005,
          altitude_m: 3200 + Math.sin(sim.updateCount * 0.1) * 300 + (Math.random() - 0.5) * 50,
          terrain: terrains[Math.floor(sim.terrainIndex) % terrains.length],
          weather: weathers[Math.floor(sim.weatherIndex) % weathers.length],
          gradient_percent: Math.sin(sim.updateCount * 0.15) * 6 + (Math.random() - 0.5) * 3,
          delta_seconds: 2.0
        })
      });
      
      // Then fetch the updated metrics
      const response = await fetch(`${API_V1}/advanced/metrics/${vehicleId}`);
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
        setError(null);
        
        // Update history
        setHistory(prev => {
          const newPoint: HistoryPoint = {
            timestamp: Date.now(),
            speed_kmh: data.position?.speed_kmh || currentSpeed,
            fuel_percent: data.fuel?.level_percent || 0,
            engine_temp_celsius: data.engine?.temperature_c || 0,
            rpm: data.engine?.rpm || 0,
            signal_strength: data.communications?.radio_strength * 100 || 0,
            altitude_m: data.position?.altitude_m || 0
          };
          return [...prev, newPoint].slice(-60);
        });
        
        // Generate AI analysis
        generateAIAnalysis(data);
      } else if (response.status === 404) {
        // Vehicle not initialized, try to initialize it
        await initializeVehicle();
      }
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setError('Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);
  
  // Simulation state for dynamic updates
  const simState = useRef({
    baseSpeed: 35 + Math.random() * 25,
    speedTrend: 0,
    baseLat: 34.1526,
    baseLng: 77.5771,
    terrainIndex: 0,
    weatherIndex: 0,
    updateCount: 0
  });
  
  // Initialize vehicle for metrics tracking
  const initializeVehicle = useCallback(async () => {
    if (!vehicleId) return;
    
    // Randomize initial conditions for realism
    const initialFuel = 70 + Math.random() * 25;
    const initialLoad = 3000 + Math.random() * 4000;
    const vehicleTypes = ['TRUCK_CARGO', 'TRUCK_FUEL', 'APC', 'MRAP'];
    const vehicleType = vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)];
    
    try {
      await fetch(`${API_V1}/advanced/metrics/initialize/${vehicleId}?vehicle_type=${vehicleType}&fuel_percent=${initialFuel.toFixed(0)}&load_kg=${initialLoad.toFixed(0)}`, {
        method: 'POST'
      });
      
      // Now update with dynamic initial position
      const terrains = ['MOUNTAIN', 'PLAINS', 'FOREST', 'URBAN'];
      const weathers = ['CLEAR', 'OVERCAST', 'LIGHT_RAIN'];
      
      await fetch(`${API_V1}/advanced/metrics/update/${vehicleId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          speed_kmh: simState.current.baseSpeed,
          lat: simState.current.baseLat + (Math.random() - 0.5) * 0.01,
          lng: simState.current.baseLng + (Math.random() - 0.5) * 0.01,
          altitude_m: 3200 + Math.random() * 600,
          terrain: terrains[Math.floor(Math.random() * terrains.length)],
          weather: weathers[Math.floor(Math.random() * weathers.length)],
          gradient_percent: (Math.random() - 0.5) * 8,
          delta_seconds: 1.0
        })
      });
      
      // Fetch the metrics again
      await fetchMetrics();
    } catch (err) {
      console.error('Error initializing vehicle:', err);
    }
  }, [vehicleId, fetchMetrics]);
  
  // Generate AI-powered analysis
  const generateAIAnalysis = useCallback((data: MetricsData) => {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let threatScore = 0;
    let readinessScore = 100;
    
    // Fuel analysis
    const fuelPercent = data.fuel?.level_percent || 0;
    if (fuelPercent < 20) {
      issues.push('CRITICAL: Fuel level below 20%');
      recommendations.push('Immediate refueling required within 30km');
      threatScore += 30;
      readinessScore -= 25;
    } else if (fuelPercent < 40) {
      issues.push('WARNING: Fuel level below 40%');
      recommendations.push('Plan refueling at next supply point');
      threatScore += 15;
      readinessScore -= 10;
    }
    
    // Engine analysis
    const engineTemp = data.engine?.temperature_c || 0;
    if (engineTemp > 110) {
      issues.push('CRITICAL: Engine overheating');
      recommendations.push('Reduce speed and allow engine to cool');
      threatScore += 25;
      readinessScore -= 20;
    } else if (engineTemp > 95) {
      issues.push('WARNING: Engine temperature elevated');
      threatScore += 10;
      readinessScore -= 5;
    }
    
    // Engine stress
    const stressLevel = data.engine?.stress_level || 0;
    if (stressLevel > 0.8) {
      issues.push('Engine under high stress');
      recommendations.push('Consider reducing load or speed');
      threatScore += 15;
      readinessScore -= 10;
    }
    
    // Communications
    const radioStrength = (data.communications?.radio_strength || 0) * 100;
    if (radioStrength < 30) {
      issues.push('CRITICAL: Poor radio signal');
      recommendations.push('Move to higher ground for better signal');
      threatScore += 20;
      readinessScore -= 15;
    } else if (radioStrength < 60) {
      issues.push('Radio signal degraded');
      threatScore += 5;
    }
    
    if (data.communications?.is_jammed) {
      issues.push('⚠️ POSSIBLE JAMMING DETECTED');
      recommendations.push('Switch to backup frequency immediately');
      threatScore += 35;
      readinessScore -= 20;
    }
    
    // Maintenance
    const breakdownProb = (data.maintenance?.breakdown_probability || 0) * 100;
    if (breakdownProb > 10) {
      issues.push('Elevated breakdown risk');
      recommendations.push('Schedule preventive maintenance');
      threatScore += 15;
      readinessScore -= 10;
    }
    
    // Terrain/Environment
    if (data.environment?.visibility_km < 5) {
      issues.push('Reduced visibility conditions');
      recommendations.push('Maintain convoy spacing and reduce speed');
      threatScore += 10;
    }
    
    // Determine threat level
    let threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (threatScore >= 60) threatLevel = 'CRITICAL';
    else if (threatScore >= 40) threatLevel = 'HIGH';
    else if (threatScore >= 20) threatLevel = 'MEDIUM';
    
    // Add positive recommendations if no issues
    if (issues.length === 0) {
      recommendations.push('All systems operational - maintain current parameters');
    }
    
    // Calculate overall score
    const overallScore = Math.max(0, Math.min(100, readinessScore));
    
    setAiAnalysis({
      threatLevel,
      missionReadiness: overallScore,
      predictedIssues: issues,
      recommendations,
      overallScore
    });
  }, []);
  
  // Initial fetch and polling
  useEffect(() => {
    if (vehicleId) {
      setLoading(true);
      setHistory([]);
      fetchMetrics();
      
      const interval = setInterval(fetchMetrics, 2000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);
  
  // Calculate trends
  const calculateTrend = (values: number[]): 'up' | 'down' | 'stable' => {
    if (values.length < 5) return 'stable';
    const recent = values.slice(-5);
    const first = recent[0];
    const last = recent[recent.length - 1];
    const diff = ((last - first) / first) * 100;
    if (diff > 3) return 'up';
    if (diff < -3) return 'down';
    return 'stable';
  };
  
  // No vehicle selected
  if (!vehicleId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">📊</div>
          <div className="text-xl font-bold text-green-400 mb-2">Advanced Vehicle Analytics</div>
          <div className="text-gray-400">Select a vehicle from the list to view</div>
          <div className="text-gray-500 text-sm mt-1">real-time telemetry and AI analysis</div>
        </div>
      </div>
    );
  }
  
  // Loading state
  if (loading && !metrics) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-spin">⚙️</div>
          <div className="text-green-400 font-bold">Initializing Telemetry...</div>
          <div className="text-gray-500 text-sm mt-1">Connecting to vehicle #{vehicleId}</div>
        </div>
      </div>
    );
  }
  
  // Error state with retry
  if (error && !metrics) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <div className="text-red-400 font-bold">{error}</div>
          <button 
            onClick={() => { setLoading(true); fetchMetrics(); }}
            className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-white text-sm"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }
  
  // Extract data for charts
  const speedData = history.map(h => h.speed_kmh);
  const fuelData = history.map(h => h.fuel_percent);
  const tempData = history.map(h => h.engine_temp_celsius);
  const signalData = history.map(h => h.signal_strength);
  
  const threatColors = {
    LOW: '#22c55e',
    MEDIUM: '#f59e0b', 
    HIGH: '#ef4444',
    CRITICAL: '#dc2626'
  };
  
  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header with Vehicle Info */}
      <div className="sticky top-0 z-10 bg-gradient-to-b from-black via-black/95 to-transparent p-4 pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-600 to-emerald-600 flex items-center justify-center text-2xl shadow-lg shadow-green-500/20">
              🚛
            </div>
            <div>
              <h2 className="text-green-400 font-bold text-lg">{vehicleName || `Vehicle #${vehicleId}`}</h2>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-400 font-mono">{metrics?.vehicle_type || 'TRUCK_CARGO'}</span>
                <span className="w-1 h-1 rounded-full bg-gray-600" />
                <span className="text-gray-500">{metrics?.operational?.terrain || 'UNKNOWN'}</span>
              </div>
            </div>
          </div>
          
          {/* Overall Status Badge */}
          {aiAnalysis && (
            <div 
              className="px-4 py-2 rounded-lg border flex items-center gap-2"
              style={{ 
                background: threatColors[aiAnalysis.threatLevel] + '15',
                borderColor: threatColors[aiAnalysis.threatLevel] + '50'
              }}
            >
              <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: threatColors[aiAnalysis.threatLevel] }} />
              <div>
                <div className="text-xs text-gray-400">STATUS</div>
                <div className="font-bold text-sm" style={{ color: threatColors[aiAnalysis.threatLevel] }}>
                  {aiAnalysis.threatLevel === 'LOW' ? 'OPERATIONAL' : aiAnalysis.threatLevel}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="px-4 pb-4 space-y-4">
        {/* AI Mission Analysis */}
        {aiAnalysis && (
          <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 rounded-xl p-4 border border-cyan-500/30">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🤖</span>
              <h3 className="text-cyan-400 font-bold text-sm uppercase tracking-wider">AI Mission Analysis</h3>
              <div className="flex-1" />
              <div className="text-xs text-gray-500">Updated {new Date().toLocaleTimeString()}</div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-black/30 rounded-lg p-3 text-center">
                <div className="text-3xl font-bold font-mono" style={{ color: threatColors[aiAnalysis.threatLevel] }}>
                  {aiAnalysis.overallScore}%
                </div>
                <div className="text-xs text-gray-400 mt-1">MISSION READINESS</div>
              </div>
              <div className="bg-black/30 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-2">ACTIVE ALERTS</div>
                <div className="text-2xl font-bold" style={{ color: aiAnalysis.predictedIssues.length > 0 ? '#f59e0b' : '#22c55e' }}>
                  {aiAnalysis.predictedIssues.length}
                </div>
              </div>
            </div>
            
            {/* Issues & Recommendations */}
            {aiAnalysis.predictedIssues.length > 0 && (
              <div className="bg-black/30 rounded-lg p-3 mb-3">
                <div className="text-xs text-red-400 font-bold mb-2">⚠️ DETECTED ISSUES</div>
                {aiAnalysis.predictedIssues.map((issue, i) => (
                  <div key={i} className="text-xs text-gray-300 py-1 border-b border-white/5 last:border-0">
                    • {issue}
                  </div>
                ))}
              </div>
            )}
            
            <div className="bg-black/30 rounded-lg p-3">
              <div className="text-xs text-green-400 font-bold mb-2">💡 AI RECOMMENDATIONS</div>
              {aiAnalysis.recommendations.map((rec, i) => (
                <div key={i} className="text-xs text-gray-300 py-1 border-b border-white/5 last:border-0">
                  • {rec}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Real-time Telemetry Gauges */}
        <div className="bg-gray-900/50 rounded-xl p-4 border border-green-900/30">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">⚡</span>
            <h3 className="text-green-400 font-bold text-sm uppercase tracking-wider">Real-time Telemetry</h3>
          </div>
          
          <div className="grid grid-cols-4 gap-3">
            <CircularGauge
              value={metrics?.position?.speed_kmh || 0}
              max={120}
              label="Speed"
              unit="km/h"
              color="#22c55e"
              showTrend={calculateTrend(speedData)}
            />
            <CircularGauge
              value={metrics?.engine?.rpm || 0}
              max={5000}
              label="RPM"
              unit="rpm"
              color="#3b82f6"
              warningThreshold={4000}
              criticalThreshold={4500}
            />
            <CircularGauge
              value={metrics?.engine?.temperature_c || 0}
              max={150}
              label="Engine"
              unit="°C"
              color="#f59e0b"
              warningThreshold={95}
              criticalThreshold={110}
              showTrend={calculateTrend(tempData)}
            />
            <CircularGauge
              value={metrics?.fuel?.level_percent || 0}
              max={100}
              label="Fuel"
              unit="%"
              color={(metrics?.fuel?.level_percent || 0) < 25 ? '#ef4444' : '#22c55e'}
              showTrend={calculateTrend(fuelData)}
            />
          </div>
        </div>
        
        {/* Speed & Performance Chart */}
        <div className="bg-gray-900/50 rounded-xl p-4 border border-blue-900/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">📈</span>
              <h3 className="text-blue-400 font-bold text-sm uppercase tracking-wider">Speed Analysis</h3>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-green-400 font-mono">
                {(metrics?.position?.speed_kmh || 0).toFixed(1)} km/h
              </div>
              <div className="text-xs text-gray-500">Current Velocity</div>
            </div>
          </div>
          <SparklineChart data={speedData.length > 2 ? speedData : [0, 0, 0]} color="#22c55e" height={60} />
          <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-gray-500">AVG</div>
              <div className="text-green-400 font-mono">{speedData.length > 0 ? (speedData.reduce((a,b) => a+b, 0) / speedData.length).toFixed(1) : '0'} km/h</div>
            </div>
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-gray-500">MAX</div>
              <div className="text-yellow-400 font-mono">{speedData.length > 0 ? Math.max(...speedData).toFixed(1) : '0'} km/h</div>
            </div>
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-gray-500">EFFICIENCY</div>
              <div className="text-cyan-400 font-mono">{((metrics?.engine?.efficiency || 0) * 100).toFixed(0)}%</div>
            </div>
          </div>
        </div>
        
        {/* Fuel Analytics */}
        <div className="bg-gray-900/50 rounded-xl p-4 border border-yellow-900/30">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">⛽</span>
            <h3 className="text-yellow-400 font-bold text-sm uppercase tracking-wider">Fuel Status</h3>
          </div>
          
          <SegmentedBar
            value={metrics?.fuel?.level_liters || 0}
            max={300}
            label="Fuel Tank"
            color={(metrics?.fuel?.level_percent || 0) < 25 ? '#ef4444' : '#22c55e'}
          />
          
          <SparklineChart data={fuelData.length > 2 ? fuelData : [85, 85, 85]} color="#eab308" height={50} />
          
          <div className="grid grid-cols-2 gap-3 mt-3">
            <AnalysisCard
              icon="🛣️"
              title="Est. Range"
              value={`${(metrics?.fuel?.range_km || 0).toFixed(0)} km`}
              status={(metrics?.fuel?.range_km || 0) < 100 ? 'warning' : 'good'}
              prediction={`~${((metrics?.fuel?.range_km || 0) / (metrics?.position?.speed_kmh || 45)).toFixed(1)}h at current speed`}
            />
            <AnalysisCard
              icon="🔥"
              title="Consumption"
              value={`${(metrics?.fuel?.consumption_lph || 0).toFixed(1)} L/h`}
              subValue={`${(metrics?.fuel?.consumption_kpl || 0).toFixed(1)} km/L`}
              status={(metrics?.fuel?.consumption_lph || 0) > 20 ? 'warning' : 'good'}
            />
          </div>
        </div>
        
        {/* Engine Diagnostics */}
        <div className="bg-gray-900/50 rounded-xl p-4 border border-orange-900/30">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🔧</span>
            <h3 className="text-orange-400 font-bold text-sm uppercase tracking-wider">Engine Diagnostics</h3>
          </div>
          
          <SparklineChart data={tempData.length > 2 ? tempData : [85, 85, 85]} color="#f59e0b" height={50} />
          
          <div className="grid grid-cols-3 gap-2 mt-3">
            <AnalysisCard
              icon="🌡️"
              title="Temperature"
              value={`${(metrics?.engine?.temperature_c || 0).toFixed(0)}°C`}
              status={(metrics?.engine?.temperature_c || 0) > 100 ? 'critical' : (metrics?.engine?.temperature_c || 0) > 90 ? 'warning' : 'good'}
            />
            <AnalysisCard
              icon="⚙️"
              title="Load"
              value={`${(metrics?.engine?.load_percent || 0).toFixed(0)}%`}
              status={(metrics?.engine?.load_percent || 0) > 85 ? 'warning' : 'good'}
            />
            <AnalysisCard
              icon="🛢️"
              title="Oil Pressure"
              value={`${(metrics?.engine?.oil_pressure_psi || 0).toFixed(0)} PSI`}
              status={(metrics?.engine?.oil_pressure_psi || 0) < 25 ? 'critical' : 'good'}
            />
          </div>
          
          {/* Maintenance Alert */}
          {(metrics?.maintenance?.breakdown_probability || 0) > 0.05 && (
            <div className="mt-3 p-3 bg-yellow-900/30 border border-yellow-500/50 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-400 text-sm">
                <span>⚠️</span>
                <span className="font-bold">Maintenance Advisory</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Breakdown probability: {((metrics?.maintenance?.breakdown_probability || 0) * 100).toFixed(1)}%
                • Next service in {metrics?.maintenance?.next_service_km || 0} km
              </div>
            </div>
          )}
        </div>
        
        {/* Communications */}
        <div className="bg-gray-900/50 rounded-xl p-4 border border-purple-900/30">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">📡</span>
            <h3 className="text-purple-400 font-bold text-sm uppercase tracking-wider">Communications</h3>
          </div>
          
          <SparklineChart data={signalData.length > 2 ? signalData : [80, 80, 80]} color="#a855f7" height={50} />
          
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="bg-black/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-xs">RADIO SIGNAL</span>
                <span className="text-purple-400 font-mono text-lg font-bold">
                  {((metrics?.communications?.radio_strength || 0) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded overflow-hidden">
                <div 
                  className="h-full transition-all duration-500"
                  style={{ 
                    width: `${(metrics?.communications?.radio_strength || 0) * 100}%`,
                    background: 'linear-gradient(90deg, #a855f7, #6366f1)'
                  }}
                />
              </div>
            </div>
            <div className="bg-black/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${metrics?.communications?.encryption === 'AES-256' ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs text-gray-400">ENCRYPTION</span>
              </div>
              <div className="text-green-400 font-mono text-sm">{metrics?.communications?.encryption || 'NONE'}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-gray-500">Latency</div>
              <div className={`font-mono ${(metrics?.communications?.latency_ms || 0) > 100 ? 'text-yellow-400' : 'text-green-400'}`}>
                {(metrics?.communications?.latency_ms || 0).toFixed(0)} ms
              </div>
            </div>
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-gray-500">Frequency</div>
              <div className="text-cyan-400 font-mono">{(metrics?.communications?.frequency_mhz || 0).toFixed(1)} MHz</div>
            </div>
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-gray-500">Data Rate</div>
              <div className="text-blue-400 font-mono">{(metrics?.communications?.data_rate_kbps || 0).toFixed(0)} kbps</div>
            </div>
          </div>
          
          {metrics?.communications?.is_jammed && (
            <div className="mt-3 p-3 bg-red-900/50 border border-red-500 rounded-lg animate-pulse">
              <div className="text-red-400 font-bold text-sm">⚠️ JAMMING DETECTED</div>
              <div className="text-xs text-gray-400 mt-1">Switch to backup frequency immediately</div>
            </div>
          )}
        </div>
        
        {/* GPS & Position */}
        <div className="bg-gray-900/50 rounded-xl p-4 border border-cyan-900/30">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">📍</span>
            <h3 className="text-cyan-400 font-bold text-sm uppercase tracking-wider">GPS & Navigation</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black/30 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">COORDINATES</div>
              <div className="text-green-400 font-mono text-sm">{(metrics?.position?.lat || 0).toFixed(5)}°N</div>
              <div className="text-green-400 font-mono text-sm">{(metrics?.position?.lng || 0).toFixed(5)}°E</div>
            </div>
            <div className="bg-black/30 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">ALTITUDE</div>
              <div className="text-2xl font-bold text-blue-400 font-mono">{(metrics?.position?.altitude_m || 0).toFixed(0)}m</div>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-2 mt-3 text-xs">
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-gray-500">Satellites</div>
              <div className="text-green-400 font-mono">{metrics?.gps?.satellites || 0}</div>
            </div>
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-gray-500">Accuracy</div>
              <div className="text-yellow-400 font-mono">{(metrics?.gps?.accuracy_m || 0).toFixed(1)}m</div>
            </div>
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-gray-500">Heading</div>
              <div className="text-cyan-400 font-mono">{(metrics?.position?.bearing_degrees || 0).toFixed(0)}°</div>
            </div>
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-gray-500">Fix</div>
              <div className="text-green-400 font-mono">{metrics?.gps?.fix_type || '3D'}</div>
            </div>
          </div>
        </div>
        
        {/* Environment */}
        <div className="bg-gray-900/50 rounded-xl p-4 border border-emerald-900/30">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🌍</span>
            <h3 className="text-emerald-400 font-bold text-sm uppercase tracking-wider">Environment</h3>
          </div>
          
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-gray-500">Temperature</div>
              <div className="text-orange-400 font-mono">{(metrics?.environment?.temperature_c || 0).toFixed(0)}°C</div>
            </div>
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-gray-500">Visibility</div>
              <div className="text-blue-400 font-mono">{(metrics?.environment?.visibility_km || 0).toFixed(0)} km</div>
            </div>
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-gray-500">Road</div>
              <div className="text-green-400 font-mono">{metrics?.environment?.road_condition || 'GOOD'}</div>
            </div>
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-gray-500">Humidity</div>
              <div className="text-cyan-400 font-mono">{(metrics?.environment?.humidity_percent || 0).toFixed(0)}%</div>
            </div>
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-gray-500">Wind</div>
              <div className="text-yellow-400 font-mono">{(metrics?.environment?.wind_speed_kmh || 0).toFixed(0)} km/h</div>
            </div>
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-gray-500">Traction</div>
              <div className="text-emerald-400 font-mono">{((metrics?.environment?.traction || 0) * 100).toFixed(0)}%</div>
            </div>
          </div>
        </div>
        
        {/* Last Updated */}
        <div className="text-center text-gray-600 text-xs py-2">
          Telemetry updated: {metrics?.timestamp ? new Date(metrics.timestamp).toLocaleTimeString() : 'N/A'}
        </div>
      </div>
    </div>
  );
}
