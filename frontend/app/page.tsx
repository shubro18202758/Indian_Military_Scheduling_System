'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import CommandCenter from '@/components/CommandCenter';
import CommandCenterAdvanced from '@/components/CommandCenterAdvanced';
import DashboardOverlay from '@/components/DashboardOverlay';

// Dynamic imports for maps (must be client-side only)
const MapComponent = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div style={{ height: '100%', width: '100%', background: '#0a0a0a' }} />
});

const MapAdvanced = dynamic(() => import('@/components/MapAdvanced'), {
  ssr: false,
  loading: () => <div style={{ height: '100%', width: '100%', background: '#0a0a0a' }} />
});

const API_V1 = '/api/proxy/v1';

interface Vehicle {
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
  fuel_percent: number;
  has_radio: boolean;
  has_gps: boolean;
  convoy_id: number;
  obstacle_response?: {
    action: string;
    obstacle_type?: string;
  };
}

interface Route {
  id: number;
  name: string;
  waypoints: number[][];
  risk_level: string;
  status: string;
}

interface AdvancedRoute {
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
  status: string;
}

export default function Home() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [advancedRoutes, setAdvancedRoutes] = useState<AdvancedRoute[]>([]);
  const [scenarioEvents, setScenarioEvents] = useState<ScenarioEvent[]>([]);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(true); // Advanced mode with multi-route
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);

  // Fetch vehicles from simulation
  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fetch(`${API_V1}/vehicles/vehicles`);
      if (res.ok) {
        const data = await res.json();
        setVehicles(data);
      }
    } catch (e) {
      // Silent fail
    }
  }, []);

  // Fetch routes
  const fetchRoutes = useCallback(async () => {
    try {
      const res = await fetch(`${API_V1}/routes/`);
      if (res.ok) {
        const data = await res.json();
        setRoutes(data);
      }
    } catch (e) {
      // Silent fail
    }
  }, []);

  // Fetch advanced routes
  const fetchAdvancedRoutes = useCallback(async () => {
    try {
      const res = await fetch(`${API_V1}/advanced/routes/list`);
      if (res.ok) {
        const data = await res.json();
        setAdvancedRoutes(data.routes || []);
      }
    } catch (e) {
      // Silent fail
    }
  }, []);

  // Fetch scenario events
  const fetchScenarioEvents = useCallback(async () => {
    try {
      const res = await fetch(`${API_V1}/advanced/scenario/active`);
      if (res.ok) {
        const data = await res.json();
        setScenarioEvents(data.events || []);
      }
    } catch (e) {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    // Mark as client-side and set initial time
    setIsClient(true);
    setCurrentTime(new Date());
    
    fetchVehicles();
    fetchRoutes();
    
    if (advancedMode) {
      fetchAdvancedRoutes();
      fetchScenarioEvents();
    }
    
    // Poll for vehicle updates (frequent for smooth movement)
    const interval = setInterval(() => {
      fetchVehicles();
      if (advancedMode) {
        fetchAdvancedRoutes();
        fetchScenarioEvents();
      }
    }, 500); // 500ms for smooth animation
    
    // Clock update
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => {
      clearInterval(interval);
      clearInterval(clockInterval);
    };
  }, [fetchVehicles, fetchRoutes, fetchAdvancedRoutes, fetchScenarioEvents, advancedMode]);

  // Convert vehicles to assets format for map compatibility
  const vehiclesAsAssets = vehicles.map(v => ({
    id: v.id,
    name: v.name,
    asset_type: v.asset_type,
    is_available: v.status !== 'HALTED',
    fuel_status: v.fuel_percent,
    current_lat: v.lat,
    current_long: v.lng,
    bearing: v.bearing,
    speed_kmh: v.speed_kmh,
    status: v.status,
    obstacle_response: v.obstacle_response
  }));

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      position: 'relative',
      background: '#0a0a0a',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      overflow: 'hidden'
    }}>
      {/* MAP - Full Screen Background */}
      <div style={{ 
        position: 'absolute', 
        top: 50, 
        left: advancedMode ? 360 : 320, 
        right: advancedMode ? 400 : 384, 
        bottom: 80, 
        zIndex: 10,
        overflow: 'hidden',
        background: '#0f172a'
      }}>
        {advancedMode ? (
          <MapAdvanced 
            assets={vehiclesAsAssets} 
            routes={routes}
            advancedRoutes={advancedRoutes}
            selectedRouteId={selectedRouteId}
            selectedVehicleId={selectedVehicleId}
            scenarioEvents={scenarioEvents}
            onRouteClick={(route) => setSelectedRouteId(route.route_id)}
            onVehicleClick={(asset) => setSelectedVehicleId(asset.id)}
          />
        ) : (
          <MapComponent assets={vehiclesAsAssets} routes={routes} />
        )}
      </div>

      {/* TOP HEADER BAR - Military Style */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 50,
        background: 'linear-gradient(90deg, rgba(0,30,0,0.98) 0%, rgba(0,0,0,0.98) 50%, rgba(30,0,0,0.98) 100%)',
        borderBottom: '1px solid rgba(34, 197, 94, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        zIndex: 100
      }}>
        {/* Left - Logo & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
          <div style={{
            width: 36,
            height: 36,
            background: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20
          }}>
            🎖️
          </div>
          <div>
            <div style={{ 
              color: '#22c55e', 
              fontWeight: 'bold', 
              fontSize: 14,
              letterSpacing: '2px'
            }}>
              INDIAN ARMY
            </div>
            <div style={{ 
              color: '#fff', 
              fontSize: 11,
              opacity: 0.8
            }}>
              Transport Command & Control System
            </div>
          </div>
        </div>

        {/* Center - System Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
          <button
            onClick={() => setAdvancedMode(!advancedMode)}
            style={{
              background: advancedMode ? 'rgba(34, 197, 94, 0.2)' : 'rgba(59, 130, 246, 0.2)',
              border: `1px solid ${advancedMode ? '#22c55e' : '#3b82f6'}`,
              padding: '6px 16px',
              borderRadius: 4,
              color: advancedMode ? '#22c55e' : '#3b82f6',
              fontSize: 11,
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            {advancedMode ? '🚀 ADVANCED MODE' : '📊 BASIC MODE'}
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>System Status</div>
            <div style={{ color: '#22c55e', fontSize: 12, fontWeight: 'bold' }}>OPERATIONAL</div>
          </div>
          <div style={{ width: 1, height: 30, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>Threat Level</div>
            <div style={{ color: '#eab308', fontSize: 12, fontWeight: 'bold' }}>ELEVATED</div>
          </div>
          <div style={{ width: 1, height: 30, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>Network</div>
            <div style={{ color: '#22c55e', fontSize: 12, fontWeight: 'bold' }}>SECURE</div>
          </div>
          {advancedMode && (
            <>
              <div style={{ width: 1, height: 30, background: 'rgba(255,255,255,0.1)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>Routes</div>
                <div style={{ color: '#3b82f6', fontSize: 12, fontWeight: 'bold' }}>{advancedRoutes.length}</div>
              </div>
              <div style={{ width: 1, height: 30, background: 'rgba(255,255,255,0.1)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>Events</div>
                <div style={{ color: '#f97316', fontSize: 12, fontWeight: 'bold' }}>{scenarioEvents.length}</div>
              </div>
            </>
          )}
        </div>

        {/* Right - Time & Classification */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ 
              color: '#fff', 
              fontSize: 18, 
              fontFamily: 'monospace',
              fontWeight: 'bold'
            }}>
              {currentTime ? currentTime.toLocaleTimeString('en-US', { hour12: false }) : '--:--:--'}
            </div>
            <div style={{ color: '#6b7280', fontSize: 10 }}>
              {currentTime ? currentTime.toLocaleDateString('en-US', { 
                weekday: 'short', 
                day: '2-digit', 
                month: 'short', 
                year: 'numeric' 
              }) : '--- -- --- ----'}
            </div>
          </div>
          <div style={{
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            padding: '4px 12px',
            borderRadius: 4,
            color: '#ef4444',
            fontSize: 10,
            fontWeight: 'bold',
            letterSpacing: '1px'
          }}>
            RESTRICTED
          </div>
        </div>
      </div>

      {/* COMMAND CENTER - Panels */}
      {advancedMode ? (
        <CommandCenterAdvanced 
          onVehicleSelect={(v) => setSelectedVehicleId(v?.id || null)}
          onRouteSelect={(r) => setSelectedRouteId(r?.route_id || null)}
          selectedVehicleId={selectedVehicleId}
        />
      ) : (
        <CommandCenter />
      )}

      {/* Dashboard Overlay - FAB for creating assets, convoys, routes */}
      <DashboardOverlay />

      {/* Map Attribution */}
      <div style={{
        position: 'absolute',
        bottom: 5,
        left: advancedMode ? 365 : 325,
        fontSize: 10,
        color: 'rgba(255,255,255,0.3)',
        zIndex: 10
      }}>
        AI-Powered Tactical Awareness System v3.0 {advancedMode ? '| Advanced Multi-Route Mode' : ''}
      </div>
    </div>
  );
}
