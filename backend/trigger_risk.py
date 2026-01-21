import asyncio
import sys
import os

# Add backend root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.services.risk_analysis import RouteRiskService

async def run_analysis():
    print("Connecting to DB...")
    async with SessionLocal() as db:
        print("Triggering Analysis...")
        result = await RouteRiskService.analyze_risks(db)
        print(f"Analysis Complete: {result}")

if __name__ == "__main__":
    asyncio.run(run_analysis())
