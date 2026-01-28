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
  Crosshair
} from 'lucide-react';

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
        <p style={{ color: '#9ca3af', marginTop: '10px' }}>Loading convoys...</p>
      </div>
    );
  }

  return (
    <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
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
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => !isSelected && (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)')}
            onMouseLeave={(e) => !isSelected && (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            {/* Header Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: getStatusColor(convoy.status) }} />
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '14px', color: '#fff' }}>
                  {convoy.callsign}
                </span>
              </div>
              <span style={{
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 'bold',
                backgroundColor: priorityColors.bg,
                color: priorityColors.text
              }}>
                {convoy.priority}
              </span>
            </div>
            
            {/* Second Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>{convoy.unit}</span>
              <span style={{
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '9px',
                fontWeight: 'bold',
                backgroundColor: classColors.bg,
                color: classColors.text
              }}>
                {convoy.classification.replace('_', ' ')}
              </span>
            </div>
            
            {/* Stats Row */}
            <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#6b7280' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {getCargoIcon(convoy.cargo_type)} {convoy.cargo_type}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Truck size={12} /> {convoy.vehicle_count}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Users size={12} /> {convoy.personnel_count}
              </span>
              {convoy.armed_escort && (
                <span style={{ color: '#dc2626' }}>
                  <Shield size={12} />
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
    return <p style={{ color: '#6b7280' }}>Mission data not available</p>;
  }

  const sectionStyle = {
    padding: '12px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: '8px',
    marginBottom: '12px'
  };

  const headingStyle = {
    fontSize: '12px',
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
    fontSize: '12px'
  };

  return (
    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
      {/* Unit Information */}
      <div style={sectionStyle}>
        <div style={headingStyle}>Unit Information</div>
        <div style={gridStyle}>
          <span style={{ color: '#6b7280' }}>Unit:</span>
          <span style={{ color: '#fff', fontWeight: 'bold' }}>{mission.unit_name}</span>
          <span style={{ color: '#6b7280' }}>Formation:</span>
          <span style={{ color: '#fff' }}>{mission.formation_name}</span>
          <span style={{ color: '#6b7280' }}>Command:</span>
          <span style={{ color: '#fff' }}>{mission.command}</span>
          <span style={{ color: '#6b7280' }}>HQ:</span>
          <span style={{ color: '#fff' }}>{mission.hq_location}</span>
        </div>
      </div>

      {/* Personnel */}
      <div style={sectionStyle}>
        <div style={headingStyle}>Personnel Strength</div>
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
          {[
            { label: 'Officers', value: mission.officer_count },
            { label: 'JCOs', value: mission.jco_count },
            { label: 'ORs', value: mission.or_count },
            { label: 'Total', value: mission.personnel_count, highlight: true }
          ].map((item, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: item.highlight ? '#3b82f6' : '#fff' }}>
                {item.value}
              </div>
              <div style={{ fontSize: '10px', color: '#6b7280' }}>{item.label}</div>
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
          <span style={{ color: '#fff' }}>{mission.cargo_weight_tons?.toFixed(1)} tons</span>
          <span style={{ color: '#6b7280' }}>Description:</span>
          <span style={{ color: '#fff', fontSize: '11px' }}>{mission.cargo_description}</span>
        </div>
      </div>

      {/* Communications */}
      <div style={sectionStyle}>
        <div style={headingStyle}>Communications</div>
        <div style={gridStyle}>
          <span style={{ color: '#6b7280' }}>Callsign:</span>
          <span style={{ color: '#22c55e', fontFamily: 'monospace', fontWeight: 'bold' }}>{mission.callsign}</span>
          <span style={{ color: '#6b7280' }}>Primary:</span>
          <span style={{ color: '#fff', fontFamily: 'monospace' }}>{mission.primary_freq}</span>
          <span style={{ color: '#6b7280' }}>Alternate:</span>
          <span style={{ color: '#fff', fontFamily: 'monospace' }}>{mission.alternate_freq}</span>
          <span style={{ color: '#6b7280' }}>SATCOM:</span>
          <span style={{ 
            padding: '2px 6px', 
            borderRadius: '3px', 
            fontSize: '10px',
            backgroundColor: mission.satcom_enabled ? '#22c55e' : '#4b5563',
            color: '#fff'
          }}>
            {mission.satcom_enabled ? 'ENABLED' : 'DISABLED'}
          </span>
        </div>
      </div>

      {/* Authorization */}
      <div style={sectionStyle}>
        <div style={headingStyle}>Authorization</div>
        <div style={gridStyle}>
          <span style={{ color: '#6b7280' }}>Authorized By:</span>
          <span style={{ color: '#fff' }}>{mission.authorized_by} ({mission.authorized_rank})</span>
          <span style={{ color: '#6b7280' }}>Mission Type:</span>
          <span style={{ color: '#fff' }}>{mission.mission_type}</span>
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
    return <p style={{ color: '#6b7280' }}>No vehicle data available</p>;
  }

  return (
    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
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
              <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#fff' }}>{vehicle.callsign}</span>
              {vehicle.is_lead && <span style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '9px', backgroundColor: '#3b82f6', color: '#fff' }}>LEAD</span>}
              {vehicle.is_tail && <span style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '9px', backgroundColor: '#f97316', color: '#fff' }}>TAIL</span>}
              {vehicle.is_command && <span style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '9px', backgroundColor: '#a855f7', color: '#fff' }}>CMD</span>}
            </div>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: getStatusColor(vehicle.health_status) }} />
          </div>
          
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', fontSize: '11px', marginBottom: '8px' }}>
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
                  width: '40px', 
                  height: '6px', 
                  backgroundColor: '#374151', 
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${vehicle.fuel_level_pct}%`,
                    height: '100%',
                    backgroundColor: vehicle.fuel_level_pct > 50 ? '#22c55e' : vehicle.fuel_level_pct > 25 ? '#eab308' : '#dc2626',
                    borderRadius: '3px'
                  }} />
                </div>
                <span style={{ color: '#fff', fontWeight: 'bold' }}>{vehicle.fuel_level_pct?.toFixed(0)}%</span>
              </div>
            </div>
            <div>
              <div style={{ color: '#6b7280' }}>Health</div>
              <div style={{ color: getStatusColor(vehicle.health_status), fontWeight: 'bold', fontSize: '10px' }}>
                {vehicle.health_status}
              </div>
            </div>
          </div>
          
          {/* Crew */}
          <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#6b7280', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}>
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
// AI INSIGHTS PANEL
// ============================================================================

const AIInsightsPanel = ({ convoyId }: { convoyId: number }) => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        const res = await fetch(`${API_V1}/tracking/convoys/${convoyId}/predictions`);
        if (res.ok) {
          const data = await res.json();
          setPredictions(data.predictions || []);
        }
      } catch (error) {
        console.error('Failed to fetch predictions:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPredictions();
  }, [convoyId]);

  if (isLoading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <Brain size={24} style={{ animation: 'spin 2s linear infinite' }} color="#a855f7" />
        <p style={{ color: '#9ca3af', marginTop: '10px' }}>AI analyzing convoy data...</p>
      </div>
    );
  }

  if (predictions.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <Brain size={32} color="#6b7280" />
        <p style={{ color: '#6b7280', marginTop: '10px' }}>No AI predictions available</p>
      </div>
    );
  }

  const getRiskColor = (risk?: string) => {
    switch (risk) {
      case 'LOW': return '#22c55e';
      case 'MEDIUM': return '#eab308';
      case 'HIGH': return '#dc2626';
      default: return '#3b82f6';
    }
  };

  return (
    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        marginBottom: '12px',
        padding: '8px',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        borderRadius: '6px'
      }}>
        <Brain size={16} color="#a855f7" />
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#a855f7' }}>JANUS PRO 7B Analysis</span>
        <span style={{ 
          marginLeft: 'auto', 
          fontSize: '9px', 
          padding: '2px 6px', 
          backgroundColor: '#22c55e',
          borderRadius: '3px',
          color: '#fff'
        }}>GPU ACCELERATED</span>
      </div>

      {predictions.map((pred) => (
        <div
          key={pred.prediction_id}
          style={{
            padding: '12px',
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderRadius: '8px',
            marginBottom: '8px',
            borderLeft: `3px solid ${getRiskColor(pred.risk_level)}`
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '13px' }}>{pred.title}</span>
            {pred.probability && (
              <span style={{ 
                padding: '2px 8px', 
                borderRadius: '4px', 
                fontSize: '11px',
                backgroundColor: '#22c55e',
                color: '#fff',
                fontWeight: 'bold'
              }}>
                {(pred.probability * 100).toFixed(0)}%
              </span>
            )}
          </div>
          
          <p style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '10px' }}>{pred.summary}</p>
          
          {pred.recommendations && pred.recommendations.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#6b7280', marginBottom: '6px' }}>RECOMMENDATIONS:</div>
              {pred.recommendations.map((rec, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>
                  <CheckCircle size={12} color="#22c55e" />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '10px', color: '#4b5563' }}>
            <span>{pred.generated_by}</span>
            <span>{new Date(pred.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
      ))}
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
}

const ConvoyDetailPanel = ({ convoy, isLoading, onRefresh }: ConvoyDetailProps) => {
  const [activeTab, setActiveTab] = useState<'mission' | 'vehicles' | 'ai'>('mission');

  if (isLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite' }} color="#3b82f6" />
        <p style={{ color: '#9ca3af', marginTop: '10px' }}>Loading convoy details...</p>
      </div>
    );
  }

  if (!convoy) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Crosshair size={48} color="#4b5563" />
        <h3 style={{ color: '#6b7280', marginTop: '16px' }}>Select a Convoy</h3>
        <p style={{ color: '#4b5563', marginTop: '8px' }}>Choose a convoy from the list to view tracking details</p>
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
    fontSize: '12px',
    fontWeight: 'bold' as const,
    transition: 'all 0.2s'
  });

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '24px', fontFamily: 'monospace', fontWeight: 'bold', color: '#fff', margin: 0 }}>
              {mission.callsign}
            </h2>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: getStatusColor(convoy.tracking_status) }} />
          </div>
          <p style={{ color: '#6b7280', fontSize: '12px', margin: '4px 0 0 0' }}>{mission.mission_id}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            padding: '4px 10px',
            borderRadius: '4px',
            fontSize: '10px',
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
        {[
          { label: 'Formation', value: mission.formation || '-', icon: Target },
          { label: 'Vehicles', value: convoy.vehicles?.length || 0, icon: Truck },
          { label: 'Personnel', value: mission.personnel_count || 0, icon: Users },
          { label: 'Priority', value: mission.mission_priority || '-', icon: AlertTriangle, color: priorityColors.bg }
        ].map((stat, i) => (
          <div key={i} style={{
            padding: '12px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <stat.icon size={12} color="#6b7280" />
              <span style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase' }}>{stat.label}</span>
            </div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: stat.color || '#fff' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '16px' }}>
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
      {activeTab === 'mission' && <MissionPanel mission={mission} />}
      {activeTab === 'vehicles' && <VehiclesPanel vehicles={convoy.vehicles} />}
      {activeTab === 'ai' && <AIInsightsPanel convoyId={convoy.convoy_id} />}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ConvoyTrackingPanel() {
  const [convoys, setConvoys] = useState<ConvoySummary[]>([]);
  const [selectedConvoyId, setSelectedConvoyId] = useState<number | null>(null);
  const [convoyDetail, setConvoyDetail] = useState<ConvoyDetail | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

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

  useEffect(() => {
    fetchConvoys();
    const interval = setInterval(fetchConvoys, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedConvoyId) {
      fetchConvoyDetail(selectedConvoyId);
    }
  }, [selectedConvoyId, fetchConvoyDetail]);

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      backgroundColor: '#0a0f1a',
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.1)'
    }}>
      {/* Convoy List */}
      <div style={{
        width: isPanelCollapsed ? '50px' : '300px',
        borderRight: '1px solid rgba(255,255,255,0.1)',
        transition: 'width 0.3s',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isPanelCollapsed ? 'center' : 'space-between',
          padding: '12px',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          {!isPanelCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Truck size={16} color="#3b82f6" />
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>Convoy Tracking</span>
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
            {isPanelCollapsed ? <ChevronRight size={16} color="#6b7280" /> : <ChevronLeft size={16} color="#6b7280" />}
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
        />
      </div>
    </div>
  );
}
