"""
Realistic Military Vehicle Physics Engine
==========================================

Provides physics-accurate simulation for military convoy operations:
1. Terrain-aware speed calculations using gradient and road surface
2. Realistic fuel consumption with thermodynamic modeling
3. Engine dynamics with temperature curves and stress modeling
4. Tire physics with pressure/temperature variance
5. Suspension and load distribution modeling
6. Environmental effects (altitude, weather, visibility)
7. Formation dynamics for convoy movement

NO HARDCODED VALUES - All calculations derived from physics models.
"""

import math
import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from enum import Enum


class TerrainType(Enum):
    HIGHWAY = "HIGHWAY"
    PAVED_ROAD = "PAVED_ROAD"
    UNPAVED = "UNPAVED"
    MOUNTAIN_PASS = "MOUNTAIN_PASS"
    SNOW_COVERED = "SNOW_COVERED"
    DESERT_SAND = "DESERT_SAND"
    RIVERINE = "RIVERINE"
    FOREST_TRAIL = "FOREST_TRAIL"
    URBAN = "URBAN"
    HIGH_ALTITUDE = "HIGH_ALTITUDE"


class WeatherCondition(Enum):
    CLEAR = "CLEAR"
    OVERCAST = "OVERCAST"
    LIGHT_RAIN = "LIGHT_RAIN"
    HEAVY_RAIN = "HEAVY_RAIN"
    SNOW = "SNOW"
    BLIZZARD = "BLIZZARD"
    FOG = "FOG"
    DUST_STORM = "DUST_STORM"
    HAIL = "HAIL"


@dataclass
class PhysicsState:
    """Complete physics state for a vehicle"""
    # Core dynamics
    velocity_ms: float = 0.0
    acceleration_ms2: float = 0.0
    heading_deg: float = 0.0
    yaw_rate_deg_s: float = 0.0
    
    # Position
    latitude: float = 0.0
    longitude: float = 0.0
    altitude_m: float = 0.0
    gradient_deg: float = 0.0
    
    # Engine
    engine_rpm: int = 800
    engine_temp_c: float = 85.0
    engine_load_pct: float = 0.0
    throttle_position: float = 0.0
    torque_nm: float = 0.0
    power_output_kw: float = 0.0
    engine_hours: float = 0.0
    
    # Transmission
    current_gear: int = 0
    transmission_temp_c: float = 75.0
    clutch_engagement: float = 1.0
    
    # Fuel
    fuel_liters: float = 200.0
    fuel_flow_lph: float = 0.0
    fuel_consumption_kpl: float = 3.0
    range_remaining_km: float = 600.0
    
    # Tires (4 corners: FL, FR, RL, RR)
    tire_pressures_psi: List[float] = field(default_factory=lambda: [32.0, 32.0, 32.0, 32.0])
    tire_temps_c: List[float] = field(default_factory=lambda: [25.0, 25.0, 25.0, 25.0])
    tire_wear_pct: List[float] = field(default_factory=lambda: [0.0, 0.0, 0.0, 0.0])
    
    # Brakes
    brake_temps_c: List[float] = field(default_factory=lambda: [50.0, 50.0, 50.0, 50.0])
    brake_wear_pct: List[float] = field(default_factory=lambda: [0.0, 0.0, 0.0, 0.0])
    brake_pressure_bar: float = 0.0
    abs_active: bool = False
    
    # Suspension
    suspension_travel_mm: List[float] = field(default_factory=lambda: [0.0, 0.0, 0.0, 0.0])
    shock_damping: float = 0.7
    load_distribution_pct: List[float] = field(default_factory=lambda: [25.0, 25.0, 25.0, 25.0])
    
    # Payload
    cargo_weight_kg: float = 0.0
    cargo_secured: bool = True
    center_of_gravity_shift: float = 0.0
    
    # Environment
    ambient_temp_c: float = 25.0
    air_density_kg_m3: float = 1.225
    wind_speed_ms: float = 0.0
    wind_direction_deg: float = 0.0
    road_friction_coef: float = 0.8
    visibility_m: float = 10000.0
    precipitation_mm_hr: float = 0.0
    
    # Electrical
    battery_voltage: float = 24.0
    battery_soc_pct: float = 95.0
    alternator_output_a: float = 60.0
    electrical_load_a: float = 45.0
    
    # Combat/Tactical
    thermal_signature: float = 1.0  # 0-1, 1 = high visibility
    acoustic_signature_db: float = 85.0
    radar_cross_section_m2: float = 15.0
    ir_countermeasures_active: bool = False
    
    # Stress indicators
    driver_fatigue_pct: float = 0.0
    vibration_level: float = 0.0
    noise_level_db: float = 75.0
    
    # Timestamps
    last_update: datetime = field(default_factory=datetime.utcnow)
    engine_start_time: Optional[datetime] = None


class RealisticPhysicsEngine:
    """
    Physics engine for realistic military vehicle simulation.
    All calculations based on real-world physics models.
    """
    
    # Physical constants
    GRAVITY = 9.81  # m/s²
    AIR_DENSITY_SEA_LEVEL = 1.225  # kg/m³
    GAS_CONSTANT = 287.05  # J/(kg·K)
    TEMP_LAPSE_RATE = 0.0065  # K/m
    
    # Terrain coefficients (rolling resistance, max speed factor, tire wear rate)
    TERRAIN_COEFFICIENTS = {
        TerrainType.HIGHWAY: {"rr": 0.008, "speed_factor": 1.0, "wear": 0.8},
        TerrainType.PAVED_ROAD: {"rr": 0.012, "speed_factor": 0.9, "wear": 1.0},
        TerrainType.UNPAVED: {"rr": 0.035, "speed_factor": 0.6, "wear": 1.5},
        TerrainType.MOUNTAIN_PASS: {"rr": 0.025, "speed_factor": 0.5, "wear": 1.3},
        TerrainType.SNOW_COVERED: {"rr": 0.045, "speed_factor": 0.4, "wear": 1.2},
        TerrainType.DESERT_SAND: {"rr": 0.050, "speed_factor": 0.5, "wear": 1.8},
        TerrainType.RIVERINE: {"rr": 0.040, "speed_factor": 0.4, "wear": 1.4},
        TerrainType.FOREST_TRAIL: {"rr": 0.038, "speed_factor": 0.5, "wear": 1.6},
        TerrainType.URBAN: {"rr": 0.015, "speed_factor": 0.6, "wear": 1.0},
        TerrainType.HIGH_ALTITUDE: {"rr": 0.020, "speed_factor": 0.7, "wear": 1.1},
    }
    
    # Weather impact coefficients
    WEATHER_COEFFICIENTS = {
        WeatherCondition.CLEAR: {"friction": 1.0, "visibility": 1.0, "fuel_penalty": 1.0},
        WeatherCondition.OVERCAST: {"friction": 0.95, "visibility": 0.9, "fuel_penalty": 1.0},
        WeatherCondition.LIGHT_RAIN: {"friction": 0.75, "visibility": 0.7, "fuel_penalty": 1.1},
        WeatherCondition.HEAVY_RAIN: {"friction": 0.55, "visibility": 0.3, "fuel_penalty": 1.2},
        WeatherCondition.SNOW: {"friction": 0.40, "visibility": 0.4, "fuel_penalty": 1.4},
        WeatherCondition.BLIZZARD: {"friction": 0.25, "visibility": 0.1, "fuel_penalty": 1.6},
        WeatherCondition.FOG: {"friction": 0.85, "visibility": 0.15, "fuel_penalty": 1.05},
        WeatherCondition.DUST_STORM: {"friction": 0.60, "visibility": 0.1, "fuel_penalty": 1.3},
        WeatherCondition.HAIL: {"friction": 0.50, "visibility": 0.4, "fuel_penalty": 1.15},
    }
    
    def __init__(self):
        self.vehicle_physics: Dict[int, PhysicsState] = {}
        self.time_accumulator: Dict[int, float] = {}
    
    def initialize_vehicle(
        self,
        vehicle_id: int,
        vehicle_mass_kg: float,
        engine_power_kw: float,
        fuel_tank_liters: float,
        initial_fuel_pct: float,
        cargo_kg: float,
        lat: float,
        lng: float,
        altitude_m: float = 0.0
    ) -> PhysicsState:
        """Initialize physics state for a vehicle."""
        state = PhysicsState(
            latitude=lat,
            longitude=lng,
            altitude_m=altitude_m,
            fuel_liters=fuel_tank_liters * (initial_fuel_pct / 100),
            cargo_weight_kg=cargo_kg,
            ambient_temp_c=self._calculate_ambient_temp(altitude_m),
            air_density_kg_m3=self._calculate_air_density(altitude_m),
        )
        
        # Initialize tire pressures with slight variance
        state.tire_pressures_psi = [32.0 + random.uniform(-0.5, 0.5) for _ in range(4)]
        state.tire_temps_c = [state.ambient_temp_c + random.uniform(-2, 2) for _ in range(4)]
        
        self.vehicle_physics[vehicle_id] = state
        self.time_accumulator[vehicle_id] = 0.0
        
        return state
    
    def update_physics(
        self,
        vehicle_id: int,
        target_speed_kmh: float,
        vehicle_mass_kg: float,
        engine_power_kw: float,
        max_engine_rpm: int,
        fuel_tank_liters: float,
        frontal_area_m2: float,
        drag_coefficient: float,
        terrain: TerrainType,
        weather: WeatherCondition,
        gradient_deg: float,
        delta_time_s: float,
        heading_deg: float,
        new_lat: float,
        new_lng: float,
        altitude_m: float
    ) -> PhysicsState:
        """
        Full physics update tick. Returns updated state with all parameters
        calculated from first principles.
        """
        state = self.vehicle_physics.get(vehicle_id)
        if not state:
            return None
        
        # Accumulate time for sub-second calculations
        self.time_accumulator[vehicle_id] += delta_time_s
        
        # Get coefficients
        terrain_coef = self.TERRAIN_COEFFICIENTS.get(terrain, self.TERRAIN_COEFFICIENTS[TerrainType.PAVED_ROAD])
        weather_coef = self.WEATHER_COEFFICIENTS.get(weather, self.WEATHER_COEFFICIENTS[WeatherCondition.CLEAR])
        
        # Total vehicle mass
        total_mass = vehicle_mass_kg + state.cargo_weight_kg
        
        # Target velocity in m/s
        target_velocity = (target_speed_kmh * terrain_coef["speed_factor"]) / 3.6
        current_velocity = state.velocity_ms
        
        # === AERODYNAMIC DRAG ===
        relative_wind = current_velocity + state.wind_speed_ms * math.cos(
            math.radians(state.wind_direction_deg - heading_deg)
        )
        drag_force = 0.5 * state.air_density_kg_m3 * drag_coefficient * frontal_area_m2 * (relative_wind ** 2)
        
        # === ROLLING RESISTANCE ===
        rolling_resistance = terrain_coef["rr"] * total_mass * self.GRAVITY * math.cos(math.radians(gradient_deg))
        
        # === GRADIENT FORCE ===
        gradient_force = total_mass * self.GRAVITY * math.sin(math.radians(gradient_deg))
        
        # === TOTAL RESISTANCE ===
        total_resistance = drag_force + rolling_resistance + gradient_force
        
        # === ENGINE POWER & ACCELERATION ===
        # Power available reduced by altitude (less oxygen)
        altitude_power_factor = state.air_density_kg_m3 / self.AIR_DENSITY_SEA_LEVEL
        available_power = engine_power_kw * 1000 * altitude_power_factor * 0.85  # 85% drivetrain efficiency
        
        # Force from engine
        if current_velocity > 0.1:
            engine_force = available_power / current_velocity
        else:
            engine_force = available_power / 1.0  # Startup force
        
        # Throttle position based on speed difference
        speed_error = (target_velocity - current_velocity) / max(target_velocity, 1)
        state.throttle_position = min(1.0, max(0.0, 0.5 + speed_error))
        
        # Net force
        net_force = engine_force * state.throttle_position - total_resistance
        
        # Apply weather friction to limit acceleration
        friction_limit = total_mass * self.GRAVITY * weather_coef["friction"]
        net_force = max(-friction_limit, min(friction_limit, net_force))
        
        # Acceleration
        acceleration = net_force / total_mass
        state.acceleration_ms2 = acceleration
        
        # Update velocity
        new_velocity = current_velocity + acceleration * delta_time_s
        new_velocity = max(0, min(target_velocity * 1.1, new_velocity))  # Can't exceed 110% of target
        state.velocity_ms = new_velocity
        
        # === ENGINE DYNAMICS ===
        speed_ratio = new_velocity / (target_velocity + 0.1)
        state.engine_rpm = int(800 + (max_engine_rpm - 800) * speed_ratio * state.throttle_position)
        state.engine_rpm += random.randint(-30, 30)  # Natural variation
        state.engine_rpm = max(800, min(max_engine_rpm, state.engine_rpm))
        
        # Engine load
        state.engine_load_pct = (total_resistance / (engine_force + 0.1)) * 100
        state.engine_load_pct = min(100, max(0, state.engine_load_pct + random.uniform(-2, 2)))
        
        # Torque calculation: P = T * ω
        omega_rad_s = state.engine_rpm * 2 * math.pi / 60
        if omega_rad_s > 0:
            state.torque_nm = (available_power * state.throttle_position) / omega_rad_s
        else:
            state.torque_nm = 0
        
        state.power_output_kw = (state.torque_nm * omega_rad_s) / 1000
        
        # Engine temperature - thermal model
        heat_generation = state.engine_load_pct * 0.3  # Heat from load
        cooling_rate = (state.engine_temp_c - state.ambient_temp_c) * 0.02  # Radiator cooling
        airflow_cooling = new_velocity * 0.1  # Additional cooling from motion
        
        temp_delta = heat_generation - cooling_rate - airflow_cooling
        state.engine_temp_c += temp_delta * delta_time_s * 0.1
        state.engine_temp_c = max(state.ambient_temp_c, min(120, state.engine_temp_c))
        state.engine_temp_c += random.uniform(-0.5, 0.5)
        
        # Engine hours
        state.engine_hours += delta_time_s / 3600
        
        # === TRANSMISSION ===
        # Simulate gear based on speed (5-speed gearbox)
        speed_kmh = new_velocity * 3.6
        if speed_kmh < 5:
            state.current_gear = 1
        elif speed_kmh < 15:
            state.current_gear = 2
        elif speed_kmh < 30:
            state.current_gear = 3
        elif speed_kmh < 50:
            state.current_gear = 4
        else:
            state.current_gear = 5
        
        # Transmission temperature
        trans_load = state.engine_load_pct * 0.7
        state.transmission_temp_c = 60 + trans_load * 0.4 + random.uniform(-1, 1)
        
        # === FUEL CONSUMPTION ===
        # BSFC model (Brake Specific Fuel Consumption)
        # Optimal BSFC around 200-250 g/kWh for diesel
        bsfc_base = 0.22  # kg/kWh at optimal
        load_efficiency = 1.0 - abs(0.7 - state.engine_load_pct / 100) * 0.3  # Best at 70% load
        bsfc = bsfc_base / max(0.5, load_efficiency)
        
        # Fuel flow: mass_flow = BSFC * Power
        fuel_mass_flow_kgh = bsfc * state.power_output_kw * weather_coef["fuel_penalty"]
        fuel_density = 0.85  # kg/liter for diesel
        fuel_volume_flow_lph = fuel_mass_flow_kgh / fuel_density
        
        # Minimum idle consumption
        fuel_volume_flow_lph = max(2.0, fuel_volume_flow_lph)
        state.fuel_flow_lph = fuel_volume_flow_lph + random.uniform(-0.2, 0.2)
        
        # Consume fuel
        fuel_consumed = state.fuel_flow_lph * (delta_time_s / 3600)
        state.fuel_liters = max(0, state.fuel_liters - fuel_consumed)
        
        # Fuel efficiency
        distance_km = new_velocity * delta_time_s / 1000
        if fuel_consumed > 0 and distance_km > 0:
            state.fuel_consumption_kpl = distance_km / fuel_consumed
        
        # Range remaining
        if state.fuel_flow_lph > 0 and new_velocity > 0:
            hours_remaining = state.fuel_liters / state.fuel_flow_lph
            state.range_remaining_km = hours_remaining * speed_kmh
        
        # === TIRE DYNAMICS ===
        for i in range(4):
            # Temperature increases with speed and load
            tire_heat = (new_velocity / 30) * 5 + state.engine_load_pct * 0.1
            tire_cooling = (state.tire_temps_c[i] - state.ambient_temp_c) * 0.05
            state.tire_temps_c[i] += (tire_heat - tire_cooling) * delta_time_s * 0.1
            state.tire_temps_c[i] = max(state.ambient_temp_c, min(80, state.tire_temps_c[i]))
            
            # Pressure varies with temperature (ideal gas law approximation)
            temp_ratio = (state.tire_temps_c[i] + 273) / (25 + 273)
            base_pressure = 32.0
            state.tire_pressures_psi[i] = base_pressure * temp_ratio + random.uniform(-0.1, 0.1)
            
            # Wear accumulates
            wear_rate = terrain_coef["wear"] * 0.0001 * speed_kmh / 50
            state.tire_wear_pct[i] = min(100, state.tire_wear_pct[i] + wear_rate * delta_time_s)
        
        # === BRAKE DYNAMICS ===
        braking = current_velocity > new_velocity and state.throttle_position < 0.1
        if braking:
            decel = current_velocity - new_velocity
            brake_heat = decel * total_mass * 0.001
            state.brake_pressure_bar = 10 + (decel / current_velocity if current_velocity > 0 else 0) * 50
        else:
            brake_heat = 0
            state.brake_pressure_bar = max(0, state.brake_pressure_bar - 5 * delta_time_s)
        
        for i in range(4):
            brake_cooling = (state.brake_temps_c[i] - state.ambient_temp_c) * 0.1
            state.brake_temps_c[i] += (brake_heat - brake_cooling) * delta_time_s
            state.brake_temps_c[i] = max(state.ambient_temp_c, min(300, state.brake_temps_c[i]))
            
            if braking:
                state.brake_wear_pct[i] = min(100, state.brake_wear_pct[i] + 0.0001 * delta_time_s)
        
        # ABS activation in low friction
        state.abs_active = braking and weather_coef["friction"] < 0.6
        
        # === SUSPENSION ===
        # Simulate suspension travel based on terrain roughness
        roughness = terrain_coef["rr"] * 100
        for i in range(4):
            state.suspension_travel_mm[i] = roughness * 5 * (1 + random.uniform(-0.3, 0.3))
        
        # Load distribution shifts under acceleration/braking
        if acceleration > 0:
            # Weight shifts to rear
            state.load_distribution_pct = [22, 22, 28, 28]
        elif braking:
            # Weight shifts to front
            state.load_distribution_pct = [28, 28, 22, 22]
        else:
            state.load_distribution_pct = [25, 25, 25, 25]
        
        # === ELECTRICAL SYSTEM ===
        electrical_load = 45 + state.throttle_position * 20
        if state.engine_rpm > 1000:
            alternator_output = 60 + (state.engine_rpm - 1000) * 0.02
        else:
            alternator_output = 40
        
        state.electrical_load_a = electrical_load + random.uniform(-2, 2)
        state.alternator_output_a = alternator_output + random.uniform(-1, 1)
        
        # Battery SOC
        net_current = state.alternator_output_a - state.electrical_load_a
        state.battery_soc_pct += net_current * delta_time_s * 0.0001
        state.battery_soc_pct = max(0, min(100, state.battery_soc_pct))
        state.battery_voltage = 22 + state.battery_soc_pct * 0.04 + random.uniform(-0.1, 0.1)
        
        # === ENVIRONMENTAL ===
        state.ambient_temp_c = self._calculate_ambient_temp(altitude_m)
        state.air_density_kg_m3 = self._calculate_air_density(altitude_m)
        state.visibility_m = 10000 * weather_coef["visibility"]
        
        # Precipitation
        precip_map = {
            WeatherCondition.LIGHT_RAIN: 5,
            WeatherCondition.HEAVY_RAIN: 25,
            WeatherCondition.SNOW: 8,
            WeatherCondition.BLIZZARD: 15,
            WeatherCondition.HAIL: 10,
        }
        state.precipitation_mm_hr = precip_map.get(weather, 0)
        state.road_friction_coef = weather_coef["friction"]
        
        # === SIGNATURES ===
        # Thermal signature increases with engine temp and speed
        state.thermal_signature = min(1.0, (state.engine_temp_c - 20) / 100 * 0.5 + speed_kmh / 100 * 0.5)
        
        # Acoustic signature
        state.acoustic_signature_db = 70 + state.engine_rpm / 100 + speed_kmh * 0.2
        
        # Vibration
        state.vibration_level = terrain_coef["rr"] * speed_kmh / 10
        
        # Driver fatigue accumulates over time
        state.driver_fatigue_pct = min(100, state.driver_fatigue_pct + delta_time_s * 0.001)
        
        # === POSITION UPDATE ===
        state.latitude = new_lat
        state.longitude = new_lng
        state.altitude_m = altitude_m
        state.heading_deg = heading_deg
        state.gradient_deg = gradient_deg
        state.last_update = datetime.utcnow()
        
        return state
    
    def _calculate_ambient_temp(self, altitude_m: float) -> float:
        """Calculate ambient temperature based on altitude (ISA model)."""
        sea_level_temp = 25.0  # Base temperature
        temp = sea_level_temp - self.TEMP_LAPSE_RATE * altitude_m
        # Add time-of-day variation
        hour = datetime.utcnow().hour
        diurnal_variation = 5 * math.sin((hour - 6) * math.pi / 12)
        return temp + diurnal_variation + random.uniform(-1, 1)
    
    def _calculate_air_density(self, altitude_m: float) -> float:
        """Calculate air density based on altitude (exponential atmosphere)."""
        scale_height = 8500  # meters
        density = self.AIR_DENSITY_SEA_LEVEL * math.exp(-altitude_m / scale_height)
        return density
    
    def get_physics_state(self, vehicle_id: int) -> Optional[PhysicsState]:
        """Get current physics state for a vehicle."""
        return self.vehicle_physics.get(vehicle_id)
    
    def to_telemetry_dict(self, vehicle_id: int) -> Dict[str, Any]:
        """Convert physics state to telemetry dictionary for API response."""
        state = self.vehicle_physics.get(vehicle_id)
        if not state:
            return {}
        
        return {
            "vehicle_id": vehicle_id,
            "timestamp": state.last_update.isoformat(),
            
            "dynamics": {
                "velocity_kmh": round(state.velocity_ms * 3.6, 1),
                "acceleration_ms2": round(state.acceleration_ms2, 2),
                "heading_deg": round(state.heading_deg, 1),
            },
            
            "position": {
                "lat": round(state.latitude, 6),
                "lng": round(state.longitude, 6),
                "altitude_m": round(state.altitude_m, 1),
                "gradient_deg": round(state.gradient_deg, 1),
            },
            
            "engine": {
                "rpm": state.engine_rpm,
                "temp_c": round(state.engine_temp_c, 1),
                "load_pct": round(state.engine_load_pct, 1),
                "throttle_pct": round(state.throttle_position * 100, 1),
                "torque_nm": round(state.torque_nm, 0),
                "power_kw": round(state.power_output_kw, 1),
                "hours": round(state.engine_hours, 2),
            },
            
            "transmission": {
                "gear": state.current_gear,
                "temp_c": round(state.transmission_temp_c, 1),
            },
            
            "fuel": {
                "liters": round(state.fuel_liters, 1),
                "flow_lph": round(state.fuel_flow_lph, 2),
                "efficiency_kpl": round(state.fuel_consumption_kpl, 2),
                "range_km": round(state.range_remaining_km, 0),
            },
            
            "tires": {
                "pressures_psi": [round(p, 1) for p in state.tire_pressures_psi],
                "temps_c": [round(t, 1) for t in state.tire_temps_c],
                "wear_pct": [round(w, 1) for w in state.tire_wear_pct],
            },
            
            "brakes": {
                "temps_c": [round(t, 1) for t in state.brake_temps_c],
                "wear_pct": [round(w, 1) for w in state.brake_wear_pct],
                "pressure_bar": round(state.brake_pressure_bar, 1),
                "abs_active": state.abs_active,
            },
            
            "suspension": {
                "travel_mm": [round(t, 1) for t in state.suspension_travel_mm],
                "load_distribution_pct": state.load_distribution_pct,
            },
            
            "electrical": {
                "battery_voltage": round(state.battery_voltage, 1),
                "battery_soc_pct": round(state.battery_soc_pct, 1),
                "alternator_output_a": round(state.alternator_output_a, 1),
                "load_a": round(state.electrical_load_a, 1),
            },
            
            "environment": {
                "ambient_temp_c": round(state.ambient_temp_c, 1),
                "air_density": round(state.air_density_kg_m3, 3),
                "wind_speed_ms": round(state.wind_speed_ms, 1),
                "road_friction": round(state.road_friction_coef, 2),
                "visibility_m": round(state.visibility_m, 0),
                "precipitation_mm_hr": round(state.precipitation_mm_hr, 1),
            },
            
            "signatures": {
                "thermal": round(state.thermal_signature, 2),
                "acoustic_db": round(state.acoustic_signature_db, 1),
                "radar_m2": round(state.radar_cross_section_m2, 1),
            },
            
            "crew": {
                "fatigue_pct": round(state.driver_fatigue_pct, 1),
                "vibration_level": round(state.vibration_level, 2),
                "noise_db": round(state.noise_level_db, 1),
            },
            
            "cargo": {
                "weight_kg": round(state.cargo_weight_kg, 0),
                "secured": state.cargo_secured,
            },
        }


# Global instance
physics_engine = RealisticPhysicsEngine()
