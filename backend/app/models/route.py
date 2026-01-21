from sqlalchemy import String, Integer, Float, Boolean, Column, JSON
from app.core.database import Base

class Route(Base):
    """
    Database Model for a predefined Route (e.g., Jammu-Srinagar Highway).
    Stores the path as a list of coordinates (JSON).
    """
    __tablename__ = "routes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, doc="Route Name (e.g. NH-44)")
    
    # In a real PostGIS setup, this would be a Geography(LineString). 
    # For simplicity/portability now, we'll store a JSON list of [lat, long] points.
    waypoints = Column(JSON, doc="List of [lat, long] coordinates")
    
    risk_level = Column(String, default="LOW", doc="LOW, MEDIUM, HIGH (Critical)")
    status = Column(String, default="OPEN", doc="OPEN, BLOCKED, CONGESTED")
