"""
Command Centre Models
=====================
भारतीय सेना (Indian Army) Logistics Command Centre

Comprehensive models for:
- Load Management & Volume Control
- Vehicle Sharing between Entities
- Movement Planning & Optimization
- Dynamic Planning & Entity Notifications
- Road Space Management

Security Classification: प्रतिबंधित (RESTRICTED)
"""

from sqlalchemy import String, Integer, Float, Boolean, Column, DateTime, ForeignKey, JSON, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base
import enum


# ============================================================================
# ENUMERATIONS
# ============================================================================

class EntityType(str, enum.Enum):
    """Military Entity Types"""
    BRIGADE = "BRIGADE"
    DIVISION = "DIVISION"
    CORPS = "CORPS"
    REGIMENT = "REGIMENT"
    BATTALION = "BATTALION"
    COMPANY = "COMPANY"
    LOGISTICS_HQ = "LOGISTICS_HQ"
    SUPPLY_DEPOT = "SUPPLY_DEPOT"
    ORDNANCE_DEPOT = "ORDNANCE_DEPOT"
    FORWARD_BASE = "FORWARD_BASE"


class LoadPriority(str, enum.Enum):
    """Load Priority Classifications"""
    CRITICAL = "CRITICAL"          # Ammunition, Medical Emergency
    HIGH = "HIGH"                  # Rations, Fuel for Operations
    MEDIUM = "MEDIUM"              # General Supplies
    LOW = "LOW"                    # Non-essential items
    ROUTINE = "ROUTINE"            # Regular logistics


class LoadCategory(str, enum.Enum):
    """Categories of Military Loads"""
    AMMUNITION = "AMMUNITION"
    RATIONS = "RATIONS"
    FUEL_POL = "FUEL_POL"          # Petrol, Oil, Lubricants
    MEDICAL = "MEDICAL"
    EQUIPMENT = "EQUIPMENT"
    PERSONNEL = "PERSONNEL"
    VEHICLES = "VEHICLES"
    CONSTRUCTION = "CONSTRUCTION"
    COMMUNICATION = "COMMUNICATION"
    GENERAL = "GENERAL"


class SharingStatus(str, enum.Enum):
    """Vehicle Sharing Request Status"""
    REQUESTED = "REQUESTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    IN_TRANSIT = "IN_TRANSIT"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class MovementPlanStatus(str, enum.Enum):
    """Movement Plan Status"""
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    ABORTED = "ABORTED"


class NotificationType(str, enum.Enum):
    """Notification Types for Entities"""
    CONVOY_APPROACHING = "CONVOY_APPROACHING"
    CONVOY_ARRIVED = "CONVOY_ARRIVED"
    CONVOY_DEPARTED = "CONVOY_DEPARTED"
    ROUTE_BLOCKED = "ROUTE_BLOCKED"
    THREAT_ALERT = "THREAT_ALERT"
    WEATHER_WARNING = "WEATHER_WARNING"
    HALT_REQUIRED = "HALT_REQUIRED"
    LOAD_READY = "LOAD_READY"
    VEHICLE_SHARED = "VEHICLE_SHARED"
    ETA_UPDATE = "ETA_UPDATE"
    PRIORITY_CHANGE = "PRIORITY_CHANGE"
    ROAD_SPACE_ALLOCATED = "ROAD_SPACE_ALLOCATED"


class RoadSpaceStatus(str, enum.Enum):
    """Road Space Allocation Status"""
    AVAILABLE = "AVAILABLE"
    ALLOCATED = "ALLOCATED"
    BLOCKED = "BLOCKED"
    MAINTENANCE = "MAINTENANCE"


# ============================================================================
# MILITARY ENTITY MODEL
# ============================================================================

class MilitaryEntity(Base):
    """
    Military Entity - Organizations that send/receive supplies
    Represents units like Brigades, Divisions, Depots, etc.
    """
    __tablename__ = "military_entities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True, nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    entity_type = Column(String(50), default=EntityType.BATTALION.value)
    
    # Location
    base_latitude = Column(Float, nullable=False)
    base_longitude = Column(Float, nullable=False)
    sector = Column(String(100), doc="Sector/Region (e.g., J&K, NE, Western)")
    
    # Command Structure
    parent_entity_id = Column(Integer, ForeignKey("military_entities.id"), nullable=True)
    commanding_officer = Column(String(255), nullable=True)
    contact_radio_freq = Column(String(50), nullable=True)
    
    # Capacity
    vehicle_capacity = Column(Integer, default=50)
    storage_capacity_tons = Column(Float, default=500.0)
    personnel_strength = Column(Integer, default=500)
    
    # Current Status
    current_vehicle_count = Column(Integer, default=0)
    current_storage_used_tons = Column(Float, default=0.0)
    operational_status = Column(String(50), default="OPERATIONAL")
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============================================================================
# LOAD MANAGEMENT MODELS
# ============================================================================

class LoadAssignment(Base):
    """
    Load Assignment - Tracks load/cargo assignments for transport
    Central to load prioritization and volume management
    """
    __tablename__ = "load_assignments"

    id = Column(Integer, primary_key=True, index=True)
    assignment_code = Column(String(50), unique=True, nullable=False, index=True)
    
    # Load Details
    load_category = Column(String(50), default=LoadCategory.GENERAL.value)
    priority = Column(String(50), default=LoadPriority.MEDIUM.value)
    description = Column(Text, nullable=True)
    
    # Quantity & Weight
    total_weight_tons = Column(Float, nullable=False)
    total_volume_cubic_m = Column(Float, nullable=True)
    item_count = Column(Integer, default=1)
    
    # Source & Destination
    source_entity_id = Column(Integer, ForeignKey("military_entities.id"), nullable=False)
    destination_entity_id = Column(Integer, ForeignKey("military_entities.id"), nullable=False)
    
    # Convoy Assignment
    convoy_id = Column(Integer, ForeignKey("convoys.id"), nullable=True)
    vehicle_ids = Column(JSON, default=list, doc="List of assigned vehicle IDs")
    
    # Timing
    required_by = Column(DateTime, nullable=True, doc="Deadline for delivery")
    scheduled_pickup = Column(DateTime, nullable=True)
    actual_pickup = Column(DateTime, nullable=True)
    scheduled_delivery = Column(DateTime, nullable=True)
    actual_delivery = Column(DateTime, nullable=True)
    
    # Status Tracking
    status = Column(String(50), default="PENDING", doc="PENDING, ASSIGNED, LOADING, IN_TRANSIT, DELIVERED, FAILED")
    completion_percentage = Column(Float, default=0.0)
    
    # Risk & Priority Score (AI calculated)
    ai_priority_score = Column(Float, default=0.5, doc="0.0-1.0 AI calculated priority")
    urgency_factor = Column(Float, default=1.0)
    
    # Metadata
    created_by = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LoadItem(Base):
    """
    Individual items within a load assignment
    For detailed tracking of cargo
    """
    __tablename__ = "load_items"

    id = Column(Integer, primary_key=True, index=True)
    load_assignment_id = Column(Integer, ForeignKey("load_assignments.id"), nullable=False)
    
    # Item Details
    item_name = Column(String(255), nullable=False)
    item_code = Column(String(100), nullable=True)
    category = Column(String(50), default=LoadCategory.GENERAL.value)
    
    # Quantity
    quantity = Column(Integer, default=1)
    unit = Column(String(50), default="units", doc="units, kg, liters, boxes, pallets")
    weight_kg = Column(Float, nullable=True)
    volume_cubic_m = Column(Float, nullable=True)
    
    # Special Handling
    is_hazardous = Column(Boolean, default=False)
    requires_refrigeration = Column(Boolean, default=False)
    is_fragile = Column(Boolean, default=False)
    security_classification = Column(String(50), default="UNCLASSIFIED")
    
    # Tracking
    serial_numbers = Column(JSON, default=list)
    status = Column(String(50), default="PENDING")
    
    created_at = Column(DateTime, default=datetime.utcnow)


# ============================================================================
# VEHICLE SHARING MODELS
# ============================================================================

class VehicleSharingRequest(Base):
    """
    Vehicle Sharing Request - Inter-entity vehicle sharing
    Enables optimal utilization of transport assets
    """
    __tablename__ = "vehicle_sharing_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_code = Column(String(50), unique=True, nullable=False, index=True)
    
    # Requesting & Providing Entities
    requesting_entity_id = Column(Integer, ForeignKey("military_entities.id"), nullable=False)
    providing_entity_id = Column(Integer, ForeignKey("military_entities.id"), nullable=True)
    
    # Vehicle Requirements
    vehicle_type_required = Column(String(100), nullable=False, doc="Truck, ALS, Jeep, etc.")
    quantity_required = Column(Integer, default=1)
    capacity_tons_required = Column(Float, nullable=True)
    
    # Allocated Vehicles
    allocated_vehicle_ids = Column(JSON, default=list)
    
    # Duration
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    actual_return_date = Column(DateTime, nullable=True)
    
    # Purpose
    purpose = Column(Text, nullable=True)
    load_assignment_id = Column(Integer, ForeignKey("load_assignments.id"), nullable=True)
    
    # Status
    status = Column(String(50), default=SharingStatus.REQUESTED.value)
    approval_authority = Column(String(255), nullable=True)
    approval_date = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    # Priority
    priority = Column(String(50), default=LoadPriority.MEDIUM.value)
    ai_match_score = Column(Float, default=0.0, doc="AI calculated match score with providers")
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class VehiclePoolStatus(Base):
    """
    Vehicle Pool Status - Real-time vehicle availability tracking
    For monitoring and optimization
    """
    __tablename__ = "vehicle_pool_status"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("military_entities.id"), nullable=False)
    
    # Snapshot Time
    snapshot_time = Column(DateTime, default=datetime.utcnow)
    
    # Vehicle Counts by Type
    total_trucks = Column(Integer, default=0)
    available_trucks = Column(Integer, default=0)
    total_als = Column(Integer, default=0)  # Armoured Light Specialist
    available_als = Column(Integer, default=0)
    total_jeeps = Column(Integer, default=0)
    available_jeeps = Column(Integer, default=0)
    total_tankers = Column(Integer, default=0)
    available_tankers = Column(Integer, default=0)
    total_recovery = Column(Integer, default=0)
    available_recovery = Column(Integer, default=0)
    
    # Capacity
    total_capacity_tons = Column(Float, default=0.0)
    available_capacity_tons = Column(Float, default=0.0)
    
    # Utilization
    utilization_percentage = Column(Float, default=0.0)
    shared_out_count = Column(Integer, default=0)
    shared_in_count = Column(Integer, default=0)
    
    # Status
    maintenance_count = Column(Integer, default=0)
    fuel_critical_count = Column(Integer, default=0)


# ============================================================================
# MOVEMENT PLANNING MODELS
# ============================================================================

class MovementPlan(Base):
    """
    Movement Plan - Comprehensive convoy movement planning
    For optimal route, timing, and resource allocation
    """
    __tablename__ = "movement_plans"

    id = Column(Integer, primary_key=True, index=True)
    plan_code = Column(String(50), unique=True, nullable=False, index=True)
    plan_name = Column(String(255), nullable=False)
    
    # Associated Convoy
    convoy_id = Column(Integer, ForeignKey("convoys.id"), nullable=True)
    
    # Route Planning
    primary_route_id = Column(Integer, ForeignKey("routes.id"), nullable=False)
    alternate_route_id = Column(Integer, ForeignKey("routes.id"), nullable=True)
    
    # Timing
    planned_departure = Column(DateTime, nullable=False)
    planned_arrival = Column(DateTime, nullable=False)
    actual_departure = Column(DateTime, nullable=True)
    actual_arrival = Column(DateTime, nullable=True)
    
    # Halt Planning
    planned_halts = Column(JSON, default=list, doc="List of halt locations with times")
    halt_count = Column(Integer, default=0)
    total_halt_duration_hours = Column(Float, default=0.0)
    
    # Road Space Allocation
    road_space_window_start = Column(DateTime, nullable=True)
    road_space_window_end = Column(DateTime, nullable=True)
    road_space_slot_id = Column(Integer, ForeignKey("road_space_allocations.id"), nullable=True)
    
    # Load Details
    load_assignment_ids = Column(JSON, default=list)
    total_load_tons = Column(Float, default=0.0)
    vehicle_count = Column(Integer, default=0)
    
    # Risk Assessment
    overall_risk_score = Column(Float, default=0.0)
    threat_assessment = Column(JSON, default=dict)
    weather_assessment = Column(JSON, default=dict)
    
    # Status
    status = Column(String(50), default=MovementPlanStatus.DRAFT.value)
    approved_by = Column(String(255), nullable=True)
    approval_date = Column(DateTime, nullable=True)
    
    # AI Optimization
    ai_optimized = Column(Boolean, default=False)
    ai_optimization_score = Column(Float, default=0.0)
    ai_recommendations = Column(JSON, default=list)
    
    # Notifications
    entities_notified = Column(JSON, default=list, doc="List of entity IDs notified")
    
    # Metadata
    created_by = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MovementWaypoint(Base):
    """
    Waypoints in a movement plan
    For tracking intermediate points
    """
    __tablename__ = "movement_waypoints"

    id = Column(Integer, primary_key=True, index=True)
    movement_plan_id = Column(Integer, ForeignKey("movement_plans.id"), nullable=False)
    
    # Sequence
    sequence_number = Column(Integer, nullable=False)
    
    # Location
    waypoint_name = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    waypoint_type = Column(String(50), default="CHECKPOINT", doc="CHECKPOINT, TCP, TRANSIT_CAMP, HALT, REFUEL")
    
    # Timing
    expected_arrival = Column(DateTime, nullable=True)
    expected_departure = Column(DateTime, nullable=True)
    actual_arrival = Column(DateTime, nullable=True)
    actual_departure = Column(DateTime, nullable=True)
    planned_halt_duration_min = Column(Integer, default=0)
    
    # Status
    status = Column(String(50), default="PENDING", doc="PENDING, APPROACHING, ARRIVED, DEPARTED, SKIPPED")
    
    # Associated Resources
    tcp_id = Column(Integer, ForeignKey("tcps.id"), nullable=True)
    transit_camp_id = Column(Integer, ForeignKey("transit_camps.id"), nullable=True)


# ============================================================================
# ROAD SPACE MANAGEMENT MODELS
# ============================================================================

class RoadSpaceAllocation(Base):
    """
    Road Space Allocation - Time-slot based road usage management
    Prevents congestion and optimizes road utilization
    """
    __tablename__ = "road_space_allocations"

    id = Column(Integer, primary_key=True, index=True)
    allocation_code = Column(String(50), unique=True, nullable=False, index=True)
    
    # Route
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=False)
    route_segment_start_km = Column(Float, default=0.0)
    route_segment_end_km = Column(Float, nullable=True)
    
    # Time Window
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    
    # Allocation
    allocated_to_convoy_id = Column(Integer, ForeignKey("convoys.id"), nullable=True)
    allocated_to_movement_plan_id = Column(Integer, ForeignKey("movement_plans.id"), nullable=True)
    
    # Capacity
    lane_count = Column(Integer, default=1)
    direction = Column(String(20), default="BOTH", doc="FORWARD, REVERSE, BOTH")
    max_vehicles = Column(Integer, default=50)
    
    # Status
    status = Column(String(50), default=RoadSpaceStatus.AVAILABLE.value)
    
    # Conflict Detection
    has_conflict = Column(Boolean, default=False)
    conflict_details = Column(JSON, default=list)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============================================================================
# ENTITY NOTIFICATION MODELS
# ============================================================================

class EntityNotification(Base):
    """
    Entity Notification - Dynamic planning notifications to entities
    For real-time communication of convoy movements and alerts
    """
    __tablename__ = "entity_notifications"

    id = Column(Integer, primary_key=True, index=True)
    notification_code = Column(String(50), unique=True, nullable=False, index=True)
    
    # Target Entity
    entity_id = Column(Integer, ForeignKey("military_entities.id"), nullable=False)
    
    # Notification Type
    notification_type = Column(String(50), default=NotificationType.CONVOY_APPROACHING.value)
    priority = Column(String(50), default=LoadPriority.MEDIUM.value)
    
    # Content
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    details = Column(JSON, default=dict)
    
    # Related Resources
    convoy_id = Column(Integer, ForeignKey("convoys.id"), nullable=True)
    movement_plan_id = Column(Integer, ForeignKey("movement_plans.id"), nullable=True)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=True)
    
    # Timing
    created_at = Column(DateTime, default=datetime.utcnow)
    scheduled_for = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    
    # Status
    status = Column(String(50), default="PENDING", doc="PENDING, SENT, ACKNOWLEDGED, EXPIRED, FAILED")
    acknowledged_by = Column(String(255), nullable=True)
    
    # Delivery
    delivery_method = Column(String(50), default="SYSTEM", doc="SYSTEM, RADIO, SMS, EMAIL")
    retry_count = Column(Integer, default=0)


class NotificationTemplate(Base):
    """
    Notification Templates for standard messages
    """
    __tablename__ = "notification_templates"

    id = Column(Integer, primary_key=True, index=True)
    template_code = Column(String(50), unique=True, nullable=False)
    notification_type = Column(String(50), nullable=False)
    
    # Template Content
    title_template = Column(String(255), nullable=False)
    message_template = Column(Text, nullable=False)
    
    # Settings
    auto_send = Column(Boolean, default=True)
    default_priority = Column(String(50), default=LoadPriority.MEDIUM.value)
    
    # Metadata
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ============================================================================
# COMMAND CENTRE DASHBOARD MODELS
# ============================================================================

class CommandCentreMetrics(Base):
    """
    Command Centre Metrics - Aggregated metrics for dashboard
    Captures point-in-time snapshots of system state
    """
    __tablename__ = "command_centre_metrics"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_time = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Load Management Metrics
    total_load_pending_tons = Column(Float, default=0.0)
    total_load_in_transit_tons = Column(Float, default=0.0)
    total_load_delivered_today_tons = Column(Float, default=0.0)
    load_assignments_pending = Column(Integer, default=0)
    load_assignments_active = Column(Integer, default=0)
    load_assignments_completed_today = Column(Integer, default=0)
    
    # Vehicle Sharing Metrics
    sharing_requests_pending = Column(Integer, default=0)
    sharing_requests_active = Column(Integer, default=0)
    vehicles_shared_out = Column(Integer, default=0)
    vehicles_shared_in = Column(Integer, default=0)
    sharing_utilization_rate = Column(Float, default=0.0)
    
    # Movement Planning Metrics
    active_movement_plans = Column(Integer, default=0)
    convoys_in_transit = Column(Integer, default=0)
    convoys_at_halt = Column(Integer, default=0)
    convoys_completed_today = Column(Integer, default=0)
    avg_eta_accuracy = Column(Float, default=0.0)
    
    # Road Space Metrics
    road_space_utilization = Column(Float, default=0.0)
    active_allocations = Column(Integer, default=0)
    conflicts_detected = Column(Integer, default=0)
    
    # Notification Metrics
    notifications_sent_today = Column(Integer, default=0)
    notifications_pending = Column(Integer, default=0)
    notifications_acknowledged = Column(Integer, default=0)
    avg_acknowledgement_time_min = Column(Float, default=0.0)
    
    # Overall System Metrics
    system_efficiency_score = Column(Float, default=0.0)
    ai_optimization_rate = Column(Float, default=0.0)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
