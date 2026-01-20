from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ConvoyBase(BaseModel):
    name: str
    start_location: str
    end_location: str
    status: str = "PLANNED"

class ConvoyCreate(ConvoyBase):
    pass

class Convoy(ConvoyBase):
    id: int
    start_time: datetime

    class Config:
        from_attributes = True
