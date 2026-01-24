from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.services.optimization import LoadOptimizer
from app.services.priority_scorer import priority_scorer
from app.services.eta_predictor import eta_predictor
from app.services.decision_engine import decision_engine
from app.services.route_planner import route_planner
from app.models.convoy import Convoy
from app.models.route import Route
from app.models.tcp import TCP

router = APIRouter()
optimizer = LoadOptimizer()


class CargoItem(BaseModel):
    id: str
    weight: float
    volume: float = 0
    name: str = "Unknown Cargo"


class VehicleSpec(BaseModel):
    id: str
    capacity_weight: float
    capacity_volume: float = 0
    name: str = "Generic Truck"


class OptimizationRequest(BaseModel):
    cargo: List[CargoItem]
    fleet: List[VehicleSpec]


class PriorityRequest(BaseModel):
    convoy_id: Optional[int] = None
    # Direct parameters (if convoy_id not provided)
    load_type: str = "GENERAL"
    is_time_critical: bool = False
    deadline_hours: Optional[float] = None
    personnel_count: int = 0
    is_hazardous: bool = False
    terrain_type: str = "PLAINS"
    threat_level: str = "GREEN"
    distance_km: float = 100.0
    weather_impact: float = 1.0
    custom_urgency_boost: float = 0.0


class ETARequest(BaseModel):
    convoy_id: Optional[int] = None
    route_id: Optional[int] = None
    # Direct parameters
    distance_km: float = 100.0
    base_speed_kmh: float = 40.0
    num_vehicles: int = 5
    terrain: str = "PLAINS"
    weather: str = "CLEAR"
    traffic: str = "LOW"
    departure_time: Optional[datetime] = None
    include_tcp_crossings: bool = True


class DecisionRequest(BaseModel):
    convoy_id: int
    route_id: Optional[int] = None


class RouteOptimizationRequest(BaseModel):
    depot: Dict[str, Any]  # {"lat": float, "lon": float, "name": str}
    destinations: List[Dict[str, Any]]
    num_vehicles: int = 1
    speed_kmh: float = 40.0
    max_distance_per_vehicle_km: float = 500.0


@router.post("/optimize")
async def generate_load_plan(request: OptimizationRequest):
    """
    Generate an optimal load plan using Google OR-Tools.
    Minimizes the number of vehicles used.
    """
    cargo_data = [item.model_dump() for item in request.cargo]
    fleet_data = [v.model_dump() for v in request.fleet]
    
    result = optimizer.optimize_load(cargo_data, fleet_data)
    
    if result.get("status") != "OPTIMAL":
        raise HTTPException(status_code=400, detail="Could not optimize load. Ensure fleet capacity is sufficient.")
        
    return result


@router.post("/priority")
async def compute_priority(request: PriorityRequest, db: AsyncSession = Depends(get_db)):
    """
    Compute priority score for a convoy.
    Returns explainable breakdown of scoring factors.
    """
    if request.convoy_id:
        # Fetch convoy from DB
        result = await db.execute(select(Convoy).where(Convoy.id == request.convoy_id))
        convoy = result.scalars().first()
        if not convoy:
            raise HTTPException(status_code=404, detail="Convoy not found")
        
        # Get route if assigned
        route = None
        if convoy.route_id:
            route_result = await db.execute(select(Route).where(Route.id == convoy.route_id))
            route = route_result.scalars().first()
        
        priority_result = priority_scorer.compute_priority(
            load_type=convoy.load_type,
            is_time_critical=convoy.priority_level == "CRITICAL",
            personnel_count=convoy.personnel_count,
            is_hazardous=convoy.is_hazardous,
            terrain_type=convoy.terrain_type,
            threat_level=route.threat_level if route else "GREEN",
            distance_km=convoy.total_distance_km or 100.0,
            weather_impact=route.weather_impact_factor if route else 1.0,
            custom_urgency_boost=request.custom_urgency_boost,
        )
        
        # Update convoy with computed priority
        convoy.priority_score = priority_result["score"]
        convoy.priority_level = priority_result["level"]
        convoy.priority_factors = priority_result["factors"]
        await db.commit()
        
        return {
            "convoy_id": convoy.id,
            "convoy_name": convoy.name,
            **priority_result
        }
    else:
        # Compute from direct parameters
        return priority_scorer.compute_priority(
            load_type=request.load_type,
            is_time_critical=request.is_time_critical,
            deadline_hours=request.deadline_hours,
            personnel_count=request.personnel_count,
            is_hazardous=request.is_hazardous,
            terrain_type=request.terrain_type,
            threat_level=request.threat_level,
            distance_km=request.distance_km,
            weather_impact=request.weather_impact,
            custom_urgency_boost=request.custom_urgency_boost,
        )


@router.post("/eta")
async def predict_eta(request: ETARequest, db: AsyncSession = Depends(get_db)):
    """
    Predict ETA for a convoy movement.
    Includes breakdown of factors affecting travel time.
    """
    convoy = None
    route = None
    tcps = []
    
    if request.convoy_id:
        result = await db.execute(select(Convoy).where(Convoy.id == request.convoy_id))
        convoy = result.scalars().first()
        if not convoy:
            raise HTTPException(status_code=404, detail="Convoy not found")
        
        if convoy.route_id:
            request.route_id = convoy.route_id
    
    if request.route_id:
        route_result = await db.execute(select(Route).where(Route.id == request.route_id))
        route = route_result.scalars().first()
        
        if route and request.include_tcp_crossings:
            tcp_result = await db.execute(
                select(TCP)
                .where(TCP.route_id == request.route_id)
                .where(TCP.status == "ACTIVE")
                .order_by(TCP.route_km_marker)
            )
            tcps = tcp_result.scalars().all()
    
    # Build prediction parameters
    distance = request.distance_km
    speed = request.base_speed_kmh
    terrain = request.terrain
    weather = request.weather
    traffic = request.traffic
    departure = request.departure_time or datetime.utcnow()
    
    if convoy:
        distance = convoy.total_distance_km or distance
        speed = convoy.convoy_speed_kmh or speed
        terrain = convoy.terrain_type or terrain
    
    if route:
        terrain = route.terrain_type or terrain
        weather = route.weather_status or weather
        traffic = route.current_traffic_density or traffic
    
    # Main ETA prediction
    eta_result = eta_predictor.predict_eta(
        distance_km=distance,
        base_speed_kmh=speed,
        num_vehicles=request.num_vehicles,
        terrain=terrain,
        weather=weather,
        traffic=traffic,
        departure_time=departure,
        tcp_count=len(tcps),
    )
    
    # Add TCP crossing predictions if available
    if tcps:
        tcp_dicts = [
            {
                "id": tcp.id,
                "name": tcp.name,
                "route_km_marker": tcp.route_km_marker,
                "avg_clearance_time_min": tcp.avg_clearance_time_min,
            }
            for tcp in tcps
        ]
        eta_result["tcp_crossings"] = eta_predictor.predict_tcp_crossings(
            tcps=tcp_dicts,
            departure_time=departure,
            base_speed_kmh=speed,
            terrain=terrain,
        )
    
    # Update convoy if applicable
    if convoy:
        convoy.predicted_eta_minutes = int(eta_result["prediction"]["eta_minutes"])
        convoy.eta_confidence = eta_result["prediction"]["confidence"]
        convoy.expected_arrival = datetime.fromisoformat(eta_result["prediction"]["predicted_arrival"])
        await db.commit()
        
        eta_result["convoy_id"] = convoy.id
        eta_result["convoy_name"] = convoy.name
    
    return eta_result


@router.post("/decision")
async def evaluate_decision(request: DecisionRequest, db: AsyncSession = Depends(get_db)):
    """
    Evaluate a convoy movement request using the decision engine.
    Returns recommendation with full rule explanation.
    """
    # Fetch convoy
    convoy_result = await db.execute(select(Convoy).where(Convoy.id == request.convoy_id))
    convoy = convoy_result.scalars().first()
    if not convoy:
        raise HTTPException(status_code=404, detail="Convoy not found")
    
    # Fetch route
    route = None
    route_id = request.route_id or convoy.route_id
    if route_id:
        route_result = await db.execute(select(Route).where(Route.id == route_id))
        route = route_result.scalars().first()
    
    # Count active convoys on route
    active_count = 0
    if route_id:
        active_result = await db.execute(
            select(Convoy)
            .where(Convoy.route_id == route_id)
            .where(Convoy.status.in_(["IN_TRANSIT", "STAGING"]))
            .where(Convoy.id != convoy.id)
        )
        active_count = len(active_result.scalars().all())
    
    # Build convoy dict
    convoy_dict = {
        "name": convoy.name,
        "load_type": convoy.load_type,
        "priority_score": convoy.priority_score,
        "priority_level": convoy.priority_level,
        "personnel_count": convoy.personnel_count,
        "is_hazardous": convoy.is_hazardous,
        "start_time": convoy.start_time.isoformat() if convoy.start_time else None,
    }
    
    # Build route dict
    route_dict = None
    if route:
        route_dict = {
            "name": route.name,
            "threat_level": route.threat_level,
            "risk_level": route.risk_level,
            "weather_impact_factor": route.weather_impact_factor,
            "is_night_movement_allowed": route.is_night_movement_allowed,
        }
    
    # Evaluate
    decision = decision_engine.evaluate_convoy_request(
        convoy=convoy_dict,
        route=route_dict,
        active_convoys_on_route=active_count,
    )
    
    return {
        "convoy_id": convoy.id,
        "convoy_name": convoy.name,
        "route_id": route_id,
        "route_name": route.name if route else None,
        **decision
    }


@router.post("/route-optimization")
async def optimize_routes(request: RouteOptimizationRequest):
    """
    Optimize routes for multiple vehicles/convoys using VRP solver.
    """
    result = route_planner.optimize_multi_convoy_routes(
        depot=request.depot,
        delivery_points=request.destinations,
        num_vehicles=request.num_vehicles,
        speed_kmh=request.speed_kmh,
        max_distance_per_vehicle=int(request.max_distance_per_vehicle_km * 1000),
    )
    
    if result["status"] != "OPTIMAL":
        raise HTTPException(status_code=400, detail="Could not optimize routes")
    
    return result


@router.get("/rules")
async def list_decision_rules():
    """
    List all rules in the decision engine.
    Useful for understanding system behavior.
    """
    return {
        "rules": decision_engine.list_all_rules(),
        "total_rules": len(decision_engine.list_all_rules()),
    }


@router.get("/rules/{rule_id}")
async def get_rule_details(rule_id: str):
    """
    Get details of a specific decision rule.
    """
    rule = decision_engine.get_rule_details(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"rule_id": rule_id, **rule}
