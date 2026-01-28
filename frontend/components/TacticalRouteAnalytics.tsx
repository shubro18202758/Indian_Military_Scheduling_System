'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

const API_V1 = '/api/proxy/v1';

// ============================================================================
// INTERFACES
// ============================================================================

interface RouteData {
  route_id: string;
  name: string;
  category: string;
  origin?: { name: string; lat: number; lng: number };
  destination?: { name: string; lat: number; lng: number };
  waypoints?: Array<{ name: string; lat: number; lng: number; type: string }>;
  distance_km: number;
  estimated_time_hours: number;
  threat_level: string;
  terrain_types?: string[];
  checkpoints?: Array<{ name: string; lat: number; lng: number; type: string }>;
}

interface RouteSegment {
  id: string;
  name: string;
  distance_km: number;
  terrain: string;
  threat_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  speed_limit_kmh: number;
  estimated_time_min: number;
  conditions: {
    road_quality: number;
    visibility: number;
    weather: string;
  };
  hazards: string[];
}

interface TCPPoint {
  id: string;
  name: string;
  type: 'CHECKPOINT' | 'REFUEL' | 'REST' | 'MEDICAL' | 'COMMAND' | 'RESUPPLY' | 'COMMS';
  location: { lat: number; lng: number };
  distance_from_start_km: number;
  status: 'ACTIVE' | 'STANDBY' | 'ALERT' | 'OFFLINE';
  facilities: string[];
  capacity: number;
  current_occupancy?: number;
}

interface AIRouteAnalysis {
  overallRisk: number;
  efficiency: number;
  optimalSpeed: number;
  estimatedFuel: number;
  threatZones: Array<{ start_km: number; end_km: number; threat: string }>;
  recommendations: string[];
  alternativeRoutes?: Array<{ name: string; distance: number; risk: string }>;
  weatherImpact: string;
  terrainChallenges: string[];
  tacticalAdvice: string;
}

// Enhanced real-time metrics for military operations
interface LiveRouteMetrics {
  // Convoy progress on this route
  activeConvoys: number;
  vehiclesOnRoute: number;
  leadVehicleProgress: number;  // percentage
  convoySpacing: number;        // average meters
  convoySpeed: number;          // average km/h
  
  // Real-time environment
  currentVisibility: number;    // meters
  currentWindSpeed: number;     // m/s
  currentTemp: number;          // celsius
  precipitation: number;        // mm/hr
  roadCondition: 'DRY' | 'WET' | 'ICY' | 'MUDDY' | 'SNOW';
  
  // Threat status
  activeThreats: number;
  threatAlerts: Array<{
    type: string;
    location_km: number;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description: string;
    timestamp: string;
  }>;
  
  // Support assets
  qrfDistance: number;          // km
  artillerySupport: boolean;
  airCover: boolean;
  medEvacAvailable: boolean;
  
  // Logistics
  fuelPointsActive: number;
  restStopsOperational: number;
  communicationsCoverage: number;  // percentage
  
  // AI predictions
  etaMinutes: number;
  fuelConsumptionEstimate: number;
  breakdownRisk: number;
  ambushProbability: number;
}

interface TacticalRouteAnalyticsProps {
  route: RouteData | null;
  onClose?: () => void;
  isSimulationRunning?: boolean;  // Controls whether metrics update
}

// ============================================================================
// MILITARY THEME CONSTANTS
// ============================================================================

const MILITARY_COLORS = {
  primary: '#1a472a',
  secondary: '#2d5016',
  accent: '#c4a35a',
  alert: '#8b0000',
  warning: '#cd7f32',
  success: '#228b22',
  info: '#4682b4',
  text: '#f5f5dc',
  muted: '#808080',
  background: '#0d1b0d',
  panel: 'rgba(26, 71, 42, 0.85)',
  border: 'rgba(196, 163, 90, 0.4)',
  glow: 'rgba(196, 163, 90, 0.3)',
};

const THREAT_COLORS = {
  LOW: '#228b22',
  MEDIUM: '#4682b4',
  HIGH: '#cd7f32',
  CRITICAL: '#8b0000'
};

// ============================================================================
// DYNAMIC AI RECOMMENDATION ENGINE
// Generates real-time, context-aware recommendations based on all available data
// ============================================================================

interface DynamicRecommendation {
  id: string;
  text: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  category: 'THREAT' | 'WEATHER' | 'LOGISTICS' | 'CONVOY' | 'TACTICAL' | 'SUPPORT' | 'COMMS' | 'TERRAIN';
  source: string;
  timestamp: string;
  confidence: number;
  actionable: boolean;
  expiresIn?: number; // seconds until recommendation should be refreshed
}

const generateDynamicRecommendations = (
  analysis: AIRouteAnalysis | null,
  liveMetrics: LiveRouteMetrics | null,
  segments: RouteSegment[],
  route: RouteData | null
): DynamicRecommendation[] => {
  const recommendations: DynamicRecommendation[] = [];
  const now = new Date().toISOString();
  
  // Allow generation even with partial data
  if (!route) return recommendations;
  
  const riskLevel = analysis?.overallRisk ?? 10;
  const efficiency = analysis?.efficiency ?? 92;
  
  // ===== ALWAYS ADD ROUTE STATUS =====
  recommendations.push({
    id: `route-status-${Date.now()}`,
    text: `Route ${route.name}: ${route.distance_km?.toFixed(0) || 'N/A'}km, Est. ${route.estimated_time_hours?.toFixed(1) || 'N/A'}h. Threat level: ${route.threat_level || 'LOW'}. Current efficiency: ${efficiency}%.`,
    priority: 'INFO',
    category: 'TACTICAL',
    source: 'ROUTE_ANALYZER',
    timestamp: now,
    confidence: 100,
    actionable: false,
    expiresIn: 60
  });

  // ===== THREAT-BASED RECOMMENDATIONS =====
  if (liveMetrics?.activeThreats && liveMetrics.activeThreats > 0) {
    recommendations.push({
      id: `threat-active-${Date.now()}`,
      text: `${liveMetrics.activeThreats} ACTIVE THREAT${liveMetrics.activeThreats > 1 ? 'S' : ''} DETECTED - Immediate tactical response required. Increase convoy spacing to 200m minimum.`,
      priority: liveMetrics.activeThreats >= 3 ? 'CRITICAL' : 'HIGH',
      category: 'THREAT',
      source: 'TACTICAL_AI_ENGINE',
      timestamp: now,
      confidence: 95,
      actionable: true,
      expiresIn: 30
    });
    
    // Specific threat alerts
    liveMetrics.threatAlerts?.forEach((alert, idx) => {
      if (idx < 3) { // Limit to top 3 threats
        recommendations.push({
          id: `threat-alert-${idx}-${Date.now()}`,
          text: `${alert.type.toUpperCase()} at km ${alert.location_km.toFixed(1)}: ${alert.description}. ${
            alert.severity === 'CRITICAL' ? 'HALT convoy and request support.' :
            alert.severity === 'HIGH' ? 'Reduce speed and increase vigilance.' :
            'Monitor situation closely.'
          }`,
          priority: alert.severity,
          category: 'THREAT',
          source: 'THREAT_DETECTION_SYSTEM',
          timestamp: alert.timestamp,
          confidence: 88,
          actionable: true,
          expiresIn: 60
        });
      }
    });
  }
  
  if (liveMetrics?.ambushProbability && liveMetrics.ambushProbability > 0.15) {
    const prob = Math.round(liveMetrics.ambushProbability * 100);
    recommendations.push({
      id: `ambush-risk-${Date.now()}`,
      text: `AMBUSH PROBABILITY ${prob}% - Deploy scout vehicle 500m ahead. Prepare smoke countermeasures. Consider alternate route.`,
      priority: prob > 40 ? 'CRITICAL' : 'HIGH',
      category: 'TACTICAL',
      source: 'PREDICTIVE_THREAT_MODEL',
      timestamp: now,
      confidence: 75 + (prob / 4),
      actionable: true,
      expiresIn: 45
    });
  }
  
  // ===== WEATHER-BASED RECOMMENDATIONS =====
  if (liveMetrics?.currentVisibility && liveMetrics.currentVisibility < 1000) {
    recommendations.push({
      id: `visibility-low-${Date.now()}`,
      text: `VISIBILITY ${liveMetrics.currentVisibility}m - Activate convoy lights, reduce speed to ${Math.max(20, (liveMetrics.convoySpeed || 40) * 0.6).toFixed(0)} km/h. Increase spacing to ${Math.round((liveMetrics.convoySpacing || 100) * 1.5)}m.`,
      priority: liveMetrics.currentVisibility < 300 ? 'CRITICAL' : 'HIGH',
      category: 'WEATHER',
      source: 'ENVIRONMENTAL_SENSOR',
      timestamp: now,
      confidence: 92,
      actionable: true,
      expiresIn: 120
    });
  } else if (liveMetrics?.currentVisibility && liveMetrics.currentVisibility < 3000) {
    recommendations.push({
      id: `visibility-reduced-${Date.now()}`,
      text: `Reduced visibility at ${liveMetrics.currentVisibility}m - Maintain headlights, standard caution protocols active.`,
      priority: 'MEDIUM',
      category: 'WEATHER',
      source: 'ENVIRONMENTAL_SENSOR',
      timestamp: now,
      confidence: 88,
      actionable: false,
      expiresIn: 180
    });
  }
  
  if (liveMetrics?.precipitation && liveMetrics.precipitation > 10) {
    recommendations.push({
      id: `precipitation-${Date.now()}`,
      text: `HEAVY PRECIPITATION ${liveMetrics.precipitation.toFixed(1)}mm/hr - Road surface ${liveMetrics.roadCondition}. Reduce speed by ${liveMetrics.precipitation > 20 ? '40' : '25'}%. Check drainage at low points.`,
      priority: liveMetrics.precipitation > 25 ? 'HIGH' : 'MEDIUM',
      category: 'WEATHER',
      source: 'WEATHER_STATION',
      timestamp: now,
      confidence: 90,
      actionable: true,
      expiresIn: 300
    });
  }
  
  if (liveMetrics?.roadCondition === 'ICY' || liveMetrics?.roadCondition === 'SNOW') {
    recommendations.push({
      id: `road-ice-${Date.now()}`,
      text: `${liveMetrics.roadCondition} ROAD CONDITIONS - Engage low gear, maximum braking distance required. Check snow chains status. Speed limit: 25 km/h max.`,
      priority: 'CRITICAL',
      category: 'TERRAIN',
      source: 'ROAD_CONDITION_MONITOR',
      timestamp: now,
      confidence: 95,
      actionable: true,
      expiresIn: 600
    });
  }
  
  if (liveMetrics?.currentTemp && liveMetrics.currentTemp < -10) {
    recommendations.push({
      id: `cold-ops-${Date.now()}`,
      text: `EXTREME COLD ${liveMetrics.currentTemp}°C - Monitor engine pre-heat, check fuel line anti-freeze. Rotate crew every 2 hours.`,
      priority: 'HIGH',
      category: 'WEATHER',
      source: 'SIACHEN_OPS_PROTOCOL',
      timestamp: now,
      confidence: 92,
      actionable: true,
      expiresIn: 1800
    });
  } else if (liveMetrics?.currentTemp && liveMetrics.currentTemp > 45) {
    recommendations.push({
      id: `heat-ops-${Date.now()}`,
      text: `EXTREME HEAT ${liveMetrics.currentTemp}°C - Monitor engine cooling, mandatory hydration breaks every 45 minutes. Check tire pressures.`,
      priority: 'HIGH',
      category: 'WEATHER',
      source: 'DESERT_OPS_PROTOCOL',
      timestamp: now,
      confidence: 90,
      actionable: true,
      expiresIn: 1800
    });
  }
  
  // ===== CONVOY FORMATION RECOMMENDATIONS =====
  if (liveMetrics?.convoySpacing) {
    const optimalSpacing = analysis.overallRisk > 50 ? 150 : analysis.overallRisk > 25 ? 100 : 75;
    if (Math.abs(liveMetrics.convoySpacing - optimalSpacing) > 30) {
      recommendations.push({
        id: `spacing-adjust-${Date.now()}`,
        text: `Convoy spacing ${liveMetrics.convoySpacing}m - ${
          liveMetrics.convoySpacing < optimalSpacing 
            ? `INCREASE to ${optimalSpacing}m for current threat level` 
            : `Reduce to ${optimalSpacing}m for better formation integrity`
        }.`,
        priority: liveMetrics.convoySpacing < optimalSpacing ? 'HIGH' : 'MEDIUM',
        category: 'CONVOY',
        source: 'FORMATION_OPTIMIZER',
        timestamp: now,
        confidence: 85,
        actionable: true,
        expiresIn: 60
      });
    }
  }
  
  if (liveMetrics?.activeConvoys === 0 && liveMetrics?.vehiclesOnRoute === 0) {
    recommendations.push({
      id: `no-convoy-${Date.now()}`,
      text: `No active convoy on this route. Route clear for deployment. ETA for convoy dispatch: Awaiting orders.`,
      priority: 'INFO',
      category: 'CONVOY',
      source: 'CONVOY_MANAGER',
      timestamp: now,
      confidence: 100,
      actionable: false,
      expiresIn: 300
    });
  } else if (liveMetrics?.vehiclesOnRoute) {
    recommendations.push({
      id: `convoy-status-${Date.now()}`,
      text: `${liveMetrics.activeConvoys} convoy(s) with ${liveMetrics.vehiclesOnRoute} vehicles active. Lead vehicle at ${liveMetrics.leadVehicleProgress?.toFixed(0) || 0}% route progress. Avg speed: ${liveMetrics.convoySpeed?.toFixed(0) || 0} km/h.`,
      priority: 'INFO',
      category: 'CONVOY',
      source: 'CONVOY_TRACKER',
      timestamp: now,
      confidence: 95,
      actionable: false,
      expiresIn: 30
    });
  }
  
  // ===== SUPPORT ASSET RECOMMENDATIONS =====
  if (liveMetrics?.qrfDistance && liveMetrics.qrfDistance > 50) {
    recommendations.push({
      id: `qrf-distance-${Date.now()}`,
      text: `QRF at ${liveMetrics.qrfDistance.toFixed(0)}km - Response time ${Math.round(liveMetrics.qrfDistance / 60 * 60)} minutes. Consider requesting closer staging for high-risk sectors.`,
      priority: liveMetrics.qrfDistance > 80 ? 'HIGH' : 'MEDIUM',
      category: 'SUPPORT',
      source: 'QRF_COORDINATOR',
      timestamp: now,
      confidence: 90,
      actionable: true,
      expiresIn: 600
    });
  } else if (liveMetrics?.qrfDistance) {
    recommendations.push({
      id: `qrf-ready-${Date.now()}`,
      text: `QRF positioned at ${liveMetrics.qrfDistance.toFixed(0)}km - Response time ${Math.round(liveMetrics.qrfDistance / 60 * 60)} minutes. Support assets in optimal range.`,
      priority: 'INFO',
      category: 'SUPPORT',
      source: 'QRF_COORDINATOR',
      timestamp: now,
      confidence: 95,
      actionable: false,
      expiresIn: 300
    });
  }
  
  if (liveMetrics && !liveMetrics.airCover && riskLevel > 40) {
    recommendations.push({
      id: `no-aircover-${Date.now()}`,
      text: `NO AIR COVER available for high-risk route. Request rotary wing support or UAV overwatch for enhanced threat detection.`,
      priority: 'HIGH',
      category: 'SUPPORT',
      source: 'AIR_SUPPORT_COORDINATOR',
      timestamp: now,
      confidence: 88,
      actionable: true,
      expiresIn: 900
    });
  }
  
  if (liveMetrics && !liveMetrics.medEvacAvailable) {
    recommendations.push({
      id: `no-medevac-${Date.now()}`,
      text: `MEDEVAC UNAVAILABLE - Ensure ground casualty evacuation plan is in place. Notify medical team of convoy movement.`,
      priority: 'CRITICAL',
      category: 'SUPPORT',
      source: 'MEDICAL_COORDINATOR',
      timestamp: now,
      confidence: 100,
      actionable: true,
      expiresIn: 600
    });
  } else if (liveMetrics?.medEvacAvailable) {
    recommendations.push({
      id: `medevac-ready-${Date.now()}`,
      text: `MEDEVAC on standby. Medical evacuation assets available for immediate deployment if required.`,
      priority: 'INFO',
      category: 'SUPPORT',
      source: 'MEDICAL_COORDINATOR',
      timestamp: now,
      confidence: 100,
      actionable: false,
      expiresIn: 300
    });
  }
  
  // ===== COMMUNICATIONS RECOMMENDATIONS =====
  if (liveMetrics?.communicationsCoverage && liveMetrics.communicationsCoverage < 70) {
    recommendations.push({
      id: `comms-degraded-${Date.now()}`,
      text: `COMMS COVERAGE ${liveMetrics.communicationsCoverage}% - Switch to HF backup, establish relay points at ${Math.round(route.distance_km / 4)}km intervals. Report position every 10 minutes.`,
      priority: liveMetrics.communicationsCoverage < 40 ? 'CRITICAL' : 'HIGH',
      category: 'COMMS',
      source: 'SIGNALS_UNIT',
      timestamp: now,
      confidence: 92,
      actionable: true,
      expiresIn: 180
    });
  } else if (liveMetrics?.communicationsCoverage && liveMetrics.communicationsCoverage >= 70) {
    recommendations.push({
      id: `comms-good-${Date.now()}`,
      text: `Communications coverage ${liveMetrics.communicationsCoverage}% - Signal strength optimal. Standard reporting intervals apply.`,
      priority: 'INFO',
      category: 'COMMS',
      source: 'SIGNALS_UNIT',
      timestamp: now,
      confidence: 95,
      actionable: false,
      expiresIn: 300
    });
  }
  
  // ===== LOGISTICS RECOMMENDATIONS =====
  if (liveMetrics?.fuelPointsActive === 0 && route.distance_km && route.distance_km > 80) {
    recommendations.push({
      id: `no-fuel-${Date.now()}`,
      text: `NO FUEL POINTS ACTIVE on ${route.distance_km.toFixed(0)}km route. Ensure all vehicles have minimum 150% fuel capacity. Identify emergency fuel cache locations.`,
      priority: 'HIGH',
      category: 'LOGISTICS',
      source: 'LOGISTICS_PLANNER',
      timestamp: now,
      confidence: 95,
      actionable: true,
      expiresIn: 1800
    });
  } else if (liveMetrics?.fuelPointsActive && liveMetrics.fuelPointsActive > 0) {
    recommendations.push({
      id: `fuel-available-${Date.now()}`,
      text: `${liveMetrics.fuelPointsActive} fuel point(s) active along route. Estimated fuel consumption: ${liveMetrics.fuelConsumptionEstimate || 0} liters.`,
      priority: 'INFO',
      category: 'LOGISTICS',
      source: 'LOGISTICS_PLANNER',
      timestamp: now,
      confidence: 90,
      actionable: false,
      expiresIn: 600
    });
  }
  
  if (liveMetrics?.fuelConsumptionEstimate && route.distance_km) {
    const fuelEfficiency = route.distance_km / liveMetrics.fuelConsumptionEstimate;
    if (fuelEfficiency < 2.5) {
      recommendations.push({
        id: `fuel-efficiency-${Date.now()}`,
        text: `Low fuel efficiency ${fuelEfficiency.toFixed(1)} km/L detected - Check tire pressures, reduce idle time, optimize convoy speed to 40-50 km/h.`,
        priority: 'MEDIUM',
        category: 'LOGISTICS',
        source: 'FUEL_OPTIMIZER',
        timestamp: now,
        confidence: 80,
        actionable: true,
        expiresIn: 600
      });
    }
  }
  
  if (liveMetrics?.restStopsOperational === 0 && route.estimated_time_hours > 3) {
    recommendations.push({
      id: `no-rest-${Date.now()}`,
      text: `NO REST STOPS for ${route.estimated_time_hours.toFixed(1)}hr journey. Plan mandatory 15-min breaks every 2 hours. Designate safe harbor locations.`,
      priority: 'MEDIUM',
      category: 'LOGISTICS',
      source: 'CREW_WELFARE',
      timestamp: now,
      confidence: 90,
      actionable: true,
      expiresIn: 3600
    });
  }
  
  // ===== TERRAIN-BASED RECOMMENDATIONS =====
  const highThreatSegments = segments.filter(s => s.threat_level === 'HIGH' || s.threat_level === 'CRITICAL');
  if (highThreatSegments.length > 0) {
    highThreatSegments.forEach((seg, idx) => {
      if (idx < 2) { // Limit to top 2
        recommendations.push({
          id: `segment-threat-${seg.id}-${Date.now()}`,
          text: `SEG ${seg.name}: ${seg.threat_level} THREAT - ${seg.terrain} terrain, ${seg.distance_km.toFixed(1)}km. Max speed ${seg.speed_limit_kmh} km/h. ${seg.hazards.join(', ') || 'Standard caution'}.`,
          priority: seg.threat_level === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
          category: 'TERRAIN',
          source: 'ROUTE_INTEL',
          timestamp: now,
          confidence: 88,
          actionable: true,
          expiresIn: 120
        });
      }
    });
  } else if (segments.length > 0) {
    // Show segment overview even for low-threat routes
    recommendations.push({
      id: `segments-clear-${Date.now()}`,
      text: `${segments.length} route segments analyzed. All segments report LOW threat level. Standard convoy protocols apply.`,
      priority: 'INFO',
      category: 'TERRAIN',
      source: 'ROUTE_INTEL',
      timestamp: now,
      confidence: 95,
      actionable: false,
      expiresIn: 180
    });
  }
  
  // ===== TACTICAL ADVICE BASED ON OVERALL RISK =====
  if (riskLevel > 60) {
    recommendations.push({
      id: `risk-critical-${Date.now()}`,
      text: `ROUTE RISK CRITICAL (${riskLevel}%) - Consider alternative routing or request enhanced escort. Current efficiency ${efficiency}%. Recommended: ROUTE ALPHA (Northern) with lower threat profile.`,
      priority: 'CRITICAL',
      category: 'TACTICAL',
      source: 'MISSION_PLANNER',
      timestamp: now,
      confidence: 92,
      actionable: true,
      expiresIn: 60
    });
  } else if (riskLevel > 35) {
    recommendations.push({
      id: `risk-elevated-${Date.now()}`,
      text: `ELEVATED RISK (${riskLevel}%) - Enhanced vigilance protocols. Route efficiency ${efficiency}%. Optimal convoy speed: ${analysis?.optimalSpeed || 40} km/h.`,
      priority: 'HIGH',
      category: 'TACTICAL',
      source: 'MISSION_PLANNER',
      timestamp: now,
      confidence: 88,
      actionable: true,
      expiresIn: 120
    });
  } else {
    recommendations.push({
      id: `risk-standard-${Date.now()}`,
      text: `Route logistics: ${route.distance_km?.toFixed(0) || 'N/A'}km | Fuel stops: ${liveMetrics?.fuelPointsActive || 0} | Rest halts: ${liveMetrics?.restStopsOperational || 0}`,
      priority: 'INFO',
      category: 'LOGISTICS',
      source: 'ROUTE_SUMMARY',
      timestamp: now,
      confidence: 100,
      actionable: false,
      expiresIn: 300
    });
  }
  
  // ===== ZONE-SPECIFIC RECOMMENDATIONS =====
  const routeName = route.name?.toUpperCase() || '';
  if (routeName.includes('KASHMIR') || routeName.includes('SRINAGAR') || routeName.includes('JAMMU')) {
    recommendations.push({
      id: `zone-kashmir-${Date.now()}`,
      text: `${routeName} corridor: Follow established SOPs for this AOR. Report any anomalies immediately.`,
      priority: 'INFO',
      category: 'TACTICAL',
      source: 'ZONE_INTEL',
      timestamp: now,
      confidence: 100,
      actionable: false,
      expiresIn: 3600
    });
  } else if (routeName.includes('LADAKH') || routeName.includes('LEH')) {
    recommendations.push({
      id: `zone-ladakh-${Date.now()}`,
      text: `High altitude operations: Monitor oxygen levels, maintain engine warm-up protocols. Altitude acclimatization mandatory.`,
      priority: 'MEDIUM',
      category: 'TACTICAL',
      source: 'HIGH_ALT_OPS',
      timestamp: now,
      confidence: 95,
      actionable: true,
      expiresIn: 3600
    });
  } else if (routeName.includes('SIACHEN')) {
    recommendations.push({
      id: `zone-siachen-${Date.now()}`,
      text: `GLACIER OPS: Extreme cold protocols active. Mandatory thermal gear check. Movement windows per weather briefing only.`,
      priority: 'HIGH',
      category: 'TACTICAL',
      source: 'GLACIER_OPS_HQ',
      timestamp: now,
      confidence: 98,
      actionable: true,
      expiresIn: 1800
    });
  }
  
  // Sort by priority
  const priorityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3, 'INFO': 4 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  
  return recommendations;
};

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

const RouteProgressBar: React.FC<{
  segments: RouteSegment[];
  totalDistance: number;
}> = ({ segments, totalDistance }) => {
  return (
    <div className="relative">
      <div className="flex h-6 rounded overflow-hidden" style={{ background: 'rgba(0,0,0,0.5)' }}>
        {segments.map((seg, i) => {
          const width = (seg.distance_km / totalDistance) * 100;
          return (
            <div
              key={seg.id}
              className="relative group cursor-pointer transition-all hover:brightness-125"
              style={{
                width: `${width}%`,
                background: THREAT_COLORS[seg.threat_level],
                borderRight: i < segments.length - 1 ? '1px solid rgba(0,0,0,0.5)' : 'none'
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white/80">
                {seg.name}
              </div>
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                <div className="bg-black/90 text-white text-xs p-2 rounded whitespace-nowrap" style={{ border: `1px solid ${MILITARY_COLORS.accent}` }}>
                  <div className="font-bold">{seg.name}</div>
                  <div className="text-gray-400">{seg.distance_km.toFixed(1)} km • {seg.terrain}</div>
                  <div style={{ color: THREAT_COLORS[seg.threat_level] }}>Threat: {seg.threat_level}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {/* Distance markers */}
      <div className="flex justify-between mt-1 text-[9px]" style={{ color: MILITARY_COLORS.muted }}>
        <span>0 km</span>
        <span>{(totalDistance / 2).toFixed(0)} km</span>
        <span>{totalDistance.toFixed(0)} km</span>
      </div>
    </div>
  );
};

const TCPMarker: React.FC<{ tcp: TCPPoint }> = ({ tcp }) => {
  const typeIcons: Record<string, string> = {
    CHECKPOINT: '🛡️',
    REFUEL: '⛽',
    REST: '🏕️',
    MEDICAL: '🏥',
    COMMAND: '🎖️',
    RESUPPLY: '📦',
    COMMS: '📡'
  };
  
  const statusColors = {
    ACTIVE: MILITARY_COLORS.success,
    STANDBY: MILITARY_COLORS.warning,
    ALERT: MILITARY_COLORS.alert,
    OFFLINE: MILITARY_COLORS.muted
  };
  
  return (
    <div 
      className="flex items-center gap-3 p-3 rounded-lg border transition-all hover:scale-[1.02]"
      style={{
        background: 'rgba(0,0,0,0.4)',
        borderColor: statusColors[tcp.status],
        borderWidth: '1px 1px 1px 4px'
      }}
    >
      <div className="text-2xl">{typeIcons[tcp.type]}</div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm" style={{ color: MILITARY_COLORS.text }}>{tcp.name}</span>
          <span 
            className="text-[9px] px-1.5 py-0.5 rounded uppercase"
            style={{ background: statusColors[tcp.status] + '30', color: statusColors[tcp.status] }}
          >
            {tcp.status}
          </span>
        </div>
        <div className="text-[10px] mt-1" style={{ color: MILITARY_COLORS.muted }}>
          {tcp.distance_from_start_km.toFixed(1)} km from start • {tcp.type}
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {tcp.facilities.map((f, i) => (
            <span key={i} className="text-[8px] px-1 py-0.5 rounded" style={{ background: MILITARY_COLORS.info + '30', color: MILITARY_COLORS.info }}>
              {f}
            </span>
          ))}
        </div>
      </div>
      {tcp.capacity && (
        <div className="text-center">
          <div className="text-sm font-mono" style={{ color: MILITARY_COLORS.accent }}>{tcp.current_occupancy || 0}/{tcp.capacity}</div>
          <div className="text-[8px]" style={{ color: MILITARY_COLORS.muted }}>CAPACITY</div>
        </div>
      )}
    </div>
  );
};

const ThreatZoneIndicator: React.FC<{
  zone: { start_km: number; end_km: number; threat: string };
  totalDistance: number;
}> = ({ zone, totalDistance }) => {
  const startPercent = (zone.start_km / totalDistance) * 100;
  const widthPercent = ((zone.end_km - zone.start_km) / totalDistance) * 100;
  
  return (
    <div
      className="absolute h-full animate-pulse"
      style={{
        left: `${startPercent}%`,
        width: `${widthPercent}%`,
        background: `repeating-linear-gradient(45deg, ${MILITARY_COLORS.alert}30, ${MILITARY_COLORS.alert}30 10px, transparent 10px, transparent 20px)`,
        borderLeft: `2px solid ${MILITARY_COLORS.alert}`,
        borderRight: `2px solid ${MILITARY_COLORS.alert}`
      }}
      title={zone.threat}
    />
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TacticalRouteAnalytics({ route, onClose, isSimulationRunning = true }: TacticalRouteAnalyticsProps) {
  const [segments, setSegments] = useState<RouteSegment[]>([]);
  const [tcps, setTcps] = useState<TCPPoint[]>([]);
  const [analysis, setAnalysis] = useState<AIRouteAnalysis | null>(null);
  const [liveMetrics, setLiveMetrics] = useState<LiveRouteMetrics | null>(null);
  const [dynamicRecommendations, setDynamicRecommendations] = useState<DynamicRecommendation[]>([]);
  const [janusAnalysis, setJanusAnalysis] = useState<{
    analysis_type: string;
    generated_by: string;
    gpu_accelerated: boolean;
    route_name: string;
    recommendations: Array<{ text: string; priority: string; source: string }>;
    timestamp: string;
    note?: string;
    threatScore?: number;
    tacticalContext?: string;
    zoneAdvice?: string;
  } | null>(null);
  const [janusLoading, setJanusLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedSegment, setSelectedSegment] = useState<RouteSegment | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [updateCount, setUpdateCount] = useState(0);
  const [frameTime, setFrameTime] = useState(0);
  
  // Refs for stability - refs don't cause re-renders
  const lastJanusCall = useRef<number>(0);
  const fetchInProgress = useRef<boolean>(false);
  const isInitializedRef = useRef<boolean>(false);
  const currentRouteId = useRef<string>('');
  
  // History for oscilloscope displays
  const [history, setHistory] = useState<{
    speed: number[];
    visibility: number[];
    threat: number[];
    convoy: number[];
  }>({ speed: [], visibility: [], threat: [], convoy: [] });
  
  // Fetch Janus AI route analysis
  const fetchJanusRouteAnalysis = useCallback(async (routeData: RouteData, activeThreats: number) => {
    const now = Date.now();
    if (now - lastJanusCall.current < 15000) return; // Only call every 15 seconds
    lastJanusCall.current = now;
    
    setJanusLoading(true);
    try {
      const response = await fetch(`${API_V1}/advanced/ai/analyze-route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          route_id: parseInt(routeData.route_id) || 1,
          active_threats: Array(Math.min(activeThreats, 5)).fill({
            type: 'UNKNOWN',
            severity: 'MEDIUM'
          }),
          weather_status: 'CLEAR',
          visibility_km: 10.0
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Compute threat score based on recommendations
        const criticalCount = data.recommendations?.filter((r: { priority: string }) => r.priority === 'CRITICAL').length || 0;
        const highCount = data.recommendations?.filter((r: { priority: string }) => r.priority === 'HIGH').length || 0;
        const threatScore = Math.min(100, criticalCount * 30 + highCount * 15 + activeThreats * 10);
        
        // Generate tactical context
        const riskLevel = routeData.threat_level || 'MEDIUM';
        const terrainContext = routeData.terrain_types?.[0] || 'MIXED';
        const tacticalContext = `Route through ${terrainContext} terrain with ${riskLevel} threat assessment. ${activeThreats} active threat(s) detected on route corridor.`;
        
        // Zone-specific advice based on route category
        let zoneAdvice = '';
        if (routeData.category?.includes('LC')) {
          zoneAdvice = 'LOC-specific: Maintain high readiness, expect potential contact. Ensure communication protocols established.';
        } else if (routeData.category?.includes('SUPPLY')) {
          zoneAdvice = 'Supply route: Prioritize fuel and ammunition security. Maintain convoy integrity.';
        } else {
          zoneAdvice = `${routeData.name} corridor: Follow established SOPs for this AOR. Report any anomalies immediately.`;
        }
        
        setJanusAnalysis({
          ...data,
          threatScore,
          tacticalContext,
          zoneAdvice
        });
      }
    } catch (error) {
      console.error('Janus route analysis error:', error);
    } finally {
      setJanusLoading(false);
    }
  }, []);
  
  // Update current time frequently for live display - ONLY WHEN SIMULATION ACTIVE
  useEffect(() => {
    if (!isSimulationRunning) return;
    const timer = setInterval(() => setCurrentTime(new Date()), 100);
    return () => clearInterval(timer);
  }, [isSimulationRunning]);
  const buildSegments = useCallback((routeData: RouteData, weather: string, traffic: string, threatBase: string, eventsCount: number) => {
    const distance = routeData.distance_km || 100;
    const numSegments = Math.min(6, Math.max(3, Math.floor(distance / 20)));
    const terrains = (routeData.terrain_types && routeData.terrain_types.length > 0) ? routeData.terrain_types : ['MIXED'];
    const segmentDistance = distance / numSegments;

    const threatForIndex = (idx: number): RouteSegment['threat_level'] => {
      if (eventsCount > 0 && idx === Math.floor(numSegments / 2)) return 'HIGH';
      if (threatBase === 'CRITICAL' || threatBase === 'RED') return idx % 2 === 0 ? 'HIGH' : 'MEDIUM';
      if (threatBase === 'HIGH' || threatBase === 'ORANGE') return 'MEDIUM';
      if (threatBase === 'MEDIUM' || threatBase === 'YELLOW') return 'MEDIUM';
      return 'LOW';
    };

    const visibility = weather === 'FOG' ? 0.4 : weather === 'RAIN' || weather === 'SNOW' ? 0.6 : 0.9;
    const roadQuality = traffic === 'CRITICAL' ? 0.4 : traffic === 'HIGH' || traffic === 'CONGESTED' ? 0.6 : 0.8;

    return Array.from({ length: numSegments }).map((_, i) => {
      const terrain = terrains[i % terrains.length] || 'MIXED';
      const threat = threatForIndex(i);
      const speedLimit = terrain === 'MOUNTAIN' ? 35 : terrain === 'FOREST' ? 40 : terrain === 'URBAN' ? 45 : 60;
      return {
        id: `seg-${i}`,
        name: ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT'][i],
        distance_km: segmentDistance,
        terrain,
        threat_level: threat,
        speed_limit_kmh: threat === 'HIGH' ? Math.max(30, speedLimit - 10) : speedLimit,
        estimated_time_min: (segmentDistance / Math.max(30, speedLimit)) * 60,
        conditions: {
          road_quality: roadQuality,
          visibility,
          weather
        },
        hazards: threat === 'HIGH' ? ['IED Risk', 'Ambush Point'] : weather !== 'CLEAR' ? ['Low Visibility'] : []
      };
    });
  }, []);

  const fetchRouteContext = useCallback(async (routeData: RouteData) => {
    // Prevent concurrent fetches causing flickering
    if (fetchInProgress.current) {
      console.log('[RouteAnalytics] Fetch already in progress, skipping');
      return;
    }
    fetchInProgress.current = true;
    
    console.log('[RouteAnalytics] Starting fetch for route:', routeData?.name);
    const startTime = performance.now();
    try {
      const [routesRes, eventsRes] = await Promise.all([
        fetch(`${API_V1}/routes/`).catch(() => ({ ok: false, json: () => [] })),
        fetch(`${API_V1}/advanced/scenario/active`).catch(() => ({ ok: false, json: () => ({ events: [] }) }))
      ]);

      const routesList = routesRes.ok ? await routesRes.json() : [];
      const dbRoute = routesList.find((r: any) => (r.name || '').toLowerCase() === (routeData.name || '').toLowerCase());
      const dbRouteId = dbRoute?.id;

      const eventsPayload = eventsRes.ok ? await eventsRes.json() : { events: [] };
      const events = (eventsPayload.events || []).filter((e: any) => (e.affected_routes || []).includes(routeData.route_id));

      const weather = (dbRoute?.weather_status || 'CLEAR').toUpperCase();
      const traffic = (dbRoute?.current_traffic_density || 'LOW').toUpperCase();
      const threatBase = (routeData.threat_level || dbRoute?.risk_level || 'LOW').toUpperCase();

      const segmentData = buildSegments(routeData, weather, traffic, threatBase, events.length);
      setSegments(segmentData);

      let tcpData: TCPPoint[] = [];
      if (dbRouteId) {
        const tcpsRes = await fetch(`${API_V1}/tcps/?route_id=${dbRouteId}`);
        if (tcpsRes.ok) {
          const tcps = await tcpsRes.json();
          tcpData = tcps.map((tcp: any) => ({
            id: String(tcp.id),
            name: tcp.name,
            type: tcp.name.toUpperCase().includes('FUEL') ? 'REFUEL' : tcp.name.toUpperCase().includes('REST') ? 'REST' : tcp.name.toUpperCase().includes('MED') ? 'MEDICAL' : tcp.name.toUpperCase().includes('COMMAND') ? 'COMMAND' : 'CHECKPOINT',
            location: { lat: tcp.latitude, lng: tcp.longitude },
            distance_from_start_km: tcp.route_km_marker || 0,
            status: tcp.status === 'ACTIVE' ? 'ACTIVE' : tcp.status === 'INACTIVE' ? 'STANDBY' : 'ALERT',
            facilities: ['Comms', 'First Aid'],
            capacity: tcp.max_convoy_capacity || 0,
            current_occupancy: tcp.current_traffic === 'CONGESTED' ? Math.round((tcp.max_convoy_capacity || 5) * 0.8) : Math.round((tcp.max_convoy_capacity || 5) * 0.3)
          }));
        }
      }
      setTcps(tcpData);

      let avgConvoySpeed = 40;
      if (dbRouteId) {
        try {
          const [convoysRes, vehiclesRes] = await Promise.all([
            fetch(`${API_V1}/convoys/`).catch(() => ({ ok: false, json: async () => [] })),
            fetch(`${API_V1}/vehicles/vehicles`).catch(() => ({ ok: false, json: async () => [] }))
          ]);
          if (convoysRes.ok && vehiclesRes.ok) {
            const convoys = await convoysRes.json();
            const vehicles = await vehiclesRes.json();
            const convoyIds = convoys.filter((c: any) => c.route_id === dbRouteId).map((c: any) => c.id);
            const speeds = vehicles.filter((v: any) => convoyIds.includes(v.convoy_id)).map((v: any) => v.speed_kmh || 0);
            if (speeds.length > 0) {
              avgConvoySpeed = speeds.reduce((a: number, b: number) => a + b, 0) / speeds.length;
            }
          }
        } catch (err) {
          console.warn('[RouteAnalytics] Convoy/vehicle fetch failed:', err);
        }
      }

      const distance = routeData.distance_km || dbRoute?.total_distance_km || 100;
      const riskMap = { LOW: 10, MEDIUM: 30, HIGH: 60, CRITICAL: 90 } as const;
      const overallRisk = segmentData.reduce((acc, seg) => acc + riskMap[seg.threat_level] * (seg.distance_km / distance), 0) + (events.length * 5);
      const efficiency = Math.max(60, 100 - overallRisk * 0.3 - (traffic === 'HIGH' || traffic === 'CRITICAL' ? 15 : 5));
      const optimalSpeed = avgConvoySpeed || (segmentData.reduce((acc, s) => acc + s.speed_limit_kmh, 0) / segmentData.length);
      const weatherImpact = weather === 'CLEAR' ? 'MINIMAL' : weather === 'FOG' ? 'HIGH' : 'MODERATE';

      setAnalysis({
        overallRisk: Math.round(overallRisk),
        efficiency: Math.round(efficiency),
        optimalSpeed: Math.round(optimalSpeed),
        estimatedFuel: Math.round(distance * 0.35 * (weather !== 'CLEAR' ? 1.1 : 1.0)),
        threatZones: segmentData
          .filter(seg => seg.threat_level === 'HIGH' || seg.threat_level === 'CRITICAL')
          .map((seg, i) => ({
            start_km: i * seg.distance_km,
            end_km: (i + 1) * seg.distance_km,
            threat: seg.threat_level === 'CRITICAL' ? 'HOSTILE ACTIVITY ZONE' : 'ELEVATED THREAT AREA'
          })),
        recommendations: [
          overallRisk > 40 ? 'Increase spacing between vehicles to 150m' : 'Maintain standard convoy spacing of 75m',
          traffic === 'HIGH' || traffic === 'CRITICAL' ? 'Reduce convoy speed in congested sectors' : 'Standard security posture recommended',
          events.length > 0 ? 'Monitor active threat events along the route' : 'No active threat events reported',
          'Establish comms check every 15 minutes',
          weather !== 'CLEAR' ? 'Adjust speed for reduced visibility' : 'Daylight movement optimal for this route'
        ],
        alternativeRoutes: [
          { name: 'ROUTE ALPHA (Northern)', distance: distance * 1.2, risk: overallRisk > 50 ? 'LOW' : 'MEDIUM' },
          { name: 'ROUTE CHARLIE (Coastal)', distance: distance * 0.9, risk: overallRisk > 50 ? 'MEDIUM' : 'LOW' }
        ],
        weatherImpact,
        terrainChallenges: [...new Set(segmentData.map(s => s.terrain))],
        tacticalAdvice: overallRisk > 50
          ? '⚠️ HIGH RISK ROUTE: Consider alternative routing or request additional escort'
          : overallRisk > 25
          ? '⚡ MODERATE RISK: Increased vigilance required, maintain tactical spacing'
          : '✅ STANDARD RISK: Proceed with normal convoy protocols'
      });

      // Fetch REAL route metrics from backend (NO RANDOM VALUES)
      let liveData: LiveRouteMetrics;
      
      try {
        // Try to get route-specific metrics from backend
        let routeMetricsRes: Response | null = null;
        try {
          routeMetricsRes = dbRouteId 
            ? await fetch(`${API_V1}/advanced/indian-army/route-metrics/${dbRouteId}`)
            : await fetch(`${API_V1}/advanced/indian-army/route-metrics-by-name/${encodeURIComponent(routeData.name || 'default')}`);
        } catch (fetchError) {
          console.warn('[RouteAnalytics] Route metrics fetch failed:', fetchError);
          routeMetricsRes = null;
        }
        
        if (routeMetricsRes?.ok) {
          const backendMetrics = await routeMetricsRes.json();
          
          // Map backend response to LiveRouteMetrics interface
          liveData = {
            // Convoy Status - FROM DATABASE
            activeConvoys: backendMetrics.convoy_status?.active_convoys ?? 0,
            vehiclesOnRoute: backendMetrics.convoy_status?.vehicles_on_route ?? 0,
            leadVehicleProgress: backendMetrics.convoy_status?.lead_vehicle_progress_pct ?? 0,
            convoySpacing: backendMetrics.convoy_status?.convoy_spacing_m ?? 100,
            convoySpeed: backendMetrics.convoy_status?.convoy_speed_kmh ?? avgConvoySpeed,
            
            // Environment - CALCULATED FROM ROUTE DATA
            currentVisibility: backendMetrics.environment?.visibility_m ?? 10000,
            currentWindSpeed: backendMetrics.environment?.wind_speed_ms ?? 5,
            currentTemp: backendMetrics.environment?.temperature_c ?? 25,
            precipitation: backendMetrics.environment?.precipitation_mm_hr ?? 0,
            roadCondition: backendMetrics.environment?.road_condition ?? 'DRY',
            
            // Threat Assessment - FROM ACTUAL THREATS
            activeThreats: backendMetrics.threat_assessment?.active_threats ?? 0,
            threatAlerts: (backendMetrics.threat_assessment?.threat_alerts ?? []).map((t: any) => ({
              type: t.type,
              location_km: t.location_km,
              severity: t.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
              description: t.description,
              timestamp: t.timestamp
            })),
            
            // Support Assets - BASED ON ROUTE CHARACTERISTICS
            qrfDistance: backendMetrics.support_assets?.qrf_distance_km ?? 30,
            artillerySupport: backendMetrics.support_assets?.artillery_support ?? false,
            airCover: backendMetrics.support_assets?.air_cover ?? false,
            medEvacAvailable: backendMetrics.support_assets?.medevac_available ?? true,
            
            fuelPointsActive: backendMetrics.support_assets?.fuel_points_active ?? 2,
            restStopsOperational: backendMetrics.support_assets?.rest_stops_operational ?? 1,
            communicationsCoverage: backendMetrics.support_assets?.communications_coverage_pct ?? 90,
            
            // Logistics - CALCULATED
            etaMinutes: backendMetrics.convoy_status?.eta_minutes ?? Math.round(distance / (avgConvoySpeed / 60)),
            fuelConsumptionEstimate: backendMetrics.convoy_status?.fuel_consumption_liters ?? Math.round(distance * 0.35),
            breakdownRisk: (backendMetrics.threat_assessment?.breakdown_risk_pct ?? 2) / 100,
            ambushProbability: (backendMetrics.threat_assessment?.ambush_probability_pct ?? 2) / 100
          };
        } else {
          // Fallback: Calculate from locally available data (still no random)
          liveData = {
            activeConvoys: 0,
            vehiclesOnRoute: 0,
            leadVehicleProgress: 0,
            convoySpacing: 100,
            convoySpeed: avgConvoySpeed,
            
            currentVisibility: weather === 'FOG' ? 500 : weather === 'RAIN' ? 3000 : 10000,
            currentWindSpeed: 5,
            currentTemp: 25,
            precipitation: weather === 'RAIN' ? 5 : 0,
            roadCondition: weather === 'SNOW' ? 'ICY' : weather === 'RAIN' ? 'WET' : 'DRY',
            
            activeThreats: events.length,
            threatAlerts: events.slice(0, 3).map((e: any) => ({
              type: e.event_subtype || e.event_type || 'UNKNOWN',
              location_km: e.location_km || 0,
              severity: (e.severity || 'LOW') as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
              description: e.description || 'Threat event detected',
              timestamp: e.timestamp || new Date().toISOString()
            })),
            
            qrfDistance: 30,
            artillerySupport: overallRisk > 50,
            airCover: overallRisk > 70,
            medEvacAvailable: true,
            
            fuelPointsActive: Math.max(1, Math.floor(distance / 80)),
            restStopsOperational: Math.max(1, Math.floor(distance / 120)),
            communicationsCoverage: 90,
            
            etaMinutes: Math.round(distance / (avgConvoySpeed / 60)),
            fuelConsumptionEstimate: Math.round(distance * 0.35),
            breakdownRisk: overallRisk > 50 ? 0.15 : 0.02,
            ambushProbability: overallRisk > 60 ? 0.2 : overallRisk > 30 ? 0.08 : 0.02
          };
        }
      } catch (metricsError) {
        console.error('Failed to fetch route metrics:', metricsError);
        // Emergency fallback with reasonable static values
        liveData = {
          activeConvoys: 0,
          vehiclesOnRoute: 0,
          leadVehicleProgress: 0,
          convoySpacing: 100,
          convoySpeed: avgConvoySpeed,
          currentVisibility: 10000,
          currentWindSpeed: 5,
          currentTemp: 25,
          precipitation: 0,
          roadCondition: 'DRY',
          activeThreats: 0,
          threatAlerts: [],
          qrfDistance: 30,
          artillerySupport: false,
          airCover: false,
          medEvacAvailable: true,
          fuelPointsActive: 2,
          restStopsOperational: 1,
          communicationsCoverage: 90,
          etaMinutes: Math.round(distance / (avgConvoySpeed / 60)),
          fuelConsumptionEstimate: Math.round(distance * 0.35),
          breakdownRisk: 0.02,
          ambushProbability: 0.02
        };
      }
      
      setLiveMetrics(liveData);
      
      // Generate dynamic AI recommendations based on all current data
      const dynamicRecs = generateDynamicRecommendations(
        {
          overallRisk: Math.round(overallRisk),
          efficiency: Math.round(efficiency),
          optimalSpeed: Math.round(optimalSpeed),
          estimatedFuel: Math.round(distance * 0.35 * (weather !== 'CLEAR' ? 1.1 : 1.0)),
          threatZones: [],
          recommendations: [],
          alternativeRoutes: [],
          weatherImpact,
          terrainChallenges: [],
          tacticalAdvice: ''
        },
        liveData,
        segmentData,
        routeData
      );
      setDynamicRecommendations(dynamicRecs);
      
      // Update history for oscilloscope
      setHistory(prev => ({
        speed: [...prev.speed, liveData.convoySpeed].slice(-60),
        visibility: [...prev.visibility, liveData.currentVisibility / 100].slice(-60),
        threat: [...prev.threat, liveData.ambushProbability * 100].slice(-60),
        convoy: [...prev.convoy, liveData.leadVehicleProgress].slice(-60)
      }));

      setUpdateCount(c => c + 1);
      setFrameTime(performance.now() - startTime);
      setLoading(false);
      isInitializedRef.current = true;
      
      // Fetch Janus AI analysis for route
      fetchJanusRouteAnalysis(routeData, events.length);
    } catch (err) {
      console.error('[RouteAnalytics] Route context fetch error:', err);
      setLoading(false);
      isInitializedRef.current = true;
    } finally {
      fetchInProgress.current = false;
    }
  }, [buildSegments, fetchJanusRouteAnalysis]);

  // Route change handler - only triggers when route actually changes
  useEffect(() => {
    if (!route) return;
    
    const routeId = route.route_id || route.name || '';
    console.log('[RouteAnalytics] Route useEffect triggered. New ID:', routeId, 'Current ID:', currentRouteId.current, 'Initialized:', isInitializedRef.current);
    
    // Only reset if route actually changed OR not yet initialized
    if (currentRouteId.current === routeId && isInitializedRef.current) {
      console.log('[RouteAnalytics] Same route, skipping reload');
      return; // Same route, already initialized - don't reset
    }
    
    console.log('[RouteAnalytics] Loading new route:', routeId);
    
    // New route - reset everything
    currentRouteId.current = routeId;
    fetchInProgress.current = false;
    isInitializedRef.current = false;
    
    // Reset state for new route
    setLoading(true);
    setAnalysis(null);
    setSegments([]);
    setTcps([]);
    setLiveMetrics(null);
    setJanusAnalysis(null);
    setHistory({ speed: [], visibility: [], threat: [], convoy: [] });
    
    // Fetch immediately
    fetchRouteContext(route);
    
    // Safety timeout - force loading=false after 3 seconds
    const safetyTimeout = setTimeout(() => {
      if (!isInitializedRef.current) {
        setLoading(false);
        isInitializedRef.current = true;
        fetchInProgress.current = false;
      }
    }, 3000);
    
    return () => {
      clearTimeout(safetyTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.route_id, route?.name]);
  
  // Continuous updates only when simulation is running AND initialized
  useEffect(() => {
    if (!route || !isSimulationRunning) return;
    
    // Wait for initial load to complete
    const startInterval = setTimeout(() => {
      if (!isInitializedRef.current) return;
      
      const interval = setInterval(() => {
        if (isInitializedRef.current && !fetchInProgress.current) {
          fetchRouteContext(route);
        }
      }, 5000);
      
      return () => clearInterval(interval);
    }, 1000);
    
    return () => clearTimeout(startInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.route_id, route?.name, isSimulationRunning]);
  
  if (!route) {
    return (
      <div 
        className="flex-1 flex items-center justify-center"
        style={{ background: `linear-gradient(180deg, ${MILITARY_COLORS.background} 0%, rgba(13, 27, 13, 0.95) 100%)` }}
      >
        <div className="text-center p-8">
          <div className="text-6xl mb-4">🗺️</div>
          <div className="text-xl font-bold mb-2" style={{ color: MILITARY_COLORS.accent }}>
            ROUTE ANALYTICS
          </div>
          <div className="text-sm" style={{ color: MILITARY_COLORS.muted }}>
            Select a route to view tactical analysis
          </div>
        </div>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div 
        className="flex-1 flex items-center justify-center"
        style={{ background: `linear-gradient(180deg, ${MILITARY_COLORS.background} 0%, rgba(13, 27, 13, 0.95) 100%)` }}
      >
        <div className="text-center">
          <div className="text-4xl mb-4 animate-spin">🔄</div>
          <div className="font-bold" style={{ color: MILITARY_COLORS.accent }}>ANALYZING ROUTE...</div>
          <div className="text-xs mt-2" style={{ color: MILITARY_COLORS.muted }}>Processing threat assessment</div>
        </div>
      </div>
    );
  }
  
  const threatColor = route.threat_level === 'HIGH' ? MILITARY_COLORS.alert 
    : route.threat_level === 'MEDIUM' ? MILITARY_COLORS.warning 
    : MILITARY_COLORS.success;
  
  return (
    <div 
      className="flex-1 overflow-y-auto"
      style={{ 
        background: `linear-gradient(180deg, ${MILITARY_COLORS.background} 0%, rgba(13, 27, 13, 0.98) 100%)`,
        fontFamily: "'Courier New', monospace"
      }}
    >
      {/* HEADER */}
      <div 
        className="sticky top-0 z-10 p-3 border-b"
        style={{ 
          background: `linear-gradient(180deg, ${MILITARY_COLORS.panel} 0%, rgba(26, 71, 42, 0.95) 100%)`,
          borderColor: MILITARY_COLORS.border
        }}
      >
        <div className="flex items-center justify-between mb-2 text-[10px]" style={{ color: MILITARY_COLORS.muted }}>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span>LIVE INTEL</span>
          </span>
          <span className="font-mono">{currentTime.toLocaleTimeString('en-GB', { hour12: false })}.{String(currentTime.getMilliseconds()).padStart(3, '0').slice(0, 2)}</span>
          <span className="text-green-400">◉ {updateCount}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded flex items-center justify-center text-2xl"
              style={{ 
                background: `linear-gradient(135deg, ${MILITARY_COLORS.primary} 0%, ${MILITARY_COLORS.secondary} 100%)`,
                border: `2px solid ${MILITARY_COLORS.accent}`,
              }}
            >
              🛣️
            </div>
            <div>
              <div className="font-bold text-sm" style={{ color: MILITARY_COLORS.text }}>{route.name}</div>
              <div className="text-[10px]" style={{ color: MILITARY_COLORS.muted }}>
                {route.category} • {route.distance_km?.toFixed(1)} km
              </div>
            </div>
          </div>
          
          <div 
            className="px-3 py-1 rounded text-xs font-bold flex items-center gap-2"
            style={{ 
              background: threatColor + '30',
              border: `1px solid ${threatColor}`,
              color: threatColor
            }}
          >
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: threatColor }} />
            THREAT: {route.threat_level}
          </div>
        </div>
      </div>
      
      <div className="p-3 space-y-4">
        {/* ORIGIN → DESTINATION */}
        <div 
          className="rounded-lg p-4 border"
          style={{ background: MILITARY_COLORS.panel, borderColor: MILITARY_COLORS.border }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span>📍</span>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: MILITARY_COLORS.accent }}>
              ROUTE OVERVIEW
            </span>
          </div>
          
          <div className="flex items-center justify-between mb-4">
            <div className="text-center flex-1">
              <div className="text-[9px] uppercase" style={{ color: MILITARY_COLORS.muted }}>ORIGIN</div>
              <div className="text-sm font-bold" style={{ color: MILITARY_COLORS.success }}>
                {route.origin?.name || 'BASE ALPHA'}
              </div>
              <div className="text-[10px] font-mono" style={{ color: MILITARY_COLORS.muted }}>
                {(route.origin?.lat || 34.15).toFixed(4)}°N, {(route.origin?.lng || 77.58).toFixed(4)}°E
              </div>
            </div>
            
            <div className="flex items-center gap-1 px-4">
              <div className="w-12 h-0.5" style={{ background: `linear-gradient(90deg, ${MILITARY_COLORS.success}, ${MILITARY_COLORS.accent})` }} />
              <span className="text-lg" style={{ color: MILITARY_COLORS.accent }}>✈</span>
              <div className="w-12 h-0.5" style={{ background: `linear-gradient(90deg, ${MILITARY_COLORS.accent}, ${threatColor})` }} />
            </div>
            
            <div className="text-center flex-1">
              <div className="text-[9px] uppercase" style={{ color: MILITARY_COLORS.muted }}>DESTINATION</div>
              <div className="text-sm font-bold" style={{ color: threatColor }}>
                {route.destination?.name || 'FWD COMMAND'}
              </div>
              <div className="text-[10px] font-mono" style={{ color: MILITARY_COLORS.muted }}>
                {(route.destination?.lat || 34.85).toFixed(4)}°N, {(route.destination?.lng || 77.83).toFixed(4)}°E
              </div>
            </div>
          </div>
          
          {/* Route Stats */}
          <div className="grid grid-cols-4 gap-2">
            <div className="p-2 rounded text-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
              <div className="text-lg font-bold font-mono" style={{ color: MILITARY_COLORS.accent }}>
                {route.distance_km?.toFixed(0)}
              </div>
              <div className="text-[9px] uppercase" style={{ color: MILITARY_COLORS.muted }}>KM</div>
            </div>
            <div className="p-2 rounded text-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
              <div className="text-lg font-bold font-mono" style={{ color: MILITARY_COLORS.warning }}>
                {route.estimated_time_hours?.toFixed(1)}h
              </div>
              <div className="text-[9px] uppercase" style={{ color: MILITARY_COLORS.muted }}>EST TIME</div>
            </div>
            <div className="p-2 rounded text-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
              <div className="text-lg font-bold font-mono" style={{ color: MILITARY_COLORS.info }}>
                {analysis?.optimalSpeed}
              </div>
              <div className="text-[9px] uppercase" style={{ color: MILITARY_COLORS.muted }}>OPT KM/H</div>
            </div>
            <div className="p-2 rounded text-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
              <div className="text-lg font-bold font-mono" style={{ color: MILITARY_COLORS.success }}>
                {analysis?.estimatedFuel}L
              </div>
              <div className="text-[9px] uppercase" style={{ color: MILITARY_COLORS.muted }}>FUEL EST</div>
            </div>
          </div>
        </div>
        
        {/* ROUTE SEGMENTS */}
        <div 
          className="rounded-lg p-4 border"
          style={{ background: MILITARY_COLORS.panel, borderColor: MILITARY_COLORS.border }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span>🔀</span>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: MILITARY_COLORS.accent }}>
              ROUTE SEGMENTS & THREAT ANALYSIS
            </span>
          </div>
          
          <div className="relative mb-4">
            <RouteProgressBar segments={segments} totalDistance={route.distance_km || 100} />
            {/* Threat zones overlay */}
            <div className="absolute inset-0 pointer-events-none">
              {analysis?.threatZones.map((zone, i) => (
                <ThreatZoneIndicator key={i} zone={zone} totalDistance={route.distance_km || 100} />
              ))}
            </div>
          </div>
          
          {/* Segment details */}
          <div className="space-y-2">
            {segments.map((seg) => (
              <div 
                key={seg.id}
                onClick={() => setSelectedSegment(selectedSegment?.id === seg.id ? null : seg)}
                className="p-2 rounded cursor-pointer transition-all hover:bg-black/30"
                style={{ 
                  background: selectedSegment?.id === seg.id ? 'rgba(0,0,0,0.4)' : 'transparent',
                  borderLeft: `3px solid ${THREAT_COLORS[seg.threat_level]}`
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs" style={{ color: MILITARY_COLORS.text }}>SEG {seg.name}</span>
                    <span className="text-[10px] px-1 rounded" style={{ background: THREAT_COLORS[seg.threat_level] + '30', color: THREAT_COLORS[seg.threat_level] }}>
                      {seg.threat_level}
                    </span>
                  </div>
                  <span className="text-xs font-mono" style={{ color: MILITARY_COLORS.muted }}>
                    {seg.distance_km.toFixed(1)} km • {seg.estimated_time_min.toFixed(0)} min
                  </span>
                </div>
                
                {selectedSegment?.id === seg.id && (
                  <div className="mt-2 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div>
                        <span style={{ color: MILITARY_COLORS.muted }}>Terrain: </span>
                        <span style={{ color: MILITARY_COLORS.info }}>{seg.terrain}</span>
                      </div>
                      <div>
                        <span style={{ color: MILITARY_COLORS.muted }}>Speed Limit: </span>
                        <span style={{ color: MILITARY_COLORS.accent }}>{seg.speed_limit_kmh} km/h</span>
                      </div>
                      <div>
                        <span style={{ color: MILITARY_COLORS.muted }}>Weather: </span>
                        <span style={{ color: MILITARY_COLORS.success }}>{seg.conditions.weather}</span>
                      </div>
                    </div>
                    {seg.hazards.length > 0 && (
                      <div className="mt-1 flex gap-1">
                        {seg.hazards.map((h, i) => (
                          <span key={i} className="text-[9px] px-1 rounded" style={{ background: MILITARY_COLORS.alert + '30', color: MILITARY_COLORS.alert }}>
                            ⚠ {h}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* AI ANALYSIS */}
        {analysis && (
          <div 
            className="rounded-lg p-4 border"
            style={{ background: 'rgba(70, 130, 180, 0.15)', borderColor: MILITARY_COLORS.info }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span>🤖</span>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: MILITARY_COLORS.info }}>
                AI ROUTE ANALYSIS
              </span>
            </div>
            
            {/* Risk & Efficiency */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded" style={{ background: 'rgba(0,0,0,0.3)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px]" style={{ color: MILITARY_COLORS.muted }}>OVERALL RISK</span>
                  <span className="text-xl font-bold" style={{ 
                    color: analysis.overallRisk > 50 ? MILITARY_COLORS.alert : analysis.overallRisk > 25 ? MILITARY_COLORS.warning : MILITARY_COLORS.success
                  }}>
                    {analysis.overallRisk}%
                  </span>
                </div>
                <div className="h-2 rounded overflow-hidden" style={{ background: 'rgba(0,0,0,0.5)' }}>
                  <div 
                    className="h-full transition-all"
                    style={{ 
                      width: `${analysis.overallRisk}%`,
                      background: analysis.overallRisk > 50 ? MILITARY_COLORS.alert : analysis.overallRisk > 25 ? MILITARY_COLORS.warning : MILITARY_COLORS.success
                    }}
                  />
                </div>
              </div>
              <div className="p-3 rounded" style={{ background: 'rgba(0,0,0,0.3)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px]" style={{ color: MILITARY_COLORS.muted }}>ROUTE EFFICIENCY</span>
                  <span className="text-xl font-bold" style={{ color: MILITARY_COLORS.success }}>
                    {analysis.efficiency}%
                  </span>
                </div>
                <div className="h-2 rounded overflow-hidden" style={{ background: 'rgba(0,0,0,0.5)' }}>
                  <div 
                    className="h-full"
                    style={{ width: `${analysis.efficiency}%`, background: MILITARY_COLORS.success }}
                  />
                </div>
              </div>
            </div>
            
            {/* Tactical Advice */}
            <div className="p-3 rounded mb-3" style={{ background: 'rgba(0,0,0,0.3)' }}>
              <div className="text-xs" style={{ color: MILITARY_COLORS.text }}>{analysis.tacticalAdvice}</div>
            </div>
            
            {/* Dynamic AI Recommendations - Real-Time Analysis */}
            <div className="p-3 rounded" style={{ background: 'rgba(0,0,0,0.3)' }}>
              <div className="text-[10px] uppercase mb-2 flex items-center justify-between" style={{ color: MILITARY_COLORS.success }}>
                <span className="flex items-center gap-1">
                  💡 DYNAMIC AI RECOMMENDATIONS
                  <span className="animate-pulse">●</span>
                </span>
                <span className="text-[8px] px-1 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.4)', color: MILITARY_COLORS.muted }}>
                  {dynamicRecommendations.length} ACTIVE
                </span>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {dynamicRecommendations.slice(0, 8).map((rec) => (
                  <div 
                    key={rec.id} 
                    className="p-2 rounded border-l-2"
                    style={{ 
                      background: 'rgba(0,0,0,0.3)',
                      borderColor: rec.priority === 'CRITICAL' ? MILITARY_COLORS.alert : 
                                   rec.priority === 'HIGH' ? MILITARY_COLORS.warning : 
                                   rec.priority === 'MEDIUM' ? '#4682b4' :
                                   rec.priority === 'LOW' ? MILITARY_COLORS.success : MILITARY_COLORS.muted
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span 
                          className="text-[8px] px-1 py-0.5 rounded font-bold"
                          style={{ 
                            background: rec.priority === 'CRITICAL' ? MILITARY_COLORS.alert + '40' : 
                                        rec.priority === 'HIGH' ? MILITARY_COLORS.warning + '40' : 
                                        rec.priority === 'MEDIUM' ? '#4682b440' :
                                        rec.priority === 'LOW' ? MILITARY_COLORS.success + '40' : MILITARY_COLORS.muted + '40',
                            color: rec.priority === 'CRITICAL' ? MILITARY_COLORS.alert : 
                                   rec.priority === 'HIGH' ? MILITARY_COLORS.warning :
                                   rec.priority === 'MEDIUM' ? '#4682b4' :
                                   rec.priority === 'LOW' ? MILITARY_COLORS.success : MILITARY_COLORS.muted
                          }}
                        >
                          {rec.priority}
                        </span>
                        <span 
                          className="text-[7px] px-1 py-0.5 rounded uppercase"
                          style={{ background: 'rgba(0,0,0,0.4)', color: MILITARY_COLORS.muted }}
                        >
                          {rec.category}
                        </span>
                      </div>
                      <span className="text-[7px]" style={{ color: MILITARY_COLORS.muted }}>
                        {rec.confidence}% conf
                      </span>
                    </div>
                    <div className="text-[10px]" style={{ color: MILITARY_COLORS.text }}>{rec.text}</div>
                    <div className="flex items-center justify-between mt-1 text-[7px]" style={{ color: MILITARY_COLORS.muted }}>
                      <span>{rec.source}</span>
                      {rec.actionable && (
                        <span className="px-1 rounded" style={{ background: MILITARY_COLORS.accent + '30', color: MILITARY_COLORS.accent }}>
                          ACTIONABLE
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Alternative Routes */}
            {analysis.alternativeRoutes && (
              <div className="mt-3 p-3 rounded" style={{ background: 'rgba(0,0,0,0.3)' }}>
                <div className="text-[10px] uppercase mb-2" style={{ color: MILITARY_COLORS.warning }}>🔀 ALTERNATIVE ROUTES</div>
                {analysis.alternativeRoutes.map((alt, i) => (
                  <div key={i} className="flex items-center justify-between py-1 text-xs">
                    <span style={{ color: MILITARY_COLORS.text }}>{alt.name}</span>
                    <div className="flex items-center gap-2">
                      <span style={{ color: MILITARY_COLORS.muted }}>{alt.distance.toFixed(0)} km</span>
                      <span 
                        className="px-1 rounded text-[9px]"
                        style={{ 
                          background: alt.risk === 'LOW' ? MILITARY_COLORS.success + '30' : MILITARY_COLORS.warning + '30',
                          color: alt.risk === 'LOW' ? MILITARY_COLORS.success : MILITARY_COLORS.warning
                        }}
                      >
                        {alt.risk}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* ============================================= */}
        {/* JANUS AI DEEP ANALYSIS - LOCAL LLM POWERED */}
        {/* ============================================= */}
        {janusLoading && !janusAnalysis && (
          <div 
            className="rounded-lg p-4 border"
            style={{ 
              background: 'linear-gradient(135deg, rgba(128, 0, 128, 0.1) 0%, rgba(75, 0, 130, 0.15) 100%)', 
              borderColor: '#9932CC'
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <div>
                <div className="text-[10px] font-bold uppercase" style={{ color: '#DA70D6' }}>
                  JANUS AI ANALYZING ROUTE...
                </div>
                <div className="text-[9px]" style={{ color: MILITARY_COLORS.muted }}>
                  Processing tactical intelligence with local LLM
                </div>
              </div>
            </div>
          </div>
        )}
        
        {janusAnalysis && (
          <div 
            className="rounded-lg p-4 border relative overflow-hidden"
            style={{ 
              background: 'linear-gradient(135deg, rgba(128, 0, 128, 0.15) 0%, rgba(75, 0, 130, 0.2) 100%)', 
              borderColor: '#9932CC',
              boxShadow: '0 0 20px rgba(153, 50, 204, 0.3)'
            }}
          >
            {/* Animated background */}
            <div 
              className="absolute inset-0 opacity-10"
              style={{
                background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(153, 50, 204, 0.1) 10px, rgba(153, 50, 204, 0.1) 20px)'
              }}
            />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🧠</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#DA70D6' }}>
                    JANUS AI ROUTE INTELLIGENCE
                  </span>
                  <span 
                    className="text-[8px] px-1.5 py-0.5 rounded animate-pulse"
                    style={{ background: 'rgba(153, 50, 204, 0.3)', color: '#DA70D6' }}
                  >
                    LOCAL LLM
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[9px]" style={{ color: '#DA70D6' }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#DA70D6' }} />
                  <span>AI ACTIVE</span>
                </div>
              </div>
              
              {/* Threat Assessment */}
              <div className="p-3 rounded mb-3" style={{ background: 'rgba(0,0,0,0.4)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase" style={{ color: '#DA70D6' }}>🎯 AI THREAT ASSESSMENT</span>
                  <span 
                    className="text-xl font-bold font-mono"
                    style={{ 
                      color: (janusAnalysis.threatScore ?? 0) > 60 ? MILITARY_COLORS.alert : 
                             (janusAnalysis.threatScore ?? 0) > 30 ? MILITARY_COLORS.warning : MILITARY_COLORS.success
                    }}
                  >
                    {janusAnalysis.threatScore ?? 0}%
                  </span>
                </div>
                <div className="h-2 rounded overflow-hidden" style={{ background: 'rgba(0,0,0,0.5)' }}>
                  <div 
                    className="h-full transition-all duration-500"
                    style={{ 
                      width: `${janusAnalysis.threatScore ?? 0}%`,
                      background: (janusAnalysis.threatScore ?? 0) > 60 ? MILITARY_COLORS.alert : 
                                  (janusAnalysis.threatScore ?? 0) > 30 ? MILITARY_COLORS.warning : MILITARY_COLORS.success
                    }}
                  />
                </div>
                <div className="text-[10px] mt-2" style={{ color: MILITARY_COLORS.muted }}>
                  {janusAnalysis.tacticalContext || 'Analyzing route tactical context...'}
                </div>
              </div>
              
              {/* AI Recommendations */}
              <div className="p-3 rounded mb-3" style={{ background: 'rgba(0,0,0,0.4)' }}>
                <div className="text-[10px] uppercase mb-2 flex items-center gap-2" style={{ color: '#DA70D6' }}>
                  <span>🤖</span>
                  <span>JANUS AI RECOMMENDATIONS</span>
                  <span className="text-[8px] px-1 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.3)', color: MILITARY_COLORS.muted }}>
                    {janusAnalysis.generated_by}
                  </span>
                </div>
                <div className="space-y-2">
                  {janusAnalysis.recommendations.map((rec: { priority: string; text: string; source: string }, idx: number) => (
                    <div 
                      key={idx} 
                      className="p-2 rounded border-l-2"
                      style={{ 
                        background: 'rgba(0,0,0,0.3)',
                        borderColor: rec.priority === 'CRITICAL' ? MILITARY_COLORS.alert : 
                                     rec.priority === 'HIGH' ? MILITARY_COLORS.warning : 
                                     rec.priority === 'MEDIUM' ? MILITARY_COLORS.warning : MILITARY_COLORS.info
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span 
                          className="text-[8px] px-1 py-0.5 rounded font-bold"
                          style={{ 
                            background: rec.priority === 'CRITICAL' ? MILITARY_COLORS.alert + '30' : 
                                        rec.priority === 'HIGH' ? MILITARY_COLORS.warning + '30' : 
                                        rec.priority === 'MEDIUM' ? MILITARY_COLORS.warning + '30' : MILITARY_COLORS.info + '30',
                            color: rec.priority === 'CRITICAL' ? MILITARY_COLORS.alert : 
                                   rec.priority === 'HIGH' ? MILITARY_COLORS.warning : 
                                   rec.priority === 'MEDIUM' ? MILITARY_COLORS.warning : MILITARY_COLORS.info
                          }}
                        >
                          {rec.priority}
                        </span>
                      </div>
                      <div className="text-[10px]" style={{ color: MILITARY_COLORS.text }}>{rec.text}</div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Zone-Specific Advice */}
              {janusAnalysis.zoneAdvice && (
                <div className="p-3 rounded" style={{ background: 'rgba(0,0,0,0.4)' }}>
                  <div className="text-[10px] uppercase mb-2 flex items-center gap-2" style={{ color: '#DA70D6' }}>
                    <span>🗺️</span>
                    <span>ZONE-SPECIFIC INTELLIGENCE</span>
                  </div>
                  <div className="text-[10px]" style={{ color: MILITARY_COLORS.text }}>
                    {janusAnalysis.zoneAdvice}
                  </div>
                </div>
              )}
              
              {/* Status Footer */}
              <div className="mt-3 pt-2 border-t flex items-center justify-between text-[8px]" style={{ borderColor: 'rgba(153, 50, 204, 0.3)', color: MILITARY_COLORS.muted }}>
                <span>
                  {janusAnalysis.gpu_accelerated ? '🚀 GPU Accelerated' : '⚙️ CPU Mode'}
                </span>
                <span>{new Date(janusAnalysis.timestamp).toLocaleTimeString()}</span>
                {janusAnalysis.note && (
                  <span className="text-yellow-500">⚠ {janusAnalysis.note}</span>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* ============================================= */}
        {/* LIVE TACTICAL METRICS - REAL-TIME UPDATES */}
        {/* ============================================= */}
        {liveMetrics && isSimulationRunning && (
          <>
            {/* ROUTE TRAFFIC STATUS */}
            <div 
              className="rounded-lg p-4 border"
              style={{ background: MILITARY_COLORS.panel, borderColor: MILITARY_COLORS.border }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🚛</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: MILITARY_COLORS.accent }}>
                    ROUTE TRAFFIC STATUS
                  </span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(70,130,180,0.2)', color: MILITARY_COLORS.info }}>
                    Aggregated
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[9px]" style={{ color: MILITARY_COLORS.muted }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span>REAL-TIME</span>
                  <span className="font-mono">{frameTime.toFixed(0)}ms</span>
                </div>
              </div>
              
              <div className="grid grid-cols-5 gap-2 mb-3">
                <div className="p-2 rounded text-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
                  <div className="text-xl font-bold font-mono" style={{ color: MILITARY_COLORS.success }}>
                    {liveMetrics.activeConvoys}
                  </div>
                  <div className="text-[8px] uppercase" style={{ color: MILITARY_COLORS.muted }}>ACTIVE CONVOYS</div>
                </div>
                <div className="p-2 rounded text-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
                  <div className="text-xl font-bold font-mono" style={{ color: MILITARY_COLORS.info }}>
                    {liveMetrics.vehiclesOnRoute}
                  </div>
                  <div className="text-[8px] uppercase" style={{ color: MILITARY_COLORS.muted }}>TOTAL VEHICLES</div>
                </div>
                <div className="p-2 rounded text-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
                  <div className="text-xl font-bold font-mono" style={{ color: MILITARY_COLORS.warning }}>
                    {liveMetrics.convoySpeed.toFixed(0)}
                  </div>
                  <div className="text-[8px] uppercase" style={{ color: MILITARY_COLORS.muted }}>TRAFFIC AVG KM/H</div>
                </div>
                <div className="p-2 rounded text-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
                  <div className="text-xl font-bold font-mono" style={{ color: MILITARY_COLORS.accent }}>
                    {liveMetrics.convoySpacing.toFixed(0)}m
                  </div>
                  <div className="text-[8px] uppercase" style={{ color: MILITARY_COLORS.muted }}>AVG SPACING</div>
                </div>
                <div className="p-2 rounded text-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
                  <div className="text-xl font-bold font-mono" style={{ color: MILITARY_COLORS.success }}>
                    {liveMetrics.leadVehicleProgress.toFixed(0)}%
                  </div>
                  <div className="text-[8px] uppercase" style={{ color: MILITARY_COLORS.muted }}>LEAD PROGRESS</div>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="relative h-3 rounded overflow-hidden" style={{ background: 'rgba(0,0,0,0.5)' }}>
                <div 
                  className="absolute h-full transition-all duration-500"
                  style={{ 
                    width: `${liveMetrics.leadVehicleProgress}%`,
                    background: `linear-gradient(90deg, ${MILITARY_COLORS.success}, ${MILITARY_COLORS.accent})`,
                    boxShadow: `0 0 10px ${MILITARY_COLORS.success}`
                  }}
                />
                <div 
                  className="absolute h-full w-2 animate-pulse"
                  style={{ 
                    left: `${liveMetrics.leadVehicleProgress}%`,
                    background: MILITARY_COLORS.accent,
                    boxShadow: `0 0 8px ${MILITARY_COLORS.accent}`
                  }}
                />
              </div>
              <div className="flex justify-between mt-1 text-[8px]" style={{ color: MILITARY_COLORS.muted }}>
                <span>START</span>
                <span>ETA: {liveMetrics.etaMinutes} min</span>
                <span>DEST</span>
              </div>
            </div>
            
            {/* ENVIRONMENT & WEATHER LIVE */}
            <div 
              className="rounded-lg p-4 border"
              style={{ background: MILITARY_COLORS.panel, borderColor: MILITARY_COLORS.border }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span>🌤️</span>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: MILITARY_COLORS.accent }}>
                  LIVE ENVIRONMENT CONDITIONS
                </span>
              </div>
              
              <div className="grid grid-cols-5 gap-2">
                <div className="p-2 rounded text-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
                  <div className="text-sm font-bold font-mono" style={{ color: liveMetrics.currentVisibility < 1000 ? MILITARY_COLORS.alert : MILITARY_COLORS.success }}>
                    {liveMetrics.currentVisibility >= 1000 ? (liveMetrics.currentVisibility / 1000).toFixed(1) + 'km' : liveMetrics.currentVisibility.toFixed(0) + 'm'}
                  </div>
                  <div className="text-[8px] uppercase" style={{ color: MILITARY_COLORS.muted }}>VISIBILITY</div>
                </div>
                <div className="p-2 rounded text-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
                  <div className="text-sm font-bold font-mono" style={{ color: MILITARY_COLORS.info }}>
                    {liveMetrics.currentTemp.toFixed(1)}°C
                  </div>
                  <div className="text-[8px] uppercase" style={{ color: MILITARY_COLORS.muted }}>TEMP</div>
                </div>
                <div className="p-2 rounded text-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
                  <div className="text-sm font-bold font-mono" style={{ color: MILITARY_COLORS.warning }}>
                    {liveMetrics.currentWindSpeed.toFixed(1)}m/s
                  </div>
                  <div className="text-[8px] uppercase" style={{ color: MILITARY_COLORS.muted }}>WIND</div>
                </div>
                <div className="p-2 rounded text-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
                  <div className="text-sm font-bold font-mono" style={{ color: liveMetrics.precipitation > 0 ? MILITARY_COLORS.info : MILITARY_COLORS.success }}>
                    {liveMetrics.precipitation.toFixed(1)}mm/h
                  </div>
                  <div className="text-[8px] uppercase" style={{ color: MILITARY_COLORS.muted }}>RAIN</div>
                </div>
                <div className="p-2 rounded text-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
                  <div className="text-sm font-bold font-mono" style={{ 
                    color: liveMetrics.roadCondition === 'DRY' ? MILITARY_COLORS.success : 
                           liveMetrics.roadCondition === 'WET' ? MILITARY_COLORS.info :
                           liveMetrics.roadCondition === 'ICY' ? MILITARY_COLORS.alert : MILITARY_COLORS.warning 
                  }}>
                    {liveMetrics.roadCondition}
                  </div>
                  <div className="text-[8px] uppercase" style={{ color: MILITARY_COLORS.muted }}>ROAD</div>
                </div>
              </div>
            </div>
            
            {/* THREAT ASSESSMENT LIVE */}
            <div 
              className="rounded-lg p-4 border"
              style={{ 
                background: liveMetrics.activeThreats > 0 ? 'rgba(139, 0, 0, 0.2)' : MILITARY_COLORS.panel, 
                borderColor: liveMetrics.activeThreats > 0 ? MILITARY_COLORS.alert : MILITARY_COLORS.border 
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span>⚠️</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: MILITARY_COLORS.alert }}>
                    LIVE THREAT ASSESSMENT
                  </span>
                </div>
                {liveMetrics.activeThreats > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded animate-pulse" style={{ background: MILITARY_COLORS.alert, color: 'white' }}>
                    {liveMetrics.activeThreats} ACTIVE
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="p-2 rounded text-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
                  <div className="text-lg font-bold font-mono" style={{ color: liveMetrics.ambushProbability > 0.15 ? MILITARY_COLORS.alert : MILITARY_COLORS.success }}>
                    {(liveMetrics.ambushProbability * 100).toFixed(1)}%
                  </div>
                  <div className="text-[8px] uppercase" style={{ color: MILITARY_COLORS.muted }}>AMBUSH RISK</div>
                </div>
                <div className="p-2 rounded text-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
                  <div className="text-lg font-bold font-mono" style={{ color: liveMetrics.breakdownRisk > 0.1 ? MILITARY_COLORS.warning : MILITARY_COLORS.success }}>
                    {(liveMetrics.breakdownRisk * 100).toFixed(1)}%
                  </div>
                  <div className="text-[8px] uppercase" style={{ color: MILITARY_COLORS.muted }}>BREAKDOWN</div>
                </div>
                <div className="p-2 rounded text-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
                  <div className="text-lg font-bold font-mono" style={{ color: MILITARY_COLORS.info }}>
                    {liveMetrics.qrfDistance.toFixed(1)}km
                  </div>
                  <div className="text-[8px] uppercase" style={{ color: MILITARY_COLORS.muted }}>QRF DIST</div>
                </div>
                <div className="p-2 rounded text-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
                  <div className="text-lg font-bold font-mono" style={{ color: liveMetrics.communicationsCoverage > 80 ? MILITARY_COLORS.success : MILITARY_COLORS.warning }}>
                    {liveMetrics.communicationsCoverage.toFixed(0)}%
                  </div>
                  <div className="text-[8px] uppercase" style={{ color: MILITARY_COLORS.muted }}>COMMS</div>
                </div>
              </div>
              
              {/* Threat alerts */}
              {liveMetrics.threatAlerts.length > 0 && (
                <div className="space-y-1">
                  {liveMetrics.threatAlerts.map((alert, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded text-[10px]" style={{ background: 'rgba(139,0,0,0.3)' }}>
                      <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: THREAT_COLORS[alert.severity] }} />
                      <span style={{ color: THREAT_COLORS[alert.severity] }}>{alert.type}</span>
                      <span style={{ color: MILITARY_COLORS.muted }}>at {alert.location_km.toFixed(1)}km</span>
                      <span style={{ color: MILITARY_COLORS.text }}>{alert.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* SUPPORT ASSETS */}
            <div 
              className="rounded-lg p-4 border"
              style={{ background: MILITARY_COLORS.panel, borderColor: MILITARY_COLORS.border }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span>🎖️</span>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: MILITARY_COLORS.accent }}>
                  SUPPORT ASSETS & LOGISTICS
                </span>
              </div>
              
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="p-2 rounded text-center" style={{ background: liveMetrics.artillerySupport ? 'rgba(34,139,34,0.3)' : 'rgba(139,0,0,0.3)' }}>
                  <div className="text-xl">💥</div>
                  <div className="text-[10px] font-bold" style={{ color: liveMetrics.artillerySupport ? MILITARY_COLORS.success : MILITARY_COLORS.alert }}>
                    {liveMetrics.artillerySupport ? 'AVAILABLE' : 'OFFLINE'}
                  </div>
                  <div className="text-[8px]" style={{ color: MILITARY_COLORS.muted }}>ARTILLERY</div>
                </div>
                <div className="p-2 rounded text-center" style={{ background: liveMetrics.airCover ? 'rgba(34,139,34,0.3)' : 'rgba(139,0,0,0.3)' }}>
                  <div className="text-xl">✈️</div>
                  <div className="text-[10px] font-bold" style={{ color: liveMetrics.airCover ? MILITARY_COLORS.success : MILITARY_COLORS.alert }}>
                    {liveMetrics.airCover ? 'ON STATION' : 'NO COVER'}
                  </div>
                  <div className="text-[8px]" style={{ color: MILITARY_COLORS.muted }}>AIR SUPPORT</div>
                </div>
                <div className="p-2 rounded text-center" style={{ background: liveMetrics.medEvacAvailable ? 'rgba(34,139,34,0.3)' : 'rgba(139,0,0,0.3)' }}>
                  <div className="text-xl">🚁</div>
                  <div className="text-[10px] font-bold" style={{ color: liveMetrics.medEvacAvailable ? MILITARY_COLORS.success : MILITARY_COLORS.alert }}>
                    {liveMetrics.medEvacAvailable ? 'STANDING BY' : 'UNAVAILABLE'}
                  </div>
                  <div className="text-[8px]" style={{ color: MILITARY_COLORS.muted }}>MEDEVAC</div>
                </div>
                <div className="p-2 rounded text-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
                  <div className="text-xl">⛽</div>
                  <div className="text-[10px] font-bold" style={{ color: MILITARY_COLORS.warning }}>
                    {liveMetrics.fuelPointsActive} ACTIVE
                  </div>
                  <div className="text-[8px]" style={{ color: MILITARY_COLORS.muted }}>FUEL POINTS</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded" style={{ background: 'rgba(0,0,0,0.3)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px]" style={{ color: MILITARY_COLORS.muted }}>Rest Stops:</span>
                    <span className="font-bold text-sm" style={{ color: MILITARY_COLORS.success }}>{liveMetrics.restStopsOperational} operational</span>
                  </div>
                </div>
                <div className="p-2 rounded" style={{ background: 'rgba(0,0,0,0.3)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px]" style={{ color: MILITARY_COLORS.muted }}>Fuel Est:</span>
                    <span className="font-bold text-sm" style={{ color: MILITARY_COLORS.warning }}>{liveMetrics.fuelConsumptionEstimate} liters</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* OSCILLOSCOPE - LIVE TRENDS */}
            <div 
              className="rounded-lg p-4 border"
              style={{ background: MILITARY_COLORS.panel, borderColor: MILITARY_COLORS.border }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span>📊</span>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: MILITARY_COLORS.accent }}>
                  LIVE TELEMETRY WAVEFORMS
                </span>
              </div>
              
              <div className="space-y-2">
                {/* Speed waveform */}
                <div className="flex items-center gap-2">
                  <span className="text-[9px] w-16" style={{ color: MILITARY_COLORS.muted }}>SPEED</span>
                  <div className="flex-1 h-6 rounded overflow-hidden" style={{ background: 'rgba(0,0,0,0.5)' }}>
                    <svg width="100%" height="100%" viewBox="0 0 120 24" preserveAspectRatio="none">
                      <polyline
                        fill="none"
                        stroke={MILITARY_COLORS.success}
                        strokeWidth="1.5"
                        points={history.speed.map((v, i) => `${(i / history.speed.length) * 120},${24 - (v / 100) * 24}`).join(' ')}
                      />
                    </svg>
                  </div>
                  <span className="text-[10px] font-mono w-14 text-right" style={{ color: MILITARY_COLORS.success }}>
                    {(history.speed[history.speed.length - 1] || 0).toFixed(0)} km/h
                  </span>
                </div>
                
                {/* Threat level waveform */}
                <div className="flex items-center gap-2">
                  <span className="text-[9px] w-16" style={{ color: MILITARY_COLORS.muted }}>THREAT</span>
                  <div className="flex-1 h-6 rounded overflow-hidden" style={{ background: 'rgba(0,0,0,0.5)' }}>
                    <svg width="100%" height="100%" viewBox="0 0 120 24" preserveAspectRatio="none">
                      <polyline
                        fill="none"
                        stroke={MILITARY_COLORS.alert}
                        strokeWidth="1.5"
                        points={history.threat.map((v, i) => `${(i / history.threat.length) * 120},${24 - (v / 100) * 24}`).join(' ')}
                      />
                    </svg>
                  </div>
                  <span className="text-[10px] font-mono w-14 text-right" style={{ color: MILITARY_COLORS.alert }}>
                    {(history.threat[history.threat.length - 1] || 0).toFixed(1)}%
                  </span>
                </div>
                
                {/* Progress waveform */}
                <div className="flex items-center gap-2">
                  <span className="text-[9px] w-16" style={{ color: MILITARY_COLORS.muted }}>PROGRESS</span>
                  <div className="flex-1 h-6 rounded overflow-hidden" style={{ background: 'rgba(0,0,0,0.5)' }}>
                    <svg width="100%" height="100%" viewBox="0 0 120 24" preserveAspectRatio="none">
                      <polyline
                        fill="none"
                        stroke={MILITARY_COLORS.accent}
                        strokeWidth="1.5"
                        points={history.convoy.map((v, i) => `${(i / history.convoy.length) * 120},${24 - (v / 100) * 24}`).join(' ')}
                      />
                    </svg>
                  </div>
                  <span className="text-[10px] font-mono w-14 text-right" style={{ color: MILITARY_COLORS.accent }}>
                    {(history.convoy[history.convoy.length - 1] || 0).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
        
        {/* SIMULATION STOPPED NOTICE */}
        {!isSimulationRunning && (
          <div 
            className="rounded-lg p-6 border text-center"
            style={{ background: 'rgba(0,0,0,0.5)', borderColor: MILITARY_COLORS.warning }}
          >
            <div className="text-4xl mb-2">⏸️</div>
            <div className="text-sm font-bold" style={{ color: MILITARY_COLORS.warning }}>SIMULATION PAUSED</div>
            <div className="text-[10px] mt-1" style={{ color: MILITARY_COLORS.muted }}>
              Live metrics updates are disabled. Start the demo to see real-time data.
            </div>
          </div>
        )}
        
        {/* TRAFFIC CONTROL POINTS */}
        <div 
          className="rounded-lg p-4 border"
          style={{ background: MILITARY_COLORS.panel, borderColor: MILITARY_COLORS.border }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span>🛡️</span>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: MILITARY_COLORS.accent }}>
              TRAFFIC CONTROL POINTS ({tcps.length})
            </span>
          </div>
          
          <div className="space-y-2">
            {tcps.map((tcp) => (
              <TCPMarker key={tcp.id} tcp={tcp} />
            ))}
          </div>
        </div>
        
        {/* TERRAIN & CONDITIONS */}
        <div 
          className="rounded-lg p-4 border"
          style={{ background: MILITARY_COLORS.panel, borderColor: MILITARY_COLORS.border }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span>🏔️</span>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: MILITARY_COLORS.accent }}>
              TERRAIN & CONDITIONS
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] mb-2" style={{ color: MILITARY_COLORS.muted }}>TERRAIN TYPES</div>
              <div className="flex flex-wrap gap-1">
                {(analysis?.terrainChallenges || ['PLAINS', 'MOUNTAIN']).map((t, i) => (
                  <span key={i} className="text-[10px] px-2 py-1 rounded" style={{ background: MILITARY_COLORS.info + '30', color: MILITARY_COLORS.info }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] mb-2" style={{ color: MILITARY_COLORS.muted }}>WEATHER IMPACT</div>
              <div 
                className="text-sm font-bold"
                style={{ 
                  color: analysis?.weatherImpact === 'MINIMAL' ? MILITARY_COLORS.success : MILITARY_COLORS.warning
                }}
              >
                {analysis?.weatherImpact || 'MINIMAL'}
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="text-center py-2 text-[9px]" style={{ color: MILITARY_COLORS.muted }}>
          TACTICAL ROUTE SYSTEM v3.0 • 5s REFRESH • {updateCount} FRAMES • LIVE
        </div>
      </div>
    </div>
  );
}
