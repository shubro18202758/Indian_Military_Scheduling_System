"""
AI Inference Log Model
Tracks all AI model calls for auditing, performance monitoring, and fallback analysis.
"""
from sqlalchemy import String, Integer, Float, Boolean, Column, DateTime, Text, JSON
from datetime import datetime
from app.core.database import Base


class AIInferenceLog(Base):
    """
    Logs every AI inference request and response.
    Used for auditing, performance analysis, and debugging.
    """
    __tablename__ = "ai_inference_logs"

    id = Column(Integer, primary_key=True, index=True)
    
    # Request context
    request_id = Column(String, unique=True, index=True, doc="Unique request identifier")
    request_type = Column(String, index=True, doc="Type: ROUTE, THREAT, LOAD, CONVOY, FOL, etc.")
    model_name = Column(String, doc="Model used: janus:latest, heuristic, etc.")
    provider = Column(String, doc="Provider: ollama, lm_studio, heuristic")
    
    # Input
    prompt = Column(Text, doc="Full prompt sent to AI")
    context_data = Column(JSON, nullable=True, doc="Structured context data")
    
    # Output
    response = Column(Text, nullable=True, doc="AI response text")
    parsed_result = Column(JSON, nullable=True, doc="Parsed structured result")
    confidence_score = Column(Float, nullable=True, doc="AI confidence 0-1")
    
    # Performance
    inference_time_ms = Column(Integer, doc="Time taken for inference in ms")
    tokens_input = Column(Integer, nullable=True, doc="Input token count")
    tokens_output = Column(Integer, nullable=True, doc="Output token count")
    gpu_used = Column(Boolean, default=False, doc="Whether GPU was used")
    gpu_memory_mb = Column(Float, nullable=True, doc="GPU memory used in MB")
    
    # Status
    status = Column(String, default="SUCCESS", doc="SUCCESS, FAILED, FALLBACK, TIMEOUT")
    error_message = Column(Text, nullable=True)
    fallback_used = Column(Boolean, default=False, doc="Whether heuristic fallback was used")
    
    # Convoy/Entity context
    convoy_id = Column(Integer, nullable=True, index=True)
    entity_id = Column(Integer, nullable=True)
    route_id = Column(Integer, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class AIRecommendationHistory(Base):
    """
    Stores AI-generated recommendations for historical analysis and learning.
    """
    __tablename__ = "ai_recommendation_history"

    id = Column(Integer, primary_key=True, index=True)
    
    # Reference
    inference_log_id = Column(Integer, nullable=True, doc="Link to inference log")
    convoy_id = Column(Integer, nullable=True, index=True)
    route_id = Column(Integer, nullable=True)
    
    # Recommendation details
    recommendation_type = Column(String, index=True, doc="ROUTE, HALT, SPEED, FORMATION, FOL")
    priority = Column(String, doc="CRITICAL, HIGH, MEDIUM, LOW")
    title = Column(String)
    description = Column(Text)
    action_items = Column(JSON, doc="List of action items")
    
    # Validity
    valid_from = Column(DateTime, default=datetime.utcnow)
    valid_until = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    
    # Outcome tracking
    was_followed = Column(Boolean, nullable=True, doc="Did user follow recommendation?")
    outcome = Column(String, nullable=True, doc="POSITIVE, NEGATIVE, NEUTRAL, UNKNOWN")
    feedback_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)


class VTKMCalculation(Base):
    """
    Stores VTKM (Vehicles To Kilometre) calculations for convoy planning.
    """
    __tablename__ = "vtkm_calculations"

    id = Column(Integer, primary_key=True, index=True)
    
    convoy_id = Column(Integer, index=True)
    route_id = Column(Integer, nullable=True)
    
    # VTKM metrics
    total_vehicles = Column(Integer)
    convoy_length_km = Column(Float, doc="Total length of convoy in km")
    vtkm = Column(Float, doc="Vehicles per kilometre")
    
    # Spacing
    inter_vehicle_distance_m = Column(Float, doc="Distance between vehicles in meters")
    recommended_spacing_m = Column(Float, doc="AI-recommended spacing")
    formation_type = Column(String, doc="COLUMN, STAGGERED, etc.")
    
    # Context
    terrain_type = Column(String, doc="PLAINS, MOUNTAINOUS, etc.")
    threat_level = Column(String, doc="GREEN, YELLOW, ORANGE, RED")
    visibility_km = Column(Float, nullable=True)
    
    # AI Analysis
    ai_recommendation = Column(Text, nullable=True)
    optimal_vtkm = Column(Float, nullable=True, doc="AI-suggested optimal VTKM")
    
    created_at = Column(DateTime, default=datetime.utcnow)


class FOLRequirement(Base):
    """
    Fuel, Oil, Lubricant requirements for convoy journeys.
    Used for intimation to receiving stations.
    """
    __tablename__ = "fol_requirements"

    id = Column(Integer, primary_key=True, index=True)
    
    # Reference
    convoy_id = Column(Integer, index=True)
    route_id = Column(Integer, nullable=True)
    destination_station_id = Column(Integer, nullable=True)
    
    # Fuel requirements (in liters)
    diesel_required = Column(Float, default=0.0)
    petrol_required = Column(Float, default=0.0)
    aviation_fuel_required = Column(Float, default=0.0)
    
    # Oil and lubricants
    engine_oil_liters = Column(Float, default=0.0)
    gear_oil_liters = Column(Float, default=0.0)
    
    # Calculation basis
    total_distance_km = Column(Float)
    num_vehicles = Column(Integer)
    avg_consumption_kmpl = Column(Float, doc="Average km per liter")
    buffer_percent = Column(Float, default=20.0, doc="Safety buffer percentage")
    
    # For return/night stay
    return_journey_fuel = Column(Float, default=0.0)
    night_stay_requirements = Column(JSON, nullable=True)
    
    # Intimation status
    intimation_status = Column(String, default="PENDING", doc="PENDING, SENT, ACKNOWLEDGED, FULFILLED")
    intimation_sent_at = Column(DateTime, nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    
    # AI analysis
    ai_calculated = Column(Boolean, default=False)
    ai_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MovementOrder(Base):
    """
    Generated movement orders for convoys.
    Contains all information needed for convoy movement instructions.
    """
    __tablename__ = "movement_orders"

    id = Column(Integer, primary_key=True, index=True)
    
    # Reference
    order_number = Column(String, unique=True, index=True, doc="MO-2026-001 format")
    convoy_id = Column(Integer, index=True)
    route_id = Column(Integer, nullable=True)
    
    # Order details
    classification = Column(String, default="RESTRICTED", doc="UNCLASSIFIED, RESTRICTED, CONFIDENTIAL, SECRET")
    issuing_authority = Column(String)
    issuing_unit = Column(String)
    
    # Journey details
    origin_station = Column(String)
    destination_station = Column(String)
    via_points = Column(JSON, doc="List of intermediate points")
    
    # Timing
    departure_datetime = Column(DateTime)
    expected_arrival = Column(DateTime)
    
    # Convoy composition
    vehicle_manifest = Column(JSON, doc="List of vehicles with types, reg numbers")
    total_vehicles = Column(Integer)
    total_personnel = Column(Integer)
    cargo_description = Column(Text)
    cargo_weight_tons = Column(Float)
    
    # VTKM and spacing
    vtkm = Column(Float)
    inter_vehicle_distance_m = Column(Float)
    formation = Column(String)
    
    # TCP timeline
    tcp_schedule = Column(JSON, doc="ETA for each TCP crossing")
    
    # Halts
    planned_halts = Column(JSON, doc="Transit camps with arrival/departure times")
    
    # FOL
    fol_requirements = Column(JSON)
    
    # Speed limits
    max_speed_kmph = Column(Integer, default=40)
    night_speed_kmph = Column(Integer, default=30)
    
    # Communication
    radio_frequencies = Column(JSON, nullable=True)
    call_signs = Column(JSON, nullable=True)
    
    # Status
    status = Column(String, default="DRAFT", doc="DRAFT, ISSUED, ACTIVE, COMPLETED, CANCELLED")
    
    # AI generation
    ai_generated = Column(Boolean, default=False)
    ai_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    issued_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class HaltIntimation(Base):
    """
    Formal intimation to transit camps about incoming convoy halts.
    """
    __tablename__ = "halt_intimations"

    id = Column(Integer, primary_key=True, index=True)
    
    # Reference
    intimation_number = Column(String, unique=True, index=True)
    convoy_id = Column(Integer, index=True)
    transit_camp_id = Column(Integer, index=True)
    movement_order_id = Column(Integer, nullable=True)
    
    # Convoy details for the camp
    convoy_callsign = Column(String)
    expected_arrival = Column(DateTime)
    expected_departure = Column(DateTime)
    halt_duration_hours = Column(Float)
    
    # Requirements
    vehicles_count = Column(Integer)
    personnel_count = Column(Integer)
    officer_count = Column(Integer, default=0)
    jco_count = Column(Integer, default=0, doc="Junior Commissioned Officers")
    or_count = Column(Integer, default=0, doc="Other Ranks")
    
    # Equipment
    equipment_list = Column(JSON, doc="List of special equipment")
    
    # Support required
    fuel_diesel_liters = Column(Float, default=0.0)
    fuel_petrol_liters = Column(Float, default=0.0)
    rations_required = Column(Boolean, default=True)
    medical_support = Column(Boolean, default=False)
    maintenance_support = Column(Boolean, default=False)
    communication_support = Column(Boolean, default=True)
    
    # Special requirements
    special_requirements = Column(Text, nullable=True)
    security_requirements = Column(Text, nullable=True)
    
    # Status
    status = Column(String, default="DRAFT", doc="DRAFT, SENT, RECEIVED, ACKNOWLEDGED, PREPARED")
    sent_at = Column(DateTime, nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    acknowledged_by = Column(String, nullable=True)
    
    # AI
    ai_generated = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CivilVehicle(Base):
    """
    Civil transport assets requisitioned for military use.
    """
    __tablename__ = "civil_vehicles"

    id = Column(Integer, primary_key=True, index=True)
    
    # Vehicle identification
    registration_number = Column(String, unique=True, index=True)
    vehicle_type = Column(String, doc="TRUCK, BUS, TANKER, CRANE, etc.")
    make = Column(String, nullable=True)
    model = Column(String, nullable=True)
    year = Column(Integer, nullable=True)
    
    # Capacity
    capacity_tons = Column(Float, nullable=True)
    capacity_passengers = Column(Integer, nullable=True)
    fuel_tank_liters = Column(Float, nullable=True)
    
    # Owner details
    owner_name = Column(String)
    owner_contact = Column(String)
    owner_address = Column(Text, nullable=True)
    
    # Requisition details
    requisition_status = Column(String, default="AVAILABLE", 
        doc="AVAILABLE, REQUISITIONED, IN_USE, RELEASED, UNAVAILABLE")
    requisition_order_number = Column(String, nullable=True)
    requisitioned_date = Column(DateTime, nullable=True)
    requisitioned_by = Column(String, nullable=True)
    assigned_to_entity = Column(String, nullable=True)
    
    # Current status
    current_location_lat = Column(Float, nullable=True)
    current_location_lon = Column(Float, nullable=True)
    is_operational = Column(Boolean, default=True)
    
    # Area of responsibility
    aor_command = Column(String, nullable=True, doc="Northern, Eastern, Western, etc.")
    aor_region = Column(String, nullable=True)
    
    # Compensation
    daily_rate = Column(Float, nullable=True, doc="Compensation rate per day")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CivilRequisition(Base):
    """
    Requisition requests and approvals for civil vehicles.
    """
    __tablename__ = "civil_requisitions"

    id = Column(Integer, primary_key=True, index=True)
    
    # Request details
    requisition_number = Column(String, unique=True, index=True)
    requesting_unit = Column(String)
    requesting_officer = Column(String)
    
    # Requirements
    vehicle_type_required = Column(String)
    quantity_required = Column(Integer)
    capacity_required_tons = Column(Float, nullable=True)
    
    # Purpose
    purpose = Column(String, doc="TROOP_MOVEMENT, CARGO, MEDICAL, etc.")
    description = Column(Text, nullable=True)
    
    # Duration
    required_from = Column(DateTime)
    required_until = Column(DateTime)
    
    # Location
    pickup_location = Column(String)
    destination = Column(String)
    
    # Status
    status = Column(String, default="PENDING", 
        doc="PENDING, APPROVED, PARTIALLY_FULFILLED, FULFILLED, REJECTED, CANCELLED")
    approved_by = Column(String, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    # Assigned vehicles
    assigned_vehicles = Column(JSON, nullable=True, doc="List of civil vehicle IDs")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
