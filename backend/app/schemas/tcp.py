"""
Schemas for TCP (Traffic Control Point) entities
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TCPBase(BaseModel):
    name: str
    code: str
    latitude: float
    longitude: float
    route_id: Optional[int] = None
    route_km_marker: Optional[float] = None
    status: str = "ACTIVE"
    current_traffic: str = "CLEAR"
    max_convoy_capacity: int = 5
    avg_clearance_time_min: int = 15
    opens_at: str = "00:00"
    closes_at: str = "23:59"


class TCPCreate(TCPBase):
    """Schema for creating a new TCP"""
    pass


class TCPUpdate(BaseModel):
    """Schema for updating a TCP"""
    status: Optional[str] = None
    current_traffic: Optional[str] = None
    avg_clearance_time_min: Optional[int] = None


class TCP(TCPBase):
    """Schema for reading a TCP (API output)"""
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TCPCrossingBase(BaseModel):
    tcp_id: int
    convoy_id: int
    expected_arrival: Optional[datetime] = None
    status: str = "PENDING"


class TCPCrossingCreate(TCPCrossingBase):
    """Schema for creating a TCP crossing record"""
    pass


class TCPCrossingUpdate(BaseModel):
    """Schema for updating a TCP crossing"""
    actual_arrival: Optional[datetime] = None
    clearance_time: Optional[datetime] = None
    status: Optional[str] = None
    delay_minutes: Optional[int] = None
    delay_reason: Optional[str] = None


class TCPCrossing(TCPCrossingBase):
    """Schema for reading a TCP crossing"""
    id: int
    actual_arrival: Optional[datetime] = None
    clearance_time: Optional[datetime] = None
    delay_minutes: int = 0
    delay_reason: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
