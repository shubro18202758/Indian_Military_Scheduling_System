from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TransportAssetBase(BaseModel):
    name: str
    callsign: Optional[str] = None
    registration_number: Optional[str] = None
    asset_type: str
    category: str = "TRANSPORT"
    capacity_tons: float
    capacity_volume_m3: Optional[float] = None
    max_personnel: int = 0
    is_available: bool = True
    operational_status: str = "READY"
    current_lat: Optional[float] = None
    current_long: Optional[float] = None
    fuel_status: float = 100.0
    fuel_type: str = "DIESEL"
    fuel_capacity_liters: float = 200.0
    fuel_consumption_km_per_liter: float = 3.0
    max_speed_kmh: float = 80.0
    avg_speed_plains_kmh: float = 50.0
    avg_speed_mountain_kmh: float = 30.0
    assigned_unit: Optional[str] = None
    home_base: Optional[str] = None
    has_radio: bool = True
    has_gps: bool = True


class TransportAssetCreate(TransportAssetBase):
    """Schema for creating a new asset (client input)"""
    pass


class TransportAssetUpdate(BaseModel):
    """Schema for updating an asset"""
    name: Optional[str] = None
    callsign: Optional[str] = None
    is_available: Optional[bool] = None
    operational_status: Optional[str] = None
    current_lat: Optional[float] = None
    current_long: Optional[float] = None
    fuel_status: Optional[float] = None
    current_convoy_id: Optional[int] = None


class TransportAsset(TransportAssetBase):
    """Schema for reading an asset (API output)"""
    id: int
    current_convoy_id: Optional[int] = None
    total_km_traveled: float = 0.0
    last_maintenance_date: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True  # Allows Pydantic to read from SQLAlchemy models
