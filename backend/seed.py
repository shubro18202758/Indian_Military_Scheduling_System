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

async def seed_data():
    print("Creating tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    print("Seeding data...")
    async with SessionLocal() as db:
        # Check if routes exist
        existing_route = await db.get(Route, 1)
        if existing_route:
            print("Route data already exists. Skipping.")
        else:
            # Jammu -> Srinagar Hwy (NH 44 approximated)
            # Waypoints: Jammu -> Udhampur -> Ramban -> Banihal -> Srinagar
            waypoints_nh44 = [
                [32.7266, 74.8570], # Jammu
                [32.9197, 75.0440], # Udhampur
                [33.2435, 75.2476], # Ramban
                [33.4357, 75.1956], # Banihal
                [33.6231, 75.1822], # Qazigund
                [33.9167, 75.0210], # Awantipora
                [34.0837, 74.7973]  # Srinagar
            ]

            route_nh44 = Route(
                name="NH-44 (Jammu-Srinagar)",
                risk_level="HIGH",
                status="OPEN",
                waypoints=waypoints_nh44
            )

            waypoints_alt = [
                [32.7266, 74.8570], # Jammu
                [33.2307, 74.3986], # Rajouri (Mughal Road approx start approach)
                [33.6429, 74.6067], # Shopian
                [34.0837, 74.7973]  # Srinagar
            ]
             
            route_mughal = Route(
                name="Mughal Road (Alternate)",
                risk_level="MEDIUM",
                status="CONGESTED",
                waypoints=waypoints_alt
            )

            db.add(route_nh44)
            db.add(route_mughal)
            print("Added Routes.")

        # Check if assets exist (we might have cleared DB or this is first run)
        existing_asset = await db.get(TransportAsset, 1)
        if not existing_asset:
            assets = [
                TransportAsset(name="ALS-001 (Alpha)", asset_type="Ashok Leyland Stallion", capacity_tons=2.5, is_available=True, current_lat=32.7266, current_long=74.8570, fuel_status=85.0),
                TransportAsset(name="TATA-407 (Bravo)", asset_type="Tata 407", capacity_tons=1.5, is_available=False, current_lat=33.2435, current_long=75.2476, fuel_status=45.0), # At Ramban
                TransportAsset(name="ALS-002 (Charlie)", asset_type="Ashok Leyland Stallion", capacity_tons=2.5, is_available=True, current_lat=34.0837, current_long=74.7973, fuel_status=92.0), # At Srinagar
                TransportAsset(name="Gypsy-HQ (Delta)", asset_type="Maruti Gypsy", capacity_tons=0.5, is_available=True, current_lat=32.9197, current_long=75.0440, fuel_status=100.0), # At Udhampur
            ]
            db.add_all(assets)
            print("Added Assets.")

        # Check for Convoys
        existing_convoy = await db.get(Convoy, 1)
        if not existing_convoy:
             convoy1 = Convoy(name="Convoy-Alpha-01", start_location="Jammu", end_location="Srinagar", status="IN_TRANSIT", start_time=datetime.utcnow())
             convoy2 = Convoy(name="Convoy-Bravo-upply", start_location="Udhampur", end_location="Leh", status="PLANNED", start_time=datetime.utcnow())
             db.add(convoy1)
             db.add(convoy2)
             print("Added Convoys.")

        await db.commit()
        print("Seeding Complete.")

if __name__ == "__main__":
    asyncio.run(seed_data())
