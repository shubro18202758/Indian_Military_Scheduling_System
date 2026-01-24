"""
Military Vehicle Movement Simulator
Simulates realistic vehicle movement along convoy routes with:
- Real-time position updates
- Fuel consumption
- Speed variations based on terrain
- Obstacle response behavior
- GPS telemetry data generation
"""

import asyncio
import random
import math
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.models.asset import TransportAsset
from app.models.convoy import Convoy
from app.models.route import Route
from app.models.obstacle import Obstacle


class VehicleSimulator:
    """
    Simulates realistic military vehicle movement for convoy operations.
    """
    
    def __init__(self):
        self.active_simulations: Dict[int, dict] = {}  # convoy_id -> simulation state
        self.vehicle_states: Dict[int, dict] = {}  # asset_id -> vehicle state
        self.is_running = False
        self.tick_interval = 1.0  # seconds between updates
        
    async def start_convoy_simulation(
        self, 
        db: AsyncSession, 
        convoy_id: int,
        speed_multiplier: float = 2.0  # 2x speed for realistic demo
    ) -> dict:
        """Start simulating movement for all vehicles in a convoy."""
        
        # Get convoy with route
        convoy = await db.get(Convoy, convoy_id)
        if not convoy:
            return {"error": "Convoy not found"}
            
        # Get route waypoints
        route = await db.get(Route, convoy.route_id)
        if not route or not route.waypoints:
            return {"error": "Route not found or has no waypoints"}
            
        # Get assigned assets
        result = await db.execute(
            select(TransportAsset).where(TransportAsset.current_convoy_id == convoy_id)
        )
        assets = result.scalars().all()
        
        if not assets:
            # Assign some available assets to this convoy
            result = await db.execute(
                select(TransportAsset)
                .where(TransportAsset.is_available == True)
                .limit(4)
            )
            assets = result.scalars().all()
            for asset in assets:
                asset.current_convoy_id = convoy_id
                asset.operational_status = "DEPLOYED"
            await db.commit()
        
        # Initialize simulation state
        waypoints = route.waypoints
        self.active_simulations[convoy_id] = {
            "convoy_id": convoy_id,
            "route_id": route.id,
            "waypoints": waypoints,
            "speed_multiplier": speed_multiplier,
            "started_at": datetime.utcnow(),
            "status": "ACTIVE"
        }
        
        # Initialize vehicle states along the convoy (staggered positions)
        for idx, asset in enumerate(assets):
            # Stagger vehicles along the route
            progress = max(0, -0.02 * idx)  # Slight offset for convoy formation
            
            self.vehicle_states[asset.id] = {
                "asset_id": asset.id,
                "convoy_id": convoy_id,
                "waypoint_index": 0,
                "segment_progress": progress,  # 0.0 to 1.0 within segment
                "current_speed_kmh": 0.0,
                "target_speed_kmh": asset.avg_speed_plains_kmh or 40.0,
                "fuel_level": asset.fuel_status,
                "distance_traveled_km": 0.0,
                "status": "MOVING",
                "last_update": datetime.utcnow(),
                "obstacle_response": None,
                "formation_position": idx  # Position in convoy
            }
            
            # Set initial position
            if waypoints:
                asset.current_lat = waypoints[0][0]
                asset.current_long = waypoints[0][1]
                asset.bearing = self._calculate_bearing(waypoints[0], waypoints[1] if len(waypoints) > 1 else waypoints[0])
                asset.operational_status = "DEPLOYED"
        
        await db.commit()
        
        return {
            "status": "started",
            "convoy_id": convoy_id,
            "vehicles": len(assets),
            "route_waypoints": len(waypoints)
        }
    
    async def stop_convoy_simulation(self, db: AsyncSession, convoy_id: int) -> dict:
        """Stop simulation for a convoy."""
        if convoy_id in self.active_simulations:
            del self.active_simulations[convoy_id]
            
            # Update vehicles
            for asset_id, state in list(self.vehicle_states.items()):
                if state.get("convoy_id") == convoy_id:
                    del self.vehicle_states[asset_id]
                    
            return {"status": "stopped", "convoy_id": convoy_id}
        return {"error": "Convoy simulation not found"}
    
    async def update_all_vehicles(self, db: AsyncSession) -> List[dict]:
        """
        Single tick update for all active vehicle simulations.
        Returns list of vehicle position updates.
        """
        updates = []
        now = datetime.utcnow()
        
        for asset_id, state in list(self.vehicle_states.items()):
            convoy_id = state["convoy_id"]
            sim = self.active_simulations.get(convoy_id)
            if not sim:
                continue
                
            waypoints = sim["waypoints"]
            speed_mult = sim["speed_multiplier"]
            
            # Check for obstacles affecting this vehicle
            obstacle_effect = await self._check_obstacles(db, asset_id, state)
            
            # Calculate new position
            update_data = await self._update_vehicle_position(
                db, asset_id, state, waypoints, speed_mult, obstacle_effect, now
            )
            
            if update_data:
                updates.append(update_data)
        
        return updates
    
    async def _check_obstacles(
        self, 
        db: AsyncSession, 
        asset_id: int, 
        state: dict
    ) -> Optional[dict]:
        """Check if any active obstacle affects this vehicle."""
        
        # Get vehicle's current position from database
        asset = await db.get(TransportAsset, asset_id)
        if not asset or not asset.current_lat:
            return None
            
        # Find nearby active obstacles
        result = await db.execute(
            select(Obstacle)
            .where(Obstacle.is_active == True)
            .where(Obstacle.is_countered == False)
        )
        obstacles = result.scalars().all()
        
        for obs in obstacles:
            if not obs.latitude or not obs.longitude:
                continue
                
            # Calculate distance to obstacle
            dist = self._haversine_distance(
                asset.current_lat, asset.current_long,
                obs.latitude, obs.longitude
            )
            
            radius = obs.radius_km or 0.5
            
            if dist < radius:
                return {
                    "obstacle_id": obs.id,
                    "type": obs.obstacle_type,
                    "severity": obs.severity,
                    "blocks_route": obs.blocks_route,
                    "speed_reduction": obs.speed_reduction_factor or 0.5,
                    "distance_km": dist
                }
        
        return None
    
    async def _update_vehicle_position(
        self,
        db: AsyncSession,
        asset_id: int,
        state: dict,
        waypoints: List[List[float]],
        speed_mult: float,
        obstacle_effect: Optional[dict],
        now: datetime
    ) -> Optional[dict]:
        """Update a single vehicle's position."""
        
        asset = await db.get(TransportAsset, asset_id)
        if not asset:
            return None
            
        # Time delta since last update
        last_update = state["last_update"]
        dt_seconds = (now - last_update).total_seconds()
        state["last_update"] = now
        
        # Current segment
        wp_idx = state["waypoint_index"]
        if wp_idx >= len(waypoints) - 1:
            # Reached destination
            state["status"] = "ARRIVED"
            asset.operational_status = "READY"
            await db.commit()
            return {"asset_id": asset_id, "status": "ARRIVED"}
        
        # Calculate speed
        base_speed = state["target_speed_kmh"]
        current_speed = base_speed
        
        # Apply obstacle effects
        if obstacle_effect:
            if obstacle_effect["blocks_route"]:
                current_speed = 0
                state["status"] = "HALTED_OBSTACLE"
                state["obstacle_response"] = {
                    "action": "HALT",
                    "obstacle_type": obstacle_effect["type"],
                    "awaiting_clearance": True
                }
            else:
                current_speed *= obstacle_effect["speed_reduction"]
                state["status"] = "SLOWED"
                state["obstacle_response"] = {
                    "action": "PROCEED_CAUTION",
                    "speed_reduction": obstacle_effect["speed_reduction"]
                }
        else:
            state["status"] = "MOVING"
            state["obstacle_response"] = None
        
        state["current_speed_kmh"] = current_speed
        
        # Distance traveled in this tick (km)
        # Apply speed multiplier for demo
        distance_km = (current_speed / 3600.0) * dt_seconds * speed_mult
        
        # Update fuel consumption
        if current_speed > 0:
            fuel_consumption = distance_km / (asset.fuel_consumption_km_per_liter or 3.0)
            fuel_percent_used = (fuel_consumption / (asset.fuel_capacity_liters or 200)) * 100
            state["fuel_level"] = max(0, state["fuel_level"] - fuel_percent_used)
            asset.fuel_status = state["fuel_level"]
        
        # Move along route
        segment_start = waypoints[wp_idx]
        segment_end = waypoints[wp_idx + 1]
        segment_length = self._haversine_distance(
            segment_start[0], segment_start[1],
            segment_end[0], segment_end[1]
        )
        
        # Progress within segment
        if segment_length > 0:
            progress_delta = distance_km / segment_length
            state["segment_progress"] += progress_delta
        
        # Check if moved to next segment
        while state["segment_progress"] >= 1.0 and wp_idx < len(waypoints) - 1:
            state["segment_progress"] -= 1.0
            wp_idx += 1
            state["waypoint_index"] = wp_idx
            
            if wp_idx >= len(waypoints) - 1:
                break
        
        # Calculate interpolated position
        if wp_idx < len(waypoints) - 1:
            progress = min(1.0, max(0.0, state["segment_progress"]))
            segment_start = waypoints[wp_idx]
            segment_end = waypoints[wp_idx + 1]
            
            new_lat = segment_start[0] + (segment_end[0] - segment_start[0]) * progress
            new_lng = segment_start[1] + (segment_end[1] - segment_start[1]) * progress
            bearing = self._calculate_bearing(segment_start, segment_end)
        else:
            # At destination
            new_lat = waypoints[-1][0]
            new_lng = waypoints[-1][1]
            bearing = asset.bearing or 0
        
        # Update database
        asset.current_lat = new_lat
        asset.current_long = new_lng
        asset.bearing = bearing
        asset.last_location_update = now
        state["distance_traveled_km"] += distance_km
        asset.total_km_traveled = (asset.total_km_traveled or 0) + distance_km
        
        await db.commit()
        
        return {
            "asset_id": asset_id,
            "name": asset.name,
            "lat": new_lat,
            "lng": new_lng,
            "bearing": bearing,
            "speed_kmh": current_speed,
            "fuel_percent": state["fuel_level"],
            "status": state["status"],
            "obstacle_response": state["obstacle_response"],
            "distance_km": state["distance_traveled_km"]
        }
    
    def _haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two points in km."""
        R = 6371  # Earth's radius in km
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c
    
    def _calculate_bearing(self, point1: List[float], point2: List[float]) -> float:
        """Calculate bearing from point1 to point2."""
        lat1 = math.radians(point1[0])
        lat2 = math.radians(point2[0])
        diff_lng = math.radians(point2[1] - point1[1])
        
        x = math.sin(diff_lng) * math.cos(lat2)
        y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(diff_lng)
        
        bearing = math.degrees(math.atan2(x, y))
        return (bearing + 360) % 360
    
    def get_vehicle_telemetry(self, asset_id: int) -> Optional[dict]:
        """Get detailed telemetry for a specific vehicle."""
        state = self.vehicle_states.get(asset_id)
        if not state:
            return None
            
        return {
            "asset_id": asset_id,
            "speed_kmh": state["current_speed_kmh"],
            "fuel_percent": state["fuel_level"],
            "distance_traveled_km": state["distance_traveled_km"],
            "status": state["status"],
            "formation_position": state["formation_position"],
            "obstacle_response": state["obstacle_response"],
            "waypoint_progress": {
                "current": state["waypoint_index"],
                "segment_progress": state["segment_progress"]
            }
        }
    
    def get_all_telemetry(self) -> List[dict]:
        """Get telemetry for all active vehicles."""
        return [
            self.get_vehicle_telemetry(asset_id) 
            for asset_id in self.vehicle_states.keys()
        ]


# Global simulator instance
vehicle_simulator = VehicleSimulator()
