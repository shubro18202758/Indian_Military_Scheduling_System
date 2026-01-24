'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const API_V1 = '/api/proxy/v1';

// ============================================================================
// INTERFACES
// ============================================================================

interface Asset {
  id: number;
  name: string;
  asset_type: string;
  current_lat?: number;
  current_long?: number;
  bearing?: number;
  is_available: boolean;
  speed_kmh?: number;
  status?: string;
  convoy_id?: number;
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
  convoy_assigned?: number;
  status: string;
}

interface Obstacle {
  id: number;
  obstacle_type: string;
  severity: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
  description?: string;
  estimated_duration_hours?: number;
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

interface MapAdvancedProps {
  assets: Asset[];
  routes?: Route[];
  advancedRoutes?: AdvancedRoute[];
  selectedRouteId?: string | null;
  selectedVehicleId?: number | null;
  scenarioEvents?: ScenarioEvent[];
  onRouteClick?: (route: AdvancedRoute) => void;
  onVehicleClick?: (asset: Asset) => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getRouteColor = (category: string) => {
  switch (category?.toUpperCase()) {
    case 'STRATEGIC': return '#ef4444';     // Red
    case 'TACTICAL': return '#f97316';      // Orange
    case 'EMERGENCY': return '#dc2626';     // Dark Red
    case 'LOGISTICS': return '#22c55e';     // Green
    case 'PATROL': return '#3b82f6';        // Blue
    case 'RECONNAISSANCE': return '#a855f7'; // Purple
    default: return '#6b7280';              // Gray
  }
};

const getThreatLevelStyle = (threatLevel: string) => {
  switch (threatLevel?.toUpperCase()) {
    case 'GREEN': return { opacity: 0.6, weight: 3, dashArray: '' };
    case 'YELLOW': return { opacity: 0.7, weight: 4, dashArray: '10, 5' };
    case 'ORANGE': return { opacity: 0.8, weight: 4, dashArray: '5, 5' };
    case 'RED': return { opacity: 0.9, weight: 5, dashArray: '' };
    case 'BLACK': return { opacity: 1.0, weight: 6, dashArray: '3, 3' };
    default: return { opacity: 0.5, weight: 3, dashArray: '5, 10' };
  }
};

const getVehicleColor = (status?: string) => {
  switch (status?.toUpperCase()) {
    case 'MOVING': return '#22c55e';         // Green
    case 'HALTED_OBSTACLE': return '#ef4444'; // Red
    case 'SLOWED': return '#f59e0b';         // Yellow
    case 'ARRIVED': return '#3b82f6';        // Blue
    case 'REFUELING': return '#06b6d4';      // Cyan
    case 'MAINTENANCE': return '#a855f7';    // Purple
    default: return '#6b7280';               // Gray
  }
};

const getObstacleColor = (severity: string) => {
  switch (severity?.toUpperCase()) {
    case 'EMERGENCY': return '#ff0000';
    case 'CRITICAL': return '#dc2626';
    case 'WARNING': return '#f97316';
    case 'HIGH': return '#ea580c';
    case 'CAUTION': return '#eab308';
    case 'MEDIUM': return '#eab308';
    case 'ADVISORY': return '#22c55e';
    case 'LOW': return '#3b82f6';
    default: return '#6b7280';
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
  if (t.includes('MEDICAL')) return '🏥';
  return '⚠️';
};

const getObstacleEmoji = (type: string) => {
  const typeUpper = type?.toUpperCase() || '';
  if (typeUpper.includes('LANDSLIDE') || typeUpper.includes('AVALANCHE')) return '🏔️';
  if (typeUpper.includes('IED') || typeUpper.includes('MINE')) return '💣';
  if (typeUpper.includes('AMBUSH') || typeUpper.includes('HOSTILE')) return '⚔️';
  if (typeUpper.includes('FLOOD') || typeUpper.includes('WATER')) return '🌊';
  if (typeUpper.includes('FOG') || typeUpper.includes('WEATHER')) return '🌫️';
  if (typeUpper.includes('ACCIDENT') || typeUpper.includes('BREAKDOWN')) return '🚧';
  if (typeUpper.includes('BRIDGE') || typeUpper.includes('INFRASTRUCTURE')) return '🌉';
  if (typeUpper.includes('PROTEST') || typeUpper.includes('CIVILIAN')) return '👥';
  return '⚠️';
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MapAdvanced({ 
  assets, 
  routes = [],
  advancedRoutes = [],
  selectedRouteId,
  selectedVehicleId,
  scenarioEvents = [],
  onRouteClick,
  onVehicleClick
}: MapAdvancedProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Layer[]>([]);
  const routeLayersRef = useRef<L.Layer[]>([]);
  const obstacleMarkersRef = useRef<L.Layer[]>([]);
  const eventMarkersRef = useRef<L.Layer[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [newObstacleIds, setNewObstacleIds] = useState<Set<number>>(new Set());
  const prevObstacleIdsRef = useRef<Set<number>>(new Set());
  
  const [activeRoutes, setActiveRoutes] = useState<AdvancedRoute[]>([]);
  const [showRouteLegend, setShowRouteLegend] = useState(true);

  // Fetch obstacles
  const fetchObstacles = useCallback(async () => {
    try {
      const res = await fetch(`${API_V1}/obstacles/obstacles?active_only=true&limit=50`);
      if (res.ok) {
        const data = await res.json();
        
        const currentIds = new Set<number>(data.map((o: Obstacle) => o.id));
        const newIds = new Set<number>();
        currentIds.forEach((id) => {
          if (!prevObstacleIdsRef.current.has(id)) {
            newIds.add(id);
          }
        });
        
        if (newIds.size > 0) {
          setNewObstacleIds(newIds);
          setTimeout(() => setNewObstacleIds(new Set()), 3000);
        }
        
        prevObstacleIdsRef.current = currentIds;
        setObstacles(data);
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
        setActiveRoutes(data.routes || []);
      }
    } catch (e) {
      // Silent fail
    }
  }, []);

  // Poll for data
  useEffect(() => {
    fetchObstacles();
    fetchAdvancedRoutes();
    const interval = setInterval(() => {
      fetchObstacles();
      fetchAdvancedRoutes();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchObstacles, fetchAdvancedRoutes]);

  // Use advanced routes if provided, otherwise use fetched ones
  const displayRoutes = advancedRoutes.length > 0 ? advancedRoutes : activeRoutes;

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [34.0, 76.0], // Centered on Ladakh/Kashmir
      zoom: 7,
      zoomControl: true,
      attributionControl: false
    });

    // Base layers - Using reliable tile providers
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    });

    const cartoDbDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '© CartoDB'
    }).addTo(map); // Dark mode as default

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: '© Esri'
    });

    const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: '© OpenTopoMap'
    });

    const baseMaps = {
      "🌙 Tactical Dark": cartoDbDark,
      "🗺️ Street Map": osmLayer,
      "🛰️ Satellite": satelliteLayer,
      "🏔️ Topographic": topoLayer
    };

    L.control.layers(baseMaps, undefined, { position: 'bottomright' }).addTo(map);

    mapRef.current = map;

    // Invalidate size after a short delay to ensure proper rendering
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    // Also invalidate on window resize
    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Render Advanced Routes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old route layers
    routeLayersRef.current.forEach(layer => layer.remove());
    routeLayersRef.current = [];

    // Render advanced routes
    displayRoutes.forEach(route => {
      if (!route.waypoints || route.waypoints.length < 2) return;

      const color = route.color || getRouteColor(route.category);
      const threatStyle = getThreatLevelStyle(route.threat_level);
      const isSelected = route.route_id === selectedRouteId;

      // Main route line
      const polyline = L.polyline(route.waypoints, {
        color: color,
        weight: isSelected ? threatStyle.weight + 2 : threatStyle.weight,
        opacity: isSelected ? 1 : threatStyle.opacity,
        dashArray: threatStyle.dashArray,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      // Glow effect for selected route
      if (isSelected) {
        const glow = L.polyline(route.waypoints, {
          color: color,
          weight: threatStyle.weight + 8,
          opacity: 0.3,
          lineCap: 'round'
        }).addTo(map);
        routeLayersRef.current.push(glow);
      }

      // Route popup
      polyline.bindPopup(`
        <div style="font-family: system-ui; min-width: 200px; background: #0f172a; color: white; border: 2px solid ${color}; padding: 12px; border-radius: 8px;">
          <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px; color: ${color};">
            ${route.name}
          </div>
          <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">
            📍 ${route.origin?.name || 'Origin'} → ${route.destination?.name || 'Destination'}
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px;">
            <div style="font-size: 10px;">
              <span style="color: #64748b;">Distance:</span><br/>
              <span style="color: #22c55e; font-weight: bold;">${route.distance_km?.toFixed(0) || '?'} km</span>
            </div>
            <div style="font-size: 10px;">
              <span style="color: #64748b;">Est. Time:</span><br/>
              <span style="color: #f59e0b; font-weight: bold;">${route.estimated_time_hours?.toFixed(1) || '?'} hrs</span>
            </div>
            <div style="font-size: 10px;">
              <span style="color: #64748b;">Category:</span><br/>
              <span style="color: ${color}; font-weight: bold;">${route.category}</span>
            </div>
            <div style="font-size: 10px;">
              <span style="color: #64748b;">Threat:</span><br/>
              <span style="color: ${color}; font-weight: bold;">${route.threat_level}</span>
            </div>
          </div>
          ${route.terrain_zones ? `
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #334155; font-size: 10px;">
              <span style="color: #64748b;">Terrain:</span>
              <span style="color: #94a3b8;">${route.terrain_zones.join(', ')}</span>
            </div>
          ` : ''}
        </div>
      `);

      polyline.on('click', () => {
        onRouteClick?.(route);
      });

      routeLayersRef.current.push(polyline);

      // Origin marker
      if (route.origin?.lat && route.origin?.lng) {
        const originIcon = L.divIcon({
          html: `<div style="
            width: 16px; height: 16px;
            background: ${color};
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 0 10px ${color};
          "></div>`,
          className: 'route-origin-marker',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });
        const originMarker = L.marker([route.origin.lat, route.origin.lng], { icon: originIcon }).addTo(map);
        originMarker.bindTooltip(route.origin.name, { permanent: false, direction: 'top' });
        routeLayersRef.current.push(originMarker);
      }

      // Destination marker
      if (route.destination?.lat && route.destination?.lng) {
        const destIcon = L.divIcon({
          html: `<div style="
            width: 20px; height: 20px;
            background: ${color};
            border: 3px solid white;
            border-radius: 4px;
            box-shadow: 0 0 10px ${color};
            transform: rotate(45deg);
          "></div>`,
          className: 'route-dest-marker',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });
        const destMarker = L.marker([route.destination.lat, route.destination.lng], { icon: destIcon }).addTo(map);
        destMarker.bindTooltip(route.destination.name, { permanent: false, direction: 'top' });
        routeLayersRef.current.push(destMarker);
      }
    });

    // Also render legacy routes
    routes.forEach(route => {
      if (!route.waypoints || route.waypoints.length < 2) return;

      let color = '#3b82f6';
      let opacity = 0.5;
      let dashArray = '5, 10';

      if (route.risk_level === 'HIGH') {
        color = '#ef4444';
        opacity = 0.8;
        dashArray = '';
      } else if (route.risk_level === 'MEDIUM') {
        color = '#f59e0b';
        opacity = 0.7;
      } else {
        color = '#10b981';
        opacity = 0.4;
      }

      const polyline = L.polyline(route.waypoints as [number, number][], {
        color: color,
        weight: 3,
        opacity: opacity,
        dashArray: dashArray,
        lineCap: 'round'
      }).addTo(map);

      polyline.bindPopup(`
        <div style="font-family: system-ui; min-width: 150px; background: #0f172a; color: white; border: 1px solid #334155; padding: 10px; border-radius: 6px;">
          <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px;">${route.name}</div>
          <div style="font-size: 11px; color: #94a3b8;">Risk: <span style="color:${color}; font-weight:bold">${route.risk_level}</span></div>
        </div>
      `);

      routeLayersRef.current.push(polyline);
    });

  }, [displayRoutes, routes, selectedRouteId, onRouteClick]);

  // Render Assets/Vehicles
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(layer => layer.remove());
    markersRef.current = [];

    assets.forEach(asset => {
      if (!asset.current_lat || !asset.current_long) return;

      const color = getVehicleColor(asset.status);
      const bearing = asset.bearing || 0;
      const isSelected = asset.id === selectedVehicleId;
      const size = isSelected ? 32 : 24;

      const iconHtml = `
        <div style="
          width: ${size}px; 
          height: ${size}px; 
          display: flex; 
          align-items: center; 
          justify-content: center;
          transform: rotate(${bearing}deg);
          ${isSelected ? `filter: drop-shadow(0 0 10px ${color});` : ''}
        ">
          <div style="
            width: 0; 
            height: 0; 
            border-left: ${size * 0.4}px solid transparent;
            border-right: ${size * 0.4}px solid transparent;
            border-bottom: ${size * 0.8}px solid ${color};
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
            position: relative;
          "></div>
          <div style="
            position: absolute;
            width: ${size * 0.2}px; 
            height: ${size * 0.2}px; 
            background: white; 
            border-radius: 50%;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
          "></div>
        </div>
      `;

      const icon = L.divIcon({
        html: iconHtml,
        className: `custom-vehicle-icon ${isSelected ? 'selected-vehicle' : ''}`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      });

      const marker = L.marker([asset.current_lat, asset.current_long], {
        icon: icon,
        zIndexOffset: isSelected ? 2000 : 500
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: system-ui; min-width: 180px; background: #0f172a; color: white; border: 2px solid ${color}; padding: 12px; border-radius: 8px;">
          <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px;">${asset.name}</div>
          <div style="color: #94a3b8; font-size: 11px;">${asset.asset_type}</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 8px; font-size: 10px;">
            <div><span style="color: #64748b;">Speed:</span> <span style="color: #22c55e;">${asset.speed_kmh?.toFixed(0) || 0} km/h</span></div>
            <div><span style="color: #64748b;">Heading:</span> <span style="color: #3b82f6;">${Math.round(bearing)}°</span></div>
          </div>
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #334155;">
            <span style="color: ${color}; font-weight: bold; font-size: 12px;">
              ● ${asset.status || (asset.is_available ? 'Available' : 'Busy')}
            </span>
          </div>
        </div>
      `);

      marker.on('click', () => {
        onVehicleClick?.(asset);
      });

      markersRef.current.push(marker);

      // Trail for moving vehicles
      if (asset.status === 'MOVING' && asset.speed_kmh && asset.speed_kmh > 0) {
        const trailLength = 0.01;
        const radBearing = (bearing - 180) * (Math.PI / 180);
        const trailEnd: [number, number] = [
          asset.current_lat + trailLength * Math.cos(radBearing),
          asset.current_long + trailLength * Math.sin(radBearing)
        ];
        
        const trail = L.polyline([
          [asset.current_lat, asset.current_long],
          trailEnd
        ], {
          color: color,
          weight: 3,
          opacity: 0.3,
          dashArray: '2, 4'
        }).addTo(map);
        
        markersRef.current.push(trail);
      }
    });

  }, [assets, selectedVehicleId, onVehicleClick]);

  // Render Obstacles
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    obstacleMarkersRef.current.forEach(layer => layer.remove());
    obstacleMarkersRef.current = [];

    obstacles.forEach(obstacle => {
      if (!obstacle.latitude || !obstacle.longitude || !obstacle.is_active) return;

      const color = getObstacleColor(obstacle.severity);
      const emoji = getObstacleEmoji(obstacle.obstacle_type);
      const isNew = newObstacleIds.has(obstacle.id);
      const size = obstacle.severity === 'CRITICAL' ? 48 : obstacle.severity === 'HIGH' ? 40 : 32;

      const iconHtml = `
        <div style="
          width: ${size}px; 
          height: ${size}px; 
          display: flex; 
          align-items: center; 
          justify-content: center;
          background: rgba(0, 0, 0, 0.7);
          border: 3px solid ${color};
          border-radius: 50%;
          box-shadow: 0 0 20px ${color}66;
          animation: pulse 1.5s infinite;
          ${isNew ? 'animation: appear 0.5s ease-out, pulse 1.5s infinite 0.5s;' : ''}
        ">
          <span style="font-size: ${size * 0.5}px;">${emoji}</span>
        </div>
        <style>
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }
          @keyframes appear {
            0% { transform: scale(0); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
        </style>
      `;

      const icon = L.divIcon({
        html: iconHtml,
        className: 'obstacle-marker',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      });

      const marker = L.marker([obstacle.latitude, obstacle.longitude], {
        icon: icon,
        zIndexOffset: 1000
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: system-ui; min-width: 220px; background: #0f172a; color: white; border: 2px solid ${color}; padding: 12px; border-radius: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="font-size: 24px;">${emoji}</span>
            <div>
              <div style="font-weight: bold; font-size: 14px;">${obstacle.obstacle_type.replace(/_/g, ' ')}</div>
              <div style="font-size: 10px; color: ${color}; font-weight: bold;">${obstacle.severity}</div>
            </div>
          </div>
          ${obstacle.description ? `<div style="font-size: 11px; color: #94a3b8;">${obstacle.description}</div>` : ''}
          <div style="margin-top: 10px; color: #ef4444; font-weight: bold; font-size: 11px;">🔴 ACTIVE THREAT</div>
        </div>
      `);

      obstacleMarkersRef.current.push(marker);

      // Danger zone circle
      if (obstacle.severity === 'CRITICAL' || obstacle.severity === 'HIGH') {
        const circle = L.circle([obstacle.latitude, obstacle.longitude], {
          color: color,
          fillColor: color,
          fillOpacity: 0.1,
          radius: obstacle.severity === 'CRITICAL' ? 3000 : 2000,
          weight: 2,
          dashArray: '5, 5'
        }).addTo(map);
        obstacleMarkersRef.current.push(circle);
      }
    });

  }, [obstacles, newObstacleIds]);

  // Render Scenario Events
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    eventMarkersRef.current.forEach(layer => layer.remove());
    eventMarkersRef.current = [];

    scenarioEvents.forEach(event => {
      if (!event.location || event.status !== 'ACTIVE') return;

      const color = getObstacleColor(event.severity);
      const emoji = getEventIcon(event.event_type, event.event_subtype);
      const size = event.severity === 'EMERGENCY' ? 56 : event.severity === 'CRITICAL' ? 48 : 40;

      const iconHtml = `
        <div style="
          width: ${size}px; 
          height: ${size}px; 
          display: flex; 
          align-items: center; 
          justify-content: center;
          background: linear-gradient(135deg, rgba(0,0,0,0.9) 0%, ${color}33 100%);
          border: 3px solid ${color};
          border-radius: 8px;
          box-shadow: 0 0 30px ${color};
          animation: event-pulse 2s infinite;
        ">
          <span style="font-size: ${size * 0.6}px;">${emoji}</span>
        </div>
        <style>
          @keyframes event-pulse {
            0%, 100% { box-shadow: 0 0 10px ${color}; }
            50% { box-shadow: 0 0 30px ${color}; }
          }
        </style>
      `;

      const icon = L.divIcon({
        html: iconHtml,
        className: 'scenario-event-marker',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      });

      const marker = L.marker([event.location[0], event.location[1]], {
        icon: icon,
        zIndexOffset: 1500
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: system-ui; min-width: 250px; background: #0f172a; color: white; border: 2px solid ${color}; padding: 12px; border-radius: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="font-size: 28px;">${emoji}</span>
            <div>
              <div style="font-weight: bold; font-size: 14px;">${event.title}</div>
              <div style="font-size: 10px; color: ${color}; font-weight: bold;">${event.severity} - ${event.event_type}</div>
            </div>
          </div>
          <div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">${event.description}</div>
          <div style="padding-top: 8px; border-top: 1px solid #334155; font-size: 10px; color: #64748b;">
            Radius: ${event.radius_meters}m | Status: ${event.status}
          </div>
        </div>
      `);

      eventMarkersRef.current.push(marker);

      // Event radius circle
      if (event.radius_meters) {
        const circle = L.circle([event.location[0], event.location[1]], {
          color: color,
          fillColor: color,
          fillOpacity: 0.15,
          radius: event.radius_meters,
          weight: 2
        }).addTo(map);
        eventMarkersRef.current.push(circle);
      }
    });

  }, [scenarioEvents]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          background: '#020617'
        }}
      />

      {/* Route Legend */}
      {showRouteLegend && displayRoutes.length > 0 && (
        <div style={{
          position: 'absolute',
          top: 10,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.85)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 8,
          padding: '8px 16px',
          zIndex: 1000,
          display: 'flex',
          gap: 16,
          alignItems: 'center'
        }}>
          <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>ROUTES:</span>
          {displayRoutes.slice(0, 6).map(route => (
            <div 
              key={route.route_id} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 4,
                cursor: 'pointer',
                opacity: selectedRouteId === route.route_id ? 1 : 0.7
              }}
              onClick={() => onRouteClick?.(route)}
            >
              <div style={{ 
                width: 12, 
                height: 12, 
                background: route.color || getRouteColor(route.category),
                borderRadius: 2
              }} />
              <span style={{ color: 'white', fontSize: 10 }}>{route.name}</span>
            </div>
          ))}
          <button
            onClick={() => setShowRouteLegend(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Stats Overlay */}
      <div style={{
        position: 'absolute',
        bottom: 90,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.8)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 4,
        padding: '4px 12px',
        zIndex: 1000,
        display: 'flex',
        gap: 16,
        fontSize: 10
      }}>
        <span style={{ color: '#22c55e' }}>🚛 {assets.length} Vehicles</span>
        <span style={{ color: '#3b82f6' }}>🗺️ {displayRoutes.length} Routes</span>
        <span style={{ color: '#ef4444' }}>⚠️ {obstacles.filter(o => o.is_active).length} Threats</span>
        <span style={{ color: '#f97316' }}>📋 {scenarioEvents.length} Events</span>
      </div>
    </div>
  );
}
