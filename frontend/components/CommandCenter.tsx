'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const API_V1 = '/api/proxy/v1';

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
  assigned_unit?: string;
  total_km: number;
  obstacle_response?: {
    action: string;
    obstacle_type?: string;
    awaiting_clearance?: boolean;
    speed_reduction?: number;
  };
}

interface Obstacle {
  id: number;
  obstacle_type: string;
  severity: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
  is_countered: boolean;
  title?: string;
  description?: string;
  created_at: string;
}

interface Countermeasure {
  id: number;
  obstacle_id: number;
  action_type: string;
  status: string;
  confidence_score: number;
  decision_algorithm: string;
  execution_steps?: string[];
  created_at: string;
}

interface SimState {
  isRunning: boolean;
  isPaused: boolean;
  startTime: Date | null;
  elapsedSeconds: number;
  obstaclesGenerated: number;
  obstaclesResolved: number;
  vehiclesActive: number;
}

const getStatusColor = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'MOVING': return '#22c55e';
    case 'HALTED_OBSTACLE': return '#ef4444';
    case 'SLOWED': return '#f59e0b';
    case 'ARRIVED': return '#3b82f6';
    default: return '#6b7280';
  }
};

const getSeverityConfig = (severity: string) => {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL': return { color: '#dc2626', bg: 'rgba(220, 38, 38, 0.2)', label: 'CRITICAL' };
    case 'HIGH': return { color: '#f97316', bg: 'rgba(249, 115, 22, 0.2)', label: 'HIGH' };
    case 'MEDIUM': return { color: '#eab308', bg: 'rgba(234, 179, 8, 0.2)', label: 'MEDIUM' };
    case 'LOW': return { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.2)', label: 'LOW' };
    default: return { color: '#6b7280', bg: 'rgba(107, 114, 128, 0.2)', label: 'UNKNOWN' };
  }
};

const getObstacleIcon = (type: string) => {
  const t = type?.toUpperCase() || '';
  if (t.includes('IED') || t.includes('EXPLOSIVE')) return '💣';
  if (t.includes('AMBUSH') || t.includes('HOSTILE')) return '⚔️';
  if (t.includes('LANDSLIDE') || t.includes('ROCKFALL')) return '🏔️';
  if (t.includes('AVALANCHE')) return '❄️';
  if (t.includes('FLOOD')) return '🌊';
  if (t.includes('BRIDGE')) return '🌉';
  if (t.includes('WEATHER') || t.includes('FOG') || t.includes('SNOW')) return '🌫️';
  if (t.includes('SECURITY') || t.includes('THREAT')) return '🚨';
  if (t.includes('ACCIDENT')) return '🚧';
  return '⚠️';
};

interface CommandCenterProps {
  onVehicleSelect?: (vehicle: VehicleTelemetry | null) => void;
  selectedVehicleId?: number | null;
}

export default function CommandCenter({ onVehicleSelect, selectedVehicleId }: CommandCenterProps) {
  const [vehicles, setVehicles] = useState<VehicleTelemetry[]>([]);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [countermeasures, setCountermeasures] = useState<Countermeasure[]>([]);
  const [simState, setSimState] = useState<SimState>({
    isRunning: false,
    isPaused: false,
    startTime: null,
    elapsedSeconds: 0,
    obstaclesGenerated: 0,
    obstaclesResolved: 0,
    vehiclesActive: 0
  });
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleTelemetry | null>(null);
  const [recentEvents, setRecentEvents] = useState<Array<{ type: string; message: string; time: Date; severity?: string }>>([]);
  const [showThreatAlert, setShowThreatAlert] = useState(false);
  const [currentThreat, setCurrentThreat] = useState<Obstacle | null>(null);
  
  const tickIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const obstacleIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastObstacleIdsRef = useRef<Set<number>>(new Set());
  const maxObstacles = 5; // Limit active obstacles

  const addEvent = useCallback((type: string, message: string, severity?: string) => {
    setRecentEvents(prev => [{
      type,
      message,
      time: new Date(),
      severity
    }, ...prev].slice(0, 30));
  }, []);

  // Fetch vehicles with telemetry
  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fetch(`${API_V1}/vehicles/vehicles`);
      if (res.ok) {
        const data = await res.json();
        setVehicles(data);
        setSimState(prev => ({ ...prev, vehiclesActive: data.length }));
      }
    } catch (e) {
      // Silent fail - API may be initializing
    }
  }, []);

  // Fetch obstacles
  const fetchObstacles = useCallback(async () => {
    try {
      const res = await fetch(`${API_V1}/obstacles/obstacles?active_only=true&limit=20`);
      if (res.ok) {
        const data: Obstacle[] = await res.json();
        
        // Detect new obstacles
        const currentIds = new Set(data.map(o => o.id));
        data.forEach(obs => {
          if (!lastObstacleIdsRef.current.has(obs.id)) {
            // New obstacle detected
            addEvent('THREAT', `${obs.obstacle_type.replace(/_/g, ' ')} detected`, obs.severity);
            
            // Show alert for HIGH/CRITICAL
            if (obs.severity === 'CRITICAL' || obs.severity === 'HIGH') {
              setCurrentThreat(obs);
              setShowThreatAlert(true);
              setTimeout(() => setShowThreatAlert(false), 4000);
            }
          }
        });
        
        lastObstacleIdsRef.current = currentIds;
        setObstacles(data);
        
        // Update counters
        setSimState(prev => ({
          ...prev,
          obstaclesGenerated: prev.obstaclesGenerated + (data.length - obstacles.length > 0 ? data.length - obstacles.length : 0)
        }));
      }
    } catch (e) {
      // Silent fail - API may be initializing
    }
  }, [obstacles.length, addEvent]);

  // Fetch countermeasures
  const fetchCountermeasures = useCallback(async () => {
    try {
      const res = await fetch(`${API_V1}/obstacles/countermeasures?limit=10`);
      if (res.ok) {
        const data = await res.json();
        setCountermeasures(data);
      }
    } catch (e) {
      // Silent fail - API may be initializing
    }
  }, []);

  // Simulation tick - move vehicles
  const simulationTick = useCallback(async () => {
    try {
      const res = await fetch(`${API_V1}/vehicles/simulation/tick`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        await fetchVehicles();
      }
    } catch (e) {
      // Silently handle - simulation may not be running
      console.debug('Simulation tick skipped');
    }
  }, [fetchVehicles]);

  // Generate obstacle (with limit check)
  const generateObstacle = useCallback(async () => {
    // Check current obstacle count
    if (obstacles.filter(o => o.is_active).length >= maxObstacles) {
      return; // Don't generate more than max
    }
    
    try {
      // Use the inject-threat endpoint that places obstacles in front of vehicles
      // auto_resolve_seconds=10 means obstacle will be resolved after 10 seconds (simulating AI response)
      const res = await fetch(`${API_V1}/vehicles/inject-threat?auto_resolve_seconds=10`, {
        method: 'POST'
      });
      if (res.ok) {
        const result = await res.json();
        addEvent('JANUS_AI', `THREAT: ${result.obstacle_type.replace(/_/g, ' ')} near ${result.target_vehicle}`, result.severity);
        
        // Show countermeasure being generated
        if (result.countermeasure_id) {
          setTimeout(() => {
            addEvent('COUNTER_AI', `Countermeasure generated - Auto-executing in ${result.auto_resolve_in_seconds || 10}s`, 'MEDIUM');
          }, 1000);
          
          // Show resolution message after auto-resolve
          setTimeout(() => {
            addEvent('RESOLVED', `Obstacle ${result.obstacle_type.replace(/_/g, ' ')} resolved - Convoy resuming`, 'LOW');
            setSimState(prev => ({ ...prev, obstaclesResolved: prev.obstaclesResolved + 1 }));
          }, (result.auto_resolve_in_seconds || 10) * 1000 + 1000);
        }
        
        // Show threat alert for critical/high severity
        if (result.severity === 'CRITICAL' || result.severity === 'HIGH') {
          setShowThreatAlert(true);
          setCurrentThreat({
            obstacle_type: result.obstacle_type,
            severity: result.severity,
            description: result.blocks_route ? 'Route blocked - Convoy halted' : 'Proceeding with caution',
          });
          setTimeout(() => setShowThreatAlert(false), 4000);
        }
        
        await fetchObstacles();
        await fetchCountermeasures();
      }
    } catch (e) {
      // Silent fail - threat injection may fail during init
    }
  }, [obstacles, addEvent, fetchObstacles, fetchCountermeasures]);

  // Start demo
  const startDemo = useCallback(async () => {
    addEvent('SYSTEM', 'COMMAND CENTER ONLINE - Demo initiated', 'LOW');
    
    // Start vehicle simulation for all convoys
    // Speed multiplier 5 = visually realistic for map scale (40 km/h becomes ~200 km/h effective)
    try {
      await fetch(`${API_V1}/vehicles/start-demo?speed_multiplier=2`, { method: 'POST' });
      addEvent('CONVOY', 'All convoy movements activated', 'LOW');
    } catch (e) {
      // Silent fail - demo may already be running
    }
    
    setSimState(prev => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      startTime: new Date(),
      elapsedSeconds: 0,
      obstaclesGenerated: 0,
      obstaclesResolved: 0
    }));
    
    // Vehicle movement tick (every 500ms for smooth animation)
    tickIntervalRef.current = setInterval(simulationTick, 500);
    
    // Generate obstacles at random intervals (5-12 seconds)
    const scheduleObstacle = () => {
      const delay = 5000 + Math.random() * 7000;
      obstacleIntervalRef.current = setTimeout(async () => {
        await generateObstacle();
        if (simState.isRunning) scheduleObstacle();
      }, delay);
    };
    setTimeout(scheduleObstacle, 3000); // First obstacle after 3 seconds
    
    // Timer
    timerRef.current = setInterval(() => {
      setSimState(prev => ({ ...prev, elapsedSeconds: prev.elapsedSeconds + 1 }));
    }, 1000);
    
    // Initial fetch
    fetchVehicles();
    fetchObstacles();
    
  }, [addEvent, simulationTick, generateObstacle, fetchVehicles, fetchObstacles, simState.isRunning]);

  // Stop demo
  const stopDemo = useCallback(async () => {
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    if (obstacleIntervalRef.current) clearTimeout(obstacleIntervalRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    
    try {
      await fetch(`${API_V1}/vehicles/stop-demo`, { method: 'POST' });
    } catch (e) {
      // Silent fail
    }
    
    setSimState(prev => ({ ...prev, isRunning: false, isPaused: false }));
    addEvent('SYSTEM', 'Demo terminated', 'LOW');
  }, [addEvent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      if (obstacleIntervalRef.current) clearTimeout(obstacleIntervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Check for existing simulation and fetch initial data
  useEffect(() => {
    const checkExistingSimulation = async () => {
      try {
        // Fetch vehicles to see if simulation is already running
        const res = await fetch(`${API_V1}/vehicles/vehicles`);
        if (res.ok) {
          const data = await res.json();
          if (data.length > 0) {
            // Simulation is already running
            setVehicles(data);
            setSimState(prev => ({
              ...prev,
              isRunning: true,
              vehiclesActive: data.length
            }));
            addEvent('SYSTEM', 'Connected to active simulation', 'LOW');
            
            // Start tick interval
            if (!tickIntervalRef.current) {
              tickIntervalRef.current = setInterval(simulationTick, 500);
            }
          }
        }
      } catch (e) {
        // Silent fail - initial connection may take time
      }
      
      // Always fetch obstacles
      fetchObstacles();
      fetchCountermeasures();
    };
    
    checkExistingSimulation();
  }, [addEvent, fetchObstacles, fetchCountermeasures, simulationTick]);

  // Poll for data when running
  useEffect(() => {
    if (simState.isRunning) {
      const poll = setInterval(() => {
        fetchObstacles();
        fetchCountermeasures();
      }, 2000);
      return () => clearInterval(poll);
    }
  }, [simState.isRunning, fetchObstacles, fetchCountermeasures]);

  // Format time
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* THREAT ALERT OVERLAY */}
      {showThreatAlert && currentThreat && (
        <div className="fixed inset-0 z-[300] pointer-events-none flex items-start justify-center pt-20">
          <div 
            className="px-8 py-4 rounded-lg animate-pulse"
            style={{
              background: 'rgba(0,0,0,0.95)',
              border: `2px solid ${getSeverityConfig(currentThreat.severity).color}`,
              boxShadow: `0 0 40px ${getSeverityConfig(currentThreat.severity).color}`,
              animation: 'threat-appear 0.3s ease-out'
            }}
          >
            <div className="flex items-center gap-4">
              <span className="text-4xl">{getObstacleIcon(currentThreat.obstacle_type)}</span>
              <div>
                <div className="text-red-500 text-xs font-bold tracking-widest mb-1">⚠ THREAT DETECTED</div>
                <div className="text-white text-xl font-bold">{currentThreat.obstacle_type.replace(/_/g, ' ')}</div>
                <div className="text-gray-400 text-sm">{currentThreat.description}</div>
              </div>
              <div 
                className="px-3 py-1 rounded text-sm font-bold"
                style={{ 
                  background: getSeverityConfig(currentThreat.severity).bg,
                  color: getSeverityConfig(currentThreat.severity).color
                }}
              >
                {currentThreat.severity}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LEFT PANEL - Vehicle List & Telemetry */}
      <div style={{
        position: 'fixed',
        left: 0,
        top: 50,
        bottom: 0,
        width: 320,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column' as const,
        paddingBottom: 80,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(10,25,40,0.95) 100%)',
        borderRight: '1px solid rgba(34, 197, 94, 0.3)'
      }}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-green-900/50">
          <div className="flex items-center gap-2">
            <span className="text-green-500 text-lg">📡</span>
            <span className="text-green-400 font-bold text-sm tracking-wider">VEHICLE TELEMETRY</span>
          </div>
          <div className="text-gray-500 text-xs mt-1">
            {vehicles.length} UNITS TRACKED | {vehicles.filter(v => v.status === 'MOVING').length} IN MOTION
          </div>
        </div>

        {/* Vehicle List */}
        <div className="flex-1 overflow-y-auto">
          {vehicles.map(vehicle => (
            <div 
              key={vehicle.id}
              onClick={() => {
                setSelectedVehicle(vehicle);
                onVehicleSelect?.(vehicle);
              }}
              className={`px-4 py-3 border-b border-gray-800/50 cursor-pointer transition-all hover:bg-gray-800/50 ${
                selectedVehicle?.id === vehicle.id ? 'bg-green-900/30 border-l-2 border-l-green-500' : ''
              }`}
            >
              {/* Vehicle Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span 
                    className="w-2 h-2 rounded-full"
                    style={{ background: getStatusColor(vehicle.status) }}
                  />
                  <span className="text-white font-bold text-sm">{vehicle.name}</span>
                  {vehicle.callsign && (
                    <span className="text-gray-500 text-xs">({vehicle.callsign})</span>
                  )}
                </div>
                <span 
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ 
                    background: getStatusColor(vehicle.status) + '20',
                    color: getStatusColor(vehicle.status)
                  }}
                >
                  {vehicle.status}
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-gray-900/50 rounded px-2 py-1">
                  <div className="text-gray-500">SPEED</div>
                  <div className="text-green-400 font-mono">{vehicle.speed_kmh?.toFixed(0) || 0} km/h</div>
                </div>
                <div className="bg-gray-900/50 rounded px-2 py-1">
                  <div className="text-gray-500">FUEL</div>
                  <div className={`font-mono ${vehicle.fuel_percent < 25 ? 'text-red-400' : 'text-yellow-400'}`}>
                    {vehicle.fuel_percent?.toFixed(0) || 0}%
                  </div>
                </div>
                <div className="bg-gray-900/50 rounded px-2 py-1">
                  <div className="text-gray-500">RANGE</div>
                  <div className="text-blue-400 font-mono">{vehicle.range_remaining_km?.toFixed(0) || 0}km</div>
                </div>
              </div>

              {/* Obstacle Response */}
              {vehicle.obstacle_response && (
                <div 
                  className="mt-2 px-2 py-1 rounded text-xs"
                  style={{
                    background: vehicle.obstacle_response.action === 'HALT' 
                      ? 'rgba(239, 68, 68, 0.2)' 
                      : 'rgba(234, 179, 8, 0.2)',
                    border: `1px solid ${vehicle.obstacle_response.action === 'HALT' ? '#ef4444' : '#eab308'}`
                  }}
                >
                  <span className="font-bold">
                    {vehicle.obstacle_response.action === 'HALT' ? '🛑 HALTED' : '⚠️ CAUTION'}
                  </span>
                  <span className="text-gray-400 ml-2">
                    {vehicle.obstacle_response.obstacle_type?.replace(/_/g, ' ') || 'Following AI guidance'}
                  </span>
                </div>
              )}
            </div>
          ))}

          {vehicles.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <div className="text-3xl mb-2">🚛</div>
              <div>No active vehicles</div>
              <div className="text-xs mt-1">Start demo to see movement</div>
            </div>
          )}
        </div>

        {/* Selected Vehicle Details */}
        {selectedVehicle && (
          <div className="border-t border-green-900/50 p-4 bg-black/50">
            <div className="text-green-400 text-xs font-bold mb-2">DETAILED TELEMETRY</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-gray-500">Type:</span> <span className="text-white">{selectedVehicle.asset_type}</span></div>
              <div><span className="text-gray-500">Cat:</span> <span className="text-white">{selectedVehicle.category}</span></div>
              <div><span className="text-gray-500">Load:</span> <span className="text-white">{selectedVehicle.capacity_tons}T</span></div>
              <div><span className="text-gray-500">Crew:</span> <span className="text-white">{selectedVehicle.max_personnel}</span></div>
              <div><span className="text-gray-500">GPS:</span> <span className={selectedVehicle.has_gps ? 'text-green-400' : 'text-red-400'}>{selectedVehicle.has_gps ? 'ACTIVE' : 'OFF'}</span></div>
              <div><span className="text-gray-500">Radio:</span> <span className={selectedVehicle.has_radio ? 'text-green-400' : 'text-red-400'}>{selectedVehicle.has_radio ? 'ACTIVE' : 'OFF'}</span></div>
              <div><span className="text-gray-500">Bearing:</span> <span className="text-white">{selectedVehicle.bearing?.toFixed(0)}°</span></div>
              <div><span className="text-gray-500">Odom:</span> <span className="text-white">{selectedVehicle.total_km?.toFixed(1)}km</span></div>
            </div>
            <div className="mt-2 text-xs">
              <span className="text-gray-500">Position:</span>
              <span className="text-white font-mono ml-1">
                {selectedVehicle.lat?.toFixed(5)}, {selectedVehicle.lng?.toFixed(5)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT PANEL - Threats & AI Response */}
      <div style={{
        position: 'fixed',
        right: 0,
        top: 50,
        bottom: 0,
        width: 384,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column' as const,
        paddingBottom: 80,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(40,10,10,0.95) 100%)',
        borderLeft: '1px solid rgba(239, 68, 68, 0.3)'
      }}>
        {/* Threat Header */}
        <div className="px-4 py-3 border-b border-red-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-red-500 text-lg">🎯</span>
              <span className="text-red-400 font-bold text-sm tracking-wider">THREAT ANALYSIS</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-red-400 text-xs">{obstacles.filter(o => o.is_active).length} ACTIVE</span>
            </div>
          </div>
        </div>

        {/* Active Threats */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            <div className="text-gray-500 text-xs px-2 py-1 border-b border-gray-800">ACTIVE OBSTACLES</div>
            {obstacles.filter(o => o.is_active).map(obs => {
              const config = getSeverityConfig(obs.severity);
              return (
                <div 
                  key={obs.id}
                  className="p-3 my-2 rounded-lg"
                  style={{
                    background: config.bg,
                    border: `1px solid ${config.color}40`
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{getObstacleIcon(obs.obstacle_type)}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-bold text-sm">
                          {obs.obstacle_type.replace(/_/g, ' ')}
                        </span>
                        <span 
                          className="text-xs px-2 py-0.5 rounded font-bold"
                          style={{ background: config.color, color: 'black' }}
                        >
                          {config.label}
                        </span>
                      </div>
                      <div className="text-gray-400 text-xs mt-1">{obs.description}</div>
                      <div className="text-gray-600 text-xs mt-1">
                        📍 {obs.latitude?.toFixed(4)}, {obs.longitude?.toFixed(4)}
                      </div>
                    </div>
                  </div>

                  {/* AI Response */}
                  {countermeasures.find(c => c.obstacle_id === obs.id) && (
                    <div className="mt-2 pt-2 border-t border-gray-700">
                      <div className="flex items-center gap-2">
                        <span className="text-green-500">🛡️</span>
                        <span className="text-green-400 text-xs font-bold">AI RESPONSE ACTIVE</span>
                      </div>
                      {(() => {
                        const cm = countermeasures.find(c => c.obstacle_id === obs.id);
                        return cm ? (
                          <div className="text-xs text-gray-400 mt-1">
                            <div>Action: <span className="text-white">{cm.action_type.replace(/_/g, ' ')}</span></div>
                            <div>Algorithm: <span className="text-blue-400">{cm.decision_algorithm}</span></div>
                            <div>Confidence: <span className="text-green-400">{(cm.confidence_score * 100).toFixed(0)}%</span></div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}
                </div>
              );
            })}

            {obstacles.filter(o => o.is_active).length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <div className="text-3xl mb-2">✅</div>
                <div>No active threats</div>
              </div>
            )}
          </div>

          {/* Event Log */}
          <div className="border-t border-gray-800 p-2">
            <div className="text-gray-500 text-xs px-2 py-1">EVENT LOG</div>
            <div className="max-h-48 overflow-y-auto">
              {recentEvents.map((event, idx) => (
                <div key={idx} className="px-2 py-1.5 text-xs border-b border-gray-900/50">
                  <div className="flex items-center gap-2">
                    <span className={`${
                      event.type === 'THREAT' ? 'text-red-400' : 
                      event.type === 'JANUS_AI' ? 'text-orange-400' : 
                      event.type === 'CONVOY' ? 'text-green-400' : 
                      'text-blue-400'
                    }`}>
                      [{event.type}]
                    </span>
                    <span className="text-gray-300 flex-1 truncate">{event.message}</span>
                  </div>
                  <div className="text-gray-600 text-[10px]">
                    {event.time.toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM CONTROL BAR */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 80,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,1) 100%)',
        borderTop: '1px solid rgba(255,255,255,0.2)'
      }}>
        {/* Left - System Status */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span 
              className={`w-3 h-3 rounded-full ${simState.isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}
            />
            <span className="text-white font-bold">
              {simState.isRunning ? 'SIMULATION ACTIVE' : 'STANDBY'}
            </span>
          </div>
          
          {simState.isRunning && (
            <div className="flex items-center gap-4 text-sm">
              <div className="text-gray-400">
                <span className="text-white font-mono">{formatTime(simState.elapsedSeconds)}</span>
              </div>
              <div className="text-gray-400">
                Vehicles: <span className="text-green-400 font-bold">{vehicles.length}</span>
              </div>
              <div className="text-gray-400">
                Threats: <span className="text-red-400 font-bold">{obstacles.filter(o => o.is_active).length}</span>
              </div>
            </div>
          )}
        </div>

        {/* Center - Main Controls */}
        <div className="flex items-center gap-4">
          {!simState.isRunning ? (
            <button
              onClick={startDemo}
              className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-8 py-3 rounded-lg font-bold text-sm transition-all transform hover:scale-105 shadow-lg"
            >
              <span className="text-lg">▶</span>
              START TACTICAL DEMO
            </button>
          ) : (
            <>
              <button
                onClick={generateObstacle}
                disabled={obstacles.filter(o => o.is_active).length >= maxObstacles}
                className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all"
              >
                💥 INJECT THREAT
              </button>
              <button
                onClick={stopDemo}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-lg font-bold text-sm transition-all"
              >
                ⏹ STOP
              </button>
            </>
          )}
        </div>

        {/* Right - AI Status */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-gray-500 text-xs">ADVERSARY AI</div>
            <div className="text-orange-400 font-bold text-sm flex items-center gap-1">
              {simState.isRunning && <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />}
              JANUS 7B
            </div>
          </div>
          <div className="w-px h-8 bg-gray-700" />
          <div className="text-right">
            <div className="text-gray-500 text-xs">DEFENSE AI</div>
            <div className="text-green-400 font-bold text-sm flex items-center gap-1">
              {simState.isRunning && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
              GUARDIAN
            </div>
          </div>
        </div>
      </div>

      {/* CSS */}
      <style jsx global>{`
        @keyframes threat-appear {
          0% { transform: translateY(-20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}
