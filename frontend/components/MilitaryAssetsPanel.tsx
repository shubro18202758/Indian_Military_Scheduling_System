'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Shield,
  Fuel,
  Hospital,
  Radio,
  Eye,
  Plane,
  AlertTriangle,
  MapPin,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Search,
  Filter,
  Brain,
  Activity,
  Users,
  Truck,
  Package,
  Crosshair,
  Lock,
  Unlock,
  Target,
  Zap,
  Clock,
  TrendingUp,
  CheckCircle,
  XCircle,
  Info,
  BarChart3,
  Cpu,
  Satellite,
  Construction,
  Warehouse
} from 'lucide-react';
import ResizablePanel from './ResizablePanel';

const API_V1 = '/api/proxy/v1';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface MilitaryAsset {
  id: number;
  asset_id: string;
  name: string;
  callsign?: string;
  code_name?: string;
  classification: string;
  category: string;
  asset_type: string;
  latitude: number;
  longitude: number;
  altitude_meters?: number;
  grid_reference?: string;
  location_description?: string;
  parent_unit_id?: string;
  parent_unit_name?: string;
  commanding_officer?: string;
  contact_frequency?: string;
  status: string;
  threat_level: string;
  personnel_capacity: number;
  current_personnel: number;
  vehicle_capacity: number;
  current_vehicles: number;
  fuel_availability: number;
  ammo_availability: number;
  rations_availability: number;
  water_availability: number;
  medical_supplies: number;
  perimeter_security: string;
  guard_force_size: number;
  has_helipad: boolean;
  has_medical: boolean;
  has_communications: boolean;
  has_power_backup: boolean;
  has_ammunition_storage: boolean;
  has_fuel_storage: boolean;
  ai_threat_score: number;
  ai_risk_factors: string[];
  ai_recommendations: string[];
  ai_last_analysis?: string;
  created_at: string;
  updated_at: string;
}

interface AssetPrediction {
  prediction_id: string;
  asset_id: string;
  prediction_type: string;
  title: string;
  summary: string;
  confidence: number;
  probability?: number;
  risk_level: string;
  recommendations: string[];
  action_required: boolean;
  priority: string;
  generated_by: string;
  valid_from: string;
  valid_until?: string;
}

interface AssetsSummary {
  total_assets: number;
  by_category: Record<string, number>;
  by_status: Record<string, number>;
  by_threat_level: Record<string, number>;
  by_classification: Record<string, number>;
  high_threat_count: number;
  low_resources_count: number;
  avg_threat_score: number;
  total_personnel: number;
  total_vehicles: number;
}

// ============================================================================
// CONSTANTS & HELPERS
// ============================================================================

const CATEGORY_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  COMMAND_CONTROL: { icon: Building2, color: '#a855f7', label: 'Command & Control' },
  LOGISTICS_SUPPLY: { icon: Package, color: '#f59e0b', label: 'Logistics & Supply' },
  COMBAT_SUPPORT: { icon: Shield, color: '#ef4444', label: 'Combat Support' },
  MEDICAL: { icon: Hospital, color: '#22c55e', label: 'Medical' },
  COMMUNICATIONS: { icon: Radio, color: '#3b82f6', label: 'Communications' },
  INTELLIGENCE: { icon: Eye, color: '#6366f1', label: 'Intelligence' },
  ENGINEERING: { icon: Construction, color: '#78716c', label: 'Engineering' },
  AVIATION: { icon: Plane, color: '#06b6d4', label: 'Aviation' },
  SECURITY: { icon: Target, color: '#dc2626', label: 'Security' },
  INFRASTRUCTURE: { icon: Warehouse, color: '#64748b', label: 'Infrastructure' }
};

const ASSET_TYPE_ICONS: Record<string, string> = {
  HEADQUARTERS: '🏛️',
  COMMAND_POST: '🎖️',
  TACTICAL_OPS_CENTER: '📊',
  FORWARD_OPERATING_BASE: '🏰',
  BASE_CAMP: '🏕️',
  PATROL_BASE: '🛡️',
  TRANSIT_CAMP: '⛺',
  STAGING_AREA: '📍',
  TRAFFIC_CONTROL_POINT: '🚧',
  VEHICLE_CHECKPOINT: '🚔',
  ENTRY_CONTROL_POINT: '🚪',
  OBSERVATION_POST: '👁️',
  LISTENING_POST: '👂',
  AMMUNITION_DEPOT: '💣',
  FUEL_POINT: '⛽',
  SUPPLY_DEPOT: '📦',
  RATION_POINT: '🍞',
  VEHICLE_PARK: '🚛',
  MAINTENANCE_BAY: '🔧',
  FIELD_HOSPITAL: '🏥',
  AID_STATION: '🩺',
  MEDICAL_SUPPLY_POINT: '💊',
  CASUALTY_COLLECTION_POINT: '🚑',
  SIGNAL_CENTER: '📡',
  RELAY_STATION: '📻',
  SATELLITE_GROUND_STATION: '🛰️',
  RADIO_TOWER: '📶',
  HELIPAD: '🚁',
  FORWARD_ARMING_REFUEL_POINT: '⚡',
  AIRFIELD: '✈️',
  WATER_POINT: '💧',
  POWER_GENERATOR: '🔌',
  BRIDGE: '🌉',
  TUNNEL: '🚇'
};

const getClassificationColor = (classification: string) => {
  switch (classification) {
    case 'TOP_SECRET': return { bg: '#dc2626', text: '#fff', border: '#ef4444' };
    case 'SECRET': return { bg: '#f97316', text: '#fff', border: '#fb923c' };
    case 'CONFIDENTIAL': return { bg: '#3b82f6', text: '#fff', border: '#60a5fa' };
    case 'RESTRICTED': return { bg: '#eab308', text: '#000', border: '#facc15' };
    case 'UNCLASSIFIED': return { bg: '#22c55e', text: '#fff', border: '#4ade80' };
    default: return { bg: '#6b7280', text: '#fff', border: '#9ca3af' };
  }
};

const getThreatLevelColor = (level: string) => {
  switch (level) {
    case 'CRITICAL': return '#dc2626';
    case 'HIGH': return '#f97316';
    case 'ELEVATED': return '#eab308';
    case 'MODERATE': return '#3b82f6';
    case 'LOW': return '#22c55e';
    default: return '#6b7280';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'FULLY_OPERATIONAL': return '#22c55e';
    case 'OPERATIONAL': return '#4ade80';
    case 'LIMITED_OPERATIONS': return '#eab308';
    case 'DEGRADED': return '#f97316';
    case 'NON_OPERATIONAL': return '#dc2626';
    case 'UNDER_CONSTRUCTION': return '#3b82f6';
    case 'ABANDONED': return '#6b7280';
    default: return '#6b7280';
  }
};

const formatConfidence = (value?: number): string => {
  if (value === undefined || value === null || isNaN(value)) return '--';
  if (value > 1) return `${Math.round(value)}%`;
  return `${Math.round(value * 100)}%`;
};

const formatDateTime = (dateStr?: string): string => {
  if (!dateStr) return '--';
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } catch {
    return '--';
  }
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const ResourceBar = ({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) => (
  <div style={{ marginBottom: 8 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon size={12} color={color} />
        <span style={{ fontSize: 10, color: '#9ca3af' }}>{label}</span>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: value > 50 ? '#22c55e' : value > 25 ? '#eab308' : '#dc2626' }}>
        {value.toFixed(0)}%
      </span>
    </div>
    <div style={{ 
      width: '100%', 
      height: 4, 
      backgroundColor: '#374151', 
      borderRadius: 2,
      overflow: 'hidden'
    }}>
      <div style={{
        width: `${Math.min(100, Math.max(0, value))}%`,
        height: '100%',
        backgroundColor: value > 50 ? '#22c55e' : value > 25 ? '#eab308' : '#dc2626',
        borderRadius: 2,
        transition: 'width 0.3s'
      }} />
    </div>
  </div>
);

const StatCard = ({ label, value, icon: Icon, color, subtext }: { 
  label: string; 
  value: number | string; 
  icon: any; 
  color: string;
  subtext?: string;
}) => (
  <div style={{
    padding: 12,
    backgroundColor: `${color}15`,
    borderRadius: 8,
    border: `1px solid ${color}30`
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <Icon size={16} color={color} />
      <span style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>{label}</span>
    </div>
    <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{value}</div>
    {subtext && <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>{subtext}</div>}
  </div>
);

// ============================================================================
// ASSET CARD COMPONENT
// ============================================================================

const AssetCard = ({ 
  asset, 
  isSelected, 
  onSelect,
  onViewPredictions 
}: { 
  asset: MilitaryAsset; 
  isSelected: boolean;
  onSelect: () => void;
  onViewPredictions: () => void;
}) => {
  const categoryConfig = CATEGORY_CONFIG[asset.category] || { icon: MapPin, color: '#6b7280', label: asset.category };
  const CategoryIcon = categoryConfig.icon;
  const classColors = getClassificationColor(asset.classification);
  const threatColor = getThreatLevelColor(asset.threat_level);
  const statusColor = getStatusColor(asset.status);
  const typeIcon = ASSET_TYPE_ICONS[asset.asset_type] || '📍';

  return (
    <div
      onClick={onSelect}
      style={{
        padding: 12,
        backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.03)',
        borderRadius: 8,
        marginBottom: 8,
        cursor: 'pointer',
        borderLeft: `3px solid ${categoryConfig.color}`,
        border: isSelected ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(255,255,255,0.05)',
        transition: 'all 0.2s'
      }}
    >
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>{typeIcon}</span>
            <span style={{ fontWeight: 'bold', fontSize: 12, color: '#fff' }}>{asset.name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: categoryConfig.color }}>{asset.asset_id}</span>
            {asset.callsign && (
              <span style={{ fontSize: 10, color: '#22c55e', fontFamily: 'monospace' }}>({asset.callsign})</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={{
            padding: '2px 6px',
            borderRadius: 3,
            fontSize: 8,
            fontWeight: 700,
            backgroundColor: classColors.bg,
            color: classColors.text
          }}>
            {asset.classification === 'TOP_SECRET' ? 'TS' : asset.classification.replace('_', ' ')}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: statusColor,
              boxShadow: `0 0 6px ${statusColor}`
            }} />
            <span style={{ fontSize: 9, color: statusColor }}>{asset.status.replace(/_/g, ' ')}</span>
          </div>
        </div>
      </div>

      {/* Category & Type */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <CategoryIcon size={12} color={categoryConfig.color} />
        <span style={{ fontSize: 10, color: '#6b7280' }}>{categoryConfig.label}</span>
        <span style={{ fontSize: 10, color: '#4b5563' }}>•</span>
        <span style={{ fontSize: 10, color: '#9ca3af' }}>{asset.asset_type.replace(/_/g, ' ')}</span>
      </div>

      {/* Location */}
      {asset.location_description && (
        <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          <MapPin size={10} />
          {asset.location_description}
        </div>
      )}

      {/* Threat Score & Stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Threat Score Circle */}
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: `3px solid ${threatColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${threatColor}20`
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: threatColor }}>
              {asset.ai_threat_score?.toFixed(0) || 0}
            </span>
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#6b7280' }}>THREAT</div>
            <div style={{ fontSize: 10, color: threatColor, fontWeight: 600 }}>{asset.threat_level}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, fontSize: 10 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#6b7280' }}>Personnel</div>
            <div style={{ color: '#fff', fontWeight: 600 }}>{asset.current_personnel}/{asset.personnel_capacity}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#6b7280' }}>Vehicles</div>
            <div style={{ color: '#fff', fontWeight: 600 }}>{asset.current_vehicles}/{asset.vehicle_capacity}</div>
          </div>
        </div>
      </div>

      {/* Quick Resource Bars */}
      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Fuel size={10} color={asset.fuel_availability > 50 ? '#22c55e' : '#eab308'} />
          <div style={{ flex: 1, height: 3, backgroundColor: '#374151', borderRadius: 2 }}>
            <div style={{ width: `${asset.fuel_availability}%`, height: '100%', backgroundColor: asset.fuel_availability > 50 ? '#22c55e' : '#eab308', borderRadius: 2 }} />
          </div>
          <span style={{ fontSize: 9, color: '#6b7280' }}>{asset.fuel_availability.toFixed(0)}%</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Package size={10} color={asset.rations_availability > 50 ? '#22c55e' : '#eab308'} />
          <div style={{ flex: 1, height: 3, backgroundColor: '#374151', borderRadius: 2 }}>
            <div style={{ width: `${asset.rations_availability}%`, height: '100%', backgroundColor: asset.rations_availability > 50 ? '#22c55e' : '#eab308', borderRadius: 2 }} />
          </div>
          <span style={{ fontSize: 9, color: '#6b7280' }}>{asset.rations_availability.toFixed(0)}%</span>
        </div>
      </div>

      {/* AI Insights Preview */}
      {asset.ai_recommendations && asset.ai_recommendations.length > 0 && (
        <div style={{ 
          marginTop: 10, 
          padding: 8, 
          backgroundColor: 'rgba(168, 85, 247, 0.1)', 
          borderRadius: 6,
          border: '1px solid rgba(168, 85, 247, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Brain size={12} color="#a855f7" />
            <span style={{ fontSize: 9, color: '#a855f7', fontWeight: 600 }}>AI RECOMMENDATION</span>
          </div>
          <div style={{ fontSize: 10, color: '#d8b4fe' }}>
            {asset.ai_recommendations[0]}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// ASSET DETAIL PANEL
// ============================================================================

const AssetDetailPanel = ({ 
  asset, 
  predictions,
  isLoadingPredictions,
  onAnalyze,
  onClose 
}: { 
  asset: MilitaryAsset;
  predictions: AssetPrediction[];
  isLoadingPredictions: boolean;
  onAnalyze: () => void;
  onClose: () => void;
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'resources' | 'ai'>('overview');
  const categoryConfig = CATEGORY_CONFIG[asset.category] || { icon: MapPin, color: '#6b7280', label: asset.category };
  const CategoryIcon = categoryConfig.icon;
  const classColors = getClassificationColor(asset.classification);
  const threatColor = getThreatLevelColor(asset.threat_level);

  const tabStyle = (isActive: boolean) => ({
    flex: 1,
    padding: '8px 12px',
    backgroundColor: isActive ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
    border: 'none',
    borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
    color: isActive ? '#3b82f6' : '#6b7280',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s'
  });

  return (
    <div style={{ 
      position: 'absolute', 
      inset: 0, 
      backgroundColor: '#0a0f1a', 
      display: 'flex', 
      flexDirection: 'column',
      zIndex: 10 
    }}>
      {/* Header */}
      <div style={{ 
        padding: 16, 
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        background: `linear-gradient(135deg, ${categoryConfig.color}20 0%, transparent 100%)`
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 20 }}>{ASSET_TYPE_ICONS[asset.asset_type] || '📍'}</span>
              <h2 style={{ fontSize: 16, fontWeight: 'bold', color: '#fff', margin: 0 }}>{asset.name}</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: categoryConfig.color }}>{asset.asset_id}</span>
              {asset.callsign && (
                <span style={{ 
                  padding: '2px 6px', 
                  backgroundColor: '#22c55e20', 
                  borderRadius: 4, 
                  fontSize: 10, 
                  color: '#22c55e',
                  fontFamily: 'monospace'
                }}>
                  {asset.callsign}
                </span>
              )}
              <span style={{
                padding: '2px 6px',
                borderRadius: 3,
                fontSize: 9,
                fontWeight: 700,
                backgroundColor: classColors.bg,
                color: classColors.text
              }}>
                {asset.classification.replace('_', ' ')}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: 8,
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              color: '#fff'
            }}
          >
            ✕
          </button>
        </div>

        {/* Quick Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 16 }}>
          <div style={{ textAlign: 'center', padding: 8, backgroundColor: `${threatColor}20`, borderRadius: 6 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: threatColor }}>{asset.ai_threat_score?.toFixed(0) || 0}</div>
            <div style={{ fontSize: 9, color: '#6b7280' }}>THREAT SCORE</div>
          </div>
          <div style={{ textAlign: 'center', padding: 8, backgroundColor: 'rgba(59, 130, 246, 0.2)', borderRadius: 6 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#3b82f6' }}>{asset.current_personnel}</div>
            <div style={{ fontSize: 9, color: '#6b7280' }}>PERSONNEL</div>
          </div>
          <div style={{ textAlign: 'center', padding: 8, backgroundColor: 'rgba(234, 179, 8, 0.2)', borderRadius: 6 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#eab308' }}>{asset.current_vehicles}</div>
            <div style={{ fontSize: 9, color: '#6b7280' }}>VEHICLES</div>
          </div>
          <div style={{ textAlign: 'center', padding: 8, backgroundColor: 'rgba(34, 197, 94, 0.2)', borderRadius: 6 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>{asset.guard_force_size}</div>
            <div style={{ fontSize: 9, color: '#6b7280' }}>GUARDS</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <button style={tabStyle(activeTab === 'overview')} onClick={() => setActiveTab('overview')}>Overview</button>
        <button style={tabStyle(activeTab === 'resources')} onClick={() => setActiveTab('resources')}>Resources</button>
        <button style={tabStyle(activeTab === 'ai')} onClick={() => setActiveTab('ai')}>AI Analysis</button>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {activeTab === 'overview' && (
          <div>
            {/* Unit Information */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase' }}>Unit Information</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
                <div>
                  <span style={{ color: '#6b7280' }}>Parent Unit:</span>
                  <div style={{ color: '#fff', fontWeight: 600 }}>{asset.parent_unit_name || '--'}</div>
                </div>
                <div>
                  <span style={{ color: '#6b7280' }}>Commanding Officer:</span>
                  <div style={{ color: '#fff', fontWeight: 600 }}>{asset.commanding_officer || '--'}</div>
                </div>
                <div>
                  <span style={{ color: '#6b7280' }}>Contact Frequency:</span>
                  <div style={{ color: '#22c55e', fontFamily: 'monospace' }}>{asset.contact_frequency || '--'}</div>
                </div>
                <div>
                  <span style={{ color: '#6b7280' }}>Grid Reference:</span>
                  <div style={{ color: '#fff', fontFamily: 'monospace' }}>{asset.grid_reference || '--'}</div>
                </div>
              </div>
            </div>

            {/* Location */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase' }}>Location</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>{asset.location_description || 'No description'}</div>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 10, color: '#6b7280' }}>
                <span>Lat: {asset.latitude.toFixed(4)}</span>
                <span>Lng: {asset.longitude.toFixed(4)}</span>
                {asset.altitude_meters && <span>Alt: {asset.altitude_meters}m</span>}
              </div>
            </div>

            {/* Facilities */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase' }}>Facilities</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[
                  { key: 'has_helipad', label: 'Helipad', icon: '🚁' },
                  { key: 'has_medical', label: 'Medical', icon: '🏥' },
                  { key: 'has_communications', label: 'Comms', icon: '📡' },
                  { key: 'has_power_backup', label: 'Power Backup', icon: '🔌' },
                  { key: 'has_ammunition_storage', label: 'Ammo Storage', icon: '💣' },
                  { key: 'has_fuel_storage', label: 'Fuel Storage', icon: '⛽' }
                ].map(facility => (
                  <span
                    key={facility.key}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: 10,
                      backgroundColor: (asset as any)[facility.key] ? 'rgba(34, 197, 94, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                      color: (asset as any)[facility.key] ? '#22c55e' : '#6b7280',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    {facility.icon} {facility.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Security */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase' }}>Security Status</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <div style={{ padding: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 6 }}>
                  <div style={{ fontSize: 9, color: '#6b7280' }}>Perimeter</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{asset.perimeter_security}</div>
                </div>
                <div style={{ padding: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 6 }}>
                  <div style={{ fontSize: 9, color: '#6b7280' }}>Guard Force</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{asset.guard_force_size}</div>
                </div>
                <div style={{ padding: 10, backgroundColor: `${threatColor}20`, borderRadius: 6 }}>
                  <div style={{ fontSize: 9, color: '#6b7280' }}>Threat Level</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: threatColor }}>{asset.threat_level}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'resources' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 12, textTransform: 'uppercase' }}>Resource Levels</div>
              <ResourceBar label="Fuel" value={asset.fuel_availability} icon={Fuel} color="#f59e0b" />
              <ResourceBar label="Ammunition" value={asset.ammo_availability} icon={Target} color="#ef4444" />
              <ResourceBar label="Rations" value={asset.rations_availability} icon={Package} color="#22c55e" />
              <ResourceBar label="Water" value={asset.water_availability} icon={Activity} color="#3b82f6" />
              <ResourceBar label="Medical" value={asset.medical_supplies} icon={Hospital} color="#ec4899" />
            </div>

            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 12, textTransform: 'uppercase' }}>Capacity Utilization</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ padding: 12, backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Users size={14} color="#3b82f6" />
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>Personnel</span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{asset.current_personnel}</div>
                  <div style={{ fontSize: 10, color: '#6b7280' }}>of {asset.personnel_capacity} capacity</div>
                  <div style={{ marginTop: 8, height: 4, backgroundColor: '#374151', borderRadius: 2 }}>
                    <div style={{ 
                      width: `${(asset.current_personnel / asset.personnel_capacity) * 100}%`, 
                      height: '100%', 
                      backgroundColor: '#3b82f6',
                      borderRadius: 2
                    }} />
                  </div>
                </div>
                <div style={{ padding: 12, backgroundColor: 'rgba(234, 179, 8, 0.1)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Truck size={14} color="#eab308" />
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>Vehicles</span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{asset.current_vehicles}</div>
                  <div style={{ fontSize: 10, color: '#6b7280' }}>of {asset.vehicle_capacity} capacity</div>
                  <div style={{ marginTop: 8, height: 4, backgroundColor: '#374151', borderRadius: 2 }}>
                    <div style={{ 
                      width: `${(asset.current_vehicles / asset.vehicle_capacity) * 100}%`, 
                      height: '100%', 
                      backgroundColor: '#eab308',
                      borderRadius: 2
                    }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div>
            {/* AI Status */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: 12,
              backgroundColor: 'rgba(168, 85, 247, 0.1)',
              borderRadius: 8,
              marginBottom: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Cpu size={16} color="#a855f7" />
                <span style={{ fontSize: 11, color: '#a855f7', fontWeight: 600 }}>JANUS PRO 7B</span>
              </div>
              <button
                onClick={onAnalyze}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#a855f7',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <RefreshCw size={10} /> Analyze Now
              </button>
            </div>

            {/* Risk Factors */}
            {asset.ai_risk_factors && asset.ai_risk_factors.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase' }}>Risk Factors</div>
                {asset.ai_risk_factors.map((factor, i) => (
                  <div key={i} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 8, 
                    padding: 8,
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: 4,
                    marginBottom: 4,
                    fontSize: 11,
                    color: '#fca5a5'
                  }}>
                    <AlertTriangle size={12} color="#ef4444" />
                    {factor}
                  </div>
                ))}
              </div>
            )}

            {/* AI Recommendations */}
            {asset.ai_recommendations && asset.ai_recommendations.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase' }}>Recommendations</div>
                {asset.ai_recommendations.map((rec, i) => (
                  <div key={i} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 8, 
                    padding: 8,
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    borderRadius: 4,
                    marginBottom: 4,
                    fontSize: 11,
                    color: '#86efac'
                  }}>
                    <CheckCircle size={12} color="#22c55e" />
                    {rec}
                  </div>
                ))}
              </div>
            )}

            {/* Predictions */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase' }}>AI Predictions</div>
              {isLoadingPredictions ? (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <RefreshCw size={20} color="#a855f7" style={{ animation: 'spin 1s linear infinite' }} />
                  <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 8 }}>Generating predictions...</div>
                </div>
              ) : predictions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>
                  No predictions available
                </div>
              ) : (
                predictions.map((pred) => (
                  <div key={pred.prediction_id} style={{
                    padding: 12,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    borderRadius: 8,
                    marginBottom: 8,
                    borderLeft: `3px solid ${getThreatLevelColor(pred.risk_level.toUpperCase())}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 11, color: '#fff' }}>{pred.title}</span>
                      <span style={{ 
                        padding: '2px 6px', 
                        borderRadius: 3, 
                        fontSize: 9,
                        backgroundColor: pred.action_required ? '#dc2626' : '#22c55e',
                        color: '#fff'
                      }}>
                        {formatConfidence(pred.confidence)}
                      </span>
                    </div>
                    <p style={{ fontSize: 10, color: '#9ca3af', margin: 0, lineHeight: 1.4 }}>{pred.summary}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 9, color: '#4b5563' }}>
                      <span>{pred.prediction_type} • {pred.priority}</span>
                      <span>{pred.generated_by}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MilitaryAssetsPanel() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [assets, setAssets] = useState<MilitaryAsset[]>([]);
  const [summary, setSummary] = useState<AssetsSummary | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<MilitaryAsset | null>(null);
  const [predictions, setPredictions] = useState<AssetPrediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedThreatLevel, setSelectedThreatLevel] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const fetchAssets = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedThreatLevel) params.append('threat_level', selectedThreatLevel);
      if (searchQuery) params.append('search', searchQuery);
      
      const res = await fetch(`${API_V1}/military-assets/?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets || []);
      }
    } catch (error) {
      console.error('Failed to fetch assets:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, selectedThreatLevel, searchQuery]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_V1}/military-assets/summary`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    }
  }, []);

  const fetchPredictions = useCallback(async (assetId: string) => {
    setIsLoadingPredictions(true);
    try {
      const res = await fetch(`${API_V1}/military-assets/${assetId}/predictions?limit=5`);
      if (res.ok) {
        const data = await res.json();
        setPredictions(data.predictions || []);
      }
    } catch (error) {
      console.error('Failed to fetch predictions:', error);
    } finally {
      setIsLoadingPredictions(false);
    }
  }, []);

  const analyzeAsset = useCallback(async (assetId: string) => {
    try {
      const res = await fetch(`${API_V1}/military-assets/${assetId}/analyze`, { method: 'POST' });
      if (res.ok) {
        fetchAssets();
        fetchPredictions(assetId);
      }
    } catch (error) {
      console.error('Failed to analyze asset:', error);
    }
  }, [fetchAssets, fetchPredictions]);

  useEffect(() => {
    if (isPanelOpen) {
      fetchAssets();
      fetchSummary();
      const interval = setInterval(fetchAssets, 30000);
      return () => clearInterval(interval);
    }
  }, [isPanelOpen, fetchAssets, fetchSummary]);

  useEffect(() => {
    if (selectedAsset) {
      fetchPredictions(selectedAsset.asset_id);
    }
  }, [selectedAsset, fetchPredictions]);

  if (!isPanelOpen) {
    return (
      <button
        onClick={() => setIsPanelOpen(true)}
        style={{
          position: 'fixed',
          right: 16,
          bottom: 100,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 20px',
          background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
          color: '#fff',
          border: 'none',
          borderRadius: 25,
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(168, 85, 247, 0.4)',
          fontWeight: 600,
          fontSize: 14
        }}
      >
        <Building2 size={18} />
        <span>Military Assets</span>
        {summary && (
          <span style={{
            padding: '2px 8px',
            borderRadius: 10,
            fontSize: 11,
            backgroundColor: 'rgba(255,255,255,0.2)'
          }}>
            {summary.total_assets}
          </span>
        )}
      </button>
    );
  }

  return (
    <ResizablePanel
      title="MILITARY ASSETS"
      icon={<Building2 size={18} color="#fff" />}
      initialWidth={480}
      initialHeight={700}
      minWidth={400}
      minHeight={500}
      maxWidth={800}
      maxHeight={900}
      position="bottom-right"
      headerGradient="linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)"
      onClose={() => setIsPanelOpen(false)}
      zIndex={1000}
      draggable={true}
      statusBadge={
        summary && (
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
            {summary.total_assets} tracked
          </span>
        )
      }
    >
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: '#0a0f1a',
        position: 'relative'
      }}>
        {selectedAsset ? (
          <AssetDetailPanel
            asset={selectedAsset}
            predictions={predictions}
            isLoadingPredictions={isLoadingPredictions}
            onAnalyze={() => analyzeAsset(selectedAsset.asset_id)}
            onClose={() => setSelectedAsset(null)}
          />
        ) : (
          <>
            {/* Summary Stats */}
            {summary && (
              <div style={{ padding: 12, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <StatCard label="Total" value={summary.total_assets} icon={Building2} color="#a855f7" />
                  <StatCard label="Personnel" value={summary.total_personnel} icon={Users} color="#3b82f6" />
                  <StatCard label="High Threat" value={summary.high_threat_count} icon={AlertTriangle} color="#ef4444" />
                  <StatCard label="Low Resource" value={summary.low_resources_count} icon={Package} color="#eab308" />
                </div>
              </div>
            )}

            {/* Search & Filters */}
            <div style={{ padding: 12, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: showFilters ? 12 : 0 }}>
                <div style={{ 
                  flex: 1, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8,
                  padding: '8px 12px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderRadius: 6
                }}>
                  <Search size={14} color="#6b7280" />
                  <input
                    type="text"
                    placeholder="Search assets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'none',
                      border: 'none',
                      outline: 'none',
                      color: '#fff',
                      fontSize: 12
                    }}
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: showFilters ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255,255,255,0.05)',
                    border: showFilters ? '1px solid rgba(168, 85, 247, 0.4)' : 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    color: showFilters ? '#a855f7' : '#6b7280'
                  }}
                >
                  <Filter size={14} />
                </button>
                <button
                  onClick={fetchAssets}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    color: '#6b7280'
                  }}
                >
                  <RefreshCw size={14} />
                </button>
              </div>

              {showFilters && (
                <div>
                  <div style={{ fontSize: 9, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase' }}>Category</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                    <button
                      onClick={() => setSelectedCategory(null)}
                      style={{
                        padding: '4px 8px',
                        fontSize: 10,
                        borderRadius: 4,
                        border: 'none',
                        backgroundColor: selectedCategory === null ? '#a855f7' : 'rgba(255,255,255,0.1)',
                        color: selectedCategory === null ? '#fff' : '#9ca3af',
                        cursor: 'pointer'
                      }}
                    >
                      All
                    </button>
                    {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedCategory(key)}
                        style={{
                          padding: '4px 8px',
                          fontSize: 10,
                          borderRadius: 4,
                          border: 'none',
                          backgroundColor: selectedCategory === key ? config.color : 'rgba(255,255,255,0.1)',
                          color: selectedCategory === key ? '#fff' : '#9ca3af',
                          cursor: 'pointer'
                        }}
                      >
                        {config.label}
                      </button>
                    ))}
                  </div>

                  <div style={{ fontSize: 9, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase' }}>Threat Level</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['LOW', 'MODERATE', 'ELEVATED', 'HIGH', 'CRITICAL'].map(level => (
                      <button
                        key={level}
                        onClick={() => setSelectedThreatLevel(selectedThreatLevel === level ? null : level)}
                        style={{
                          padding: '4px 8px',
                          fontSize: 10,
                          borderRadius: 4,
                          border: 'none',
                          backgroundColor: selectedThreatLevel === level ? getThreatLevelColor(level) : 'rgba(255,255,255,0.1)',
                          color: '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Assets List */}
            <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
              {isLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <RefreshCw size={24} color="#a855f7" style={{ animation: 'spin 1s linear infinite' }} />
                  <p style={{ color: '#9ca3af', marginTop: 10, fontSize: 12 }}>Loading assets...</p>
                </div>
              ) : assets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <Building2 size={32} color="#4b5563" />
                  <p style={{ color: '#6b7280', marginTop: 10, fontSize: 12 }}>No assets found</p>
                </div>
              ) : (
                assets.map(asset => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    isSelected={selectedAsset?.id === asset.id}
                    onSelect={() => setSelectedAsset(asset)}
                    onViewPredictions={() => {
                      setSelectedAsset(asset);
                      fetchPredictions(asset.asset_id);
                    }}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </ResizablePanel>
  );
}
