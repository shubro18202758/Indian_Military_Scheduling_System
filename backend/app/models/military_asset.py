"""
Military Asset Models
Comprehensive models for all military installations, facilities, and strategic assets.
Includes classification levels, categories, operational status, and AI prediction integration.
"""
from sqlalchemy import String, Integer, Float, Boolean, Column, DateTime, ForeignKey, JSON, Text, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base
import enum


# ============================================================================
# ENUMS FOR MILITARY CLASSIFICATION AND CATEGORIES
# ============================================================================

class ClassificationLevel(str, enum.Enum):
    """Security classification levels following military standards"""
    TOP_SECRET = "TOP_SECRET"
    SECRET = "SECRET"
    CONFIDENTIAL = "CONFIDENTIAL"
    RESTRICTED = "RESTRICTED"
    UNCLASSIFIED = "UNCLASSIFIED"


class AssetCategory(str, enum.Enum):
    """Primary categories for military assets"""
    COMMAND_CONTROL = "COMMAND_CONTROL"          # HQ, Command Posts
    LOGISTICS_SUPPLY = "LOGISTICS_SUPPLY"        # Depots, Supply Points
    COMBAT_SUPPORT = "COMBAT_SUPPORT"            # Fire Support, Artillery
    MEDICAL = "MEDICAL"                          # Hospitals, Aid Stations
    COMMUNICATIONS = "COMMUNICATIONS"            # Signal Centers, Relay Points
    INTELLIGENCE = "INTELLIGENCE"                # Observation Posts, SIGINT
    ENGINEERING = "ENGINEERING"                  # Construction, Bridging
    AVIATION = "AVIATION"                        # Helipads, Airfields
    SECURITY = "SECURITY"                        # Checkpoints, Patrol Bases
    INFRASTRUCTURE = "INFRASTRUCTURE"            # Roads, Bridges, Tunnels


class AssetType(str, enum.Enum):
    """Specific types of military assets"""
    # Command & Control
    HEADQUARTERS = "HEADQUARTERS"
    COMMAND_POST = "COMMAND_POST"
    TACTICAL_OPS_CENTER = "TACTICAL_OPS_CENTER"
    
    # Bases and Camps
    FORWARD_OPERATING_BASE = "FORWARD_OPERATING_BASE"
    BASE_CAMP = "BASE_CAMP"
    PATROL_BASE = "PATROL_BASE"
    TRANSIT_CAMP = "TRANSIT_CAMP"
    STAGING_AREA = "STAGING_AREA"
    
    # Checkpoints
    TRAFFIC_CONTROL_POINT = "TRAFFIC_CONTROL_POINT"
    VEHICLE_CHECKPOINT = "VEHICLE_CHECKPOINT"
    ENTRY_CONTROL_POINT = "ENTRY_CONTROL_POINT"
    OBSERVATION_POST = "OBSERVATION_POST"
    LISTENING_POST = "LISTENING_POST"
    
    # Logistics
    AMMUNITION_DEPOT = "AMMUNITION_DEPOT"
    FUEL_POINT = "FUEL_POINT"
    SUPPLY_DEPOT = "SUPPLY_DEPOT"
    RATION_POINT = "RATION_POINT"
    VEHICLE_PARK = "VEHICLE_PARK"
    MAINTENANCE_BAY = "MAINTENANCE_BAY"
    
    # Medical
    FIELD_HOSPITAL = "FIELD_HOSPITAL"
    AID_STATION = "AID_STATION"
    MEDICAL_SUPPLY_POINT = "MEDICAL_SUPPLY_POINT"
    CASUALTY_COLLECTION_POINT = "CASUALTY_COLLECTION_POINT"
    
    # Communications
    SIGNAL_CENTER = "SIGNAL_CENTER"
    RELAY_STATION = "RELAY_STATION"
    SATELLITE_GROUND_STATION = "SATELLITE_GROUND_STATION"
    RADIO_TOWER = "RADIO_TOWER"
    
    # Aviation
    HELIPAD = "HELIPAD"
    FORWARD_ARMING_REFUEL_POINT = "FORWARD_ARMING_REFUEL_POINT"
    AIRFIELD = "AIRFIELD"
    
    # Other
    WATER_POINT = "WATER_POINT"
    POWER_GENERATOR = "POWER_GENERATOR"
    BRIDGE = "BRIDGE"
    TUNNEL = "TUNNEL"


class OperationalStatus(str, enum.Enum):
    """Current operational status of the asset"""
    FULLY_OPERATIONAL = "FULLY_OPERATIONAL"
    OPERATIONAL = "OPERATIONAL"
    LIMITED_OPERATIONS = "LIMITED_OPERATIONS"
    DEGRADED = "DEGRADED"
    NON_OPERATIONAL = "NON_OPERATIONAL"
    UNDER_CONSTRUCTION = "UNDER_CONSTRUCTION"
    ABANDONED = "ABANDONED"
    DESTROYED = "DESTROYED"


class ThreatLevel(str, enum.Enum):
    """Current threat assessment for the asset location"""
    CRITICAL = "CRITICAL"      # Immediate danger, evacuation may be needed
    HIGH = "HIGH"              # Active threat, enhanced security
    ELEVATED = "ELEVATED"      # Increased risk, heightened awareness
    MODERATE = "MODERATE"      # Normal operations with caution
    LOW = "LOW"                # Minimal threat, standard security


# ============================================================================
# MAIN MILITARY ASSET MODEL
# ============================================================================

class MilitaryAsset(Base):
    """
    Comprehensive military asset representing any fixed installation,
    facility, or strategic point in the operational area.
    """
    __tablename__ = "military_assets"

    id = Column(Integer, primary_key=True, index=True)
    
    # ===== IDENTIFICATION =====
    asset_id = Column(String(50), unique=True, index=True, nullable=False,
                     doc="Unique military asset identifier (e.g., FB-ALPHA-001)")
    name = Column(String(100), nullable=False, doc="Official name")
    callsign = Column(String(50), nullable=True, doc="Radio callsign")
    code_name = Column(String(50), nullable=True, doc="Operational code name")
    
    # ===== CLASSIFICATION =====
    classification = Column(String(20), default=ClassificationLevel.RESTRICTED.value,
                           doc="Security classification level")
    need_to_know = Column(Boolean, default=False, 
                         doc="Requires need-to-know access beyond classification")
    access_list = Column(JSON, default=list, doc="List of authorized unit IDs")
    
    # ===== CATEGORIZATION =====
    category = Column(String(30), nullable=False, doc="Primary category")
    asset_type = Column(String(50), nullable=False, doc="Specific asset type")
    sub_type = Column(String(50), nullable=True, doc="Further sub-classification")
    
    # ===== LOCATION =====
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    altitude_meters = Column(Float, nullable=True, doc="Altitude above sea level")
    grid_reference = Column(String(20), nullable=True, doc="Military grid reference")
    location_description = Column(String(200), nullable=True, 
                                 doc="Descriptive location (e.g., 'Hill 305, NW of Village X')")
    
    # ===== COMMAND STRUCTURE =====
    parent_unit_id = Column(String(50), nullable=True, doc="Parent unit/formation ID")
    parent_unit_name = Column(String(100), nullable=True, doc="Parent unit name")
    commanding_officer = Column(String(100), nullable=True, doc="CO name/rank")
    contact_frequency = Column(String(20), nullable=True, doc="Primary radio frequency")
    alternate_frequency = Column(String(20), nullable=True, doc="Alternate frequency")
    satcom_channel = Column(String(20), nullable=True, doc="SATCOM channel if available")
    
    # ===== OPERATIONAL STATUS =====
    status = Column(String(30), default=OperationalStatus.OPERATIONAL.value)
    operational_since = Column(DateTime, nullable=True, doc="Date became operational")
    last_inspection = Column(DateTime, nullable=True, doc="Last security/ops inspection")
    next_inspection = Column(DateTime, nullable=True, doc="Scheduled next inspection")
    
    # ===== CAPACITY & RESOURCES =====
    personnel_capacity = Column(Integer, default=0, doc="Max personnel")
    current_personnel = Column(Integer, default=0, doc="Current personnel count")
    vehicle_capacity = Column(Integer, default=0, doc="Max vehicles")
    current_vehicles = Column(Integer, default=0, doc="Current vehicle count")
    
    # Resource availability (percentage 0-100)
    fuel_availability = Column(Float, default=100.0)
    ammo_availability = Column(Float, default=100.0)
    rations_availability = Column(Float, default=100.0)
    water_availability = Column(Float, default=100.0)
    medical_supplies = Column(Float, default=100.0)
    
    # ===== SECURITY & DEFENSE =====
    threat_level = Column(String(20), default=ThreatLevel.MODERATE.value)
    perimeter_security = Column(String(30), default="STANDARD",
                               doc="MINIMAL, STANDARD, ENHANCED, MAXIMUM")
    guard_force_size = Column(Integer, default=0)
    has_bunkers = Column(Boolean, default=False)
    has_barriers = Column(Boolean, default=True)
    has_cctv = Column(Boolean, default=False)
    has_early_warning = Column(Boolean, default=False)
    defensive_weapons = Column(JSON, default=list, doc="List of defensive weapon systems")
    
    # ===== FACILITIES =====
    has_helipad = Column(Boolean, default=False)
    has_medical = Column(Boolean, default=False)
    has_communications = Column(Boolean, default=True)
    has_power_backup = Column(Boolean, default=False)
    has_water_supply = Column(Boolean, default=True)
    has_ammunition_storage = Column(Boolean, default=False)
    has_fuel_storage = Column(Boolean, default=False)
    has_maintenance = Column(Boolean, default=False)
    has_mess = Column(Boolean, default=False)
    has_accommodation = Column(Boolean, default=False)
    
    # ===== CONNECTIVITY =====
    road_access = Column(Boolean, default=True)
    rail_access = Column(Boolean, default=False)
    air_access = Column(Boolean, default=False)
    nearest_route_id = Column(Integer, ForeignKey("routes.id"), nullable=True)
    distance_from_route_km = Column(Float, default=0.0)
    
    # ===== AI PREDICTION FIELDS =====
    ai_threat_score = Column(Float, default=0.0, doc="AI-computed threat score 0-100")
    ai_risk_factors = Column(JSON, default=list, doc="AI-identified risk factors")
    ai_recommendations = Column(JSON, default=list, doc="AI tactical recommendations")
    ai_resource_forecast = Column(JSON, default=dict, doc="AI resource depletion forecast")
    ai_last_analysis = Column(DateTime, nullable=True, doc="Last AI analysis timestamp")
    
    # ===== NOTES & METADATA =====
    operational_notes = Column(Text, nullable=True, doc="Operational remarks")
    intelligence_notes = Column(Text, nullable=True, doc="Intel remarks (classified)")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(50), nullable=True, doc="User/system that created")
    last_updated_by = Column(String(50), nullable=True)
    
    # ===== RELATIONSHIPS =====
    # route = relationship("Route", back_populates="nearby_assets")
    # incidents = relationship("AssetIncident", back_populates="asset")
    # predictions = relationship("AssetPrediction", back_populates="asset")


class AssetIncident(Base):
    """
    Records of incidents at or affecting military assets.
    Used for historical analysis and AI prediction.
    """
    __tablename__ = "asset_incidents"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("military_assets.id"), nullable=False)
    
    # Incident details
    incident_type = Column(String(50), nullable=False,
                          doc="ATTACK, BREACH, MALFUNCTION, ACCIDENT, NATURAL_DISASTER, OTHER")
    severity = Column(String(20), nullable=False, doc="MINOR, MODERATE, MAJOR, CRITICAL")
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    
    # Timing
    occurred_at = Column(DateTime, nullable=False)
    reported_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    
    # Impact
    casualties = Column(Integer, default=0)
    damage_assessment = Column(String(50), default="NONE",
                              doc="NONE, MINOR, MODERATE, SIGNIFICANT, SEVERE, DESTROYED")
    operational_impact = Column(String(100), nullable=True)
    
    # Response
    response_actions = Column(JSON, default=list)
    lessons_learned = Column(Text, nullable=True)
    
    # Classification
    classification = Column(String(20), default=ClassificationLevel.RESTRICTED.value)
    
    # Metadata
    reported_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AssetPrediction(Base):
    """
    AI-generated predictions and recommendations for military assets.
    """
    __tablename__ = "asset_predictions"

    id = Column(Integer, primary_key=True, index=True)
    prediction_id = Column(String(50), unique=True, nullable=False)
    asset_id = Column(Integer, ForeignKey("military_assets.id"), nullable=False)
    
    # Prediction type
    prediction_type = Column(String(50), nullable=False,
                            doc="THREAT, RESOURCE, MAINTENANCE, WEATHER, TACTICAL, STRATEGIC")
    
    # Prediction content
    title = Column(String(200), nullable=False)
    summary = Column(Text, nullable=False)
    confidence = Column(Float, default=0.0, doc="Confidence score 0-1")
    probability = Column(Float, nullable=True, doc="Probability of event 0-1")
    
    # Risk assessment
    risk_level = Column(String(20), default="MEDIUM", doc="LOW, MEDIUM, HIGH, CRITICAL")
    impact_assessment = Column(Text, nullable=True)
    
    # Recommendations
    recommendations = Column(JSON, default=list)
    action_required = Column(Boolean, default=False)
    priority = Column(String(20), default="ROUTINE", 
                     doc="FLASH, IMMEDIATE, PRIORITY, ROUTINE")
    
    # Time factors
    prediction_window_hours = Column(Integer, default=24, 
                                    doc="How far ahead this prediction applies")
    valid_from = Column(DateTime, default=datetime.utcnow)
    valid_until = Column(DateTime, nullable=True)
    
    # AI metadata
    generated_by = Column(String(50), default="JANUS-AI", doc="AI model that generated")
    model_version = Column(String(20), nullable=True)
    input_data_sources = Column(JSON, default=list, doc="Data sources used for prediction")
    
    # Status
    status = Column(String(20), default="ACTIVE", doc="ACTIVE, EXPIRED, SUPERSEDED, INVALIDATED")
    reviewed_by = Column(String(100), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)


class AssetResourceLog(Base):
    """
    Historical log of resource levels at assets for trend analysis.
    """
    __tablename__ = "asset_resource_logs"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("military_assets.id"), nullable=False)
    
    # Resource levels at time of logging
    fuel_level = Column(Float, default=100.0)
    ammo_level = Column(Float, default=100.0)
    rations_level = Column(Float, default=100.0)
    water_level = Column(Float, default=100.0)
    medical_level = Column(Float, default=100.0)
    personnel_count = Column(Integer, default=0)
    vehicle_count = Column(Integer, default=0)
    
    # Status at time
    operational_status = Column(String(30))
    threat_level = Column(String(20))
    
    # Timestamp
    logged_at = Column(DateTime, default=datetime.utcnow)
