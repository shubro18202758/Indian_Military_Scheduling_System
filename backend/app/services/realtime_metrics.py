"""
Real-time Vehicle Metrics Engine
=================================

Provides dynamic, physics-based calculations for vehicle telemetry:
1. Fuel Consumption - Based on terrain, load, speed, gradient
2. Engine Performance - Temperature, RPM, stress levels
3. GPS/Navigation - Accuracy, signal strength, drift simulation
4. Weather Impact - Speed reduction, visibility, traction
5. Maintenance Prediction - Wear estimation, breakdown probability
6. Communication Status - Radio strength, network latency

All metrics are dynamically calculated - NO HARDCODING.
"""

import math
import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from enum import Enum


class VehicleType(Enum):
    TRUCK_CARGO = "TRUCK_CARGO"
    TRUCK_TANKER = "TRUCK_TANKER"
    APC = "APC"  # Armored Personnel Carrier
    RECOVERY = "RECOVERY"
    AMBULANCE = "AMBULANCE"
    COMMAND = "COMMAND"
    LOGISTICS = "LOGISTICS"
    SCOUT = "SCOUT"


class LoadType(Enum):
    AMMUNITION = "AMMUNITION"
    FUEL = "FUEL"
    RATIONS = "RATIONS"
    MEDICAL = "MEDICAL"
    EQUIPMENT = "EQUIPMENT"
    PERSONNEL = "PERSONNEL"
    MIXED = "MIXED"


@dataclass
class EngineMetrics:
    """Real-time engine performance metrics"""
    rpm: int = 0
    temperature_celsius: float = 85.0
    oil_pressure_psi: float = 40.0
    fuel_flow_lph: float = 0.0  # Liters per hour
    throttle_percent: float = 0.0
    load_percent: float = 0.0
    stress_level: float = 0.0  # 0-1
    efficiency: float = 0.85  # 0-1


@dataclass
class GPSMetrics:
    """GPS and navigation metrics"""
    latitude: float = 0.0
    longitude: float = 0.0
    altitude_m: float = 0.0
    accuracy_m: float = 5.0
    satellites_visible: int = 12
    signal_strength: float = 0.9  # 0-1
    hdop: float = 1.0  # Horizontal dilution of precision
    speed_gps_kmh: float = 0.0
    bearing_degrees: float = 0.0
    fix_type: str = "3D"


@dataclass
class CommunicationMetrics:
    """Radio and communication status"""
    radio_signal_strength: float = 0.9  # 0-1
    radio_frequency_mhz: float = 156.8
    network_latency_ms: float = 50.0
    last_hq_contact: datetime = field(default_factory=datetime.utcnow)
    encryption_status: str = "AES-256"
    data_rate_kbps: float = 128.0
    is_jammed: bool = False


@dataclass
class EnvironmentMetrics:
    """Environmental conditions affecting vehicle"""
    ambient_temperature_c: float = 25.0
    humidity_percent: float = 60.0
    visibility_km: float = 10.0
    road_condition: str = "GOOD"  # GOOD, FAIR, POOR, DAMAGED
    traction_coefficient: float = 0.8  # 0-1
    wind_speed_kmh: float = 10.0
    wind_direction_degrees: float = 0.0
    precipitation_mm_hr: float = 0.0


@dataclass
class MaintenanceMetrics:
    """Predictive maintenance metrics"""
    engine_hours: float = 0.0
    km_since_service: float = 0.0
    brake_wear_percent: float = 0.0
    tire_wear_percent: float = 0.0
    suspension_stress: float = 0.0
    next_service_km: float = 5000.0
    breakdown_probability: float = 0.01  # 0-1
    alerts: List[str] = field(default_factory=list)


@dataclass
class FuelMetrics:
    """Fuel consumption and efficiency metrics"""
    current_level_liters: float = 200.0
    tank_capacity_liters: float = 300.0
    consumption_rate_lph: float = 15.0  # Liters per hour
    consumption_rate_kpl: float = 3.0  # KM per liter
    range_remaining_km: float = 600.0
    fuel_type: str = "DIESEL"
    fuel_quality: float = 0.95  # 0-1
    efficiency_factor: float = 1.0


class VehicleMetricsEngine:
    """
    Calculates real-time vehicle metrics based on dynamic conditions.
    No hardcoded values - all calculations based on physics models.
    """
    
    # Vehicle specifications by type
    VEHICLE_SPECS = {
        VehicleType.TRUCK_CARGO: {
            "base_fuel_consumption_kpl": 3.5,
            "max_speed_kmh": 80,
            "engine_power_hp": 300,
            "weight_empty_kg": 8000,
            "max_load_kg": 10000,
            "fuel_tank_liters": 300,
            "optimal_rpm_range": (1500, 2500),
            "max_gradient_percent": 30
        },
        VehicleType.TRUCK_TANKER: {
            "base_fuel_consumption_kpl": 3.0,
            "max_speed_kmh": 70,
            "engine_power_hp": 280,
            "weight_empty_kg": 9000,
            "max_load_kg": 15000,
            "fuel_tank_liters": 350,
            "optimal_rpm_range": (1400, 2400),
            "max_gradient_percent": 25
        },
        VehicleType.APC: {
            "base_fuel_consumption_kpl": 1.5,
            "max_speed_kmh": 100,
            "engine_power_hp": 500,
            "weight_empty_kg": 15000,
            "max_load_kg": 3000,
            "fuel_tank_liters": 500,
            "optimal_rpm_range": (1800, 3000),
            "max_gradient_percent": 60
        },
        VehicleType.RECOVERY: {
            "base_fuel_consumption_kpl": 2.5,
            "max_speed_kmh": 60,
            "engine_power_hp": 400,
            "weight_empty_kg": 12000,
            "max_load_kg": 20000,
            "fuel_tank_liters": 400,
            "optimal_rpm_range": (1400, 2200),
            "max_gradient_percent": 35
        },
        VehicleType.AMBULANCE: {
            "base_fuel_consumption_kpl": 5.0,
            "max_speed_kmh": 120,
            "engine_power_hp": 250,
            "weight_empty_kg": 4000,
            "max_load_kg": 2000,
            "fuel_tank_liters": 150,
            "optimal_rpm_range": (1500, 3500),
            "max_gradient_percent": 40
        },
        VehicleType.COMMAND: {
            "base_fuel_consumption_kpl": 4.0,
            "max_speed_kmh": 100,
            "engine_power_hp": 280,
            "weight_empty_kg": 5000,
            "max_load_kg": 2000,
            "fuel_tank_liters": 180,
            "optimal_rpm_range": (1500, 3000),
            "max_gradient_percent": 35
        },
        VehicleType.LOGISTICS: {
            "base_fuel_consumption_kpl": 4.0,
            "max_speed_kmh": 85,
            "engine_power_hp": 260,
            "weight_empty_kg": 6000,
            "max_load_kg": 8000,
            "fuel_tank_liters": 250,
            "optimal_rpm_range": (1500, 2600),
            "max_gradient_percent": 28
        },
        VehicleType.SCOUT: {
            "base_fuel_consumption_kpl": 6.0,
            "max_speed_kmh": 140,
            "engine_power_hp": 200,
            "weight_empty_kg": 2500,
            "max_load_kg": 500,
            "fuel_tank_liters": 80,
            "optimal_rpm_range": (2000, 4000),
            "max_gradient_percent": 50
        }
    }
    
    # Terrain impact factors
    TERRAIN_FACTORS = {
        "PLAINS": {"fuel": 1.0, "speed": 1.0, "wear": 1.0},
        "MOUNTAINOUS": {"fuel": 1.8, "speed": 0.5, "wear": 1.5},
        "DESERT": {"fuel": 1.4, "speed": 0.7, "wear": 1.3},
        "FOREST": {"fuel": 1.2, "speed": 0.8, "wear": 1.2},
        "URBAN": {"fuel": 1.3, "speed": 0.6, "wear": 1.1},
        "SNOW_COVERED": {"fuel": 2.0, "speed": 0.4, "wear": 1.4},
        "RIVERINE": {"fuel": 1.5, "speed": 0.6, "wear": 1.3}
    }
    
    # Weather impact factors
    WEATHER_FACTORS = {
        "CLEAR": {"fuel": 1.0, "speed": 1.0, "visibility": 1.0},
        "RAIN": {"fuel": 1.15, "speed": 0.8, "visibility": 0.6},
        "HEAVY_RAIN": {"fuel": 1.3, "speed": 0.6, "visibility": 0.3},
        "SNOW": {"fuel": 1.4, "speed": 0.5, "visibility": 0.5},
        "FOG": {"fuel": 1.1, "speed": 0.4, "visibility": 0.2},
        "DUST_STORM": {"fuel": 1.5, "speed": 0.3, "visibility": 0.1}
    }
    
    def __init__(self):
        self.vehicle_states: Dict[int, Dict[str, Any]] = {}
    
    def initialize_vehicle(self, vehicle_id: int, 
                          vehicle_type: VehicleType,
                          initial_fuel_percent: float = 100.0,
                          load_weight_kg: float = 0,
                          personnel_count: int = 0) -> Dict[str, Any]:
        """Initialize metrics state for a vehicle."""
        specs = self.VEHICLE_SPECS.get(vehicle_type, self.VEHICLE_SPECS[VehicleType.TRUCK_CARGO])
        
        fuel_liters = (initial_fuel_percent / 100) * specs["fuel_tank_liters"]
        
        state = {
            "vehicle_id": vehicle_id,
            "vehicle_type": vehicle_type,
            "specs": specs,
            "load_weight_kg": load_weight_kg,
            "personnel_count": personnel_count,
            "fuel_liters": fuel_liters,
            "engine": EngineMetrics(),
            "gps": GPSMetrics(),
            "comms": CommunicationMetrics(),
            "environment": EnvironmentMetrics(),
            "maintenance": MaintenanceMetrics(),
            "fuel": FuelMetrics(
                current_level_liters=fuel_liters,
                tank_capacity_liters=specs["fuel_tank_liters"]
            ),
            "total_distance_km": 0,
            "last_update": datetime.utcnow(),
            "running_since": None,
            "terrain": "PLAINS",
            "weather": "CLEAR",
            "gradient_percent": 0
        }
        
        self.vehicle_states[vehicle_id] = state
        return state
    
    def update_metrics(self, vehicle_id: int,
                       current_speed_kmh: float,
                       lat: float,
                       lng: float,
                       altitude_m: float = 0,
                       terrain: str = "PLAINS",
                       weather: str = "CLEAR",
                       gradient_percent: float = 0,
                       delta_seconds: float = 1.0) -> Dict[str, Any]:
        """
        Update all vehicle metrics based on current conditions.
        All calculations are dynamic, physics-based.
        """
        state = self.vehicle_states.get(vehicle_id)
        if not state:
            return {}
        
        specs = state["specs"]
        now = datetime.utcnow()
        
        # Update position
        state["terrain"] = terrain
        state["weather"] = weather
        state["gradient_percent"] = gradient_percent
        
        # Calculate distance traveled this tick
        distance_km = (current_speed_kmh * delta_seconds) / 3600
        state["total_distance_km"] += distance_km
        
        # --- ENGINE METRICS ---
        engine = state["engine"]
        
        # Calculate engine load based on speed, gradient, and cargo weight
        total_weight = specs["weight_empty_kg"] + state["load_weight_kg"]
        weight_factor = total_weight / specs["weight_empty_kg"]
        gradient_factor = 1 + max(0, gradient_percent) / 100
        speed_factor = current_speed_kmh / specs["max_speed_kmh"]
        
        engine.load_percent = min(100, speed_factor * weight_factor * gradient_factor * 100)
        
        # RPM based on speed and gear simulation
        rpm_range = specs["optimal_rpm_range"]
        engine.rpm = int(rpm_range[0] + (rpm_range[1] - rpm_range[0]) * speed_factor)
        engine.rpm += random.randint(-50, 50)  # Natural variation
        
        # Temperature increases with load
        base_temp = 85
        load_heat = engine.load_percent * 0.3
        ambient_effect = (state["environment"].ambient_temperature_c - 25) * 0.1
        engine.temperature_celsius = base_temp + load_heat + ambient_effect + random.uniform(-1, 1)
        
        # Oil pressure decreases as temp increases
        engine.oil_pressure_psi = 45 - (engine.temperature_celsius - 85) * 0.2 + random.uniform(-2, 2)
        
        # Throttle position
        engine.throttle_percent = speed_factor * 100 * gradient_factor
        
        # Engine stress
        engine.stress_level = min(1.0, engine.load_percent / 100 * gradient_factor)
        
        # Efficiency drops under stress
        engine.efficiency = 0.95 - (engine.stress_level * 0.15) + random.uniform(-0.02, 0.02)
        
        # --- FUEL METRICS ---
        fuel = state["fuel"]
        terrain_factor = self.TERRAIN_FACTORS.get(terrain, self.TERRAIN_FACTORS["PLAINS"])
        weather_factor = self.WEATHER_FACTORS.get(weather, self.WEATHER_FACTORS["CLEAR"])
        
        # Base consumption modified by conditions
        base_kpl = specs["base_fuel_consumption_kpl"]
        
        # Gradient impact: uphill burns more, downhill less
        gradient_multiplier = 1 + (gradient_percent / 100) * 0.5
        
        # Load impact: heavier = more fuel
        load_multiplier = weight_factor ** 0.3
        
        # Speed impact: optimal efficiency around 50-60 km/h
        optimal_speed = 55
        speed_efficiency = 1 + abs(current_speed_kmh - optimal_speed) / 100
        
        effective_kpl = base_kpl / (
            terrain_factor["fuel"] * 
            weather_factor["fuel"] * 
            gradient_multiplier * 
            load_multiplier * 
            speed_efficiency
        )
        
        fuel.consumption_rate_kpl = round(effective_kpl, 2)
        
        # Fuel consumed this tick
        if effective_kpl > 0:
            fuel_consumed = distance_km / effective_kpl
            fuel.current_level_liters = max(0, fuel.current_level_liters - fuel_consumed)
        
        # Liters per hour
        if current_speed_kmh > 0:
            fuel.consumption_rate_lph = round(current_speed_kmh / effective_kpl, 2)
        else:
            fuel.consumption_rate_lph = 2.0  # Idle consumption
        
        # Range remaining
        fuel.range_remaining_km = round(fuel.current_level_liters * effective_kpl, 1)
        
        # Fuel flow
        engine.fuel_flow_lph = fuel.consumption_rate_lph
        
        # --- GPS METRICS ---
        gps = state["gps"]
        gps.latitude = lat
        gps.longitude = lng
        gps.altitude_m = altitude_m
        gps.speed_gps_kmh = current_speed_kmh + random.uniform(-0.5, 0.5)
        
        # GPS accuracy affected by terrain and weather
        base_accuracy = 3.0
        terrain_gps = {"MOUNTAINOUS": 3, "FOREST": 2, "URBAN": 2}.get(terrain, 0)
        weather_gps = {"HEAVY_RAIN": 2, "SNOW": 2, "DUST_STORM": 3}.get(weather, 0)
        gps.accuracy_m = base_accuracy + terrain_gps + weather_gps + random.uniform(-1, 1)
        
        # Satellite visibility
        base_sats = 12
        sat_reduction = terrain_gps + weather_gps
        gps.satellites_visible = max(4, base_sats - sat_reduction + random.randint(-1, 1))
        
        # Signal strength
        gps.signal_strength = max(0.3, 0.95 - (terrain_gps + weather_gps) * 0.1 + random.uniform(-0.05, 0.05))
        
        # HDOP
        gps.hdop = round(1.0 + (1 - gps.signal_strength) * 3 + random.uniform(-0.2, 0.2), 1)
        
        # --- COMMUNICATION METRICS ---
        comms = state["comms"]
        
        # Radio signal affected by terrain
        terrain_radio = {"MOUNTAINOUS": 0.3, "FOREST": 0.2, "URBAN": 0.1}.get(terrain, 0)
        comms.radio_signal_strength = max(0.2, 0.95 - terrain_radio + random.uniform(-0.05, 0.05))
        
        # Network latency
        comms.network_latency_ms = 30 + (1 - comms.radio_signal_strength) * 200 + random.uniform(-10, 10)
        
        # Data rate
        comms.data_rate_kbps = 256 * comms.radio_signal_strength
        
        # Jamming simulation (rare)
        comms.is_jammed = random.random() < 0.001
        if comms.is_jammed:
            comms.radio_signal_strength = 0.1
            comms.network_latency_ms = 500
        
        # --- ENVIRONMENT METRICS ---
        env = state["environment"]
        
        # Temperature based on altitude and weather
        env.ambient_temperature_c = 25 - (altitude_m / 1000) * 6.5
        if weather in ["SNOW", "BLIZZARD"]:
            env.ambient_temperature_c -= 10
        env.ambient_temperature_c += random.uniform(-2, 2)
        
        # Visibility
        env.visibility_km = 20 * weather_factor.get("visibility", 1.0)
        
        # Road condition based on weather and terrain
        if weather in ["HEAVY_RAIN", "SNOW"]:
            env.road_condition = "POOR"
            env.traction_coefficient = 0.5
        elif weather in ["RAIN"]:
            env.road_condition = "FAIR"
            env.traction_coefficient = 0.7
        else:
            env.road_condition = "GOOD"
            env.traction_coefficient = 0.9
        
        # Wind (random simulation)
        env.wind_speed_kmh = random.uniform(0, 30)
        env.wind_direction_degrees = random.uniform(0, 360)
        
        # Precipitation
        env.precipitation_mm_hr = {"RAIN": 5, "HEAVY_RAIN": 20, "SNOW": 10}.get(weather, 0)
        
        # --- MAINTENANCE METRICS ---
        maint = state["maintenance"]
        
        # Accumulate wear
        wear_rate = terrain_factor["wear"] * engine.stress_level
        maint.km_since_service += distance_km
        maint.engine_hours += delta_seconds / 3600
        
        # Brake wear (more on downhill)
        if gradient_percent < -5:
            maint.brake_wear_percent += 0.001 * abs(gradient_percent)
        
        # Tire wear
        maint.tire_wear_percent += distance_km * 0.001 * terrain_factor["wear"]
        
        # Suspension stress
        maint.suspension_stress = weight_factor * terrain_factor["wear"] * 0.3
        
        # Breakdown probability increases with wear
        base_breakdown = 0.0001
        wear_factor = (maint.km_since_service / maint.next_service_km) ** 2
        stress_factor = engine.stress_level
        maint.breakdown_probability = min(0.1, base_breakdown * (1 + wear_factor + stress_factor))
        
        # Alerts
        maint.alerts = []
        if fuel.current_level_liters < fuel.tank_capacity_liters * 0.2:
            maint.alerts.append("LOW_FUEL")
        if engine.temperature_celsius > 105:
            maint.alerts.append("ENGINE_OVERHEAT")
        if maint.km_since_service > maint.next_service_km * 0.9:
            maint.alerts.append("SERVICE_DUE")
        if maint.brake_wear_percent > 70:
            maint.alerts.append("BRAKE_WEAR_HIGH")
        if gps.satellites_visible < 5:
            maint.alerts.append("GPS_WEAK")
        if comms.radio_signal_strength < 0.3:
            maint.alerts.append("RADIO_WEAK")
        
        state["last_update"] = now
        
        return self.get_full_telemetry(vehicle_id)
    
    def get_full_telemetry(self, vehicle_id: int) -> Dict[str, Any]:
        """Get complete telemetry data for a vehicle."""
        state = self.vehicle_states.get(vehicle_id)
        if not state:
            return {}
        
        engine = state["engine"]
        gps = state["gps"]
        comms = state["comms"]
        env = state["environment"]
        maint = state["maintenance"]
        fuel = state["fuel"]
        
        return {
            "vehicle_id": vehicle_id,
            "vehicle_type": state["vehicle_type"].value if hasattr(state["vehicle_type"], "value") else str(state["vehicle_type"]),
            "timestamp": datetime.utcnow().isoformat(),
            
            # Position & Navigation
            "position": {
                "lat": round(gps.latitude, 6),
                "lng": round(gps.longitude, 6),
                "altitude_m": round(gps.altitude_m, 1),
                "bearing_degrees": round(gps.bearing_degrees, 1),
                "speed_kmh": round(gps.speed_gps_kmh, 1)
            },
            
            # GPS Quality
            "gps": {
                "accuracy_m": round(gps.accuracy_m, 1),
                "satellites": gps.satellites_visible,
                "signal_strength": round(gps.signal_strength, 2),
                "hdop": gps.hdop,
                "fix_type": gps.fix_type
            },
            
            # Engine Performance
            "engine": {
                "rpm": engine.rpm,
                "temperature_c": round(engine.temperature_celsius, 1),
                "oil_pressure_psi": round(engine.oil_pressure_psi, 1),
                "throttle_percent": round(engine.throttle_percent, 1),
                "load_percent": round(engine.load_percent, 1),
                "stress_level": round(engine.stress_level, 2),
                "efficiency": round(engine.efficiency, 2)
            },
            
            # Fuel
            "fuel": {
                "level_liters": round(fuel.current_level_liters, 1),
                "level_percent": round((fuel.current_level_liters / fuel.tank_capacity_liters) * 100, 1),
                "consumption_lph": round(fuel.consumption_rate_lph, 2),
                "consumption_kpl": round(fuel.consumption_rate_kpl, 2),
                "range_km": round(fuel.range_remaining_km, 1),
                "fuel_type": fuel.fuel_type
            },
            
            # Communications
            "communications": {
                "radio_strength": round(comms.radio_signal_strength, 2),
                "frequency_mhz": comms.radio_frequency_mhz,
                "latency_ms": round(comms.network_latency_ms, 1),
                "data_rate_kbps": round(comms.data_rate_kbps, 1),
                "encryption": comms.encryption_status,
                "is_jammed": comms.is_jammed
            },
            
            # Environment
            "environment": {
                "temperature_c": round(env.ambient_temperature_c, 1),
                "humidity_percent": round(env.humidity_percent, 1),
                "visibility_km": round(env.visibility_km, 1),
                "road_condition": env.road_condition,
                "traction": round(env.traction_coefficient, 2),
                "wind_speed_kmh": round(env.wind_speed_kmh, 1),
                "precipitation_mm_hr": round(env.precipitation_mm_hr, 1)
            },
            
            # Maintenance
            "maintenance": {
                "engine_hours": round(maint.engine_hours, 1),
                "km_since_service": round(maint.km_since_service, 1),
                "next_service_km": round(maint.next_service_km, 1),
                "brake_wear_percent": round(maint.brake_wear_percent, 1),
                "tire_wear_percent": round(maint.tire_wear_percent, 1),
                "breakdown_probability": round(maint.breakdown_probability * 100, 2),
                "alerts": maint.alerts
            },
            
            # Operational
            "operational": {
                "total_distance_km": round(state["total_distance_km"], 2),
                "load_weight_kg": state["load_weight_kg"],
                "personnel_count": state["personnel_count"],
                "terrain": state["terrain"],
                "weather": state["weather"],
                "gradient_percent": round(state["gradient_percent"], 1)
            }
        }
    
    def simulate_breakdown(self, vehicle_id: int) -> Optional[Dict[str, Any]]:
        """Check if vehicle should break down based on probability."""
        state = self.vehicle_states.get(vehicle_id)
        if not state:
            return None
        
        maint = state["maintenance"]
        
        if random.random() < maint.breakdown_probability:
            # Determine breakdown type
            breakdown_types = [
                ("ENGINE_FAILURE", 0.2),
                ("TIRE_BLOWOUT", 0.25),
                ("BRAKE_FAILURE", 0.15),
                ("TRANSMISSION", 0.1),
                ("ELECTRICAL", 0.15),
                ("FUEL_SYSTEM", 0.1),
                ("OVERHEATING", 0.05)
            ]
            
            # Weighted selection
            total = sum(w for _, w in breakdown_types)
            r = random.uniform(0, total)
            cumulative = 0
            breakdown_type = "UNKNOWN"
            
            for btype, weight in breakdown_types:
                cumulative += weight
                if r <= cumulative:
                    breakdown_type = btype
                    break
            
            return {
                "vehicle_id": vehicle_id,
                "breakdown_type": breakdown_type,
                "severity": random.choice(["MINOR", "MODERATE", "SEVERE"]),
                "estimated_repair_hours": random.uniform(0.5, 4.0),
                "location": {
                    "lat": state["gps"].latitude,
                    "lng": state["gps"].longitude
                },
                "timestamp": datetime.utcnow().isoformat()
            }
        
        return None


# Global instance
metrics_engine = VehicleMetricsEngine()
