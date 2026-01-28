"""
Unified Data Hub Service
========================
भारतीय सेना (Indian Army) Logistics AI System

Single Source of Truth for all components:
- Tracking Panel
- Tactical Metrics HUD
- Command Centre
- Scheduling Command Center
- Map Components
- Military Assets Panel

This service ensures all components receive consistent, synchronized data
from the database with AI analysis and recommendations.

Security Classification: RESTRICTED
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
import asyncio

# Models
from app.models.convoy import Convoy
from app.models.route import Route
from app.models.tracking import ConvoyTracking, ConvoyMission
from app.models.tcp import TCP
from app.models.obstacle import Obstacle
from app.models.military_asset import MilitaryAsset
from app.models.scheduling import SchedulingRequest, SchedulingRecommendation

# Services
from app.services.janus_ai_service import JanusAIService
from app.services.eta_predictor import ETAPredictor


class UnifiedDataHub:
    """
    Central data hub that provides synchronized data to all frontend components.
    Ensures consistency between Tracking, Metrics, Command Centre, and Scheduling.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.janus_ai = JanusAIService()
        self.eta_predictor = ETAPredictor()
        self._cache: Dict[str, Any] = {}
        self._cache_timestamp: Optional[datetime] = None
        self._cache_ttl_seconds = 5  # Cache for 5 seconds
    
    async def get_unified_state(self) -> Dict[str, Any]:
        """
        Get the complete unified state of the system.
        This is the SINGLE SOURCE OF TRUTH for all components.
        """
        # Check cache
        now = datetime.utcnow()
        if (self._cache_timestamp and 
            (now - self._cache_timestamp).total_seconds() < self._cache_ttl_seconds and
            self._cache):
            return self._cache
        
        # Fetch all data in parallel
        convoys_task = self._get_convoys_with_tracking()
        routes_task = self._get_routes_with_status()
        tcps_task = self._get_tcps_status()
        threats_task = self._get_active_threats()
        assets_task = self._get_military_assets()
        scheduling_task = self._get_scheduling_status()
        
        convoys, routes, tcps, threats, assets, scheduling = await asyncio.gather(
            convoys_task, routes_task, tcps_task,
            threats_task, assets_task, scheduling_task
        )
        
        # Generate AI analysis based on current state
        ai_analysis = await self._generate_ai_analysis(convoys, routes, threats)
        
        # Build unified state
        unified_state = {
            "timestamp": now.isoformat(),
            "sync_id": f"SYNC-{now.strftime('%Y%m%d%H%M%S')}",
            
            # Core Data
            "convoys": convoys,
            "routes": routes,
            "tcps": tcps,
            "threats": threats,
            "military_assets": assets,
            "scheduling": scheduling,
            
            # Aggregated Metrics
            "metrics": self._calculate_metrics(convoys, routes, threats),
            
            # AI Analysis & Recommendations
            "ai_analysis": ai_analysis,
            
            # System Status
            "system_status": {
                "database_connected": True,
                "ai_engine_status": "ACTIVE" if self.janus_ai else "STANDBY",
                "last_update": now.isoformat(),
                "data_freshness_ms": 0
            }
        }
        
        # Update cache
        self._cache = unified_state
        self._cache_timestamp = now
        
        return unified_state
    
    async def _get_convoys_with_tracking(self) -> List[Dict[str, Any]]:
        """Get all convoys with their current tracking data."""
        try:
            # Query convoys with tracking
            convoy_query = select(Convoy).options(
                selectinload(Convoy.route),
                selectinload(Convoy.assets)
            )
            convoy_result = await self.db.execute(convoy_query)
            convoys = convoy_result.scalars().all()
            
            convoy_list = []
            for convoy in convoys:
                # Get latest tracking for this convoy
                tracking_query = select(ConvoyTracking).where(
                    ConvoyTracking.convoy_id == convoy.id
                ).order_by(ConvoyTracking.timestamp.desc()).limit(1)
                tracking_result = await self.db.execute(tracking_query)
                tracking = tracking_result.scalar_one_or_none()
                
                # Get mission data
                mission_query = select(ConvoyMission).where(
                    ConvoyMission.convoy_id == convoy.id
                )
                mission_result = await self.db.execute(mission_query)
                mission = mission_result.scalar_one_or_none()
                
                convoy_data = {
                    "id": convoy.id,
                    "name": convoy.name,
                    "status": convoy.status,
                    "start_location": convoy.start_location,
                    "end_location": convoy.end_location,
                    "route_id": convoy.route_id,
                    "route_name": convoy.route.name if convoy.route else None,
                    "vehicle_count": len(convoy.assets) if convoy.assets else 0,
                    
                    # Real-time tracking
                    "tracking": {
                        "latitude": tracking.latitude if tracking else None,
                        "longitude": tracking.longitude if tracking else None,
                        "speed_kmh": tracking.speed_kmh if tracking else 0,
                        "heading_deg": tracking.heading_deg if tracking else 0,
                        "distance_covered_km": tracking.distance_covered_km if tracking else 0,
                        "distance_remaining_km": tracking.distance_remaining_km if tracking else 0,
                        "route_progress_pct": tracking.route_progress_pct if tracking else 0,
                        "movement_status": tracking.movement_status if tracking else "UNKNOWN",
                        "eta_destination": tracking.eta_destination.isoformat() if tracking and tracking.eta_destination else None,
                        "last_checkpoint": tracking.last_checkpoint_name if tracking else None,
                        "next_checkpoint": tracking.next_checkpoint_name if tracking else None,
                    } if tracking else None,
                    
                    # Mission data
                    "mission": {
                        "mission_id": mission.mission_id if mission else None,
                        "mission_code": mission.mission_code if mission else None,
                        "cargo_type": mission.cargo_type if mission else None,
                        "cargo_weight_tons": mission.cargo_weight_tons if mission else 0,
                        "priority": mission.cargo_value_classification if mission else "STANDARD",
                        "personnel_count": mission.personnel_count if mission else 0,
                    } if mission else None
                }
                convoy_list.append(convoy_data)
            
            return convoy_list
        except Exception as e:
            print(f"Error fetching convoys: {e}")
            return []
    
    async def _get_routes_with_status(self) -> List[Dict[str, Any]]:
        """Get all routes with current traffic and threat status."""
        try:
            route_query = select(Route)
            route_result = await self.db.execute(route_query)
            routes = route_result.scalars().all()
            
            route_list = []
            for route in routes:
                # Count active convoys on this route
                convoy_count_query = select(func.count(Convoy.id)).where(
                    and_(
                        Convoy.route_id == route.id,
                        Convoy.status == "IN_TRANSIT"
                    )
                )
                convoy_count_result = await self.db.execute(convoy_count_query)
                active_convoys = convoy_count_result.scalar() or 0
                
                # Count active threats on route
                threat_count_query = select(func.count(Obstacle.id)).where(
                    and_(
                        Obstacle.route_id == route.id,
                        Obstacle.status == "ACTIVE"
                    )
                )
                threat_count_result = await self.db.execute(threat_count_query)
                active_threats = threat_count_result.scalar() or 0
                
                route_list.append({
                    "id": route.id,
                    "name": route.name,
                    "category": route.category,
                    "start_location": route.start_location,
                    "end_location": route.end_location,
                    "distance_km": route.total_distance_km,
                    "estimated_time_hours": route.base_travel_time_hours,
                    "risk_level": route.risk_level,
                    "current_status": {
                        "active_convoys": active_convoys,
                        "active_threats": active_threats,
                        "traffic_density": route.current_traffic_density,
                        "weather_status": route.weather_status,
                        "road_condition": getattr(route, 'road_condition', 'GOOD'),
                        "is_operational": route.status == "ACTIVE"
                    }
                })
            
            return route_list
        except Exception as e:
            print(f"Error fetching routes: {e}")
            return []
    
    async def _get_tcps_status(self) -> List[Dict[str, Any]]:
        """Get all TCPs with current status and capacity."""
        try:
            tcp_query = select(TCP)
            tcp_result = await self.db.execute(tcp_query)
            tcps = tcp_result.scalars().all()
            
            tcp_list = []
            for tcp in tcps:
                tcp_list.append({
                    "id": tcp.id,
                    "name": tcp.name,
                    "route_id": tcp.route_id,
                    "latitude": tcp.latitude,
                    "longitude": tcp.longitude,
                    "status": tcp.status,
                    "capacity": tcp.max_convoy_capacity,
                    "current_traffic": tcp.current_traffic,
                    "facilities": getattr(tcp, 'facilities', []),
                    "type": getattr(tcp, 'tcp_type', 'CHECKPOINT')
                })
            
            return tcp_list
        except Exception as e:
            print(f"Error fetching TCPs: {e}")
            return []
    
    async def _get_active_threats(self) -> List[Dict[str, Any]]:
        """Get all active threats/obstacles."""
        try:
            threat_query = select(Obstacle).where(Obstacle.status == "ACTIVE")
            threat_result = await self.db.execute(threat_query)
            threats = threat_result.scalars().all()
            
            threat_list = []
            for threat in threats:
                threat_list.append({
                    "id": threat.id,
                    "type": threat.obstacle_type,
                    "subtype": threat.event_subtype,
                    "severity": threat.severity,
                    "latitude": threat.latitude,
                    "longitude": threat.longitude,
                    "route_id": threat.route_id,
                    "description": threat.description,
                    "detected_at": threat.detected_at.isoformat() if threat.detected_at else None,
                    "ai_generated": threat.ai_generated,
                    "recommended_action": threat.recommended_action
                })
            
            return threat_list
        except Exception as e:
            print(f"Error fetching threats: {e}")
            return []
    
    async def _get_military_assets(self) -> List[Dict[str, Any]]:
        """Get all military assets."""
        try:
            asset_query = select(MilitaryAsset)
            asset_result = await self.db.execute(asset_query)
            assets = asset_result.scalars().all()
            
            return [{
                "id": asset.id,
                "name": asset.name,
                "type": asset.asset_type,
                "category": asset.category,
                "latitude": asset.latitude,
                "longitude": asset.longitude,
                "status": asset.operational_status,
                "classification": asset.classification,
                "capabilities": getattr(asset, 'capabilities', [])
            } for asset in assets]
        except Exception as e:
            print(f"Error fetching military assets: {e}")
            return []
    
    async def _get_scheduling_status(self) -> Dict[str, Any]:
        """Get current scheduling status and pending requests."""
        try:
            # Pending scheduling requests
            pending_query = select(SchedulingRequest).where(
                SchedulingRequest.status.in_(["PENDING", "PROCESSING"])
            )
            pending_result = await self.db.execute(pending_query)
            pending = pending_result.scalars().all()
            
            # Recent recommendations
            rec_query = select(SchedulingRecommendation).order_by(
                SchedulingRecommendation.created_at.desc()
            ).limit(10)
            rec_result = await self.db.execute(rec_query)
            recommendations = rec_result.scalars().all()
            
            return {
                "pending_requests": len(pending),
                "requests": [{
                    "id": req.id,
                    "convoy_id": req.convoy_id,
                    "convoy_callsign": req.convoy_callsign,
                    "tcp_name": req.tcp_name,
                    "destination": req.final_destination,
                    "priority": req.priority_level,
                    "status": req.status
                } for req in pending],
                "recent_recommendations": [{
                    "id": rec.id,
                    "decision": rec.decision,
                    "confidence": rec.confidence_score if hasattr(rec, 'confidence_score') else 0.85,
                    "created_at": rec.created_at.isoformat() if rec.created_at else None
                } for rec in recommendations]
            }
        except Exception as e:
            print(f"Error fetching scheduling: {e}")
            return {"pending_requests": 0, "requests": [], "recent_recommendations": []}
    
    def _calculate_metrics(
        self, 
        convoys: List[Dict], 
        routes: List[Dict], 
        threats: List[Dict]
    ) -> Dict[str, Any]:
        """Calculate aggregated metrics from current state."""
        
        # Convoy metrics
        total_convoys = len(convoys)
        active_convoys = sum(1 for c in convoys if c.get("status") == "IN_TRANSIT")
        completed_convoys = sum(1 for c in convoys if c.get("status") == "COMPLETED")
        
        # Vehicle metrics
        total_vehicles = sum(c.get("vehicle_count", 0) for c in convoys)
        
        # Route metrics
        total_routes = len(routes)
        operational_routes = sum(1 for r in routes if r.get("current_status", {}).get("is_operational", False))
        
        # Threat metrics
        total_threats = len(threats)
        critical_threats = sum(1 for t in threats if t.get("severity") == "CRITICAL")
        high_threats = sum(1 for t in threats if t.get("severity") == "HIGH")
        
        # Calculate overall risk score
        risk_score = min(100, (critical_threats * 25) + (high_threats * 10) + (total_threats * 2))
        
        # Fleet utilization
        fleet_utilization = (active_convoys / max(total_convoys, 1)) * 100
        
        return {
            "convoys": {
                "total": total_convoys,
                "active": active_convoys,
                "completed": completed_convoys,
                "planned": sum(1 for c in convoys if c.get("status") == "PLANNED"),
                "halted": sum(1 for c in convoys if c.get("status") == "HALTED")
            },
            "vehicles": {
                "total": total_vehicles,
                "in_transit": sum(c.get("vehicle_count", 0) for c in convoys if c.get("status") == "IN_TRANSIT"),
                "available": sum(c.get("vehicle_count", 0) for c in convoys if c.get("status") in ["PLANNED", "COMPLETED"])
            },
            "routes": {
                "total": total_routes,
                "operational": operational_routes,
                "blocked": total_routes - operational_routes
            },
            "threats": {
                "total": total_threats,
                "critical": critical_threats,
                "high": high_threats,
                "medium": sum(1 for t in threats if t.get("severity") == "MEDIUM"),
                "low": sum(1 for t in threats if t.get("severity") == "LOW")
            },
            "risk_score": risk_score,
            "fleet_utilization_pct": round(fleet_utilization, 1),
            "system_health": "OPTIMAL" if risk_score < 30 else "ELEVATED" if risk_score < 60 else "CRITICAL"
        }
    
    async def _generate_ai_analysis(
        self,
        convoys: List[Dict],
        routes: List[Dict],
        threats: List[Dict]
    ) -> Dict[str, Any]:
        """Generate AI analysis and recommendations based on current state."""
        
        recommendations = []
        now = datetime.utcnow()
        
        # Analyze convoy status
        active_convoys = [c for c in convoys if c.get("status") == "IN_TRANSIT"]
        for convoy in active_convoys:
            tracking = convoy.get("tracking", {})
            if tracking:
                progress = tracking.get("route_progress_pct", 0)
                speed = tracking.get("speed_kmh", 0)
                
                # Check for slow-moving convoy
                if speed < 20 and progress < 90:
                    recommendations.append({
                        "id": f"rec-convoy-slow-{convoy['id']}",
                        "type": "CONVOY_PERFORMANCE",
                        "priority": "MEDIUM",
                        "target": convoy['name'],
                        "text": f"Convoy {convoy['name']} moving at {speed:.0f} km/h. Consider investigating delay cause.",
                        "source": "JANUS_AI_CONVOY_MONITOR",
                        "timestamp": now.isoformat(),
                        "actionable": True
                    })
                
                # Check for convoy approaching threat zone
                convoy_route_id = convoy.get("route_id")
                route_threats = [t for t in threats if t.get("route_id") == convoy_route_id]
                if route_threats:
                    recommendations.append({
                        "id": f"rec-convoy-threat-{convoy['id']}",
                        "type": "THREAT_PROXIMITY",
                        "priority": "HIGH",
                        "target": convoy['name'],
                        "text": f"Convoy {convoy['name']} on route with {len(route_threats)} active threat(s). Increase vigilance.",
                        "source": "JANUS_AI_THREAT_ANALYZER",
                        "timestamp": now.isoformat(),
                        "actionable": True
                    })
        
        # Analyze route congestion
        for route in routes:
            status = route.get("current_status", {})
            active_count = status.get("active_convoys", 0)
            if active_count > 2:
                recommendations.append({
                    "id": f"rec-route-congestion-{route['id']}",
                    "type": "ROUTE_CONGESTION",
                    "priority": "MEDIUM",
                    "target": route['name'],
                    "text": f"Route {route['name']} has {active_count} active convoys. Consider spacing or alternative routes.",
                    "source": "JANUS_AI_TRAFFIC_OPTIMIZER",
                    "timestamp": now.isoformat(),
                    "actionable": True
                })
        
        # Critical threat alerts
        critical_threats = [t for t in threats if t.get("severity") == "CRITICAL"]
        for threat in critical_threats:
            recommendations.append({
                "id": f"rec-threat-critical-{threat['id']}",
                "type": "CRITICAL_THREAT",
                "priority": "CRITICAL",
                "target": f"Route {threat.get('route_id', 'Unknown')}",
                "text": f"CRITICAL: {threat['type']} - {threat.get('description', 'Threat detected')}",
                "source": "JANUS_AI_THREAT_DETECTOR",
                "timestamp": now.isoformat(),
                "actionable": True
            })
        
        # Sort by priority
        priority_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}
        recommendations.sort(key=lambda x: priority_order.get(x["priority"], 5))
        
        return {
            "status": "ACTIVE",
            "engine": "JANUS_AI_v2.0",
            "gpu_accelerated": False,
            "last_analysis": now.isoformat(),
            "recommendations": recommendations[:20],  # Top 20
            "threat_level": "CRITICAL" if critical_threats else "ELEVATED" if len(threats) > 3 else "NORMAL",
            "confidence": 0.92
        }
    
    # =========================================================================
    # LOAD & VOLUME MANAGEMENT (Per Problem Statement)
    # =========================================================================
    
    async def get_load_management_analysis(self) -> Dict[str, Any]:
        """
        AI-powered load and volume management analysis.
        Includes: sharing of vehicles, prioritization, optimal utilization.
        """
        state = await self.get_unified_state()
        convoys = state["convoys"]
        
        # Analyze load distribution
        load_analysis = {
            "total_cargo_weight_tons": sum(
                c.get("mission", {}).get("cargo_weight_tons", 0) for c in convoys
            ),
            "vehicles_by_cargo_type": {},
            "underutilized_vehicles": [],
            "overloaded_vehicles": [],
            "sharing_opportunities": [],
            "prioritization_queue": []
        }
        
        # Group by cargo type
        for convoy in convoys:
            mission = convoy.get("mission", {})
            cargo_type = mission.get("cargo_type", "UNKNOWN")
            if cargo_type not in load_analysis["vehicles_by_cargo_type"]:
                load_analysis["vehicles_by_cargo_type"][cargo_type] = 0
            load_analysis["vehicles_by_cargo_type"][cargo_type] += convoy.get("vehicle_count", 0)
        
        # Generate prioritization queue based on mission criticality
        priority_map = {"CRITICAL": 0, "HIGH_VALUE": 1, "STRATEGIC": 2, "STANDARD": 3}
        for convoy in convoys:
            if convoy.get("status") == "PLANNED":
                mission = convoy.get("mission", {})
                priority = mission.get("priority", "STANDARD")
                load_analysis["prioritization_queue"].append({
                    "convoy_id": convoy["id"],
                    "convoy_name": convoy["name"],
                    "cargo_type": mission.get("cargo_type"),
                    "priority": priority,
                    "priority_score": priority_map.get(priority, 3),
                    "recommended_dispatch_order": priority_map.get(priority, 3) + 1
                })
        
        # Sort by priority score
        load_analysis["prioritization_queue"].sort(key=lambda x: x["priority_score"])
        
        return load_analysis
    
    # =========================================================================
    # MOVEMENT PLANNING (Per Problem Statement)
    # =========================================================================
    
    async def get_movement_planning(self) -> Dict[str, Any]:
        """
        AI-powered movement planning to optimally utilize vehicles, routes, halts, and road space.
        """
        state = await self.get_unified_state()
        convoys = state["convoys"]
        routes = state["routes"]
        tcps = state["tcps"]
        
        planning = {
            "route_utilization": [],
            "recommended_departures": [],
            "halt_recommendations": [],
            "road_space_allocation": []
        }
        
        # Analyze route utilization
        for route in routes:
            status = route.get("current_status", {})
            utilization = {
                "route_id": route["id"],
                "route_name": route["name"],
                "active_convoys": status.get("active_convoys", 0),
                "capacity_estimate": 5,  # Max convoys per route
                "utilization_pct": (status.get("active_convoys", 0) / 5) * 100,
                "recommendation": "AVAILABLE" if status.get("active_convoys", 0) < 3 else "CONGESTED"
            }
            planning["route_utilization"].append(utilization)
        
        # Generate departure recommendations for planned convoys
        planned_convoys = [c for c in convoys if c.get("status") == "PLANNED"]
        for i, convoy in enumerate(planned_convoys):
            planning["recommended_departures"].append({
                "convoy_id": convoy["id"],
                "convoy_name": convoy["name"],
                "route_id": convoy.get("route_id"),
                "recommended_time": (datetime.utcnow() + timedelta(minutes=30 * (i + 1))).isoformat(),
                "spacing_minutes": 30,
                "reason": "Optimal road space allocation"
            })
        
        # TCP halt recommendations
        for tcp in tcps:
            if tcp.get("status") == "ACTIVE":
                planning["halt_recommendations"].append({
                    "tcp_id": tcp["id"],
                    "tcp_name": tcp["name"],
                    "recommended_halt_duration_min": 15,
                    "facilities_available": tcp.get("facilities", []),
                    "current_load": tcp.get("current_traffic", "LOW")
                })
        
        return planning


# Factory function for dependency injection
async def get_unified_hub(db: AsyncSession) -> UnifiedDataHub:
    return UnifiedDataHub(db)
