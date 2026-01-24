"""
Advanced Transport Management API
===================================

Comprehensive API endpoints for:
- Multi-route management
- Real-time vehicle metrics
- AI-powered recommendations
- Dynamic scenario generation
- Advanced convoy operations
- GPU acceleration status
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
import random

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.asset import TransportAsset
from app.models.convoy import Convoy
from app.models.route import Route
from app.models.obstacle import Obstacle

from app.services.advanced_pathfinding import pathfinding_engine, RouteCandidate
from app.services.realtime_metrics import metrics_engine, VehicleType
from app.services.janus_ai_service import janus_ai
from app.services.multi_route_generator import route_generator, RouteCategory
from app.services.scenario_generator import scenario_generator, ScenarioType
from app.services.vehicle_simulator import vehicle_simulator

# GPU status
try:
    from app.core.gpu_config import get_gpu_accelerator
    GPU_MODULE_AVAILABLE = True
except ImportError:
    GPU_MODULE_AVAILABLE = False

router = APIRouter()


# ============================================================================
# GPU STATUS ENDPOINT
# ============================================================================

@router.get("/gpu/status")
async def get_gpu_status():
    """Get GPU acceleration status for all services."""
    status = {
        "gpu_module_available": GPU_MODULE_AVAILABLE,
        "ollama_gpu": False,
        "pathfinding_gpu": False,
        "ai_service_gpu": False,
        "gpu_details": None
    }
    
    if GPU_MODULE_AVAILABLE:
        try:
            gpu = get_gpu_accelerator()
            status["gpu_details"] = gpu.get_status()
            status["pathfinding_gpu"] = pathfinding_engine.use_gpu if hasattr(pathfinding_engine, 'use_gpu') else False
            status["ai_service_gpu"] = janus_ai.gpu_accelerator is not None if hasattr(janus_ai, 'gpu_accelerator') else False
        except Exception as e:
            status["error"] = str(e)
    
    # Check Ollama GPU usage
    try:
        import httpx
        import asyncio
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get("http://host.docker.internal:11434/api/tags")
            if resp.status_code == 200:
                status["ollama_gpu"] = True  # Ollama uses GPU by default if available
    except:
        pass
    
    return status


# ============================================================================
# MULTI-ROUTE ENDPOINTS
# ============================================================================

@router.get("/routes/generate")
async def generate_all_routes():
    """Generate all predefined strategic routes."""
    routes = route_generator.generate_all_routes()
    return {
        "status": "success",
        "routes_generated": len(routes),
        "routes": [route_generator.to_dict(r) for r in routes]
    }


@router.get("/routes/scenario/{scenario_type}")
async def generate_scenario_routes(scenario_type: str):
    """Generate routes for a specific scenario type."""
    valid_scenarios = ["LADAKH_SUPPLY", "KASHMIR_OPS", "DESERT_EXERCISE", "EMERGENCY_RESPONSE"]
    
    if scenario_type not in valid_scenarios:
        raise HTTPException(status_code=400, detail=f"Invalid scenario. Valid: {valid_scenarios}")
    
    routes = route_generator.generate_scenario_routes(scenario_type)
    return {
        "scenario": scenario_type,
        "routes": [route_generator.to_dict(r) for r in routes]
    }


@router.get("/routes/list")
async def list_all_routes():
    """List all generated routes."""
    routes = list(route_generator.generated_routes.values())
    return {
        "total": len(routes),
        "routes": [route_generator.to_dict(r) for r in routes]
    }


@router.get("/routes/{route_id}")
async def get_route_details(route_id: str):
    """Get detailed information about a specific route."""
    route = route_generator.get_route_by_id(route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    return route_generator.to_dict(route)


@router.get("/routes/category/{category}")
async def get_routes_by_category(category: str):
    """Get all routes of a specific category."""
    try:
        cat = RouteCategory[category.upper()]
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Invalid category. Valid: {[c.value for c in RouteCategory]}")
    
    routes = route_generator.get_routes_by_category(cat)
    return {
        "category": category,
        "count": len(routes),
        "routes": [route_generator.to_dict(r) for r in routes]
    }


@router.post("/routes/optimize")
async def optimize_route(
    start_lat: float = Body(...),
    start_lng: float = Body(...),
    end_lat: float = Body(...),
    end_lng: float = Body(...),
    prioritize_safety: bool = Body(False),
    num_alternatives: int = Body(3)
):
    """
    Find optimal routes between two points using advanced algorithms.
    Returns multiple alternatives with different optimization criteria.
    """
    # Build graph from generated routes or create ad-hoc
    # For now, create a simple path
    waypoints = []
    num_points = 50
    
    for i in range(num_points + 1):
        progress = i / num_points
        lat = start_lat + (end_lat - start_lat) * progress
        lng = start_lng + (end_lng - start_lng) * progress
        waypoints.append((lat, lng))
    
    pathfinding_engine.build_route_graph(waypoints, "ADHOC")
    
    start_node = "ADHOC_0"
    end_node = f"ADHOC_{num_points}"
    
    routes = pathfinding_engine.find_alternative_routes(
        start_node, 
        end_node, 
        num_routes=num_alternatives
    )
    
    return {
        "start": {"lat": start_lat, "lng": start_lng},
        "end": {"lat": end_lat, "lng": end_lng},
        "alternatives": [
            {
                "algorithm": r.algorithm_used,
                "distance_km": r.total_distance_km,
                "time_hours": r.estimated_time_hours,
                "fuel_liters": r.fuel_consumption_liters,
                "risk_score": r.risk_score,
                "confidence": r.confidence_score,
                "waypoints": r.waypoints[:20] + r.waypoints[-20:] if len(r.waypoints) > 40 else r.waypoints  # Limit for response size
            }
            for r in routes
        ]
    }


# ============================================================================
# REAL-TIME METRICS ENDPOINTS
# ============================================================================

@router.post("/metrics/initialize/{vehicle_id}")
async def initialize_vehicle_metrics(
    vehicle_id: int,
    vehicle_type: str = Query("TRUCK_CARGO"),
    fuel_percent: float = Query(100.0),
    load_kg: float = Query(0),
    db: AsyncSession = Depends(get_db)
):
    """Initialize real-time metrics tracking for a vehicle."""
    try:
        vtype = VehicleType[vehicle_type]
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Invalid vehicle type. Valid: {[v.value for v in VehicleType]}")
    
    state = metrics_engine.initialize_vehicle(
        vehicle_id=vehicle_id,
        vehicle_type=vtype,
        initial_fuel_percent=fuel_percent,
        load_weight_kg=load_kg
    )
    
    return {
        "status": "initialized",
        "vehicle_id": vehicle_id,
        "vehicle_type": vehicle_type
    }


@router.post("/metrics/update/{vehicle_id}")
async def update_vehicle_metrics(
    vehicle_id: int,
    speed_kmh: float = Body(...),
    lat: float = Body(...),
    lng: float = Body(...),
    altitude_m: float = Body(0),
    terrain: str = Body("PLAINS"),
    weather: str = Body("CLEAR"),
    gradient_percent: float = Body(0),
    delta_seconds: float = Body(1.0)
):
    """Update real-time metrics for a vehicle based on current conditions."""
    telemetry = metrics_engine.update_metrics(
        vehicle_id=vehicle_id,
        current_speed_kmh=speed_kmh,
        lat=lat,
        lng=lng,
        altitude_m=altitude_m,
        terrain=terrain,
        weather=weather,
        gradient_percent=gradient_percent,
        delta_seconds=delta_seconds
    )
    
    if not telemetry:
        raise HTTPException(status_code=404, detail="Vehicle not initialized")
    
    return telemetry


@router.get("/metrics/{vehicle_id}")
async def get_vehicle_metrics(vehicle_id: int):
    """Get full telemetry data for a vehicle."""
    telemetry = metrics_engine.get_full_telemetry(vehicle_id)
    
    if not telemetry:
        raise HTTPException(status_code=404, detail="Vehicle not found or not initialized")
    
    return telemetry


@router.get("/metrics/all")
async def get_all_vehicle_metrics():
    """Get metrics for all tracked vehicles."""
    all_metrics = []
    
    for vehicle_id in metrics_engine.vehicle_states.keys():
        telemetry = metrics_engine.get_full_telemetry(vehicle_id)
        if telemetry:
            all_metrics.append(telemetry)
    
    return {
        "count": len(all_metrics),
        "vehicles": all_metrics
    }


# ============================================================================
# AI RECOMMENDATION ENDPOINTS
# ============================================================================

@router.post("/ai/obstacle-recommendation")
async def get_ai_obstacle_recommendation(
    obstacle: Dict[str, Any] = Body(...),
    convoy: Dict[str, Any] = Body({}),
    route: Dict[str, Any] = Body({}),
    conditions: Dict[str, Any] = Body({})
):
    """
    Get AI-powered recommendation for handling an obstacle.
    Uses Janus model if available, falls back to heuristics.
    """
    recommendation = await janus_ai.get_obstacle_recommendation(
        obstacle=obstacle,
        convoy=convoy,
        route=route,
        current_conditions=conditions
    )
    
    return janus_ai.to_dict(recommendation)


@router.post("/ai/route-recommendation")
async def get_ai_route_recommendation(
    obstacle_lat: float = Body(...),
    obstacle_lng: float = Body(...),
    current_route_id: str = Body(...),
    convoy_specs: Dict[str, Any] = Body({})
):
    """Get AI recommendation for route selection when obstacle encountered."""
    # Get current route
    current_route = route_generator.get_route_by_id(current_route_id)
    
    if not current_route:
        raise HTTPException(status_code=404, detail="Current route not found")
    
    # Get alternative routes
    available_routes = [
        route_generator.to_dict(r) 
        for r in route_generator.generated_routes.values()
        if r.route_id != current_route_id
    ]
    
    recommendation = await janus_ai.get_route_recommendation(
        current_route=route_generator.to_dict(current_route),
        obstacle_location=(obstacle_lat, obstacle_lng),
        available_routes=available_routes[:5],  # Top 5 alternatives
        convoy_specs=convoy_specs
    )
    
    return recommendation


@router.post("/ai/threat-prediction")
async def predict_threats(
    route_id: str = Body(...),
    conditions: Dict[str, Any] = Body({})
):
    """Predict potential threats along a route."""
    route = route_generator.get_route_by_id(route_id)
    
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    # Get historical obstacle data
    historical_data = [
        {
            "obstacle_type": "LANDSLIDE",
            "location": route.waypoints[len(route.waypoints)//2] if route.waypoints else (0, 0)
        }
    ] * random.randint(1, 5)  # Simulated historical data
    
    predictions = await janus_ai.predict_threats(
        route=route_generator.to_dict(route),
        historical_data=historical_data,
        conditions=conditions
    )
    
    return {
        "route_id": route_id,
        "predictions": predictions
    }


@router.get("/ai/status")
async def get_ai_status():
    """Check JANUS PRO 7B AI service status."""
    is_available = await janus_ai.check_ai_availability()
    
    return {
        "ai_available": is_available,
        "ai_engine": "JANUS_PRO_7B",
        "provider": janus_ai.provider.value,
        "model": janus_ai.model_name,
        "gpu_accelerated": True,
        "gpu_config": {
            "gpu_layers": janus_ai.gpu_layers,
            "batch_size": janus_ai.batch_size,
            "context_length": janus_ai.context_length,
            "vram_fraction": janus_ai.gpu_memory_fraction
        },
        "fallback_enabled": janus_ai.use_fallback,
        "core_system": True
    }


# ============================================================================
# SCENARIO ENDPOINTS
# ============================================================================

@router.post("/scenario/generate")
async def generate_scenario_event(
    lat: float = Body(...),
    lng: float = Body(...),
    terrain: str = Body("PLAINS"),
    weather: str = Body("CLEAR"),
    time_of_day: str = Body("DAY"),
    route_ids: List[str] = Body([]),
    force_type: Optional[str] = Body(None)
):
    """Generate a dynamic scenario event based on conditions."""
    scenario_type = None
    if force_type:
        try:
            scenario_type = ScenarioType[force_type.upper()]
        except KeyError:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid scenario type. Valid: {[s.value for s in ScenarioType]}"
            )
    
    event = scenario_generator.generate_event(
        location=(lat, lng),
        terrain=terrain,
        weather=weather,
        time_of_day=time_of_day,
        route_ids=route_ids,
        force_type=scenario_type
    )
    
    if not event:
        return {"status": "no_event", "message": "No event generated based on probability"}
    
    return scenario_generator.to_dict(event)


@router.post("/scenario/burst")
async def generate_scenario_burst(
    lat: float = Body(...),
    lng: float = Body(...),
    terrain: str = Body("PLAINS"),
    intensity: str = Body("MODERATE")
):
    """Generate a burst of scenario events for stress testing."""
    events = scenario_generator.generate_scenario_burst(
        location=(lat, lng),
        terrain=terrain,
        intensity=intensity
    )
    
    return {
        "intensity": intensity,
        "events_generated": len(events),
        "events": [scenario_generator.to_dict(e) for e in events]
    }


@router.get("/scenario/active")
async def get_active_scenarios():
    """Get all active scenario events."""
    events = list(scenario_generator.active_events.values())
    return {
        "count": len(events),
        "events": [scenario_generator.to_dict(e) for e in events]
    }


@router.post("/scenario/resolve/{event_id}")
async def resolve_scenario_event(
    event_id: str,
    resolution: str = Body("CLEARED")
):
    """Resolve an active scenario event."""
    success = scenario_generator.resolve_event(event_id, resolution)
    
    if not success:
        raise HTTPException(status_code=404, detail="Event not found")
    
    return {"status": "resolved", "event_id": event_id}


@router.post("/scenario/update")
async def update_scenarios():
    """Update all active scenarios (check for expiry, escalation)."""
    changed = scenario_generator.update_events(datetime.utcnow())
    
    return {
        "events_changed": len(changed),
        "changes": [scenario_generator.to_dict(e) for e in changed]
    }


# ============================================================================
# ENHANCED SIMULATION ENDPOINTS
# ============================================================================

@router.post("/simulation/start-advanced")
async def start_advanced_simulation(
    scenario: str = Body("LADAKH_SUPPLY"),
    num_convoys: int = Body(3),
    speed_multiplier: float = Body(2.0),
    generate_threats: bool = Body(True),
    db: AsyncSession = Depends(get_db)
):
    """
    Start an advanced simulation with multiple routes and dynamic scenarios.
    """
    # Generate scenario routes
    routes = route_generator.generate_scenario_routes(scenario)
    
    if not routes:
        raise HTTPException(status_code=400, detail="Failed to generate routes for scenario")
    
    # Initialize convoys on routes
    started_convoys = []
    
    for i, route_def in enumerate(routes[:num_convoys]):
        # Create or get convoy
        convoy_id = i + 1
        
        try:
            # Start simulation on this route
            result = await vehicle_simulator.start_convoy_simulation(
                db, convoy_id, speed_multiplier
            )
            
            if "error" not in result:
                started_convoys.append({
                    "convoy_id": convoy_id,
                    "route": route_def.name,
                    "vehicles": result.get("vehicles", 0)
                })
                
                # Initialize metrics for vehicles
                for v_id in vehicle_simulator.vehicle_states.keys():
                    metrics_engine.initialize_vehicle(
                        vehicle_id=v_id,
                        vehicle_type=VehicleType.TRUCK_CARGO,
                        initial_fuel_percent=random.uniform(70, 100),
                        load_weight_kg=random.uniform(1000, 8000)
                    )
        except Exception as e:
            print(f"Failed to start convoy {convoy_id}: {e}")
    
    # Generate initial threats if requested
    initial_events = []
    if generate_threats:
        for route in routes[:num_convoys]:
            if route.waypoints:
                mid_point = route.waypoints[len(route.waypoints) // 2]
                event = scenario_generator.generate_event(
                    location=mid_point,
                    terrain=route.terrain_zones[0] if route.terrain_zones else "PLAINS",
                    weather="CLEAR",
                    time_of_day="DAY",
                    route_ids=[route.route_id]
                )
                if event:
                    initial_events.append(scenario_generator.to_dict(event))
    
    return {
        "status": "simulation_started",
        "scenario": scenario,
        "routes": [route_generator.to_dict(r) for r in routes[:num_convoys]],
        "convoys": started_convoys,
        "initial_events": initial_events,
        "speed_multiplier": speed_multiplier
    }


@router.post("/simulation/tick-advanced")
async def advanced_simulation_tick(
    db: AsyncSession = Depends(get_db)
):
    """
    Advanced simulation tick that updates:
    - Vehicle positions
    - Real-time metrics
    - Scenario events
    - AI recommendations for active threats
    """
    # Update vehicle positions
    vehicle_updates = await vehicle_simulator.update_all_vehicles(db)
    
    # Update metrics for each vehicle
    metrics_updates = []
    for update in vehicle_updates:
        if update.get("asset_id"):
            # Get vehicle state
            state = vehicle_simulator.vehicle_states.get(update["asset_id"])
            if state:
                telemetry = metrics_engine.update_metrics(
                    vehicle_id=update["asset_id"],
                    current_speed_kmh=update.get("speed_kmh", 0),
                    lat=update.get("lat", 0),
                    lng=update.get("lng", 0),
                    altitude_m=update.get("altitude", 0),
                    terrain=update.get("terrain", "PLAINS"),
                    weather=update.get("weather", "CLEAR"),
                    gradient_percent=update.get("gradient", 0),
                    delta_seconds=1.0
                )
                if telemetry:
                    metrics_updates.append(telemetry)
    
    # Update scenarios
    scenario_changes = scenario_generator.update_events(datetime.utcnow())
    
    # Check for threats and generate AI recommendations
    ai_recommendations = []
    for event in scenario_generator.active_events.values():
        if event.severity.value in ["CRITICAL", "EMERGENCY"]:
            # Get recommendation for critical events
            rec = await janus_ai.get_obstacle_recommendation(
                obstacle={
                    "obstacle_type": event.event_subtype,
                    "severity": event.severity.value,
                    "latitude": event.location[0],
                    "longitude": event.location[1],
                    "description": event.description
                },
                convoy={},
                route={},
                current_conditions={"weather": "CLEAR", "visibility_km": 10}
            )
            ai_recommendations.append(janus_ai.to_dict(rec))
    
    return {
        "tick_time": datetime.utcnow().isoformat(),
        "vehicles_updated": len(vehicle_updates),
        "vehicle_updates": vehicle_updates,
        "metrics": metrics_updates[:5],  # Limit for response size
        "scenario_changes": [scenario_generator.to_dict(e) for e in scenario_changes],
        "active_events": len(scenario_generator.active_events),
        "ai_recommendations": ai_recommendations[:3]  # Limit
    }


@router.get("/simulation/status-advanced")
async def get_advanced_simulation_status():
    """Get comprehensive status of the advanced simulation."""
    return {
        "active_convoys": len(vehicle_simulator.active_simulations),
        "active_vehicles": len(vehicle_simulator.vehicle_states),
        "tracked_metrics": len(metrics_engine.vehicle_states),
        "generated_routes": len(route_generator.generated_routes),
        "active_scenarios": len(scenario_generator.active_events),
        "ai_status": {
            "available": janus_ai.ai_available,
            "provider": janus_ai.provider.value
        },
        "convoys": {
            convoy_id: {
                "status": sim["status"],
                "vehicles": sum(1 for v in vehicle_simulator.vehicle_states.values() if v.get("convoy_id") == convoy_id)
            }
            for convoy_id, sim in vehicle_simulator.active_simulations.items()
        }
    }
