"""
Load Management Models
======================
Database models for AI-powered load and volume management system.
Handles cargo prioritization, vehicle capacity, and load assignments.
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum as SQLEnum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class LoadPriority(str, enum.Enum):
    """Load priority levels for cargo prioritization"""
    FLASH = "FLASH"           # Immediate - life threatening
    IMMEDIATE = "IMMEDIATE"   # Within 1 hour
    PRIORITY = "PRIORITY"     # Within 4 hours  
    ROUTINE = "ROUTINE"       # Within 24 hours
    DEFERRED = "DEFERRED"     # Can wait


class CargoCategory(str, enum.Enum):
    """Categories of cargo for load management"""
    AMMUNITION = "AMMUNITION"
    FUEL_POL = "FUEL_POL"
    RATIONS = "RATIONS"
    MEDICAL = "MEDICAL"
    EQUIPMENT = "EQUIPMENT"
    PERSONNEL = "PERSONNEL"
    ENGINEERING = "ENGINEERING"
    SIGNALS = "SIGNALS"
    GENERAL = "GENERAL"


class LoadStatus(str, enum.Enum):
    """Status of load assignments"""
    PENDING = "PENDING"
    ASSIGNED = "ASSIGNED"
    LOADING = "LOADING"
    IN_TRANSIT = "IN_TRANSIT"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


class LoadRequest(Base):
    """
    Load requests from various entities requiring transport.
    AI prioritizes and assigns these to available vehicles.
    """
    __tablename__ = "load_requests"

    id = Column(Integer, primary_key=True, index=True)
    
    # Request identification
    request_code = Column(String(50), unique=True, nullable=False)
    requesting_entity = Column(String(100), nullable=False)  # Unit/Formation making request
    requesting_officer = Column(String(100))
    contact_info = Column(String(100))
    
    # Cargo details
    cargo_category = Column(SQLEnum(CargoCategory), default=CargoCategory.GENERAL)
    cargo_description = Column(Text)
    weight_tons = Column(Float, default=0.0)
    volume_cubic_m = Column(Float, default=0.0)
    quantity = Column(Integer, default=1)
    is_hazardous = Column(Boolean, default=False)
    requires_refrigeration = Column(Boolean, default=False)
    is_fragile = Column(Boolean, default=False)
    requires_escort = Column(Boolean, default=False)
    
    # Priority and timing
    priority = Column(SQLEnum(LoadPriority), default=LoadPriority.ROUTINE)
    priority_score = Column(Float, default=50.0)  # AI-calculated 0-100
    requested_pickup_time = Column(DateTime(timezone=True))
    required_delivery_time = Column(DateTime(timezone=True))
    
    # Locations
    pickup_location = Column(String(200), nullable=False)
    pickup_lat = Column(Float)
    pickup_lng = Column(Float)
    delivery_location = Column(String(200), nullable=False)
    delivery_lat = Column(Float)
    delivery_lng = Column(Float)
    
    # Status and assignment
    status = Column(SQLEnum(LoadStatus), default=LoadStatus.PENDING)
    assigned_convoy_id = Column(Integer, ForeignKey("convoys.id"), nullable=True)
    assigned_vehicle_id = Column(Integer, ForeignKey("transport_assets.id"), nullable=True)
    
    # AI analysis
    ai_priority_reason = Column(Text)  # Why AI assigned this priority
    ai_vehicle_match_score = Column(Float)  # How well the assigned vehicle matches
    ai_route_recommendation = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    assigned_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))

    # Relationships
    convoy = relationship("Convoy", back_populates="load_requests")


class VehicleCapacity(Base):
    """
    Vehicle capacity details for load matching.
    Used by AI to optimally assign loads to vehicles.
    """
    __tablename__ = "vehicle_capacities"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("transport_assets.id"), unique=True)
    
    # Weight capacity
    max_weight_tons = Column(Float, default=10.0)
    current_weight_tons = Column(Float, default=0.0)
    
    # Volume capacity
    max_volume_cubic_m = Column(Float, default=30.0)
    current_volume_cubic_m = Column(Float, default=0.0)
    
    # Special capabilities
    can_carry_hazardous = Column(Boolean, default=False)
    has_refrigeration = Column(Boolean, default=False)
    can_carry_personnel = Column(Boolean, default=True)
    max_personnel = Column(Integer, default=0)
    current_personnel = Column(Integer, default=0)
    
    # Vehicle type suitability scores (0-100)
    ammunition_suitability = Column(Float, default=50.0)
    fuel_suitability = Column(Float, default=50.0)
    rations_suitability = Column(Float, default=80.0)
    medical_suitability = Column(Float, default=70.0)
    equipment_suitability = Column(Float, default=80.0)
    personnel_suitability = Column(Float, default=60.0)
    
    # Availability
    is_available = Column(Boolean, default=True)
    availability_reason = Column(String(200))
    next_available_time = Column(DateTime(timezone=True))
    
    # Utilization tracking
    utilization_pct = Column(Float, default=0.0)
    trips_completed = Column(Integer, default=0)
    total_weight_transported = Column(Float, default=0.0)
    
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    asset = relationship("TransportAsset")


class VehicleSharingPool(Base):
    """
    Pool of vehicles available for sharing between entities.
    AI manages allocation based on demand and priority.
    """
    __tablename__ = "vehicle_sharing_pool"

    id = Column(Integer, primary_key=True, index=True)
    
    # Pool identification
    pool_name = Column(String(100), nullable=False)
    pool_code = Column(String(20), unique=True)
    managing_entity = Column(String(100))  # Entity that manages the pool
    
    # Pool configuration
    total_vehicles = Column(Integer, default=0)
    available_vehicles = Column(Integer, default=0)
    reserved_vehicles = Column(Integer, default=0)
    
    # Sharing rules
    max_share_duration_hours = Column(Integer, default=48)
    min_advance_booking_hours = Column(Integer, default=4)
    priority_entities = Column(JSON)  # List of entities with priority access
    
    # Geographic scope
    operational_area = Column(String(200))
    base_location = Column(String(200))
    base_lat = Column(Float)
    base_lng = Column(Float)
    max_operating_radius_km = Column(Float, default=200.0)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class AIVehicleSharingRequest(Base):
    """
    Requests from entities to borrow vehicles from sharing pool.
    AI evaluates and approves/denies based on availability and priority.
    """
    __tablename__ = "ai_vehicle_sharing_requests"

    id = Column(Integer, primary_key=True, index=True)
    
    # Request details
    request_code = Column(String(50), unique=True)
    pool_id = Column(Integer, ForeignKey("vehicle_sharing_pool.id"))
    requesting_entity = Column(String(100), nullable=False)
    requesting_officer = Column(String(100))
    
    # Vehicle requirements
    vehicle_type_required = Column(String(50))
    quantity_required = Column(Integer, default=1)
    special_requirements = Column(Text)
    
    # Timing
    required_from = Column(DateTime(timezone=True), nullable=False)
    required_until = Column(DateTime(timezone=True), nullable=False)
    
    # Purpose
    purpose = Column(Text)
    mission_priority = Column(SQLEnum(LoadPriority), default=LoadPriority.ROUTINE)
    
    # AI Decision
    status = Column(String(20), default="PENDING")  # PENDING, APPROVED, DENIED, CANCELLED
    ai_decision_reason = Column(Text)
    ai_confidence_score = Column(Float)
    approved_quantity = Column(Integer)
    
    # Assignment
    assigned_vehicle_ids = Column(JSON)  # List of assigned vehicle IDs
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    decided_at = Column(DateTime(timezone=True))
    
    # Relationships
    pool = relationship("VehicleSharingPool")


class AIMovementPlan(Base):
    """
    AI-generated movement plans for optimal convoy routing.
    Considers routes, halts, road space, and timing.
    """
    __tablename__ = "ai_lm_movement_plans"

    id = Column(Integer, primary_key=True, index=True)
    
    # Plan identification
    plan_code = Column(String(50), unique=True)
    convoy_id = Column(Integer, ForeignKey("convoys.id"))
    
    # Route planning
    planned_route_id = Column(Integer, ForeignKey("routes.id"))
    alternate_route_id = Column(Integer, ForeignKey("routes.id"))
    
    # Timing
    planned_departure = Column(DateTime(timezone=True))
    planned_arrival = Column(DateTime(timezone=True))
    estimated_duration_hours = Column(Float)
    
    # Road space allocation
    road_space_slot = Column(String(50))  # Time slot for road usage
    convoy_spacing_km = Column(Float, default=0.5)  # Spacing between vehicles
    max_speed_kmh = Column(Float, default=40.0)
    
    # Halt planning
    planned_halts = Column(JSON)  # List of halt points with timing
    # Format: [{"tcp_id": 1, "arrival": "2024-01-01T10:00", "duration_mins": 30, "purpose": "REFUEL"}]
    
    # Optimization scores
    route_efficiency_score = Column(Float)  # 0-100
    time_optimization_score = Column(Float)  # 0-100
    fuel_optimization_score = Column(Float)  # 0-100
    safety_score = Column(Float)  # 0-100
    overall_score = Column(Float)  # 0-100
    
    # AI reasoning
    ai_optimization_notes = Column(Text)
    ai_risk_assessment = Column(Text)
    ai_recommendations = Column(JSON)  # List of recommendations
    
    # Status
    status = Column(String(20), default="DRAFT")  # DRAFT, APPROVED, ACTIVE, COMPLETED, CANCELLED
    approved_by = Column(String(100))
    approved_at = Column(DateTime(timezone=True))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    convoy = relationship("Convoy")


class AIRoadSpaceAllocation(Base):
    """
    Road space management for optimal convoy scheduling.
    Prevents congestion and ensures safe spacing.
    """
    __tablename__ = "ai_lm_road_space_allocations"

    id = Column(Integer, primary_key=True, index=True)
    
    # Route segment
    route_id = Column(Integer, ForeignKey("routes.id"))
    segment_start = Column(String(100))
    segment_end = Column(String(100))
    segment_distance_km = Column(Float)
    
    # Time slot
    slot_start = Column(DateTime(timezone=True))
    slot_end = Column(DateTime(timezone=True))
    
    # Allocation
    convoy_id = Column(Integer, ForeignKey("convoys.id"))
    direction = Column(String(20))  # NORTHBOUND, SOUTHBOUND, etc.
    
    # Capacity
    max_vehicles_per_hour = Column(Integer, default=20)
    current_allocation = Column(Integer, default=0)
    utilization_pct = Column(Float, default=0.0)
    
    # Status
    status = Column(String(20), default="RESERVED")  # RESERVED, ACTIVE, COMPLETED, CANCELLED
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AIEntityNotification(Base):
    """
    Dynamic notifications to entities en-route.
    AI generates and sends alerts about changes, delays, threats.
    """
    __tablename__ = "ai_lm_entity_notifications"

    id = Column(Integer, primary_key=True, index=True)
    
    # Notification details
    notification_code = Column(String(50), unique=True)
    notification_type = Column(String(50))  # DELAY, ROUTE_CHANGE, THREAT, ARRIVAL, HALT, etc.
    priority = Column(SQLEnum(LoadPriority), default=LoadPriority.ROUTINE)
    
    # Target
    target_entity = Column(String(100))  # Entity to notify
    target_convoy_id = Column(Integer, ForeignKey("convoys.id"), nullable=True)
    target_tcp_id = Column(Integer, ForeignKey("tcps.id"), nullable=True)
    
    # Content
    title = Column(String(200))
    message = Column(Text)
    action_required = Column(Text)
    
    # Location context
    relevant_location = Column(String(200))
    relevant_lat = Column(Float)
    relevant_lng = Column(Float)
    
    # Timing
    effective_from = Column(DateTime(timezone=True))
    effective_until = Column(DateTime(timezone=True))
    
    # AI context
    ai_generated = Column(Boolean, default=True)
    ai_trigger_reason = Column(Text)
    ai_confidence = Column(Float)
    
    # Delivery status
    status = Column(String(20), default="PENDING")  # PENDING, SENT, ACKNOWLEDGED, EXPIRED
    sent_at = Column(DateTime(timezone=True))
    acknowledged_at = Column(DateTime(timezone=True))
    acknowledged_by = Column(String(100))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    convoy = relationship("Convoy")
