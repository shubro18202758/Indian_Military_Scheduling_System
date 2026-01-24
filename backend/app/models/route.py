from sqlalchemy import String, Integer, Float, Boolean, Column, JSON, DateTime
from datetime import datetime
from app.core.database import Base


class Route(Base):
    """
    Database Model for a predefined Route (e.g., Jammu-Srinagar Highway).
    Stores the path as a list of coordinates (JSON).
    Enhanced with detailed route characteristics.
    """
    __tablename__ = "routes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, doc="Route Name (e.g. NH-44)")
    code = Column(String, nullable=True, doc="Short code")
    
    # Start and end points
    start_name = Column(String, nullable=True)
    end_name = Column(String, nullable=True)
    start_lat = Column(Float, nullable=True)
    start_long = Column(Float, nullable=True)
    end_lat = Column(Float, nullable=True)
    end_long = Column(Float, nullable=True)
    
    # In a real PostGIS setup, this would be a Geography(LineString). 
    # For simplicity/portability now, we'll store a JSON list of [lat, long] points.
    waypoints = Column(JSON, doc="List of [lat, long] coordinates")
    
    # Route characteristics
    total_distance_km = Column(Float, nullable=True)
    estimated_time_hours = Column(Float, nullable=True)
    terrain_type = Column(String, default="MIXED", doc="PLAINS, MOUNTAINOUS, DESERT, MIXED")
    road_classification = Column(String, default="HIGHWAY", doc="HIGHWAY, STATE, DISTRICT, TACTICAL")
    
    # Capacity and restrictions
    max_vehicle_weight_tons = Column(Float, default=50.0)
    max_vehicle_height_m = Column(Float, default=4.5)
    is_night_movement_allowed = Column(Boolean, default=True)
    convoy_movement_hours = Column(String, default="00:00-23:59", doc="Allowed hours for convoy movement")
    
    # Risk and status
    risk_level = Column(String, default="LOW", doc="LOW, MEDIUM, HIGH")
    status = Column(String, default="OPEN", doc="OPEN, BLOCKED, CONGESTED, RESTRICTED")
    current_traffic_density = Column(String, default="LOW", doc="LOW, MODERATE, HIGH, CRITICAL")
    
    # Threat assessment
    threat_level = Column(String, default="GREEN", doc="GREEN, YELLOW, ORANGE, RED")
    last_threat_update = Column(DateTime, nullable=True)
    threat_notes = Column(String, nullable=True)
    
    # Weather impact
    weather_status = Column(String, default="CLEAR", doc="CLEAR, RAIN, SNOW, FOG, LANDSLIDE_RISK")
    weather_impact_factor = Column(Float, default=1.0, doc="1.0 = no impact, higher = slower")
    
    # Altitude (for mountain routes)
    min_altitude_m = Column(Float, nullable=True)
    max_altitude_m = Column(Float, nullable=True)
    has_high_altitude_pass = Column(Boolean, default=False)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
