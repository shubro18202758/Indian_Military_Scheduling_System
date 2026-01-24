"""
Military Convoy Tracking Database Models
==========================================

Advanced tracking models for Indian Army convoy operations.
Designed for real-time tracking similar to FlightRadar24 but for military carriers.

Security Classification: RESTRICTED
"""

from sqlalchemy import String, Integer, Float, Boolean, Column, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class ConvoyTracking(Base):
    """
    Real-time tracking data for convoys.
    Updated every tick with position, speed, heading, and status.
    """
    __tablename__ = "convoy_tracking"
    
    id = Column(Integer, primary_key=True, index=True)
    convoy_id = Column(Integer, ForeignKey("convoys.id"), index=True)
    
    # Real-time Position (WGS84)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    altitude_m = Column(Float, default=0.0, doc="Altitude in meters ASL")
    
    # Movement Data
    speed_kmh = Column(Float, default=0.0, doc="Current speed in km/h")
    heading_deg = Column(Float, default=0.0, doc="Heading 0-360 degrees")
    ground_track = Column(Float, default=0.0, doc="Actual track over ground")
    
    # Distance Tracking
    distance_covered_km = Column(Float, default=0.0)
    distance_remaining_km = Column(Float, default=0.0)
    route_progress_pct = Column(Float, default=0.0, doc="Percentage of route completed")
    
    # Time Data
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    eta_destination = Column(DateTime, nullable=True)
    time_elapsed_minutes = Column(Integer, default=0)
    time_remaining_minutes = Column(Integer, default=0)
    
    # Status
    movement_status = Column(String, default="STATIONARY", 
                            doc="STATIONARY, MOVING, HALTED, DELAYED, EMERGENCY")
    halt_reason = Column(String, nullable=True)
    
    # Checkpoint Progress
    last_checkpoint_id = Column(String, nullable=True)
    last_checkpoint_name = Column(String, nullable=True)
    last_checkpoint_time = Column(DateTime, nullable=True)
    next_checkpoint_id = Column(String, nullable=True)
    next_checkpoint_name = Column(String, nullable=True)
    next_checkpoint_eta = Column(DateTime, nullable=True)
    
    convoy = relationship("Convoy")


class ConvoyMission(Base):
    """
    Mission details for each convoy - military intelligence grade data.
    """
    __tablename__ = "convoy_missions"
    
    id = Column(Integer, primary_key=True, index=True)
    convoy_id = Column(Integer, ForeignKey("convoys.id"), unique=True, index=True)
    
    # Mission Identification
    mission_id = Column(String, unique=True, index=True, doc="e.g., OP-KAVACH-2026-0124")
    mission_code = Column(String, doc="Code name: EAGLE STRIKE, SNOW LEOPARD, etc.")
    operation_name = Column(String, nullable=True, doc="Parent operation if applicable")
    
    # Classification
    security_classification = Column(String, default="RESTRICTED",
                                    doc="UNCLASSIFIED, RESTRICTED, CONFIDENTIAL, SECRET, TOP_SECRET")
    compartment_code = Column(String, nullable=True, doc="SCI compartment if applicable")
    
    # Unit Information
    unit_id = Column(String, doc="e.g., 15-KUMAON, 4-RAJRIF, 121-INF-BDE")
    unit_name = Column(String, doc="Full unit name")
    formation = Column(String, doc="Division/Brigade/Corps: 15 Corps, 14 Corps, etc.")
    command = Column(String, doc="Northern Command, Western Command, etc.")
    
    # Personnel
    personnel_count = Column(Integer, default=0)
    officer_count = Column(Integer, default=0)
    jco_count = Column(Integer, default=0, doc="JCO - Junior Commissioned Officers")
    or_count = Column(Integer, default=0, doc="Other Ranks")
    
    # Cargo Manifest
    cargo_type = Column(String, doc="AMMUNITION, RATIONS, FUEL, EQUIPMENT, MIXED, PERSONNEL")
    cargo_description = Column(Text, nullable=True)
    cargo_weight_tons = Column(Float, default=0.0)
    cargo_value_classification = Column(String, default="STANDARD",
                                        doc="STANDARD, HIGH_VALUE, CRITICAL, STRATEGIC")
    hazmat_class = Column(String, nullable=True, doc="Hazardous material classification")
    
    # Vehicle Details
    vehicle_count = Column(Integer, default=0)
    vehicle_types = Column(JSON, default=list, doc="List of vehicle types in convoy")
    lead_vehicle_callsign = Column(String, nullable=True)
    tail_vehicle_callsign = Column(String, nullable=True)
    
    # Armament Status
    armed_escort = Column(Boolean, default=False)
    escort_unit = Column(String, nullable=True, doc="Escort unit designation")
    escort_strength = Column(Integer, default=0)
    weapons_carried = Column(JSON, default=list, doc="Types of weapons in convoy")
    
    # Communication
    primary_freq = Column(String, nullable=True, doc="Primary radio frequency")
    alternate_freq = Column(String, nullable=True)
    satcom_enabled = Column(Boolean, default=False)
    callsign = Column(String, doc="Radio callsign: ALPHA-BRAVO-7")
    
    # Mission Parameters
    mission_priority = Column(String, default="ROUTINE",
                             doc="FLASH, IMMEDIATE, PRIORITY, ROUTINE")
    mission_type = Column(String, doc="RESUPPLY, REINFORCEMENT, EVACUATION, PATROL, RELIEF")
    authorized_by = Column(String, nullable=True, doc="Authorizing officer")
    authorized_rank = Column(String, nullable=True)
    
    # Timing
    mission_start_time = Column(DateTime, nullable=True)
    mission_deadline = Column(DateTime, nullable=True, doc="Must arrive by")
    
    # Status
    mission_status = Column(String, default="PLANNED",
                           doc="PLANNED, ACTIVE, COMPLETED, ABORTED, DELAYED")
    completion_percentage = Column(Float, default=0.0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    convoy = relationship("Convoy")


class VehicleTracking(Base):
    """
    Individual vehicle tracking within a convoy.
    """
    __tablename__ = "vehicle_tracking"
    
    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("transport_assets.id"), index=True)
    convoy_id = Column(Integer, ForeignKey("convoys.id"), index=True)
    
    # Vehicle Identification
    vehicle_callsign = Column(String, doc="e.g., ALPHA-1, BRAVO-3")
    registration_number = Column(String, doc="Army registration: 01A-1234")
    vehicle_type = Column(String, doc="Stallion, Shaktiman, Gypsy, BMP-2, etc.")
    vehicle_class = Column(String, doc="LOGISTICS, APC, ARTILLERY, COMMAND, MEDICAL")
    
    # Position in Convoy
    convoy_position = Column(Integer, doc="Position in convoy: 1=lead, -1=tail")
    is_lead_vehicle = Column(Boolean, default=False)
    is_tail_vehicle = Column(Boolean, default=False)
    is_command_vehicle = Column(Boolean, default=False)
    
    # Real-time Position
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    altitude_m = Column(Float, default=0.0)
    speed_kmh = Column(Float, default=0.0)
    heading_deg = Column(Float, default=0.0)
    
    # Vehicle Status
    engine_status = Column(String, default="OFF", doc="OFF, IDLE, RUNNING")
    fuel_level_pct = Column(Float, default=100.0)
    fuel_range_km = Column(Float, default=0.0, doc="Estimated range with current fuel")
    
    # Health Monitoring
    engine_temp_c = Column(Float, nullable=True)
    oil_pressure_psi = Column(Float, nullable=True)
    battery_voltage = Column(Float, nullable=True)
    tire_pressure_status = Column(String, default="NORMAL")
    maintenance_due = Column(Boolean, default=False)
    last_maintenance_date = Column(DateTime, nullable=True)
    
    # Communication Status
    radio_status = Column(String, default="OPERATIONAL")
    gps_status = Column(String, default="LOCKED", doc="LOCKED, SEARCHING, LOST")
    last_comm_time = Column(DateTime, nullable=True)
    
    # Crew
    driver_name = Column(String, nullable=True)
    driver_rank = Column(String, nullable=True)
    commander_name = Column(String, nullable=True)
    commander_rank = Column(String, nullable=True)
    crew_count = Column(Integer, default=1)
    
    # Load
    current_load_tons = Column(Float, default=0.0)
    load_type = Column(String, nullable=True)
    passengers = Column(Integer, default=0)
    
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    asset = relationship("TransportAsset")
    convoy = relationship("Convoy")


class CheckpointCrossing(Base):
    """
    Record of convoy crossing through checkpoints (TCPs, camps, forward posts).
    """
    __tablename__ = "checkpoint_crossings"
    
    id = Column(Integer, primary_key=True, index=True)
    convoy_id = Column(Integer, ForeignKey("convoys.id"), index=True)
    
    # Checkpoint Details
    checkpoint_type = Column(String, doc="TCP, TRANSIT_CAMP, FORWARD_POST, AMMO_POINT, FUEL_POINT, MEDICAL")
    checkpoint_id = Column(String)
    checkpoint_name = Column(String)
    checkpoint_lat = Column(Float)
    checkpoint_lng = Column(Float)
    
    # Crossing Data
    scheduled_arrival = Column(DateTime, nullable=True)
    actual_arrival = Column(DateTime, nullable=True)
    departure_time = Column(DateTime, nullable=True)
    
    # Status
    crossing_status = Column(String, default="PENDING",
                            doc="PENDING, ARRIVED, CLEARED, DEPARTED, SKIPPED, DELAYED")
    delay_minutes = Column(Integer, default=0)
    delay_reason = Column(String, nullable=True)
    
    # Verification
    verified_by = Column(String, nullable=True, doc="Officer who verified crossing")
    verified_rank = Column(String, nullable=True)
    vehicle_count_verified = Column(Integer, nullable=True)
    personnel_count_verified = Column(Integer, nullable=True)
    
    # Notes
    remarks = Column(Text, nullable=True)
    security_status = Column(String, default="GREEN", doc="GREEN, AMBER, RED")
    
    convoy = relationship("Convoy")


class TrackingPrediction(Base):
    """
    AI-generated predictions and forecasts for convoy operations.
    Powered by Janus Pro 7B with GPU acceleration.
    """
    __tablename__ = "tracking_predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    convoy_id = Column(Integer, ForeignKey("convoys.id"), index=True)
    
    # Prediction Metadata
    prediction_id = Column(String, unique=True, index=True)
    prediction_type = Column(String, doc="ETA, THREAT, ROUTE, FUEL, MAINTENANCE, WEATHER, MISSION")
    generated_at = Column(DateTime, default=datetime.utcnow)
    valid_until = Column(DateTime, nullable=True)
    
    # AI Model Info
    model_used = Column(String, default="JANUS_PRO_7B")
    gpu_accelerated = Column(Boolean, default=True)
    inference_time_ms = Column(Integer, nullable=True)
    confidence_score = Column(Float, default=0.0)
    
    # Prediction Content
    prediction_title = Column(String)
    prediction_summary = Column(Text)
    prediction_details = Column(JSON, default=dict)
    
    # Risk Assessment
    risk_level = Column(String, default="LOW", doc="LOW, MEDIUM, HIGH, CRITICAL")
    impact_assessment = Column(Text, nullable=True)
    
    # Recommendations
    recommended_actions = Column(JSON, default=list)
    alternative_options = Column(JSON, default=list)
    
    # For Authority Review
    requires_action = Column(Boolean, default=False)
    action_deadline = Column(DateTime, nullable=True)
    reviewed_by = Column(String, nullable=True)
    review_status = Column(String, default="PENDING", doc="PENDING, ACKNOWLEDGED, ACTIONED, DISMISSED")
    
    convoy = relationship("Convoy")


class ObstacleImpact(Base):
    """
    Records impact of obstacles on convoy tracking.
    """
    __tablename__ = "obstacle_impacts"
    
    id = Column(Integer, primary_key=True, index=True)
    convoy_id = Column(Integer, ForeignKey("convoys.id"), index=True)
    obstacle_id = Column(Integer, ForeignKey("obstacles.id"), index=True)
    
    # Detection
    detected_at = Column(DateTime, default=datetime.utcnow)
    distance_to_obstacle_km = Column(Float)
    time_to_obstacle_minutes = Column(Integer)
    
    # Impact Assessment
    impact_severity = Column(String, doc="NONE, MINOR, MODERATE, SEVERE, BLOCKING")
    route_blocked = Column(Boolean, default=False)
    delay_estimate_minutes = Column(Integer, default=0)
    
    # Response
    ai_recommendation = Column(Text, nullable=True)
    action_taken = Column(String, nullable=True)
    resolution_time = Column(DateTime, nullable=True)
    
    # Status
    status = Column(String, default="ACTIVE", doc="ACTIVE, MITIGATED, RESOLVED, BYPASSED")
    
    convoy = relationship("Convoy")
    obstacle = relationship("Obstacle")
