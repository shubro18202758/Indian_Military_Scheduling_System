"""
Transit Camp Model
Represents halt locations for convoys during long journeys.
"""
from sqlalchemy import String, Integer, Float, Boolean, Column, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class TransitCamp(Base):
    """
    Transit Camp - Halt location for convoy rest, refueling, and maintenance.
    """
    __tablename__ = "transit_camps"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, doc="Camp name")
    code = Column(String, unique=True, doc="Short code")
    
    # Location
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    
    # Route association
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=True)
    route_km_marker = Column(Float, doc="Distance from route start in km")
    
    # Capacity
    vehicle_capacity = Column(Integer, default=50, doc="Max vehicles that can halt")
    personnel_capacity = Column(Integer, default=200, doc="Max personnel accommodation")
    current_occupancy_vehicles = Column(Integer, default=0)
    current_occupancy_personnel = Column(Integer, default=0)
    
    # Facilities
    has_fuel = Column(Boolean, default=True)
    has_medical = Column(Boolean, default=False)
    has_maintenance = Column(Boolean, default=False)
    has_mess = Column(Boolean, default=True)
    has_communication = Column(Boolean, default=True)
    
    # Fuel availability
    fuel_petrol_liters = Column(Float, default=10000.0)
    fuel_diesel_liters = Column(Float, default=50000.0)
    
    # Status
    status = Column(String, default="OPERATIONAL", doc="OPERATIONAL, LIMITED, CLOSED")
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class HaltRequest(Base):
    """
    Halt request from a convoy to a transit camp.
    Used for planning and resource allocation.
    """
    __tablename__ = "halt_requests"

    id = Column(Integer, primary_key=True, index=True)
    
    convoy_id = Column(Integer, ForeignKey("convoys.id"), nullable=False)
    transit_camp_id = Column(Integer, ForeignKey("transit_camps.id"), nullable=False)
    
    # Request details
    requested_vehicles = Column(Integer, default=1)
    requested_personnel = Column(Integer, default=10)
    requested_fuel_liters = Column(Float, default=0.0)
    
    # Timing
    expected_arrival = Column(DateTime, nullable=False)
    expected_departure = Column(DateTime, nullable=True)
    halt_duration_hours = Column(Float, default=2.0)
    
    # Status
    status = Column(String, default="PENDING", doc="PENDING, APPROVED, REJECTED, COMPLETED")
    approval_notes = Column(String, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
