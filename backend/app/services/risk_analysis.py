import random
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.route import Route

class RouteRiskService:
    @staticmethod
    async def analyze_risks(db: AsyncSession):
        """
        Analyzes and updates risk levels for all routes based on simulated intelligence data.
        """
        print("Running Route Risk Analysis...")
        
        result = await db.execute(select(Route))
        routes = result.scalars().all()
        
        updates = 0
        for route in routes:
            # SIMULATION LOGIC:
            # In a real system, this would query a Threat Intel API or weather service.
            # Here, we randomize it to demonstrate the UI capability.
            
            # 20% chance of HIGH risk
            # 30% chance of MEDIUM risk
            # 50% chance of LOW risk
            rand = random.random()
            
            old_risk = route.risk_level
            
            if rand < 0.2:
                route.risk_level = "HIGH"
                route.status = "re-routing recommended"
            elif rand < 0.5:
                route.risk_level = "MEDIUM"
                route.status = "caution"
            else:
                route.risk_level = "LOW"
                route.status = "open"
                
            if old_risk != route.risk_level:
                updates += 1
                
        await db.commit()
        return {"total_routes": len(routes), "risk_updates": updates}
