from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.core.database import get_db
from app.models.convoy import Convoy
from app.schemas.convoy import ConvoyCreate, Convoy as ConvoySchema

router = APIRouter()

@router.post("/", response_model=ConvoySchema)
async def create_convoy(convoy: ConvoyCreate, db: AsyncSession = Depends(get_db)):
    """
    Create a new Convoy plan.
    """
    new_convoy = Convoy(**convoy.model_dump())
    db.add(new_convoy)
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
