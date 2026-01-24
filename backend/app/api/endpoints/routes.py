from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.core.database import get_db
from app.models.route import Route
from app.schemas.route import RouteCreate, Route as RouteSchema, RoutePlanRequest
from app.services.risk_analysis import RouteRiskService
from app.services.routing import fetch_route_with_metadata

router = APIRouter()


@router.post("/plan", response_model=RouteSchema)
async def plan_route(request: RoutePlanRequest, db: AsyncSession = Depends(get_db)):
    """
    Plan a route using OSRM and create it in the database.
    Uses Open Source Routing Machine for real driving directions.
    """
    # Fetch route from OSRM
    route_data = await fetch_route_with_metadata(
        start_coords=(request.start_lat, request.start_long),
        end_coords=(request.end_lat, request.end_long)
    )
    
    if not route_data:
        raise HTTPException(
            status_code=503,
            detail="Could not fetch route from OSRM. Please try again later."
        )
    
    # Create the route in database
    new_route = Route(
        name=request.name,
        start_lat=request.start_lat,
        start_long=request.start_long,
        end_lat=request.end_lat,
        end_long=request.end_long,
        waypoints=route_data["waypoints"],
        total_distance_km=route_data["distance_km"],
        estimated_time_hours=route_data["duration_hours"]
    )
    
    db.add(new_route)
    await db.commit()
    await db.refresh(new_route)
    
    return new_route


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

@router.post("/plan", response_model=RouteSchema)
async def plan_route(plan: RoutePlanRequest, db: AsyncSession = Depends(get_db)):
    """
    Plan a new route using OSRM High-Fidelity API.
    """
    from app.services.routing import fetch_osrm_route
    
    start = [plan.start_lat, plan.start_long]
    end = [plan.end_lat, plan.end_long]
    
    waypoints = await fetch_osrm_route(start, end)
    
    if not waypoints:
        # Fallback to straight line if API fails
        waypoints = [start, end]
        
    new_route = Route(
        name=plan.name,
        risk_level="LOW", # Default
        status="OPEN",
        waypoints=waypoints
    )
    db.add(new_route)
    await db.commit()
    await db.refresh(new_route)
    return new_route
