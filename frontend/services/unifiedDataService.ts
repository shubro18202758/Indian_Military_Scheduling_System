/**
 * Unified Data Service
 * ====================
 * भारतीय सेना (Indian Army) Logistics AI System
 * 
 * Single Source of Truth for all frontend components.
 * Ensures data consistency across:
 * - Command Centre
 * - Tracking Panel
 * - Tactical Metrics HUD
 * - Military Assets Panel
 * - AI Load Management
 * - Scheduling
 * 
 * All components receive synchronized data from this service,
 * eliminating inconsistencies and ensuring unified AI analysis.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

// ============================================================================
// TYPE DEFINITIONS
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

export interface Convoy {
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

export interface Route {
  id: number;
  name: string;
  distance_km: number;
  risk_level: string;
  active_convoys: number;
  congestion_level: string;
  is_blocked: boolean;
  estimated_travel_time_hrs: number;
}

export interface TCP {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  status: string;
  current_convoys: number;
  capacity: number;
  facilities: string[];
}

export interface Threat {
  id: number;
  obstacle_type: string;
  severity: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
  is_countered: boolean;
  affected_routes: number[];
  countermeasure_status: string | null;
}

export interface MilitaryAsset {
  id: number;
  asset_id: string;
  name: string;
  callsign: string | null;
  category: string;
  asset_type: string;
  latitude: number;
  longitude: number;
  status: string;
  threat_level: string;
  personnel_capacity: number;
  current_personnel: number;
  fuel_availability: number;
  ai_threat_score: number;
  ai_risk_factors: string[];
  ai_recommendations: string[];
}

export interface SchedulingData {
  pending_requests: number;
  scheduled_today: number;
  optimization_score: number;
  recommendations: Array<{
    type: string;
    priority: string;
    text: string;
    action: string;
  }>;
}

export interface SystemMetrics {
  total_convoys: number;
  convoys_in_transit: number;
  convoys_halted: number;
  convoys_completed: number;
  total_vehicles: number;
  total_personnel: number;
  active_threats: number;
  threat_level: string;
  route_congestion: number;
  system_efficiency: number;
}

export interface AIAnalysis {
  overall_status: string;
  risk_assessment: string;
  critical_issues: string[];
  recommendations: string[];
  predictions: Array<{
    type: string;
    probability: number;
    impact: string;
    timeframe: string;
  }>;
  ai_engine: string;
  last_analysis: string;
}

export interface UnifiedState {
  timestamp: string;
  sync_id: string;
  convoys: Convoy[];
  routes: Route[];
  tcps: TCP[];
  threats: Threat[];
  military_assets: MilitaryAsset[];
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

// ============================================================================
// DATA SERVICE CLASS
// ============================================================================

type StateListener = (state: UnifiedState) => void;

class UnifiedDataService {
  private static instance: UnifiedDataService;
  private state: UnifiedState | null = null;
  private listeners: Set<StateListener> = new Set();
  private pollInterval: NodeJS.Timeout | null = null;
  private isPolling: boolean = false;
  private lastError: string | null = null;
  private retryCount: number = 0;
  private maxRetries: number = 3;

  private constructor() {
    // Singleton
  }

  static getInstance(): UnifiedDataService {
    if (!UnifiedDataService.instance) {
      UnifiedDataService.instance = new UnifiedDataService();
    }
    return UnifiedDataService.instance;
  }

  /**
   * Subscribe to state updates
   */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    
    // Immediately provide current state if available
    if (this.state) {
      listener(this.state);
    }

    // Start polling if not already
    if (!this.isPolling) {
      this.startPolling();
    }

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stopPolling();
      }
    };
  }

  /**
   * Get current state synchronously
   */
  getState(): UnifiedState | null {
    return this.state;
  }

  /**
   * Force refresh the state
   */
  async refresh(): Promise<UnifiedState | null> {
    return this.fetchState();
  }

  /**
   * Start polling for updates
   */
  private startPolling(intervalMs: number = 5000): void {
    if (this.isPolling) return;
    
    this.isPolling = true;
    this.fetchState(); // Initial fetch

    this.pollInterval = setInterval(() => {
      this.fetchState();
    }, intervalMs);
  }

  /**
   * Stop polling
   */
  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPolling = false;
  }

  /**
   * Fetch unified state from API
   */
  private async fetchState(): Promise<UnifiedState | null> {
    try {
      const response = await fetch(`${API_BASE}/api/v1/advanced/unified/state`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: UnifiedState = await response.json();
      
      // Update state
      this.state = data;
      this.lastError = null;
      this.retryCount = 0;

      // Notify all listeners
      this.listeners.forEach(listener => {
        try {
          listener(data);
        } catch (e) {
          console.error('Listener error:', e);
        }
      });

      return data;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.retryCount++;
      
      console.error(`[UnifiedDataService] Fetch error (attempt ${this.retryCount}):`, error);
      
      // If we have cached state, keep using it
      if (this.state) {
        return this.state;
      }
      
      return null;
    }
  }

  /**
   * Get convoys with optional filtering
   */
  getConvoys(filter?: { status?: string; routeId?: number }): Convoy[] {
    if (!this.state) return [];
    
    let convoys = this.state.convoys;
    
    if (filter?.status) {
      convoys = convoys.filter(c => c.status === filter.status);
    }
    if (filter?.routeId) {
      convoys = convoys.filter(c => c.route_id === filter.routeId);
    }
    
    return convoys;
  }

  /**
   * Get a specific convoy by ID
   */
  getConvoy(id: number): Convoy | null {
    return this.state?.convoys.find(c => c.id === id) || null;
  }

  /**
   * Get active threats
   */
  getActiveThreats(): Threat[] {
    return this.state?.threats.filter(t => t.is_active && !t.is_countered) || [];
  }

  /**
   * Get military assets by category
   */
  getAssetsByCategory(category: string): MilitaryAsset[] {
    return this.state?.military_assets.filter(a => a.category === category) || [];
  }

  /**
   * Get high-threat assets
   */
  getHighThreatAssets(): MilitaryAsset[] {
    return this.state?.military_assets.filter(a => a.ai_threat_score >= 70) || [];
  }

  /**
   * Get system metrics
   */
  getMetrics(): SystemMetrics | null {
    return this.state?.metrics || null;
  }

  /**
   * Get AI analysis and recommendations
   */
  getAIAnalysis(): AIAnalysis | null {
    return this.state?.ai_analysis || null;
  }

  /**
   * Get last error if any
   */
  getLastError(): string | null {
    return this.lastError;
  }
}

// Export singleton instance
export const unifiedDataService = UnifiedDataService.getInstance();

// React hook for using unified data
export function useUnifiedData(): {
  state: UnifiedState | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<UnifiedState | null>;
} {
  // This is a plain function that can be used with React hooks
  // Components should use useState and useEffect to integrate
  return {
    state: unifiedDataService.getState(),
    loading: !unifiedDataService.getState(),
    error: unifiedDataService.getLastError(),
    refresh: () => unifiedDataService.refresh()
  };
}

export default unifiedDataService;
