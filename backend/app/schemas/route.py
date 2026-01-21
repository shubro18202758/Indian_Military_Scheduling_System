from pydantic import BaseModel
from typing import List, Tuple

class RouteBase(BaseModel):
    name: str
    risk_level: str = "LOW"
    status: str = "OPEN"
    waypoints: List[List[float]] # List of [lat, long]

class RouteCreate(RouteBase):
    pass

class Route(RouteBase):
    id: int

    class Config:
        from_attributes = True
