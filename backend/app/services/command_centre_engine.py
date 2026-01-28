"""
Command Centre Engine
======================
भारतीय सेना (Indian Army) Logistics Command Centre

Comprehensive AI-powered engine for:
- Load Management & Prioritization
- Vehicle Sharing Optimization
- Movement Planning & Coordination
- Dynamic Entity Notifications
- Road Space Management

Security Classification: प्रतिबंधित (RESTRICTED)
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc, asc
from sqlalchemy.orm import selectinload
import uuid
import math
import random

from app.models.convoy import Convoy
from app.models.route import Route
from app.models.asset import TransportAsset
from app.models.tcp import TCP, TCPCrossing
from app.models.transit_camp import TransitCamp, HaltRequest
from app.models.obstacle import Obstacle
from app.models.command_centre import (
    MilitaryEntity, LoadAssignment, LoadItem, VehicleSharingRequest,
    VehiclePoolStatus, MovementPlan, MovementWaypoint, RoadSpaceAllocation,
    EntityNotification, CommandCentreMetrics, EntityType, LoadPriority,
    LoadCategory, SharingStatus, MovementPlanStatus, NotificationType,
    RoadSpaceStatus
)

logger = logging.getLogger(__name__)


# ============================================================================
# LOAD PRIORITY WEIGHTS (Realistic Military Logistics)
# ============================================================================
PRIORITY_WEIGHTS = {
    LoadPriority.CRITICAL.value: 1.0,
    LoadPriority.HIGH.value: 0.8,
    LoadPriority.MEDIUM.value: 0.5,
    LoadPriority.LOW.value: 0.3,
    LoadPriority.ROUTINE.value: 0.1,
}

CATEGORY_URGENCY = {
    LoadCategory.AMMUNITION.value: 0.95,
    LoadCategory.MEDICAL.value: 0.90,
    LoadCategory.FUEL_POL.value: 0.85,
    LoadCategory.RATIONS.value: 0.75,
    LoadCategory.PERSONNEL.value: 0.70,
    LoadCategory.COMMUNICATION.value: 0.65,
    LoadCategory.EQUIPMENT.value: 0.50,
    LoadCategory.VEHICLES.value: 0.45,
    LoadCategory.CONSTRUCTION.value: 0.30,
    LoadCategory.GENERAL.value: 0.20,
}

# Vehicle Types with typical capacities (tons)
VEHICLE_TYPES = {
    "TATRA": {"capacity": 12.0, "terrain": ["PLAINS", "MOUNTAINOUS", "DESERT"]},
    "STALLION": {"capacity": 10.0, "terrain": ["PLAINS", "MOUNTAINOUS"]},
    "SHAKTIMAN": {"capacity": 5.0, "terrain": ["PLAINS", "MOUNTAINOUS", "DESERT"]},
    "TRUCK_10T": {"capacity": 10.0, "terrain": ["PLAINS", "MOUNTAINOUS"]},
    "TRUCK_5T": {"capacity": 5.0, "terrain": ["PLAINS", "MOUNTAINOUS", "DESERT"]},
    "ALS": {"capacity": 2.0, "terrain": ["PLAINS", "MOUNTAINOUS", "DESERT", "MIXED"]},
    "JEEP": {"capacity": 0.5, "terrain": ["PLAINS", "MOUNTAINOUS", "DESERT", "MIXED"]},
    "TANKER_POL": {"capacity": 15.0, "terrain": ["PLAINS", "MOUNTAINOUS"]},
    "TANKER_WATER": {"capacity": 10.0, "terrain": ["PLAINS", "MOUNTAINOUS", "DESERT"]},
    "RECOVERY": {"capacity": 0.0, "terrain": ["PLAINS", "MOUNTAINOUS", "DESERT", "MIXED"]},
    "AMBULANCE": {"capacity": 1.0, "terrain": ["PLAINS", "MOUNTAINOUS", "DESERT", "MIXED"]},
}


class CommandCentreEngine:
    """
    AI-Powered Command Centre Engine
    Manages all aspects of military logistics coordination
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.current_time = datetime.utcnow()

    # ========================================================================
    # LOAD MANAGEMENT & PRIORITIZATION
    # ========================================================================

    async def calculate_load_priority_score(
        self, 
        load: LoadAssignment,
        threat_context: Optional[Dict] = None
    ) -> Dict:
        """
        Calculate AI-powered priority score for a load assignment
        Considers: category urgency, deadline pressure, route risk, weather
        """
        base_priority = PRIORITY_WEIGHTS.get(load.priority, 0.5)
        category_urgency = CATEGORY_URGENCY.get(load.load_category, 0.5)
        
        # Deadline pressure (0.0-1.0)
        deadline_score = 0.5
        if load.required_by:
            hours_until_deadline = (load.required_by - self.current_time).total_seconds() / 3600
            if hours_until_deadline <= 6:
                deadline_score = 1.0
            elif hours_until_deadline <= 12:
                deadline_score = 0.9
            elif hours_until_deadline <= 24:
                deadline_score = 0.7
            elif hours_until_deadline <= 48:
                deadline_score = 0.5
            else:
                deadline_score = 0.3

        # Weight factor (heavier loads might need more planning)
        weight_factor = min(1.0, load.total_weight_tons / 50.0)
        
        # Threat context adjustment
        threat_adjustment = 0.0
        if threat_context:
            current_threat = threat_context.get("threat_level", "GREEN")
            if current_threat == "RED":
                # Critical items get priority boost in high threat
                if load.load_category in [LoadCategory.AMMUNITION.value, LoadCategory.MEDICAL.value]:
                    threat_adjustment = 0.15
            elif current_threat == "ORANGE":
                if load.load_category in [LoadCategory.AMMUNITION.value, LoadCategory.MEDICAL.value, LoadCategory.FUEL_POL.value]:
                    threat_adjustment = 0.08

        # Calculate final score
        priority_score = (
            base_priority * 0.25 +
            category_urgency * 0.30 +
            deadline_score * 0.30 +
            weight_factor * 0.10 +
            threat_adjustment * 0.05
        )
        
        return {
            "priority_score": round(min(1.0, priority_score), 3),
            "base_priority": base_priority,
            "category_urgency": category_urgency,
            "deadline_score": deadline_score,
            "weight_factor": weight_factor,
            "threat_adjustment": threat_adjustment,
            "reasoning": self._generate_priority_reasoning(load, priority_score)
        }

    def _generate_priority_reasoning(self, load: LoadAssignment, score: float) -> List[str]:
        """Generate human-readable reasoning for priority score"""
        reasoning = []
        
        if load.priority == LoadPriority.CRITICAL.value:
            reasoning.append("CRITICAL priority classification - immediate attention required")
        
        if load.load_category == LoadCategory.AMMUNITION.value:
            reasoning.append("Ammunition supply - essential for operational readiness")
        elif load.load_category == LoadCategory.MEDICAL.value:
            reasoning.append("Medical supplies - life-saving priority")
        elif load.load_category == LoadCategory.FUEL_POL.value:
            reasoning.append("POL supplies - critical for vehicle operations")
        elif load.load_category == LoadCategory.RATIONS.value:
            reasoning.append("Rations - troop sustenance priority")
        
        if load.required_by:
            hours_until = (load.required_by - self.current_time).total_seconds() / 3600
            if hours_until <= 12:
                reasoning.append(f"Urgent: Only {hours_until:.1f} hours until deadline")
        
        if load.total_weight_tons > 30:
            reasoning.append(f"Heavy load ({load.total_weight_tons:.1f} tons) - requires dedicated planning")
        
        if score >= 0.8:
            reasoning.append("HIGH PRIORITY - Expedite dispatch")
        elif score >= 0.6:
            reasoning.append("ELEVATED PRIORITY - Schedule within operational window")
        
        return reasoning

    async def get_prioritized_load_queue(
        self,
        limit: int = 20,
        entity_id: Optional[int] = None
    ) -> List[Dict]:
        """
        Get prioritized queue of pending load assignments
        Returns loads sorted by AI-calculated priority
        """
        query = select(LoadAssignment).where(
            LoadAssignment.status.in_(["PENDING", "ASSIGNED"])
        )
        
        if entity_id:
            query = query.where(
                or_(
                    LoadAssignment.source_entity_id == entity_id,
                    LoadAssignment.destination_entity_id == entity_id
                )
            )
        
        query = query.order_by(desc(LoadAssignment.ai_priority_score)).limit(limit)
        result = await self.db.execute(query)
        loads = result.scalars().all()
        
        prioritized_queue = []
        for load in loads:
            priority_analysis = await self.calculate_load_priority_score(load)
            
            # Get source and destination names
            source_entity = await self.db.get(MilitaryEntity, load.source_entity_id)
            dest_entity = await self.db.get(MilitaryEntity, load.destination_entity_id)
            
            prioritized_queue.append({
                "id": load.id,
                "assignment_code": load.assignment_code,
                "load_category": load.load_category,
                "priority": load.priority,
                "total_weight_tons": load.total_weight_tons,
                "source": source_entity.name if source_entity else "Unknown",
                "destination": dest_entity.name if dest_entity else "Unknown",
                "required_by": load.required_by.isoformat() if load.required_by else None,
                "status": load.status,
                "ai_priority_score": priority_analysis["priority_score"],
                "reasoning": priority_analysis["reasoning"],
                "completion_percentage": load.completion_percentage
            })
        
        return prioritized_queue

    async def optimize_load_distribution(
        self,
        load_ids: List[int],
        available_vehicles: List[Dict]
    ) -> Dict:
        """
        AI-optimize load distribution across available vehicles
        Uses bin-packing heuristics for optimal utilization
        """
        # Fetch loads
        loads = []
        for load_id in load_ids:
            load = await self.db.get(LoadAssignment, load_id)
            if load and load.status in ["PENDING", "ASSIGNED"]:
                loads.append(load)
        
        if not loads:
            return {"success": False, "message": "No valid loads to distribute"}
        
        # Sort vehicles by capacity (largest first - First Fit Decreasing)
        sorted_vehicles = sorted(available_vehicles, key=lambda v: v.get("capacity_tons", 0), reverse=True)
        
        # Sort loads by weight (heaviest first)
        sorted_loads = sorted(loads, key=lambda l: l.total_weight_tons, reverse=True)
        
        # Bin-packing assignment
        assignments = []
        unassigned_loads = []
        vehicle_usage = {v["id"]: {"used": 0.0, "loads": []} for v in sorted_vehicles}
        
        for load in sorted_loads:
            assigned = False
            for vehicle in sorted_vehicles:
                v_id = vehicle["id"]
                remaining_capacity = vehicle.get("capacity_tons", 0) - vehicle_usage[v_id]["used"]
                
                if remaining_capacity >= load.total_weight_tons:
                    vehicle_usage[v_id]["used"] += load.total_weight_tons
                    vehicle_usage[v_id]["loads"].append({
                        "load_id": load.id,
                        "weight_tons": load.total_weight_tons,
                        "category": load.load_category
                    })
                    assigned = True
                    break
            
            if not assigned:
                unassigned_loads.append({
                    "load_id": load.id,
                    "weight_tons": load.total_weight_tons,
                    "reason": "No vehicle with sufficient capacity"
                })
        
        # Calculate utilization stats
        total_capacity = sum(v.get("capacity_tons", 0) for v in sorted_vehicles)
        total_used = sum(vu["used"] for vu in vehicle_usage.values())
        utilization_rate = (total_used / total_capacity * 100) if total_capacity > 0 else 0
        
        for v_id, usage in vehicle_usage.items():
            if usage["loads"]:
                vehicle = next((v for v in sorted_vehicles if v["id"] == v_id), None)
                if vehicle:
                    assignments.append({
                        "vehicle_id": v_id,
                        "vehicle_name": vehicle.get("name", f"Vehicle-{v_id}"),
                        "capacity_tons": vehicle.get("capacity_tons", 0),
                        "used_tons": usage["used"],
                        "utilization_percent": round(usage["used"] / vehicle.get("capacity_tons", 1) * 100, 1),
                        "assigned_loads": usage["loads"]
                    })
        
        return {
            "success": True,
            "assignments": assignments,
            "unassigned_loads": unassigned_loads,
            "total_vehicles_used": len(assignments),
            "total_capacity_tons": total_capacity,
            "total_load_tons": total_used,
            "utilization_rate": round(utilization_rate, 1),
            "optimization_algorithm": "First Fit Decreasing (FFD)",
            "timestamp": datetime.utcnow().isoformat()
        }

    # ========================================================================
    # VEHICLE SHARING OPTIMIZATION
    # ========================================================================

    async def find_vehicle_sharing_matches(
        self,
        request: VehicleSharingRequest
    ) -> List[Dict]:
        """
        Find optimal vehicle sharing matches for a request
        AI-powered matching based on availability, proximity, and compatibility
        """
        # Get all entities with available vehicles of required type
        query = select(VehiclePoolStatus).where(
            VehiclePoolStatus.snapshot_time >= datetime.utcnow() - timedelta(hours=1)
        )
        result = await self.db.execute(query)
        pool_statuses = result.scalars().all()
        
        matches = []
        for pool in pool_statuses:
            # Skip the requesting entity
            if pool.entity_id == request.requesting_entity_id:
                continue
            
            # Get entity details
            entity = await self.db.get(MilitaryEntity, pool.entity_id)
            if not entity:
                continue
            
            # Check vehicle availability based on type
            available_count = 0
            vehicle_type = request.vehicle_type_required.upper()
            
            if "TRUCK" in vehicle_type:
                available_count = pool.available_trucks
            elif "ALS" in vehicle_type:
                available_count = pool.available_als
            elif "JEEP" in vehicle_type:
                available_count = pool.available_jeeps
            elif "TANKER" in vehicle_type:
                available_count = pool.available_tankers
            elif "RECOVERY" in vehicle_type:
                available_count = pool.available_recovery
            else:
                available_count = pool.available_trucks  # Default to trucks
            
            if available_count < request.quantity_required:
                continue
            
            # Calculate proximity score (using haversine approximation)
            requesting_entity = await self.db.get(MilitaryEntity, request.requesting_entity_id)
            if requesting_entity:
                distance_km = self._calculate_distance(
                    requesting_entity.base_latitude, requesting_entity.base_longitude,
                    entity.base_latitude, entity.base_longitude
                )
                proximity_score = max(0, 1 - (distance_km / 500))  # Normalize to 500km range
            else:
                proximity_score = 0.5
                distance_km = 0
            
            # Calculate availability score
            if "TRUCK" in vehicle_type:
                availability_score = pool.available_trucks / max(1, pool.total_trucks)
            elif "ALS" in vehicle_type:
                availability_score = pool.available_als / max(1, pool.total_als)
            elif "JEEP" in vehicle_type:
                availability_score = pool.available_jeeps / max(1, pool.total_jeeps)
            else:
                availability_score = pool.available_capacity_tons / max(1, pool.total_capacity_tons)
            
            # Calculate match score
            match_score = (proximity_score * 0.4 + availability_score * 0.4 + (1 - pool.utilization_percentage/100) * 0.2)
            
            matches.append({
                "entity_id": entity.id,
                "entity_name": entity.name,
                "entity_code": entity.code,
                "entity_type": entity.entity_type,
                "sector": entity.sector,
                "distance_km": round(distance_km, 1),
                "available_count": available_count,
                "total_count": pool.total_trucks if "TRUCK" in vehicle_type else pool.total_als,
                "availability_score": round(availability_score, 3),
                "proximity_score": round(proximity_score, 3),
                "utilization_percent": round(pool.utilization_percentage, 1),
                "match_score": round(match_score, 3),
                "recommendation": self._generate_sharing_recommendation(match_score, distance_km)
            })
        
        # Sort by match score
        matches.sort(key=lambda m: m["match_score"], reverse=True)
        return matches[:10]  # Return top 10 matches

    def _calculate_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two points using Haversine formula"""
        R = 6371  # Earth's radius in km
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c

    def _generate_sharing_recommendation(self, score: float, distance: float) -> str:
        """Generate recommendation based on match score"""
        if score >= 0.8:
            return "HIGHLY RECOMMENDED - Optimal match for vehicle sharing"
        elif score >= 0.6:
            return "RECOMMENDED - Good availability and proximity"
        elif score >= 0.4:
            return "ACCEPTABLE - Consider if no better options available"
        elif distance > 200:
            return "DISTANCE CONCERN - High transit cost expected"
        else:
            return "LOW PRIORITY - Limited availability"

    async def get_fleet_sharing_summary(self) -> Dict:
        """
        Get comprehensive fleet sharing summary across all entities
        """
        # Get recent pool statuses
        query = select(VehiclePoolStatus).where(
            VehiclePoolStatus.snapshot_time >= datetime.utcnow() - timedelta(hours=1)
        ).order_by(desc(VehiclePoolStatus.snapshot_time))
        
        result = await self.db.execute(query)
        pools = result.scalars().all()
        
        # Aggregate stats
        total_vehicles = 0
        available_vehicles = 0
        shared_out_total = 0
        shared_in_total = 0
        maintenance_total = 0
        total_capacity = 0.0
        available_capacity = 0.0
        
        entity_summaries = []
        seen_entities = set()
        
        for pool in pools:
            if pool.entity_id in seen_entities:
                continue
            seen_entities.add(pool.entity_id)
            
            entity = await self.db.get(MilitaryEntity, pool.entity_id)
            
            entity_total = pool.total_trucks + pool.total_als + pool.total_jeeps + pool.total_tankers + pool.total_recovery
            entity_available = pool.available_trucks + pool.available_als + pool.available_jeeps + pool.available_tankers + pool.available_recovery
            
            total_vehicles += entity_total
            available_vehicles += entity_available
            shared_out_total += pool.shared_out_count
            shared_in_total += pool.shared_in_count
            maintenance_total += pool.maintenance_count
            total_capacity += pool.total_capacity_tons
            available_capacity += pool.available_capacity_tons
            
            entity_summaries.append({
                "entity_id": pool.entity_id,
                "entity_name": entity.name if entity else f"Entity-{pool.entity_id}",
                "total_vehicles": entity_total,
                "available_vehicles": entity_available,
                "shared_out": pool.shared_out_count,
                "shared_in": pool.shared_in_count,
                "utilization": round(pool.utilization_percentage, 1),
                "capacity_tons": pool.total_capacity_tons,
                "available_capacity_tons": pool.available_capacity_tons
            })
        
        # Get pending sharing requests
        pending_query = select(func.count(VehicleSharingRequest.id)).where(
            VehicleSharingRequest.status == SharingStatus.REQUESTED.value
        )
        pending_result = await self.db.execute(pending_query)
        pending_requests = pending_result.scalar() or 0
        
        # Get active sharing agreements
        active_query = select(func.count(VehicleSharingRequest.id)).where(
            VehicleSharingRequest.status.in_([SharingStatus.APPROVED.value, SharingStatus.IN_TRANSIT.value])
        )
        active_result = await self.db.execute(active_query)
        active_agreements = active_result.scalar() or 0
        
        return {
            "summary": {
                "total_vehicles": total_vehicles,
                "available_vehicles": available_vehicles,
                "availability_rate": round(available_vehicles / max(1, total_vehicles) * 100, 1),
                "vehicles_shared_out": shared_out_total,
                "vehicles_shared_in": shared_in_total,
                "net_sharing_balance": shared_in_total - shared_out_total,
                "vehicles_in_maintenance": maintenance_total,
                "total_capacity_tons": round(total_capacity, 1),
                "available_capacity_tons": round(available_capacity, 1),
                "capacity_utilization": round((total_capacity - available_capacity) / max(1, total_capacity) * 100, 1)
            },
            "sharing_activity": {
                "pending_requests": pending_requests,
                "active_agreements": active_agreements,
                "sharing_efficiency": round((active_agreements / max(1, pending_requests + active_agreements)) * 100, 1) if (pending_requests + active_agreements) > 0 else 100
            },
            "entities": sorted(entity_summaries, key=lambda e: e["utilization"], reverse=True),
            "timestamp": datetime.utcnow().isoformat()
        }

    # ========================================================================
    # MOVEMENT PLANNING & COORDINATION
    # ========================================================================

    async def generate_movement_plan(
        self,
        convoy_id: int,
        route_id: int,
        departure_time: datetime,
        load_assignment_ids: Optional[List[int]] = None
    ) -> Dict:
        """
        Generate comprehensive movement plan with AI optimization
        """
        # Fetch convoy and route
        convoy = await self.db.get(Convoy, convoy_id)
        route = await self.db.get(Route, route_id)
        
        if not convoy or not route:
            return {"success": False, "message": "Invalid convoy or route"}
        
        # Get TCPs along the route
        tcp_query = select(TCP).where(TCP.route_id == route_id).order_by(TCP.route_km_marker)
        tcp_result = await self.db.execute(tcp_query)
        tcps = tcp_result.scalars().all()
        
        # Get transit camps along the route
        camp_query = select(TransitCamp).where(TransitCamp.route_id == route_id).order_by(TransitCamp.route_km_marker)
        camp_result = await self.db.execute(camp_query)
        camps = camp_result.scalars().all()
        
        # Get active obstacles
        obstacle_query = select(Obstacle).where(
            and_(
                Obstacle.route_id == route_id,
                Obstacle.is_active == True
            )
        )
        obstacle_result = await self.db.execute(obstacle_query)
        obstacles = obstacle_result.scalars().all()
        
        # Calculate journey parameters
        base_speed_kmh = 40  # Base convoy speed
        terrain_factor = {
            "PLAINS": 1.0, "MOUNTAINOUS": 0.6, "DESERT": 0.8, "MIXED": 0.75
        }.get(route.terrain_type, 0.8)
        
        weather_factor = route.weather_impact_factor or 1.0
        threat_factor = {
            "GREEN": 1.0, "YELLOW": 0.9, "ORANGE": 0.75, "RED": 0.6
        }.get(route.threat_level, 1.0)
        
        effective_speed = base_speed_kmh * terrain_factor * (1/weather_factor) * threat_factor
        journey_hours = route.total_distance_km / effective_speed if route.total_distance_km else 4.0
        
        # Calculate halt requirements (every 4-6 hours or 150km)
        halt_interval_km = 150
        halt_interval_hours = 4
        num_halts = max(1, int(route.total_distance_km / halt_interval_km)) if route.total_distance_km else 1
        halt_duration_hours = 1.5  # Standard halt duration
        
        total_halt_time = num_halts * halt_duration_hours
        total_journey_hours = journey_hours + total_halt_time
        
        # Generate waypoints
        waypoints = []
        current_time = departure_time
        current_km = 0
        
        # Add TCPs as waypoints
        for tcp in tcps:
            travel_time = (tcp.route_km_marker - current_km) / effective_speed
            arrival_time = current_time + timedelta(hours=travel_time)
            
            waypoints.append({
                "sequence": len(waypoints) + 1,
                "name": tcp.name,
                "type": "TCP",
                "latitude": tcp.latitude,
                "longitude": tcp.longitude,
                "km_marker": tcp.route_km_marker,
                "expected_arrival": arrival_time.isoformat(),
                "expected_departure": (arrival_time + timedelta(minutes=tcp.avg_clearance_time_min)).isoformat(),
                "halt_duration_min": tcp.avg_clearance_time_min,
                "tcp_id": tcp.id
            })
            
            current_time = arrival_time + timedelta(minutes=tcp.avg_clearance_time_min)
            current_km = tcp.route_km_marker
        
        # Intersperse transit camps as halt points
        for camp in camps:
            if camp.route_km_marker % halt_interval_km < 30:  # Near halt interval
                travel_time = (camp.route_km_marker - current_km) / effective_speed
                arrival_time = current_time + timedelta(hours=travel_time)
                
                waypoints.append({
                    "sequence": len(waypoints) + 1,
                    "name": camp.name,
                    "type": "HALT",
                    "latitude": camp.latitude,
                    "longitude": camp.longitude,
                    "km_marker": camp.route_km_marker,
                    "expected_arrival": arrival_time.isoformat(),
                    "expected_departure": (arrival_time + timedelta(hours=halt_duration_hours)).isoformat(),
                    "halt_duration_min": int(halt_duration_hours * 60),
                    "transit_camp_id": camp.id,
                    "facilities": {
                        "fuel": camp.has_fuel,
                        "medical": camp.has_medical,
                        "maintenance": camp.has_maintenance,
                        "mess": camp.has_mess
                    }
                })
        
        # Sort waypoints by km marker
        waypoints.sort(key=lambda w: w["km_marker"])
        
        # Re-sequence
        for i, wp in enumerate(waypoints):
            wp["sequence"] = i + 1
        
        # Calculate risk assessment
        risk_factors = {
            "threat": {"GREEN": 0.1, "YELLOW": 0.4, "ORANGE": 0.7, "RED": 0.95}.get(route.threat_level, 0.3),
            "weather": min(1.0, (route.weather_impact_factor - 1.0) / 0.5) if route.weather_impact_factor else 0.1,
            "terrain": {"PLAINS": 0.1, "MOUNTAINOUS": 0.6, "DESERT": 0.4, "MIXED": 0.3}.get(route.terrain_type, 0.3),
            "obstacles": min(1.0, len(obstacles) * 0.2),
            "traffic": {"CLEAR": 0.1, "MODERATE": 0.3, "CONGESTED": 0.6, "BLOCKED": 0.95}.get(route.current_traffic_density, 0.2)
        }
        overall_risk = sum(risk_factors.values()) / len(risk_factors)
        
        # Calculate load totals if provided
        total_load_tons = 0.0
        if load_assignment_ids:
            for load_id in load_assignment_ids:
                load = await self.db.get(LoadAssignment, load_id)
                if load:
                    total_load_tons += load.total_weight_tons
        
        # Get vehicle count
        vehicle_query = select(func.count(TransportAsset.id)).where(TransportAsset.convoy_id == convoy_id)
        vehicle_result = await self.db.execute(vehicle_query)
        vehicle_count = vehicle_result.scalar() or 0
        
        # AI recommendations
        recommendations = []
        if overall_risk > 0.6:
            recommendations.append("HIGH RISK: Consider alternate route or additional escort")
        if route.threat_level in ["ORANGE", "RED"]:
            recommendations.append("THREAT ADVISORY: Coordinate with security forces before departure")
        if route.weather_status not in ["CLEAR"]:
            recommendations.append(f"WEATHER ALERT: {route.weather_status} conditions - reduce speed")
        if len(obstacles) > 0:
            recommendations.append(f"OBSTACLES: {len(obstacles)} active obstacles on route - plan for delays")
        if departure_time.hour < 6 or departure_time.hour > 18:
            if not route.is_night_movement_allowed:
                recommendations.append("NIGHT MOVEMENT: Not recommended on this route")
            else:
                recommendations.append("NIGHT MOVEMENT: Use enhanced lighting and communication")
        
        predicted_arrival = departure_time + timedelta(hours=total_journey_hours)
        
        return {
            "success": True,
            "plan_code": f"MP-{convoy.name}-{datetime.utcnow().strftime('%Y%m%d%H%M')}",
            "convoy": {
                "id": convoy.id,
                "name": convoy.name,
                "status": convoy.status
            },
            "route": {
                "id": route.id,
                "name": route.name,
                "distance_km": route.total_distance_km,
                "terrain": route.terrain_type,
                "threat_level": route.threat_level,
                "weather": route.weather_status
            },
            "timing": {
                "planned_departure": departure_time.isoformat(),
                "predicted_arrival": predicted_arrival.isoformat(),
                "journey_hours": round(journey_hours, 2),
                "halt_hours": round(total_halt_time, 2),
                "total_hours": round(total_journey_hours, 2),
                "effective_speed_kmh": round(effective_speed, 1)
            },
            "waypoints": waypoints,
            "halts": {
                "count": num_halts,
                "total_duration_hours": round(total_halt_time, 2)
            },
            "load": {
                "assignment_ids": load_assignment_ids or [],
                "total_tons": round(total_load_tons, 2),
                "vehicle_count": vehicle_count
            },
            "risk_assessment": {
                "overall_score": round(overall_risk, 3),
                "risk_level": "HIGH" if overall_risk > 0.6 else "MEDIUM" if overall_risk > 0.3 else "LOW",
                "factors": {k: round(v, 3) for k, v in risk_factors.items()},
                "active_obstacles": len(obstacles)
            },
            "ai_recommendations": recommendations,
            "ai_optimization_score": round(1 - overall_risk, 3),
            "timestamp": datetime.utcnow().isoformat()
        }

    async def get_active_movement_plans(self) -> List[Dict]:
        """Get all active movement plans with real-time status"""
        query = select(MovementPlan).where(
            MovementPlan.status.in_([MovementPlanStatus.ACTIVE.value, MovementPlanStatus.APPROVED.value])
        ).order_by(MovementPlan.planned_departure)
        
        result = await self.db.execute(query)
        plans = result.scalars().all()
        
        active_plans = []
        for plan in plans:
            convoy = await self.db.get(Convoy, plan.convoy_id) if plan.convoy_id else None
            route = await self.db.get(Route, plan.primary_route_id)
            
            # Calculate progress
            if plan.actual_departure and plan.planned_arrival:
                elapsed = (datetime.utcnow() - plan.actual_departure).total_seconds() / 3600
                total_planned = (plan.planned_arrival - plan.planned_departure).total_seconds() / 3600
                progress = min(100, max(0, (elapsed / total_planned) * 100)) if total_planned > 0 else 0
            else:
                progress = 0
            
            active_plans.append({
                "id": plan.id,
                "plan_code": plan.plan_code,
                "plan_name": plan.plan_name,
                "convoy_id": plan.convoy_id,
                "convoy_name": convoy.name if convoy else None,
                "route_name": route.name if route else None,
                "planned_departure": plan.planned_departure.isoformat() if plan.planned_departure else None,
                "planned_arrival": plan.planned_arrival.isoformat() if plan.planned_arrival else None,
                "actual_departure": plan.actual_departure.isoformat() if plan.actual_departure else None,
                "status": plan.status,
                "progress_percent": round(progress, 1),
                "vehicle_count": plan.vehicle_count,
                "total_load_tons": plan.total_load_tons,
                "overall_risk_score": plan.overall_risk_score,
                "ai_optimized": plan.ai_optimized
            })
        
        return active_plans

    # ========================================================================
    # ROAD SPACE MANAGEMENT
    # ========================================================================

    async def check_road_space_availability(
        self,
        route_id: int,
        start_time: datetime,
        end_time: datetime
    ) -> Dict:
        """Check road space availability for a given time window"""
        # Get existing allocations for the route in the time window
        query = select(RoadSpaceAllocation).where(
            and_(
                RoadSpaceAllocation.route_id == route_id,
                RoadSpaceAllocation.status.in_([RoadSpaceStatus.ALLOCATED.value]),
                or_(
                    and_(RoadSpaceAllocation.start_time <= start_time, RoadSpaceAllocation.end_time >= start_time),
                    and_(RoadSpaceAllocation.start_time <= end_time, RoadSpaceAllocation.end_time >= end_time),
                    and_(RoadSpaceAllocation.start_time >= start_time, RoadSpaceAllocation.end_time <= end_time)
                )
            )
        )
        result = await self.db.execute(query)
        existing_allocations = result.scalars().all()
        
        route = await self.db.get(Route, route_id)
        
        # Calculate conflicts
        conflicts = []
        for alloc in existing_allocations:
            convoy = await self.db.get(Convoy, alloc.allocated_to_convoy_id) if alloc.allocated_to_convoy_id else None
            conflicts.append({
                "allocation_id": alloc.id,
                "convoy_name": convoy.name if convoy else "Unknown",
                "start_time": alloc.start_time.isoformat(),
                "end_time": alloc.end_time.isoformat(),
                "direction": alloc.direction
            })
        
        # Suggest alternative windows if conflicts exist
        alternative_windows = []
        if conflicts:
            # Check earlier window
            earlier_start = start_time - timedelta(hours=2)
            earlier_end = end_time - timedelta(hours=2)
            earlier_conflicts = [c for c in conflicts if c["start_time"] <= earlier_end.isoformat() and c["end_time"] >= earlier_start.isoformat()]
            if not earlier_conflicts:
                alternative_windows.append({
                    "start": earlier_start.isoformat(),
                    "end": earlier_end.isoformat(),
                    "type": "EARLIER"
                })
            
            # Check later window
            later_start = end_time + timedelta(hours=1)
            later_end = later_start + (end_time - start_time)
            later_conflicts = [c for c in conflicts if c["start_time"] <= later_end.isoformat() and c["end_time"] >= later_start.isoformat()]
            if not later_conflicts:
                alternative_windows.append({
                    "start": later_start.isoformat(),
                    "end": later_end.isoformat(),
                    "type": "LATER"
                })
        
        return {
            "route_id": route_id,
            "route_name": route.name if route else "Unknown",
            "requested_window": {
                "start": start_time.isoformat(),
                "end": end_time.isoformat(),
                "duration_hours": (end_time - start_time).total_seconds() / 3600
            },
            "is_available": len(conflicts) == 0,
            "conflict_count": len(conflicts),
            "conflicts": conflicts,
            "alternative_windows": alternative_windows,
            "recommendation": "PROCEED" if len(conflicts) == 0 else "RESCHEDULE" if alternative_windows else "COORDINATE"
        }

    async def get_road_space_utilization(self, route_id: Optional[int] = None) -> Dict:
        """Get road space utilization metrics"""
        now = datetime.utcnow()
        
        # Query for active allocations
        query = select(RoadSpaceAllocation).where(
            and_(
                RoadSpaceAllocation.start_time <= now + timedelta(hours=24),
                RoadSpaceAllocation.end_time >= now
            )
        )
        if route_id:
            query = query.where(RoadSpaceAllocation.route_id == route_id)
        
        result = await self.db.execute(query)
        allocations = result.scalars().all()
        
        # Aggregate by route
        route_utilization = {}
        for alloc in allocations:
            r_id = alloc.route_id
            if r_id not in route_utilization:
                route = await self.db.get(Route, r_id)
                route_utilization[r_id] = {
                    "route_id": r_id,
                    "route_name": route.name if route else f"Route-{r_id}",
                    "allocations": [],
                    "total_hours_allocated": 0,
                    "active_now": False
                }
            
            duration = (alloc.end_time - alloc.start_time).total_seconds() / 3600
            route_utilization[r_id]["total_hours_allocated"] += duration
            
            is_active = alloc.start_time <= now <= alloc.end_time
            if is_active:
                route_utilization[r_id]["active_now"] = True
            
            convoy = await self.db.get(Convoy, alloc.allocated_to_convoy_id) if alloc.allocated_to_convoy_id else None
            route_utilization[r_id]["allocations"].append({
                "id": alloc.id,
                "convoy_name": convoy.name if convoy else None,
                "start": alloc.start_time.isoformat(),
                "end": alloc.end_time.isoformat(),
                "is_active": is_active,
                "status": alloc.status
            })
        
        # Calculate overall metrics
        total_allocations = len(allocations)
        active_allocations = sum(1 for a in allocations if a.start_time <= now <= a.end_time)
        
        return {
            "summary": {
                "total_allocations_24h": total_allocations,
                "active_allocations": active_allocations,
                "routes_with_activity": len(route_utilization)
            },
            "routes": list(route_utilization.values()),
            "timestamp": now.isoformat()
        }

    # ========================================================================
    # ENTITY NOTIFICATIONS
    # ========================================================================

    async def create_entity_notification(
        self,
        entity_id: int,
        notification_type: NotificationType,
        title: str,
        message: str,
        priority: LoadPriority = LoadPriority.MEDIUM,
        details: Optional[Dict] = None,
        convoy_id: Optional[int] = None,
        movement_plan_id: Optional[int] = None,
        route_id: Optional[int] = None,
        scheduled_for: Optional[datetime] = None
    ) -> EntityNotification:
        """Create and queue a notification for an entity"""
        notification = EntityNotification(
            notification_code=f"NOTIF-{uuid.uuid4().hex[:8].upper()}",
            entity_id=entity_id,
            notification_type=notification_type.value,
            priority=priority.value,
            title=title,
            message=message,
            details=details or {},
            convoy_id=convoy_id,
            movement_plan_id=movement_plan_id,
            route_id=route_id,
            scheduled_for=scheduled_for or datetime.utcnow(),
            status="PENDING"
        )
        
        self.db.add(notification)
        await self.db.commit()
        await self.db.refresh(notification)
        
        return notification

    async def notify_entities_on_route(
        self,
        route_id: int,
        convoy_id: int,
        notification_type: NotificationType,
        eta_at_entities: Optional[Dict[int, datetime]] = None
    ) -> List[EntityNotification]:
        """Notify all entities along a route about convoy movement"""
        # Get convoy details
        convoy = await self.db.get(Convoy, convoy_id)
        route = await self.db.get(Route, route_id)
        
        if not convoy or not route:
            return []
        
        # Get entities in the sector/region
        # In a real system, this would use geographic queries
        query = select(MilitaryEntity).where(
            MilitaryEntity.operational_status == "OPERATIONAL"
        ).limit(10)
        
        result = await self.db.execute(query)
        entities = result.scalars().all()
        
        notifications = []
        for entity in entities:
            eta = eta_at_entities.get(entity.id) if eta_at_entities else None
            
            if notification_type == NotificationType.CONVOY_APPROACHING:
                title = f"Convoy {convoy.name} Approaching"
                message = f"Convoy {convoy.name} is en route on {route.name}. "
                if eta:
                    message += f"Expected arrival at your sector: {eta.strftime('%H:%M hrs on %d %b')}"
            elif notification_type == NotificationType.CONVOY_DEPARTED:
                title = f"Convoy {convoy.name} Departed"
                message = f"Convoy {convoy.name} has departed from {convoy.start_location} on {route.name}."
            elif notification_type == NotificationType.ETA_UPDATE:
                title = f"ETA Update - Convoy {convoy.name}"
                message = f"Updated ETA for Convoy {convoy.name}. "
                if eta:
                    message += f"New ETA: {eta.strftime('%H:%M hrs on %d %b')}"
            else:
                title = f"Convoy Alert - {convoy.name}"
                message = f"Convoy {convoy.name} update on {route.name}"
            
            notification = await self.create_entity_notification(
                entity_id=entity.id,
                notification_type=notification_type,
                title=title,
                message=message,
                convoy_id=convoy_id,
                route_id=route_id,
                details={
                    "convoy_name": convoy.name,
                    "route_name": route.name,
                    "start_location": convoy.start_location,
                    "end_location": convoy.end_location,
                    "eta": eta.isoformat() if eta else None
                }
            )
            notifications.append(notification)
        
        return notifications

    async def get_entity_notifications(
        self,
        entity_id: int,
        status: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict]:
        """Get notifications for an entity"""
        query = select(EntityNotification).where(
            EntityNotification.entity_id == entity_id
        )
        
        if status:
            query = query.where(EntityNotification.status == status)
        
        query = query.order_by(desc(EntityNotification.created_at)).limit(limit)
        
        result = await self.db.execute(query)
        notifications = result.scalars().all()
        
        return [
            {
                "id": n.id,
                "notification_code": n.notification_code,
                "type": n.notification_type,
                "priority": n.priority,
                "title": n.title,
                "message": n.message,
                "details": n.details,
                "status": n.status,
                "created_at": n.created_at.isoformat(),
                "sent_at": n.sent_at.isoformat() if n.sent_at else None,
                "acknowledged_at": n.acknowledged_at.isoformat() if n.acknowledged_at else None,
                "convoy_id": n.convoy_id,
                "route_id": n.route_id
            }
            for n in notifications
        ]

    async def acknowledge_notification(self, notification_id: int, acknowledged_by: str) -> bool:
        """Acknowledge a notification"""
        notification = await self.db.get(EntityNotification, notification_id)
        if not notification:
            return False
        
        notification.status = "ACKNOWLEDGED"
        notification.acknowledged_at = datetime.utcnow()
        notification.acknowledged_by = acknowledged_by
        
        await self.db.commit()
        return True

    # ========================================================================
    # COMMAND CENTRE DASHBOARD METRICS
    # ========================================================================

    async def get_command_centre_dashboard(self) -> Dict:
        """
        Get comprehensive command centre dashboard data
        All values are dynamically calculated from the database
        """
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # ============ LOAD MANAGEMENT METRICS ============
        # Pending loads
        pending_loads_query = select(func.count(LoadAssignment.id), func.coalesce(func.sum(LoadAssignment.total_weight_tons), 0)).where(
            LoadAssignment.status == "PENDING"
        )
        pending_result = await self.db.execute(pending_loads_query)
        pending_row = pending_result.first()
        pending_count = pending_row[0] if pending_row else 0
        pending_tons = float(pending_row[1]) if pending_row and pending_row[1] else 0.0
        
        # In-transit loads
        transit_loads_query = select(func.count(LoadAssignment.id), func.coalesce(func.sum(LoadAssignment.total_weight_tons), 0)).where(
            LoadAssignment.status == "IN_TRANSIT"
        )
        transit_result = await self.db.execute(transit_loads_query)
        transit_row = transit_result.first()
        transit_count = transit_row[0] if transit_row else 0
        transit_tons = float(transit_row[1]) if transit_row and transit_row[1] else 0.0
        
        # Delivered today
        delivered_query = select(func.count(LoadAssignment.id), func.coalesce(func.sum(LoadAssignment.total_weight_tons), 0)).where(
            and_(
                LoadAssignment.status == "DELIVERED",
                LoadAssignment.actual_delivery >= today_start
            )
        )
        delivered_result = await self.db.execute(delivered_query)
        delivered_row = delivered_result.first()
        delivered_count = delivered_row[0] if delivered_row else 0
        delivered_tons = float(delivered_row[1]) if delivered_row and delivered_row[1] else 0.0
        
        # Load priority distribution
        priority_query = select(
            LoadAssignment.priority,
            func.count(LoadAssignment.id)
        ).where(
            LoadAssignment.status.in_(["PENDING", "ASSIGNED", "IN_TRANSIT"])
        ).group_by(LoadAssignment.priority)
        priority_result = await self.db.execute(priority_query)
        priority_dist = {row[0]: row[1] for row in priority_result.all()}
        
        # ============ VEHICLE SHARING METRICS ============
        sharing_pending_query = select(func.count(VehicleSharingRequest.id)).where(
            VehicleSharingRequest.status == SharingStatus.REQUESTED.value
        )
        sharing_pending = (await self.db.execute(sharing_pending_query)).scalar() or 0
        
        sharing_active_query = select(func.count(VehicleSharingRequest.id)).where(
            VehicleSharingRequest.status.in_([SharingStatus.APPROVED.value, SharingStatus.IN_TRANSIT.value])
        )
        sharing_active = (await self.db.execute(sharing_active_query)).scalar() or 0
        
        # Vehicle pool summary
        pool_query = select(
            func.sum(VehiclePoolStatus.total_trucks + VehiclePoolStatus.total_als + VehiclePoolStatus.total_jeeps),
            func.sum(VehiclePoolStatus.available_trucks + VehiclePoolStatus.available_als + VehiclePoolStatus.available_jeeps),
            func.sum(VehiclePoolStatus.shared_out_count),
            func.sum(VehiclePoolStatus.shared_in_count),
            func.avg(VehiclePoolStatus.utilization_percentage)
        ).where(
            VehiclePoolStatus.snapshot_time >= now - timedelta(hours=1)
        )
        pool_result = await self.db.execute(pool_query)
        pool_row = pool_result.first()
        
        total_vehicles = int(pool_row[0]) if pool_row and pool_row[0] else 0
        available_vehicles = int(pool_row[1]) if pool_row and pool_row[1] else 0
        shared_out = int(pool_row[2]) if pool_row and pool_row[2] else 0
        shared_in = int(pool_row[3]) if pool_row and pool_row[3] else 0
        avg_utilization = float(pool_row[4]) if pool_row and pool_row[4] else 0.0
        
        # ============ MOVEMENT PLANNING METRICS ============
        active_plans_query = select(func.count(MovementPlan.id)).where(
            MovementPlan.status.in_([MovementPlanStatus.ACTIVE.value, MovementPlanStatus.APPROVED.value])
        )
        active_plans = (await self.db.execute(active_plans_query)).scalar() or 0
        
        # Convoys status from Convoy table
        convoy_status_query = select(Convoy.status, func.count(Convoy.id)).group_by(Convoy.status)
        convoy_status_result = await self.db.execute(convoy_status_query)
        convoy_status = {row[0]: row[1] for row in convoy_status_result.all()}
        
        in_transit_convoys = convoy_status.get("IN_TRANSIT", 0)
        halted_convoys = convoy_status.get("HALTED", 0)
        completed_today_query = select(func.count(Convoy.id)).where(
            and_(
                Convoy.status == "COMPLETED",
                Convoy.start_time >= today_start
            )
        )
        completed_convoys = (await self.db.execute(completed_today_query)).scalar() or 0
        
        # ============ ROAD SPACE METRICS ============
        active_alloc_query = select(func.count(RoadSpaceAllocation.id)).where(
            and_(
                RoadSpaceAllocation.status == RoadSpaceStatus.ALLOCATED.value,
                RoadSpaceAllocation.start_time <= now,
                RoadSpaceAllocation.end_time >= now
            )
        )
        active_allocations = (await self.db.execute(active_alloc_query)).scalar() or 0
        
        conflict_query = select(func.count(RoadSpaceAllocation.id)).where(
            RoadSpaceAllocation.has_conflict == True
        )
        conflicts_detected = (await self.db.execute(conflict_query)).scalar() or 0
        
        # ============ NOTIFICATION METRICS ============
        notif_sent_query = select(func.count(EntityNotification.id)).where(
            and_(
                EntityNotification.sent_at >= today_start,
                EntityNotification.status.in_(["SENT", "ACKNOWLEDGED"])
            )
        )
        notifications_sent = (await self.db.execute(notif_sent_query)).scalar() or 0
        
        notif_pending_query = select(func.count(EntityNotification.id)).where(
            EntityNotification.status == "PENDING"
        )
        notifications_pending = (await self.db.execute(notif_pending_query)).scalar() or 0
        
        notif_ack_query = select(func.count(EntityNotification.id)).where(
            and_(
                EntityNotification.acknowledged_at >= today_start
            )
        )
        notifications_acked = (await self.db.execute(notif_ack_query)).scalar() or 0
        
        # ============ ROUTE & THREAT METRICS ============
        route_query = select(Route.threat_level, func.count(Route.id)).group_by(Route.threat_level)
        route_result = await self.db.execute(route_query)
        threat_distribution = {row[0]: row[1] for row in route_result.all()}
        
        # Active obstacles
        obstacle_query = select(func.count(Obstacle.id)).where(Obstacle.is_active == True)
        active_obstacles = (await self.db.execute(obstacle_query)).scalar() or 0
        
        # ============ ENTITY METRICS ============
        entity_query = select(func.count(MilitaryEntity.id))
        total_entities = (await self.db.execute(entity_query)).scalar() or 0
        
        # Calculate efficiency score
        if pending_count + transit_count > 0:
            load_efficiency = (delivered_count / (pending_count + transit_count + delivered_count)) * 100 if delivered_count > 0 else 0
        else:
            load_efficiency = 100 if delivered_count > 0 else 0
        
        system_efficiency = (
            (load_efficiency * 0.3) +
            ((100 - avg_utilization) * 0.2) +  # Lower unutilized = better
            (((sharing_active / max(1, sharing_pending + sharing_active)) * 100) * 0.2) +
            (((active_plans / max(1, in_transit_convoys)) * 100 if in_transit_convoys > 0 else 100) * 0.15) +
            (100 - (conflicts_detected * 20) if conflicts_detected < 5 else 0) * 0.15
        )
        
        return {
            "load_management": {
                "pending_assignments": pending_count,
                "pending_tons": round(pending_tons, 2),
                "in_transit_assignments": transit_count,
                "in_transit_tons": round(transit_tons, 2),
                "delivered_today": delivered_count,
                "delivered_tons_today": round(delivered_tons, 2),
                "priority_distribution": priority_dist,
                "load_efficiency_percent": round(load_efficiency, 1)
            },
            "vehicle_sharing": {
                "total_fleet_size": total_vehicles,
                "available_vehicles": available_vehicles,
                "availability_rate": round(available_vehicles / max(1, total_vehicles) * 100, 1),
                "vehicles_shared_out": shared_out,
                "vehicles_shared_in": shared_in,
                "net_sharing": shared_in - shared_out,
                "pending_requests": sharing_pending,
                "active_agreements": sharing_active,
                "fleet_utilization": round(avg_utilization, 1)
            },
            "movement_planning": {
                "active_plans": active_plans,
                "convoys_in_transit": in_transit_convoys,
                "convoys_halted": halted_convoys,
                "convoys_completed_today": completed_convoys,
                "total_active_convoys": in_transit_convoys + halted_convoys
            },
            "road_space": {
                "active_allocations": active_allocations,
                "conflicts_detected": conflicts_detected,
                "conflict_rate": round(conflicts_detected / max(1, active_allocations) * 100, 1) if active_allocations > 0 else 0
            },
            "notifications": {
                "sent_today": notifications_sent,
                "pending": notifications_pending,
                "acknowledged_today": notifications_acked,
                "acknowledgement_rate": round(notifications_acked / max(1, notifications_sent) * 100, 1) if notifications_sent > 0 else 100
            },
            "threat_overview": {
                "route_threat_distribution": threat_distribution,
                "active_obstacles": active_obstacles,
                "high_threat_routes": threat_distribution.get("RED", 0) + threat_distribution.get("ORANGE", 0)
            },
            "entities": {
                "total_entities": total_entities
            },
            "system_metrics": {
                "efficiency_score": round(min(100, max(0, system_efficiency)), 1),
                "ai_optimization_active": True,
                "last_updated": now.isoformat()
            },
            "timestamp": now.isoformat()
        }
