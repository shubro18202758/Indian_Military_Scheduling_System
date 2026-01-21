'use client';

import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import L from 'leaflet';

// Fix for Leaflet marker icons in Next.js
const iconUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png';
const iconRetinaUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png';

const defaultIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});

interface Asset {
  id: number;
  name: string;
  asset_type: string;
  current_lat?: number;
  current_long?: number;
  is_available: boolean;
}

interface Route {
  id: number;
  name: string;
  waypoints: number[][]; // [[lat, long], [lat, long]]
  risk_level: string;
  status: string;
}

interface MapProps {
  assets: Asset[];
  routes?: Route[];
}

const MapComponent = ({ assets, routes = [] }: MapProps) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <div className="h-full w-full bg-gray-100 flex items-center justify-center">Loading Map...</div>;
  }

  const getRouteColor = (risk: string) => {
    switch (risk) {
      case 'HIGH': return 'red';
      case 'MEDIUM': return 'orange';
      case 'LOW': return 'green';
      default: return 'blue';
    }
  };

  return (
    <MapContainer center={[32.7266, 74.8570]} zoom={8} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Render Routes */}
      {routes.map((route) => (
        <Polyline
          key={`route-${route.id}`}
          positions={route.waypoints as [number, number][]}
          pathOptions={{ color: getRouteColor(route.risk_level), weight: 5, opacity: 0.7 }}
        >
          <Popup>
            <div className="font-bold">{route.name}</div>
            <div className="text-xs">Risk: {route.risk_level}</div>
            <div className="text-xs">Status: {route.status}</div>
          </Popup>
        </Polyline>
      ))}

      {/* Render Assets */}
      {assets.map((asset) => (
        asset.current_lat && asset.current_long && (
          <Marker
            key={`asset-${asset.id}`}
            position={[asset.current_lat, asset.current_long]}
            icon={defaultIcon}
          >
            <Popup>
              <div className="p-1">
                <h3 className="font-bold">{asset.name}</h3>
                <p className="text-sm text-gray-600">{asset.asset_type}</p>
                <div className={`text-xs mt-1 ${asset.is_available ? 'text-green-600' : 'text-red-600'}`}>
                  {asset.is_available ? 'Available' : 'Busy'}
                </div>
              </div>
            </Popup>
          </Marker>
        )
      ))}
    </MapContainer>
  );
};

export default MapComponent;
