'use client';

/**
 * Unified Data Context
 * ====================
 * 
 * SINGLE SOURCE OF TRUTH for all frontend components.
 * Ensures data consistency across:
 * - Map Components
 * - Tracking Panel
 * - Tactical Metrics HUD
 * - Command Centre
 * - Scheduling Command Center
 * - Military Assets Panel
 * 
 * All components should consume this context instead of making
 * individual API calls to ensure synchronized data display.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';

const API_V1 = '/api/proxy/v1';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ConvoyTracking {
  latitude: number | null;
  longitude: number | null;
  speed_kmh: number;
  heading_deg: number;
  distance_covered_km: number;
  distance_remaining_km: number;
  route_progress_pct: number;
  movement_status: string;
  eta_destination: string | null;
  last_checkpoint: string | null;
  next_checkpoint: string | null;
}

export interface ConvoyMission {
  mission_id: string | null;
  mission_code: string | null;
  cargo_type: string | null;
  cargo_weight_tons: number;
  priority: string;
  personnel_count: number;
}

export interface UnifiedConvoy {
  id: number;
  name: string;
  status: string;
  start_location: string;
  end_location: string;
  route_id: number | null;
  route_name: string | null;
  vehicle_count: number;
  tracking: ConvoyTracking | null;
  mission: ConvoyMission | null;
}

export interface RouteStatus {
  active_convoys: number;
  active_threats: number;
  traffic_density: string;
  weather_status: string;
  road_condition: string;
  is_operational: boolean;
}

export interface UnifiedRoute {
  id: number;
  name: string;
  category: string;
  start_location: string;
  end_location: string;
  distance_km: number;
  estimated_time_hours: number;
  risk_level: string;
  current_status: RouteStatus;
}

export interface UnifiedTCP {
  id: number;
  name: string;
  route_id: number;
  latitude: number;
  longitude: number;
  status: string;
  capacity: number;
  current_traffic: string;
  facilities: string[];
  type: string;
}

export interface UnifiedThreat {
  id: number;
  type: string;
  subtype: string;
  severity: string;
  latitude: number;
  longitude: number;
  route_id: number;
  description: string;
  detected_at: string | null;
  ai_generated: boolean;
  recommended_action: string | null;
}

export interface UnifiedMilitaryAsset {
  id: number;
  name: string;
  type: string;
  category: string;
  latitude: number;
  longitude: number;
  status: string;
  classification: string;
  capabilities: string[];
}

export interface AIRecommendation {
  id: string;
  type: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  target: string;
  text: string;
  source: string;
  timestamp: string;
  actionable: boolean;
}

export interface AIAnalysis {
  status: string;
  engine: string;
  gpu_accelerated: boolean;
  last_analysis: string;
  recommendations: AIRecommendation[];
  threat_level: string;
  confidence: number;
}

export interface SystemMetrics {
  convoys: {
    total: number;
    active: number;
    completed: number;
    planned: number;
    halted: number;
  };
  vehicles: {
    total: number;
    in_transit: number;
    available: number;
  };
  routes: {
    total: number;
    operational: number;
    blocked: number;
  };
  threats: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  risk_score: number;
  fleet_utilization_pct: number;
  system_health: string;
}

export interface SchedulingData {
  pending_requests: number;
  requests: Array<{
    id: number;
    convoy_id: number;
    convoy_callsign: string;
    tcp_name: string;
    destination: string;
    priority: string;
    status: string;
  }>;
  recent_recommendations: Array<{
    id: number;
    decision: string;
    confidence: number;
    created_at: string | null;
  }>;
}

export interface UnifiedState {
  timestamp: string;
  sync_id: string;
  convoys: UnifiedConvoy[];
  routes: UnifiedRoute[];
  tcps: UnifiedTCP[];
  threats: UnifiedThreat[];
  military_assets: UnifiedMilitaryAsset[];
  scheduling: SchedulingData;
  metrics: SystemMetrics;
  ai_analysis: AIAnalysis;
  system_status: {
    database_connected: boolean;
    ai_engine_status: string;
    last_update: string;
    data_freshness_ms: number;
  };
}

interface UnifiedDataContextType {
  // Core state
  state: UnifiedState | null;
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  
  // Refresh controls
  refresh: () => Promise<void>;
  setRefreshInterval: (ms: number) => void;
  
  // Filtered getters
  getConvoyById: (id: number) => UnifiedConvoy | undefined;
  getRouteById: (id: number) => UnifiedRoute | undefined;
  getActiveConvoys: () => UnifiedConvoy[];
  getThreatsForRoute: (routeId: number) => UnifiedThreat[];
  getConvoysOnRoute: (routeId: number) => UnifiedConvoy[];
  getRecommendationsForConvoy: (convoyId: number) => AIRecommendation[];
  
  // Selection state (for coordinated views)
  selectedConvoyId: number | null;
  setSelectedConvoyId: (id: number | null) => void;
  selectedRouteId: number | null;
  setSelectedRouteId: (id: number | null) => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const UnifiedDataContext = createContext<UnifiedDataContextType | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

interface UnifiedDataProviderProps {
  children: ReactNode;
  initialRefreshInterval?: number;
}

export function UnifiedDataProvider({ 
  children, 
  initialRefreshInterval = 5000 
}: UnifiedDataProviderProps) {
  const [state, setState] = useState<UnifiedState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [refreshInterval, setRefreshIntervalState] = useState(initialRefreshInterval);
  
  // Selection state for coordinated views
  const [selectedConvoyId, setSelectedConvoyId] = useState<number | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  
  const fetchInProgress = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Fetch unified state
  const fetchUnifiedState = useCallback(async () => {
    if (fetchInProgress.current) return;
    fetchInProgress.current = true;
    
    try {
      const response = await fetch(`${API_V1}/advanced/unified/state`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: UnifiedState = await response.json();
      
      // Calculate data freshness
      const now = new Date();
      data.system_status.data_freshness_ms = 0;
      
      setState(data);
      setLastUpdate(now);
      setError(null);
    } catch (err) {
      console.error('[UnifiedDataContext] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      fetchInProgress.current = false;
    }
  }, []);
  
  // Set up polling
  useEffect(() => {
    // Initial fetch
    fetchUnifiedState();
    
    // Set up interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    intervalRef.current = setInterval(fetchUnifiedState, refreshInterval);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchUnifiedState, refreshInterval]);
  
  // Refresh control
  const setRefreshInterval = useCallback((ms: number) => {
    setRefreshIntervalState(Math.max(1000, ms)); // Minimum 1 second
  }, []);
  
  // Filtered getters
  const getConvoyById = useCallback((id: number) => {
    return state?.convoys.find(c => c.id === id);
  }, [state]);
  
  const getRouteById = useCallback((id: number) => {
    return state?.routes.find(r => r.id === id);
  }, [state]);
  
  const getActiveConvoys = useCallback(() => {
    return state?.convoys.filter(c => c.status === 'IN_TRANSIT') || [];
  }, [state]);
  
  const getThreatsForRoute = useCallback((routeId: number) => {
    return state?.threats.filter(t => t.route_id === routeId) || [];
  }, [state]);
  
  const getConvoysOnRoute = useCallback((routeId: number) => {
    return state?.convoys.filter(c => c.route_id === routeId) || [];
  }, [state]);
  
  const getRecommendationsForConvoy = useCallback((convoyId: number) => {
    if (!state) return [];
    const convoy = state.convoys.find(c => c.id === convoyId);
    if (!convoy) return [];
    
    return state.ai_analysis.recommendations.filter(
      r => r.target.includes(convoy.name) || r.id.includes(String(convoyId))
    );
  }, [state]);
  
  const contextValue: UnifiedDataContextType = {
    state,
    loading,
    error,
    lastUpdate,
    refresh: fetchUnifiedState,
    setRefreshInterval,
    getConvoyById,
    getRouteById,
    getActiveConvoys,
    getThreatsForRoute,
    getConvoysOnRoute,
    getRecommendationsForConvoy,
    selectedConvoyId,
    setSelectedConvoyId,
    selectedRouteId,
    setSelectedRouteId,
  };
  
  return (
    <UnifiedDataContext.Provider value={contextValue}>
      {children}
    </UnifiedDataContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useUnifiedData(): UnifiedDataContextType {
  const context = useContext(UnifiedDataContext);
  if (!context) {
    throw new Error('useUnifiedData must be used within a UnifiedDataProvider');
  }
  return context;
}

// ============================================================================
// CONVENIENCE HOOKS
// ============================================================================

export function useConvoys() {
  const { state } = useUnifiedData();
  return state?.convoys || [];
}

export function useActiveConvoys() {
  const { getActiveConvoys } = useUnifiedData();
  return getActiveConvoys();
}

export function useRoutes() {
  const { state } = useUnifiedData();
  return state?.routes || [];
}

export function useThreats() {
  const { state } = useUnifiedData();
  return state?.threats || [];
}

export function useMetrics() {
  const { state } = useUnifiedData();
  return state?.metrics || null;
}

export function useAIAnalysis() {
  const { state } = useUnifiedData();
  return state?.ai_analysis || null;
}

export function useSelectedConvoy() {
  const { selectedConvoyId, getConvoyById, getRecommendationsForConvoy } = useUnifiedData();
  
  if (!selectedConvoyId) return { convoy: null, recommendations: [] };
  
  return {
    convoy: getConvoyById(selectedConvoyId),
    recommendations: getRecommendationsForConvoy(selectedConvoyId)
  };
}

export function useSelectedRoute() {
  const { selectedRouteId, getRouteById, getThreatsForRoute, getConvoysOnRoute } = useUnifiedData();
  
  if (!selectedRouteId) return { route: null, threats: [], convoys: [] };
  
  return {
    route: getRouteById(selectedRouteId),
    threats: getThreatsForRoute(selectedRouteId),
    convoys: getConvoysOnRoute(selectedRouteId)
  };
}

export default UnifiedDataContext;
