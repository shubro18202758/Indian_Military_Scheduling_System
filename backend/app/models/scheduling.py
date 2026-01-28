"""
Convoy Scheduling & Dispatch Models
=====================================

Database models for AI-powered convoy scheduling recommendations.
Stores historical dispatch data, AI decisions, and operational intel
for the RAG (Retrieval Augmented Generation) pipeline.

Security Classification: RESTRICTED
Indian Army Logistics AI System
"""

from sqlalchemy import (
    String, Integer, Float, Boolean, Column, DateTime, 
    ForeignKey, JSON, Text, Enum as SQLEnum
)
from sqlalchemy.orm import relationship
from datetime import datetime
from enum import Enum
from app.core.database import Base


class DispatchDecision(str, Enum):
    """AI Dispatch recommendation types."""
    RELEASE_IMMEDIATE = "RELEASE_IMMEDIATE"
    RELEASE_WINDOW = "RELEASE_WINDOW"  # Release within time window
    HOLD = "HOLD"
    DELAY = "DELAY"
    REROUTE_THEN_RELEASE = "REROUTE_THEN_RELEASE"
    CANCEL = "CANCEL"
    REQUIRES_ESCORT = "REQUIRES_ESCORT"
    REQUIRES_COMMANDER_REVIEW = "REQUIRES_COMMANDER_REVIEW"


class ThreatCategory(str, Enum):
    """Threat intel categories."""
    INSURGENT_ACTIVITY = "INSURGENT_ACTIVITY"
    IED_THREAT = "IED_THREAT"
    AMBUSH_RISK = "AMBUSH_RISK"
    CIVIL_UNREST = "CIVIL_UNREST"
    CROSS_BORDER = "CROSS_BORDER"
    WEATHER_HAZARD = "WEATHER_HAZARD"
    TERRAIN_HAZARD = "TERRAIN_HAZARD"
    INFRASTRUCTURE_DAMAGE = "INFRASTRUCTURE_DAMAGE"
    COMMUNICATION_BLACKOUT = "COMMUNICATION_BLACKOUT"
    NONE = "NONE"


class SchedulingRequest(Base):
    """
    Convoy scheduling request from a TCP.
    Represents a convoy waiting at a TCP for dispatch recommendation.
    """
    __tablename__ = "scheduling_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String, unique=True, index=True, doc="Unique request identifier")
    
    # Convoy info
    convoy_id = Column(Integer, ForeignKey("convoys.id"), nullable=False)
    convoy_callsign = Column(String, doc="Convoy tactical callsign")
    
    # TCP info (where convoy is waiting)
    tcp_id = Column(Integer, ForeignKey("tcps.id"), nullable=False)
    tcp_name = Column(String)
    
    # Destination
    destination_tcp_id = Column(Integer, ForeignKey("tcps.id"), nullable=True)
    final_destination = Column(String)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=True)
    
    # Convoy details
    vehicle_count = Column(Integer, default=1)
    personnel_count = Column(Integer, default=0)
    cargo_type = Column(String, doc="AMMUNITION, FUEL, RATIONS, MEDICAL, PERSONNEL, EQUIPMENT, MIXED")
    priority_level = Column(String, default="ROUTINE", doc="FLASH, IMMEDIATE, PRIORITY, ROUTINE")
    classification = Column(String, default="RESTRICTED")
    
    # Vehicle readiness
    fuel_status_percent = Column(Float, default=100.0)
    vehicle_health_percent = Column(Float, default=100.0)
    crew_fatigue_level = Column(String, default="RESTED", doc="RESTED, ALERT, FATIGUED, EXHAUSTED")
    
    # Request timing
    requested_at = Column(DateTime, default=datetime.utcnow)
    preferred_departure = Column(DateTime, nullable=True)
    latest_acceptable_departure = Column(DateTime, nullable=True)
    mission_deadline = Column(DateTime, nullable=True)
    
    # Status
    status = Column(String, default="PENDING", doc="PENDING, PROCESSING, RECOMMENDED, APPROVED, RELEASED, CANCELLED")
    
    # Relationships
    convoy = relationship("Convoy", foreign_keys=[convoy_id])
    source_tcp = relationship("TCP", foreign_keys=[tcp_id])


class SchedulingRecommendation(Base):
    """
    AI-generated scheduling recommendation.
    Complete with reasoning chain for explainability.
    """
    __tablename__ = "scheduling_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    recommendation_id = Column(String, unique=True, index=True)
    
    # Link to request
    request_id = Column(Integer, ForeignKey("scheduling_requests.id"), nullable=False)
    
    # AI Decision
    decision = Column(String, doc="RELEASE_IMMEDIATE, HOLD, DELAY, REROUTE, etc.")
    confidence_score = Column(Float, doc="AI confidence 0.0-1.0")
    
    # Recommended timing
    recommended_departure = Column(DateTime, nullable=True)
    recommended_window_start = Column(DateTime, nullable=True)
    recommended_window_end = Column(DateTime, nullable=True)
    estimated_journey_time_hours = Column(Float)
    predicted_arrival = Column(DateTime, nullable=True)
    
    # Risk assessment
    overall_risk_score = Column(Float, doc="0.0-1.0, higher = more risk")
    threat_risk = Column(Float)
    weather_risk = Column(Float)
    terrain_risk = Column(Float)
    traffic_risk = Column(Float)
    fatigue_risk = Column(Float)
    
    # AI reasoning (RAG context)
    reasoning_chain = Column(JSON, doc="Step-by-step reasoning from AI")
    factors_considered = Column(JSON, doc="List of factors analyzed")
    similar_past_convoys = Column(JSON, doc="Retrieved similar historical convoys")
    intel_sources_used = Column(JSON, doc="Threat intel sources referenced")
    
    # Recommendations
    primary_recommendation = Column(Text, doc="Main recommendation text")
    tactical_notes = Column(Text, doc="Tactical considerations")
    alternative_options = Column(JSON, doc="Alternative dispatch options")
    required_actions = Column(JSON, doc="Actions required before release")
    
    # Route recommendation
    recommended_route_id = Column(Integer, ForeignKey("routes.id"), nullable=True)
    route_modification_notes = Column(Text, nullable=True)
    
    # Escort requirements
    escort_required = Column(Boolean, default=False)
    escort_type = Column(String, nullable=True, doc="ARMED_ESCORT, QRF, AIR_COVER, NONE")
    escort_strength = Column(String, nullable=True)
    
    # Weather assessment
    weather_current = Column(String)
    weather_forecast = Column(String)
    weather_impact = Column(String)
    
    # AI model info
    ai_model_used = Column(String, default="janus:latest")
    processing_time_ms = Column(Integer)
    rag_context_tokens = Column(Integer, doc="Tokens used for RAG context")
    
    # Timestamps
    generated_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)
    
    # Commander action
    commander_decision = Column(String, nullable=True, doc="APPROVED, REJECTED, MODIFIED")
    commander_notes = Column(Text, nullable=True)
    actioned_at = Column(DateTime, nullable=True)
    actioned_by = Column(String, nullable=True)


class DispatchHistory(Base):
    """
    Historical record of convoy dispatches.
    Used for RAG retrieval and pattern learning.
    """
    __tablename__ = "dispatch_history"

    id = Column(Integer, primary_key=True, index=True)
    dispatch_id = Column(String, unique=True, index=True)
    
    # Convoy info
    convoy_id = Column(Integer, ForeignKey("convoys.id"), nullable=True)
    convoy_callsign = Column(String)
    
    # Route
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=True)
    route_name = Column(String)
    source_tcp = Column(String)
    destination = Column(String)
    distance_km = Column(Float)
    
    # Convoy composition
    vehicle_count = Column(Integer)
    personnel_count = Column(Integer)
    cargo_type = Column(String)
    priority_level = Column(String)
    
    # Timing
    dispatch_time = Column(DateTime, doc="When convoy was released")
    arrival_time = Column(DateTime, nullable=True)
    planned_journey_hours = Column(Float)
    actual_journey_hours = Column(Float, nullable=True)
    
    # Conditions at dispatch
    weather_at_dispatch = Column(String)
    visibility_km = Column(Float)
    threat_level_at_dispatch = Column(String)
    time_of_day = Column(String, doc="DAWN, DAY, DUSK, NIGHT")
    day_of_week = Column(String)
    
    # Outcome
    journey_success = Column(Boolean, default=True)
    incidents_count = Column(Integer, default=0)
    incidents_details = Column(JSON, nullable=True)
    delay_minutes = Column(Integer, default=0)
    delay_reason = Column(String, nullable=True)
    
    # Embeddings for RAG (stored as JSON array)
    context_embedding = Column(JSON, nullable=True, doc="Vector embedding for similarity search")
    
    # Metadata
    recorded_at = Column(DateTime, default=datetime.utcnow)


class ThreatIntel(Base):
    """
    Threat intelligence data for route segments.
    Feeds into scheduling AI decisions.
    """
    __tablename__ = "threat_intel"

    id = Column(Integer, primary_key=True, index=True)
    intel_id = Column(String, unique=True, index=True)
    
    # Location
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=True)
    route_segment = Column(String, doc="Segment identifier on route")
    latitude = Column(Float)
    longitude = Column(Float)
    radius_km = Column(Float, default=5.0, doc="Affected radius")
    
    # Threat details
    threat_category = Column(String)
    threat_level = Column(String, doc="RED, ORANGE, YELLOW, GREEN")
    threat_description = Column(Text)
    source = Column(String, doc="HUMINT, SIGINT, RECCE, LOCAL_INTEL, PATROL_REPORT")
    source_reliability = Column(String, doc="A, B, C, D, E, F")
    
    # Temporal validity
    valid_from = Column(DateTime, default=datetime.utcnow)
    valid_until = Column(DateTime)
    is_active = Column(Boolean, default=True)
    
    # Recommended actions
    recommended_actions = Column(JSON)
    avoidance_required = Column(Boolean, default=False)
    escort_recommended = Column(Boolean, default=False)
    
    # Updates
    last_verified = Column(DateTime, default=datetime.utcnow)
    reported_by = Column(String)
    verified_by = Column(String, nullable=True)


class WeatherData(Base):
    """
    Weather data for route segments.
    Updated periodically from weather services.
    """
    __tablename__ = "weather_data"

    id = Column(Integer, primary_key=True, index=True)
    
    # Location
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=True)
    location_name = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    
    # Current conditions
    condition = Column(String, doc="CLEAR, CLOUDY, RAIN, HEAVY_RAIN, SNOW, FOG, STORM")
    temperature_c = Column(Float)
    humidity_percent = Column(Float)
    wind_speed_kmh = Column(Float)
    wind_direction = Column(String)
    visibility_km = Column(Float)
    precipitation_mm = Column(Float, default=0.0)
    
    # Road impact
    road_condition = Column(String, default="DRY", doc="DRY, WET, SLIPPERY, ICY, SNOW_COVERED, FLOODED")
    speed_reduction_percent = Column(Float, default=0.0)
    is_passable = Column(Boolean, default=True)
    
    # Forecast (next 6 hours)
    forecast_condition = Column(String, nullable=True)
    forecast_visibility_km = Column(Float, nullable=True)
    forecast_precipitation = Column(Float, nullable=True)
    weather_alert = Column(String, nullable=True)
    
    # Timestamps
    observed_at = Column(DateTime, default=datetime.utcnow)
    forecast_valid_until = Column(DateTime, nullable=True)


class SchedulingMetrics(Base):
    """
    Aggregated scheduling metrics for AI learning.
    """
    __tablename__ = "scheduling_metrics"

    id = Column(Integer, primary_key=True, index=True)
    
    # Time period
    date = Column(DateTime)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=True)
    tcp_id = Column(Integer, ForeignKey("tcps.id"), nullable=True)
    
    # Volume metrics
    total_dispatches = Column(Integer, default=0)
    successful_dispatches = Column(Integer, default=0)
    delayed_dispatches = Column(Integer, default=0)
    incident_count = Column(Integer, default=0)
    
    # Timing metrics
    avg_journey_time_hours = Column(Float)
    avg_delay_minutes = Column(Float)
    avg_wait_time_at_tcp_minutes = Column(Float)
    
    # AI metrics
    ai_recommendations_count = Column(Integer, default=0)
    ai_recommendations_followed = Column(Integer, default=0)
    ai_accuracy_score = Column(Float, doc="How accurate were AI predictions")
    
    # Conditions summary
    predominant_weather = Column(String)
    threat_level_avg = Column(String)
    
    recorded_at = Column(DateTime, default=datetime.utcnow)
