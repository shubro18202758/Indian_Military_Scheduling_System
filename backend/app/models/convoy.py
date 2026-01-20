from sqlalchemy import String, Integer, Float, Boolean, Column, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class Convoy(Base):
    """
    Database Model for a Convoy.
    A convoy is a group of vehicles moving from a Start Point to an End Point.
    """
    __tablename__ = "convoys"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, doc="Convoy Code name, e.g., 'Alpha-Move-01'")
    
    start_location = Column(String, doc="Name of start point")
    end_location = Column(String, doc="Name of destination")
    
    start_time = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="PLANNED", doc="PLANNED, IN_TRANSIT, COMPLETED, HALTED")
    
    # Relationships
    # For now, we'll simpler store a list of asset IDs or a relationship
    # This is a One-to-Many relationship (One Convoy has Many Assets) usually, 
    # but an Asset might belong to different convoys over time. 
    # For simplicity in this foundational phase, let's just track the convoy metadata.
