"""
Schemas for Transit Camp and Halt Request entities
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TransitCampBase(BaseModel):
    name: str
    code: str
    latitude: float
    longitude: float
    route_id: Optional[int] = None
    route_km_marker: Optional[float] = None
    vehicle_capacity: int = 50
    personnel_capacity: int = 200
    has_fuel: bool = True
    has_medical: bool = False
    has_maintenance: bool = False
    has_mess: bool = True
    has_communication: bool = True
    fuel_petrol_liters: float = 10000.0
    fuel_diesel_liters: float = 50000.0
    status: str = "OPERATIONAL"


class TransitCampCreate(TransitCampBase):
    """Schema for creating a new transit camp"""
    pass


class TransitCampUpdate(BaseModel):
    """Schema for updating a transit camp"""
    current_occupancy_vehicles: Optional[int] = None
    current_occupancy_personnel: Optional[int] = None
    fuel_petrol_liters: Optional[float] = None
    fuel_diesel_liters: Optional[float] = None
    status: Optional[str] = None


class TransitCamp(TransitCampBase):
    """Schema for reading a transit camp (API output)"""
    id: int
    current_occupancy_vehicles: int = 0
    current_occupancy_personnel: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class HaltRequestBase(BaseModel):
    convoy_id: int
    transit_camp_id: int
    requested_vehicles: int = 1
    requested_personnel: int = 10
    requested_fuel_liters: float = 0.0
    expected_arrival: datetime
    halt_duration_hours: float = 2.0


class HaltRequestCreate(HaltRequestBase):
    """Schema for creating a halt request"""
    pass


class HaltRequestUpdate(BaseModel):
    """Schema for updating a halt request"""
    status: Optional[str] = None
    approval_notes: Optional[str] = None
    expected_departure: Optional[datetime] = None


class HaltRequest(HaltRequestBase):
    """Schema for reading a halt request"""
    id: int
    expected_departure: Optional[datetime] = None
    status: str = "PENDING"
    approval_notes: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class HaltPlanRequest(BaseModel):
    """Request for automated halt planning"""
    convoy_id: int
    route_id: int
    max_driving_hours: float = 8.0
    preferred_halt_duration_hours: float = 2.0
    require_fuel: bool = True
    require_mess: bool = True
