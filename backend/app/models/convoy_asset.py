"""
Convoy-Asset Association Model
Represents the many-to-many relationship between convoys and assets.
"""
from sqlalchemy import String, Integer, Float, Column, DateTime, ForeignKey, Enum
from datetime import datetime
from app.core.database import Base
import enum


class ConvoyRole(str, enum.Enum):
    """Role of an asset within a convoy"""
    LEAD = "LEAD"           # Lead vehicle (usually lighter, faster)
    CARGO = "CARGO"         # Main cargo carrier
    ESCORT = "ESCORT"       # Security escort
    RECOVERY = "RECOVERY"   # Recovery/breakdown vehicle
    MEDICAL = "MEDICAL"     # Medical support
    TAIL = "TAIL"           # Tail-end vehicle


class ConvoyAsset(Base):
    """
    Association between Convoy and Asset with additional metadata.
    Tracks which assets are assigned to which convoy and their role.
    """
    __tablename__ = "convoy_assets"

    id = Column(Integer, primary_key=True, index=True)
    
    convoy_id = Column(Integer, ForeignKey("convoys.id"), nullable=False, index=True)
    asset_id = Column(Integer, ForeignKey("transport_assets.id"), nullable=False, index=True)
    
    # Position and role
    position_in_convoy = Column(Integer, default=1, doc="1-indexed position in convoy order")
    role = Column(String, default="CARGO", doc="LEAD, CARGO, ESCORT, RECOVERY, MEDICAL, TAIL")
    
    # Load assignment
    assigned_load_tons = Column(Float, default=0.0)
    load_description = Column(String, nullable=True)
    
    # Status
    status = Column(String, default="ASSIGNED", doc="ASSIGNED, EN_ROUTE, COMPLETED, DETACHED")
    
    # Timing
    joined_at = Column(DateTime, default=datetime.utcnow)
    detached_at = Column(DateTime, nullable=True)
    
    # Inter-vehicle distance (from vehicle ahead)
    distance_from_ahead_meters = Column(Float, default=50.0)
