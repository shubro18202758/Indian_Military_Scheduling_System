"""
TCP (Traffic Control Point) API Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.core.database import get_db
from app.models.tcp import TCP, TCPCrossing
from app.schemas.tcp import (
    TCPCreate, TCP as TCPSchema, TCPUpdate,
    TCPCrossingCreate, TCPCrossing as TCPCrossingSchema, TCPCrossingUpdate
)

router = APIRouter()


@router.post("/", response_model=TCPSchema)
async def create_tcp(tcp: TCPCreate, db: AsyncSession = Depends(get_db)):
    """Create a new Traffic Control Point."""
    new_tcp = TCP(**tcp.model_dump())
    db.add(new_tcp)
    await db.commit()
    await db.refresh(new_tcp)
    return new_tcp


@router.get("/", response_model=List[TCPSchema])
async def list_tcps(
    route_id: int = None,
    status: str = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """List all TCPs with optional filtering."""
    query = select(TCP)
    
    if route_id:
        query = query.where(TCP.route_id == route_id)
    if status:
        query = query.where(TCP.status == status)
    
    query = query.order_by(TCP.route_km_marker).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{tcp_id}", response_model=TCPSchema)
async def get_tcp(tcp_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific TCP by ID."""
    result = await db.execute(select(TCP).where(TCP.id == tcp_id))
    tcp = result.scalars().first()
    if not tcp:
        raise HTTPException(status_code=404, detail="TCP not found")
    return tcp


@router.patch("/{tcp_id}", response_model=TCPSchema)
async def update_tcp(tcp_id: int, update: TCPUpdate, db: AsyncSession = Depends(get_db)):
    """Update a TCP's status or configuration."""
    result = await db.execute(select(TCP).where(TCP.id == tcp_id))
    tcp = result.scalars().first()
    if not tcp:
        raise HTTPException(status_code=404, detail="TCP not found")
    
    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tcp, field, value)
    
    await db.commit()
    await db.refresh(tcp)
    return tcp


# TCP Crossing endpoints
@router.post("/crossings/", response_model=TCPCrossingSchema)
async def create_crossing(crossing: TCPCrossingCreate, db: AsyncSession = Depends(get_db)):
    """Create a TCP crossing record."""
    new_crossing = TCPCrossing(**crossing.model_dump())
    db.add(new_crossing)
    await db.commit()
    await db.refresh(new_crossing)
    return new_crossing


@router.get("/crossings/convoy/{convoy_id}", response_model=List[TCPCrossingSchema])
async def get_convoy_crossings(convoy_id: int, db: AsyncSession = Depends(get_db)):
    """Get all TCP crossings for a convoy."""
    result = await db.execute(
        select(TCPCrossing).where(TCPCrossing.convoy_id == convoy_id).order_by(TCPCrossing.expected_arrival)
    )
    return result.scalars().all()


@router.patch("/crossings/{crossing_id}", response_model=TCPCrossingSchema)
async def update_crossing(
    crossing_id: int,
    update: TCPCrossingUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a TCP crossing (e.g., mark arrived, cleared)."""
    result = await db.execute(select(TCPCrossing).where(TCPCrossing.id == crossing_id))
    crossing = result.scalars().first()
    if not crossing:
        raise HTTPException(status_code=404, detail="Crossing not found")
    
    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(crossing, field, value)
    
    await db.commit()
    await db.refresh(crossing)
    return crossing
