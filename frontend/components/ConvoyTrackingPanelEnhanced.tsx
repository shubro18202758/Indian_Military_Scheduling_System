'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Truck, 
  MapPin, 
  Clock, 
  Fuel, 
  Shield, 
  AlertTriangle, 
  Brain,
  Radio,
  Users,
  Package,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
  Compass,
  Gauge,
  Activity,
  CheckCircle,
  XCircle,
  Target,
  Crosshair,
  Cloud,
  Thermometer,
  Navigation,
  TrendingUp,
  Wind,
  Zap,
  Cpu,
  MapPinned,
  Route,
  Timer
} from 'lucide-react';
import ResizablePanel from './ResizablePanel';

const API_V1 = '/api/proxy/v1';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ConvoySummary {
  convoy_id: number;
  mission_id: string;
  callsign: string;
  unit: string;
  formation: string;
  cargo_type: string;
  vehicle_count: number;
  personnel_count: number;
  priority: string;
  classification: string;
  status: string;
  armed_escort: boolean;
}

interface Vehicle {
  vehicle_id: number;
  callsign: string;
  registration: string;
  vehicle_type: string;
  vehicle_class: string;
  convoy_position: number;
  is_lead: boolean;
  is_tail: boolean;
  is_command: boolean;
  fuel_level_pct: number;
  health_status: string;
  driver: string;
  commander: string | null;
}

interface Prediction {
  prediction_id: string;
  type: string;
  title: string;
  summary: string;
  confidence?: number;
  probability?: number;
  risk_level?: string;
  recommendations?: string[];
  generated_by: string;
  timestamp: string;
}

interface ConvoyDetail {
  convoy_id: number;
  mission: any;
  vehicles: Vehicle[];
  tracking_status: string;
}

interface AIForecast {
  weather: {
    condition: string;
    temperature: number;
    visibility_km: number;
    wind_speed_kmh: number;
    impact: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  threat: {
    level: string;
    active_count: number;
    areas: string[];
  };
  eta: {
    predicted_minutes: number;
    delay_minutes: number;
    confidence: number;
  };
  fuel: {
    current_avg: number;
    predicted_consumption: number;
    stops_required: number;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'FLASH': return { bg: '#dc2626', text: '#fff' };
    case 'IMMEDIATE': return { bg: '#f97316', text: '#fff' };
    case 'PRIORITY': return { bg: '#eab308', text: '#000' };
    case 'ROUTINE': return { bg: '#22c55e', text: '#fff' };
    default: return { bg: '#6b7280', text: '#fff' };
  }
};

const getClassificationColor = (classification: string) => {
  switch (classification) {
    case 'TOP_SECRET': return { bg: '#dc2626', text: '#fff' };
    case 'SECRET': return { bg: '#f97316', text: '#fff' };
    case 'CONFIDENTIAL': return { bg: '#3b82f6', text: '#fff' };
    case 'RESTRICTED': return { bg: '#eab308', text: '#000' };
    case 'UNCLASSIFIED': return { bg: '#22c55e', text: '#fff' };
    default: return { bg: '#6b7280', text: '#fff' };
  }
};

const getStatusColor = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'ACTIVE':
    case 'MOVING':
    case 'OPERATIONAL':
    case 'RUNNING':
    case 'GREEN':
      return '#22c55e';
    case 'HALTED':
    case 'STOPPED':
    case 'AMBER':
    case 'IDLE':
      return '#eab308';
    case 'DELAYED':
    case 'RED':
    case 'ERROR':
      return '#dc2626';
    default:
      return '#6b7280';
  }
};

const getCargoIcon = (cargoType: string) => {
  switch (cargoType) {
    case 'AMMUNITION': return '💣';
    case 'RATIONS': return '🍞';
    case 'FUEL': return '⛽';
    case 'EQUIPMENT': return '🔧';
    case 'MEDICAL': return '🏥';
    case 'PERSONNEL': return '👥';
    case 'MIXED': return '📦';
    default: return '📦';
  }
};

const formatConfidence = (value?: number): string => {
  if (value === undefined || value === null || isNaN(value)) return '--';
  if (value > 1) return `${Math.round(value)}%`;
  return `${Math.round(value * 100)}%`;
};

const formatTime = (minutes: number): string => {
  if (!minutes || isNaN(minutes)) return '--';
  const hrs = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
};

// ============================================================================
// CONVOY LIST PANEL
// ============================================================================

interface ConvoyListProps {
  convoys: ConvoySummary[];
  selectedConvoyId: number | null;
  onSelectConvoy: (id: number) => void;
  isLoading: boolean;
}

const ConvoyListPanel = ({ convoys, selectedConvoyId, onSelectConvoy, isLoading }: ConvoyListProps) => {
  if (isLoading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} color="#3b82f6" />
        <p style={{ color: '#9ca3af', marginTop: '10px', fontSize: 12 }}>Loading convoys...</p>
      </div>
    );
  }

  if (convoys.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <Truck size={32} color="#4b5563" />
        <p style={{ color: '#6b7280', marginTop: '10px', fontSize: 12 }}>No convoys available</p>
      </div>
    );
  }

  return (
    <div style={{ maxHeight: 'calc(100% - 50px)', overflowY: 'auto' }}>
      {convoys.map((convoy) => {
        const priorityColors = getPriorityColor(convoy.priority);
        const classColors = getClassificationColor(convoy.classification);
        const isSelected = selectedConvoyId === convoy.convoy_id;
        
        return (
          <div
            key={convoy.convoy_id}
            onClick={() => onSelectConvoy(convoy.convoy_id)}
            style={{
              padding: '12px',
              cursor: 'pointer',
              backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              borderLeft: isSelected ? '3px solid #3b82f6' : '3px solid transparent',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => !isSelected && (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)')}
            onMouseLeave={(e) => !isSelected && (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            {/* Header Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ 
                  width: '10px', 
                  height: '10px', 
                  borderRadius: '50%', 
                  backgroundColor: getStatusColor(convoy.status),
                  boxShadow: `0 0 8px ${getStatusColor(convoy.status)}` 
                }} />
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '13px', color: '#fff' }}>
                  {convoy.callsign}
                </span>
              </div>
              <span style={{
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '9px',
                fontWeight: 'bold',
                backgroundColor: priorityColors.bg,
                color: priorityColors.text
              }}>
                {convoy.priority}
              </span>
            </div>
            
            {/* Second Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '10px', color: '#9ca3af' }}>{convoy.unit}</span>
              <span style={{
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '8px',
                fontWeight: 'bold',
                backgroundColor: classColors.bg,
                color: classColors.text
              }}>
                {convoy.classification.replace('_', ' ')}
              </span>
            </div>
            
            {/* Stats Row */}
            <div style={{ display: 'flex', gap: '10px', fontSize: '10px', color: '#6b7280' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {getCargoIcon(convoy.cargo_type)} {convoy.cargo_type}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Truck size={10} /> {convoy.vehicle_count}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Users size={10} /> {convoy.personnel_count}
              </span>
              {convoy.armed_escort && (
                <span style={{ color: '#dc2626' }}>
                  <Shield size={10} />
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ============================================================================
// MISSION PANEL
// ============================================================================

const MissionPanel = ({ mission }: { mission: any }) => {
  if (!mission || Object.keys(mission).length === 0) {
    return <p style={{ color: '#6b7280', textAlign: 'center', padding: 20 }}>Mission data not available</p>;
  }

  const sectionStyle = {
    padding: '12px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: '8px',
    marginBottom: '10px'
  };

  const headingStyle = {
    fontSize: '10px',
    fontWeight: 'bold' as const,
    color: '#9ca3af',
    marginBottom: '10px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px'
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '6px',
    fontSize: '11px'
  };

  return (
    <div style={{ maxHeight: '100%', overflowY: 'auto' }}>
      {/* Unit Information */}
      <div style={sectionStyle}>
        <div style={headingStyle}>Unit Information</div>
        <div style={gridStyle}>
          <span style={{ color: '#6b7280' }}>Unit:</span>
          <span style={{ color: '#fff', fontWeight: 'bold' }}>{mission.unit_name || mission.unit_id}</span>
          <span style={{ color: '#6b7280' }}>Formation:</span>
          <span style={{ color: '#fff' }}>{mission.formation_name || mission.formation}</span>
          <span style={{ color: '#6b7280' }}>Command:</span>
          <span style={{ color: '#fff' }}>{mission.command || '--'}</span>
          <span style={{ color: '#6b7280' }}>HQ:</span>
          <span style={{ color: '#fff' }}>{mission.hq_location || '--'}</span>
        </div>
      </div>

      {/* Personnel */}
      <div style={sectionStyle}>
        <div style={headingStyle}>Personnel Strength</div>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          {[
            { label: 'Officers', value: mission.officer_count || 0 },
            { label: 'JCOs', value: mission.jco_count || 0 },
            { label: 'ORs', value: mission.or_count || 0 },
            { label: 'Total', value: mission.personnel_count || 0, highlight: true }
          ].map((item, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: item.highlight ? '#3b82f6' : '#fff' }}>
                {item.value}
              </div>
              <div style={{ fontSize: '9px', color: '#6b7280' }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cargo */}
      <div style={sectionStyle}>
        <div style={headingStyle}>Cargo Manifest</div>
        <div style={gridStyle}>
          <span style={{ color: '#6b7280' }}>Type:</span>
          <span style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {getCargoIcon(mission.cargo_type)} {mission.cargo_type}
          </span>
          <span style={{ color: '#6b7280' }}>Weight:</span>
          <span style={{ color: '#fff' }}>{mission.cargo_weight_tons?.toFixed(1) || '--'} tons</span>
          <span style={{ color: '#6b7280' }}>Description:</span>
          <span style={{ color: '#fff', fontSize: '10px' }}>{mission.cargo_description || '--'}</span>
        </div>
      </div>

      {/* Communications */}
      <div style={sectionStyle}>
        <div style={headingStyle}>Communications</div>
        <div style={gridStyle}>
          <span style={{ color: '#6b7280' }}>Callsign:</span>
          <span style={{ color: '#22c55e', fontFamily: 'monospace', fontWeight: 'bold' }}>{mission.callsign}</span>
          <span style={{ color: '#6b7280' }}>Primary:</span>
          <span style={{ color: '#fff', fontFamily: 'monospace' }}>{mission.primary_freq || '--'}</span>
          <span style={{ color: '#6b7280' }}>Alternate:</span>
          <span style={{ color: '#fff', fontFamily: 'monospace' }}>{mission.alternate_freq || '--'}</span>
          <span style={{ color: '#6b7280' }}>SATCOM:</span>
          <span style={{ 
            padding: '2px 6px', 
            borderRadius: '3px', 
            fontSize: '9px',
            backgroundColor: mission.satcom_enabled ? '#22c55e' : '#4b5563',
            color: '#fff'
          }}>
            {mission.satcom_enabled ? 'ENABLED' : 'DISABLED'}
          </span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// VEHICLES PANEL
// ============================================================================

const VehiclesPanel = ({ vehicles }: { vehicles: Vehicle[] }) => {
  if (!vehicles || vehicles.length === 0) {
    return <p style={{ color: '#6b7280', textAlign: 'center', padding: 20 }}>No vehicle data available</p>;
  }

  return (
    <div style={{ maxHeight: '100%', overflowY: 'auto' }}>
      {vehicles.map((vehicle) => (
        <div
          key={vehicle.vehicle_id}
          style={{
            padding: '12px',
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderRadius: '8px',
            marginBottom: '8px',
            borderLeft: `3px solid ${
              vehicle.is_lead ? '#3b82f6' :
              vehicle.is_tail ? '#f97316' :
              vehicle.is_command ? '#a855f7' : '#4b5563'
            }`
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#fff', fontSize: 12 }}>{vehicle.callsign}</span>
              {vehicle.is_lead && <span style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '8px', backgroundColor: '#3b82f6', color: '#fff' }}>LEAD</span>}
              {vehicle.is_tail && <span style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '8px', backgroundColor: '#f97316', color: '#fff' }}>TAIL</span>}
              {vehicle.is_command && <span style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '8px', backgroundColor: '#a855f7', color: '#fff' }}>CMD</span>}
            </div>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: getStatusColor(vehicle.health_status) }} />
          </div>
          
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', fontSize: '10px', marginBottom: '8px' }}>
            <div>
              <div style={{ color: '#6b7280' }}>Type</div>
              <div style={{ color: '#fff', fontWeight: 'bold' }}>{vehicle.vehicle_type}</div>
            </div>
            <div>
              <div style={{ color: '#6b7280' }}>Position</div>
              <div style={{ color: '#fff', fontWeight: 'bold' }}>#{vehicle.convoy_position}</div>
            </div>
            <div>
              <div style={{ color: '#6b7280' }}>Fuel</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ 
                  width: '30px', 
                  height: '5px', 
                  backgroundColor: '#374151', 
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${vehicle.fuel_level_pct || 0}%`,
                    height: '100%',
                    backgroundColor: (vehicle.fuel_level_pct || 0) > 50 ? '#22c55e' : (vehicle.fuel_level_pct || 0) > 25 ? '#eab308' : '#dc2626',
                    borderRadius: '3px'
                  }} />
                </div>
                <span style={{ color: '#fff', fontWeight: 'bold' }}>{vehicle.fuel_level_pct?.toFixed(0) || 0}%</span>
              </div>
            </div>
            <div>
              <div style={{ color: '#6b7280' }}>Health</div>
              <div style={{ color: getStatusColor(vehicle.health_status), fontWeight: 'bold', fontSize: '9px' }}>
                {vehicle.health_status}
              </div>
            </div>
          </div>
          
          {/* Crew */}
          <div style={{ display: 'flex', gap: '12px', fontSize: '9px', color: '#6b7280', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}>
            <span>Reg: {vehicle.registration}</span>
            <span>Driver: {vehicle.driver}</span>
            {vehicle.commander && <span>Cmdr: {vehicle.commander}</span>}
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// AI INSIGHTS PANEL (ENHANCED - REAL-TIME DYNAMIC)
// ============================================================================

interface FullAnalysis {
  overall_status: string;
  mission_success_probability: number;
  risk_assessment: string;
  predictions: {
    eta: string;
    eta_confidence: number;
    delay_risk_minutes: number;
  };
  fuel_analysis: {
    at_destination_pct: number;
    refuel_stops_needed: number;
    critical: boolean;
  };
  weather: {
    impact: string;
    delay_minutes: number;
  };
  threats: {
    level: string;
    mitigations: string[];
  };
  recommendations: Array<{
    id: string;
    category: string;
    priority: string;
    title: string;
    description: string;
    actions: string[];
    confidence: number;
    icon: string;
  }>;
  tactical_summary: string;
  immediate_actions: string[];
  meta: {
    generated_by: string;
    gpu_accelerated: boolean;
    analysis_duration_ms: number;
    generated_at: string;
  };
}

const AIInsightsPanel = ({ convoyId, forecast }: { convoyId: number; forecast: AIForecast | null }) => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [fullAnalysis, setFullAnalysis] = useState<FullAnalysis | null>(null);
  const [tacticalSummary, setTacticalSummary] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [aiStatus, setAiStatus] = useState<{available: boolean; engine: string}>({ available: false, engine: 'HEURISTICS' });
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [updateCount, setUpdateCount] = useState(0);
  const [hasError, setHasError] = useState(false);

  // Reset loading state when convoy changes
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    setPredictions([]);
    setFullAnalysis(null);
    setTacticalSummary('');
    setUpdateCount(0);
  }, [convoyId]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    
    const fetchPredictions = async () => {
      try {
        const res = await fetch(`${API_V1}/tracking/convoys/${convoyId}/predictions`, {
          signal: controller.signal
        });
        if (!isMounted) return;
        if (res.ok) {
          const data = await res.json();
          setPredictions(data.predictions || []);
          setFullAnalysis(data.full_analysis || null);
          setTacticalSummary(data.tactical_summary || '');
          setAiStatus({ 
            available: data.gpu_accelerated || false, 
            engine: data.ai_engine || 'HEURISTICS' 
          });
          setLastUpdate(new Date());
          setUpdateCount(c => c + 1);
          setHasError(false);
        } else {
          setHasError(true);
        }
      } catch (error: any) {
        if (error?.name !== 'AbortError' && isMounted) {
          console.error('Failed to fetch predictions:', error);
          setHasError(true);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    
    // Initial fetch
    fetchPredictions();
    
    // Real-time updates every 5 seconds
    const interval = setInterval(fetchPredictions, 5000);
    
    return () => {
      isMounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [convoyId]);

  if (isLoading) {
    return (
      <div style={{ padding: '30px', textAlign: 'center' }}>
        <Brain size={28} style={{ animation: 'spin 2s linear infinite' }} color="#a855f7" />
        <p style={{ color: '#9ca3af', marginTop: '10px', fontSize: 12 }}>AI analyzing convoy data...</p>
      </div>
    );
  }

  if (hasError && !fullAnalysis && predictions.length === 0) {
    return (
      <div style={{ padding: '30px', textAlign: 'center' }}>
        <AlertTriangle size={28} color="#f59e0b" />
        <p style={{ color: '#f59e0b', marginTop: '10px', fontSize: 12 }}>Unable to fetch AI analysis</p>
        <p style={{ color: '#6b7280', fontSize: 10, marginTop: 4 }}>Retrying in 5 seconds...</p>
      </div>
    );
  }

  const getRiskColor = (risk?: string) => {
    switch (risk?.toUpperCase()) {
      case 'LOW': case 'OPTIMAL': case 'GOOD': return '#22c55e';
      case 'MEDIUM': case 'LOW-MEDIUM': case 'CAUTION': return '#eab308';
      case 'HIGH': case 'MEDIUM-HIGH': case 'WARNING': return '#f97316';
      case 'CRITICAL': return '#dc2626';
      default: return '#3b82f6';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority?.toUpperCase()) {
      case 'HIGH': return '🚨';
      case 'MEDIUM': return '⚠️';
      case 'LOW': return '✅';
      default: return '📋';
    }
  };

  const formatETA = (isoDate: string) => {
    try {
      return new Date(isoDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '12px' }}>
      {/* AI Status Banner with real-time indicator */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        marginBottom: '12px',
        padding: '10px',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        borderRadius: '8px',
        border: '1px solid rgba(168, 85, 247, 0.2)'
      }}>
        <Cpu size={16} color="#a855f7" />
        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#a855f7' }}>{aiStatus.engine}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          <div style={{ 
            width: 6, height: 6, borderRadius: '50%', 
            backgroundColor: '#22c55e', 
            animation: 'pulse 2s infinite' 
          }} />
          <span style={{ fontSize: '9px', color: '#9ca3af' }}>LIVE</span>
        </div>
        <span style={{ 
          fontSize: '9px', 
          padding: '2px 8px', 
          backgroundColor: aiStatus.available ? '#22c55e' : '#f97316',
          borderRadius: '3px',
          color: '#fff',
          fontWeight: 600
        }}>
          {aiStatus.available ? 'GPU' : 'CPU'}
        </span>
      </div>

      {/* Tactical Summary - The main AI insight */}
      {tacticalSummary && (
        <div style={{
          padding: '12px',
          marginBottom: '12px',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderLeft: `4px solid ${getRiskColor(fullAnalysis?.risk_assessment)}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Brain size={14} color="#3b82f6" />
            <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#3b82f6', textTransform: 'uppercase' }}>
              AI Tactical Assessment
            </span>
          </div>
          <p style={{ 
            fontSize: '12px', 
            color: '#e5e7eb', 
            lineHeight: 1.5, 
            margin: 0,
            fontStyle: 'italic'
          }}>
            {tacticalSummary}
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 9, color: '#6b7280' }}>
            <span>Updated: {lastUpdate.toLocaleTimeString()}</span>
            <span>Analysis #{updateCount}</span>
          </div>
        </div>
      )}

      {/* Mission Status Dashboard */}
      {fullAnalysis && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ 
            fontSize: '10px', 
            fontWeight: 'bold', 
            color: '#6b7280', 
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            REAL-TIME ANALYSIS
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {/* Mission Success */}
            <div style={{
              padding: 12,
              backgroundColor: `${getRiskColor(fullAnalysis.risk_assessment)}15`,
              borderRadius: 8,
              border: `1px solid ${getRiskColor(fullAnalysis.risk_assessment)}30`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Target size={14} color={getRiskColor(fullAnalysis.risk_assessment)} />
                <span style={{ fontSize: 10, color: '#9ca3af' }}>Mission</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: getRiskColor(fullAnalysis.risk_assessment) }}>
                {(fullAnalysis.mission_success_probability * 100).toFixed(0)}%
              </div>
              <div style={{ fontSize: 10, color: '#6b7280' }}>
                {fullAnalysis.overall_status}
              </div>
            </div>

            {/* ETA */}
            <div style={{
              padding: 12,
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              borderRadius: 8,
              border: '1px solid rgba(34, 197, 94, 0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Timer size={14} color="#22c55e" />
                <span style={{ fontSize: 10, color: '#9ca3af' }}>ETA</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>
                {formatETA(fullAnalysis.predictions.eta)}
              </div>
              {fullAnalysis.predictions.delay_risk_minutes > 0 && (
                <div style={{ fontSize: 10, color: '#f59e0b' }}>
                  +{fullAnalysis.predictions.delay_risk_minutes}min risk
                </div>
              )}
            </div>

            {/* Fuel */}
            <div style={{
              padding: 12,
              backgroundColor: fullAnalysis.fuel_analysis.critical ? 'rgba(220, 38, 38, 0.15)' : 'rgba(234, 179, 8, 0.1)',
              borderRadius: 8,
              border: `1px solid ${fullAnalysis.fuel_analysis.critical ? 'rgba(220, 38, 38, 0.3)' : 'rgba(234, 179, 8, 0.2)'}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Fuel size={14} color={fullAnalysis.fuel_analysis.critical ? '#dc2626' : '#eab308'} />
                <span style={{ fontSize: 10, color: '#9ca3af' }}>Fuel@Dest</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: fullAnalysis.fuel_analysis.critical ? '#dc2626' : '#fff' }}>
                {fullAnalysis.fuel_analysis.at_destination_pct.toFixed(0)}%
              </div>
              <div style={{ fontSize: 10, color: '#6b7280' }}>
                {fullAnalysis.fuel_analysis.refuel_stops_needed} stop{fullAnalysis.fuel_analysis.refuel_stops_needed !== 1 ? 's' : ''} needed
              </div>
            </div>

            {/* Weather */}
            <div style={{
              padding: 12,
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderRadius: 8,
              border: '1px solid rgba(59, 130, 246, 0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Cloud size={14} color="#3b82f6" />
                <span style={{ fontSize: 10, color: '#9ca3af' }}>Weather</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                {fullAnalysis.weather.impact}
              </div>
              {fullAnalysis.weather.delay_minutes > 0 && (
                <div style={{ fontSize: 10, color: '#6b7280' }}>
                  +{fullAnalysis.weather.delay_minutes}min delay
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Immediate Actions */}
      {fullAnalysis?.immediate_actions && fullAnalysis.immediate_actions.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ 
            fontSize: '10px', 
            fontWeight: 'bold', 
            color: '#f59e0b', 
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <Zap size={12} color="#f59e0b" />
            IMMEDIATE ACTIONS
          </div>
          <div style={{ 
            padding: 10, 
            backgroundColor: 'rgba(245, 158, 11, 0.1)', 
            borderRadius: 8,
            border: '1px solid rgba(245, 158, 11, 0.2)'
          }}>
            {fullAnalysis.immediate_actions.map((action, i) => (
              <div key={i} style={{ 
                display: 'flex', 
                alignItems: 'flex-start', 
                gap: 8, 
                fontSize: 11, 
                color: '#e5e7eb', 
                marginBottom: i < fullAnalysis.immediate_actions.length - 1 ? 6 : 0 
              }}>
                <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>{i + 1}.</span>
                <span>{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Recommendations */}
      <div style={{ 
        fontSize: '10px', 
        fontWeight: 'bold', 
        color: '#6b7280', 
        marginBottom: '8px',
        textTransform: 'uppercase',
        letterSpacing: '1px'
      }}>
        AI RECOMMENDATIONS ({fullAnalysis?.recommendations?.length || predictions.length})
      </div>

      {(fullAnalysis?.recommendations || []).length === 0 && predictions.length === 0 ? (
        <div style={{ 
          padding: '30px', 
          textAlign: 'center',
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderRadius: 8
        }}>
          <Brain size={28} color="#6b7280" />
          <p style={{ color: '#6b7280', marginTop: '10px', fontSize: 12 }}>No AI predictions available</p>
          <p style={{ color: '#4b5563', fontSize: 10, marginTop: 4 }}>Start tracking to generate insights</p>
        </div>
      ) : (
        (fullAnalysis?.recommendations || []).map((rec) => (
          <div
            key={rec.id}
            style={{
              padding: '12px',
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderRadius: '8px',
              marginBottom: '8px',
              borderLeft: `3px solid ${getRiskColor(rec.priority)}`
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>{rec.icon || getPriorityIcon(rec.priority)}</span>
                <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '12px' }}>{rec.title}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ 
                  padding: '2px 6px', 
                  borderRadius: '3px', 
                  fontSize: '9px',
                  backgroundColor: getRiskColor(rec.priority),
                  color: '#fff',
                  fontWeight: 'bold'
                }}>
                  {rec.priority}
                </span>
                <span style={{ 
                  padding: '2px 6px', 
                  borderRadius: '3px', 
                  fontSize: '9px',
                  backgroundColor: 'rgba(59, 130, 246, 0.3)',
                  color: '#93c5fd',
                  fontWeight: 'bold'
                }}>
                  {rec.category}
                </span>
              </div>
            </div>
            
            <p style={{ color: '#9ca3af', fontSize: '11px', marginBottom: '10px', lineHeight: 1.4 }}>{rec.description}</p>
            
            {rec.actions && rec.actions.length > 0 && (
              <div>
                <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase' }}>
                  ACTION ITEMS:
                </div>
                {rec.actions.slice(0, 4).map((action, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#9ca3af', marginBottom: '4px' }}>
                    <CheckCircle size={10} color="#22c55e" />
                    <span>{action}</span>
                  </div>
                ))}
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '9px', color: '#4b5563' }}>
              <span>Confidence: {(rec.confidence * 100).toFixed(0)}%</span>
              <span>{new Date(rec.generated_at).toLocaleTimeString()}</span>
            </div>
          </div>
        ))
      )}

      {/* Threat Mitigations */}
      {fullAnalysis?.threats?.mitigations && fullAnalysis.threats.mitigations.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ 
            fontSize: '10px', 
            fontWeight: 'bold', 
            color: getRiskColor(fullAnalysis.threats.level), 
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <Shield size={12} color={getRiskColor(fullAnalysis.threats.level)} />
            THREAT MITIGATIONS ({fullAnalysis.threats.level})
          </div>
          <div style={{ 
            padding: 10, 
            backgroundColor: `${getRiskColor(fullAnalysis.threats.level)}10`, 
            borderRadius: 8,
            border: `1px solid ${getRiskColor(fullAnalysis.threats.level)}30`
          }}>
            {fullAnalysis.threats.mitigations.map((mitigation, i) => (
              <div key={i} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8, 
                fontSize: 10, 
                color: '#e5e7eb', 
                marginBottom: i < fullAnalysis.threats.mitigations.length - 1 ? 4 : 0 
              }}>
                <Shield size={10} color={getRiskColor(fullAnalysis.threats.level)} />
                <span>{mitigation}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analysis Meta */}
      {fullAnalysis?.meta && (
        <div style={{ 
          marginTop: 16, 
          padding: 8, 
          backgroundColor: 'rgba(0,0,0,0.3)', 
          borderRadius: 6,
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 9,
          color: '#6b7280'
        }}>
          <span>{fullAnalysis.meta.generated_by}</span>
          <span>{fullAnalysis.meta.analysis_duration_ms}ms</span>
          <span>{fullAnalysis.meta.gpu_accelerated ? '🟢 GPU' : '🟠 CPU'}</span>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// CONVOY DETAIL PANEL
// ============================================================================

interface ConvoyDetailProps {
  convoy: ConvoyDetail | null;
  isLoading: boolean;
  onRefresh: () => void;
  forecast: AIForecast | null;
}

const ConvoyDetailPanel = ({ convoy, isLoading, onRefresh, forecast }: ConvoyDetailProps) => {
  const [activeTab, setActiveTab] = useState<'mission' | 'vehicles' | 'ai'>('ai');

  if (isLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite' }} color="#3b82f6" />
        <p style={{ color: '#9ca3af', marginTop: '10px', fontSize: 12 }}>Loading convoy details...</p>
      </div>
    );
  }

  if (!convoy) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Crosshair size={48} color="#4b5563" />
        <h3 style={{ color: '#6b7280', marginTop: '16px', fontSize: 16 }}>Select a Convoy</h3>
        <p style={{ color: '#4b5563', marginTop: '8px', fontSize: 12 }}>Choose a convoy from the list to view tracking details</p>
      </div>
    );
  }

  const mission = convoy.mission || {};
  const priorityColors = getPriorityColor(mission.mission_priority || 'ROUTINE');
  const classColors = getClassificationColor(mission.security_classification || 'RESTRICTED');

  const tabStyle = (isActive: boolean) => ({
    padding: '8px 16px',
    cursor: 'pointer',
    backgroundColor: isActive ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
    border: 'none',
    borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
    color: isActive ? '#3b82f6' : '#6b7280',
    fontSize: '11px',
    fontWeight: 'bold' as const,
    transition: 'all 0.2s'
  });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '20px', fontFamily: 'monospace', fontWeight: 'bold', color: '#fff', margin: 0 }}>
                {mission.callsign || convoy.mission?.callsign || `CONVOY-${convoy.convoy_id}`}
              </h2>
              <div style={{ 
                width: '10px', 
                height: '10px', 
                borderRadius: '50%', 
                backgroundColor: getStatusColor(convoy.tracking_status),
                boxShadow: `0 0 8px ${getStatusColor(convoy.tracking_status)}`
              }} />
            </div>
            <p style={{ color: '#6b7280', fontSize: '11px', margin: '4px 0 0 0' }}>{mission.mission_id || '--'}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '9px',
              fontWeight: 'bold',
              backgroundColor: classColors.bg,
              color: classColors.text
            }}>
              {(mission.security_classification || 'RESTRICTED').replace('_', ' ')}
            </span>
            <button
              onClick={onRefresh}
              style={{
                padding: '8px',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <RefreshCw size={14} color="#3b82f6" />
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {[
            { label: 'Formation', value: mission.formation || mission.formation_name || '9 CORPS', icon: Target },
            { label: 'Vehicles', value: convoy.vehicles?.length || 0, icon: Truck },
            { label: 'Personnel', value: mission.personnel_count || 0, icon: Users }
          ].map((stat, i) => (
            <div key={i} style={{
              padding: '10px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <stat.icon size={10} color="#6b7280" />
                <span style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase' }}>{stat.label}</span>
              </div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>{stat.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <button style={tabStyle(activeTab === 'mission')} onClick={() => setActiveTab('mission')}>
          Mission Details
        </button>
        <button style={tabStyle(activeTab === 'vehicles')} onClick={() => setActiveTab('vehicles')}>
          Vehicles ({convoy.vehicles?.length || 0})
        </button>
        <button style={tabStyle(activeTab === 'ai')} onClick={() => setActiveTab('ai')}>
          AI Insights
        </button>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'mission' && <MissionPanel mission={mission} />}
        {activeTab === 'vehicles' && <VehiclesPanel vehicles={convoy.vehicles} />}
        {activeTab === 'ai' && <AIInsightsPanel convoyId={convoy.convoy_id} forecast={forecast} />}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ConvoyTrackingPanelEnhanced() {
  const [convoys, setConvoys] = useState<ConvoySummary[]>([]);
  const [selectedConvoyId, setSelectedConvoyId] = useState<number | null>(null);
  const [convoyDetail, setConvoyDetail] = useState<ConvoyDetail | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [forecast, setForecast] = useState<AIForecast | null>(null);

  // Fetch convoy list
  const fetchConvoys = useCallback(async () => {
    try {
      const res = await fetch(`${API_V1}/tracking/convoys`);
      if (res.ok) {
        const data = await res.json();
        setConvoys(data.convoys || []);
      }
    } catch (error) {
      console.error('Failed to fetch convoys:', error);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  // Fetch convoy detail
  const fetchConvoyDetail = useCallback(async (convoyId: number) => {
    setIsLoadingDetail(true);
    try {
      const res = await fetch(`${API_V1}/tracking/convoys/${convoyId}`);
      if (res.ok) {
        const data = await res.json();
        setConvoyDetail(data);
      }
    } catch (error) {
      console.error('Failed to fetch convoy detail:', error);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  // Generate AI forecast
  const generateForecast = useCallback(async () => {
    // Simulate AI forecast generation
    const weatherConditions = ['Clear', 'Partly Cloudy', 'Overcast', 'Light Rain', 'Fog'];
    const threatLevels = ['GREEN', 'YELLOW', 'ORANGE'];
    
    setForecast({
      weather: {
        condition: weatherConditions[Math.floor(Math.random() * weatherConditions.length)],
        temperature: Math.round(5 + Math.random() * 20),
        visibility_km: Math.round(5 + Math.random() * 15),
        wind_speed_kmh: Math.round(10 + Math.random() * 30),
        impact: ['LOW', 'MEDIUM', 'HIGH'][Math.floor(Math.random() * 3)] as any
      },
      threat: {
        level: threatLevels[Math.floor(Math.random() * threatLevels.length)],
        active_count: Math.floor(Math.random() * 4),
        areas: ['Sector Alpha', 'Route Charlie']
      },
      eta: {
        predicted_minutes: 180 + Math.floor(Math.random() * 120),
        delay_minutes: Math.floor(Math.random() * 30),
        confidence: 0.85 + Math.random() * 0.1
      },
      fuel: {
        current_avg: 60 + Math.random() * 35,
        predicted_consumption: 20 + Math.random() * 15,
        stops_required: Math.floor(Math.random() * 3)
      }
    });
  }, []);

  useEffect(() => {
    if (isPanelOpen) {
      fetchConvoys();
      generateForecast();
      const interval = setInterval(() => {
        fetchConvoys();
        generateForecast();
      }, 30000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPanelOpen]);

  // Real-time convoy detail updates - refresh every 5 seconds when convoy is selected
  useEffect(() => {
    if (selectedConvoyId && isPanelOpen) {
      fetchConvoyDetail(selectedConvoyId);
      const interval = setInterval(() => {
        fetchConvoyDetail(selectedConvoyId);
      }, 5000); // Real-time refresh every 5 seconds
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConvoyId, isPanelOpen]);

  // FAB button when panel is closed
  if (!isPanelOpen) {
    return (
      <button
        onClick={() => setIsPanelOpen(true)}
        style={{
          position: 'fixed',
          left: 16,
          bottom: 100,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 20px',
          background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
          color: '#fff',
          border: 'none',
          borderRadius: 25,
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(59, 130, 246, 0.4)',
          fontWeight: 600,
          fontSize: 14,
          transition: 'transform 0.2s, box-shadow 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 6px 30px rgba(59, 130, 246, 0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(59, 130, 246, 0.4)';
        }}
      >
        <Truck size={18} />
        <span>Convoy Tracking</span>
        {convoys.length > 0 && (
          <span style={{
            padding: '2px 8px',
            borderRadius: 10,
            fontSize: 11,
            backgroundColor: 'rgba(255,255,255,0.2)'
          }}>
            {convoys.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <ResizablePanel
      title="CONVOY TRACKING"
      icon={<Truck size={18} color="#fff" />}
      initialWidth={700}
      initialHeight={600}
      minWidth={500}
      minHeight={400}
      maxWidth={1000}
      maxHeight={900}
      position="bottom-left"
      headerGradient="linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)"
      onClose={() => setIsPanelOpen(false)}
      zIndex={1000}
      draggable={true}
      statusBadge={
        <span style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 10,
          fontSize: 10,
          fontWeight: 600,
          backgroundColor: 'rgba(34, 197, 94, 0.3)',
          color: '#22c55e'
        }}>
          {convoys.length} active
        </span>
      }
    >
      <div style={{
        display: 'flex',
        height: '100%',
        backgroundColor: '#0a0f1a'
      }}>
        {/* Convoy List */}
        <div style={{
          width: isPanelCollapsed ? '50px' : '220px',
          borderRight: '1px solid rgba(255,255,255,0.1)',
          transition: 'width 0.3s',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isPanelCollapsed ? 'center' : 'space-between',
            padding: '10px',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}>
            {!isPanelCollapsed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Route size={14} color="#3b82f6" />
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>Convoys</span>
              </div>
            )}
            <button
              onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
              style={{
                padding: '4px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {isPanelCollapsed ? <ChevronRight size={14} color="#6b7280" /> : <ChevronLeft size={14} color="#6b7280" />}
            </button>
          </div>
          
          {!isPanelCollapsed && (
            <ConvoyListPanel
              convoys={convoys}
              selectedConvoyId={selectedConvoyId}
              onSelectConvoy={setSelectedConvoyId}
              isLoading={isLoadingList}
            />
          )}
        </div>

        {/* Convoy Detail */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <ConvoyDetailPanel
            convoy={convoyDetail}
            isLoading={isLoadingDetail}
            onRefresh={() => selectedConvoyId && fetchConvoyDetail(selectedConvoyId)}
            forecast={forecast}
          />
        </div>
      </div>
    </ResizablePanel>
  );
}
