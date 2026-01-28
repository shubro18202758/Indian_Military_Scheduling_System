'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ============================================================================
// INTERFACES
// ============================================================================

interface VehicleTelemetry {
  id: string;
  name: string;
  callsign: string;
  asset_type: string;
  category: string;
  lat: number;
  lng: number;
  bearing: number;
  speed_kmh: number;
  status: string;
  formation_position: string;
  fuel_percent: number;
  fuel_type: string;
  range_remaining_km: number;
  capacity_tons: number;
  max_personnel: number;
  max_speed_kmh: number;
  has_radio: boolean;
  has_gps: boolean;
  convoy_id: string | null;
}

interface AdvancedMetrics {
  vehicle_id: string;
  timestamp: string;
  engine: {
    temperature_celsius: number;
    rpm: number;
    oil_pressure_psi: number;
    coolant_temp: number;
    load_percent: number;
    efficiency_percent: number;
    health_score: number;
    needs_maintenance: boolean;
  };
  gps: {
    latitude: number;
    longitude: number;
    altitude_m: number;
    speed_kmh: number;
    heading_degrees: number;
    accuracy_m: number;
    satellites_visible: number;
    signal_quality: string;
  };
  fuel: {
    current_level_liters: number;
    max_capacity_liters: number;
    percent_remaining: number;
    consumption_rate_lph: number;
    consumption_rate_kpl: number;
    estimated_range_km: number;
    time_to_empty_hours: number;
  };
  communication: {
    radio_signal_strength: number;
    encryption_active: boolean;
    last_contact_seconds_ago: number;
    packet_loss_percent: number;
    latency_ms: number;
    comms_status: string;
  };
}

interface MetricsHistory {
  timestamp: number;
  speed: number;
  fuel: number;
  engineTemp: number;
  rpm: number;
  signalStrength: number;
}

interface VehicleMetricsPanelProps {
  vehicle: VehicleTelemetry;
  metrics: AdvancedMetrics | null;
  onClose?: () => void;
}

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

// Circular Gauge Component
const CircularGauge: React.FC<{
  value: number;
  max: number;
  label: string;
  unit: string;
  color: string;
  warningThreshold?: number;
  criticalThreshold?: number;
  size?: 'sm' | 'md' | 'lg';
}> = ({ value, max, label, unit, color, warningThreshold, criticalThreshold, size = 'md' }) => {
  const percentage = Math.min((value / max) * 100, 100);
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  const getColor = () => {
    if (criticalThreshold && value >= criticalThreshold) return '#ef4444';
    if (warningThreshold && value >= warningThreshold) return '#f59e0b';
    return color;
  };
  
  const sizes = {
    sm: { width: 80, fontSize: '12px', valueFontSize: '14px' },
    md: { width: 100, fontSize: '10px', valueFontSize: '18px' },
    lg: { width: 120, fontSize: '12px', valueFontSize: '22px' }
  };
  
  const { width, fontSize, valueFontSize } = sizes[size];
  
  return (
    <div className="flex flex-col items-center">
      <svg width={width} height={width} viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="8"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke={getColor()}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
        />
        {/* Glow effect */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke={getColor()}
          strokeWidth="2"
          strokeOpacity="0.3"
          filter="blur(4px)"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 50 50)"
        />
        {/* Center value */}
        <text
          x="50"
          y="45"
          textAnchor="middle"
          fill="white"
          style={{ fontSize: valueFontSize, fontWeight: 'bold', fontFamily: 'monospace' }}
        >
          {value.toFixed(0)}
        </text>
        <text
          x="50"
          y="60"
          textAnchor="middle"
          fill="rgba(255,255,255,0.6)"
          style={{ fontSize, fontFamily: 'monospace' }}
        >
          {unit}
        </text>
      </svg>
      <div className="text-gray-400 text-xs mt-1 uppercase tracking-wider">{label}</div>
    </div>
  );
};

// Real-time Line Chart Component
const RealtimeChart: React.FC<{
  data: number[];
  color: string;
  label: string;
  unit: string;
  min?: number;
  max?: number;
  height?: number;
  showGrid?: boolean;
}> = ({ data, color, label, unit, min = 0, max = 100, height = 80, showGrid = true }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const h = canvas.height;
    
    // Clear
    ctx.clearRect(0, 0, width, h);
    
    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = (h / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }
    
    if (data.length < 2) return;
    
    // Draw gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, color + '40');
    gradient.addColorStop(1, 'transparent');
    
    ctx.beginPath();
    ctx.moveTo(0, h);
    
    data.forEach((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = h - ((value - min) / (max - min)) * h;
      ctx.lineTo(x, y);
    });
    
    ctx.lineTo(width, h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Draw line
    ctx.beginPath();
    data.forEach((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = h - ((value - min) / (max - min)) * h;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    
    // Draw glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    // Draw current value dot
    if (data.length > 0) {
      const lastValue = data[data.length - 1];
      const x = width;
      const y = h - ((lastValue - min) / (max - min)) * h;
      
      ctx.beginPath();
      ctx.arc(x - 4, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
  }, [data, color, min, max, showGrid]);
  
  const currentValue = data.length > 0 ? data[data.length - 1] : 0;
  
  return (
    <div className="bg-black/30 rounded-lg p-3 border border-white/10">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-400 text-xs uppercase tracking-wider">{label}</span>
        <span className="font-mono text-sm" style={{ color }}>
          {currentValue.toFixed(1)} {unit}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={280}
        height={height}
        style={{ width: '100%', height: `${height}px` }}
      />
    </div>
  );
};

// Status Bar Component
const StatusBar: React.FC<{
  value: number;
  max: number;
  label: string;
  color: string;
  showPercentage?: boolean;
  segments?: number;
}> = ({ value, max, label, color, showPercentage = true, segments = 20 }) => {
  const percentage = Math.min((value / max) * 100, 100);
  const filledSegments = Math.round((percentage / 100) * segments);
  
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-gray-400 text-xs uppercase tracking-wider">{label}</span>
        {showPercentage && (
          <span className="font-mono text-xs" style={{ color }}>
            {percentage.toFixed(0)}%
          </span>
        )}
      </div>
      <div className="flex gap-0.5">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className="h-2 flex-1 rounded-sm transition-all duration-300"
            style={{
              background: i < filledSegments ? color : 'rgba(255,255,255,0.1)',
              boxShadow: i < filledSegments ? `0 0 8px ${color}40` : 'none'
            }}
          />
        ))}
      </div>
    </div>
  );
};

// Threat Level Indicator
const ThreatIndicator: React.FC<{ level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }> = ({ level }) => {
  const config = {
    LOW: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', label: 'SECURE', icon: '🟢' },
    MEDIUM: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', label: 'ELEVATED', icon: '🟡' },
    HIGH: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', label: 'HIGH ALERT', icon: '🔴' },
    CRITICAL: { color: '#dc2626', bg: 'rgba(220, 38, 38, 0.2)', label: 'CRITICAL', icon: '⚠️' }
  };
  
  const { color, bg, label, icon } = config[level];
  
  return (
    <div 
      className="flex items-center gap-2 px-3 py-2 rounded-lg border"
      style={{ background: bg, borderColor: color }}
    >
      <span className="text-lg">{icon}</span>
      <div>
        <div className="text-xs text-gray-400">THREAT LEVEL</div>
        <div className="font-bold text-sm" style={{ color }}>{label}</div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function VehicleMetricsPanel({ vehicle, metrics, onClose }: VehicleMetricsPanelProps) {
  // Historical data for charts
  const [metricsHistory, setMetricsHistory] = useState<MetricsHistory[]>([]);
  const [threatLevel, setThreatLevel] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('LOW');
  const [operationalStatus, setOperationalStatus] = useState({
    missionReady: true,
    combatReady: true,
    supplyLevel: 85,
    crewStatus: 'OPTIMAL',
    maintenanceScore: 92
  });
  
  // Update history when metrics change
  useEffect(() => {
    if (metrics) {
      setMetricsHistory(prev => {
        const newEntry: MetricsHistory = {
          timestamp: Date.now(),
          speed: metrics.gps?.speed_kmh || 0,
          fuel: metrics.fuel?.percent_remaining || 0,
          engineTemp: metrics.engine?.temperature_celsius || 0,
          rpm: metrics.engine?.rpm || 0,
          signalStrength: metrics.communication?.radio_signal_strength || 0
        };
        
        // Keep last 60 data points (2 minutes at 2s interval)
        const updated = [...prev, newEntry].slice(-60);
        return updated;
      });
      
      // Calculate threat level based on metrics
      calculateThreatLevel(metrics);
    }
  }, [metrics]);
  
  const calculateThreatLevel = useCallback((m: AdvancedMetrics) => {
    let threatScore = 0;
    
    // Low fuel increases threat
    if (m.fuel?.percent_remaining < 20) threatScore += 30;
    else if (m.fuel?.percent_remaining < 40) threatScore += 15;
    
    // Poor comms increases threat
    if (m.communication?.radio_signal_strength < 30) threatScore += 25;
    else if (m.communication?.radio_signal_strength < 60) threatScore += 10;
    
    // Engine issues increase threat
    if (m.engine?.needs_maintenance) threatScore += 20;
    if (m.engine?.health_score < 50) threatScore += 20;
    else if (m.engine?.health_score < 75) threatScore += 10;
    
    // High latency increases threat
    if (m.communication?.latency_ms > 500) threatScore += 15;
    
    if (threatScore >= 60) setThreatLevel('CRITICAL');
    else if (threatScore >= 40) setThreatLevel('HIGH');
    else if (threatScore >= 20) setThreatLevel('MEDIUM');
    else setThreatLevel('LOW');
    
    // Update operational status
    setOperationalStatus(prev => ({
      ...prev,
      missionReady: m.fuel?.percent_remaining > 25 && m.communication?.radio_signal_strength > 40,
      combatReady: m.engine?.health_score > 70 && !m.engine?.needs_maintenance,
      supplyLevel: m.fuel?.percent_remaining || 0,
      maintenanceScore: m.engine?.health_score || 0
    }));
  }, []);
  
  // Extract chart data
  const speedData = metricsHistory.map(h => h.speed);
  const fuelData = metricsHistory.map(h => h.fuel);
  const tempData = metricsHistory.map(h => h.engineTemp);
  const rpmData = metricsHistory.map(h => h.rpm);
  const signalData = metricsHistory.map(h => h.signalStrength);
  
  if (!vehicle || !metrics) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-3">📊</div>
          <div className="text-lg font-bold">No Vehicle Selected</div>
          <div className="text-sm mt-1">Click a vehicle to view detailed metrics</div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-gradient-to-b from-black to-transparent z-10 p-4 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-600/20 border border-green-500/50 flex items-center justify-center text-xl">
                🚛
              </div>
              <div>
                <h2 className="text-green-400 font-bold text-lg">{vehicle.name}</h2>
                <div className="text-gray-400 text-xs font-mono">
                  {vehicle.callsign} • {vehicle.asset_type} • {vehicle.category}
                </div>
              </div>
            </div>
          </div>
          <ThreatIndicator level={threatLevel} />
        </div>
      </div>
      
      <div className="px-4 pb-4 space-y-4">
        {/* Operational Readiness Section */}
        <div className="bg-gray-900/50 rounded-xl p-4 border border-green-900/30">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🎖️</span>
            <h3 className="text-green-400 font-bold text-sm uppercase tracking-wider">Operational Readiness</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-3 rounded-lg border ${operationalStatus.missionReady ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
              <div className="text-xs text-gray-400 mb-1">MISSION READY</div>
              <div className={`font-bold ${operationalStatus.missionReady ? 'text-green-400' : 'text-red-400'}`}>
                {operationalStatus.missionReady ? '✓ READY' : '✗ NOT READY'}
              </div>
            </div>
            <div className={`p-3 rounded-lg border ${operationalStatus.combatReady ? 'bg-green-900/20 border-green-500/30' : 'bg-yellow-900/20 border-yellow-500/30'}`}>
              <div className="text-xs text-gray-400 mb-1">COMBAT READY</div>
              <div className={`font-bold ${operationalStatus.combatReady ? 'text-green-400' : 'text-yellow-400'}`}>
                {operationalStatus.combatReady ? '✓ READY' : '⚠ LIMITED'}
              </div>
            </div>
          </div>
          
          <div className="mt-4">
            <StatusBar 
              value={operationalStatus.maintenanceScore} 
              max={100} 
              label="System Health" 
              color="#22c55e"
            />
          </div>
        </div>
        
        {/* Real-time Gauges */}
        <div className="bg-gray-900/50 rounded-xl p-4 border border-blue-900/30">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">⚡</span>
            <h3 className="text-blue-400 font-bold text-sm uppercase tracking-wider">Real-time Telemetry</h3>
          </div>
          
          <div className="grid grid-cols-4 gap-2">
            <CircularGauge
              value={metrics.gps?.speed_kmh || 0}
              max={vehicle.max_speed_kmh || 120}
              label="Speed"
              unit="km/h"
              color="#22c55e"
              size="sm"
            />
            <CircularGauge
              value={metrics.engine?.rpm || 0}
              max={6000}
              label="RPM"
              unit="rpm"
              color="#3b82f6"
              warningThreshold={4500}
              criticalThreshold={5500}
              size="sm"
            />
            <CircularGauge
              value={metrics.engine?.temperature_celsius || 0}
              max={150}
              label="Temp"
              unit="°C"
              color="#f59e0b"
              warningThreshold={100}
              criticalThreshold={120}
              size="sm"
            />
            <CircularGauge
              value={metrics.fuel?.percent_remaining || 0}
              max={100}
              label="Fuel"
              unit="%"
              color={metrics.fuel?.percent_remaining < 25 ? '#ef4444' : '#22c55e'}
              size="sm"
            />
          </div>
        </div>
        
        {/* Speed Chart */}
        <RealtimeChart
          data={speedData}
          color="#22c55e"
          label="Speed History"
          unit="km/h"
          min={0}
          max={vehicle.max_speed_kmh || 120}
        />
        
        {/* Engine Metrics Section */}
        <div className="bg-gray-900/50 rounded-xl p-4 border border-orange-900/30">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🔧</span>
            <h3 className="text-orange-400 font-bold text-sm uppercase tracking-wider">Engine Diagnostics</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-black/30 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Engine Temperature</div>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-orange-400 font-mono">
                  {metrics.engine?.temperature_celsius?.toFixed(1)}
                </span>
                <span className="text-gray-400 text-sm mb-1">°C</span>
              </div>
              <div className="h-1 bg-gray-800 rounded mt-2">
                <div 
                  className="h-full rounded transition-all"
                  style={{ 
                    width: `${Math.min((metrics.engine?.temperature_celsius || 0) / 150 * 100, 100)}%`,
                    background: (metrics.engine?.temperature_celsius || 0) > 100 ? '#ef4444' : '#f59e0b'
                  }}
                />
              </div>
            </div>
            
            <div className="bg-black/30 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Oil Pressure</div>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-yellow-400 font-mono">
                  {metrics.engine?.oil_pressure_psi?.toFixed(0)}
                </span>
                <span className="text-gray-400 text-sm mb-1">PSI</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {(metrics.engine?.oil_pressure_psi || 0) < 25 ? '⚠️ LOW' : '✓ NORMAL'}
              </div>
            </div>
          </div>
          
          <RealtimeChart
            data={tempData}
            color="#f59e0b"
            label="Temperature Trend"
            unit="°C"
            min={0}
            max={150}
            height={60}
          />
          
          <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-gray-500">Load</div>
              <div className="text-blue-400 font-mono font-bold">{metrics.engine?.load_percent?.toFixed(0)}%</div>
            </div>
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-gray-500">Efficiency</div>
              <div className="text-green-400 font-mono font-bold">{metrics.engine?.efficiency_percent?.toFixed(0)}%</div>
            </div>
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-gray-500">Coolant</div>
              <div className="text-cyan-400 font-mono font-bold">{metrics.engine?.coolant_temp?.toFixed(0)}°C</div>
            </div>
          </div>
          
          {metrics.engine?.needs_maintenance && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
              <div className="flex items-center gap-2 text-red-400">
                <span>⚠️</span>
                <span className="font-bold text-sm">MAINTENANCE REQUIRED</span>
              </div>
              <div className="text-gray-400 text-xs mt-1">Schedule service at earliest opportunity</div>
            </div>
          )}
        </div>
        
        {/* Fuel Analytics */}
        <div className="bg-gray-900/50 rounded-xl p-4 border border-yellow-900/30">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">⛽</span>
            <h3 className="text-yellow-400 font-bold text-sm uppercase tracking-wider">Fuel Analytics</h3>
          </div>
          
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-3xl font-bold font-mono" style={{ 
                color: (metrics.fuel?.percent_remaining || 0) < 25 ? '#ef4444' : '#22c55e' 
              }}>
                {metrics.fuel?.percent_remaining?.toFixed(0)}%
              </div>
              <div className="text-gray-500 text-xs">
                {metrics.fuel?.current_level_liters?.toFixed(0)} / {metrics.fuel?.max_capacity_liters?.toFixed(0)} L
              </div>
            </div>
            <div className="text-right">
              <div className="text-blue-400 font-bold font-mono text-xl">
                {metrics.fuel?.estimated_range_km?.toFixed(0)} km
              </div>
              <div className="text-gray-500 text-xs">Estimated Range</div>
            </div>
          </div>
          
          <StatusBar
            value={metrics.fuel?.percent_remaining || 0}
            max={100}
            label="Fuel Level"
            color={(metrics.fuel?.percent_remaining || 0) < 25 ? '#ef4444' : '#22c55e'}
            segments={30}
          />
          
          <RealtimeChart
            data={fuelData}
            color="#eab308"
            label="Fuel Consumption"
            unit="%"
            min={0}
            max={100}
            height={60}
          />
          
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-black/30 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Consumption Rate</div>
              <div className="text-yellow-400 font-mono font-bold">
                {metrics.fuel?.consumption_rate_lph?.toFixed(1)} L/h
              </div>
            </div>
            <div className="bg-black/30 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Time to Empty</div>
              <div className="text-cyan-400 font-mono font-bold">
                {metrics.fuel?.time_to_empty_hours?.toFixed(1)} hrs
              </div>
            </div>
          </div>
        </div>
        
        {/* GPS & Navigation */}
        <div className="bg-gray-900/50 rounded-xl p-4 border border-cyan-900/30">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">📍</span>
            <h3 className="text-cyan-400 font-bold text-sm uppercase tracking-wider">GPS & Navigation</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-black/30 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Coordinates</div>
              <div className="text-green-400 font-mono text-sm">
                {metrics.gps?.latitude?.toFixed(6)}°N
              </div>
              <div className="text-green-400 font-mono text-sm">
                {metrics.gps?.longitude?.toFixed(6)}°E
              </div>
            </div>
            <div className="bg-black/30 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Altitude</div>
              <div className="text-blue-400 font-mono text-xl font-bold">
                {metrics.gps?.altitude_m?.toFixed(0)}m
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-gray-500">Heading</div>
              <div className="text-cyan-400 font-mono font-bold">{metrics.gps?.heading_degrees?.toFixed(0)}°</div>
            </div>
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-gray-500">Accuracy</div>
              <div className="text-green-400 font-mono font-bold">{metrics.gps?.accuracy_m?.toFixed(1)}m</div>
            </div>
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-gray-500">Satellites</div>
              <div className="text-yellow-400 font-mono font-bold">{metrics.gps?.satellites_visible}</div>
            </div>
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-gray-500">Signal</div>
              <div className="text-green-400 font-mono font-bold">{metrics.gps?.signal_quality}</div>
            </div>
          </div>
        </div>
        
        {/* Communications */}
        <div className="bg-gray-900/50 rounded-xl p-4 border border-purple-900/30">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">📡</span>
            <h3 className="text-purple-400 font-bold text-sm uppercase tracking-wider">Communications</h3>
          </div>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${metrics.communication?.encryption_active ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
              <div>
                <div className="text-white font-bold text-sm">
                  {metrics.communication?.comms_status}
                </div>
                <div className="text-gray-500 text-xs">
                  {metrics.communication?.encryption_active ? '🔐 AES-256 ENCRYPTED' : '⚠️ UNENCRYPTED'}
                </div>
              </div>
            </div>
            <CircularGauge
              value={metrics.communication?.radio_signal_strength || 0}
              max={100}
              label="Signal"
              unit="%"
              color="#a855f7"
              size="sm"
            />
          </div>
          
          <RealtimeChart
            data={signalData}
            color="#a855f7"
            label="Signal Strength"
            unit="%"
            min={0}
            max={100}
            height={60}
          />
          
          <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-gray-500">Latency</div>
              <div className={`font-mono font-bold ${(metrics.communication?.latency_ms || 0) > 200 ? 'text-red-400' : 'text-green-400'}`}>
                {metrics.communication?.latency_ms?.toFixed(0)} ms
              </div>
            </div>
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-gray-500">Packet Loss</div>
              <div className={`font-mono font-bold ${(metrics.communication?.packet_loss_percent || 0) > 5 ? 'text-red-400' : 'text-green-400'}`}>
                {metrics.communication?.packet_loss_percent?.toFixed(1)}%
              </div>
            </div>
            <div className="bg-black/30 rounded p-2 text-center">
              <div className="text-gray-500">Last Contact</div>
              <div className="text-cyan-400 font-mono font-bold">
                {metrics.communication?.last_contact_seconds_ago?.toFixed(0)}s
              </div>
            </div>
          </div>
        </div>
        
        {/* Vehicle Specifications */}
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/30">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">📋</span>
            <h3 className="text-gray-300 font-bold text-sm uppercase tracking-wider">Vehicle Specifications</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex justify-between p-2 bg-black/20 rounded">
              <span className="text-gray-500">Type</span>
              <span className="text-white font-mono">{vehicle.asset_type}</span>
            </div>
            <div className="flex justify-between p-2 bg-black/20 rounded">
              <span className="text-gray-500">Category</span>
              <span className="text-white font-mono">{vehicle.category}</span>
            </div>
            <div className="flex justify-between p-2 bg-black/20 rounded">
              <span className="text-gray-500">Fuel Type</span>
              <span className="text-white font-mono">{vehicle.fuel_type}</span>
            </div>
            <div className="flex justify-between p-2 bg-black/20 rounded">
              <span className="text-gray-500">Max Speed</span>
              <span className="text-white font-mono">{vehicle.max_speed_kmh} km/h</span>
            </div>
            <div className="flex justify-between p-2 bg-black/20 rounded">
              <span className="text-gray-500">Capacity</span>
              <span className="text-white font-mono">{vehicle.capacity_tons} tons</span>
            </div>
            <div className="flex justify-between p-2 bg-black/20 rounded">
              <span className="text-gray-500">Personnel</span>
              <span className="text-white font-mono">{vehicle.max_personnel}</span>
            </div>
            <div className="flex justify-between p-2 bg-black/20 rounded">
              <span className="text-gray-500">Radio</span>
              <span className={vehicle.has_radio ? 'text-green-400' : 'text-red-400'}>
                {vehicle.has_radio ? '✓ EQUIPPED' : '✗ NONE'}
              </span>
            </div>
            <div className="flex justify-between p-2 bg-black/20 rounded">
              <span className="text-gray-500">GPS</span>
              <span className={vehicle.has_gps ? 'text-green-400' : 'text-red-400'}>
                {vehicle.has_gps ? '✓ ACTIVE' : '✗ NONE'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Last Updated */}
        <div className="text-center text-gray-600 text-xs py-2">
          Last updated: {new Date(metrics.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
