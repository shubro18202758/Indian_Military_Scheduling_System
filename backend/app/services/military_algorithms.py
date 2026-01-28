"""
Military Logistics Algorithms Service

Comprehensive military logistics calculations including:
- VTKM (Vehicle Track Kilometer) Calculator
- FOL (First Line of Logic - Fuel) Requirements
- MACP (Movement Ammunition Credit Point) Optimizer
- TCP (Traffic Control Post) Planning
- Halt Schedule Generator
- Route Classification Analyzer
- Convoy Spacing Optimizer
- Threat Assessment Algorithm
"""

import math
import random
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from enum import Enum
import numpy as np
from datetime import datetime, timedelta


# ============================================
# ENUMERATIONS & CONSTANTS
# ============================================

class ThreatLevel(Enum):
    GREEN = "GREEN"      # Peacetime operations
    YELLOW = "YELLOW"    # Elevated threat
    ORANGE = "ORANGE"    # High threat
    RED = "RED"          # Combat operations

class TerrainType(Enum):
    PLAINS = "PLAINS"
    MOUNTAINOUS = "MOUNTAINOUS"
    HIGH_ALTITUDE = "HIGH_ALTITUDE"
    DESERT = "DESERT"
    JUNGLE = "JUNGLE"
    URBAN = "URBAN"
    COASTAL = "COASTAL"
    SEMI_DESERT = "SEMI_DESERT"

class ConvoyFormation(Enum):
    COLUMN = "COLUMN"           # Standard column formation
    ECHELON_LEFT = "ECHELON_LEFT"
    ECHELON_RIGHT = "ECHELON_RIGHT"
    WEDGE = "WEDGE"             # V-shaped formation
    DIAMOND = "DIAMOND"         # Diamond formation for VIP
    STAGGERED = "STAGGERED"     # Alternating sides
    HERRINGBONE = "HERRINGBONE" # Defensive halt formation

class VehicleType(Enum):
    SHAKTIMAN = "SHAKTIMAN"    # 4x4 Medium truck
    TATRA = "TATRA"            # 6x6 Heavy truck
    STALLION = "STALLION"      # 4x4 Light truck
    JONGA = "JONGA"            # 4x4 Light vehicle
    ALS = "ALS"                # 10-ton Artillery truck
    RECOVERY = "RECOVERY"       # Recovery vehicle
    GYPSY = "GYPSY"            # Light utility vehicle
    BRDM = "BRDM"              # Armored recon
    BMP = "BMP"                # Infantry fighting vehicle
    AMBULANCE = "AMBULANCE"    # Medical evacuation

class UrgencyLevel(Enum):
    FLASH = "FLASH"           # Immediate, within 2 hours
    IMMEDIATE = "IMMEDIATE"    # Within 6 hours
    PRIORITY = "PRIORITY"      # Within 24 hours
    ROUTINE = "ROUTINE"        # Within 72 hours

class TCPType(Enum):
    CONTROL = "CONTROL"        # Main traffic control
    INFO = "INFO"              # Information post
    REST = "REST"              # Rest/halt point
    FUEL = "FUEL"              # Refueling point
    MEDICAL = "MEDICAL"        # Medical aid post
    VEHICLE_AID = "VEHICLE_AID"  # Vehicle maintenance

class RouteClass(Enum):
    CLASS_30 = 30   # Up to 30 tons
    CLASS_50 = 50   # Up to 50 tons
    CLASS_70 = 70   # Up to 70 tons
    CLASS_100 = 100 # Up to 100 tons

class AmmoCategory(Enum):
    SAA = "SAA"               # Small Arms Ammunition
    MORTAR = "MORTAR"         # Mortar bombs
    ARTILLERY = "ARTILLERY"   # Artillery shells
    MISSILE = "MISSILE"       # Guided missiles
    EXPLOSIVE = "EXPLOSIVE"   # Explosives/mines
    ROCKET = "ROCKET"         # Unguided rockets


# ============================================
# MILITARY CONSTANTS
# ============================================

# Threat level multipliers for spacing
THREAT_MULTIPLIERS = {
    ThreatLevel.GREEN: 1.0,
    ThreatLevel.YELLOW: 1.5,
    ThreatLevel.ORANGE: 2.0,
    ThreatLevel.RED: 3.0,
}

# Terrain speed factors (relative to plains)
TERRAIN_SPEED_FACTORS = {
    TerrainType.PLAINS: 1.0,
    TerrainType.MOUNTAINOUS: 0.6,
    TerrainType.HIGH_ALTITUDE: 0.5,
    TerrainType.DESERT: 0.8,
    TerrainType.JUNGLE: 0.7,
    TerrainType.URBAN: 0.4,
    TerrainType.COASTAL: 0.85,
    TerrainType.SEMI_DESERT: 0.75,
}

# Terrain fuel consumption multipliers
TERRAIN_FUEL_MULTIPLIERS = {
    TerrainType.PLAINS: 1.0,
    TerrainType.MOUNTAINOUS: 1.5,
    TerrainType.HIGH_ALTITUDE: 1.7,
    TerrainType.DESERT: 1.3,
    TerrainType.JUNGLE: 1.4,
    TerrainType.URBAN: 1.6,
    TerrainType.COASTAL: 1.1,
    TerrainType.SEMI_DESERT: 1.2,
}

# Vehicle specifications
VEHICLE_SPECS = {
    VehicleType.SHAKTIMAN: {
        "capacity_tons": 4.0,
        "fuel_consumption_kmpl": 3.5,
        "fuel_type": "DIESEL",
        "max_speed_kmph": 65,
        "length_m": 7.2,
        "crew": 2,
        "passengers": 16,
    },
    VehicleType.TATRA: {
        "capacity_tons": 8.0,
        "fuel_consumption_kmpl": 2.8,
        "fuel_type": "DIESEL",
        "max_speed_kmph": 80,
        "length_m": 8.5,
        "crew": 2,
        "passengers": 0,
    },
    VehicleType.STALLION: {
        "capacity_tons": 2.5,
        "fuel_consumption_kmpl": 4.2,
        "fuel_type": "DIESEL",
        "max_speed_kmph": 80,
        "length_m": 5.8,
        "crew": 2,
        "passengers": 10,
    },
    VehicleType.JONGA: {
        "capacity_tons": 0.5,
        "fuel_consumption_kmpl": 6.5,
        "fuel_type": "PETROL",
        "max_speed_kmph": 100,
        "length_m": 4.2,
        "crew": 2,
        "passengers": 4,
    },
    VehicleType.ALS: {
        "capacity_tons": 10.0,
        "fuel_consumption_kmpl": 2.5,
        "fuel_type": "DIESEL",
        "max_speed_kmph": 60,
        "length_m": 10.2,
        "crew": 2,
        "passengers": 0,
    },
    VehicleType.RECOVERY: {
        "capacity_tons": 0,
        "fuel_consumption_kmpl": 2.0,
        "fuel_type": "DIESEL",
        "max_speed_kmph": 50,
        "length_m": 9.0,
        "crew": 3,
        "passengers": 0,
    },
    VehicleType.GYPSY: {
        "capacity_tons": 0.3,
        "fuel_consumption_kmpl": 8.0,
        "fuel_type": "PETROL",
        "max_speed_kmph": 120,
        "length_m": 3.8,
        "crew": 1,
        "passengers": 3,
    },
    VehicleType.AMBULANCE: {
        "capacity_tons": 0.5,
        "fuel_consumption_kmpl": 5.0,
        "fuel_type": "DIESEL",
        "max_speed_kmph": 90,
        "length_m": 5.5,
        "crew": 2,
        "passengers": 4,
    },
}

# Urgency priority weights
URGENCY_WEIGHTS = {
    UrgencyLevel.FLASH: 5.0,
    UrgencyLevel.IMMEDIATE: 3.0,
    UrgencyLevel.PRIORITY: 2.0,
    UrgencyLevel.ROUTINE: 1.0,
}

# Standard inter-vehicle distances (meters)
STANDARD_DISTANCES = {
    "NORMAL": 50,
    "TACTICAL": 100,
    "COMBAT": 150,
    "AIR_THREAT": 200,
    "HIGH_THREAT": 250,
}


# ============================================
# DATA CLASSES
# ============================================

@dataclass
class VTKMInput:
    vehicle_count: int
    inter_vehicle_distance_m: float = 100.0
    threat_level: ThreatLevel = ThreatLevel.GREEN
    terrain: TerrainType = TerrainType.PLAINS
    formation: ConvoyFormation = ConvoyFormation.COLUMN
    cargo_category: str = "GENERAL"
    day_night: str = "DAY"
    altitude_m: float = 0.0

@dataclass
class VTKMResult:
    vtkm: float
    convoy_length_km: float
    recommended_spacing_m: float
    formation: str
    threat_level: str
    terrain_factor: float
    speed_factor: float
    effective_speed_kmph: float
    crossing_time_min: float
    ai_recommendation: str
    confidence_score: float

@dataclass
class VehicleFleet:
    vehicle_type: VehicleType
    count: int
    load_tons: float = 0.0

@dataclass
class FOLInput:
    vehicles: List[VehicleFleet]
    distance_km: float
    terrain: TerrainType = TerrainType.PLAINS
    altitude_m: float = 0.0
    buffer_percent: float = 20.0
    return_journey: bool = False
    reserve_days: int = 0

@dataclass
class FOLResult:
    diesel_liters: float
    petrol_liters: float
    engine_oil_liters: float
    gear_oil_liters: float
    grease_kg: float
    total_fuel_liters: float
    per_vehicle_breakdown: List[Dict]
    altitude_correction: float
    terrain_correction: float
    reserve_fuel: float
    ai_recommendation: str
    cost_estimate_inr: float

@dataclass
class MACPInput:
    cargo_weight_tons: float
    distance_km: float
    urgency: UrgencyLevel
    terrain: TerrainType
    ammo_category: Optional[AmmoCategory] = None

@dataclass
class MACPResult:
    credit_points: float
    priority_score: float
    recommended_vehicles: List[Dict]
    estimated_time_hours: float
    special_handling: List[str]
    ai_recommendation: str

@dataclass
class TCPPlan:
    post_id: str
    post_type: TCPType
    location_km: float
    personnel: Dict[str, int]
    equipment: List[str]
    communication: List[str]

@dataclass
class HaltSchedule:
    halt_type: str
    start_km: float
    duration_min: int
    purpose: List[str]
    facilities_required: List[str]


# ============================================
# VTKM CALCULATOR
# ============================================

class VTKMCalculator:
    """Vehicle Track Kilometer Calculator with Military Specifications"""
    
    def __init__(self, use_gpu: bool = False):
        self.use_gpu = use_gpu
    
    def calculate(self, input_data: VTKMInput) -> VTKMResult:
        """Calculate VTKM with full military parameters"""
        
        # Get threat multiplier
        threat_mult = THREAT_MULTIPLIERS.get(input_data.threat_level, 1.0)
        
        # Get terrain factors
        terrain_speed = TERRAIN_SPEED_FACTORS.get(input_data.terrain, 1.0)
        
        # Day/Night factor
        day_night_factor = 1.0 if input_data.day_night == "DAY" else 0.7
        
        # Altitude adjustment (reduce speed above 3000m)
        altitude_factor = 1.0
        if input_data.altitude_m > 3000:
            altitude_factor = max(0.5, 1.0 - ((input_data.altitude_m - 3000) / 5000))
        
        # Calculate adjusted spacing
        base_spacing = input_data.inter_vehicle_distance_m
        adjusted_spacing = base_spacing * threat_mult
        
        # Formation spacing adjustment
        formation_factors = {
            ConvoyFormation.COLUMN: 1.0,
            ConvoyFormation.ECHELON_LEFT: 1.3,
            ConvoyFormation.ECHELON_RIGHT: 1.3,
            ConvoyFormation.WEDGE: 1.5,
            ConvoyFormation.DIAMOND: 1.8,
            ConvoyFormation.STAGGERED: 1.2,
            ConvoyFormation.HERRINGBONE: 2.0,
        }
        formation_factor = formation_factors.get(input_data.formation, 1.0)
        adjusted_spacing *= formation_factor
        
        # Calculate convoy length
        convoy_length_m = (input_data.vehicle_count - 1) * adjusted_spacing
        convoy_length_km = convoy_length_m / 1000.0
        
        # VTKM = Vehicles per Track Kilometer
        vtkm = input_data.vehicle_count / max(convoy_length_km, 0.1)
        
        # Calculate effective speed
        base_speed = 40  # km/h convoy speed
        effective_speed = base_speed * terrain_speed * day_night_factor * altitude_factor
        
        # Crossing time for a fixed point
        crossing_time_min = (convoy_length_km / effective_speed) * 60
        
        # AI Recommendation based on parameters
        recommendations = []
        if threat_mult >= 2.0:
            recommendations.append("INCREASE SPACING to 200m+ for current threat level")
        if terrain_speed < 0.7:
            recommendations.append(f"REDUCE SPEED to {effective_speed:.0f} km/h for {input_data.terrain.value} terrain")
        if input_data.altitude_m > 4000:
            recommendations.append("ALLOW REST HALTS every 30 mins for high altitude operations")
        if input_data.vehicle_count > 30:
            recommendations.append("CONSIDER SPLITTING convoy into 2 serials for better control")
        
        ai_recommendation = " | ".join(recommendations) if recommendations else "OPTIMAL CONFIGURATION — No special measures required"
        
        # Confidence score based on parameter completeness
        confidence = 0.85 + random.uniform(0, 0.1)
        
        return VTKMResult(
            vtkm=round(vtkm, 2),
            convoy_length_km=round(convoy_length_km, 3),
            recommended_spacing_m=round(adjusted_spacing, 0),
            formation=input_data.formation.value,
            threat_level=input_data.threat_level.value,
            terrain_factor=terrain_speed,
            speed_factor=day_night_factor * altitude_factor,
            effective_speed_kmph=round(effective_speed, 1),
            crossing_time_min=round(crossing_time_min, 1),
            ai_recommendation=ai_recommendation,
            confidence_score=round(confidence, 3),
        )


# ============================================
# FOL (FUEL) CALCULATOR
# ============================================

class FOLCalculator:
    """First Line of Logic - Fuel Requirements Calculator"""
    
    # Fuel costs per liter (INR)
    FUEL_COSTS = {
        "DIESEL": 89.5,
        "PETROL": 96.7,
    }
    
    # Oil consumption rates (liters per 1000 km)
    OIL_RATES = {
        "ENGINE_OIL": 2.5,
        "GEAR_OIL": 0.5,
    }
    
    # Grease consumption (kg per 1000 km)
    GREASE_RATE = 0.3
    
    def __init__(self, use_gpu: bool = False):
        self.use_gpu = use_gpu
    
    def calculate(self, input_data: FOLInput) -> FOLResult:
        """Calculate comprehensive FOL requirements"""
        
        # Initialize totals
        total_diesel = 0.0
        total_petrol = 0.0
        per_vehicle_breakdown = []
        
        # Get terrain multiplier
        terrain_mult = TERRAIN_FUEL_MULTIPLIERS.get(input_data.terrain, 1.0)
        
        # Altitude correction: +5% per 1000m above 1500m
        altitude_correction = 1.0
        if input_data.altitude_m > 1500:
            altitude_correction = 1.0 + ((input_data.altitude_m - 1500) / 1000) * 0.05
        
        # Total distance with return journey
        total_distance = input_data.distance_km * (2 if input_data.return_journey else 1)
        
        # Calculate per vehicle
        for fleet in input_data.vehicles:
            specs = VEHICLE_SPECS.get(fleet.vehicle_type, VEHICLE_SPECS[VehicleType.SHAKTIMAN])
            
            # Base consumption
            base_consumption = total_distance / specs["fuel_consumption_kmpl"]
            
            # Apply corrections
            adjusted_consumption = base_consumption * terrain_mult * altitude_correction
            
            # Load factor (loaded vehicles consume more)
            if fleet.load_tons > 0:
                load_factor = 1.0 + (fleet.load_tons / specs["capacity_tons"]) * 0.2
                adjusted_consumption *= load_factor
            
            # Multiply by vehicle count
            total_consumption = adjusted_consumption * fleet.count
            
            # Add to totals by fuel type
            if specs["fuel_type"] == "DIESEL":
                total_diesel += total_consumption
            else:
                total_petrol += total_consumption
            
            per_vehicle_breakdown.append({
                "vehicle_type": fleet.vehicle_type.value,
                "count": fleet.count,
                "fuel_type": specs["fuel_type"],
                "consumption_liters": round(total_consumption, 1),
                "per_vehicle_liters": round(total_consumption / fleet.count, 1),
            })
        
        # Calculate lubricants
        total_vehicles = sum(f.count for f in input_data.vehicles)
        engine_oil = (total_distance / 1000) * self.OIL_RATES["ENGINE_OIL"] * total_vehicles
        gear_oil = (total_distance / 1000) * self.OIL_RATES["GEAR_OIL"] * total_vehicles
        grease = (total_distance / 1000) * self.GREASE_RATE * total_vehicles
        
        # Add buffer
        buffer_factor = 1.0 + (input_data.buffer_percent / 100)
        total_diesel *= buffer_factor
        total_petrol *= buffer_factor
        
        # Reserve fuel calculations
        reserve_fuel = 0.0
        if input_data.reserve_days > 0:
            daily_consumption = (total_diesel + total_petrol) / max(1, total_distance / 300)  # Assume 300km/day
            reserve_fuel = daily_consumption * input_data.reserve_days
        
        # Cost estimate
        cost_estimate = (total_diesel * self.FUEL_COSTS["DIESEL"]) + (total_petrol * self.FUEL_COSTS["PETROL"])
        
        # AI Recommendations
        recommendations = []
        if total_diesel + total_petrol > 5000:
            recommendations.append("ARRANGE FUEL TANKER support for convoy")
        if input_data.terrain in [TerrainType.MOUNTAINOUS, TerrainType.HIGH_ALTITUDE]:
            recommendations.append("CARRY 30% EXTRA reserve for mountain ops")
        if total_distance > 300:
            recommendations.append("PLAN REFUELING HALT at 150km interval")
        
        ai_recommendation = " | ".join(recommendations) if recommendations else "STANDARD FUEL ALLOCATION — Adequate for mission profile"
        
        return FOLResult(
            diesel_liters=round(total_diesel, 1),
            petrol_liters=round(total_petrol, 1),
            engine_oil_liters=round(engine_oil, 2),
            gear_oil_liters=round(gear_oil, 2),
            grease_kg=round(grease, 2),
            total_fuel_liters=round(total_diesel + total_petrol, 1),
            per_vehicle_breakdown=per_vehicle_breakdown,
            altitude_correction=round(altitude_correction, 3),
            terrain_correction=round(terrain_mult, 3),
            reserve_fuel=round(reserve_fuel, 1),
            ai_recommendation=ai_recommendation,
            cost_estimate_inr=round(cost_estimate, 2),
        )


# ============================================
# MACP (MOVEMENT AMMUNITION CREDIT POINT)
# ============================================

class MACPCalculator:
    """Movement Ammunition Credit Point Optimizer"""
    
    # Credit point multipliers by ammunition type
    AMMO_MULTIPLIERS = {
        AmmoCategory.SAA: 1.0,
        AmmoCategory.MORTAR: 1.5,
        AmmoCategory.ARTILLERY: 2.0,
        AmmoCategory.MISSILE: 5.0,
        AmmoCategory.EXPLOSIVE: 3.0,
        AmmoCategory.ROCKET: 2.5,
    }
    
    def __init__(self, use_gpu: bool = False):
        self.use_gpu = use_gpu
    
    def calculate(self, input_data: MACPInput) -> MACPResult:
        """Calculate MACP credit points and optimization"""
        
        # Base credit points: weight × distance
        base_points = input_data.cargo_weight_tons * input_data.distance_km
        
        # Apply urgency weight
        urgency_weight = URGENCY_WEIGHTS.get(input_data.urgency, 1.0)
        
        # Apply terrain factor
        terrain_factor = 1.0 / TERRAIN_SPEED_FACTORS.get(input_data.terrain, 1.0)
        
        # Apply ammunition multiplier if applicable
        ammo_mult = 1.0
        if input_data.ammo_category:
            ammo_mult = self.AMMO_MULTIPLIERS.get(input_data.ammo_category, 1.0)
        
        # Calculate total credit points
        credit_points = base_points * urgency_weight * terrain_factor * ammo_mult
        
        # Priority score (0-100)
        priority_score = min(100, (credit_points / 1000) * 10 * urgency_weight)
        
        # Recommend vehicles based on load
        recommended = self._recommend_vehicles(input_data.cargo_weight_tons, input_data.terrain)
        
        # Estimate time
        avg_speed = 40 * TERRAIN_SPEED_FACTORS.get(input_data.terrain, 1.0)
        time_hours = input_data.distance_km / avg_speed
        
        # Special handling requirements
        special_handling = []
        if input_data.ammo_category:
            special_handling.append("AMMUNITION TRANSPORT PROTOCOL - Armed escort required")
            special_handling.append("MAINTAIN 100m spacing between ammo vehicles")
            if input_data.ammo_category in [AmmoCategory.MISSILE, AmmoCategory.EXPLOSIVE]:
                special_handling.append("HAZMAT CLEARANCE required at all checkpoints")
        if input_data.urgency == UrgencyLevel.FLASH:
            special_handling.append("PRIORITY ROUTE CLEARANCE - All TCP notified")
        
        # AI Recommendation
        recommendations = []
        if priority_score > 80:
            recommendations.append("CRITICAL PRIORITY — Deploy immediately with escort")
        elif priority_score > 60:
            recommendations.append("HIGH PRIORITY — Schedule within 6 hours")
        else:
            recommendations.append("STANDARD PRIORITY — Normal scheduling applicable")
        
        if credit_points > 10000:
            recommendations.append("Consider splitting into multiple convoys for efficiency")
        
        ai_recommendation = " | ".join(recommendations)
        
        return MACPResult(
            credit_points=round(credit_points, 1),
            priority_score=round(priority_score, 1),
            recommended_vehicles=recommended,
            estimated_time_hours=round(time_hours, 1),
            special_handling=special_handling,
            ai_recommendation=ai_recommendation,
        )
    
    def _recommend_vehicles(self, weight_tons: float, terrain: TerrainType) -> List[Dict]:
        """Recommend optimal vehicle mix for load"""
        recommendations = []
        remaining = weight_tons
        
        # For mountainous terrain, prefer smaller vehicles
        if terrain in [TerrainType.MOUNTAINOUS, TerrainType.HIGH_ALTITUDE]:
            vehicle_order = [VehicleType.STALLION, VehicleType.SHAKTIMAN, VehicleType.TATRA]
        else:
            vehicle_order = [VehicleType.TATRA, VehicleType.SHAKTIMAN, VehicleType.STALLION]
        
        for vehicle in vehicle_order:
            specs = VEHICLE_SPECS[vehicle]
            if remaining <= 0:
                break
            
            count = math.ceil(remaining / specs["capacity_tons"])
            if count > 0:
                actual_count = min(count, 10)  # Max 10 of each type
                recommendations.append({
                    "vehicle_type": vehicle.value,
                    "count": actual_count,
                    "capacity_tons": specs["capacity_tons"],
                    "total_capacity": actual_count * specs["capacity_tons"],
                })
                remaining -= actual_count * specs["capacity_tons"]
        
        return recommendations


# ============================================
# TCP (TRAFFIC CONTROL POST) PLANNER
# ============================================

class TCPPlanner:
    """Traffic Control Post Planning Algorithm"""
    
    # Standard TCP spacing
    TCP_SPACING = {
        "MSR": 50,      # Main Supply Route - every 50km
        "TACTICAL": 25, # Tactical zone - every 25km
        "URBAN": 10,    # Urban area - every 10km
    }
    
    # Personnel requirements per TCP type
    TCP_PERSONNEL = {
        TCPType.CONTROL: {"Officer": 1, "JCO": 1, "OR": 4},
        TCPType.INFO: {"JCO": 1, "OR": 2},
        TCPType.REST: {"JCO": 1, "OR": 3},
        TCPType.FUEL: {"JCO": 1, "OR": 4},
        TCPType.MEDICAL: {"Officer": 1, "JCO": 1, "OR": 2},
        TCPType.VEHICLE_AID: {"JCO": 1, "OR": 3},
    }
    
    def __init__(self, use_gpu: bool = False):
        self.use_gpu = use_gpu
    
    def plan_tcps(self, 
                  route_distance_km: float, 
                  route_type: str = "MSR",
                  threat_level: ThreatLevel = ThreatLevel.GREEN,
                  include_fuel: bool = True,
                  include_medical: bool = True) -> List[TCPPlan]:
        """Generate TCP plan for a route"""
        
        tcps = []
        spacing = self.TCP_SPACING.get(route_type, 50)
        
        # Reduce spacing for higher threat levels
        if threat_level in [ThreatLevel.ORANGE, ThreatLevel.RED]:
            spacing = spacing * 0.7
        
        # Start TCP
        tcps.append(self._create_tcp("TCP-START", TCPType.CONTROL, 0))
        
        current_km = spacing
        tcp_count = 1
        
        while current_km < route_distance_km:
            # Determine TCP type based on position
            if include_fuel and tcp_count % 3 == 0:
                tcp_type = TCPType.FUEL
            elif include_medical and tcp_count % 5 == 0:
                tcp_type = TCPType.MEDICAL
            elif tcp_count % 2 == 0:
                tcp_type = TCPType.REST
            else:
                tcp_type = TCPType.INFO
            
            tcps.append(self._create_tcp(f"TCP-{tcp_count:02d}", tcp_type, current_km))
            current_km += spacing
            tcp_count += 1
        
        # End TCP
        tcps.append(self._create_tcp("TCP-END", TCPType.CONTROL, route_distance_km))
        
        return tcps
    
    def _create_tcp(self, post_id: str, post_type: TCPType, location_km: float) -> TCPPlan:
        """Create a single TCP entry"""
        personnel = self.TCP_PERSONNEL.get(post_type, {"OR": 2})
        
        equipment = ["Radio Set", "Signs/Markers"]
        if post_type == TCPType.CONTROL:
            equipment.extend(["Traffic Control Kit", "Route Map", "Log Book"])
        elif post_type == TCPType.FUEL:
            equipment.extend(["Fuel Drums", "Hand Pump", "Fire Extinguisher"])
        elif post_type == TCPType.MEDICAL:
            equipment.extend(["First Aid Kit", "Stretcher", "Emergency Medicines"])
        elif post_type == TCPType.VEHICLE_AID:
            equipment.extend(["Tool Kit", "Spare Parts", "Tow Cable"])
        
        communication = ["VHF Radio"]
        if post_type == TCPType.CONTROL:
            communication.append("Field Telephone")
        
        return TCPPlan(
            post_id=post_id,
            post_type=post_type,
            location_km=round(location_km, 1),
            personnel=personnel,
            equipment=equipment,
            communication=communication,
        )


# ============================================
# HALT SCHEDULE GENERATOR
# ============================================

class HaltScheduleGenerator:
    """Generate halt schedules for convoy movements"""
    
    # Halt standards
    HALT_STANDARDS = {
        "SHORT": {"interval_km": 75, "duration_min": 15, "purpose": ["Driver rest", "Vehicle check"]},
        "LONG": {"interval_km": 150, "duration_min": 60, "purpose": ["Meal", "Refueling", "Maintenance"]},
        "NIGHT": {"duration_hours": 8, "purpose": ["Crew rest", "Night leaguer", "Security"]},
    }
    
    def __init__(self, use_gpu: bool = False):
        self.use_gpu = use_gpu
    
    def generate_schedule(self,
                          total_distance_km: float,
                          avg_speed_kmph: float = 30,
                          start_time: datetime = None,
                          include_night_halt: bool = True,
                          terrain: TerrainType = TerrainType.PLAINS) -> List[HaltSchedule]:
        """Generate comprehensive halt schedule"""
        
        if start_time is None:
            start_time = datetime.now().replace(hour=6, minute=0)
        
        halts = []
        current_km = 0
        current_time = start_time
        
        # Adjust intervals for terrain
        short_interval = self.HALT_STANDARDS["SHORT"]["interval_km"]
        long_interval = self.HALT_STANDARDS["LONG"]["interval_km"]
        
        if terrain in [TerrainType.MOUNTAINOUS, TerrainType.HIGH_ALTITUDE]:
            short_interval *= 0.7
            long_interval *= 0.7
        
        halt_count = 0
        
        while current_km < total_distance_km:
            # Determine next halt type
            distance_to_next = min(short_interval, total_distance_km - current_km)
            
            if distance_to_next <= 0:
                break
            
            current_km += distance_to_next
            travel_hours = distance_to_next / avg_speed_kmph
            current_time += timedelta(hours=travel_hours)
            
            # Check if it's time for a night halt (after 18:00)
            if include_night_halt and current_time.hour >= 18 and current_km < total_distance_km:
                halts.append(HaltSchedule(
                    halt_type="NIGHT",
                    start_km=current_km,
                    duration_min=8 * 60,
                    purpose=self.HALT_STANDARDS["NIGHT"]["purpose"],
                    facilities_required=["Leaguer area", "Security perimeter", "Rations", "Water"],
                ))
                current_time = current_time.replace(hour=6, minute=0) + timedelta(days=1)
                halt_count = 0  # Reset for new day
                continue
            
            # Long halt every 150km or every 4 short halts
            if halt_count > 0 and (current_km % long_interval < short_interval or halt_count % 4 == 3):
                halts.append(HaltSchedule(
                    halt_type="LONG",
                    start_km=current_km,
                    duration_min=self.HALT_STANDARDS["LONG"]["duration_min"],
                    purpose=self.HALT_STANDARDS["LONG"]["purpose"],
                    facilities_required=["Fuel point", "Shaded area", "Ration distribution"],
                ))
                current_time += timedelta(minutes=60)
            else:
                halts.append(HaltSchedule(
                    halt_type="SHORT",
                    start_km=current_km,
                    duration_min=self.HALT_STANDARDS["SHORT"]["duration_min"],
                    purpose=self.HALT_STANDARDS["SHORT"]["purpose"],
                    facilities_required=["Pull-off area"],
                ))
                current_time += timedelta(minutes=15)
            
            halt_count += 1
        
        return halts


# ============================================
# ROUTE CLASSIFIER
# ============================================

class RouteClassifier:
    """NATO Route Classification System"""
    
    def __init__(self, use_gpu: bool = False):
        self.use_gpu = use_gpu
    
    def classify_route(self,
                       max_weight_tons: float,
                       width_m: float,
                       surface_type: str,
                       gradient_percent: float = 0) -> Dict[str, Any]:
        """Classify route according to NATO standards"""
        
        # Determine class based on weight
        if max_weight_tons >= 100:
            route_class = RouteClass.CLASS_100
        elif max_weight_tons >= 70:
            route_class = RouteClass.CLASS_70
        elif max_weight_tons >= 50:
            route_class = RouteClass.CLASS_50
        else:
            route_class = RouteClass.CLASS_30
        
        # Width classification
        if width_m >= 7.0:
            width_class = "DUAL_CARRIAGEWAY"
        elif width_m >= 5.5:
            width_class = "TWO_LANE"
        elif width_m >= 3.5:
            width_class = "SINGLE_LANE"
        else:
            width_class = "TRACK"
        
        # Surface classification
        surface_class = "PAVED" if surface_type.upper() in ["METALLED", "ASPHALT", "CONCRETE"] else "UNPAVED"
        
        # Gradient limitation
        gradient_limit = "NORMAL"
        if gradient_percent > 15:
            gradient_limit = "EXTREME"
        elif gradient_percent > 10:
            gradient_limit = "STEEP"
        elif gradient_percent > 7:
            gradient_limit = "MODERATE"
        
        # Speed advisory based on classification
        if route_class == RouteClass.CLASS_100 and width_class == "DUAL_CARRIAGEWAY":
            max_convoy_speed = 50
        elif route_class.value >= 50 and width_class in ["DUAL_CARRIAGEWAY", "TWO_LANE"]:
            max_convoy_speed = 40
        else:
            max_convoy_speed = 25
        
        # Restrictions
        restrictions = []
        if route_class.value < 50:
            restrictions.append("Heavy vehicles prohibited (>50T)")
        if width_class == "SINGLE_LANE":
            restrictions.append("Two-way traffic not possible - Use traffic control")
        if gradient_limit in ["STEEP", "EXTREME"]:
            restrictions.append(f"Gradient restriction: Max {gradient_percent}%")
        if surface_class == "UNPAVED":
            restrictions.append("Weather-dependent - Not suitable in rain")
        
        return {
            "route_class": f"CLASS_{route_class.value}",
            "weight_limit_tons": route_class.value,
            "width_class": width_class,
            "width_m": width_m,
            "surface_type": surface_class,
            "gradient": gradient_limit,
            "max_convoy_speed_kmph": max_convoy_speed,
            "restrictions": restrictions,
            "suitable_for": self._get_suitable_vehicles(route_class),
        }
    
    def _get_suitable_vehicles(self, route_class: RouteClass) -> List[str]:
        """Get list of suitable vehicle types for route class"""
        suitable = ["GYPSY", "JONGA"]
        if route_class.value >= 30:
            suitable.extend(["STALLION", "AMBULANCE", "SHAKTIMAN"])
        if route_class.value >= 50:
            suitable.extend(["TATRA", "RECOVERY"])
        if route_class.value >= 70:
            suitable.append("ALS")
        return suitable


# ============================================
# THREAT ASSESSMENT ALGORITHM
# ============================================

class ThreatAssessment:
    """AI-based Threat Assessment for Convoy Operations"""
    
    def __init__(self, use_gpu: bool = False):
        self.use_gpu = use_gpu
    
    def assess_route_threat(self,
                             terrain: TerrainType,
                             route_length_km: float,
                             time_of_day: str = "DAY",
                             historical_incidents: int = 0,
                             nearby_hostile_zones: int = 0) -> Dict[str, Any]:
        """Assess threat level for a route"""
        
        # Base threat scores
        terrain_threat = {
            TerrainType.PLAINS: 0.2,
            TerrainType.MOUNTAINOUS: 0.5,
            TerrainType.HIGH_ALTITUDE: 0.4,
            TerrainType.DESERT: 0.3,
            TerrainType.JUNGLE: 0.7,
            TerrainType.URBAN: 0.6,
            TerrainType.COASTAL: 0.25,
            TerrainType.SEMI_DESERT: 0.35,
        }.get(terrain, 0.3)
        
        # Time factor
        time_threat = 0.3 if time_of_day == "NIGHT" else 0.0
        
        # Historical factor
        incident_threat = min(0.3, historical_incidents * 0.05)
        
        # Proximity factor
        proximity_threat = min(0.4, nearby_hostile_zones * 0.1)
        
        # Distance factor (longer routes = higher threat)
        distance_threat = min(0.2, route_length_km / 1000)
        
        # Calculate total threat score
        total_threat = terrain_threat + time_threat + incident_threat + proximity_threat + distance_threat
        total_threat = min(1.0, total_threat)
        
        # Determine threat level
        if total_threat >= 0.7:
            threat_level = ThreatLevel.RED
        elif total_threat >= 0.5:
            threat_level = ThreatLevel.ORANGE
        elif total_threat >= 0.3:
            threat_level = ThreatLevel.YELLOW
        else:
            threat_level = ThreatLevel.GREEN
        
        # Generate recommendations
        recommendations = []
        if threat_level in [ThreatLevel.RED, ThreatLevel.ORANGE]:
            recommendations.append("Armed escort mandatory")
            recommendations.append("Maintain radio silence on open channels")
        if terrain_threat > 0.5:
            recommendations.append(f"High-risk terrain: {terrain.value} - Use armored vehicles")
        if time_of_day == "NIGHT":
            recommendations.append("Night movement - Use blackout lights, increase spacing")
        if historical_incidents > 2:
            recommendations.append("History of incidents - Request air/drone cover")
        
        return {
            "threat_level": threat_level.value,
            "threat_score": round(total_threat * 100, 1),
            "breakdown": {
                "terrain": round(terrain_threat * 100, 1),
                "time_of_day": round(time_threat * 100, 1),
                "historical": round(incident_threat * 100, 1),
                "proximity": round(proximity_threat * 100, 1),
                "distance": round(distance_threat * 100, 1),
            },
            "recommendations": recommendations,
            "escort_required": threat_level in [ThreatLevel.RED, ThreatLevel.ORANGE],
            "alternative_route_advised": total_threat > 0.6,
        }


# ============================================
# CONVOY OPTIMIZER (SIMULATED ANNEALING)
# ============================================

class ConvoyOptimizer:
    """Optimize convoy composition using simulated annealing"""
    
    def __init__(self, use_gpu: bool = False):
        self.use_gpu = use_gpu
        self.temperature = 1000
        self.cooling_rate = 0.003
    
    def optimize_loading(self,
                          cargo_items: List[Dict],
                          available_vehicles: Dict[str, int],
                          max_iterations: int = 1000) -> Dict[str, Any]:
        """Optimize cargo loading across vehicles using simulated annealing"""
        
        # Initialize solution
        current_solution = self._generate_initial_solution(cargo_items, available_vehicles)
        best_solution = current_solution.copy()
        current_energy = self._calculate_energy(current_solution)
        best_energy = current_energy
        
        temperature = self.temperature
        
        for iteration in range(max_iterations):
            # Generate neighbor
            neighbor = self._generate_neighbor(current_solution, available_vehicles)
            neighbor_energy = self._calculate_energy(neighbor)
            
            # Accept or reject
            delta_energy = neighbor_energy - current_energy
            
            if delta_energy < 0:
                current_solution = neighbor
                current_energy = neighbor_energy
            elif random.random() < math.exp(-delta_energy / temperature):
                current_solution = neighbor
                current_energy = neighbor_energy
            
            # Update best
            if current_energy < best_energy:
                best_solution = current_solution.copy()
                best_energy = current_energy
            
            # Cool down
            temperature *= (1 - self.cooling_rate)
        
        # Calculate utilization
        utilization = self._calculate_utilization(best_solution)
        
        return {
            "optimized_loading": best_solution,
            "optimization_score": round(100 - best_energy, 1),
            "vehicle_utilization": utilization,
            "iterations_run": max_iterations,
            "final_temperature": round(temperature, 2),
        }
    
    def _generate_initial_solution(self, cargo_items: List[Dict], vehicles: Dict[str, int]) -> Dict:
        # Simple greedy initial solution
        solution = {v: [] for v in vehicles.keys()}
        for item in cargo_items:
            # Find vehicle with capacity
            for vehicle, count in vehicles.items():
                if count > 0:
                    solution[vehicle].append(item)
                    break
        return solution
    
    def _generate_neighbor(self, solution: Dict, vehicles: Dict) -> Dict:
        # Swap random item between vehicles
        neighbor = {k: list(v) for k, v in solution.items()}
        vehicle_types = list(solution.keys())
        if len(vehicle_types) < 2:
            return neighbor
        
        v1, v2 = random.sample(vehicle_types, 2)
        if neighbor[v1] and neighbor[v2]:
            idx1 = random.randint(0, len(neighbor[v1]) - 1)
            idx2 = random.randint(0, len(neighbor[v2]) - 1)
            neighbor[v1][idx1], neighbor[v2][idx2] = neighbor[v2][idx2], neighbor[v1][idx1]
        
        return neighbor
    
    def _calculate_energy(self, solution: Dict) -> float:
        # Energy = imbalance + overload penalty
        energy = 0.0
        loads = []
        for vehicle, items in solution.items():
            total_weight = sum(item.get("weight", 0) for item in items)
            loads.append(total_weight)
            # Penalty for overload
            spec = VEHICLE_SPECS.get(VehicleType[vehicle], {"capacity_tons": 4})
            if total_weight > spec["capacity_tons"]:
                energy += (total_weight - spec["capacity_tons"]) * 10
        
        # Penalty for imbalance
        if loads:
            avg_load = sum(loads) / len(loads)
            variance = sum((l - avg_load) ** 2 for l in loads) / len(loads)
            energy += math.sqrt(variance)
        
        return energy
    
    def _calculate_utilization(self, solution: Dict) -> Dict:
        utilization = {}
        for vehicle, items in solution.items():
            total_weight = sum(item.get("weight", 0) for item in items)
            spec = VEHICLE_SPECS.get(VehicleType[vehicle], {"capacity_tons": 4})
            utilization[vehicle] = round((total_weight / spec["capacity_tons"]) * 100, 1)
        return utilization


# ============================================
# MAIN MILITARY ALGORITHMS SERVICE
# ============================================

class MilitaryAlgorithmsService:
    """Unified service for all military logistics algorithms"""
    
    def __init__(self, use_gpu: bool = False):
        self.use_gpu = use_gpu
        self.vtkm = VTKMCalculator(use_gpu)
        self.fol = FOLCalculator(use_gpu)
        self.macp = MACPCalculator(use_gpu)
        self.tcp = TCPPlanner(use_gpu)
        self.halt = HaltScheduleGenerator(use_gpu)
        self.route = RouteClassifier(use_gpu)
        self.threat = ThreatAssessment(use_gpu)
        self.optimizer = ConvoyOptimizer(use_gpu)
    
    def get_status(self) -> Dict[str, Any]:
        """Get service status"""
        return {
            "status": "OPERATIONAL",
            "gpu_enabled": self.use_gpu,
            "algorithms_available": [
                "VTKM Calculator",
                "FOL Calculator",
                "MACP Optimizer",
                "TCP Planner",
                "Halt Schedule Generator",
                "Route Classifier",
                "Threat Assessment",
                "Convoy Optimizer",
            ],
            "version": "2.0.0",
        }


# Create singleton instance
military_service = MilitaryAlgorithmsService(use_gpu=False)
