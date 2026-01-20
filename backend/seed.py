import asyncio
import sys
import os

# Add the parent directory to sys.path to make 'app' module importable
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal, engine, Base
from app.models.asset import TransportAsset

async def seed_data():
    print("Creating tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    print("Seeding data...")
    async with SessionLocal() as db:
        # Check if data exists
        existing = await db.get(TransportAsset, 1)
        if existing:
            print("Data already exists. Skipping.")
            return

        assets = [
            TransportAsset(
                name="ALS-001 (Alpha)",
                asset_type="Ashok Leyland Stallion",
                capacity_tons=2.5,
                is_available=True,
                current_lat=28.6139,
                current_long=77.2090, 
                fuel_status=85.0
            ),
            TransportAsset(
                name="TATA-407 (Bravo)",
                asset_type="Tata 407",
                capacity_tons=1.5,
                is_available=False,
                current_lat=30.7333,
                current_long=76.7794,
                fuel_status=45.0
            ),
            TransportAsset(
                name="ALS-002 (Charlie)",
                asset_type="Ashok Leyland Stallion",
                capacity_tons=2.5,
                is_available=True,
                current_lat=34.0837,
                current_long=74.7973,
                fuel_status=92.0
            ),
            TransportAsset(
                name="Gypsy-HQ (Delta)",
                asset_type="Maruti Gypsy",
                capacity_tons=0.5,
                is_available=True,
                current_lat=32.7266,
                current_long=74.8570,
                fuel_status=100.0
            ),
        ]

        db.add_all(assets)
        await db.commit()
        print(f"Successfully added {len(assets)} assets.")

if __name__ == "__main__":
    asyncio.run(seed_data())
