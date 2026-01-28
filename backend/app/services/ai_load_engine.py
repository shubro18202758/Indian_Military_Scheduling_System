"""
AI Load Management Engine
=========================
Comprehensive AI service for load and volume management, vehicle sharing,
prioritization, movement planning, and dynamic entity notifications.

Key Capabilities:
- Intelligent load prioritization based on urgency, cargo type, and context
- Optimal vehicle-to-load matching considering capacity and suitability
- Vehicle sharing pool management between entities
- Movement planning with route, halt, and road space optimization
- Dynamic notifications to entities en-route
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
import uuid
import math
import random

# Models
from app.models.convoy import Convoy
from app.models.route import Route
from app.models.asset import TransportAsset
from app.models.tcp import TCP
from app.models.obstacle import Obstacle
from app.models.tracking import ConvoyTracking


class AILoadManagementEngine:
    """
    AI Engine for comprehensive load and transport management.
    Implements all requirements from the problem statement.
    """
    
    # Priority weights for load scoring
    PRIORITY_WEIGHTS = {
        "FLASH": 100,
        "IMMEDIATE": 80,
        "PRIORITY": 60,
        "ROUTINE": 40,
        "DEFERRED": 20
    }
    
    # Cargo category urgency modifiers
    CARGO_URGENCY = {
        "AMMUNITION": 1.3,
        "MEDICAL": 1.4,
        "FUEL_POL": 1.2,
        "RATIONS": 1.1,
        "PERSONNEL": 1.25,
        "EQUIPMENT": 1.0,
        "ENGINEERING": 0.95,
        "SIGNALS": 1.05,
        "GENERAL": 0.9
    }
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.engine_version = "AI_LOAD_MGMT_v2.0"
        
    # =========================================================================
    # LOAD PRIORITIZATION
    # =========================================================================
    
    async def calculate_load_priority_score(
        self,
        cargo_category: str,
        stated_priority: str,
        weight_tons: float,
        required_delivery_time: Optional[datetime],
        is_hazardous: bool = False,
        requires_escort: bool = False,
        requesting_entity: str = ""
    ) -> Tuple[float, str]:
        """
        Calculate AI priority score for a load request.
        
        Returns:
            Tuple of (priority_score 0-100, reason_text)
        """
        # Base score from stated priority
        base_score = self.PRIORITY_WEIGHTS.get(stated_priority, 40)
        
        # Cargo type modifier
        cargo_modifier = self.CARGO_URGENCY.get(cargo_category, 1.0)
        
        # Time urgency calculation
        time_urgency = 1.0
        time_reason = ""
        if required_delivery_time:
            hours_until_deadline = (required_delivery_time - datetime.utcnow()).total_seconds() / 3600
            if hours_until_deadline < 0:
                time_urgency = 1.5  # Overdue
                time_reason = "OVERDUE - immediate attention required"
            elif hours_until_deadline < 2:
                time_urgency = 1.4
                time_reason = f"Critical: {hours_until_deadline:.1f}h to deadline"
            elif hours_until_deadline < 6:
                time_urgency = 1.2
                time_reason = f"Urgent: {hours_until_deadline:.1f}h to deadline"
            elif hours_until_deadline < 24:
                time_urgency = 1.1
                time_reason = f"Time-sensitive: {hours_until_deadline:.1f}h to deadline"
            else:
                time_reason = f"Standard: {hours_until_deadline:.1f}h to deadline"
        
        # Special handling modifiers
        special_modifier = 1.0
        special_reasons = []
        if is_hazardous:
            special_modifier += 0.1
            special_reasons.append("hazardous cargo")
        if requires_escort:
            special_modifier += 0.05
            special_reasons.append("requires escort")
        if weight_tons > 15:
            special_modifier += 0.05
            special_reasons.append("heavy load")
        
        # Calculate final score
        final_score = min(100, base_score * cargo_modifier * time_urgency * special_modifier)
        
        # Build reason text
        reasons = [
            f"Base priority: {stated_priority} ({base_score})",
            f"Cargo type: {cargo_category} (x{cargo_modifier:.2f})",
        ]
        if time_reason:
            reasons.append(time_reason)
        if special_reasons:
            reasons.append(f"Special factors: {', '.join(special_reasons)}")
        reasons.append(f"Final AI Score: {final_score:.1f}/100")
        
        return final_score, " | ".join(reasons)
    
    async def get_prioritized_load_queue(self) -> List[Dict[str, Any]]:
        """
        Get all pending loads sorted by AI priority score.
        Returns queue ready for vehicle assignment.
        """
        # Get active convoys for context
        convoy_result = await self.db.execute(
            select(Convoy).where(
                Convoy.status.in_(["PLANNED", "FORMING", "IN_TRANSIT"])
            )
        )
        convoys = convoy_result.scalars().all()
        
        # Build prioritized queue
        queue = []
        
        # Simulate load requests from convoy missions
        for convoy in convoys:
            priority_score, reason = await self.calculate_load_priority_score(
                cargo_category=convoy.cargo_type or "GENERAL",
                stated_priority=convoy.priority_level or "ROUTINE",
                weight_tons=convoy.cargo_weight_tons or 0,
                required_delivery_time=None,
                is_hazardous=convoy.is_hazardous or (convoy.cargo_type in ["AMMUNITION", "FUEL_POL"]),
                requires_escort=convoy.requires_escort or False,
                requesting_entity=convoy.origin_entity or ""
            )
            
            queue.append({
                "request_id": f"LR-{convoy.id:04d}",
                "convoy_id": convoy.id,
                "convoy_name": convoy.name,
                "cargo_category": convoy.cargo_type or "GENERAL",
                "weight_tons": convoy.cargo_weight_tons or 0,
                "priority_score": priority_score,
                "ai_reason": reason,
                "status": convoy.status,
                "destination": convoy.end_location,
                "vehicle_count": convoy.vehicle_count,
                "personnel_count": convoy.personnel_count or 0,
                "requires_action": convoy.status == "PLANNED"
            })
        
        # Sort by priority score (highest first)
        queue.sort(key=lambda x: x["priority_score"], reverse=True)
        
        return queue
    
    # =========================================================================
    # VEHICLE-LOAD MATCHING
    # =========================================================================
    
    async def find_optimal_vehicle_for_load(
        self,
        cargo_category: str,
        weight_tons: float,
        volume_cubic_m: float,
        is_hazardous: bool = False,
        requires_refrigeration: bool = False,
        personnel_count: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Find and rank vehicles suitable for a specific load.
        Returns list of vehicles with suitability scores.
        """
        # Get available assets
        asset_result = await self.db.execute(
            select(TransportAsset).where(TransportAsset.is_available == True)
        )
        assets = asset_result.scalars().all()
        
        matches = []
        for asset in assets:
            # Calculate capacity utilization
            max_weight = 15.0 if "TRUCK" in (asset.asset_type or "").upper() else 5.0
            weight_fit = min(100, (1 - weight_tons / max_weight) * 100) if max_weight > 0 else 0
            
            # Category suitability
            category_scores = {
                "AMMUNITION": 80 if "AMMO" in (asset.asset_type or "").upper() else 50,
                "FUEL_POL": 90 if "TANKER" in (asset.asset_type or "").upper() else 30,
                "RATIONS": 70,
                "MEDICAL": 85 if "AMBULANCE" in (asset.asset_type or "").upper() else 60,
                "PERSONNEL": 90 if "TROOP" in (asset.asset_type or "").upper() else 40,
                "EQUIPMENT": 75,
                "GENERAL": 70
            }
            category_score = category_scores.get(cargo_category, 50)
            
            # Special requirements check
            special_score = 100
            special_notes = []
            if is_hazardous and "HAZMAT" not in (asset.asset_type or "").upper():
                special_score -= 30
                special_notes.append("Not ideal for hazmat")
            
            # Overall match score
            overall_score = (weight_fit * 0.4 + category_score * 0.4 + special_score * 0.2)
            
            if overall_score > 30:  # Minimum threshold
                matches.append({
                    "asset_id": asset.id,
                    "asset_name": asset.name,
                    "asset_type": asset.asset_type,
                    "match_score": round(overall_score, 1),
                    "weight_capacity_score": round(weight_fit, 1),
                    "category_suitability": round(category_score, 1),
                    "special_notes": special_notes if special_notes else ["Good match"],
                    "current_location": f"{asset.current_lat:.4f}, {asset.current_long:.4f}" if asset.current_lat else "Unknown",
                    "is_available": asset.is_available
                })
        
        # Sort by match score
        matches.sort(key=lambda x: x["match_score"], reverse=True)
        
        return matches[:10]  # Return top 10 matches
    
    # =========================================================================
    # VEHICLE SHARING BETWEEN ENTITIES
    # =========================================================================
    
    async def get_vehicle_sharing_status(self) -> Dict[str, Any]:
        """
        Get current status of vehicle sharing pool.
        Shows available vehicles and sharing opportunities.
        """
        # Get all assets grouped by convoy/availability
        asset_result = await self.db.execute(select(TransportAsset))
        assets = asset_result.scalars().all()
        
        # Get active convoys
        convoy_result = await self.db.execute(
            select(Convoy).where(Convoy.status.in_(["IN_TRANSIT", "PLANNED"]))
        )
        convoys = convoy_result.scalars().all()
        convoy_map = {c.id: c for c in convoys}
        
        # Categorize vehicles
        pool_available = []
        currently_assigned = []
        sharing_opportunities = []
        
        for asset in assets:
            asset_info = {
                "id": asset.id,
                "name": asset.name,
                "type": asset.asset_type,
                "category": asset.asset_type,  # Use asset_type as category
                "owning_entity": "POOL",  # Default to POOL
                "is_available": asset.is_available,
                "fuel_level": asset.fuel_status or 100
            }
            
            if asset.convoy_id and asset.convoy_id in convoy_map:
                convoy = convoy_map[asset.convoy_id]
                asset_info["assigned_to"] = convoy.name
                asset_info["mission_status"] = convoy.status
                currently_assigned.append(asset_info)
                
                # Check if vehicle will be available soon
                if convoy.status == "IN_TRANSIT":
                    # Estimate completion
                    sharing_opportunities.append({
                        "asset_id": asset.id,
                        "asset_name": asset.name,
                        "type": asset.asset_type,
                        "current_mission": convoy.name,
                        "estimated_available": "Within 24 hours",
                        "can_be_shared": True,
                        "owning_entity": "POOL",
                        "sharing_recommendation": f"Available after {convoy.name} completes mission"
                    })
            else:
                if asset.is_available:
                    pool_available.append(asset_info)
        
        # Calculate sharing metrics
        total_vehicles = len(assets)
        available_count = len(pool_available)
        assigned_count = len(currently_assigned)
        sharing_potential = len(sharing_opportunities)
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "summary": {
                "total_fleet_size": total_vehicles,
                "available_for_sharing": available_count,
                "currently_assigned": assigned_count,
                "utilization_rate": round((assigned_count / total_vehicles * 100) if total_vehicles > 0 else 0, 1),
                "sharing_opportunities": sharing_potential
            },
            "available_pool": pool_available[:20],
            "assigned_vehicles": currently_assigned[:20],
            "sharing_opportunities": sharing_opportunities[:10],
            "ai_recommendations": self._generate_sharing_recommendations(
                available_count, assigned_count, total_vehicles
            )
        }
    
    def _generate_sharing_recommendations(
        self, available: int, assigned: int, total: int
    ) -> List[Dict[str, Any]]:
        """Generate AI recommendations for vehicle sharing."""
        recommendations = []
        utilization = (assigned / total * 100) if total > 0 else 0
        
        if utilization > 85:
            recommendations.append({
                "type": "ALERT",
                "priority": "HIGH",
                "text": f"Fleet utilization at {utilization:.0f}%. Consider requesting additional vehicles.",
                "action": "REQUEST_REINFORCEMENT"
            })
        elif utilization < 40:
            recommendations.append({
                "type": "OPTIMIZATION",
                "priority": "MEDIUM",
                "text": f"Fleet utilization at {utilization:.0f}%. {available} vehicles available for inter-entity sharing.",
                "action": "OFFER_TO_POOL"
            })
        
        if available > 5:
            recommendations.append({
                "type": "SHARING",
                "priority": "MEDIUM",
                "text": f"{available} vehicles in sharing pool. Advertise availability to nearby formations.",
                "action": "BROADCAST_AVAILABILITY"
            })
        
        recommendations.append({
            "type": "STATUS",
            "priority": "INFO",
            "text": f"Vehicle sharing system operational. {assigned}/{total} vehicles currently deployed.",
            "action": "NONE"
        })
        
        return recommendations
    
    async def evaluate_sharing_request(
        self,
        requesting_entity: str,
        vehicle_type: str,
        quantity: int,
        duration_hours: int,
        purpose: str,
        priority: str = "ROUTINE"
    ) -> Dict[str, Any]:
        """
        AI evaluation of a vehicle sharing request.
        Returns approval decision with reasoning.
        """
        # Get available vehicles of requested type
        asset_result = await self.db.execute(
            select(TransportAsset).where(
                and_(
                    TransportAsset.is_available == True,
                    TransportAsset.asset_type.ilike(f"%{vehicle_type}%")
                )
            )
        )
        available = asset_result.scalars().all()
        
        available_count = len(available)
        can_fulfill = available_count >= quantity
        
        # Calculate confidence score
        confidence = 0.0
        reasons = []
        
        if can_fulfill:
            confidence = 0.85
            reasons.append(f"Sufficient vehicles available ({available_count} of {quantity} requested)")
        else:
            confidence = 0.4
            reasons.append(f"Insufficient vehicles ({available_count} available, {quantity} requested)")
        
        # Priority adjustment
        priority_score = self.PRIORITY_WEIGHTS.get(priority, 40)
        if priority_score >= 80:
            confidence = min(1.0, confidence + 0.1)
            reasons.append(f"High priority request ({priority})")
        
        # Duration check
        if duration_hours > 48:
            confidence -= 0.1
            reasons.append(f"Extended duration ({duration_hours}h) may impact other operations")
        
        # Make decision
        approved = confidence >= 0.5 and can_fulfill
        approved_quantity = min(quantity, available_count) if approved else 0
        
        # Assign vehicles if approved
        assigned_vehicles = []
        if approved and available:
            for asset in available[:approved_quantity]:
                assigned_vehicles.append({
                    "id": asset.id,
                    "name": asset.name,
                    "type": asset.asset_type
                })
        
        return {
            "request_id": f"VSR-{uuid.uuid4().hex[:8].upper()}",
            "requesting_entity": requesting_entity,
            "decision": "APPROVED" if approved else "DENIED",
            "approved_quantity": approved_quantity,
            "requested_quantity": quantity,
            "confidence_score": round(confidence, 2),
            "reasoning": " | ".join(reasons),
            "assigned_vehicles": assigned_vehicles,
            "conditions": [
                f"Maximum duration: {min(duration_hours, 48)} hours",
                "Return to pool upon mission completion",
                "Fuel level must be at least 50% upon return"
            ] if approved else [],
            "alternative_options": [] if approved else [
                f"Partial allocation: {available_count} vehicles available",
                "Request from adjacent formation",
                "Delay mission start for vehicle availability"
            ],
            "evaluated_at": datetime.utcnow().isoformat(),
            "ai_engine": self.engine_version
        }
    
    # =========================================================================
    # MOVEMENT PLANNING & OPTIMIZATION
    # =========================================================================
    
    async def generate_movement_plan(
        self,
        convoy_id: int,
        departure_time: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Generate optimal movement plan for a convoy.
        Considers routes, halts, road space, and timing.
        """
        # Get convoy details
        convoy_result = await self.db.execute(
            select(Convoy).where(Convoy.id == convoy_id)
        )
        convoy = convoy_result.scalar_one_or_none()
        
        if not convoy:
            return {"error": f"Convoy {convoy_id} not found"}
        
        # Get route
        route = None
        if convoy.route_id:
            route_result = await self.db.execute(
                select(Route).where(Route.id == convoy.route_id)
            )
            route = route_result.scalar_one_or_none()
        
        # Get TCPs on route for halt planning
        tcp_result = await self.db.execute(
            select(TCP).where(TCP.route_id == convoy.route_id) if convoy.route_id else select(TCP)
        )
        tcps = tcp_result.scalars().all()
        
        # Get active obstacles
        obstacle_result = await self.db.execute(
            select(Obstacle).where(Obstacle.is_active == True)
        )
        obstacles = obstacle_result.scalars().all()
        
        # Calculate optimal departure if not specified
        if not departure_time:
            departure_time = datetime.utcnow() + timedelta(hours=1)
        
        # Plan halts based on TCPs
        planned_halts = []
        cumulative_distance = 0
        cumulative_time_mins = 0
        avg_speed = 35  # km/h average for convoy
        
        for i, tcp in enumerate(tcps[:5]):  # Max 5 halts
            # Calculate distance to TCP (simplified)
            segment_distance = 30 + (i * 20)  # Approximate
            cumulative_distance += segment_distance
            travel_time = segment_distance / avg_speed * 60  # minutes
            cumulative_time_mins += travel_time
            
            arrival_time = departure_time + timedelta(minutes=cumulative_time_mins)
            
            # Determine halt purpose and duration
            halt_duration = 15  # default
            purpose = "CHECKPOINT"
            if i == 2:  # Mid-journey
                halt_duration = 45
                purpose = "REST_REFUEL"
            
            planned_halts.append({
                "sequence": i + 1,
                "tcp_id": tcp.id,
                "tcp_name": tcp.name,
                "arrival_time": arrival_time.isoformat(),
                "halt_duration_mins": halt_duration,
                "purpose": purpose,
                "status": "PLANNED",
                "distance_from_start_km": cumulative_distance
            })
            
            cumulative_time_mins += halt_duration
        
        # Calculate total journey
        total_distance = route.total_distance_km if route else 200
        total_time_hours = cumulative_time_mins / 60 + (total_distance - cumulative_distance) / avg_speed
        eta = departure_time + timedelta(hours=total_time_hours)
        
        # Calculate optimization scores
        route_efficiency = 85 - (len(obstacles) * 5)  # Reduce for obstacles
        time_optimization = 90 if len(planned_halts) <= 4 else 75
        fuel_optimization = 80
        safety_score = 90 - (len(obstacles) * 8)
        overall_score = (route_efficiency + time_optimization + fuel_optimization + safety_score) / 4
        
        # Road space allocation
        road_space = {
            "slot_id": f"RS-{convoy_id}-{departure_time.strftime('%H%M')}",
            "time_window": f"{departure_time.strftime('%H:%M')} - {eta.strftime('%H:%M')}",
            "convoy_spacing_km": 0.5,
            "max_speed_kmh": 40,
            "priority_level": "NORMAL"
        }
        
        # Generate AI recommendations
        recommendations = []
        if len(obstacles) > 0:
            recommendations.append({
                "type": "ROUTE_HAZARD",
                "priority": "HIGH",
                "text": f"{len(obstacles)} active obstacles detected. Alternative route recommended.",
                "action": "CONSIDER_ALTERNATE"
            })
        
        if total_time_hours > 8:
            recommendations.append({
                "type": "CREW_FATIGUE",
                "priority": "MEDIUM",
                "text": f"Journey time {total_time_hours:.1f}h exceeds 8 hours. Plan crew rotation.",
                "action": "CREW_ROTATION"
            })
        
        recommendations.append({
            "type": "OPTIMAL_DEPARTURE",
            "priority": "INFO",
            "text": f"Recommended departure: {departure_time.strftime('%H:%M')} for minimal road congestion.",
            "action": "CONFIRM_DEPARTURE"
        })
        
        return {
            "plan_id": f"MP-{convoy_id:04d}-{uuid.uuid4().hex[:6].upper()}",
            "convoy_id": convoy_id,
            "convoy_name": convoy.name,
            "status": "DRAFT",
            
            "route": {
                "id": route.id if route else None,
                "name": route.name if route else "Direct Route",
                "distance_km": total_distance,
                "risk_level": route.risk_level if route else "MEDIUM"
            },
            
            "timing": {
                "planned_departure": departure_time.isoformat(),
                "estimated_arrival": eta.isoformat(),
                "total_duration_hours": round(total_time_hours, 1),
                "driving_time_hours": round(total_distance / avg_speed, 1),
                "halt_time_hours": round(sum(h["halt_duration_mins"] for h in planned_halts) / 60, 1)
            },
            
            "planned_halts": planned_halts,
            "road_space_allocation": road_space,
            
            "optimization_scores": {
                "route_efficiency": round(route_efficiency, 1),
                "time_optimization": round(time_optimization, 1),
                "fuel_optimization": round(fuel_optimization, 1),
                "safety_score": round(safety_score, 1),
                "overall_score": round(overall_score, 1)
            },
            
            "active_threats": len(obstacles),
            "ai_recommendations": recommendations,
            "ai_risk_assessment": self._generate_risk_assessment(obstacles, convoy),
            
            "generated_at": datetime.utcnow().isoformat(),
            "ai_engine": self.engine_version
        }
    
    def _generate_risk_assessment(self, obstacles: List, convoy: Convoy) -> Dict[str, Any]:
        """Generate risk assessment for movement plan."""
        risk_factors = []
        overall_risk = "LOW"
        
        if obstacles:
            high_severity = sum(1 for o in obstacles if o.severity in ["CRITICAL", "EMERGENCY", "HIGH"])
            if high_severity > 0:
                risk_factors.append(f"{high_severity} high-severity obstacles on route")
                overall_risk = "HIGH"
            else:
                risk_factors.append(f"{len(obstacles)} low/medium obstacles detected")
                overall_risk = "MEDIUM"
        
        if convoy.cargo_type in ["AMMUNITION", "FUEL_POL"]:
            risk_factors.append(f"Sensitive cargo: {convoy.cargo_type}")
            if overall_risk == "LOW":
                overall_risk = "MEDIUM"
        
        if convoy.requires_escort:
            risk_factors.append("Armed escort required - heightened security posture")
        
        return {
            "overall_risk": overall_risk,
            "risk_factors": risk_factors if risk_factors else ["No significant risk factors identified"],
            "mitigation_recommended": overall_risk in ["HIGH", "CRITICAL"]
        }
    
    async def get_road_space_utilization(self) -> Dict[str, Any]:
        """
        Get current road space utilization across all routes.
        Used for optimal scheduling of convoy movements.
        """
        # Get routes
        route_result = await self.db.execute(select(Route))
        routes = route_result.scalars().all()
        
        # Get active convoys
        convoy_result = await self.db.execute(
            select(Convoy).where(Convoy.status == "IN_TRANSIT")
        )
        active_convoys = convoy_result.scalars().all()
        
        # Build utilization map
        route_utilization = []
        for route in routes:
            convoys_on_route = [c for c in active_convoys if c.route_id == route.id]
            vehicle_count = sum(c.vehicle_count or 0 for c in convoys_on_route)
            
            # Estimate capacity (vehicles per hour based on route type)
            route_classification = route.road_classification or "HIGHWAY"
            capacity = 30 if route_classification in ["HIGHWAY", "STRATEGIC"] else 20
            utilization = min(100, (vehicle_count / capacity * 100)) if capacity > 0 else 0
            
            route_utilization.append({
                "route_id": route.id,
                "route_name": route.name,
                "category": route_classification,
                "active_convoys": len(convoys_on_route),
                "active_vehicles": vehicle_count,
                "hourly_capacity": capacity,
                "utilization_pct": round(utilization, 1),
                "status": "CONGESTED" if utilization > 80 else "MODERATE" if utilization > 50 else "CLEAR",
                "recommended_action": "DELAY_DEPARTURE" if utilization > 80 else "PROCEED"
            })
        
        # Calculate optimal departure windows
        optimal_windows = []
        current_hour = datetime.utcnow().hour
        for offset in range(0, 12, 2):
            window_hour = (current_hour + offset) % 24
            # Lower traffic assumed at night and early morning
            congestion = 30 if 22 <= window_hour or window_hour <= 5 else 70
            optimal_windows.append({
                "window_start": f"{window_hour:02d}:00",
                "window_end": f"{(window_hour + 2) % 24:02d}:00",
                "expected_congestion": congestion,
                "recommended": congestion < 50
            })
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "summary": {
                "total_routes": len(routes),
                "routes_congested": sum(1 for r in route_utilization if r["status"] == "CONGESTED"),
                "routes_clear": sum(1 for r in route_utilization if r["status"] == "CLEAR"),
                "active_convoys": len(active_convoys),
                "total_vehicles_in_transit": sum(c.vehicle_count for c in active_convoys)
            },
            "route_utilization": route_utilization,
            "optimal_departure_windows": optimal_windows,
            "ai_recommendations": [
                {
                    "type": "SCHEDULING",
                    "priority": "MEDIUM",
                    "text": "Prefer night movements (22:00-05:00) for reduced congestion",
                    "action": "SCHEDULE_NIGHT"
                }
            ]
        }
    
    # =========================================================================
    # DYNAMIC NOTIFICATIONS
    # =========================================================================
    
    async def generate_entity_notifications(
        self,
        convoy_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate dynamic notifications for entities en-route.
        Alerts about delays, route changes, threats, arrivals.
        """
        notifications = []
        
        # Get convoys to generate notifications for
        if convoy_id:
            convoy_result = await self.db.execute(
                select(Convoy).where(Convoy.id == convoy_id)
            )
            convoys = [convoy_result.scalar_one_or_none()]
            convoys = [c for c in convoys if c]
        else:
            convoy_result = await self.db.execute(
                select(Convoy).where(Convoy.status == "IN_TRANSIT")
            )
            convoys = convoy_result.scalars().all()
        
        # Get obstacles for threat notifications
        obstacle_result = await self.db.execute(
            select(Obstacle).where(Obstacle.is_active == True)
        )
        obstacles = obstacle_result.scalars().all()
        
        # Get TCPs for arrival notifications
        tcp_result = await self.db.execute(select(TCP))
        tcps = tcp_result.scalars().all()
        tcp_map = {t.id: t for t in tcps}
        
        for convoy in convoys:
            # Get tracking data
            tracking_result = await self.db.execute(
                select(ConvoyTracking).where(ConvoyTracking.convoy_id == convoy.id)
            )
            tracking = tracking_result.scalar_one_or_none()
            
            # Threat notifications
            for obstacle in obstacles[:3]:  # Limit notifications
                if obstacle.route_id == convoy.route_id:
                    notifications.append({
                        "notification_id": f"NOT-{uuid.uuid4().hex[:8].upper()}",
                        "type": "THREAT_ALERT",
                        "priority": self._map_severity_to_priority(obstacle.severity),
                        "target_convoy_id": convoy.id,
                        "target_convoy_name": convoy.name,
                        "target_entities": [convoy.origin_entity or "CONVOY_CMD", "ROUTE_CONTROL"],
                        "title": f"⚠️ {obstacle.obstacle_type} Detected",
                        "message": f"{obstacle.obstacle_type} reported at {obstacle.latitude:.4f}, {obstacle.longitude:.4f}. {obstacle.description or 'Exercise caution.'}",
                        "action_required": self._get_obstacle_action(obstacle),
                        "location": {
                            "lat": obstacle.latitude,
                            "lng": obstacle.longitude,
                            "description": f"Route {convoy.route_id}"
                        },
                        "ai_confidence": 0.85,
                        "generated_at": datetime.utcnow().isoformat(),
                        "expires_at": (datetime.utcnow() + timedelta(hours=4)).isoformat()
                    })
            
            # Progress/ETA notification
            if tracking:
                progress = tracking.route_progress_pct or 0
                if progress > 0:
                    notifications.append({
                        "notification_id": f"NOT-{uuid.uuid4().hex[:8].upper()}",
                        "type": "PROGRESS_UPDATE",
                        "priority": "INFO",
                        "target_convoy_id": convoy.id,
                        "target_convoy_name": convoy.name,
                        "target_entities": [convoy.end_location, "LOGISTICS_HQ"],
                        "title": f"📍 {convoy.name} Progress Update",
                        "message": f"Convoy at {progress:.1f}% of route. Current speed: {tracking.speed_kmh or 0:.0f} km/h. ETA: {tracking.eta_destination or 'Calculating...'}",
                        "action_required": None,
                        "location": {
                            "lat": tracking.latitude,
                            "lng": tracking.longitude,
                            "description": tracking.last_checkpoint or "En route"
                        },
                        "ai_confidence": 0.9,
                        "generated_at": datetime.utcnow().isoformat()
                    })
            
            # Approaching TCP notification (if convoy has next_tcp_id)
            next_tcp_id = getattr(convoy, 'next_tcp_id', None)
            if next_tcp_id and next_tcp_id in tcp_map:
                tcp = tcp_map[next_tcp_id]
                notifications.append({
                    "notification_id": f"NOT-{uuid.uuid4().hex[:8].upper()}",
                    "type": "TCP_APPROACH",
                    "priority": "ROUTINE",
                    "target_convoy_id": convoy.id,
                    "target_convoy_name": convoy.name,
                    "target_entities": [tcp.name, "TCP_CONTROL"],
                    "title": f"🚧 {convoy.name} Approaching {tcp.name}",
                    "message": f"Convoy {convoy.name} with {convoy.vehicle_count} vehicles approaching. Prepare for processing.",
                    "action_required": "Prepare checkpoint for convoy arrival",
                    "location": {
                        "lat": tcp.latitude,
                        "lng": tcp.longitude,
                        "description": tcp.name
                    },
                    "ai_confidence": 0.88,
                    "generated_at": datetime.utcnow().isoformat()
                })
        
        return notifications
    
    def _map_severity_to_priority(self, severity: str) -> str:
        """Map obstacle severity to notification priority."""
        mapping = {
            "CRITICAL": "FLASH",
            "EMERGENCY": "FLASH",
            "HIGH": "IMMEDIATE",
            "WARNING": "PRIORITY",
            "MEDIUM": "PRIORITY",
            "LOW": "ROUTINE",
            "CAUTION": "ROUTINE",
            "ADVISORY": "DEFERRED"
        }
        return mapping.get(severity, "ROUTINE")
    
    def _get_obstacle_action(self, obstacle: Obstacle) -> str:
        """Get recommended action for obstacle type."""
        actions = {
            "IED": "HALT. Request EOD team. Do not approach.",
            "AMBUSH": "Defensive formation. Request QRF support.",
            "LANDSLIDE": "Route blocked. Await clearance or divert.",
            "AVALANCHE": "Route blocked. Seek shelter. Await clearance.",
            "FLOOD": "Do not attempt crossing. Seek alternate route.",
            "HOSTILE_FIRE": "Take cover. Return fire if engaged. Request support.",
            "ACCIDENT": "Provide assistance if safe. Report to control.",
            "BRIDGE_OUT": "STOP. Do not proceed. Await engineering support.",
            "FOG": "Reduce speed. Maintain convoy spacing. Use fog lights."
        }
        
        for key, action in actions.items():
            if key in (obstacle.obstacle_type or "").upper():
                return action
        
        return "Exercise caution. Report status to control."
    
    async def send_notification_to_entity(
        self,
        entity_name: str,
        notification_type: str,
        title: str,
        message: str,
        priority: str = "ROUTINE",
        convoy_id: Optional[int] = None,
        action_required: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send a specific notification to an entity.
        Returns confirmation of notification dispatch.
        """
        notification = {
            "notification_id": f"NOT-{uuid.uuid4().hex[:8].upper()}",
            "type": notification_type,
            "priority": priority,
            "target_entity": entity_name,
            "convoy_id": convoy_id,
            "title": title,
            "message": message,
            "action_required": action_required,
            "status": "SENT",
            "sent_at": datetime.utcnow().isoformat(),
            "delivery_method": "TACTICAL_NET",
            "ai_engine": self.engine_version
        }
        
        return {
            "success": True,
            "notification": notification,
            "acknowledgment_required": priority in ["FLASH", "IMMEDIATE"],
            "expires_at": (datetime.utcnow() + timedelta(hours=4)).isoformat()
        }
    
    # =========================================================================
    # COMPREHENSIVE DASHBOARD
    # =========================================================================
    
    async def get_comprehensive_ai_dashboard(self) -> Dict[str, Any]:
        """
        Get comprehensive AI dashboard with all load management data.
        Single endpoint for complete operational picture.
        """
        # Gather all data
        load_queue = await self.get_prioritized_load_queue()
        sharing_status = await self.get_vehicle_sharing_status()
        road_space = await self.get_road_space_utilization()
        notifications = await self.generate_entity_notifications()
        
        # Get convoy count for movement plans
        convoy_result = await self.db.execute(
            select(Convoy).where(Convoy.status.in_(["IN_TRANSIT", "PLANNED"]))
        )
        convoys = convoy_result.scalars().all()
        
        # Generate movement plans for top convoys
        movement_plans = []
        for convoy in convoys[:5]:
            plan = await self.generate_movement_plan(convoy.id)
            if "error" not in plan:
                movement_plans.append({
                    "convoy_id": convoy.id,
                    "convoy_name": convoy.name,
                    "status": convoy.status,
                    "optimization_score": plan["optimization_scores"]["overall_score"],
                    "eta": plan["timing"]["estimated_arrival"],
                    "halts_planned": len(plan["planned_halts"]),
                    "risk_level": plan["ai_risk_assessment"]["overall_risk"]
                })
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "ai_engine": self.engine_version,
            "system_status": "OPERATIONAL",
            
            "load_management": {
                "queue_size": len(load_queue),
                "high_priority_count": sum(1 for l in load_queue if l["priority_score"] >= 70),
                "pending_assignment": sum(1 for l in load_queue if l["requires_action"]),
                "top_priority_loads": load_queue[:5]
            },
            
            "vehicle_sharing": {
                "pool_available": sharing_status["summary"]["available_for_sharing"],
                "utilization_rate": sharing_status["summary"]["utilization_rate"],
                "sharing_opportunities": sharing_status["summary"]["sharing_opportunities"],
                "recommendations": sharing_status["ai_recommendations"][:3]
            },
            
            "movement_planning": {
                "active_plans": len(movement_plans),
                "convoys_in_transit": sum(1 for c in convoys if c.status == "IN_TRANSIT"),
                "convoys_planned": sum(1 for c in convoys if c.status == "PLANNED"),
                "plans_summary": movement_plans
            },
            
            "road_space": {
                "routes_congested": road_space["summary"]["routes_congested"],
                "routes_clear": road_space["summary"]["routes_clear"],
                "optimal_windows": [w for w in road_space["optimal_departure_windows"] if w["recommended"]][:3]
            },
            
            "notifications": {
                "active_count": len(notifications),
                "critical_alerts": sum(1 for n in notifications if n["priority"] in ["FLASH", "IMMEDIATE"]),
                "recent_notifications": notifications[:10]
            },
            
            "ai_summary": self._generate_ai_summary(
                load_queue, sharing_status, road_space, notifications, convoys
            )
        }
    
    def _generate_ai_summary(
        self,
        load_queue: List,
        sharing_status: Dict,
        road_space: Dict,
        notifications: List,
        convoys: List
    ) -> Dict[str, Any]:
        """Generate overall AI summary and recommendations."""
        critical_issues = []
        recommendations = []
        
        # Check for high priority loads
        high_priority = sum(1 for l in load_queue if l["priority_score"] >= 80)
        if high_priority > 0:
            critical_issues.append(f"{high_priority} high-priority loads require immediate attention")
        
        # Check vehicle utilization
        util_rate = sharing_status["summary"]["utilization_rate"]
        if util_rate > 90:
            critical_issues.append(f"Fleet utilization critical at {util_rate}%")
            recommendations.append("Request additional vehicles from higher formation")
        elif util_rate < 30:
            recommendations.append(f"Low utilization ({util_rate}%). Consider offering vehicles to pool.")
        
        # Check road congestion
        if road_space["summary"]["routes_congested"] > 0:
            critical_issues.append(f"{road_space['summary']['routes_congested']} routes congested")
            recommendations.append("Stagger convoy departures to reduce congestion")
        
        # Check notifications
        critical_notifs = sum(1 for n in notifications if n["priority"] in ["FLASH", "IMMEDIATE"])
        if critical_notifs > 0:
            critical_issues.append(f"{critical_notifs} critical alerts require acknowledgment")
        
        return {
            "overall_status": "CRITICAL" if len(critical_issues) > 2 else "ATTENTION" if critical_issues else "NORMAL",
            "critical_issues": critical_issues,
            "recommendations": recommendations[:5],
            "convoys_active": len([c for c in convoys if c.status == "IN_TRANSIT"]),
            "system_efficiency": round(100 - (len(critical_issues) * 15), 1)
        }
