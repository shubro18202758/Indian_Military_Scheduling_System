"""
Command Centre API Endpoints
=============================
भारतीय सेना (Indian Army) Logistics Command Centre

Comprehensive REST API for:
- Load Management & Prioritization
- Vehicle Sharing Operations
- Movement Planning & Coordination
- Dynamic Entity Notifications
- Road Space Management
- Real-time Dashboard Metrics

Security Classification: प्रतिबंधित (RESTRICTED)
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
import uuid

from app.core.database import get_db
from app.models.convoy import Convoy
from app.models.route import Route
from app.models.asset import TransportAsset
from app.models.tcp import TCP
from app.models.transit_camp import TransitCamp
from app.models.obstacle import Obstacle
from app.models.command_centre import (
    MilitaryEntity, LoadAssignment, LoadItem, VehicleSharingRequest,
    VehiclePoolStatus, MovementPlan, MovementWaypoint, RoadSpaceAllocation,
    EntityNotification, CommandCentreMetrics, EntityType, LoadPriority,
    LoadCategory, SharingStatus, MovementPlanStatus, NotificationType,
    RoadSpaceStatus
)
from app.services.command_centre_engine import CommandCentreEngine


router = APIRouter(tags=["Command Centre"])


# ============================================================================
# PYDANTIC SCHEMAS
# ============================================================================

class EntityCreate(BaseModel):
    name: str
    code: str
    entity_type: str = EntityType.BATTALION.value
    base_latitude: float
    base_longitude: float
    sector: Optional[str] = None
    commanding_officer: Optional[str] = None
    vehicle_capacity: int = 50
    storage_capacity_tons: float = 500.0
    personnel_strength: int = 500


class LoadAssignmentCreate(BaseModel):
    load_category: str = LoadCategory.GENERAL.value
    priority: str = LoadPriority.MEDIUM.value
    description: Optional[str] = None
    total_weight_tons: float
    total_volume_cubic_m: Optional[float] = None
    item_count: int = 1
    source_entity_id: int
    destination_entity_id: int
    required_by: Optional[datetime] = None
    convoy_id: Optional[int] = None


class VehicleSharingRequestCreate(BaseModel):
    requesting_entity_id: int
    vehicle_type_required: str
    quantity_required: int = 1
    capacity_tons_required: Optional[float] = None
    start_date: datetime
    end_date: datetime
    purpose: Optional[str] = None
    priority: str = LoadPriority.MEDIUM.value


class MovementPlanRequest(BaseModel):
    convoy_id: int
    route_id: int
    departure_time: datetime
    load_assignment_ids: Optional[List[int]] = None


class RoadSpaceCheckRequest(BaseModel):
    route_id: int
    start_time: datetime
    end_time: datetime


class NotificationRequest(BaseModel):
    entity_id: int
    notification_type: str
    title: str
    message: str
    priority: str = LoadPriority.MEDIUM.value
    details: Optional[Dict] = None
    convoy_id: Optional[int] = None
    route_id: Optional[int] = None


# ============================================================================
# DASHBOARD & METRICS ENDPOINTS
# ============================================================================

@router.get("/dashboard")
async def get_command_centre_dashboard(db: AsyncSession = Depends(get_db)):
    """
    Get comprehensive Command Centre dashboard with all metrics
    All values are dynamically calculated from the database
    """
    engine = CommandCentreEngine(db)
    return await engine.get_command_centre_dashboard()


@router.get("/dashboard/summary")
async def get_dashboard_summary(db: AsyncSession = Depends(get_db)):
    """Get quick summary metrics for header displays"""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Quick counts
    pending_loads = await db.execute(
        select(func.count(LoadAssignment.id)).where(LoadAssignment.status == "PENDING")
    )
    transit_loads = await db.execute(
        select(func.count(LoadAssignment.id)).where(LoadAssignment.status == "IN_TRANSIT")
    )
    
    convoy_query = await db.execute(
        select(func.count(Convoy.id)).where(Convoy.status == "IN_TRANSIT")
    )
    
    sharing_pending = await db.execute(
        select(func.count(VehicleSharingRequest.id)).where(
            VehicleSharingRequest.status == SharingStatus.REQUESTED.value
        )
    )
    
    alerts = await db.execute(
        select(func.count(EntityNotification.id)).where(
            EntityNotification.status == "PENDING"
        )
    )
    
    obstacles = await db.execute(
        select(func.count(Obstacle.id)).where(Obstacle.is_active == True)
    )
    
    return {
        "loads_pending": pending_loads.scalar() or 0,
        "loads_in_transit": transit_loads.scalar() or 0,
        "convoys_active": convoy_query.scalar() or 0,
        "sharing_requests": sharing_pending.scalar() or 0,
        "pending_alerts": alerts.scalar() or 0,
        "active_obstacles": obstacles.scalar() or 0,
        "timestamp": now.isoformat()
    }


# ============================================================================
# ENTITY MANAGEMENT ENDPOINTS
# ============================================================================

@router.get("/entities")
async def list_entities(
    entity_type: Optional[str] = None,
    sector: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List all military entities with optional filters"""
    query = select(MilitaryEntity)
    
    if entity_type:
        query = query.where(MilitaryEntity.entity_type == entity_type)
    if sector:
        query = query.where(MilitaryEntity.sector == sector)
    
    query = query.order_by(MilitaryEntity.name)
    result = await db.execute(query)
    entities = result.scalars().all()
    
    return [
        {
            "id": e.id,
            "name": e.name,
            "code": e.code,
            "entity_type": e.entity_type,
            "sector": e.sector,
            "latitude": e.base_latitude,
            "longitude": e.base_longitude,
            "commanding_officer": e.commanding_officer,
            "vehicle_capacity": e.vehicle_capacity,
            "current_vehicle_count": e.current_vehicle_count,
            "storage_capacity_tons": e.storage_capacity_tons,
            "current_storage_used_tons": e.current_storage_used_tons,
            "personnel_strength": e.personnel_strength,
            "operational_status": e.operational_status
        }
        for e in entities
    ]


@router.post("/entities")
async def create_entity(entity: EntityCreate, db: AsyncSession = Depends(get_db)):
    """Create a new military entity"""
    new_entity = MilitaryEntity(
        name=entity.name,
        code=entity.code,
        entity_type=entity.entity_type,
        base_latitude=entity.base_latitude,
        base_longitude=entity.base_longitude,
        sector=entity.sector,
        commanding_officer=entity.commanding_officer,
        vehicle_capacity=entity.vehicle_capacity,
        storage_capacity_tons=entity.storage_capacity_tons,
        personnel_strength=entity.personnel_strength
    )
    
    db.add(new_entity)
    await db.commit()
    await db.refresh(new_entity)
    
    return {"id": new_entity.id, "code": new_entity.code, "message": "Entity created successfully"}


@router.get("/entities/{entity_id}")
async def get_entity(entity_id: int, db: AsyncSession = Depends(get_db)):
    """Get detailed information about a specific entity"""
    entity = await db.get(MilitaryEntity, entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    
    # Get related stats
    loads_from = await db.execute(
        select(func.count(LoadAssignment.id)).where(LoadAssignment.source_entity_id == entity_id)
    )
    loads_to = await db.execute(
        select(func.count(LoadAssignment.id)).where(LoadAssignment.destination_entity_id == entity_id)
    )
    
    sharing_requests = await db.execute(
        select(func.count(VehicleSharingRequest.id)).where(
            VehicleSharingRequest.requesting_entity_id == entity_id
        )
    )
    
    notifications = await db.execute(
        select(func.count(EntityNotification.id)).where(
            and_(
                EntityNotification.entity_id == entity_id,
                EntityNotification.status == "PENDING"
            )
        )
    )
    
    return {
        "id": entity.id,
        "name": entity.name,
        "code": entity.code,
        "entity_type": entity.entity_type,
        "sector": entity.sector,
        "location": {
            "latitude": entity.base_latitude,
            "longitude": entity.base_longitude
        },
        "commanding_officer": entity.commanding_officer,
        "contact_radio_freq": entity.contact_radio_freq,
        "capacity": {
            "vehicles": entity.vehicle_capacity,
            "current_vehicles": entity.current_vehicle_count,
            "storage_tons": entity.storage_capacity_tons,
            "storage_used_tons": entity.current_storage_used_tons,
            "personnel": entity.personnel_strength
        },
        "operational_status": entity.operational_status,
        "statistics": {
            "loads_dispatched": loads_from.scalar() or 0,
            "loads_received": loads_to.scalar() or 0,
            "sharing_requests": sharing_requests.scalar() or 0,
            "pending_notifications": notifications.scalar() or 0
        }
    }


# ============================================================================
# LOAD MANAGEMENT ENDPOINTS
# ============================================================================

@router.get("/loads")
async def list_load_assignments(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    category: Optional[str] = None,
    entity_id: Optional[int] = None,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db)
):
    """List load assignments with filters"""
    query = select(LoadAssignment)
    
    if status:
        query = query.where(LoadAssignment.status == status)
    if priority:
        query = query.where(LoadAssignment.priority == priority)
    if category:
        query = query.where(LoadAssignment.load_category == category)
    if entity_id:
        query = query.where(
            or_(
                LoadAssignment.source_entity_id == entity_id,
                LoadAssignment.destination_entity_id == entity_id
            )
        )
    
    query = query.order_by(desc(LoadAssignment.ai_priority_score)).limit(limit)
    result = await db.execute(query)
    loads = result.scalars().all()
    
    load_list = []
    for load in loads:
        source = await db.get(MilitaryEntity, load.source_entity_id)
        dest = await db.get(MilitaryEntity, load.destination_entity_id)
        
        load_list.append({
            "id": load.id,
            "assignment_code": load.assignment_code,
            "load_category": load.load_category,
            "priority": load.priority,
            "description": load.description,
            "total_weight_tons": load.total_weight_tons,
            "total_volume_cubic_m": load.total_volume_cubic_m,
            "item_count": load.item_count,
            "source": {
                "id": load.source_entity_id,
                "name": source.name if source else "Unknown"
            },
            "destination": {
                "id": load.destination_entity_id,
                "name": dest.name if dest else "Unknown"
            },
            "convoy_id": load.convoy_id,
            "required_by": load.required_by.isoformat() if load.required_by else None,
            "scheduled_pickup": load.scheduled_pickup.isoformat() if load.scheduled_pickup else None,
            "status": load.status,
            "completion_percentage": load.completion_percentage,
            "ai_priority_score": load.ai_priority_score,
            "created_at": load.created_at.isoformat()
        })
    
    return load_list


@router.post("/loads")
async def create_load_assignment(load: LoadAssignmentCreate, db: AsyncSession = Depends(get_db)):
    """Create a new load assignment"""
    # Generate unique assignment code
    assignment_code = f"LOAD-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    
    new_load = LoadAssignment(
        assignment_code=assignment_code,
        load_category=load.load_category,
        priority=load.priority,
        description=load.description,
        total_weight_tons=load.total_weight_tons,
        total_volume_cubic_m=load.total_volume_cubic_m,
        item_count=load.item_count,
        source_entity_id=load.source_entity_id,
        destination_entity_id=load.destination_entity_id,
        required_by=load.required_by,
        convoy_id=load.convoy_id,
        status="PENDING"
    )
    
    # Calculate AI priority score
    engine = CommandCentreEngine(db)
    db.add(new_load)
    await db.flush()
    
    priority_analysis = await engine.calculate_load_priority_score(new_load)
    new_load.ai_priority_score = priority_analysis["priority_score"]
    
    await db.commit()
    await db.refresh(new_load)
    
    return {
        "id": new_load.id,
        "assignment_code": new_load.assignment_code,
        "ai_priority_score": new_load.ai_priority_score,
        "message": "Load assignment created successfully"
    }


@router.get("/loads/prioritized-queue")
async def get_prioritized_load_queue(
    entity_id: Optional[int] = None,
    limit: int = Query(20, le=50),
    db: AsyncSession = Depends(get_db)
):
    """Get AI-prioritized queue of pending load assignments"""
    engine = CommandCentreEngine(db)
    return await engine.get_prioritized_load_queue(limit=limit, entity_id=entity_id)


@router.post("/loads/optimize-distribution")
async def optimize_load_distribution(
    load_ids: List[int] = Body(...),
    vehicle_ids: Optional[List[int]] = Body(None),
    db: AsyncSession = Depends(get_db)
):
    """AI-optimize load distribution across available vehicles"""
    # Get available vehicles
    if vehicle_ids:
        query = select(TransportAsset).where(
            and_(
                TransportAsset.id.in_(vehicle_ids),
                TransportAsset.is_available == True
            )
        )
    else:
        query = select(TransportAsset).where(TransportAsset.is_available == True).limit(20)
    
    result = await db.execute(query)
    vehicles = result.scalars().all()
    
    vehicle_list = [
        {
            "id": v.id,
            "name": v.name,
            "capacity_tons": v.capacity_tons,
            "asset_type": v.asset_type
        }
        for v in vehicles
    ]
    
    engine = CommandCentreEngine(db)
    return await engine.optimize_load_distribution(load_ids, vehicle_list)


@router.get("/loads/{load_id}")
async def get_load_assignment(load_id: int, db: AsyncSession = Depends(get_db)):
    """Get detailed information about a load assignment"""
    load = await db.get(LoadAssignment, load_id)
    if not load:
        raise HTTPException(status_code=404, detail="Load assignment not found")
    
    source = await db.get(MilitaryEntity, load.source_entity_id)
    dest = await db.get(MilitaryEntity, load.destination_entity_id)
    convoy = await db.get(Convoy, load.convoy_id) if load.convoy_id else None
    
    # Get load items
    items_query = select(LoadItem).where(LoadItem.load_assignment_id == load_id)
    items_result = await db.execute(items_query)
    items = items_result.scalars().all()
    
    # Calculate priority analysis
    engine = CommandCentreEngine(db)
    priority_analysis = await engine.calculate_load_priority_score(load)
    
    return {
        "id": load.id,
        "assignment_code": load.assignment_code,
        "load_category": load.load_category,
        "priority": load.priority,
        "description": load.description,
        "weight": {
            "total_tons": load.total_weight_tons,
            "volume_cubic_m": load.total_volume_cubic_m
        },
        "item_count": load.item_count,
        "source": {
            "id": load.source_entity_id,
            "name": source.name if source else "Unknown",
            "code": source.code if source else None
        },
        "destination": {
            "id": load.destination_entity_id,
            "name": dest.name if dest else "Unknown",
            "code": dest.code if dest else None
        },
        "convoy": {
            "id": convoy.id if convoy else None,
            "name": convoy.name if convoy else None
        } if convoy else None,
        "timing": {
            "required_by": load.required_by.isoformat() if load.required_by else None,
            "scheduled_pickup": load.scheduled_pickup.isoformat() if load.scheduled_pickup else None,
            "actual_pickup": load.actual_pickup.isoformat() if load.actual_pickup else None,
            "scheduled_delivery": load.scheduled_delivery.isoformat() if load.scheduled_delivery else None,
            "actual_delivery": load.actual_delivery.isoformat() if load.actual_delivery else None
        },
        "status": load.status,
        "completion_percentage": load.completion_percentage,
        "ai_analysis": priority_analysis,
        "items": [
            {
                "id": item.id,
                "name": item.item_name,
                "code": item.item_code,
                "category": item.category,
                "quantity": item.quantity,
                "unit": item.unit,
                "weight_kg": item.weight_kg,
                "is_hazardous": item.is_hazardous,
                "status": item.status
            }
            for item in items
        ],
        "created_at": load.created_at.isoformat()
    }


@router.patch("/loads/{load_id}/status")
async def update_load_status(
    load_id: int,
    status: str = Body(..., embed=True),
    db: AsyncSession = Depends(get_db)
):
    """Update load assignment status"""
    load = await db.get(LoadAssignment, load_id)
    if not load:
        raise HTTPException(status_code=404, detail="Load assignment not found")
    
    valid_statuses = ["PENDING", "ASSIGNED", "LOADING", "IN_TRANSIT", "DELIVERED", "FAILED"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    load.status = status
    
    # Update timestamps based on status
    now = datetime.utcnow()
    if status == "LOADING":
        load.actual_pickup = now
        load.completion_percentage = 10.0
    elif status == "IN_TRANSIT":
        load.completion_percentage = 50.0
    elif status == "DELIVERED":
        load.actual_delivery = now
        load.completion_percentage = 100.0
    
    await db.commit()
    
    return {"id": load_id, "status": status, "message": "Status updated successfully"}


# ============================================================================
# VEHICLE SHARING ENDPOINTS
# ============================================================================

@router.get("/vehicle-sharing")
async def list_sharing_requests(
    status: Optional[str] = None,
    entity_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """List vehicle sharing requests"""
    query = select(VehicleSharingRequest)
    
    if status:
        query = query.where(VehicleSharingRequest.status == status)
    if entity_id:
        query = query.where(
            or_(
                VehicleSharingRequest.requesting_entity_id == entity_id,
                VehicleSharingRequest.providing_entity_id == entity_id
            )
        )
    
    query = query.order_by(desc(VehicleSharingRequest.created_at))
    result = await db.execute(query)
    requests = result.scalars().all()
    
    request_list = []
    for req in requests:
        requesting = await db.get(MilitaryEntity, req.requesting_entity_id)
        providing = await db.get(MilitaryEntity, req.providing_entity_id) if req.providing_entity_id else None
        
        request_list.append({
            "id": req.id,
            "request_code": req.request_code,
            "requesting_entity": {
                "id": req.requesting_entity_id,
                "name": requesting.name if requesting else "Unknown"
            },
            "providing_entity": {
                "id": req.providing_entity_id,
                "name": providing.name if providing else None
            } if req.providing_entity_id else None,
            "vehicle_type": req.vehicle_type_required,
            "quantity": req.quantity_required,
            "start_date": req.start_date.isoformat(),
            "end_date": req.end_date.isoformat(),
            "purpose": req.purpose,
            "priority": req.priority,
            "status": req.status,
            "ai_match_score": req.ai_match_score,
            "created_at": req.created_at.isoformat()
        })
    
    return request_list


@router.post("/vehicle-sharing")
async def create_sharing_request(
    request: VehicleSharingRequestCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new vehicle sharing request"""
    request_code = f"VSR-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    
    new_request = VehicleSharingRequest(
        request_code=request_code,
        requesting_entity_id=request.requesting_entity_id,
        vehicle_type_required=request.vehicle_type_required,
        quantity_required=request.quantity_required,
        capacity_tons_required=request.capacity_tons_required,
        start_date=request.start_date,
        end_date=request.end_date,
        purpose=request.purpose,
        priority=request.priority,
        status=SharingStatus.REQUESTED.value
    )
    
    db.add(new_request)
    await db.commit()
    await db.refresh(new_request)
    
    # Find matches
    engine = CommandCentreEngine(db)
    matches = await engine.find_vehicle_sharing_matches(new_request)
    
    return {
        "id": new_request.id,
        "request_code": new_request.request_code,
        "potential_matches": matches[:5],
        "message": "Sharing request created successfully"
    }


@router.get("/vehicle-sharing/{request_id}/matches")
async def find_sharing_matches(request_id: int, db: AsyncSession = Depends(get_db)):
    """Find potential matches for a sharing request"""
    request = await db.get(VehicleSharingRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Sharing request not found")
    
    engine = CommandCentreEngine(db)
    matches = await engine.find_vehicle_sharing_matches(request)
    
    return {
        "request_id": request_id,
        "request_code": request.request_code,
        "matches": matches
    }


@router.get("/vehicle-sharing/fleet-summary")
async def get_fleet_sharing_summary(db: AsyncSession = Depends(get_db)):
    """Get comprehensive fleet sharing summary"""
    engine = CommandCentreEngine(db)
    return await engine.get_fleet_sharing_summary()


@router.patch("/vehicle-sharing/{request_id}/approve")
async def approve_sharing_request(
    request_id: int,
    providing_entity_id: int = Body(..., embed=True),
    vehicle_ids: List[int] = Body(...),
    approval_authority: str = Body(...),
    db: AsyncSession = Depends(get_db)
):
    """Approve a vehicle sharing request"""
    request = await db.get(VehicleSharingRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Sharing request not found")
    
    request.providing_entity_id = providing_entity_id
    request.allocated_vehicle_ids = vehicle_ids
    request.status = SharingStatus.APPROVED.value
    request.approval_authority = approval_authority
    request.approval_date = datetime.utcnow()
    
    await db.commit()
    
    return {"id": request_id, "status": "APPROVED", "message": "Request approved successfully"}


# ============================================================================
# MOVEMENT PLANNING ENDPOINTS
# ============================================================================

@router.get("/movement-plans")
async def list_movement_plans(
    status: Optional[str] = None,
    convoy_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """List movement plans"""
    query = select(MovementPlan)
    
    if status:
        query = query.where(MovementPlan.status == status)
    if convoy_id:
        query = query.where(MovementPlan.convoy_id == convoy_id)
    
    query = query.order_by(desc(MovementPlan.planned_departure))
    result = await db.execute(query)
    plans = result.scalars().all()
    
    engine = CommandCentreEngine(db)
    active_plans = await engine.get_active_movement_plans()
    
    return {
        "active_plans": active_plans,
        "all_plans": [
            {
                "id": p.id,
                "plan_code": p.plan_code,
                "plan_name": p.plan_name,
                "convoy_id": p.convoy_id,
                "route_id": p.primary_route_id,
                "planned_departure": p.planned_departure.isoformat() if p.planned_departure else None,
                "planned_arrival": p.planned_arrival.isoformat() if p.planned_arrival else None,
                "status": p.status,
                "vehicle_count": p.vehicle_count,
                "total_load_tons": p.total_load_tons,
                "ai_optimized": p.ai_optimized
            }
            for p in plans
        ]
    }


@router.post("/movement-plans/generate")
async def generate_movement_plan(
    request: MovementPlanRequest,
    db: AsyncSession = Depends(get_db)
):
    """Generate AI-optimized movement plan"""
    engine = CommandCentreEngine(db)
    return await engine.generate_movement_plan(
        convoy_id=request.convoy_id,
        route_id=request.route_id,
        departure_time=request.departure_time,
        load_assignment_ids=request.load_assignment_ids
    )


@router.get("/movement-plans/{plan_id}")
async def get_movement_plan(plan_id: int, db: AsyncSession = Depends(get_db)):
    """Get detailed movement plan"""
    plan = await db.get(MovementPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Movement plan not found")
    
    convoy = await db.get(Convoy, plan.convoy_id) if plan.convoy_id else None
    route = await db.get(Route, plan.primary_route_id)
    alt_route = await db.get(Route, plan.alternate_route_id) if plan.alternate_route_id else None
    
    # Get waypoints
    waypoints_query = select(MovementWaypoint).where(
        MovementWaypoint.movement_plan_id == plan_id
    ).order_by(MovementWaypoint.sequence_number)
    waypoints_result = await db.execute(waypoints_query)
    waypoints = waypoints_result.scalars().all()
    
    return {
        "id": plan.id,
        "plan_code": plan.plan_code,
        "plan_name": plan.plan_name,
        "convoy": {
            "id": convoy.id,
            "name": convoy.name,
            "status": convoy.status
        } if convoy else None,
        "route": {
            "primary": {
                "id": route.id,
                "name": route.name,
                "distance_km": route.total_distance_km
            } if route else None,
            "alternate": {
                "id": alt_route.id,
                "name": alt_route.name
            } if alt_route else None
        },
        "timing": {
            "planned_departure": plan.planned_departure.isoformat() if plan.planned_departure else None,
            "planned_arrival": plan.planned_arrival.isoformat() if plan.planned_arrival else None,
            "actual_departure": plan.actual_departure.isoformat() if plan.actual_departure else None,
            "actual_arrival": plan.actual_arrival.isoformat() if plan.actual_arrival else None
        },
        "halts": plan.planned_halts,
        "load": {
            "assignment_ids": plan.load_assignment_ids,
            "total_tons": plan.total_load_tons,
            "vehicle_count": plan.vehicle_count
        },
        "risk_assessment": {
            "overall_score": plan.overall_risk_score,
            "threat": plan.threat_assessment,
            "weather": plan.weather_assessment
        },
        "status": plan.status,
        "ai_optimized": plan.ai_optimized,
        "ai_optimization_score": plan.ai_optimization_score,
        "ai_recommendations": plan.ai_recommendations,
        "waypoints": [
            {
                "sequence": wp.sequence_number,
                "name": wp.waypoint_name,
                "type": wp.waypoint_type,
                "latitude": wp.latitude,
                "longitude": wp.longitude,
                "expected_arrival": wp.expected_arrival.isoformat() if wp.expected_arrival else None,
                "expected_departure": wp.expected_departure.isoformat() if wp.expected_departure else None,
                "halt_duration_min": wp.planned_halt_duration_min,
                "status": wp.status
            }
            for wp in waypoints
        ],
        "entities_notified": plan.entities_notified
    }


# ============================================================================
# ROAD SPACE MANAGEMENT ENDPOINTS
# ============================================================================

@router.post("/road-space/check-availability")
async def check_road_space_availability(
    request: RoadSpaceCheckRequest,
    db: AsyncSession = Depends(get_db)
):
    """Check road space availability for a time window"""
    engine = CommandCentreEngine(db)
    return await engine.check_road_space_availability(
        route_id=request.route_id,
        start_time=request.start_time,
        end_time=request.end_time
    )


@router.get("/road-space/utilization")
async def get_road_space_utilization(
    route_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get road space utilization metrics"""
    engine = CommandCentreEngine(db)
    return await engine.get_road_space_utilization(route_id)


@router.get("/road-space/allocations")
async def list_road_space_allocations(
    route_id: Optional[int] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """List road space allocations"""
    now = datetime.utcnow()
    query = select(RoadSpaceAllocation)
    
    if route_id:
        query = query.where(RoadSpaceAllocation.route_id == route_id)
    if active_only:
        query = query.where(
            and_(
                RoadSpaceAllocation.end_time >= now,
                RoadSpaceAllocation.status == RoadSpaceStatus.ALLOCATED.value
            )
        )
    
    query = query.order_by(RoadSpaceAllocation.start_time)
    result = await db.execute(query)
    allocations = result.scalars().all()
    
    alloc_list = []
    for alloc in allocations:
        route = await db.get(Route, alloc.route_id)
        convoy = await db.get(Convoy, alloc.allocated_to_convoy_id) if alloc.allocated_to_convoy_id else None
        
        alloc_list.append({
            "id": alloc.id,
            "allocation_code": alloc.allocation_code,
            "route": {
                "id": alloc.route_id,
                "name": route.name if route else "Unknown"
            },
            "segment": {
                "start_km": alloc.route_segment_start_km,
                "end_km": alloc.route_segment_end_km
            },
            "time_window": {
                "start": alloc.start_time.isoformat(),
                "end": alloc.end_time.isoformat()
            },
            "convoy": {
                "id": convoy.id,
                "name": convoy.name
            } if convoy else None,
            "lane_count": alloc.lane_count,
            "direction": alloc.direction,
            "max_vehicles": alloc.max_vehicles,
            "status": alloc.status,
            "has_conflict": alloc.has_conflict
        })
    
    return alloc_list


# ============================================================================
# NOTIFICATION ENDPOINTS
# ============================================================================

@router.get("/notifications")
async def list_notifications(
    entity_id: Optional[int] = None,
    status: Optional[str] = None,
    notification_type: Optional[str] = None,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db)
):
    """List entity notifications"""
    query = select(EntityNotification)
    
    if entity_id:
        query = query.where(EntityNotification.entity_id == entity_id)
    if status:
        query = query.where(EntityNotification.status == status)
    if notification_type:
        query = query.where(EntityNotification.notification_type == notification_type)
    
    query = query.order_by(desc(EntityNotification.created_at)).limit(limit)
    result = await db.execute(query)
    notifications = result.scalars().all()
    
    notif_list = []
    for n in notifications:
        entity = await db.get(MilitaryEntity, n.entity_id)
        
        notif_list.append({
            "id": n.id,
            "notification_code": n.notification_code,
            "entity": {
                "id": n.entity_id,
                "name": entity.name if entity else "Unknown"
            },
            "type": n.notification_type,
            "priority": n.priority,
            "title": n.title,
            "message": n.message,
            "details": n.details,
            "convoy_id": n.convoy_id,
            "route_id": n.route_id,
            "status": n.status,
            "created_at": n.created_at.isoformat(),
            "sent_at": n.sent_at.isoformat() if n.sent_at else None,
            "acknowledged_at": n.acknowledged_at.isoformat() if n.acknowledged_at else None
        })
    
    return notif_list


@router.post("/notifications")
async def create_notification(
    request: NotificationRequest,
    db: AsyncSession = Depends(get_db)
):
    """Create a new entity notification"""
    engine = CommandCentreEngine(db)
    
    notification = await engine.create_entity_notification(
        entity_id=request.entity_id,
        notification_type=NotificationType(request.notification_type),
        title=request.title,
        message=request.message,
        priority=LoadPriority(request.priority),
        details=request.details,
        convoy_id=request.convoy_id,
        route_id=request.route_id
    )
    
    return {
        "id": notification.id,
        "notification_code": notification.notification_code,
        "message": "Notification created successfully"
    }


@router.get("/notifications/entity/{entity_id}")
async def get_entity_notifications(
    entity_id: int,
    status: Optional[str] = None,
    limit: int = Query(50, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get notifications for a specific entity"""
    engine = CommandCentreEngine(db)
    return await engine.get_entity_notifications(entity_id, status, limit)


@router.patch("/notifications/{notification_id}/acknowledge")
async def acknowledge_notification(
    notification_id: int,
    acknowledged_by: str = Body(..., embed=True),
    db: AsyncSession = Depends(get_db)
):
    """Acknowledge a notification"""
    engine = CommandCentreEngine(db)
    success = await engine.acknowledge_notification(notification_id, acknowledged_by)
    
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"id": notification_id, "status": "ACKNOWLEDGED", "message": "Notification acknowledged"}


# ============================================================================
# ANALYTICS ENDPOINTS
# ============================================================================

@router.get("/analytics/load-trends")
async def get_load_trends(
    days: int = Query(7, le=30),
    db: AsyncSession = Depends(get_db)
):
    """Get load assignment trends over time"""
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # Daily load stats
    query = select(
        func.date_trunc('day', LoadAssignment.created_at).label('date'),
        func.count(LoadAssignment.id).label('count'),
        func.sum(LoadAssignment.total_weight_tons).label('total_tons')
    ).where(
        LoadAssignment.created_at >= start_date
    ).group_by(
        func.date_trunc('day', LoadAssignment.created_at)
    ).order_by('date')
    
    result = await db.execute(query)
    daily_data = result.all()
    
    # Category distribution
    cat_query = select(
        LoadAssignment.load_category,
        func.count(LoadAssignment.id),
        func.sum(LoadAssignment.total_weight_tons)
    ).where(
        LoadAssignment.created_at >= start_date
    ).group_by(LoadAssignment.load_category)
    
    cat_result = await db.execute(cat_query)
    category_data = {row[0]: {"count": row[1], "tons": float(row[2]) if row[2] else 0} for row in cat_result.all()}
    
    return {
        "period_days": days,
        "daily_trends": [
            {
                "date": row[0].isoformat() if row[0] else None,
                "assignments": row[1],
                "total_tons": float(row[2]) if row[2] else 0
            }
            for row in daily_data
        ],
        "category_distribution": category_data
    }


@router.get("/analytics/efficiency-metrics")
async def get_efficiency_metrics(db: AsyncSession = Depends(get_db)):
    """Get overall efficiency metrics for Command Centre operations"""
    now = datetime.utcnow()
    last_week = now - timedelta(days=7)
    
    # Load delivery efficiency
    delivered = await db.execute(
        select(func.count(LoadAssignment.id)).where(
            and_(
                LoadAssignment.status == "DELIVERED",
                LoadAssignment.actual_delivery >= last_week
            )
        )
    )
    delivered_count = delivered.scalar() or 0
    
    total_loads = await db.execute(
        select(func.count(LoadAssignment.id)).where(
            LoadAssignment.created_at >= last_week
        )
    )
    total_load_count = total_loads.scalar() or 0
    
    # On-time delivery
    on_time = await db.execute(
        select(func.count(LoadAssignment.id)).where(
            and_(
                LoadAssignment.status == "DELIVERED",
                LoadAssignment.actual_delivery >= last_week,
                LoadAssignment.actual_delivery <= LoadAssignment.required_by
            )
        )
    )
    on_time_count = on_time.scalar() or 0
    
    # Vehicle utilization
    vehicles = await db.execute(
        select(func.count(TransportAsset.id), func.sum(TransportAsset.is_available.cast(Integer))).from_statement(
            select(TransportAsset)
        )
    )
    
    # Convoy completion rate
    completed_convoys = await db.execute(
        select(func.count(Convoy.id)).where(
            and_(
                Convoy.status == "COMPLETED",
                Convoy.start_time >= last_week
            )
        )
    )
    completed_count = completed_convoys.scalar() or 0
    
    total_convoys = await db.execute(
        select(func.count(Convoy.id)).where(
            Convoy.start_time >= last_week
        )
    )
    total_convoy_count = total_convoys.scalar() or 0
    
    delivery_rate = (delivered_count / max(1, total_load_count)) * 100
    on_time_rate = (on_time_count / max(1, delivered_count)) * 100 if delivered_count > 0 else 100
    convoy_completion_rate = (completed_count / max(1, total_convoy_count)) * 100 if total_convoy_count > 0 else 100
    
    overall_efficiency = (delivery_rate * 0.35 + on_time_rate * 0.35 + convoy_completion_rate * 0.30)
    
    return {
        "period": "last_7_days",
        "load_metrics": {
            "total_assignments": total_load_count,
            "delivered": delivered_count,
            "delivery_rate_percent": round(delivery_rate, 1),
            "on_time_deliveries": on_time_count,
            "on_time_rate_percent": round(on_time_rate, 1)
        },
        "convoy_metrics": {
            "total_convoys": total_convoy_count,
            "completed": completed_count,
            "completion_rate_percent": round(convoy_completion_rate, 1)
        },
        "overall_efficiency_score": round(overall_efficiency, 1),
        "timestamp": now.isoformat()
    }
