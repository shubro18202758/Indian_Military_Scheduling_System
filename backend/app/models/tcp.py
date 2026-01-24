"""
TCP (Traffic Control Point) Model
Represents checkpoints on routes where convoys are monitored and controlled.
"""
from sqlalchemy import String, Integer, Float, Boolean, Column, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class TCP(Base):
    """
    Traffic Control Point - Checkpoint on convoy routes.
    Used for monitoring, controlling, and logging convoy movements.
    """
    __tablename__ = "tcps"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, doc="TCP identifier (e.g., TCP-Alpha, Checkpoint-7)")
    code = Column(String, unique=True, doc="Short code for quick reference")
    
    # Location
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    
    # Route association
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=True)
    route_km_marker = Column(Float, doc="Distance from route start in km")
    
    # Status
    status = Column(String, default="ACTIVE", doc="ACTIVE, INACTIVE, BLOCKED")
    current_traffic = Column(String, default="CLEAR", doc="CLEAR, MODERATE, CONGESTED, BLOCKED")
    
    # Capacity and timing
    max_convoy_capacity = Column(Integer, default=5, doc="Max convoys that can pass simultaneously")
    avg_clearance_time_min = Column(Integer, default=15, doc="Average time to clear a convoy (minutes)")
    
    # Operational hours (24h format)
    opens_at = Column(String, default="00:00")
    closes_at = Column(String, default="23:59")
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TCPCrossing(Base):
    """
    Records of convoy crossings at TCPs.
    Used for tracking, ETA prediction, and analytics.
    """
    __tablename__ = "tcp_crossings"

    id = Column(Integer, primary_key=True, index=True)
    
    tcp_id = Column(Integer, ForeignKey("tcps.id"), nullable=False)
    convoy_id = Column(Integer, ForeignKey("convoys.id"), nullable=False)
    
    # Timing
    expected_arrival = Column(DateTime, nullable=True)
    actual_arrival = Column(DateTime, nullable=True)
    clearance_time = Column(DateTime, nullable=True)
    
    # Status
    status = Column(String, default="PENDING", doc="PENDING, ARRIVED, CLEARED, DELAYED")
    delay_minutes = Column(Integer, default=0)
    delay_reason = Column(String, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
