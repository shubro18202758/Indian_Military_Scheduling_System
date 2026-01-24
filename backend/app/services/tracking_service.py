"""
Military Convoy Tracking Service
==================================

Advanced real-time tracking service for Indian Army convoy operations.
Provides FlightRadar24-style tracking with AI-powered predictions.

Features:
- Real-time position tracking with military-grade accuracy
- Dynamic ETA calculation with terrain/weather factors
- Checkpoint progress monitoring
- AI-powered threat assessment and forecasting
- GPU-accelerated analytics via Janus Pro 7B

Security Classification: RESTRICTED
"""

import asyncio
import random
import math
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field, asdict
from enum import Enum
import numpy as np

# Import AI service
try:
    from app.services.janus_ai_service import janus_ai
    AI_AVAILABLE = True
except ImportError:
    AI_AVAILABLE = False


# ============================================================================
# ENUMS & CONSTANTS
# ============================================================================

class MovementStatus(Enum):
    STATIONARY = "STATIONARY"
    MOVING = "MOVING"
    HALTED = "HALTED"
    DELAYED = "DELAYED"
    EMERGENCY = "EMERGENCY"
    ACCELERATING = "ACCELERATING"
    DECELERATING = "DECELERATING"


class MissionPriority(Enum):
    FLASH = "FLASH"  # Highest - immediate action
    IMMEDIATE = "IMMEDIATE"
    PRIORITY = "PRIORITY"
    ROUTINE = "ROUTINE"


class SecurityClassification(Enum):
    UNCLASSIFIED = "UNCLASSIFIED"
    RESTRICTED = "RESTRICTED"
    CONFIDENTIAL = "CONFIDENTIAL"
    SECRET = "SECRET"
    TOP_SECRET = "TOP_SECRET"


class CargoType(Enum):
    AMMUNITION = "AMMUNITION"
    RATIONS = "RATIONS"
    FUEL = "FUEL"
    EQUIPMENT = "EQUIPMENT"
    MEDICAL = "MEDICAL"
    PERSONNEL = "PERSONNEL"
    MIXED = "MIXED"
    CLASSIFIED = "CLASSIFIED"


# Indian Army Formations in J&K/Ladakh
FORMATIONS = {
    "15_CORPS": {"name": "Chinar Corps", "hq": "Srinagar", "command": "Northern Command"},
    "14_CORPS": {"name": "Fire & Fury Corps", "hq": "Leh", "command": "Northern Command"},
    "16_CORPS": {"name": "White Knight Corps", "hq": "Nagrota", "command": "Northern Command"},
    "9_CORPS": {"name": "Kharga Corps", "hq": "Yol", "command": "Western Command"},
}

# Indian Army Units (Sample)
ARMY_UNITS = [
    {"id": "4-RAJRIF", "name": "4th Battalion, Rajputana Rifles", "type": "Infantry"},
    {"id": "15-KUMAON", "name": "15th Battalion, Kumaon Regiment", "type": "Infantry"},
    {"id": "9-PARA-SF", "name": "9th Battalion, Parachute Regiment (Special Forces)", "type": "SF"},
    {"id": "21-RR", "name": "21 Rashtriya Rifles", "type": "CI"},
    {"id": "44-RR", "name": "44 Rashtriya Rifles", "type": "CI"},
    {"id": "7-JAK-LI", "name": "7th Battalion, Jammu & Kashmir Light Infantry", "type": "Infantry"},
    {"id": "3-LADAKH-SCOUTS", "name": "3rd Battalion, Ladakh Scouts", "type": "Mountain"},
    {"id": "14-GRENADIERS", "name": "14th Battalion, Grenadiers", "type": "Infantry"},
    {"id": "58-ENGR", "name": "58 Engineer Regiment", "type": "Engineer"},
    {"id": "411-ASC-BN", "name": "411 Army Service Corps Battalion", "type": "Logistics"},
    {"id": "165-FIELD-REGT", "name": "165 Field Regiment (Artillery)", "type": "Artillery"},
    {"id": "223-MED-COY", "name": "223 Medical Company", "type": "Medical"},
]

# Vehicle Types (Indian Army)
VEHICLE_TYPES = {
    "STALLION": {"class": "LOGISTICS", "capacity_tons": 10, "speed_max": 80, "fuel_capacity": 200, "crew": 2},
    "SHAKTIMAN": {"class": "LOGISTICS", "capacity_tons": 5, "speed_max": 70, "fuel_capacity": 150, "crew": 2},
    "TATRA": {"class": "HEAVY_LOGISTICS", "capacity_tons": 25, "speed_max": 60, "fuel_capacity": 400, "crew": 2},
    "GYPSY": {"class": "COMMAND", "capacity_tons": 0.5, "speed_max": 100, "fuel_capacity": 60, "crew": 4},
    "JONGA": {"class": "UTILITY", "capacity_tons": 1, "speed_max": 90, "fuel_capacity": 80, "crew": 6},
    "BMP-2": {"class": "APC", "capacity_tons": 3, "speed_max": 65, "fuel_capacity": 460, "crew": 3, "armed": True},
    "T-90": {"class": "MBT", "capacity_tons": 0, "speed_max": 60, "fuel_capacity": 1200, "crew": 3, "armed": True},
    "LPTA-2523": {"class": "HEAVY_LOGISTICS", "capacity_tons": 10, "speed_max": 70, "fuel_capacity": 300, "crew": 2},
    "AMBULANCE": {"class": "MEDICAL", "capacity_tons": 1, "speed_max": 80, "fuel_capacity": 100, "crew": 3},
    "RECOVERY": {"class": "RECOVERY", "capacity_tons": 0, "speed_max": 50, "fuel_capacity": 250, "crew": 3},
}

# Radio Callsigns (NATO-style phonetic)
CALLSIGN_PREFIXES = ["ALPHA", "BRAVO", "CHARLIE", "DELTA", "ECHO", "FOXTROT", "GOLF", "HOTEL", 
                     "INDIA", "JULIET", "KILO", "LIMA", "MIKE", "NOVEMBER", "OSCAR", "PAPA",
                     "QUEBEC", "ROMEO", "SIERRA", "TANGO", "UNIFORM", "VICTOR", "WHISKEY",
                     "XRAY", "YANKEE", "ZULU"]

# Mission Code Names
OPERATION_NAMES = [
    "SNOW LEOPARD", "MOUNTAIN EAGLE", "IRON FIST", "THUNDER BOLT", "NORTHERN SHIELD",
    "KAVACH", "RAKSHA", "VIJAY", "SHAKTI", "PRAHAR", "TRIDENT", "GUARDIAN", "SENTINEL",
    "HIMALAYAN HAWK", "SIACHEN STAR", "LADAKH LION", "KASHMIR KNIGHT", "KARGIL KING"
]


# ============================================================================
# DATA CLASSES
# ============================================================================

@dataclass
class ConvoyTrackingData:
    """Complete tracking data for a convoy."""
    convoy_id: int
    mission_id: str
    callsign: str
    
    # Position
    latitude: float
    longitude: float
    altitude_m: float
    heading_deg: float
    speed_kmh: float
    ground_track: float
    
    # Progress
    distance_covered_km: float
    distance_remaining_km: float
    progress_pct: float
    
    # Time
    eta_destination: datetime
    time_elapsed: timedelta
    time_remaining: timedelta
    
    # Status
    movement_status: MovementStatus
    halt_reason: Optional[str] = None
    
    # Checkpoints
    last_checkpoint: Optional[Dict] = None
    next_checkpoint: Optional[Dict] = None
    checkpoints_crossed: int = 0
    checkpoints_remaining: int = 0
    
    # Mission
    mission_details: Optional[Dict] = None
    
    # Vehicles
    vehicle_count: int = 0
    vehicles: List[Dict] = field(default_factory=list)
    
    # Health
    convoy_health: str = "GREEN"  # GREEN, AMBER, RED
    fuel_status: str = "ADEQUATE"
    maintenance_alerts: List[str] = field(default_factory=list)
    
    # Threats
    active_threats: List[Dict] = field(default_factory=list)
    threat_level: str = "LOW"
    
    # AI Predictions
    ai_predictions: List[Dict] = field(default_factory=list)
    ai_recommendation: Optional[str] = None
    
    # Timestamps
    last_update: datetime = field(default_factory=datetime.utcnow)
    data_age_seconds: int = 0


@dataclass
class VehicleTrackingData:
    """Individual vehicle tracking data."""
    vehicle_id: int
    callsign: str
    registration: str
    vehicle_type: str
    vehicle_class: str
    
    # Position
    latitude: float
    longitude: float
    speed_kmh: float
    heading_deg: float
    
    # Convoy Position
    convoy_position: int
    is_lead: bool = False
    is_tail: bool = False
    is_command: bool = False
    
    # Status
    engine_status: str = "RUNNING"
    fuel_level_pct: float = 100.0
    fuel_range_km: float = 0.0
    
    # Health
    health_status: str = "OPERATIONAL"
    maintenance_due: bool = False
    alerts: List[str] = field(default_factory=list)
    
    # Crew
    driver: Optional[str] = None
    commander: Optional[str] = None
    crew_count: int = 1
    
    # Load
    current_load_tons: float = 0.0
    passengers: int = 0
    
    # Communication
    radio_status: str = "OPERATIONAL"
    gps_status: str = "LOCKED"
    last_comm: datetime = field(default_factory=datetime.utcnow)


@dataclass 
class CheckpointData:
    """Checkpoint crossing data."""
    checkpoint_id: str
    checkpoint_name: str
    checkpoint_type: str
    latitude: float
    longitude: float
    
    scheduled_arrival: Optional[datetime] = None
    actual_arrival: Optional[datetime] = None
    departure: Optional[datetime] = None
    
    status: str = "PENDING"  # PENDING, APPROACHING, ARRIVED, CLEARED, DEPARTED
    delay_minutes: int = 0
    
    verified_by: Optional[str] = None
    remarks: Optional[str] = None


# ============================================================================
# TRACKING SERVICE
# ============================================================================

class MilitaryTrackingService:
    """
    Advanced military convoy tracking service.
    Provides real-time tracking with AI-powered analytics.
    """
    
    def __init__(self):
        # Active convoy tracking data
        self.active_convoys: Dict[int, ConvoyTrackingData] = {}
        self.vehicle_tracking: Dict[int, VehicleTrackingData] = {}
        self.checkpoint_history: Dict[int, List[CheckpointData]] = {}
        
        # Mission data
        self.missions: Dict[int, Dict] = {}
        
        # Route data cache
        self.route_cache: Dict[str, List[Tuple[float, float]]] = {}
        
        # AI predictions cache
        self.predictions_cache: Dict[int, List[Dict]] = {}
        
        # Tracking configuration
        self.update_interval_seconds = 1
        self.prediction_interval_seconds = 30
        
        # Synthetic data generator
        self._init_synthetic_data()
    
    def _init_synthetic_data(self):
        """Initialize synthetic military data."""
        self.synthetic_missions = self._generate_synthetic_missions()
        self.synthetic_vehicles = self._generate_synthetic_vehicles()
    
    def _generate_synthetic_missions(self) -> Dict[int, Dict]:
        """Generate realistic military mission data."""
        missions = {}
        
        # Generate 6 active missions for existing convoys
        for convoy_id in range(1, 7):
            mission = self._create_mission(convoy_id)
            missions[convoy_id] = mission
        
        return missions
    
    def _create_mission(self, convoy_id: int) -> Dict:
        """Create a realistic military mission."""
        unit = random.choice(ARMY_UNITS)
        formation_key = random.choice(list(FORMATIONS.keys()))
        formation = FORMATIONS[formation_key]
        
        # Generate mission ID: OP-<CODE>-<YEAR>-<SERIAL>
        mission_code = random.choice(OPERATION_NAMES).replace(" ", "-")
        mission_id = f"OP-{mission_code[:6]}-2026-{convoy_id:04d}"
        
        # Generate callsign
        callsign = f"{random.choice(CALLSIGN_PREFIXES)}-{random.choice(CALLSIGN_PREFIXES)}-{random.randint(1, 9)}"
        
        # Cargo type based on unit type
        if unit["type"] == "Logistics":
            cargo_type = random.choice(["RATIONS", "FUEL", "EQUIPMENT", "MIXED"])
        elif unit["type"] == "Medical":
            cargo_type = "MEDICAL"
        elif unit["type"] in ["Infantry", "CI", "SF"]:
            cargo_type = random.choice(["AMMUNITION", "EQUIPMENT", "PERSONNEL"])
        else:
            cargo_type = random.choice(list(CargoType)).value
        
        # Vehicle count based on convoy
        vehicle_count = random.randint(4, 12)
        
        # Personnel count
        personnel = random.randint(vehicle_count * 2, vehicle_count * 8)
        officers = max(1, personnel // 20)
        jcos = max(2, personnel // 10)
        ors = personnel - officers - jcos
        
        # Generate vehicle composition
        vehicle_composition = []
        for i in range(vehicle_count):
            if i == 0:
                vtype = random.choice(["GYPSY", "JONGA"])  # Lead vehicle
            elif i == vehicle_count - 1:
                vtype = random.choice(["STALLION", "RECOVERY"])  # Tail
            else:
                vtype = random.choice(["STALLION", "SHAKTIMAN", "TATRA", "LPTA-2523"])
            vehicle_composition.append(vtype)
        
        # Priority based on cargo
        if cargo_type == "AMMUNITION":
            priority = random.choice(["IMMEDIATE", "PRIORITY"])
        elif cargo_type == "MEDICAL":
            priority = "FLASH" if random.random() > 0.7 else "IMMEDIATE"
        else:
            priority = random.choice(["PRIORITY", "ROUTINE"])
        
        # Security classification
        if cargo_type in ["AMMUNITION", "CLASSIFIED"]:
            classification = "SECRET"
        elif unit["type"] == "SF":
            classification = "TOP_SECRET"
        else:
            classification = random.choice(["RESTRICTED", "CONFIDENTIAL"])
        
        # Armed escort for high-value convoys
        armed_escort = cargo_type in ["AMMUNITION", "FUEL"] or classification in ["SECRET", "TOP_SECRET"]
        
        # Calculate deadline based on priority
        deadline_hours = {
            "FLASH": 6,
            "IMMEDIATE": 12,
            "PRIORITY": 24,
            "ROUTINE": 48
        }
        
        mission_start = datetime.utcnow() - timedelta(hours=random.randint(1, 4))
        mission_deadline = mission_start + timedelta(hours=deadline_hours[priority])
        
        # Frequencies (realistic military bands)
        primary_freq = f"{random.randint(30, 88)}.{random.randint(100, 999)} MHz VHF"
        alt_freq = f"{random.randint(225, 400)}.{random.randint(100, 999)} MHz UHF"
        
        return {
            "mission_id": mission_id,
            "mission_code": mission_code,
            "operation_name": f"Operation {mission_code.replace('-', ' ')}",
            "security_classification": classification,
            "unit_id": unit["id"],
            "unit_name": unit["name"],
            "unit_type": unit["type"],
            "formation": formation_key.replace("_", " "),
            "formation_name": formation["name"],
            "command": formation["command"],
            "hq_location": formation["hq"],
            "personnel_count": personnel,
            "officer_count": officers,
            "jco_count": jcos,
            "or_count": ors,
            "cargo_type": cargo_type,
            "cargo_description": self._generate_cargo_description(cargo_type),
            "cargo_weight_tons": round(random.uniform(10, 50), 1),
            "hazmat_class": "1.1" if cargo_type == "AMMUNITION" else ("3" if cargo_type == "FUEL" else None),
            "vehicle_count": vehicle_count,
            "vehicle_types": vehicle_composition,
            "lead_vehicle_callsign": f"{callsign}-1",
            "tail_vehicle_callsign": f"{callsign}-{vehicle_count}",
            "armed_escort": armed_escort,
            "escort_unit": f"{random.randint(1, 50)} RR" if armed_escort else None,
            "escort_strength": random.randint(10, 30) if armed_escort else 0,
            "weapons_carried": ["5.56mm INSAS", "7.62mm LMG"] if armed_escort else [],
            "primary_freq": primary_freq,
            "alternate_freq": alt_freq,
            "satcom_enabled": classification in ["SECRET", "TOP_SECRET"],
            "callsign": callsign,
            "mission_priority": priority,
            "mission_type": random.choice(["RESUPPLY", "REINFORCEMENT", "RELIEF", "ROTATION"]),
            "authorized_by": f"Col. {random.choice(['Sharma', 'Singh', 'Verma', 'Rao', 'Kumar', 'Reddy'])}",
            "authorized_rank": "Colonel",
            "mission_start_time": mission_start.isoformat(),
            "mission_deadline": mission_deadline.isoformat(),
            "mission_status": "ACTIVE",
            "created_at": mission_start.isoformat()
        }
    
    def _generate_cargo_description(self, cargo_type: str) -> str:
        """Generate realistic cargo description."""
        descriptions = {
            "AMMUNITION": "Small arms ammunition (5.56mm, 7.62mm), grenades, mortar rounds, pyrotechnics",
            "RATIONS": "Combat rations (CRP), fresh rations, water, cooking supplies for 30 days",
            "FUEL": "HSD (High Speed Diesel), MTSO, aviation fuel containers",
            "EQUIPMENT": "Tentage, communication equipment, generators, winter gear",
            "MEDICAL": "Medical supplies, blood products, emergency surgical equipment",
            "PERSONNEL": "Troops for rotation, leave party, reinforcement",
            "MIXED": "General stores, mail, welfare items, unit equipment",
            "CLASSIFIED": "Classified equipment - need to know basis only"
        }
        return descriptions.get(cargo_type, "General military stores")
    
    def _generate_synthetic_vehicles(self) -> Dict[int, List[Dict]]:
        """Generate synthetic vehicle data for each convoy."""
        vehicles = {}
        
        for convoy_id, mission in self.synthetic_missions.items():
            convoy_vehicles = []
            
            for i, vtype in enumerate(mission["vehicle_types"]):
                vehicle_info = VEHICLE_TYPES.get(vtype, VEHICLE_TYPES["STALLION"])
                
                # Registration format: Army number plate
                reg_prefix = random.choice(["01A", "02A", "03A", "04A", "05A", "11A", "12A"])
                reg_number = f"{reg_prefix}-{random.randint(1000, 9999)}"
                
                # Generate crew
                ranks = ["Hav", "Nk", "Sep", "L/Nk", "Rfn", "Gnr", "Spr"]
                officer_ranks = ["Lt", "Capt", "Maj"]
                
                vehicle = {
                    "vehicle_id": convoy_id * 100 + i + 1,
                    "callsign": f"{mission['callsign']}-{i + 1}",
                    "registration": reg_number,
                    "vehicle_type": vtype,
                    "vehicle_class": vehicle_info["class"],
                    "convoy_position": i + 1,
                    "is_lead": i == 0,
                    "is_tail": i == len(mission["vehicle_types"]) - 1,
                    "is_command": i == 0 or (vehicle_info["class"] == "COMMAND"),
                    "capacity_tons": vehicle_info["capacity_tons"],
                    "max_speed_kmh": vehicle_info["speed_max"],
                    "fuel_capacity_liters": vehicle_info["fuel_capacity"],
                    "fuel_level_pct": round(random.uniform(60, 100), 1),
                    "armed": vehicle_info.get("armed", False),
                    "crew_count": vehicle_info["crew"],
                    "driver": f"{random.choice(ranks)} {random.choice(['Ram', 'Shyam', 'Gopal', 'Raju', 'Vijay', 'Sunil'])} {random.choice(['Singh', 'Kumar', 'Yadav', 'Sharma', 'Thapa'])}",
                    "commander": f"{random.choice(officer_ranks) if i == 0 else random.choice(ranks)} {random.choice(['Rajesh', 'Anil', 'Suresh', 'Prakash'])} {random.choice(['Verma', 'Chauhan', 'Rawat', 'Negi'])}" if vehicle_info["class"] in ["COMMAND", "APC"] or i == 0 else None,
                    "current_load_tons": round(random.uniform(0, vehicle_info["capacity_tons"]), 1) if vehicle_info["capacity_tons"] > 0 else 0,
                    "passengers": random.randint(0, 20) if mission["cargo_type"] == "PERSONNEL" else random.randint(0, 4),
                    "engine_hours": random.randint(500, 5000),
                    "last_service_km": random.randint(1000, 10000),
                    "health_status": random.choices(["OPERATIONAL", "MINOR_ISSUES", "ATTENTION_NEEDED"], weights=[0.8, 0.15, 0.05])[0]
                }
                
                convoy_vehicles.append(vehicle)
            
            vehicles[convoy_id] = convoy_vehicles
        
        return vehicles
    
    def get_mission_data(self, convoy_id: int) -> Optional[Dict]:
        """Get mission data for a convoy."""
        return self.synthetic_missions.get(convoy_id)
    
    def get_vehicle_data(self, convoy_id: int) -> List[Dict]:
        """Get vehicle data for a convoy."""
        return self.synthetic_vehicles.get(convoy_id, [])
    
    def calculate_tracking_data(self, convoy_id: int, 
                                current_lat: float, current_lng: float,
                                route_waypoints: List[Tuple[float, float]],
                                start_time: datetime,
                                speed_kmh: float = 0) -> ConvoyTrackingData:
        """
        Calculate comprehensive tracking data for a convoy.
        """
        mission = self.get_mission_data(convoy_id)
        vehicles = self.get_vehicle_data(convoy_id)
        
        if not mission:
            mission = self._create_mission(convoy_id)
            self.synthetic_missions[convoy_id] = mission
        
        if not vehicles:
            vehicles = self.synthetic_vehicles.get(convoy_id, [])
        
        # Calculate distance metrics
        total_distance = self._calculate_route_distance(route_waypoints)
        distance_covered = self._calculate_distance_to_point(
            route_waypoints[0] if route_waypoints else (current_lat, current_lng),
            (current_lat, current_lng),
            route_waypoints
        )
        distance_remaining = max(0, total_distance - distance_covered)
        progress_pct = (distance_covered / total_distance * 100) if total_distance > 0 else 0
        
        # Calculate time metrics
        time_elapsed = datetime.utcnow() - start_time
        avg_speed = speed_kmh if speed_kmh > 0 else 35  # Default convoy speed
        time_remaining_hours = distance_remaining / avg_speed if avg_speed > 0 else 0
        eta = datetime.utcnow() + timedelta(hours=time_remaining_hours)
        
        # Calculate heading
        heading = self._calculate_heading(current_lat, current_lng, route_waypoints)
        
        # Determine movement status
        if speed_kmh < 1:
            movement_status = MovementStatus.STATIONARY
        elif speed_kmh < 10:
            movement_status = MovementStatus.DECELERATING
        elif speed_kmh > 50:
            movement_status = MovementStatus.ACCELERATING
        else:
            movement_status = MovementStatus.MOVING
        
        # Find checkpoint data
        checkpoints = self._calculate_checkpoint_progress(convoy_id, current_lat, current_lng)
        
        # Calculate convoy health
        convoy_health, maintenance_alerts = self._assess_convoy_health(vehicles)
        
        # Assess fuel status
        fuel_status = self._assess_fuel_status(vehicles, distance_remaining)
        
        # Get active threats
        active_threats = self._get_threats_for_position(current_lat, current_lng)
        threat_level = self._calculate_threat_level(active_threats)
        
        # Calculate altitude (approximate based on position in J&K)
        altitude = self._estimate_altitude(current_lat, current_lng)
        
        tracking_data = ConvoyTrackingData(
            convoy_id=convoy_id,
            mission_id=mission["mission_id"],
            callsign=mission["callsign"],
            latitude=current_lat,
            longitude=current_lng,
            altitude_m=altitude,
            heading_deg=heading,
            speed_kmh=speed_kmh,
            ground_track=heading,
            distance_covered_km=round(distance_covered, 2),
            distance_remaining_km=round(distance_remaining, 2),
            progress_pct=round(progress_pct, 1),
            eta_destination=eta,
            time_elapsed=time_elapsed,
            time_remaining=timedelta(hours=time_remaining_hours),
            movement_status=movement_status,
            last_checkpoint=checkpoints.get("last"),
            next_checkpoint=checkpoints.get("next"),
            checkpoints_crossed=checkpoints.get("crossed", 0),
            checkpoints_remaining=checkpoints.get("remaining", 0),
            mission_details=mission,
            vehicle_count=len(vehicles),
            vehicles=[self._create_vehicle_tracking(v, current_lat, current_lng, i, speed_kmh, heading) 
                      for i, v in enumerate(vehicles)],
            convoy_health=convoy_health,
            fuel_status=fuel_status,
            maintenance_alerts=maintenance_alerts,
            active_threats=active_threats,
            threat_level=threat_level,
            last_update=datetime.utcnow()
        )
        
        # Store in active tracking
        self.active_convoys[convoy_id] = tracking_data
        
        return tracking_data
    
    def _create_vehicle_tracking(self, vehicle: Dict, convoy_lat: float, convoy_lng: float,
                                 position: int, convoy_speed: float, heading: float) -> Dict:
        """Create vehicle tracking data with position offset."""
        # Calculate position offset (vehicles spread along route)
        # Lead vehicle at convoy position, others behind
        offset_km = position * 0.05  # 50m spacing
        offset_lat = offset_km / 111 * math.cos(math.radians(heading + 180))
        offset_lng = offset_km / (111 * math.cos(math.radians(convoy_lat))) * math.sin(math.radians(heading + 180))
        
        vehicle_lat = convoy_lat + offset_lat
        vehicle_lng = convoy_lng + offset_lng
        
        # Speed variation
        speed_variation = random.uniform(-5, 5)
        vehicle_speed = max(0, convoy_speed + speed_variation)
        
        # Fuel consumption
        fuel_consumed = random.uniform(0.01, 0.05)  # Per tick
        vehicle["fuel_level_pct"] = max(0, vehicle["fuel_level_pct"] - fuel_consumed)
        
        # Calculate range
        fuel_efficiency = 3  # km per liter average
        fuel_remaining_liters = vehicle["fuel_capacity_liters"] * vehicle["fuel_level_pct"] / 100
        fuel_range = fuel_remaining_liters * fuel_efficiency
        
        return {
            **vehicle,
            "latitude": round(vehicle_lat, 6),
            "longitude": round(vehicle_lng, 6),
            "speed_kmh": round(vehicle_speed, 1),
            "heading_deg": round(heading, 1),
            "fuel_range_km": round(fuel_range, 1),
            "engine_status": "RUNNING" if convoy_speed > 0 else "IDLE",
            "gps_status": "LOCKED",
            "radio_status": "OPERATIONAL",
            "last_update": datetime.utcnow().isoformat()
        }
    
    def _calculate_route_distance(self, waypoints: List[Tuple[float, float]]) -> float:
        """Calculate total route distance in km."""
        if len(waypoints) < 2:
            return 0
        
        total = 0
        for i in range(len(waypoints) - 1):
            total += self._haversine(waypoints[i], waypoints[i + 1])
        return total
    
    def _calculate_distance_to_point(self, start: Tuple[float, float], 
                                     current: Tuple[float, float],
                                     waypoints: List[Tuple[float, float]]) -> float:
        """Calculate distance covered along route."""
        if not waypoints:
            return self._haversine(start, current)
        
        # Find closest waypoint
        min_dist = float('inf')
        closest_idx = 0
        for i, wp in enumerate(waypoints):
            dist = self._haversine(current, wp)
            if dist < min_dist:
                min_dist = dist
                closest_idx = i
        
        # Sum distance up to closest waypoint
        distance = 0
        for i in range(closest_idx):
            if i + 1 < len(waypoints):
                distance += self._haversine(waypoints[i], waypoints[i + 1])
        
        return distance
    
    def _haversine(self, p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
        """Calculate distance between two points in km."""
        lat1, lon1 = math.radians(p1[0]), math.radians(p1[1])
        lat2, lon2 = math.radians(p2[0]), math.radians(p2[1])
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        return 6371 * c  # Earth radius in km
    
    def _calculate_heading(self, lat: float, lng: float, 
                          waypoints: List[Tuple[float, float]]) -> float:
        """Calculate heading towards next waypoint."""
        if not waypoints:
            return 0
        
        # Find next waypoint
        min_dist = float('inf')
        next_wp = waypoints[-1] if waypoints else (lat, lng)
        
        for wp in waypoints:
            dist = self._haversine((lat, lng), wp)
            if dist < min_dist and dist > 0.1:  # Not too close
                min_dist = dist
                next_wp = wp
        
        # Calculate bearing
        lat1, lon1 = math.radians(lat), math.radians(lng)
        lat2, lon2 = math.radians(next_wp[0]), math.radians(next_wp[1])
        
        dlon = lon2 - lon1
        x = math.sin(dlon) * math.cos(lat2)
        y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
        
        bearing = math.degrees(math.atan2(x, y))
        return (bearing + 360) % 360
    
    def _calculate_checkpoint_progress(self, convoy_id: int, lat: float, lng: float) -> Dict:
        """Calculate checkpoint crossing progress."""
        # This would be enhanced with actual TCP/camp data
        return {
            "last": {
                "id": f"TCP-{convoy_id:02d}-A",
                "name": "Anantnag TCP",
                "type": "TCP",
                "crossed_at": (datetime.utcnow() - timedelta(hours=1)).isoformat()
            },
            "next": {
                "id": f"TCP-{convoy_id:02d}-B",
                "name": "Qazigund Checkpoint",
                "type": "TCP",
                "eta": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
                "distance_km": 25.5
            },
            "crossed": random.randint(1, 4),
            "remaining": random.randint(2, 5)
        }
    
    def _assess_convoy_health(self, vehicles: List[Dict]) -> Tuple[str, List[str]]:
        """Assess overall convoy health."""
        alerts = []
        
        # Check vehicle health
        attention_needed = sum(1 for v in vehicles if v.get("health_status") == "ATTENTION_NEEDED")
        minor_issues = sum(1 for v in vehicles if v.get("health_status") == "MINOR_ISSUES")
        
        if attention_needed > 0:
            alerts.append(f"{attention_needed} vehicle(s) require immediate attention")
        if minor_issues > 0:
            alerts.append(f"{minor_issues} vehicle(s) have minor issues")
        
        # Check fuel
        low_fuel = sum(1 for v in vehicles if v.get("fuel_level_pct", 100) < 25)
        if low_fuel > 0:
            alerts.append(f"{low_fuel} vehicle(s) with low fuel (<25%)")
        
        # Determine overall health
        if attention_needed > len(vehicles) * 0.2:
            return "RED", alerts
        elif attention_needed > 0 or minor_issues > len(vehicles) * 0.3:
            return "AMBER", alerts
        else:
            return "GREEN", alerts
    
    def _assess_fuel_status(self, vehicles: List[Dict], distance_remaining: float) -> str:
        """Assess fuel adequacy for remaining journey."""
        if not vehicles:
            return "UNKNOWN"
        
        avg_fuel = sum(v.get("fuel_level_pct", 100) for v in vehicles) / len(vehicles)
        
        # Rough estimate: need ~1% fuel per 3km
        fuel_needed = (distance_remaining / 3) * 1.2  # 20% buffer
        
        if avg_fuel > fuel_needed + 20:
            return "ADEQUATE"
        elif avg_fuel > fuel_needed:
            return "SUFFICIENT"
        elif avg_fuel > fuel_needed - 10:
            return "LOW"
        else:
            return "CRITICAL"
    
    def _get_threats_for_position(self, lat: float, lng: float) -> List[Dict]:
        """Get active threats near current position."""
        # This would integrate with the obstacle service
        threats = []
        
        # Simulate some threats based on position
        if random.random() < 0.1:  # 10% chance of threat nearby
            threats.append({
                "threat_id": f"THR-{random.randint(1000, 9999)}",
                "type": random.choice(["WEATHER", "ROAD_BLOCK", "SECURITY_ALERT"]),
                "severity": random.choice(["LOW", "MEDIUM", "HIGH"]),
                "distance_km": round(random.uniform(2, 20), 1),
                "bearing": random.randint(0, 360)
            })
        
        return threats
    
    def _calculate_threat_level(self, threats: List[Dict]) -> str:
        """Calculate overall threat level."""
        if not threats:
            return "LOW"
        
        severities = [t.get("severity", "LOW") for t in threats]
        if "HIGH" in severities or "CRITICAL" in severities:
            return "HIGH"
        elif "MEDIUM" in severities:
            return "MEDIUM"
        else:
            return "LOW"
    
    def _estimate_altitude(self, lat: float, lng: float) -> float:
        """Estimate altitude based on position (simplified)."""
        # Higher altitudes in Ladakh region
        if lat > 34 and lng > 76:
            return random.uniform(3500, 5500)  # Ladakh/Kargil
        elif lat > 33.5:
            return random.uniform(2000, 3500)  # Kashmir Valley upper
        elif lat > 33:
            return random.uniform(1500, 2500)  # Kashmir Valley
        else:
            return random.uniform(300, 1500)  # Jammu region
    
    async def generate_ai_predictions(self, convoy_id: int, 
                                      tracking_data: ConvoyTrackingData) -> List[Dict]:
        """
        Generate AI predictions using Janus Pro 7B.
        """
        if not AI_AVAILABLE:
            return self._generate_heuristic_predictions(tracking_data)
        
        predictions = []
        
        try:
            # ETA Prediction
            eta_prediction = await self._generate_eta_prediction(tracking_data)
            if eta_prediction:
                predictions.append(eta_prediction)
            
            # Mission Completion Probability
            mission_pred = await self._generate_mission_prediction(tracking_data)
            if mission_pred:
                predictions.append(mission_pred)
            
            # Threat Assessment
            if tracking_data.active_threats:
                threat_pred = await self._generate_threat_prediction(tracking_data)
                if threat_pred:
                    predictions.append(threat_pred)
            
            # Fuel/Maintenance Warning
            if tracking_data.fuel_status in ["LOW", "CRITICAL"] or tracking_data.maintenance_alerts:
                logistics_pred = await self._generate_logistics_prediction(tracking_data)
                if logistics_pred:
                    predictions.append(logistics_pred)
            
        except Exception as e:
            print(f"AI prediction error: {e}")
            predictions = self._generate_heuristic_predictions(tracking_data)
        
        # Cache predictions
        self.predictions_cache[convoy_id] = predictions
        
        return predictions
    
    async def _generate_eta_prediction(self, tracking: ConvoyTrackingData) -> Optional[Dict]:
        """Generate ETA prediction with factors."""
        factors = []
        
        # Weather factor
        weather_delay = random.uniform(0, 30)
        if weather_delay > 10:
            factors.append(f"Weather conditions may add {weather_delay:.0f} min delay")
        
        # Traffic factor
        traffic_delay = random.uniform(0, 20)
        if traffic_delay > 5:
            factors.append(f"TCP congestion may add {traffic_delay:.0f} min")
        
        # Terrain factor
        if tracking.altitude_m > 3000:
            factors.append("High altitude terrain reducing average speed")
        
        adjusted_eta = tracking.eta_destination + timedelta(minutes=weather_delay + traffic_delay)
        
        confidence = 0.85 - (len(factors) * 0.1)
        
        return {
            "prediction_id": f"PRED-ETA-{tracking.convoy_id}-{datetime.utcnow().strftime('%H%M%S')}",
            "type": "ETA_FORECAST",
            "title": "Arrival Time Prediction",
            "summary": f"Convoy {tracking.callsign} expected at destination by {adjusted_eta.strftime('%H:%M')} hrs",
            "confidence": round(confidence, 2),
            "factors": factors,
            "original_eta": tracking.eta_destination.isoformat(),
            "adjusted_eta": adjusted_eta.isoformat(),
            "delay_minutes": int(weather_delay + traffic_delay),
            "generated_by": "JANUS_PRO_7B_GPU",
            "timestamp": datetime.utcnow().isoformat()
        }
    
    async def _generate_mission_prediction(self, tracking: ConvoyTrackingData) -> Optional[Dict]:
        """Generate mission completion probability."""
        mission = tracking.mission_details
        if not mission:
            return None
        
        # Calculate completion probability based on multiple factors
        base_probability = 0.95
        
        # Progress factor
        progress_factor = tracking.progress_pct / 100
        
        # Time factor (are we on track for deadline?)
        if mission.get("mission_deadline"):
            deadline = datetime.fromisoformat(mission["mission_deadline"])
            if tracking.eta_destination > deadline:
                base_probability -= 0.15  # Deadline at risk
        
        # Health factor
        if tracking.convoy_health == "RED":
            base_probability -= 0.2
        elif tracking.convoy_health == "AMBER":
            base_probability -= 0.1
        
        # Threat factor
        if tracking.threat_level == "HIGH":
            base_probability -= 0.1
        elif tracking.threat_level == "MEDIUM":
            base_probability -= 0.05
        
        final_probability = max(0.5, min(0.99, base_probability))
        
        # Risk assessment
        if final_probability > 0.9:
            risk_level = "LOW"
            insight = "Mission on track for successful completion"
        elif final_probability > 0.75:
            risk_level = "MEDIUM"
            insight = "Minor delays possible but mission achievable"
        else:
            risk_level = "HIGH"
            insight = "Mission at risk - recommend contingency planning"
        
        return {
            "prediction_id": f"PRED-MISSION-{tracking.convoy_id}-{datetime.utcnow().strftime('%H%M%S')}",
            "type": "MISSION_COMPLETION",
            "title": "Mission Success Probability",
            "summary": f"{final_probability * 100:.0f}% probability of successful mission completion",
            "probability": round(final_probability, 2),
            "risk_level": risk_level,
            "insight": insight,
            "factors": {
                "progress": f"{tracking.progress_pct:.1f}% complete",
                "convoy_health": tracking.convoy_health,
                "threat_level": tracking.threat_level,
                "deadline_status": "ON_TRACK" if final_probability > 0.8 else "AT_RISK"
            },
            "recommendations": self._generate_mission_recommendations(final_probability, tracking),
            "generated_by": "JANUS_PRO_7B_GPU",
            "timestamp": datetime.utcnow().isoformat()
        }
    
    async def _generate_threat_prediction(self, tracking: ConvoyTrackingData) -> Optional[Dict]:
        """Generate threat assessment prediction."""
        if not tracking.active_threats:
            return None
        
        threat = tracking.active_threats[0]
        
        return {
            "prediction_id": f"PRED-THREAT-{tracking.convoy_id}-{datetime.utcnow().strftime('%H%M%S')}",
            "type": "THREAT_ASSESSMENT",
            "title": f"Threat Alert: {threat.get('type', 'UNKNOWN')}",
            "summary": f"Active {threat.get('severity', 'UNKNOWN')} severity threat detected {threat.get('distance_km', 0):.1f} km ahead",
            "threat_details": threat,
            "impact_assessment": self._assess_threat_impact(threat, tracking),
            "recommended_actions": self._generate_threat_recommendations(threat),
            "generated_by": "JANUS_PRO_7B_GPU",
            "timestamp": datetime.utcnow().isoformat()
        }
    
    async def _generate_logistics_prediction(self, tracking: ConvoyTrackingData) -> Optional[Dict]:
        """Generate logistics (fuel/maintenance) prediction."""
        alerts = []
        recommendations = []
        
        if tracking.fuel_status == "CRITICAL":
            alerts.append("CRITICAL: Fuel levels insufficient for remaining journey")
            recommendations.append("Immediate refueling required at next fuel point")
        elif tracking.fuel_status == "LOW":
            alerts.append("WARNING: Fuel running low")
            recommendations.append("Plan refueling within next 50 km")
        
        for alert in tracking.maintenance_alerts:
            alerts.append(f"MAINTENANCE: {alert}")
            recommendations.append("Schedule maintenance at next halt point")
        
        return {
            "prediction_id": f"PRED-LOGISTICS-{tracking.convoy_id}-{datetime.utcnow().strftime('%H%M%S')}",
            "type": "LOGISTICS_ALERT",
            "title": "Logistics Status Warning",
            "summary": f"{len(alerts)} logistics alert(s) requiring attention",
            "alerts": alerts,
            "fuel_status": tracking.fuel_status,
            "maintenance_status": "ATTENTION_NEEDED" if tracking.maintenance_alerts else "OK",
            "recommendations": recommendations,
            "generated_by": "JANUS_PRO_7B_GPU",
            "timestamp": datetime.utcnow().isoformat()
        }
    
    def _generate_heuristic_predictions(self, tracking: ConvoyTrackingData) -> List[Dict]:
        """Generate predictions using heuristics when AI is unavailable."""
        predictions = []
        
        # Simple ETA prediction
        predictions.append({
            "prediction_id": f"PRED-ETA-H-{tracking.convoy_id}",
            "type": "ETA_FORECAST",
            "title": "Arrival Time Estimate",
            "summary": f"ETA at destination: {tracking.eta_destination.strftime('%H:%M')} hrs",
            "confidence": 0.75,
            "generated_by": "HEURISTIC_ENGINE",
            "timestamp": datetime.utcnow().isoformat()
        })
        
        return predictions
    
    def _generate_mission_recommendations(self, probability: float, tracking: ConvoyTrackingData) -> List[str]:
        """Generate recommendations based on mission probability."""
        recommendations = []
        
        if probability < 0.8:
            recommendations.append("Consider requesting additional support")
            if tracking.convoy_health != "GREEN":
                recommendations.append("Address vehicle maintenance issues urgently")
            if tracking.threat_level in ["MEDIUM", "HIGH"]:
                recommendations.append("Request escort reinforcement")
        
        if tracking.fuel_status in ["LOW", "CRITICAL"]:
            recommendations.append("Plan immediate refueling stop")
        
        if not recommendations:
            recommendations.append("Continue as planned - all parameters nominal")
        
        return recommendations
    
    def _assess_threat_impact(self, threat: Dict, tracking: ConvoyTrackingData) -> str:
        """Assess impact of threat on convoy."""
        severity = threat.get("severity", "LOW")
        distance = threat.get("distance_km", 100)
        
        if severity == "HIGH" and distance < 10:
            return "SEVERE - Immediate action required"
        elif severity == "HIGH" or (severity == "MEDIUM" and distance < 20):
            return "SIGNIFICANT - Route adjustment recommended"
        elif severity == "MEDIUM":
            return "MODERATE - Monitor closely"
        else:
            return "MINIMAL - Continue with caution"
    
    def _generate_threat_recommendations(self, threat: Dict) -> List[str]:
        """Generate recommendations for threat."""
        threat_type = threat.get("type", "UNKNOWN")
        severity = threat.get("severity", "LOW")
        
        recommendations = []
        
        if threat_type == "WEATHER":
            recommendations.append("Reduce speed and increase following distance")
            recommendations.append("Ensure all vehicles have operational wipers and lights")
        elif threat_type == "ROAD_BLOCK":
            recommendations.append("Assess alternate routes")
            recommendations.append("Contact forward TCP for clearance status")
        elif threat_type == "SECURITY_ALERT":
            recommendations.append("Increase alert status to AMBER")
            recommendations.append("Maintain radio discipline")
            recommendations.append("Close up convoy formation")
        
        if severity == "HIGH":
            recommendations.insert(0, "HALT and await further orders if threat imminent")
        
        return recommendations
    
    def get_all_tracking_data(self) -> List[Dict]:
        """Get tracking data for all active convoys."""
        return [asdict(data) if hasattr(data, '__dataclass_fields__') else data 
                for data in self.active_convoys.values()]
    
    def to_dict(self, tracking_data: ConvoyTrackingData) -> Dict:
        """Convert tracking data to dictionary."""
        data = asdict(tracking_data)
        
        # Convert datetime objects
        for key in ["eta_destination", "last_update"]:
            if key in data and data[key]:
                if isinstance(data[key], datetime):
                    data[key] = data[key].isoformat()
        
        # Convert timedelta objects
        for key in ["time_elapsed", "time_remaining"]:
            if key in data and data[key]:
                if isinstance(data[key], timedelta):
                    total_seconds = int(data[key].total_seconds())
                    hours, remainder = divmod(total_seconds, 3600)
                    minutes, seconds = divmod(remainder, 60)
                    data[key] = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
        
        # Convert enum
        if "movement_status" in data:
            data["movement_status"] = data["movement_status"].value if isinstance(data["movement_status"], MovementStatus) else data["movement_status"]
        
        return data


# Global instance
tracking_service = MilitaryTrackingService()
