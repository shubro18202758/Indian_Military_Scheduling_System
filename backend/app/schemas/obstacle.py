"""
Obstacle Schemas - Pydantic models for obstacle API
"""

from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime


class ObstacleBase(BaseModel):
    obstacle_type: str
    severity: str = "MEDIUM"
    latitude: float
    longitude: float
    radius_km: float = 0.5
    route_id: Optional[int] = None
    route_km_marker: Optional[float] = None
    estimated_duration_hours: float = 2.0
    impact_score: float = 50.0
    blocks_route: bool = False
    speed_reduction_factor: float = 1.0
    title: Optional[str] = None
    description: Optional[str] = None


class ObstacleCreate(ObstacleBase):
    """Schema for creating an obstacle"""
    pass


class Obstacle(ObstacleBase):
    """Schema for reading an obstacle"""
    id: int
    status: str
    is_active: bool
    detected_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    affected_convoys: List[int] = []
    generated_by: str = "JANUS_SIM"
    is_countered: bool = False
    countered_at: Optional[datetime] = None
    countermeasure_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CountermeasureBase(BaseModel):
    obstacle_id: int
    action_type: str
    decision_algorithm: Optional[str] = None
    confidence_score: float = 0.8
    decision_factors: Optional[Dict[str, Any]] = None
    affected_convoys: List[int] = []
    affected_assets: List[int] = []
    new_route_id: Optional[int] = None
    eta_impact_minutes: int = 0
    title: Optional[str] = None
    description: Optional[str] = None
    execution_steps: List[str] = []


class CountermeasureCreate(CountermeasureBase):
    """Schema for creating a countermeasure"""
    pass


class Countermeasure(CountermeasureBase):
    """Schema for reading a countermeasure"""
    id: int
    status: str = "PROPOSED"
    executed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    success: Optional[bool] = None
    outcome_notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SimulationEventBase(BaseModel):
    event_type: str
    obstacle_id: Optional[int] = None
    countermeasure_id: Optional[int] = None
    convoy_id: Optional[int] = None
    route_id: Optional[int] = None
    event_data: Optional[Dict[str, Any]] = None
    severity: str = "INFO"


class SimulationEvent(SimulationEventBase):
    """Schema for reading a simulation event"""
    id: int
    timestamp: Optional[datetime] = None
    is_read: bool = False
    is_displayed: bool = False

    class Config:
        from_attributes = True


# Live update schemas for WebSocket/SSE
class LiveUpdate(BaseModel):
    """Schema for real-time updates to frontend"""
    update_type: str  # OBSTACLE_NEW, OBSTACLE_CLEARED, COUNTERMEASURE_ACTIVE, CONVOY_DIVERTED, etc.
    timestamp: datetime
    data: Dict[str, Any]
    priority: str = "NORMAL"  # LOW, NORMAL, HIGH, CRITICAL


class SimulationStatus(BaseModel):
    """Current simulation status"""
    is_running: bool
    active_obstacles: int
    pending_countermeasures: int
    affected_convoys: int
    last_obstacle_at: Optional[datetime] = None
    last_countermeasure_at: Optional[datetime] = None
    total_obstacles_generated: int = 0
    total_countermeasures_executed: int = 0
    success_rate: float = 0.0
