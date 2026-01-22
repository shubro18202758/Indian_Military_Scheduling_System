from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.core.database import get_db
from app.models.convoy import Convoy
from app.models.asset import TransportAsset
from app.models.route import Route
from app.schemas.convoy import ConvoyCreate, Convoy as ConvoySchema
from app.services.routing import fetch_osrm_route

router = APIRouter()

@router.post("/", response_model=ConvoySchema)
async def create_convoy(convoy: ConvoyCreate, db: AsyncSession = Depends(get_db)):
    """
    Create a new Convoy plan with optional Asset allocation and Auto-Routing.
    """
    data = convoy.model_dump()
    asset_ids = data.pop('asset_ids', [])
    
    # Extract coordinates meant for logic, not for Convoy model columns (if they differ)
    # Actually Convoy model uses string 'start_location', so we keep that.
    # But we pop the lat/longs as they are not columns in Convoy table
    start_lat = data.pop('start_lat', None)
    start_long = data.pop('start_long', None)
    end_lat = data.pop('end_lat', None)
    end_long = data.pop('end_long', None)
    
    new_convoy = Convoy(**data)
    db.add(new_convoy)
    await db.flush() # Generate ID

    # 1. Link selected Assets
    if asset_ids:
        stmt = select(TransportAsset).where(TransportAsset.id.in_(asset_ids))
        result = await db.execute(stmt)
        assets = result.scalars().all()
        for asset in assets:
            asset.convoy_id = new_convoy.id
            db.add(asset)

    # 2. Auto-Plan Route if coordinates provided (Dijkstra/OSRM)
    if start_lat and start_long and end_lat and end_long:
        try:
            waypoints = await fetch_osrm_route(start_lat, start_long, end_lat, end_long)
            if waypoints:
                route = Route(
                    name=f"Route: {new_convoy.name}",
                    waypoints=waypoints,
                    status="OPEN"
                )
                db.add(route)
                await db.flush()
                new_convoy.route_id = route.id
        except Exception as e:
            print(f"Error fetching OSRM route: {e}")
            # We continue without failing the whole request
            
    await db.commit()
    await db.refresh(new_convoy)
    return new_convoy

@router.get("/", response_model=List[ConvoySchema])
async def read_convoys(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    """
    List all convoys.
    """
    result = await db.execute(select(Convoy).offset(skip).limit(limit))
    convoys = result.scalars().all()
    return convoys
