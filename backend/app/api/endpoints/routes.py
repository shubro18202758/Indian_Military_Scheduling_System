from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.core.database import get_db
from app.models.route import Route
from app.schemas.route import RouteCreate, Route as RouteSchema
from app.services.risk_analysis import RouteRiskService

router = APIRouter()

@router.post("/", response_model=RouteSchema)
async def create_route(route: RouteCreate, db: AsyncSession = Depends(get_db)):
    """
    Create a new Route definition.
    """
    new_route = Route(**route.model_dump())
    db.add(new_route)
    await db.commit()
    await db.refresh(new_route)
    return new_route

@router.get("/", response_model=List[RouteSchema])
async def read_routes(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    """
    Get all routes.
    """
    result = await db.execute(select(Route).offset(skip).limit(limit))
    routes = result.scalars().all()
    return routes

@router.post("/analyze-risk")
async def trigger_risk_analysis(db: AsyncSession = Depends(get_db)):
    """
    Triggers the AI Risk Analysis engine to re-evaluate route validities.
    """
    return await RouteRiskService.analyze_risks(db)
