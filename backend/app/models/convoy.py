from sqlalchemy import String, Integer, Float, Boolean, Column, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class Convoy(Base):
    """
    Database Model for a Convoy.
    A convoy is a group of vehicles moving from a Start Point to an End Point.
    Enhanced with AI Load Management capabilities.
    """
    __tablename__ = "convoys"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, doc="Convoy Code name, e.g., 'Alpha-Move-01'")
    
    start_location = Column(String, doc="Name of start point")
    end_location = Column(String, doc="Name of destination")
    
    start_time = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="PLANNED", doc="PLANNED, IN_TRANSIT, COMPLETED, HALTED")
    
    # Link to a specific route plan
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=True)
    route = relationship("app.models.route.Route")
    
    # =========================================================================
    # AI LOAD MANAGEMENT FIELDS
    # =========================================================================
    
    # Cargo Information
    cargo_type = Column(String, default="GENERAL", doc="AMMUNITION, FUEL_POL, RATIONS, MEDICAL, EQUIPMENT, PERSONNEL, etc.")
    cargo_weight_tons = Column(Float, default=0.0, doc="Total cargo weight in tons")
    cargo_volume_cubic_m = Column(Float, default=0.0, doc="Total cargo volume in cubic meters")
    cargo_description = Column(Text, nullable=True, doc="Detailed cargo description")
    
    # Load Priority
    priority_level = Column(String, default="ROUTINE", doc="FLASH, IMMEDIATE, PRIORITY, ROUTINE, DEFERRED")
    ai_priority_score = Column(Float, default=50.0, doc="AI-calculated priority score (0-100)")
    
    # Vehicle Information
    vehicle_count = Column(Integer, default=1, doc="Number of vehicles in convoy")
    personnel_count = Column(Integer, default=0, doc="Number of personnel traveling")
    
    # Entity Information (for notifications)
    origin_entity = Column(String, nullable=True, doc="Originating unit/entity")
    destination_entity = Column(String, nullable=True, doc="Destination unit/entity")
    
    # Special Requirements
    is_hazardous = Column(Boolean, default=False, doc="Hazardous cargo flag")
    requires_escort = Column(Boolean, default=False, doc="Escort required flag")
    requires_refrigeration = Column(Boolean, default=False, doc="Cold chain required")
    
    # AI Planning Fields
    ai_recommended_route = Column(Text, nullable=True, doc="AI recommended route JSON")
    ai_planned_halts = Column(Text, nullable=True, doc="AI planned halt points JSON")
    ai_risk_assessment = Column(Text, nullable=True, doc="AI risk assessment JSON")
    
    assets = relationship("app.models.asset.TransportAsset", back_populates="convoy")
    
    # Load management relationships
    load_requests = relationship("app.models.load_management.LoadRequest", back_populates="convoy")
