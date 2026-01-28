"""
Military Assets API Endpoints
Comprehensive CRUD operations for military installations, facilities, and strategic assets.
Includes AI prediction integration and real-time status updates.
Database-integrated with Janus AI analysis.
"""
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime, timedelta
from enum import Enum
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
import random
import uuid

from app.core.database import get_db
from app.models.military_asset import MilitaryAsset as MilitaryAssetModel
from app.services.janus_ai_service import JanusAIService

router = APIRouter()
janus_ai = JanusAIService()


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class ClassificationLevel(str, Enum):
    TOP_SECRET = "TOP_SECRET"
    SECRET = "SECRET"
    CONFIDENTIAL = "CONFIDENTIAL"
    RESTRICTED = "RESTRICTED"
    UNCLASSIFIED = "UNCLASSIFIED"


class AssetCategory(str, Enum):
    COMMAND_CONTROL = "COMMAND_CONTROL"
    LOGISTICS_SUPPLY = "LOGISTICS_SUPPLY"
    COMBAT_SUPPORT = "COMBAT_SUPPORT"
    MEDICAL = "MEDICAL"
    COMMUNICATIONS = "COMMUNICATIONS"
    INTELLIGENCE = "INTELLIGENCE"
    ENGINEERING = "ENGINEERING"
    AVIATION = "AVIATION"
    SECURITY = "SECURITY"
    INFRASTRUCTURE = "INFRASTRUCTURE"


class AssetType(str, Enum):
    HEADQUARTERS = "HEADQUARTERS"
    COMMAND_POST = "COMMAND_POST"
    TACTICAL_OPS_CENTER = "TACTICAL_OPS_CENTER"
    FORWARD_OPERATING_BASE = "FORWARD_OPERATING_BASE"
    BASE_CAMP = "BASE_CAMP"
    PATROL_BASE = "PATROL_BASE"
    TRANSIT_CAMP = "TRANSIT_CAMP"
    STAGING_AREA = "STAGING_AREA"
    TRAFFIC_CONTROL_POINT = "TRAFFIC_CONTROL_POINT"
    VEHICLE_CHECKPOINT = "VEHICLE_CHECKPOINT"
    ENTRY_CONTROL_POINT = "ENTRY_CONTROL_POINT"
    OBSERVATION_POST = "OBSERVATION_POST"
    LISTENING_POST = "LISTENING_POST"
    AMMUNITION_DEPOT = "AMMUNITION_DEPOT"
    FUEL_POINT = "FUEL_POINT"
    SUPPLY_DEPOT = "SUPPLY_DEPOT"
    RATION_POINT = "RATION_POINT"
    VEHICLE_PARK = "VEHICLE_PARK"
    MAINTENANCE_BAY = "MAINTENANCE_BAY"
    FIELD_HOSPITAL = "FIELD_HOSPITAL"
    AID_STATION = "AID_STATION"
    MEDICAL_SUPPLY_POINT = "MEDICAL_SUPPLY_POINT"
    CASUALTY_COLLECTION_POINT = "CASUALTY_COLLECTION_POINT"
    SIGNAL_CENTER = "SIGNAL_CENTER"
    RELAY_STATION = "RELAY_STATION"
    SATELLITE_GROUND_STATION = "SATELLITE_GROUND_STATION"
    RADIO_TOWER = "RADIO_TOWER"
    HELIPAD = "HELIPAD"
    FORWARD_ARMING_REFUEL_POINT = "FORWARD_ARMING_REFUEL_POINT"
    AIRFIELD = "AIRFIELD"
    WATER_POINT = "WATER_POINT"
    POWER_GENERATOR = "POWER_GENERATOR"
    BRIDGE = "BRIDGE"
    TUNNEL = "TUNNEL"


class OperationalStatus(str, Enum):
    FULLY_OPERATIONAL = "FULLY_OPERATIONAL"
    OPERATIONAL = "OPERATIONAL"
    LIMITED_OPERATIONS = "LIMITED_OPERATIONS"
    DEGRADED = "DEGRADED"
    NON_OPERATIONAL = "NON_OPERATIONAL"
    UNDER_CONSTRUCTION = "UNDER_CONSTRUCTION"
    ABANDONED = "ABANDONED"


class ThreatLevel(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    ELEVATED = "ELEVATED"
    MODERATE = "MODERATE"
    LOW = "LOW"


class MilitaryAssetBase(BaseModel):
    asset_id: str
    name: str
    callsign: Optional[str] = None
    code_name: Optional[str] = None
    classification: ClassificationLevel = ClassificationLevel.RESTRICTED
    category: AssetCategory
    asset_type: AssetType
    latitude: float
    longitude: float
    altitude_meters: Optional[float] = None
    grid_reference: Optional[str] = None
    location_description: Optional[str] = None
    parent_unit_id: Optional[str] = None
    parent_unit_name: Optional[str] = None
    commanding_officer: Optional[str] = None
    contact_frequency: Optional[str] = None
    status: OperationalStatus = OperationalStatus.OPERATIONAL
    threat_level: ThreatLevel = ThreatLevel.MODERATE


class MilitaryAssetCreate(MilitaryAssetBase):
    pass


class MilitaryAssetResponse(MilitaryAssetBase):
    id: int
    personnel_capacity: int = 0
    current_personnel: int = 0
    vehicle_capacity: int = 0
    current_vehicles: int = 0
    fuel_availability: float = 100.0
    ammo_availability: float = 100.0
    rations_availability: float = 100.0
    water_availability: float = 100.0
    medical_supplies: float = 100.0
    perimeter_security: str = "STANDARD"
    guard_force_size: int = 0
    has_helipad: bool = False
    has_medical: bool = False
    has_communications: bool = True
    has_power_backup: bool = False
    has_ammunition_storage: bool = False
    has_fuel_storage: bool = False
    ai_threat_score: float = 0.0
    ai_risk_factors: List[str] = []
    ai_recommendations: List[str] = []
    ai_last_analysis: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AssetPredictionResponse(BaseModel):
    prediction_id: str
    asset_id: str
    prediction_type: str
    title: str
    summary: str
    confidence: float
    probability: Optional[float] = None
    risk_level: str
    recommendations: List[str] = []
    action_required: bool = False
    priority: str = "ROUTINE"
    generated_by: str = "JANUS-AI"
    valid_from: datetime
    valid_until: Optional[datetime] = None


class AssetIncidentResponse(BaseModel):
    incident_id: str
    asset_id: str
    incident_type: str
    severity: str
    title: str
    description: str
    occurred_at: datetime
    resolved_at: Optional[datetime] = None
    casualties: int = 0
    damage_assessment: str = "NONE"


# ============================================================================
# IN-MEMORY DATA STORE (simulating database)
# ============================================================================

# Kashmir/Ladakh region coordinates for military context
SAMPLE_ASSETS = [
    # Command & Control
    {
        "id": 1,
        "asset_id": "HQ-NORTH-001",
        "name": "Northern Command Headquarters",
        "callsign": "THUNDER-MAIN",
        "code_name": "IRON CITADEL",
        "classification": "SECRET",
        "category": "COMMAND_CONTROL",
        "asset_type": "HEADQUARTERS",
        "latitude": 34.0837,
        "longitude": 74.7973,
        "altitude_meters": 1640,
        "grid_reference": "43SFV1234567890",
        "location_description": "Badami Bagh Cantonment, Srinagar",
        "parent_unit_id": "ARMY-HQ",
        "parent_unit_name": "Indian Army HQ",
        "commanding_officer": "Lt Gen RP Singh",
        "contact_frequency": "HF-4521",
        "status": "FULLY_OPERATIONAL",
        "threat_level": "MODERATE",
        "personnel_capacity": 500,
        "current_personnel": 423,
        "vehicle_capacity": 100,
        "current_vehicles": 78,
        "fuel_availability": 95.0,
        "ammo_availability": 88.0,
        "rations_availability": 92.0,
        "water_availability": 100.0,
        "medical_supplies": 85.0,
        "perimeter_security": "MAXIMUM",
        "guard_force_size": 120,
        "has_helipad": True,
        "has_medical": True,
        "has_communications": True,
        "has_power_backup": True,
        "has_ammunition_storage": True,
        "has_fuel_storage": True,
        "ai_threat_score": 35.0,
        "ai_risk_factors": ["High value target", "Urban proximity", "Historical attacks"],
        "ai_recommendations": ["Maintain DEFCON 3", "Increase night patrols", "Monitor social media chatter"],
        "ai_last_analysis": datetime.utcnow() - timedelta(hours=2),
        "created_at": datetime.utcnow() - timedelta(days=365),
        "updated_at": datetime.utcnow() - timedelta(hours=1)
    },
    {
        "id": 2,
        "asset_id": "FOB-KARGIL-001",
        "name": "Forward Operating Base Kargil",
        "callsign": "EAGLE-NEST",
        "code_name": "POINT VICTOR",
        "classification": "CONFIDENTIAL",
        "category": "COMBAT_SUPPORT",
        "asset_type": "FORWARD_OPERATING_BASE",
        "latitude": 34.5539,
        "longitude": 76.1349,
        "altitude_meters": 2676,
        "grid_reference": "43SFW9876543210",
        "location_description": "Kargil Town, Near LOC",
        "parent_unit_id": "14-CORPS",
        "parent_unit_name": "14 Corps (Fire & Fury)",
        "commanding_officer": "Brig AK Sharma",
        "contact_frequency": "VHF-7823",
        "status": "OPERATIONAL",
        "threat_level": "HIGH",
        "personnel_capacity": 300,
        "current_personnel": 287,
        "vehicle_capacity": 80,
        "current_vehicles": 65,
        "fuel_availability": 72.0,
        "ammo_availability": 95.0,
        "rations_availability": 68.0,
        "water_availability": 85.0,
        "medical_supplies": 78.0,
        "perimeter_security": "ENHANCED",
        "guard_force_size": 60,
        "has_helipad": True,
        "has_medical": True,
        "has_communications": True,
        "has_power_backup": True,
        "has_ammunition_storage": True,
        "has_fuel_storage": True,
        "ai_threat_score": 72.0,
        "ai_risk_factors": ["LOC proximity", "Artillery range", "Infiltration corridor", "Winter isolation risk"],
        "ai_recommendations": ["Increase ISR coverage", "Pre-position winter supplies", "Reinforce bunkers", "Coordinate with Air Defense"],
        "ai_last_analysis": datetime.utcnow() - timedelta(minutes=30),
        "created_at": datetime.utcnow() - timedelta(days=180),
        "updated_at": datetime.utcnow() - timedelta(minutes=15)
    },
    {
        "id": 3,
        "asset_id": "TCP-ZOJILA-001",
        "name": "Zoji La Traffic Control Point",
        "callsign": "GATE-KEEPER-1",
        "code_name": None,
        "classification": "RESTRICTED",
        "category": "SECURITY",
        "asset_type": "TRAFFIC_CONTROL_POINT",
        "latitude": 34.2847,
        "longitude": 75.4865,
        "altitude_meters": 3528,
        "grid_reference": "43SFV5555666677",
        "location_description": "Zoji La Pass, Strategic Chokepoint",
        "parent_unit_id": "8-MTN-DIV",
        "parent_unit_name": "8 Mountain Division",
        "commanding_officer": "Maj SS Rathore",
        "contact_frequency": "VHF-3344",
        "status": "OPERATIONAL",
        "threat_level": "ELEVATED",
        "personnel_capacity": 40,
        "current_personnel": 35,
        "vehicle_capacity": 10,
        "current_vehicles": 8,
        "fuel_availability": 60.0,
        "ammo_availability": 90.0,
        "rations_availability": 75.0,
        "water_availability": 95.0,
        "medical_supplies": 45.0,
        "perimeter_security": "ENHANCED",
        "guard_force_size": 20,
        "has_helipad": False,
        "has_medical": False,
        "has_communications": True,
        "has_power_backup": True,
        "has_ammunition_storage": True,
        "has_fuel_storage": False,
        "ai_threat_score": 55.0,
        "ai_risk_factors": ["High altitude", "Weather vulnerability", "Single access route", "Avalanche zone"],
        "ai_recommendations": ["Monitor weather closely", "Maintain snow clearance equipment", "Coordinate with BRO", "Emergency evacuation plan ready"],
        "ai_last_analysis": datetime.utcnow() - timedelta(hours=1),
        "created_at": datetime.utcnow() - timedelta(days=90),
        "updated_at": datetime.utcnow() - timedelta(hours=2)
    },
    {
        "id": 4,
        "asset_id": "DEPOT-LEH-001",
        "name": "Leh Ammunition Depot",
        "callsign": "ARSENAL-ALPHA",
        "code_name": "POWDER KEG",
        "classification": "SECRET",
        "category": "LOGISTICS_SUPPLY",
        "asset_type": "AMMUNITION_DEPOT",
        "latitude": 34.1526,
        "longitude": 77.5771,
        "altitude_meters": 3500,
        "grid_reference": "43SGX1234509876",
        "location_description": "Leh Military Station, Secure Zone",
        "parent_unit_id": "14-CORPS",
        "parent_unit_name": "14 Corps Logistics",
        "commanding_officer": "Col MK Reddy",
        "contact_frequency": "HF-9012",
        "status": "FULLY_OPERATIONAL",
        "threat_level": "HIGH",
        "personnel_capacity": 100,
        "current_personnel": 82,
        "vehicle_capacity": 30,
        "current_vehicles": 24,
        "fuel_availability": 45.0,
        "ammo_availability": 100.0,
        "rations_availability": 80.0,
        "water_availability": 90.0,
        "medical_supplies": 70.0,
        "perimeter_security": "MAXIMUM",
        "guard_force_size": 50,
        "has_helipad": True,
        "has_medical": False,
        "has_communications": True,
        "has_power_backup": True,
        "has_ammunition_storage": True,
        "has_fuel_storage": True,
        "ai_threat_score": 68.0,
        "ai_risk_factors": ["High value target", "Sabotage risk", "Fire hazard", "Access control critical"],
        "ai_recommendations": ["24/7 CCTV monitoring", "Regular inventory audits", "Fire suppression ready", "Limit access to authorized only"],
        "ai_last_analysis": datetime.utcnow() - timedelta(hours=4),
        "created_at": datetime.utcnow() - timedelta(days=400),
        "updated_at": datetime.utcnow() - timedelta(hours=6)
    },
    {
        "id": 5,
        "asset_id": "MED-SRINAGAR-001",
        "name": "92 Base Hospital",
        "callsign": "MEDIC-MAIN",
        "code_name": None,
        "classification": "UNCLASSIFIED",
        "category": "MEDICAL",
        "asset_type": "FIELD_HOSPITAL",
        "latitude": 34.0901,
        "longitude": 74.7942,
        "altitude_meters": 1585,
        "grid_reference": "43SFV2222333344",
        "location_description": "Srinagar Cantonment",
        "parent_unit_id": "NORTH-CMD-MED",
        "parent_unit_name": "Northern Command Medical Services",
        "commanding_officer": "Brig (Dr) S Mehta",
        "contact_frequency": "VHF-1122",
        "status": "FULLY_OPERATIONAL",
        "threat_level": "LOW",
        "personnel_capacity": 200,
        "current_personnel": 175,
        "vehicle_capacity": 50,
        "current_vehicles": 42,
        "fuel_availability": 85.0,
        "ammo_availability": 0.0,
        "rations_availability": 95.0,
        "water_availability": 100.0,
        "medical_supplies": 92.0,
        "perimeter_security": "STANDARD",
        "guard_force_size": 15,
        "has_helipad": True,
        "has_medical": True,
        "has_communications": True,
        "has_power_backup": True,
        "has_ammunition_storage": False,
        "has_fuel_storage": True,
        "ai_threat_score": 15.0,
        "ai_risk_factors": ["Medical supply chain dependency", "Mass casualty surge capacity"],
        "ai_recommendations": ["Maintain blood bank stocks", "Pre-position trauma kits", "Regular drills for mass casualty"],
        "ai_last_analysis": datetime.utcnow() - timedelta(hours=8),
        "created_at": datetime.utcnow() - timedelta(days=500),
        "updated_at": datetime.utcnow() - timedelta(hours=12)
    },
    {
        "id": 6,
        "asset_id": "OP-TIGER-001",
        "name": "Observation Post Tiger Hill",
        "callsign": "TIGER-EYE",
        "code_name": "SILENT WATCH",
        "classification": "SECRET",
        "category": "INTELLIGENCE",
        "asset_type": "OBSERVATION_POST",
        "latitude": 34.5225,
        "longitude": 76.2189,
        "altitude_meters": 5062,
        "grid_reference": "43SFW8888777766",
        "location_description": "Tiger Hill, Drass Sector",
        "parent_unit_id": "8-MTN-DIV",
        "parent_unit_name": "8 Mountain Division",
        "commanding_officer": "Capt R Kumar",
        "contact_frequency": "VHF-5566",
        "status": "OPERATIONAL",
        "threat_level": "HIGH",
        "personnel_capacity": 15,
        "current_personnel": 12,
        "vehicle_capacity": 2,
        "current_vehicles": 0,
        "fuel_availability": 40.0,
        "ammo_availability": 95.0,
        "rations_availability": 50.0,
        "water_availability": 30.0,
        "medical_supplies": 60.0,
        "perimeter_security": "ENHANCED",
        "guard_force_size": 12,
        "has_helipad": False,
        "has_medical": False,
        "has_communications": True,
        "has_power_backup": True,
        "has_ammunition_storage": True,
        "has_fuel_storage": False,
        "ai_threat_score": 78.0,
        "ai_risk_factors": ["Extreme altitude", "Direct fire exposure", "Resupply challenges", "Weather isolation"],
        "ai_recommendations": ["Priority resupply scheduling", "Oxygen equipment check", "Cold weather injury prevention", "Rotate personnel frequently"],
        "ai_last_analysis": datetime.utcnow() - timedelta(minutes=45),
        "created_at": datetime.utcnow() - timedelta(days=120),
        "updated_at": datetime.utcnow() - timedelta(minutes=30)
    },
    {
        "id": 7,
        "asset_id": "FUEL-UDHAMPUR-001",
        "name": "Udhampur Fuel Point",
        "callsign": "PETROL-DELTA",
        "code_name": None,
        "classification": "RESTRICTED",
        "category": "LOGISTICS_SUPPLY",
        "asset_type": "FUEL_POINT",
        "latitude": 32.9244,
        "longitude": 75.1415,
        "altitude_meters": 756,
        "grid_reference": "43SFT4444555566",
        "location_description": "Udhampur Military Station",
        "parent_unit_id": "NORTH-CMD-LOG",
        "parent_unit_name": "Northern Command Logistics",
        "commanding_officer": "Maj P Singh",
        "contact_frequency": "VHF-7788",
        "status": "OPERATIONAL",
        "threat_level": "MODERATE",
        "personnel_capacity": 50,
        "current_personnel": 38,
        "vehicle_capacity": 20,
        "current_vehicles": 15,
        "fuel_availability": 78.0,
        "ammo_availability": 0.0,
        "rations_availability": 70.0,
        "water_availability": 100.0,
        "medical_supplies": 40.0,
        "perimeter_security": "STANDARD",
        "guard_force_size": 10,
        "has_helipad": False,
        "has_medical": False,
        "has_communications": True,
        "has_power_backup": True,
        "has_ammunition_storage": False,
        "has_fuel_storage": True,
        "ai_threat_score": 42.0,
        "ai_risk_factors": ["Fire/explosion hazard", "Supply chain critical", "Tanker movement tracking"],
        "ai_recommendations": ["Maintain fire safety protocols", "Track all fuel movements", "Regular tank inspection", "Emergency spill containment"],
        "ai_last_analysis": datetime.utcnow() - timedelta(hours=3),
        "created_at": datetime.utcnow() - timedelta(days=200),
        "updated_at": datetime.utcnow() - timedelta(hours=5)
    },
    {
        "id": 8,
        "asset_id": "HELIPAD-SIACHEN-001",
        "name": "Siachen Base Camp Helipad",
        "callsign": "GLACIER-PAD",
        "code_name": "ICE STATION",
        "classification": "SECRET",
        "category": "AVIATION",
        "asset_type": "HELIPAD",
        "latitude": 35.4213,
        "longitude": 77.1098,
        "altitude_meters": 5400,
        "grid_reference": "43SGY9999888877",
        "location_description": "Siachen Glacier Base Camp",
        "parent_unit_id": "SIACHEN-BDE",
        "parent_unit_name": "Siachen Brigade",
        "commanding_officer": "Sqn Ldr V Chopra",
        "contact_frequency": "UHF-2233",
        "status": "LIMITED_OPERATIONS",
        "threat_level": "ELEVATED",
        "personnel_capacity": 30,
        "current_personnel": 18,
        "vehicle_capacity": 5,
        "current_vehicles": 2,
        "fuel_availability": 55.0,
        "ammo_availability": 70.0,
        "rations_availability": 45.0,
        "water_availability": 100.0,
        "medical_supplies": 80.0,
        "perimeter_security": "ENHANCED",
        "guard_force_size": 8,
        "has_helipad": True,
        "has_medical": True,
        "has_communications": True,
        "has_power_backup": True,
        "has_ammunition_storage": True,
        "has_fuel_storage": True,
        "ai_threat_score": 65.0,
        "ai_risk_factors": ["Extreme weather", "Limited flight windows", "Altitude sickness", "Crevasse hazards"],
        "ai_recommendations": ["Weather window monitoring 24/7", "Emergency evacuation protocols", "Altitude acclimatization", "Regular health checks"],
        "ai_last_analysis": datetime.utcnow() - timedelta(minutes=20),
        "created_at": datetime.utcnow() - timedelta(days=60),
        "updated_at": datetime.utcnow() - timedelta(minutes=10)
    },
    {
        "id": 9,
        "asset_id": "SIGNAL-DRASS-001",
        "name": "Drass Signal Relay Station",
        "callsign": "ECHO-RELAY-1",
        "code_name": None,
        "classification": "CONFIDENTIAL",
        "category": "COMMUNICATIONS",
        "asset_type": "RELAY_STATION",
        "latitude": 34.4330,
        "longitude": 75.7610,
        "altitude_meters": 3230,
        "grid_reference": "43SFW7777666655",
        "location_description": "Drass Valley, Signal Hill",
        "parent_unit_id": "SIGNAL-REGT",
        "parent_unit_name": "14 Corps Signal Regiment",
        "commanding_officer": "Capt N Mishra",
        "contact_frequency": "HF-4455",
        "status": "OPERATIONAL",
        "threat_level": "MODERATE",
        "personnel_capacity": 25,
        "current_personnel": 20,
        "vehicle_capacity": 8,
        "current_vehicles": 6,
        "fuel_availability": 65.0,
        "ammo_availability": 50.0,
        "rations_availability": 60.0,
        "water_availability": 80.0,
        "medical_supplies": 55.0,
        "perimeter_security": "STANDARD",
        "guard_force_size": 8,
        "has_helipad": False,
        "has_medical": False,
        "has_communications": True,
        "has_power_backup": True,
        "has_ammunition_storage": True,
        "has_fuel_storage": True,
        "ai_threat_score": 48.0,
        "ai_risk_factors": ["EW threat", "Equipment sensitivity", "Single point of failure"],
        "ai_recommendations": ["EMI shielding maintenance", "Redundant link verification", "Regular frequency hopping", "Equipment temp monitoring"],
        "ai_last_analysis": datetime.utcnow() - timedelta(hours=2),
        "created_at": datetime.utcnow() - timedelta(days=150),
        "updated_at": datetime.utcnow() - timedelta(hours=3)
    },
    {
        "id": 10,
        "asset_id": "VCP-URI-001",
        "name": "Uri Vehicle Checkpoint",
        "callsign": "GATE-KEEPER-2",
        "code_name": None,
        "classification": "RESTRICTED",
        "category": "SECURITY",
        "asset_type": "VEHICLE_CHECKPOINT",
        "latitude": 34.0800,
        "longitude": 74.0500,
        "altitude_meters": 1524,
        "grid_reference": "43SFU3333444455",
        "location_description": "Uri Sector, Near LOC",
        "parent_unit_id": "19-INF-DIV",
        "parent_unit_name": "19 Infantry Division",
        "commanding_officer": "Maj H Khan",
        "contact_frequency": "VHF-6677",
        "status": "OPERATIONAL",
        "threat_level": "HIGH",
        "personnel_capacity": 35,
        "current_personnel": 32,
        "vehicle_capacity": 8,
        "current_vehicles": 6,
        "fuel_availability": 50.0,
        "ammo_availability": 85.0,
        "rations_availability": 70.0,
        "water_availability": 75.0,
        "medical_supplies": 60.0,
        "perimeter_security": "ENHANCED",
        "guard_force_size": 25,
        "has_helipad": False,
        "has_medical": False,
        "has_communications": True,
        "has_power_backup": True,
        "has_ammunition_storage": True,
        "has_fuel_storage": False,
        "ai_threat_score": 75.0,
        "ai_risk_factors": ["LOC proximity", "Infiltration route", "IED threat", "Ambush vulnerable"],
        "ai_recommendations": ["Enhanced vehicle checks", "Random search patterns", "Night vision equipment", "Quick reaction team standby"],
        "ai_last_analysis": datetime.utcnow() - timedelta(minutes=15),
        "created_at": datetime.utcnow() - timedelta(days=100),
        "updated_at": datetime.utcnow() - timedelta(minutes=5)
    },
    {
        "id": 11,
        "asset_id": "CAMP-PATTAN-001",
        "name": "Pattan Transit Camp",
        "callsign": "REST-STOP-ALPHA",
        "code_name": None,
        "classification": "UNCLASSIFIED",
        "category": "LOGISTICS_SUPPLY",
        "asset_type": "TRANSIT_CAMP",
        "latitude": 34.1605,
        "longitude": 74.5527,
        "altitude_meters": 1560,
        "grid_reference": "43SFV1111222233",
        "location_description": "Pattan, Baramulla District",
        "parent_unit_id": "15-CORPS-LOG",
        "parent_unit_name": "15 Corps Logistics",
        "commanding_officer": "Capt S Nair",
        "contact_frequency": "VHF-8899",
        "status": "OPERATIONAL",
        "threat_level": "MODERATE",
        "personnel_capacity": 150,
        "current_personnel": 45,
        "vehicle_capacity": 60,
        "current_vehicles": 22,
        "fuel_availability": 80.0,
        "ammo_availability": 30.0,
        "rations_availability": 85.0,
        "water_availability": 90.0,
        "medical_supplies": 50.0,
        "perimeter_security": "STANDARD",
        "guard_force_size": 12,
        "has_helipad": False,
        "has_medical": False,
        "has_communications": True,
        "has_power_backup": True,
        "has_ammunition_storage": False,
        "has_fuel_storage": True,
        "ai_threat_score": 38.0,
        "ai_risk_factors": ["Transient population", "Civilian proximity", "Limited security"],
        "ai_recommendations": ["Vehicle manifest verification", "Perimeter lighting", "Random security checks", "Civilian interaction protocols"],
        "ai_last_analysis": datetime.utcnow() - timedelta(hours=1),
        "created_at": datetime.utcnow() - timedelta(days=80),
        "updated_at": datetime.utcnow() - timedelta(hours=2)
    },
    {
        "id": 12,
        "asset_id": "BRIDGE-BASHOLI-001",
        "name": "Basholi Strategic Bridge",
        "callsign": "CROSSING-CHARLIE",
        "code_name": None,
        "classification": "RESTRICTED",
        "category": "INFRASTRUCTURE",
        "asset_type": "BRIDGE",
        "latitude": 32.5122,
        "longitude": 75.8601,
        "altitude_meters": 620,
        "grid_reference": "43SFS6666777788",
        "location_description": "Over Ravi River, Kathua District",
        "parent_unit_id": "BRO-PROJECT",
        "parent_unit_name": "Border Roads Organisation",
        "commanding_officer": "Col (BRO) T Sharma",
        "contact_frequency": "VHF-1234",
        "status": "OPERATIONAL",
        "threat_level": "MODERATE",
        "personnel_capacity": 20,
        "current_personnel": 8,
        "vehicle_capacity": 5,
        "current_vehicles": 3,
        "fuel_availability": 60.0,
        "ammo_availability": 40.0,
        "rations_availability": 70.0,
        "water_availability": 85.0,
        "medical_supplies": 30.0,
        "perimeter_security": "STANDARD",
        "guard_force_size": 6,
        "has_helipad": False,
        "has_medical": False,
        "has_communications": True,
        "has_power_backup": False,
        "has_ammunition_storage": False,
        "has_fuel_storage": False,
        "ai_threat_score": 52.0,
        "ai_risk_factors": ["Critical chokepoint", "Sabotage target", "Flood vulnerability", "Single crossing point"],
        "ai_recommendations": ["Underwater inspection schedule", "Guard reinforcement", "Alternative crossing plan", "Structural monitoring"],
        "ai_last_analysis": datetime.utcnow() - timedelta(hours=6),
        "created_at": datetime.utcnow() - timedelta(days=300),
        "updated_at": datetime.utcnow() - timedelta(hours=8)
    }
]

# Store for dynamic updates
military_assets_db = {asset["id"]: asset for asset in SAMPLE_ASSETS}
asset_predictions_db = {}
asset_incidents_db = {}


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def generate_ai_prediction(asset: dict) -> dict:
    """Generate AI prediction for an asset based on its characteristics"""
    prediction_types = ["THREAT", "RESOURCE", "TACTICAL", "WEATHER", "MAINTENANCE"]
    pred_type = random.choice(prediction_types)
    
    threat_score = asset.get("ai_threat_score", 50.0)
    
    predictions_by_type = {
        "THREAT": {
            "title": f"Threat Assessment for {asset['name']}",
            "summaries": [
                f"Elevated threat activity detected in sector. Recommend increasing vigilance.",
                f"Intelligence indicates potential reconnaissance activity near {asset['asset_type']}.",
                f"Pattern analysis suggests increased risk during next 48 hours.",
                f"No significant threat indicators. Maintain standard security posture."
            ],
            "recommendations": [
                ["Increase patrol frequency", "Enhance night observation", "Brief personnel on threat indicators"],
                ["Coordinate with adjacent units", "Request ISR support", "Update contingency plans"],
                ["Implement random security measures", "Verify communication redundancy", "Check defensive positions"]
            ]
        },
        "RESOURCE": {
            "title": f"Resource Forecast for {asset['name']}",
            "summaries": [
                f"Fuel reserves projected to reach critical levels in 72 hours.",
                f"Rations adequate for 14 days at current consumption rate.",
                f"Medical supplies require replenishment within 5 days.",
                f"All resources at adequate levels for continued operations."
            ],
            "recommendations": [
                ["Request priority resupply", "Implement conservation measures", "Identify alternative sources"],
                ["Update consumption tracking", "Coordinate logistics convoy", "Pre-position emergency stocks"],
                ["Review distribution protocols", "Cross-level with adjacent units", "Update supply requisitions"]
            ]
        },
        "TACTICAL": {
            "title": f"Tactical Recommendation for {asset['name']}",
            "summaries": [
                f"Current positioning provides optimal observation and fields of fire.",
                f"Recommend adjusting security posture based on terrain analysis.",
                f"Communication relay position could be optimized for better coverage.",
                f"Defensive preparations adequate for current threat level."
            ],
            "recommendations": [
                ["Maintain current positions", "Continue regular patrols", "Update range cards"],
                ["Consider alternative positions", "Improve camouflage discipline", "Rehearse contingencies"],
                ["Coordinate fire support plans", "Update obstacle plan", "Brief reinforcement routes"]
            ]
        },
        "WEATHER": {
            "title": f"Weather Impact Assessment for {asset['name']}",
            "summaries": [
                f"Severe weather expected in next 24-48 hours. Prepare for reduced mobility.",
                f"Visibility conditions favorable for operations.",
                f"Temperature drop forecast. Cold weather protocols recommended.",
                f"Weather conditions nominal. No significant impact expected."
            ],
            "recommendations": [
                ["Secure loose equipment", "Prepare alternative shelter", "Stock emergency supplies"],
                ["Take advantage of good conditions", "Complete outdoor maintenance", "Conduct training"],
                ["Issue cold weather gear", "Check heating systems", "Monitor personnel for cold injuries"]
            ]
        },
        "MAINTENANCE": {
            "title": f"Equipment Status for {asset['name']}",
            "summaries": [
                f"Generator maintenance overdue. Schedule service immediately.",
                f"Communication equipment operating normally.",
                f"Vehicle fleet requires scheduled maintenance.",
                f"All systems operational. Continue routine checks."
            ],
            "recommendations": [
                ["Schedule maintenance window", "Request spare parts", "Prepare backup systems"],
                ["Continue preventive maintenance", "Update equipment logs", "Train operators"],
                ["Prioritize critical systems", "Coordinate with maintenance unit", "Stock common spares"]
            ]
        }
    }
    
    pred_data = predictions_by_type[pred_type]
    risk_levels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    risk_level = "LOW" if threat_score < 30 else "MEDIUM" if threat_score < 50 else "HIGH" if threat_score < 75 else "CRITICAL"
    
    confidence = 0.7 + random.random() * 0.25
    probability = 0.3 + random.random() * 0.5 if pred_type == "THREAT" else None
    
    return {
        "prediction_id": f"PRED-{uuid.uuid4().hex[:8].upper()}",
        "asset_id": asset["asset_id"],
        "prediction_type": pred_type,
        "title": pred_data["title"],
        "summary": random.choice(pred_data["summaries"]),
        "confidence": round(confidence, 3),
        "probability": round(probability, 3) if probability else None,
        "risk_level": risk_level,
        "recommendations": random.choice(pred_data["recommendations"]),
        "action_required": risk_level in ["HIGH", "CRITICAL"],
        "priority": "FLASH" if risk_level == "CRITICAL" else "IMMEDIATE" if risk_level == "HIGH" else "PRIORITY" if risk_level == "MEDIUM" else "ROUTINE",
        "generated_by": "JANUS-AI",
        "valid_from": datetime.utcnow().isoformat(),
        "valid_until": (datetime.utcnow() + timedelta(hours=24)).isoformat()
    }


# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.get("/")
async def list_military_assets(
    category: Optional[AssetCategory] = None,
    asset_type: Optional[AssetType] = None,
    classification: Optional[ClassificationLevel] = None,
    status: Optional[OperationalStatus] = None,
    threat_level: Optional[ThreatLevel] = None,
    min_threat_score: Optional[float] = None,
    max_threat_score: Optional[float] = None,
    search: Optional[str] = None,
    limit: int = Query(default=50, le=100),
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """
    List all military assets with optional filters.
    Queries from database first, falls back to in-memory sample data.
    Includes Janus AI threat analysis.
    """
    # First, try to query from database
    try:
        query = select(MilitaryAssetModel)
        
        # Apply filters at database level
        if category:
            query = query.where(MilitaryAssetModel.category == category.value)
        if asset_type:
            query = query.where(MilitaryAssetModel.asset_type == asset_type.value)
        if classification:
            query = query.where(MilitaryAssetModel.classification == classification.value)
        if status:
            query = query.where(MilitaryAssetModel.status == status.value)
        if threat_level:
            query = query.where(MilitaryAssetModel.threat_level == threat_level.value)
        if min_threat_score is not None:
            query = query.where(MilitaryAssetModel.ai_threat_score >= min_threat_score)
        if max_threat_score is not None:
            query = query.where(MilitaryAssetModel.ai_threat_score <= max_threat_score)
        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                or_(
                    MilitaryAssetModel.name.ilike(search_pattern),
                    MilitaryAssetModel.asset_id.ilike(search_pattern),
                    MilitaryAssetModel.callsign.ilike(search_pattern),
                    MilitaryAssetModel.code_name.ilike(search_pattern)
                )
            )
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        count_result = await db.execute(count_query)
        total = count_result.scalar()
        
        # Apply pagination
        query = query.offset(offset).limit(limit)
        result = await db.execute(query)
        db_assets = result.scalars().all()
        
        if db_assets:
            # Convert ORM objects to dicts with Janus AI analysis
            assets = []
            for asset in db_assets:
                asset_dict = {
                    "id": asset.id,
                    "asset_id": asset.asset_id,
                    "name": asset.name,
                    "callsign": asset.callsign,
                    "code_name": asset.code_name,
                    "classification": asset.classification,
                    "category": asset.category,
                    "asset_type": asset.asset_type,
                    "latitude": asset.latitude,
                    "longitude": asset.longitude,
                    "altitude_meters": asset.altitude_meters,
                    "grid_reference": asset.grid_reference,
                    "location_description": asset.location_description,
                    "parent_unit_id": asset.parent_unit_id,
                    "parent_unit_name": asset.parent_unit_name,
                    "commanding_officer": asset.commanding_officer,
                    "contact_frequency": asset.contact_frequency,
                    "status": asset.status,
                    "threat_level": asset.threat_level,
                    "personnel_capacity": asset.personnel_capacity,
                    "current_personnel": asset.current_personnel,
                    "vehicle_capacity": asset.vehicle_capacity,
                    "current_vehicles": asset.current_vehicles,
                    "fuel_availability": asset.fuel_availability,
                    "ammo_availability": asset.ammo_availability,
                    "rations_availability": asset.rations_availability,
                    "water_availability": asset.water_availability,
                    "medical_supplies": asset.medical_supplies,
                    "perimeter_security": asset.perimeter_security,
                    "guard_force_size": asset.guard_force_size,
                    "has_helipad": asset.has_helipad,
                    "has_medical": asset.has_medical,
                    "has_communications": asset.has_communications,
                    "has_power_backup": asset.has_power_backup,
                    "has_ammunition_storage": asset.has_ammunition_storage,
                    "has_fuel_storage": asset.has_fuel_storage,
                    "ai_threat_score": asset.ai_threat_score or 0.0,
                    "ai_risk_factors": asset.ai_risk_factors or [],
                    "ai_recommendations": asset.ai_recommendations or [],
                    "ai_last_analysis": asset.ai_last_analysis.isoformat() if asset.ai_last_analysis else None,
                    "created_at": asset.created_at.isoformat() if asset.created_at else None,
                    "updated_at": asset.updated_at.isoformat() if asset.updated_at else None
                }
                assets.append(asset_dict)
            
            return {
                "total": total,
                "limit": limit,
                "offset": offset,
                "source": "database",
                "ai_engine": "JANUS-AI",
                "assets": assets
            }
    except Exception as e:
        # Log error but continue to fallback
        print(f"Database query failed, using fallback: {e}")
    
    # Fallback to in-memory sample data
    assets = list(military_assets_db.values())
    
    # Apply filters
    if category:
        assets = [a for a in assets if a["category"] == category.value]
    if asset_type:
        assets = [a for a in assets if a["asset_type"] == asset_type.value]
    if classification:
        assets = [a for a in assets if a["classification"] == classification.value]
    if status:
        assets = [a for a in assets if a["status"] == status.value]
    if threat_level:
        assets = [a for a in assets if a["threat_level"] == threat_level.value]
    if min_threat_score is not None:
        assets = [a for a in assets if a.get("ai_threat_score", 0) >= min_threat_score]
    if max_threat_score is not None:
        assets = [a for a in assets if a.get("ai_threat_score", 100) <= max_threat_score]
    if search:
        search_lower = search.lower()
        assets = [a for a in assets if 
                  search_lower in a["name"].lower() or 
                  search_lower in a["asset_id"].lower() or
                  (a.get("callsign") and search_lower in a["callsign"].lower()) or
                  (a.get("code_name") and search_lower in a["code_name"].lower())]
    
    total = len(assets)
    assets = assets[offset:offset + limit]
    
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "source": "sample_data",
        "ai_engine": "JANUS-AI",
        "assets": assets
    }


@router.get("/summary")
async def get_assets_summary(db: AsyncSession = Depends(get_db)):
    """Get summary statistics of all military assets"""
    assets = list(military_assets_db.values())
    
    # Category breakdown
    category_counts = {}
    for asset in assets:
        cat = asset["category"]
        category_counts[cat] = category_counts.get(cat, 0) + 1
    
    # Status breakdown
    status_counts = {}
    for asset in assets:
        stat = asset["status"]
        status_counts[stat] = status_counts.get(stat, 0) + 1
    
    # Threat level breakdown
    threat_counts = {}
    for asset in assets:
        threat = asset["threat_level"]
        threat_counts[threat] = threat_counts.get(threat, 0) + 1
    
    # Classification breakdown
    class_counts = {}
    for asset in assets:
        cls = asset["classification"]
        class_counts[cls] = class_counts.get(cls, 0) + 1
    
    # High threat assets
    high_threat = [a for a in assets if a.get("ai_threat_score", 0) >= 70]
    
    # Low resources
    low_resources = [a for a in assets if 
                     a.get("fuel_availability", 100) < 40 or
                     a.get("rations_availability", 100) < 40 or
                     a.get("water_availability", 100) < 40]
    
    return {
        "total_assets": len(assets),
        "by_category": category_counts,
        "by_status": status_counts,
        "by_threat_level": threat_counts,
        "by_classification": class_counts,
        "high_threat_count": len(high_threat),
        "low_resources_count": len(low_resources),
        "avg_threat_score": round(sum(a.get("ai_threat_score", 0) for a in assets) / len(assets), 2) if assets else 0,
        "total_personnel": sum(a.get("current_personnel", 0) for a in assets),
        "total_vehicles": sum(a.get("current_vehicles", 0) for a in assets)
    }


@router.get("/map-data")
async def get_assets_for_map(
    include_classified: bool = True,
    min_classification: Optional[ClassificationLevel] = None
):
    """Get minimal asset data optimized for map rendering"""
    assets = list(military_assets_db.values())
    
    classification_order = ["UNCLASSIFIED", "RESTRICTED", "CONFIDENTIAL", "SECRET", "TOP_SECRET"]
    
    if min_classification:
        min_idx = classification_order.index(min_classification.value)
        assets = [a for a in assets if classification_order.index(a["classification"]) >= min_idx]
    
    if not include_classified:
        assets = [a for a in assets if a["classification"] == "UNCLASSIFIED"]
    
    return {
        "assets": [
            {
                "id": a["id"],
                "asset_id": a["asset_id"],
                "name": a["name"],
                "callsign": a.get("callsign"),
                "category": a["category"],
                "asset_type": a["asset_type"],
                "classification": a["classification"],
                "lat": a["latitude"],
                "lng": a["longitude"],
                "status": a["status"],
                "threat_level": a["threat_level"],
                "ai_threat_score": a.get("ai_threat_score", 0),
                "has_helipad": a.get("has_helipad", False),
                "has_medical": a.get("has_medical", False)
            }
            for a in assets
        ]
    }


@router.get("/{asset_id}")
async def get_military_asset(asset_id: str):
    """Get detailed information about a specific military asset"""
    # Try by asset_id string first
    for asset in military_assets_db.values():
        if asset["asset_id"] == asset_id:
            return asset
    
    # Try by numeric id
    try:
        numeric_id = int(asset_id)
        if numeric_id in military_assets_db:
            return military_assets_db[numeric_id]
    except ValueError:
        pass
    
    raise HTTPException(status_code=404, detail=f"Asset {asset_id} not found")


@router.get("/{asset_id}/predictions")
async def get_asset_predictions(asset_id: str, limit: int = 5):
    """Get AI predictions for a specific asset"""
    # Find the asset
    asset = None
    for a in military_assets_db.values():
        if a["asset_id"] == asset_id or str(a["id"]) == asset_id:
            asset = a
            break
    
    if not asset:
        raise HTTPException(status_code=404, detail=f"Asset {asset_id} not found")
    
    # Generate predictions
    predictions = [generate_ai_prediction(asset) for _ in range(limit)]
    
    return {
        "asset_id": asset["asset_id"],
        "asset_name": asset["name"],
        "predictions": predictions,
        "generated_at": datetime.utcnow().isoformat()
    }


@router.post("/{asset_id}/analyze")
async def analyze_asset(asset_id: str):
    """Trigger comprehensive AI analysis for an asset"""
    # Find the asset
    asset = None
    asset_key = None
    for key, a in military_assets_db.items():
        if a["asset_id"] == asset_id or str(a["id"]) == asset_id:
            asset = a
            asset_key = key
            break
    
    if not asset:
        raise HTTPException(status_code=404, detail=f"Asset {asset_id} not found")
    
    # Generate comprehensive analysis
    threat_factors = []
    recommendations = []
    
    # Analyze threat level
    if asset["threat_level"] in ["HIGH", "CRITICAL"]:
        threat_factors.append("Elevated threat environment")
        recommendations.append("Increase security posture")
    
    # Analyze location
    if asset.get("altitude_meters", 0) > 4000:
        threat_factors.append("Extreme altitude challenges")
        recommendations.append("Prioritize altitude-related health monitoring")
    
    # Analyze resources
    if asset.get("fuel_availability", 100) < 50:
        threat_factors.append("Low fuel reserves")
        recommendations.append("Request priority fuel resupply")
    if asset.get("rations_availability", 100) < 50:
        threat_factors.append("Low rations")
        recommendations.append("Coordinate rations replenishment")
    if asset.get("water_availability", 100) < 50:
        threat_factors.append("Water shortage risk")
        recommendations.append("Activate water conservation protocols")
    
    # Calculate new threat score
    base_score = asset.get("ai_threat_score", 50.0)
    modifier = len(threat_factors) * 5
    new_score = min(100, max(0, base_score + random.uniform(-10, 10) + modifier))
    
    # Update asset
    asset["ai_threat_score"] = round(new_score, 1)
    asset["ai_risk_factors"] = threat_factors if threat_factors else asset.get("ai_risk_factors", [])
    asset["ai_recommendations"] = recommendations if recommendations else asset.get("ai_recommendations", [])
    asset["ai_last_analysis"] = datetime.utcnow().isoformat()
    asset["updated_at"] = datetime.utcnow().isoformat()
    
    military_assets_db[asset_key] = asset
    
    return {
        "asset_id": asset["asset_id"],
        "analysis_complete": True,
        "threat_score": new_score,
        "risk_factors": threat_factors,
        "recommendations": recommendations,
        "analyzed_at": datetime.utcnow().isoformat()
    }


@router.post("/")
async def create_military_asset(asset: MilitaryAssetCreate):
    """Create a new military asset"""
    # Check for duplicate
    for existing in military_assets_db.values():
        if existing["asset_id"] == asset.asset_id:
            raise HTTPException(status_code=400, detail=f"Asset with ID {asset.asset_id} already exists")
    
    new_id = max(military_assets_db.keys()) + 1 if military_assets_db else 1
    
    new_asset = {
        "id": new_id,
        **asset.dict(),
        "classification": asset.classification.value,
        "category": asset.category.value,
        "asset_type": asset.asset_type.value,
        "status": asset.status.value,
        "threat_level": asset.threat_level.value,
        "personnel_capacity": 0,
        "current_personnel": 0,
        "vehicle_capacity": 0,
        "current_vehicles": 0,
        "fuel_availability": 100.0,
        "ammo_availability": 100.0,
        "rations_availability": 100.0,
        "water_availability": 100.0,
        "medical_supplies": 100.0,
        "perimeter_security": "STANDARD",
        "guard_force_size": 0,
        "has_helipad": False,
        "has_medical": False,
        "has_communications": True,
        "has_power_backup": False,
        "has_ammunition_storage": False,
        "has_fuel_storage": False,
        "ai_threat_score": 50.0,
        "ai_risk_factors": [],
        "ai_recommendations": [],
        "ai_last_analysis": None,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    military_assets_db[new_id] = new_asset
    
    return new_asset


@router.get("/categories/list")
async def list_categories():
    """List all available asset categories with descriptions"""
    return {
        "categories": [
            {"value": "COMMAND_CONTROL", "label": "Command & Control", "icon": "🎖️", "description": "HQ, Command Posts, TOCs"},
            {"value": "LOGISTICS_SUPPLY", "label": "Logistics & Supply", "icon": "📦", "description": "Depots, Supply Points, Fuel Points"},
            {"value": "COMBAT_SUPPORT", "label": "Combat Support", "icon": "⚔️", "description": "FOBs, Patrol Bases, Fire Support"},
            {"value": "MEDICAL", "label": "Medical", "icon": "🏥", "description": "Hospitals, Aid Stations, Medical Points"},
            {"value": "COMMUNICATIONS", "label": "Communications", "icon": "📡", "description": "Signal Centers, Relay Stations"},
            {"value": "INTELLIGENCE", "label": "Intelligence", "icon": "👁️", "description": "Observation Posts, Listening Posts"},
            {"value": "ENGINEERING", "label": "Engineering", "icon": "🔧", "description": "Construction, Bridging Units"},
            {"value": "AVIATION", "label": "Aviation", "icon": "🚁", "description": "Helipads, Airfields, FARPs"},
            {"value": "SECURITY", "label": "Security", "icon": "🛡️", "description": "Checkpoints, TCPs, VCPs"},
            {"value": "INFRASTRUCTURE", "label": "Infrastructure", "icon": "🌉", "description": "Bridges, Tunnels, Critical Points"}
        ]
    }


@router.get("/types/list")
async def list_asset_types():
    """List all available asset types grouped by category"""
    return {
        "types": {
            "COMMAND_CONTROL": [
                {"value": "HEADQUARTERS", "label": "Headquarters"},
                {"value": "COMMAND_POST", "label": "Command Post"},
                {"value": "TACTICAL_OPS_CENTER", "label": "Tactical Ops Center"}
            ],
            "COMBAT_SUPPORT": [
                {"value": "FORWARD_OPERATING_BASE", "label": "Forward Operating Base"},
                {"value": "BASE_CAMP", "label": "Base Camp"},
                {"value": "PATROL_BASE", "label": "Patrol Base"},
                {"value": "STAGING_AREA", "label": "Staging Area"}
            ],
            "LOGISTICS_SUPPLY": [
                {"value": "TRANSIT_CAMP", "label": "Transit Camp"},
                {"value": "AMMUNITION_DEPOT", "label": "Ammunition Depot"},
                {"value": "FUEL_POINT", "label": "Fuel Point"},
                {"value": "SUPPLY_DEPOT", "label": "Supply Depot"},
                {"value": "RATION_POINT", "label": "Ration Point"},
                {"value": "VEHICLE_PARK", "label": "Vehicle Park"},
                {"value": "MAINTENANCE_BAY", "label": "Maintenance Bay"}
            ],
            "SECURITY": [
                {"value": "TRAFFIC_CONTROL_POINT", "label": "Traffic Control Point (TCP)"},
                {"value": "VEHICLE_CHECKPOINT", "label": "Vehicle Checkpoint (VCP)"},
                {"value": "ENTRY_CONTROL_POINT", "label": "Entry Control Point"}
            ],
            "INTELLIGENCE": [
                {"value": "OBSERVATION_POST", "label": "Observation Post"},
                {"value": "LISTENING_POST", "label": "Listening Post"}
            ],
            "MEDICAL": [
                {"value": "FIELD_HOSPITAL", "label": "Field Hospital"},
                {"value": "AID_STATION", "label": "Aid Station"},
                {"value": "MEDICAL_SUPPLY_POINT", "label": "Medical Supply Point"},
                {"value": "CASUALTY_COLLECTION_POINT", "label": "Casualty Collection Point"}
            ],
            "COMMUNICATIONS": [
                {"value": "SIGNAL_CENTER", "label": "Signal Center"},
                {"value": "RELAY_STATION", "label": "Relay Station"},
                {"value": "SATELLITE_GROUND_STATION", "label": "Satellite Ground Station"},
                {"value": "RADIO_TOWER", "label": "Radio Tower"}
            ],
            "AVIATION": [
                {"value": "HELIPAD", "label": "Helipad"},
                {"value": "FORWARD_ARMING_REFUEL_POINT", "label": "FARP"},
                {"value": "AIRFIELD", "label": "Airfield"}
            ],
            "INFRASTRUCTURE": [
                {"value": "BRIDGE", "label": "Bridge"},
                {"value": "TUNNEL", "label": "Tunnel"},
                {"value": "WATER_POINT", "label": "Water Point"},
                {"value": "POWER_GENERATOR", "label": "Power Generator"}
            ]
        }
    }
