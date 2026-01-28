'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ConvoyTrackingPanelEnhanced from './ConvoyTrackingPanelEnhanced';
import TacticalMetricsHUDEnhanced from './TacticalMetricsHUDEnhanced';
import TacticalRouteAnalytics from './TacticalRouteAnalytics';

const API_V1 = '/api/proxy/v1';

// ============================================================================
// ENHANCED INTERFACES
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
  assigned_unit?: string;
  total_km: number;
  obstacle_response?: {
    action: string;
    obstacle_type?: string;
    awaiting_clearance?: boolean;
    speed_reduction?: number;
  };
}

interface AdvancedMetrics {
  vehicle_id: number;
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
    hours_since_service: number;
  };
  gps: {
    latitude: number;
    longitude: number;
    altitude_m: number;
    speed_kmh: number;
    heading_degrees: number;
    accuracy_m: number;
    satellites_visible: number;
    hdop: number;
    signal_quality: string;
    position_valid: boolean;
  };
  fuel: {
    current_level_liters: number;
    max_capacity_liters: number;
    percent_remaining: number;
    consumption_rate_lph: number;
    consumption_rate_kpl: number;
    estimated_range_km: number;
    fuel_type: string;
    quality_index: number;
    low_fuel_warning: boolean;
    critical_fuel_warning: boolean;
    time_to_empty_hours: number;
  };
  communication: {
    radio_signal_strength: number;
    radio_frequency_mhz: number;
    encryption_active: boolean;
    last_contact_seconds_ago: number;
    packet_loss_percent: number;
    latency_ms: number;
    comms_status: string;
    in_dead_zone: boolean;
    satellite_link_active: boolean;
  };
}

interface RouteDefinition {
  route_id: string;
  name: string;
  category: string;
  origin: { name: string; lat: number; lng: number };
  destination: { name: string; lat: number; lng: number };
  waypoints: Array<[number, number]>;
  distance_km: number;
  estimated_time_hours: number;
  terrain_zones: string[];
  color: string;
  threat_level: string;
  description: string;
  convoy_assigned?: number;
  status: string;
}

interface ScenarioEvent {
  event_id: string;
  event_type: string;
  event_subtype: string;
  severity: string;
  location: [number, number];
  radius_meters: number;
  title: string;
  description: string;
  duration_minutes: number;
  affects_routes: string[];
  ai_assessment: string;
  recommended_action: string;
  status: string;
  created_at: string;
  expires_at: string;
}

interface AIRecommendation {
  recommendation_id: string;
  model_used: string;
  timestamp: string;
  primary_action: string;
  confidence_score: number;
  reasoning: string;
  alternative_actions: Array<{
    action: string;
    confidence: number;
    description: string;
  }>;
  risk_assessment: {
    current_risk: string;
    risk_if_ignored: string;
    risk_with_action: string;
  };
  execution_steps: string[];
  estimated_time_minutes: number;
}

interface SimState {
  isRunning: boolean;
  isPaused: boolean;
  startTime: Date | null;
  elapsedSeconds: number;
  scenario: string;
  obstaclesGenerated: number;
  obstaclesResolved: number;
  vehiclesActive: number;
  routesActive: number;
  eventsActive: number;
  aiRecommendationsIssued: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getStatusColor = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'MOVING': return '#22c55e';
    case 'HALTED_OBSTACLE': return '#ef4444';
    case 'SLOWED': return '#f59e0b';
    case 'ARRIVED': return '#3b82f6';
    case 'REFUELING': return '#06b6d4';
    case 'MAINTENANCE': return '#a855f7';
    default: return '#6b7280';
  }
};

const getSeverityConfig = (severity: string) => {
  switch (severity?.toUpperCase()) {
    case 'EMERGENCY': return { color: '#ff0000', bg: 'rgba(255, 0, 0, 0.2)', label: 'EMERGENCY' };
    case 'CRITICAL': return { color: '#dc2626', bg: 'rgba(220, 38, 38, 0.2)', label: 'CRITICAL' };
    case 'WARNING': return { color: '#f97316', bg: 'rgba(249, 115, 22, 0.2)', label: 'WARNING' };
    case 'HIGH': return { color: '#f97316', bg: 'rgba(249, 115, 22, 0.2)', label: 'HIGH' };
    case 'CAUTION': return { color: '#eab308', bg: 'rgba(234, 179, 8, 0.2)', label: 'CAUTION' };
    case 'MEDIUM': return { color: '#eab308', bg: 'rgba(234, 179, 8, 0.2)', label: 'MEDIUM' };
    case 'ADVISORY': return { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.2)', label: 'ADVISORY' };
    case 'LOW': return { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.2)', label: 'LOW' };
    default: return { color: '#6b7280', bg: 'rgba(107, 114, 128, 0.2)', label: 'UNKNOWN' };
  }
};

const getEventIcon = (type: string, subtype: string) => {
  const t = (type + ' ' + subtype).toUpperCase();
  if (t.includes('IED') || t.includes('EXPLOSIVE')) return '💣';
  if (t.includes('AMBUSH') || t.includes('HOSTILE')) return '⚔️';
  if (t.includes('LANDSLIDE') || t.includes('ROCKFALL')) return '🏔️';
  if (t.includes('AVALANCHE')) return '❄️';
  if (t.includes('FLOOD')) return '🌊';
  if (t.includes('BRIDGE')) return '🌉';
  if (t.includes('BLIZZARD') || t.includes('SNOW')) return '🌨️';
  if (t.includes('FOG')) return '🌫️';
  if (t.includes('STORM')) return '⛈️';
  if (t.includes('SECURITY') || t.includes('THREAT')) return '🚨';
  if (t.includes('ACCIDENT')) return '🚧';
  if (t.includes('FUEL') || t.includes('SUPPLY')) return '⛽';
  if (t.includes('MEDICAL') || t.includes('CASUALTY')) return '🏥';
  if (t.includes('COMMS') || t.includes('COMMUNICATION')) return '📡';
  return '⚠️';
};

const getRouteColor = (category: string) => {
  switch (category?.toUpperCase()) {
    case 'STRATEGIC': return '#ef4444';
    case 'TACTICAL': return '#f97316';
    case 'EMERGENCY': return '#dc2626';
    case 'LOGISTICS': return '#22c55e';
    case 'PATROL': return '#3b82f6';
    case 'RECONNAISSANCE': return '#a855f7';
    default: return '#6b7280';
  }
};

const getThreatLevelColor = (level: string) => {
  switch (level?.toUpperCase()) {
    case 'GREEN': return '#22c55e';
    case 'YELLOW': return '#eab308';
    case 'ORANGE': return '#f97316';
    case 'RED': return '#dc2626';
    case 'BLACK': return '#1f2937';
    default: return '#6b7280';
  }
};

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface CommandCenterAdvancedProps {
  onVehicleSelect?: (vehicle: VehicleTelemetry | null) => void;
  onRouteSelect?: (route: RouteDefinition | null) => void;
  selectedVehicleId?: number | null;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CommandCenterAdvanced({
  onVehicleSelect,
  onRouteSelect,
  selectedVehicleId
}: CommandCenterAdvancedProps) {
  // State
  const [vehicles, setVehicles] = useState<VehicleTelemetry[]>([]);
  const [routes, setRoutes] = useState<RouteDefinition[]>([]);
  const [events, setEvents] = useState<ScenarioEvent[]>([]);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [advancedMetrics, setAdvancedMetrics] = useState<Record<number, AdvancedMetrics>>({});

  const [selectedVehicle, setSelectedVehicle] = useState<VehicleTelemetry | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteDefinition | null>(null);

  const [activeTab, setActiveTab] = useState<'vehicles' | 'routes' | 'metrics' | 'tracking'>('vehicles');
  const [rightPanelTab, setRightPanelTab] = useState<'threats' | 'ai' | 'events'>('threats');

  const [simState, setSimState] = useState<SimState>({
    isRunning: false,
    isPaused: false,
    startTime: null,
    elapsedSeconds: 0,
    scenario: 'LADAKH_SUPPLY',
    obstaclesGenerated: 0,
    obstaclesResolved: 0,
    vehiclesActive: 0,
    routesActive: 0,
    eventsActive: 0,
    aiRecommendationsIssued: 0
  });

  const [showThreatAlert, setShowThreatAlert] = useState(false);
  const [currentThreat, setCurrentThreat] = useState<ScenarioEvent | null>(null);
  const [aiStatus, setAiStatus] = useState<{ available: boolean; provider: string; model: string }>({
    available: false,
    provider: 'HEURISTIC',
    model: 'GUARDIAN_HEURISTIC_v2.0'
  });

  const [recentLogs, setRecentLogs] = useState<Array<{ type: string; message: string; time: Date; severity?: string }>>([]);

  // Refs
  const tickIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // LOGGING
  // ============================================================================

  const addLog = useCallback((type: string, message: string, severity?: string) => {
    setRecentLogs(prev => [{
      type,
      message,
      time: new Date(),
      severity
    }, ...prev].slice(0, 50));
  }, []);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fetch(`${API_V1}/vehicles/vehicles`);
      if (res.ok) {
        const data = await res.json();
        setVehicles(data);
        setSimState(prev => ({ ...prev, vehiclesActive: data.length }));
      }
    } catch (e) {
      // Silent fail - API initializing
    }
  }, []);

  const fetchRoutes = useCallback(async () => {
    try {
      const res = await fetch(`${API_V1}/advanced/routes/list`);
      if (res.ok) {
        const data = await res.json();
        setRoutes(data.routes || []);
        setSimState(prev => ({ ...prev, routesActive: (data.routes || []).length }));
      }
    } catch (e) {
      // Silent fail - API initializing
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`${API_V1}/advanced/scenario/active`);
      if (res.ok) {
        const data = await res.json();
        const newEvents: ScenarioEvent[] = data.events || [];

        // Detect new critical events
        newEvents.forEach(event => {
          const existing = events.find(e => e.event_id === event.event_id);
          if (!existing && (event.severity === 'CRITICAL' || event.severity === 'EMERGENCY')) {
            setCurrentThreat(event);
            setShowThreatAlert(true);
            addLog('THREAT', `${event.title}`, event.severity);
            setTimeout(() => setShowThreatAlert(false), 5000);
          }
        });

        setEvents(newEvents);
        setSimState(prev => ({ ...prev, eventsActive: newEvents.length }));
      }
    } catch (e) {
      // Silent fail - API initializing
    }
  }, [events, addLog]);

  const fetchAdvancedMetrics = useCallback(async (vehicleId: number) => {
    try {
      const res = await fetch(`${API_V1}/advanced/metrics/${vehicleId}`);
      if (res.ok) {
        const data = await res.json();
        setAdvancedMetrics(prev => ({ ...prev, [vehicleId]: data }));
      }
    } catch (e) {
      // Silent fail
    }
  }, []);

  const fetchAIStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_V1}/advanced/ai/status`);
      if (res.ok) {
        const data = await res.json();
        setAiStatus({
          available: data.ai_available,
          provider: data.provider,
          model: data.model
        });
      }
    } catch (e) {
      // Silent fail - AI may not be configured
    }
  }, []);

  // ============================================================================
  // SIMULATION ACTIONS
  // ============================================================================

  const simulationTick = useCallback(async () => {
    try {
      const res = await fetch(`${API_V1}/advanced/simulation/tick-advanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();

        // Handle AI recommendations from tick
        if (data.ai_recommendations && data.ai_recommendations.length > 0) {
          setRecommendations(prev => [...data.ai_recommendations, ...prev].slice(0, 10));
          setSimState(prev => ({
            ...prev,
            aiRecommendationsIssued: prev.aiRecommendationsIssued + data.ai_recommendations.length
          }));

          data.ai_recommendations.forEach((rec: AIRecommendation) => {
            addLog('AI_REC', `${rec.primary_action}: ${rec.reasoning?.substring(0, 50)}...`, 'HIGH');
          });
        }
      }
      await fetchVehicles();
    } catch (e) {
      // Silently handle - simulation may not be running
      console.debug('Advanced tick skipped');
    }
  }, [fetchVehicles, addLog]);

  const generateEvent = useCallback(async () => {
    if (!simState.isRunning) return;

    // Pick a random route to generate event on
    const activeRoutes = routes.filter(r => r.status === 'ACTIVE');
    if (activeRoutes.length === 0) return;

    const route = activeRoutes[Math.floor(Math.random() * activeRoutes.length)];
    const waypoint = route.waypoints[Math.floor(Math.random() * route.waypoints.length)];

    try {
      const res = await fetch(`${API_V1}/advanced/scenario/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: waypoint[0],
          lng: waypoint[1],
          terrain: route.terrain_zones[0] || 'PLAINS',
          weather: 'CLEAR',
          time_of_day: 'DAY',
          route_ids: [route.route_id]
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.event_id) {
          addLog('SCENARIO', `Event generated: ${data.title}`, data.severity);
          setSimState(prev => ({ ...prev, obstaclesGenerated: prev.obstaclesGenerated + 1 }));
          await fetchEvents();
        }
      }
    } catch (e) {
      // Silent fail
    }
  }, [simState.isRunning, routes, addLog, fetchEvents]);

  const startAdvancedSimulation = useCallback(async () => {
    addLog('SYSTEM', `ADVANCED COMMAND CENTER ONLINE`, 'LOW');
    addLog('SYSTEM', `Scenario: ${simState.scenario}`, 'LOW');

    try {
      // Generate routes first
      const routesRes = await fetch(`${API_V1}/advanced/routes/scenario/${simState.scenario}`);
      if (routesRes.ok) {
        const data = await routesRes.json();
        setRoutes(data.routes || []);
        addLog('ROUTES', `${(data.routes || []).length} routes generated`, 'LOW');
      }

      // Start advanced simulation
      const simRes = await fetch(`${API_V1}/advanced/simulation/start-advanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: simState.scenario,
          num_convoys: 3,
          speed_multiplier: 2.0,
          generate_threats: true
        })
      });

      if (simRes.ok) {
        const simData = await simRes.json();
        addLog('CONVOY', `${simData.convoys?.length || 0} convoys activated`, 'LOW');

        if (simData.initial_events) {
          simData.initial_events.forEach((e: ScenarioEvent) => {
            addLog('SCENARIO', `Initial: ${e.title}`, e.severity);
          });
        }
      }

      // Start regular demo for fallback
      await fetch(`${API_V1}/vehicles/start-demo?speed_multiplier=2`, { method: 'POST' });

      setSimState(prev => ({
        ...prev,
        isRunning: true,
        isPaused: false,
        startTime: new Date(),
        elapsedSeconds: 0,
        obstaclesGenerated: 0,
        obstaclesResolved: 0
      }));

      // Start tick interval
      tickIntervalRef.current = setInterval(simulationTick, 500);

      // Start event generation
      const scheduleEvent = () => {
        const delay = 8000 + Math.random() * 12000;
        eventIntervalRef.current = setTimeout(async () => {
          await generateEvent();
          if (simState.isRunning) scheduleEvent();
        }, delay);
      };
      setTimeout(scheduleEvent, 5000);

      // Timer
      timerRef.current = setInterval(() => {
        setSimState(prev => ({ ...prev, elapsedSeconds: prev.elapsedSeconds + 1 }));
      }, 1000);

      // Initial fetches
      await fetchVehicles();
      await fetchEvents();
      await fetchAIStatus();

    } catch (e) {
      addLog('ERROR', 'Failed to start simulation', 'CRITICAL');
    }
  }, [simState.scenario, addLog, simulationTick, generateEvent, fetchVehicles, fetchEvents, fetchAIStatus]);

  const stopSimulation = useCallback(async () => {
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    if (eventIntervalRef.current) clearTimeout(eventIntervalRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      await fetch(`${API_V1}/vehicles/stop-demo`, { method: 'POST' });
    } catch (e) {
      // Silent fail
    }

    setSimState(prev => ({ ...prev, isRunning: false, isPaused: false }));
    addLog('SYSTEM', 'Simulation terminated', 'LOW');
  }, [addLog]);

  const requestAIRecommendation = useCallback(async (event: ScenarioEvent) => {
    try {
      const res = await fetch(`${API_V1}/advanced/ai/obstacle-recommendation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          obstacle: {
            obstacle_type: event.event_subtype,
            severity: event.severity,
            latitude: event.location[0],
            longitude: event.location[1],
            description: event.description
          },
          convoy: {},
          route: {},
          conditions: { weather: 'CLEAR', visibility_km: 10 }
        })
      });

      if (res.ok) {
        const rec = await res.json();
        setRecommendations(prev => [rec, ...prev].slice(0, 10));
        setSimState(prev => ({
          ...prev,
          aiRecommendationsIssued: prev.aiRecommendationsIssued + 1
        }));
        addLog('AI_REC', `${rec.primary_action}: ${rec.reasoning}`, 'HIGH');
      }
    } catch (e) {
      // Silent fail - AI may not be available
    }
  }, [addLog]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      if (eventIntervalRef.current) clearTimeout(eventIntervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // AUTO-START simulation on component mount
  useEffect(() => {
    const autoStartTimer = setTimeout(() => {
      if (!simState.isRunning) {
        startAdvancedSimulation();
      }
    }, 1500); // Small delay to let component fully initialize

    return () => clearTimeout(autoStartTimer);
  }, []); // Run only on mount

  useEffect(() => {
    fetchAIStatus();
    fetchVehicles();
    fetchRoutes();
    
    // Always poll for vehicle updates regardless of simulation state
    const vehiclePoll = setInterval(() => {
      fetchVehicles();
    }, 1000); // Poll vehicles every 1 second for smoother updates
    
    return () => clearInterval(vehiclePoll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (simState.isRunning) {
      const poll = setInterval(() => {
        fetchEvents();
        fetchRoutes();
      }, 3000);
      return () => clearInterval(poll);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simState.isRunning]);

  // Fetch advanced metrics for selected vehicle
  useEffect(() => {
    if (selectedVehicle) {
      fetchAdvancedMetrics(selectedVehicle.id);
      const interval = setInterval(() => fetchAdvancedMetrics(selectedVehicle.id), 2000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicle?.id]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      {/* THREAT ALERT OVERLAY */}
      {showThreatAlert && currentThreat && (
        <div className="fixed inset-0 z-[300] pointer-events-none flex items-start justify-center pt-20">
          <div
            className="px-8 py-4 rounded-lg"
            style={{
              background: 'rgba(0,0,0,0.95)',
              border: `2px solid ${getSeverityConfig(currentThreat.severity).color}`,
              boxShadow: `0 0 40px ${getSeverityConfig(currentThreat.severity).color}`,
              animation: 'threat-appear 0.3s ease-out'
            }}
          >
            <div className="flex items-center gap-4">
              <span className="text-4xl">{getEventIcon(currentThreat.event_type, currentThreat.event_subtype)}</span>
              <div>
                <div className="text-red-500 text-xs font-bold tracking-widest mb-1">⚠ THREAT DETECTED</div>
                <div className="text-white text-xl font-bold">{currentThreat.title}</div>
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

      {/* LEFT PANEL */}
      <div style={{
        position: 'fixed',
        left: 0,
        top: 50,
        bottom: 0,
        width: 360,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column' as const,
        paddingBottom: 80,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(10,25,40,0.95) 100%)',
        borderRight: '1px solid rgba(34, 197, 94, 0.3)'
      }}>
        {/* Tab Navigation */}
        <div className="flex border-b border-green-900/50">
          {(['vehicles', 'routes', 'metrics', 'tracking'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all ${activeTab === tab
                ? 'text-green-400 border-b-2 border-green-400 bg-green-900/20'
                : 'text-gray-500 hover:text-gray-300'
                }`}
            >
              {tab === 'vehicles' ? '🚛 Vehicles' : tab === 'routes' ? '🗺️ Routes' : tab === 'metrics' ? '📊 Metrics' : '📡 Tracking'}
            </button>
          ))}
        </div>

        {/* VEHICLES TAB */}
        {activeTab === 'vehicles' && (
          <>
            <div className="px-4 py-2 border-b border-green-900/30">
              <div className="text-gray-500 text-xs">
                {vehicles.length} UNITS | {vehicles.filter(v => v.status === 'MOVING').length} IN MOTION
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {vehicles.map(vehicle => (
                <div
                  key={vehicle.id}
                  onClick={() => {
                    setSelectedVehicle(vehicle);
                    onVehicleSelect?.(vehicle);
                    setActiveTab('metrics'); // Switch to metrics tab when vehicle is selected
                  }}
                  className={`px-4 py-3 border-b border-gray-800/50 cursor-pointer transition-all hover:bg-gray-800/50 ${selectedVehicle?.id === vehicle.id ? 'bg-green-900/30 border-l-2 border-l-green-500' : ''
                    }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: getStatusColor(vehicle.status) }} />
                      <span className="text-white font-bold text-sm">{vehicle.name}</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded" style={{
                      background: getStatusColor(vehicle.status) + '20',
                      color: getStatusColor(vehicle.status)
                    }}>
                      {vehicle.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-xs">
                    <div className="bg-gray-900/50 rounded px-2 py-1">
                      <div className="text-gray-500 text-[10px]">SPD</div>
                      <div className="text-green-400 font-mono">{vehicle.speed_kmh?.toFixed(0)}km/h</div>
                    </div>
                    <div className="bg-gray-900/50 rounded px-2 py-1">
                      <div className="text-gray-500 text-[10px]">FUEL</div>
                      <div className={`font-mono ${vehicle.fuel_percent < 25 ? 'text-red-400' : 'text-yellow-400'}`}>
                        {vehicle.fuel_percent?.toFixed(0)}%
                      </div>
                    </div>
                    <div className="bg-gray-900/50 rounded px-2 py-1">
                      <div className="text-gray-500 text-[10px]">RNG</div>
                      <div className="text-blue-400 font-mono">{vehicle.range_remaining_km?.toFixed(0)}km</div>
                    </div>
                    <div className="bg-gray-900/50 rounded px-2 py-1">
                      <div className="text-gray-500 text-[10px]">BRG</div>
                      <div className="text-cyan-400 font-mono">{vehicle.bearing?.toFixed(0)}°</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ROUTES TAB */}
        {activeTab === 'routes' && (
          <>
            <div className="px-4 py-2 border-b border-green-900/30">
              <div className="text-gray-500 text-xs">
                {routes.length} ROUTES ACTIVE
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {routes.map(route => (
                <div
                  key={route.route_id}
                  onClick={() => {
                    setSelectedRoute(route);
                    onRouteSelect?.(route);
                    // Clear vehicle selection to show route analytics instead
                    setSelectedVehicle(null);
                    setActiveTab('metrics');
                  }}
                  className={`px-4 py-3 border-b border-gray-800/50 cursor-pointer transition-all hover:bg-gray-800/50 ${selectedRoute?.route_id === route.route_id ? 'bg-green-900/30 border-l-2 border-l-green-500' : ''
                    }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ background: getRouteColor(route.category) }} />
                      <span className="text-white font-bold text-sm">{route.name}</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded" style={{
                      background: getThreatLevelColor(route.threat_level) + '30',
                      color: getThreatLevelColor(route.threat_level)
                    }}>
                      {route.threat_level}
                    </span>
                  </div>
                  <div className="text-gray-400 text-xs mb-2">
                    {route.origin?.name || 'Origin'} → {route.destination?.name || 'Destination'}
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-xs">
                    <div className="bg-gray-900/50 rounded px-2 py-1">
                      <div className="text-gray-500 text-[10px]">DIST</div>
                      <div className="text-green-400 font-mono">{route.distance_km?.toFixed(0)}km</div>
                    </div>
                    <div className="bg-gray-900/50 rounded px-2 py-1">
                      <div className="text-gray-500 text-[10px]">TIME</div>
                      <div className="text-yellow-400 font-mono">{route.estimated_time_hours?.toFixed(1)}h</div>
                    </div>
                    <div className="bg-gray-900/50 rounded px-2 py-1">
                      <div className="text-gray-500 text-[10px]">TYPE</div>
                      <div className="text-blue-400 font-mono text-[10px]">{route.category}</div>
                    </div>
                  </div>
                </div>
              ))}
              {routes.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <div className="text-3xl mb-2">🗺️</div>
                  <div>No routes generated</div>
                  <div className="text-xs mt-1">Start simulation to generate routes</div>
                </div>
              )}
            </div>
          </>
        )}

        {/* METRICS TAB - Uses Tactical Metrics HUD Enhanced (Indian Army themed, ultra-high-frequency) */}
        {activeTab === 'metrics' && selectedVehicle && (
          <div className="flex-1 overflow-hidden">
            <TacticalMetricsHUDEnhanced
              vehicleId={selectedVehicle.id}
              vehicleName={selectedVehicle.name}
              mode="expanded"
              operationZone="KASHMIR"
              isSimulationRunning={simState.isRunning}
              onClose={() => setSelectedVehicle(null)}
            />
          </div>
        )}

        {/* METRICS TAB - Route Mode uses Tactical Route Analytics (full details) */}
        {activeTab === 'metrics' && !selectedVehicle && selectedRoute && (
          <div className="flex-1 overflow-hidden">
            <TacticalRouteAnalytics
              route={{
                route_id: selectedRoute.route_id,
                name: selectedRoute.name,
                category: selectedRoute.category,
                origin: selectedRoute.origin,
                destination: selectedRoute.destination,
                distance_km: selectedRoute.distance_km,
                estimated_time_hours: selectedRoute.estimated_time_hours,
                threat_level: selectedRoute.threat_level,
                terrain_types: selectedRoute.terrain_zones
              }}
              isSimulationRunning={simState.isRunning}
              onClose={() => setSelectedRoute(null)}
            />
          </div>
        )}

        {activeTab === 'metrics' && !selectedVehicle && !selectedRoute && (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-3xl mb-2">📊</div>
              <div>Select a vehicle or route to view metrics</div>
            </div>
          </div>
        )}

        {/* TRACKING TAB - FlightRadar24 Style Convoy Tracking */}
        {activeTab === 'tracking' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <ConvoyTrackingPanelEnhanced />
          </div>
        )}
      </div>

      {/* RIGHT PANEL */}
      <div style={{
        position: 'fixed',
        right: 0,
        top: 50,
        bottom: 0,
        width: 400,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column' as const,
        paddingBottom: 80,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(40,10,10,0.95) 100%)',
        borderLeft: '1px solid rgba(239, 68, 68, 0.3)'
      }}>
        {/* Tab Navigation */}
        <div className="flex border-b border-red-900/50">
          {(['threats', 'ai', 'events'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setRightPanelTab(tab)}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all ${rightPanelTab === tab
                ? 'text-red-400 border-b-2 border-red-400 bg-red-900/20'
                : 'text-gray-500 hover:text-gray-300'
                }`}
            >
              {tab === 'threats' ? '🎯 Threats' : tab === 'ai' ? '🤖 AI' : '📋 Log'}
            </button>
          ))}
        </div>

        {/* THREATS TAB */}
        {rightPanelTab === 'threats' && (
          <div className="flex-1 overflow-y-auto p-3">
            {events.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <div className="text-3xl mb-2">✅</div>
                  <div>No active threats</div>
                </div>
              </div>
            ) : (
              events.map(event => {
                const config = getSeverityConfig(event.severity);
                return (
                  <div
                    key={event.event_id}
                    className="p-3 mb-2 rounded-lg"
                    style={{
                      background: config.bg,
                      border: `1px solid ${config.color}40`
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{getEventIcon(event.event_type, event.event_subtype)}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-white font-bold text-sm">{event.title}</span>
                          <span
                            className="text-xs px-2 py-0.5 rounded font-bold"
                            style={{ background: config.color, color: 'black' }}
                          >
                            {config.label}
                          </span>
                        </div>
                        <div className="text-gray-400 text-xs mt-1">{event.description}</div>
                        <div className="text-gray-600 text-xs mt-1">
                          📍 {event.location?.[0]?.toFixed(4)}, {event.location?.[1]?.toFixed(4)}
                        </div>
                        {event.ai_assessment && (
                          <div className="mt-2 p-2 bg-black/50 rounded text-xs">
                            <div className="text-blue-400 font-bold mb-1">AI Assessment:</div>
                            <div className="text-gray-300">{event.ai_assessment}</div>
                          </div>
                        )}
                        <button
                          onClick={() => requestAIRecommendation(event)}
                          className="mt-2 text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded"
                        >
                          🤖 Get AI Recommendation
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* AI TAB */}
        {rightPanelTab === 'ai' && (
          <div className="flex-1 overflow-y-auto p-3">
            {/* AI Status */}
            <div className="bg-gray-900/50 rounded-lg p-3 mb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-gray-500 font-bold">AI STATUS</div>
                <div className={`w-2 h-2 rounded-full ${aiStatus.available ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-gray-500">Provider:</span> <span className="text-green-400">{aiStatus.provider}</span></div>
                <div><span className="text-gray-500">Model:</span> <span className="text-blue-400">{aiStatus.model}</span></div>
              </div>
            </div>

            {/* Recommendations */}
            <div className="text-xs text-gray-500 font-bold mb-2">RECOMMENDATIONS ({recommendations.length})</div>
            {recommendations.map((rec, idx) => (
              <div key={rec.recommendation_id || idx} className="bg-green-900/20 border border-green-900/50 rounded-lg p-3 mb-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-green-400 font-bold text-sm">{rec.primary_action}</span>
                  <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">
                    {(rec.confidence_score * 100).toFixed(0)}% confidence
                  </span>
                </div>
                <div className="text-gray-300 text-xs mb-2">{rec.reasoning}</div>
                {rec.execution_steps && rec.execution_steps.length > 0 && (
                  <div className="text-xs">
                    <div className="text-gray-500 mb-1">Steps:</div>
                    {rec.execution_steps.slice(0, 3).map((step, i) => (
                      <div key={i} className="text-gray-400 pl-2">• {step}</div>
                    ))}
                  </div>
                )}
                <div className="text-xs text-gray-600 mt-2">
                  {rec.model_used} | {rec.estimated_time_minutes} min
                </div>
              </div>
            ))}
            {recommendations.length === 0 && (
              <div className="h-48 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <div className="text-3xl mb-2">🤖</div>
                  <div>No recommendations yet</div>
                  <div className="text-xs mt-1">AI will provide recommendations for threats</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* EVENTS LOG TAB */}
        {rightPanelTab === 'events' && (
          <div className="flex-1 overflow-y-auto p-2">
            {recentLogs.map((log, idx) => (
              <div key={idx} className="px-2 py-1.5 text-xs border-b border-gray-900/50">
                <div className="flex items-center gap-2">
                  <span className={`${log.type === 'THREAT' ? 'text-red-400' :
                    log.type === 'AI_REC' ? 'text-green-400' :
                      log.type === 'SCENARIO' ? 'text-orange-400' :
                        log.type === 'CONVOY' ? 'text-green-400' :
                          log.type === 'ROUTES' ? 'text-blue-400' :
                            'text-gray-400'
                    }`}>
                    [{log.type}]
                  </span>
                  <span className="text-gray-300 flex-1 truncate">{log.message}</span>
                </div>
                <div className="text-gray-600 text-[10px]">{log.time.toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
        )}
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
        {/* Left - Status */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${simState.isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
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
                Vehicles: <span className="text-green-400 font-bold">{simState.vehiclesActive}</span>
              </div>
              <div className="text-gray-400">
                Routes: <span className="text-blue-400 font-bold">{simState.routesActive}</span>
              </div>
              <div className="text-gray-400">
                Events: <span className="text-red-400 font-bold">{simState.eventsActive}</span>
              </div>
              <div className="text-gray-400">
                AI Recs: <span className="text-green-400 font-bold">{simState.aiRecommendationsIssued}</span>
              </div>
            </div>
          )}
        </div>

        {/* Center - Controls */}
        <div className="flex items-center gap-4">
          {!simState.isRunning ? (
            <>
              <select
                value="KASHMIR_OPS"
                onChange={() => setSimState(prev => ({ ...prev, scenario: 'KASHMIR_OPS' }))}
                className="bg-gray-800 border border-gray-600 text-white px-3 py-2 rounded text-sm"
              >
                <option value="KASHMIR_OPS">Kashmir Operations</option>
              </select>
              <button
                onClick={startAdvancedSimulation}
                className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-8 py-3 rounded-lg font-bold text-sm transition-all transform hover:scale-105 shadow-lg"
              >
                <span className="text-lg">▶</span>
                START ADVANCED SIMULATION
              </button>
            </>
          ) : (
            <>
              <button
                onClick={generateEvent}
                className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all"
              >
                💥 INJECT SCENARIO
              </button>
              <button
                onClick={stopSimulation}
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
            <div className="text-gray-500 text-xs">PATHFINDING</div>
            <div className="text-cyan-400 font-bold text-sm flex items-center gap-1">
              <span className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
              A*/DIJKSTRA/GENETIC
            </div>
          </div>
          <div className="w-px h-8 bg-gray-700" />
          <div className="text-right">
            <div className="text-gray-500 text-xs">AI MODEL</div>
            <div className="text-green-400 font-bold text-sm flex items-center gap-1">
              {aiStatus.available && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
              {aiStatus.model.length > 15 ? aiStatus.model.substring(0, 15) + '...' : aiStatus.model}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes threat-appear {
          0% { transform: translateY(-20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}
