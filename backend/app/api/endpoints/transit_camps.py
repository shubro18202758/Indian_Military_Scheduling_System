"""
Transit Camp and Halt Planning API Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from datetime import datetime, timedelta

from app.core.database import get_db
from app.models.transit_camp import TransitCamp, HaltRequest
from app.schemas.transit_camp import (
    TransitCampCreate, TransitCamp as TransitCampSchema, TransitCampUpdate,
    HaltRequestCreate, HaltRequest as HaltRequestSchema, HaltRequestUpdate,
    HaltPlanRequest
)

router = APIRouter()


# Transit Camp endpoints
@router.post("/", response_model=TransitCampSchema)
async def create_transit_camp(camp: TransitCampCreate, db: AsyncSession = Depends(get_db)):
    """Create a new Transit Camp."""
    new_camp = TransitCamp(**camp.model_dump())
    db.add(new_camp)
    await db.commit()
    await db.refresh(new_camp)
    return new_camp


@router.get("/", response_model=List[TransitCampSchema])
async def list_transit_camps(
    route_id: int = None,
    status: str = None,
    has_fuel: bool = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """List all transit camps with optional filtering."""
    query = select(TransitCamp)
    
    if route_id:
        query = query.where(TransitCamp.route_id == route_id)
    if status:
        query = query.where(TransitCamp.status == status)
    if has_fuel is not None:
        query = query.where(TransitCamp.has_fuel == has_fuel)
    
    query = query.order_by(TransitCamp.route_km_marker).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{camp_id}", response_model=TransitCampSchema)
async def get_transit_camp(camp_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific transit camp by ID."""
    result = await db.execute(select(TransitCamp).where(TransitCamp.id == camp_id))
    camp = result.scalars().first()
    if not camp:
        raise HTTPException(status_code=404, detail="Transit camp not found")
    return camp


@router.patch("/{camp_id}", response_model=TransitCampSchema)
async def update_transit_camp(
    camp_id: int,
    update: TransitCampUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a transit camp's status or occupancy."""
    result = await db.execute(select(TransitCamp).where(TransitCamp.id == camp_id))
    camp = result.scalars().first()
    if not camp:
        raise HTTPException(status_code=404, detail="Transit camp not found")
    
    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(camp, field, value)
    
    await db.commit()
    await db.refresh(camp)
    return camp


@router.get("/{camp_id}/availability")
async def check_availability(
    camp_id: int,
    vehicles: int = 1,
    personnel: int = 10,
    arrival_time: datetime = None,
    db: AsyncSession = Depends(get_db)
):
    """Check if a transit camp can accommodate a halt request."""
    result = await db.execute(select(TransitCamp).where(TransitCamp.id == camp_id))
    camp = result.scalars().first()
    if not camp:
        raise HTTPException(status_code=404, detail="Transit camp not found")
    
    available_vehicles = camp.vehicle_capacity - camp.current_occupancy_vehicles
    available_personnel = camp.personnel_capacity - camp.current_occupancy_personnel
    
    can_accommodate = (
        available_vehicles >= vehicles and
        available_personnel >= personnel and
        camp.status == "OPERATIONAL"
    )
    
    return {
        "camp_id": camp_id,
        "camp_name": camp.name,
        "can_accommodate": can_accommodate,
        "available_vehicle_slots": available_vehicles,
        "available_personnel_slots": available_personnel,
        "requested_vehicles": vehicles,
        "requested_personnel": personnel,
        "status": camp.status,
        "has_fuel": camp.has_fuel,
        "fuel_diesel_available": camp.fuel_diesel_liters,
        "fuel_petrol_available": camp.fuel_petrol_liters,
    }


# Halt Request endpoints
@router.post("/halts/", response_model=HaltRequestSchema)
async def create_halt_request(request: HaltRequestCreate, db: AsyncSession = Depends(get_db)):
    """Create a halt request for a convoy."""
    # Check camp availability
    result = await db.execute(select(TransitCamp).where(TransitCamp.id == request.transit_camp_id))
    camp = result.scalars().first()
    if not camp:
        raise HTTPException(status_code=404, detail="Transit camp not found")
    
    available_vehicles = camp.vehicle_capacity - camp.current_occupancy_vehicles
    available_personnel = camp.personnel_capacity - camp.current_occupancy_personnel
    
    if available_vehicles < request.requested_vehicles or available_personnel < request.requested_personnel:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient capacity. Available: {available_vehicles} vehicles, {available_personnel} personnel"
        )
    
    new_request = HaltRequest(
        **request.model_dump(),
        expected_departure=request.expected_arrival + timedelta(hours=request.halt_duration_hours)
    )
    db.add(new_request)
    await db.commit()
    await db.refresh(new_request)
    return new_request


@router.get("/halts/", response_model=List[HaltRequestSchema])
async def list_halt_requests(
    convoy_id: int = None,
    transit_camp_id: int = None,
    status: str = None,
    db: AsyncSession = Depends(get_db)
):
    """List halt requests with optional filtering."""
    query = select(HaltRequest)
    
    if convoy_id:
        query = query.where(HaltRequest.convoy_id == convoy_id)
    if transit_camp_id:
        query = query.where(HaltRequest.transit_camp_id == transit_camp_id)
    if status:
        query = query.where(HaltRequest.status == status)
    
    query = query.order_by(HaltRequest.expected_arrival)
    result = await db.execute(query)
    return result.scalars().all()


@router.patch("/halts/{request_id}", response_model=HaltRequestSchema)
async def update_halt_request(
    request_id: int,
    update: HaltRequestUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a halt request (approve, reject, complete)."""
    result = await db.execute(select(HaltRequest).where(HaltRequest.id == request_id))
    halt_request = result.scalars().first()
    if not halt_request:
        raise HTTPException(status_code=404, detail="Halt request not found")
    
    # If approving, update camp occupancy
    if update.status == "APPROVED" and halt_request.status != "APPROVED":
        camp_result = await db.execute(select(TransitCamp).where(TransitCamp.id == halt_request.transit_camp_id))
        camp = camp_result.scalars().first()
        if camp:
            camp.current_occupancy_vehicles += halt_request.requested_vehicles
            camp.current_occupancy_personnel += halt_request.requested_personnel
    
    # If completing, release occupancy
    if update.status == "COMPLETED" and halt_request.status == "APPROVED":
        camp_result = await db.execute(select(TransitCamp).where(TransitCamp.id == halt_request.transit_camp_id))
        camp = camp_result.scalars().first()
        if camp:
            camp.current_occupancy_vehicles = max(0, camp.current_occupancy_vehicles - halt_request.requested_vehicles)
            camp.current_occupancy_personnel = max(0, camp.current_occupancy_personnel - halt_request.requested_personnel)
    
    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(halt_request, field, value)
    
    await db.commit()
    await db.refresh(halt_request)
    return halt_request


@router.post("/halts/auto-plan")
async def auto_plan_halts(request: HaltPlanRequest, db: AsyncSession = Depends(get_db)):
    """
    Automatically plan halts for a convoy based on route and constraints.
    Returns recommended halt points with timing.
    """
    from app.models.convoy import Convoy
    from app.models.route import Route
    from app.services.eta_predictor import eta_predictor
    
    # Get convoy and route
    convoy_result = await db.execute(select(Convoy).where(Convoy.id == request.convoy_id))
    convoy = convoy_result.scalars().first()
    if not convoy:
        raise HTTPException(status_code=404, detail="Convoy not found")
    
    route_result = await db.execute(select(Route).where(Route.id == request.route_id))
    route = route_result.scalars().first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    # Get transit camps on route
    camps_result = await db.execute(
        select(TransitCamp)
        .where(TransitCamp.route_id == request.route_id)
        .where(TransitCamp.status == "OPERATIONAL")
        .order_by(TransitCamp.route_km_marker)
    )
    camps = camps_result.scalars().all()
    
    if not camps:
        return {
            "convoy_id": convoy.id,
            "route_id": route.id,
            "planned_halts": [],
            "message": "No operational transit camps found on route"
        }
    
    # Calculate halt points based on driving time
    speed_kmh = convoy.convoy_speed_kmh or 40.0
    max_driving_km = speed_kmh * request.max_driving_hours
    
    planned_halts = []
    current_km = 0
    current_time = convoy.start_time or datetime.utcnow()
    
    for camp in camps:
        distance_to_camp = (camp.route_km_marker or 0) - current_km
        
        if distance_to_camp >= max_driving_km * 0.8:  # Plan halt at 80% of max driving distance
            # Check if camp meets requirements
            meets_requirements = True
            if request.require_fuel and not camp.has_fuel:
                meets_requirements = False
            if request.require_mess and not camp.has_mess:
                meets_requirements = False
            
            if meets_requirements:
                # Predict arrival time
                eta = eta_predictor.predict_eta(
                    distance_km=distance_to_camp,
                    base_speed_kmh=speed_kmh,
                    terrain=route.terrain_type or "PLAINS",
                    departure_time=current_time,
                )
                
                arrival_time = datetime.fromisoformat(eta["prediction"]["predicted_arrival"])
                departure_time = arrival_time + timedelta(hours=request.preferred_halt_duration_hours)
                
                planned_halts.append({
                    "camp_id": camp.id,
                    "camp_name": camp.name,
                    "km_marker": camp.route_km_marker,
                    "distance_from_previous": distance_to_camp,
                    "expected_arrival": arrival_time.isoformat(),
                    "expected_departure": departure_time.isoformat(),
                    "halt_duration_hours": request.preferred_halt_duration_hours,
                    "facilities": {
                        "fuel": camp.has_fuel,
                        "mess": camp.has_mess,
                        "medical": camp.has_medical,
                        "maintenance": camp.has_maintenance,
                    }
                })
                
                current_km = camp.route_km_marker or 0
                current_time = departure_time
    
    return {
        "convoy_id": convoy.id,
        "convoy_name": convoy.name,
        "route_id": route.id,
        "route_name": route.name,
        "total_distance_km": route.total_distance_km,
        "max_driving_hours": request.max_driving_hours,
        "planned_halts": planned_halts,
        "total_halts": len(planned_halts),
    }
