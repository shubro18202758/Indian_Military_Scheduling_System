import asyncio
import sys
import os

# Add the parent directory to sys.path to make 'app' module importable
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal, engine, Base
from app.models.asset import TransportAsset
from app.models.convoy import Convoy
from app.models.route import Route
from datetime import datetime
from sqlalchemy import text

async def seed_data():
    print("Resetting Database...")
    async with engine.begin() as conn:
        # Drop all tables to ensure clean slate for new realistic routes
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    print("Seeding realistic data...")
    async with SessionLocal() as db:
        
        # 1. NH-44 (Jammu -> Srinagar) - High Fidelity Winding Route
        # These points trace the actual winding path of the highway through the mountains
        waypoints_nh44 = [
            [32.7266, 74.8570], # Jammu
            [32.8105, 74.9333], # Nagrota
            [32.9197, 75.0440], # Udhampur
            [32.9800, 75.1200], # Chenani
            [33.0300, 75.2800], # Patnitop approach
            [33.0900, 75.3200], # Batote
            [33.1500, 75.3000], # Chanderkote
            [33.2435, 75.2476], # Ramban
            [33.3000, 75.2000], # Ramsu
            [33.4357, 75.1956], # Banihal
            [33.5200, 75.1900], # Jawahar Tunnel Area
            [33.6231, 75.1822], # Qazigund
            [33.7500, 75.1200], # Anantnag Curve
            [33.8300, 75.0800], # Bijbehara
            [33.9167, 75.0210], # Awantipora
            [34.0000, 74.9200], # Pampore
            [34.0837, 74.7973]  # Srinagar
        ]

        # 2. Mughal Road (Alternate) - Winding Mountain Pass
        waypoints_mughal = [
            [32.7266, 74.8570], # Jammu
            [32.9500, 74.6000], # Akhnoor Area
            [33.2307, 74.3986], # Rajouri
            [33.4500, 74.3000], # Thanamandi
            [33.5800, 74.4500], # Bafliaz
            [33.6500, 74.5500], # Pir Ki Gali (Pass)
            [33.6429, 74.6067], # Shopian
            [33.8500, 74.7500], # Pulwama
            [34.0837, 74.7973]  # Srinagar
        ]

        route_nh44 = Route(
            name="NH-44 (Jammu-Srinagar)",
            risk_level="HIGH",
            status="OPEN",
            waypoints=waypoints_nh44
        )

        route_mughal = Route(
            name="Mughal Road (Alternate)",
            risk_level="MEDIUM",
            status="CONGESTED",
            waypoints=waypoints_mughal
        )

        db.add(route_nh44)
        db.add(route_mughal)
        print("Added Realistic Routes.")

        assets = [
            TransportAsset(name="ALS-001 (Alpha)", asset_type="Ashok Leyland Stallion", capacity_tons=2.5, is_available=True, current_lat=32.7266, current_long=74.8570, fuel_status=85.0),
            TransportAsset(name="TATA-407 (Bravo)", asset_type="Tata 407", capacity_tons=1.5, is_available=False, current_lat=33.2435, current_long=75.2476, fuel_status=45.0), # At Ramban
            TransportAsset(name="ALS-002 (Charlie)", asset_type="Ashok Leyland Stallion", capacity_tons=2.5, is_available=True, current_lat=34.0837, current_long=74.7973, fuel_status=92.0), # At Srinagar
            TransportAsset(name="Gypsy-HQ (Delta)", asset_type="Maruti Gypsy", capacity_tons=0.5, is_available=True, current_lat=32.9197, current_long=75.0440, fuel_status=100.0), # At Udhampur
        ]
        db.add_all(assets)
        print("Added Assets.")

        convoy1 = Convoy(name="Convoy-Alpha-01", start_location="Jammu", end_location="Srinagar", status="IN_TRANSIT", start_time=datetime.utcnow())
        convoy2 = Convoy(name="Convoy-Bravo-Supply", start_location="Udhampur", end_location="Leh", status="PLANNED", start_time=datetime.utcnow())
        db.add(convoy1)
        db.add(convoy2)
        print("Added Convoys.")

        await db.commit()
        print("Seeding Complete. Old data wiped and replaced.")

if __name__ == "__main__":
    asyncio.run(seed_data())
