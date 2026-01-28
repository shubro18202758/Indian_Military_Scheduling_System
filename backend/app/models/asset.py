from sqlalchemy import String, Integer, Float, Boolean, Column, ForeignKey, DateTime, JSON, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class TransportAsset(Base):
    """
    Database Model for a Transport Asset (Vehicle).
    Represents a row in the 'transport_assets' table.
    All telemetry values are dynamically calculated and stored in real-time.
    """
    __tablename__ = "transport_assets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, doc="Vehicle identifier or name")
    asset_type = Column(String, doc="Type: Truck, Jeep, ALS, etc.")
    capacity_tons = Column(Float, doc="Load carrying capacity in tons")
    is_available = Column(Boolean, default=True, doc="Operational status")
    
    # Position & Navigation
    current_lat = Column(Float, nullable=True)
    current_long = Column(Float, nullable=True)
    altitude_m = Column(Float, default=0.0, doc="Current altitude in meters")
    bearing = Column(Float, default=0.0, doc="Heading in degrees (0=North, 90=East)")
    gradient_deg = Column(Float, default=0.0, doc="Current road gradient in degrees")
    
    # Motion dynamics
    current_speed = Column(Float, default=0.0, doc="Current speed in km/h")
    acceleration = Column(Float, default=0.0, doc="Current acceleration in m/s²")
    
    # Fuel system
    fuel_status = Column(Float, default=100.0, doc="Fuel percentage")
    fuel_liters = Column(Float, default=200.0, doc="Fuel in liters")
    fuel_consumption_lph = Column(Float, default=15.0, doc="Current consumption rate L/h")
    fuel_consumption_kpl = Column(Float, default=3.0, doc="Fuel efficiency km/L")
    range_remaining_km = Column(Float, default=600.0, doc="Estimated range")
    
    # Engine telemetry
    engine_rpm = Column(Integer, default=800, doc="Engine RPM")
    engine_temp = Column(Float, default=85.0, doc="Engine temperature in Celsius")
    engine_load = Column(Float, default=0.0, doc="Engine load percentage")
    throttle_position = Column(Float, default=0.0, doc="Throttle position 0-100%")
    engine_torque = Column(Float, default=0.0, doc="Torque in Nm")
    engine_power_kw = Column(Float, default=0.0, doc="Current power output kW")
    engine_hours = Column(Float, default=0.0, doc="Total engine hours")
    
    # Transmission
    current_gear = Column(Integer, default=0, doc="Current gear")
    transmission_temp = Column(Float, default=75.0, doc="Transmission temperature in Celsius")
    
    # Tires (stored as JSON for 4 corners: [FL, FR, RL, RR])
    tire_pressures = Column(JSON, default=[32.0, 32.0, 32.0, 32.0], doc="Tire pressures PSI")
    tire_temps = Column(JSON, default=[25.0, 25.0, 25.0, 25.0], doc="Tire temperatures C")
    tire_wear = Column(JSON, default=[0.0, 0.0, 0.0, 0.0], doc="Tire wear percentage")
    tire_pressure = Column(Float, default=32.0, doc="Average tire pressure in PSI")
    
    # Brakes
    brake_temps = Column(JSON, default=[50.0, 50.0, 50.0, 50.0], doc="Brake temperatures C")
    brake_wear = Column(JSON, default=[0.0, 0.0, 0.0, 0.0], doc="Brake wear percentage")
    abs_active = Column(Boolean, default=False, doc="ABS system active")
    
    # Suspension
    suspension_travel = Column(JSON, default=[0.0, 0.0, 0.0, 0.0], doc="Suspension travel mm")
    load_distribution = Column(JSON, default=[25.0, 25.0, 25.0, 25.0], doc="Load distribution %")
    
    # Electrical
    battery_voltage = Column(Float, default=24.0, doc="Battery voltage")
    battery_soc = Column(Float, default=95.0, doc="Battery state of charge %")
    alternator_output = Column(Float, default=60.0, doc="Alternator output amps")
    
    # Cargo
    cargo_weight_kg = Column(Float, default=0.0, doc="Current cargo weight")
    cargo_secured = Column(Boolean, default=True, doc="Cargo secured status")
    
    # Environment sensors
    ambient_temp = Column(Float, default=25.0, doc="Ambient temperature C")
    road_friction = Column(Float, default=0.8, doc="Road friction coefficient")
    visibility_m = Column(Float, default=10000.0, doc="Visibility in meters")
    precipitation_mm_hr = Column(Float, default=0.0, doc="Precipitation rate")
    
    # Signatures (for tactical operations)
    thermal_signature = Column(Float, default=0.5, doc="Thermal signature 0-1")
    acoustic_db = Column(Float, default=75.0, doc="Acoustic signature dB")
    
    # Crew status
    driver_fatigue = Column(Float, default=0.0, doc="Driver fatigue percentage")
    vibration_level = Column(Float, default=0.0, doc="Vibration level")
    
    # Tracking & history
    total_km_traveled = Column(Float, default=0.0, doc="Total kilometers traveled")
    last_location_update = Column(DateTime, default=datetime.utcnow, doc="Last update timestamp")
    
    # AI analysis
    threat_level = Column(String, default="ALPHA", doc="Current threat level")
    ai_recommendation = Column(Text, nullable=True, doc="Latest AI recommendation")
    breakdown_probability = Column(Float, default=0.01, doc="Breakdown probability 0-1")
    
    # Relationships
    convoy_id = Column(Integer, ForeignKey("convoys.id"), nullable=True)
    convoy = relationship("Convoy", back_populates="assets")


class VehicleTelemetryHistory(Base):
    """
    Stores historical telemetry data for analysis and playback.
    """
    __tablename__ = "vehicle_telemetry_history"
    
    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("transport_assets.id"), index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Snapshot of key telemetry
    lat = Column(Float)
    lng = Column(Float)
    speed_kmh = Column(Float)
    fuel_pct = Column(Float)
    engine_temp = Column(Float)
    engine_rpm = Column(Integer)
    engine_load = Column(Float)
    
    # Complete telemetry JSON for detailed analysis
    full_telemetry = Column(JSON, doc="Complete telemetry snapshot")
    
    # AI assessment at this point
    threat_level = Column(String)
    ai_summary = Column(Text)


class AIRecommendationLog(Base):
    """
    Stores AI-generated recommendations for audit and analysis.
    """
    __tablename__ = "ai_recommendation_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("transport_assets.id"), index=True, nullable=True)
    convoy_id = Column(Integer, ForeignKey("convoys.id"), index=True, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    recommendation_type = Column(String, doc="Type: SPEED, FUEL, MAINTENANCE, etc.")
    priority = Column(Integer, doc="Priority 1-5")
    action = Column(Text, doc="Recommended action")
    reasoning = Column(Text, doc="AI reasoning")
    confidence = Column(Float, doc="Confidence 0-1")
    
    # Outcome tracking
    was_followed = Column(Boolean, nullable=True)
    outcome = Column(Text, nullable=True)

