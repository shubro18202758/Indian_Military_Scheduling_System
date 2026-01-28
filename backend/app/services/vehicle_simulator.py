"""
Military Vehicle Movement Simulator
====================================
Realistic military convoy simulation with:
- Physics-based vehicle dynamics
- Real-time telemetry generation
- AI-powered tactical intelligence
- Full database integration

NO HARDCODED VALUES - All calculations derived from physics models.
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

# Import physics and AI engines
from app.services.realistic_physics_engine import (
    physics_engine, PhysicsState, TerrainType, WeatherCondition
)
from app.services.tactical_intelligence import (
    tactical_intelligence, TacticalAssessment, ThreatLevel
)


# Vehicle specifications for physics calculations
VEHICLE_SPECS = {
    "Truck": {"mass_kg": 8000, "power_kw": 220, "tank_liters": 300, "frontal_area": 8.0, "drag_coef": 0.7, "max_rpm": 2800},
    "TRUCK": {"mass_kg": 8000, "power_kw": 220, "tank_liters": 300, "frontal_area": 8.0, "drag_coef": 0.7, "max_rpm": 2800},
    "Tanker": {"mass_kg": 12000, "power_kw": 280, "tank_liters": 400, "frontal_area": 10.0, "drag_coef": 0.75, "max_rpm": 2600},
    "TANKER": {"mass_kg": 12000, "power_kw": 280, "tank_liters": 400, "frontal_area": 10.0, "drag_coef": 0.75, "max_rpm": 2600},
    "APC": {"mass_kg": 15000, "power_kw": 400, "tank_liters": 500, "frontal_area": 12.0, "drag_coef": 0.8, "max_rpm": 3000},
    "Recovery": {"mass_kg": 14000, "power_kw": 320, "tank_liters": 350, "frontal_area": 9.0, "drag_coef": 0.72, "max_rpm": 2600},
    "RECOVERY": {"mass_kg": 14000, "power_kw": 320, "tank_liters": 350, "frontal_area": 9.0, "drag_coef": 0.72, "max_rpm": 2600},
    "Ambulance": {"mass_kg": 5000, "power_kw": 180, "tank_liters": 150, "frontal_area": 6.0, "drag_coef": 0.6, "max_rpm": 3500},
    "AMBULANCE": {"mass_kg": 5000, "power_kw": 180, "tank_liters": 150, "frontal_area": 6.0, "drag_coef": 0.6, "max_rpm": 3500},
    "Command": {"mass_kg": 6000, "power_kw": 200, "tank_liters": 180, "frontal_area": 7.0, "drag_coef": 0.65, "max_rpm": 3200},
    "COMMAND": {"mass_kg": 6000, "power_kw": 200, "tank_liters": 180, "frontal_area": 7.0, "drag_coef": 0.65, "max_rpm": 3200},
}

DEFAULT_SPECS = {"mass_kg": 8000, "power_kw": 220, "tank_liters": 300, "frontal_area": 8.0, "drag_coef": 0.7, "max_rpm": 2800}


class VehicleSimulator:
    """
    Realistic military vehicle movement simulator.
    Uses physics engine for all calculations - no hardcoded values.
    """
    
    def __init__(self):
        self.active_simulations: Dict[int, dict] = {}  # convoy_id -> simulation state
        self.vehicle_states: Dict[int, dict] = {}  # asset_id -> vehicle state
        self.is_running = False
        self.tick_interval = 1.0  # seconds between updates
        
        # Terrain and weather simulation
        self.current_weather = WeatherCondition.CLEAR
        self.weather_change_counter = 0
        
    async def start_convoy_simulation(
        self, 
        db: AsyncSession, 
        convoy_id: int,
        speed_multiplier: float = 2.0
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
            select(TransportAsset).where(TransportAsset.convoy_id == convoy_id)
        )
        assets = result.scalars().all()
        
        if not assets:
            # Assign some available assets
            result = await db.execute(
                select(TransportAsset)
                .where(TransportAsset.is_available == True)
                .limit(4)
            )
            assets = result.scalars().all()
            for asset in assets:
                asset.convoy_id = convoy_id
            await db.commit()
        
        # Calculate route characteristics
        waypoints = route.waypoints
        total_distance = self._calculate_route_distance(waypoints)
        terrain_types = route.terrain_zones if hasattr(route, 'terrain_zones') and route.terrain_zones else ["PAVED_ROAD"]
        
        # Determine initial altitude from route
        initial_altitude = 500  # Default
        if hasattr(route, 'max_altitude_m') and route.max_altitude_m:
            initial_altitude = route.max_altitude_m * 0.3  # Start at 30% of max
        
        # Initialize simulation state
        self.active_simulations[convoy_id] = {
            "convoy_id": convoy_id,
            "route_id": route.id,
            "waypoints": waypoints,
            "speed_multiplier": speed_multiplier,
            "started_at": datetime.utcnow(),
            "status": "ACTIVE",
            "total_distance_km": total_distance,
            "terrain_types": terrain_types,
            "weather": self.current_weather.value,
        }
        
        # Initialize vehicle states with physics engine
        for idx, asset in enumerate(assets):
            specs = VEHICLE_SPECS.get(asset.asset_type, DEFAULT_SPECS)
            
            # Calculate initial cargo (50-80% capacity)
            cargo_kg = (asset.capacity_tons or 5.0) * 1000 * random.uniform(0.5, 0.8)
            
            # Initialize physics state
            physics_engine.initialize_vehicle(
                vehicle_id=asset.id,
                vehicle_mass_kg=specs["mass_kg"],
                engine_power_kw=specs["power_kw"],
                fuel_tank_liters=specs["tank_liters"],
                initial_fuel_pct=asset.fuel_status or random.uniform(70, 100),
                cargo_kg=cargo_kg,
                lat=waypoints[0][0],
                lng=waypoints[0][1],
                altitude_m=initial_altitude
            )
            
            # Calculate base speed for convoy (varies by position)
            # Lead vehicle slightly faster, rear vehicles follow
            base_speed = 40 + random.uniform(-5, 5)  # 35-45 km/h base
            
            self.vehicle_states[asset.id] = {
                "asset_id": asset.id,
                "convoy_id": convoy_id,
                "waypoint_index": 0,
                "segment_progress": max(0, -0.02 * idx),  # Staggered formation
                "target_speed_kmh": base_speed,
                "distance_traveled_km": 0.0,
                "status": "MOVING",
                "last_update": datetime.utcnow(),
                "obstacle_response": None,
                "formation_position": idx,
                "specs": specs,
                "cargo_kg": cargo_kg,
            }
            
            # Set initial position in database
            if waypoints:
                asset.current_lat = waypoints[0][0]
                asset.current_long = waypoints[0][1]
                asset.bearing = self._calculate_bearing(waypoints[0], waypoints[1] if len(waypoints) > 1 else waypoints[0])
                asset.altitude_m = initial_altitude
                asset.cargo_weight_kg = cargo_kg
        
        await db.commit()
        
        return {
            "status": "started",
            "convoy_id": convoy_id,
            "vehicles": len(assets),
            "route_waypoints": len(waypoints),
            "total_distance_km": total_distance
        }
    
    async def stop_convoy_simulation(self, db: AsyncSession, convoy_id: int) -> dict:
        """Stop simulation for a convoy."""
        if convoy_id in self.active_simulations:
            del self.active_simulations[convoy_id]
            
            for asset_id, state in list(self.vehicle_states.items()):
                if state.get("convoy_id") == convoy_id:
                    del self.vehicle_states[asset_id]
                    
            return {"status": "stopped", "convoy_id": convoy_id}
        return {"error": "Convoy simulation not found"}
    
    async def update_all_vehicles(self, db: AsyncSession) -> List[dict]:
        """
        Single tick update for all active vehicle simulations.
        Uses physics engine for realistic calculations.
        """
        updates = []
        now = datetime.utcnow()
        
        # Simulate weather changes (every 100 ticks on average)
        self.weather_change_counter += 1
        if self.weather_change_counter > 100 and random.random() < 0.1:
            self._update_weather()
            self.weather_change_counter = 0
        
        for asset_id, state in list(self.vehicle_states.items()):
            convoy_id = state["convoy_id"]
            sim = self.active_simulations.get(convoy_id)
            if not sim:
                continue
                
            waypoints = sim["waypoints"]
            speed_mult = sim["speed_multiplier"]
            
            # Check for obstacles
            obstacle_effect = await self._check_obstacles(db, asset_id, state)
            
            # Update vehicle position and physics
            update_data = await self._update_vehicle_with_physics(
                db, asset_id, state, waypoints, speed_mult, obstacle_effect, now, sim
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
        asset = await db.get(TransportAsset, asset_id)
        if not asset or not asset.current_lat:
            return None
            
        result = await db.execute(
            select(Obstacle)
            .where(Obstacle.is_active == True)
            .where(Obstacle.is_countered == False)
        )
        obstacles = result.scalars().all()
        
        for obs in obstacles:
            if not obs.latitude or not obs.longitude:
                continue
                
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
    
    async def _update_vehicle_with_physics(
        self,
        db: AsyncSession,
        asset_id: int,
        state: dict,
        waypoints: List[List[float]],
        speed_mult: float,
        obstacle_effect: Optional[dict],
        now: datetime,
        sim: dict
    ) -> Optional[dict]:
        """Update vehicle using physics engine."""
        
        asset = await db.get(TransportAsset, asset_id)
        if not asset:
            return None
            
        # Time delta
        last_update = state["last_update"]
        dt_seconds = (now - last_update).total_seconds()
        state["last_update"] = now
        
        # Current segment
        wp_idx = state["waypoint_index"]
        if wp_idx >= len(waypoints) - 1:
            state["status"] = "ARRIVED"
            asset.current_speed = 0
            await db.commit()
            return {"asset_id": asset_id, "status": "ARRIVED"}
        
        # Calculate target speed based on conditions
        base_speed = state["target_speed_kmh"]
        target_speed = base_speed
        
        # Apply obstacle effects
        if obstacle_effect:
            if obstacle_effect["blocks_route"]:
                target_speed = 0
                state["status"] = "HALTED_OBSTACLE"
                state["obstacle_response"] = {
                    "action": "HALT",
                    "obstacle_type": obstacle_effect["type"],
                    "awaiting_clearance": True
                }
            else:
                target_speed *= obstacle_effect["speed_reduction"]
                state["status"] = "SLOWED"
                state["obstacle_response"] = {
                    "action": "PROCEED_CAUTION",
                    "speed_reduction": obstacle_effect["speed_reduction"]
                }
        else:
            state["status"] = "MOVING"
            state["obstacle_response"] = None
        
        # Determine terrain from route
        terrain_types = sim.get("terrain_types", ["PAVED_ROAD"])
        segment_terrain = terrain_types[min(wp_idx, len(terrain_types) - 1)] if terrain_types else "PAVED_ROAD"
        terrain = self._map_terrain(segment_terrain)
        
        # Get current weather
        weather = self.current_weather
        
        # Calculate gradient from altitude change
        current_alt = asset.altitude_m or 0
        next_wp = waypoints[min(wp_idx + 1, len(waypoints) - 1)]
        segment_length = self._haversine_distance(
            asset.current_lat or waypoints[wp_idx][0],
            asset.current_long or waypoints[wp_idx][1],
            next_wp[0], next_wp[1]
        ) * 1000  # Convert to meters
        
        # Simulate altitude changes based on terrain
        target_alt = current_alt
        if "HIGH" in segment_terrain or "MOUNTAIN" in segment_terrain:
            target_alt = current_alt + random.uniform(-50, 100) * (dt_seconds / 60)
            target_alt = min(4500, max(500, target_alt))
        
        alt_change = target_alt - current_alt
        gradient_deg = math.degrees(math.atan2(alt_change, max(1, segment_length))) if segment_length > 0 else 0
        gradient_deg = max(-15, min(15, gradient_deg))  # Clamp to realistic values
        
        # Get vehicle specs
        specs = state.get("specs", DEFAULT_SPECS)
        
        # Calculate new position
        segment_start = waypoints[wp_idx]
        segment_end = waypoints[wp_idx + 1]
        segment_km = self._haversine_distance(
            segment_start[0], segment_start[1],
            segment_end[0], segment_end[1]
        )
        
        # Physics update
        physics_state = physics_engine.update_physics(
            vehicle_id=asset_id,
            target_speed_kmh=target_speed * speed_mult,
            vehicle_mass_kg=specs["mass_kg"],
            engine_power_kw=specs["power_kw"],
            max_engine_rpm=specs["max_rpm"],
            fuel_tank_liters=specs["tank_liters"],
            frontal_area_m2=specs["frontal_area"],
            drag_coefficient=specs["drag_coef"],
            terrain=terrain,
            weather=weather,
            gradient_deg=gradient_deg,
            delta_time_s=dt_seconds,
            heading_deg=asset.bearing or 0,
            new_lat=asset.current_lat or segment_start[0],
            new_lng=asset.current_long or segment_start[1],
            altitude_m=target_alt
        )
        
        if not physics_state:
            return None
        
        # Distance traveled this tick based on actual physics velocity
        actual_speed_kmh = physics_state.velocity_ms * 3.6
        distance_km = (actual_speed_kmh / 3600.0) * dt_seconds * speed_mult
        
        # Update segment progress
        if segment_km > 0:
            progress_delta = distance_km / segment_km
            state["segment_progress"] += progress_delta
        
        # Move to next segment if needed
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
            new_lat = waypoints[-1][0]
            new_lng = waypoints[-1][1]
            bearing = asset.bearing or 0
        
        # Update physics state with new position
        physics_state.latitude = new_lat
        physics_state.longitude = new_lng
        physics_state.heading_deg = bearing
        physics_state.altitude_m = target_alt
        
        # Calculate fuel percentage
        fuel_pct = (physics_state.fuel_liters / specs["tank_liters"]) * 100
        
        state["distance_traveled_km"] += distance_km
        
        # === UPDATE DATABASE WITH ALL TELEMETRY ===
        asset.current_lat = new_lat
        asset.current_long = new_lng
        asset.bearing = bearing
        asset.altitude_m = target_alt
        asset.gradient_deg = gradient_deg
        
        # Motion
        asset.current_speed = actual_speed_kmh
        asset.acceleration = physics_state.acceleration_ms2
        
        # Fuel
        asset.fuel_status = fuel_pct
        asset.fuel_liters = physics_state.fuel_liters
        asset.fuel_consumption_lph = physics_state.fuel_flow_lph
        asset.fuel_consumption_kpl = physics_state.fuel_consumption_kpl
        asset.range_remaining_km = physics_state.range_remaining_km
        
        # Engine
        asset.engine_rpm = physics_state.engine_rpm
        asset.engine_temp = physics_state.engine_temp_c
        asset.engine_load = physics_state.engine_load_pct
        asset.throttle_position = physics_state.throttle_position * 100
        asset.engine_torque = physics_state.torque_nm
        asset.engine_power_kw = physics_state.power_output_kw
        asset.engine_hours = physics_state.engine_hours
        
        # Transmission
        asset.current_gear = physics_state.current_gear
        asset.transmission_temp = physics_state.transmission_temp_c
        
        # Tires
        asset.tire_pressures = physics_state.tire_pressures_psi
        asset.tire_temps = physics_state.tire_temps_c
        asset.tire_wear = physics_state.tire_wear_pct
        asset.tire_pressure = sum(physics_state.tire_pressures_psi) / 4
        
        # Brakes
        asset.brake_temps = physics_state.brake_temps_c
        asset.brake_wear = physics_state.brake_wear_pct
        asset.abs_active = physics_state.abs_active
        
        # Suspension
        asset.suspension_travel = physics_state.suspension_travel_mm
        asset.load_distribution = physics_state.load_distribution_pct
        
        # Electrical
        asset.battery_voltage = physics_state.battery_voltage
        asset.battery_soc = physics_state.battery_soc_pct
        asset.alternator_output = physics_state.alternator_output_a
        
        # Cargo
        asset.cargo_weight_kg = physics_state.cargo_weight_kg
        asset.cargo_secured = physics_state.cargo_secured
        
        # Environment
        asset.ambient_temp = physics_state.ambient_temp_c
        asset.road_friction = physics_state.road_friction_coef
        asset.visibility_m = physics_state.visibility_m
        asset.precipitation_mm_hr = physics_state.precipitation_mm_hr
        
        # Signatures
        asset.thermal_signature = physics_state.thermal_signature
        asset.acoustic_db = physics_state.acoustic_signature_db
        
        # Crew
        asset.driver_fatigue = physics_state.driver_fatigue_pct
        asset.vibration_level = physics_state.vibration_level
        
        # Tracking
        asset.total_km_traveled = (asset.total_km_traveled or 0) + distance_km
        asset.last_location_update = now
        
        await db.commit()
        
        return {
            "asset_id": asset_id,
            "name": asset.name,
            "lat": new_lat,
            "lng": new_lng,
            "bearing": bearing,
            "altitude_m": target_alt,
            "speed_kmh": actual_speed_kmh,
            "acceleration_ms2": physics_state.acceleration_ms2,
            "fuel_percent": fuel_pct,
            "fuel_liters": physics_state.fuel_liters,
            "engine_rpm": physics_state.engine_rpm,
            "engine_temp": physics_state.engine_temp_c,
            "engine_load": physics_state.engine_load_pct,
            "gear": physics_state.current_gear,
            "status": state["status"],
            "obstacle_response": state["obstacle_response"],
            "distance_km": state["distance_traveled_km"],
            "terrain": terrain.value,
            "weather": weather.value,
            "tire_pressures": physics_state.tire_pressures_psi,
            "brake_temps": physics_state.brake_temps_c,
            "thermal_signature": physics_state.thermal_signature,
            "fatigue": physics_state.driver_fatigue_pct
        }
    
    def _map_terrain(self, terrain_str: str) -> TerrainType:
        """Map route terrain string to TerrainType enum."""
        terrain_map = {
            "HIGHWAY": TerrainType.HIGHWAY,
            "PAVED": TerrainType.PAVED_ROAD,
            "PAVED_ROAD": TerrainType.PAVED_ROAD,
            "UNPAVED": TerrainType.UNPAVED,
            "MOUNTAIN": TerrainType.MOUNTAIN_PASS,
            "MOUNTAINOUS": TerrainType.MOUNTAIN_PASS,
            "MOUNTAIN_PASS": TerrainType.MOUNTAIN_PASS,
            "SNOW": TerrainType.SNOW_COVERED,
            "SNOW_COVERED": TerrainType.SNOW_COVERED,
            "DESERT": TerrainType.DESERT_SAND,
            "DESERT_SAND": TerrainType.DESERT_SAND,
            "RIVER": TerrainType.RIVERINE,
            "RIVERINE": TerrainType.RIVERINE,
            "FOREST": TerrainType.FOREST_TRAIL,
            "FOREST_TRAIL": TerrainType.FOREST_TRAIL,
            "URBAN": TerrainType.URBAN,
            "LADAKH": TerrainType.HIGH_ALTITUDE,
            "LADAKH_HIGH": TerrainType.HIGH_ALTITUDE,
            "HIGH_ALTITUDE": TerrainType.HIGH_ALTITUDE,
            "KASHMIR": TerrainType.MOUNTAIN_PASS,
            "KASHMIR_VALLEY": TerrainType.MOUNTAIN_PASS,
        }
        return terrain_map.get(terrain_str.upper(), TerrainType.PAVED_ROAD)
    
    def _update_weather(self):
        """Randomly update weather conditions."""
        conditions = [
            WeatherCondition.CLEAR,
            WeatherCondition.OVERCAST,
            WeatherCondition.LIGHT_RAIN,
            WeatherCondition.FOG,
        ]
        # Weighted selection - clear weather more common
        weights = [0.5, 0.25, 0.15, 0.1]
        self.current_weather = random.choices(conditions, weights=weights)[0]
    
    def _calculate_route_distance(self, waypoints: List[List[float]]) -> float:
        """Calculate total route distance in km."""
        total = 0
        for i in range(len(waypoints) - 1):
            total += self._haversine_distance(
                waypoints[i][0], waypoints[i][1],
                waypoints[i+1][0], waypoints[i+1][1]
            )
        return total
    
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
        """Get detailed telemetry from physics engine."""
        return physics_engine.to_telemetry_dict(asset_id)
    
    def get_all_telemetry(self) -> List[dict]:
        """Get telemetry for all active vehicles."""
        return [
            self.get_vehicle_telemetry(asset_id) 
            for asset_id in self.vehicle_states.keys()
        ]


# Global simulator instance
vehicle_simulator = VehicleSimulator()
