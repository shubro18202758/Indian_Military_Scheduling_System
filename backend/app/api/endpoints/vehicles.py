"""
Vehicle Simulation API Endpoints

Provides REST API for:
- Starting/stopping vehicle movement simulation
- Real-time vehicle telemetry
- Convoy movement control
"""

from typing import List, Optional
from datetime import datetime, timedelta
import random

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.asset import TransportAsset
from app.models.convoy import Convoy
from app.models.obstacle import Obstacle
from app.services.vehicle_simulator import vehicle_simulator

router = APIRouter()


@router.post("/simulation/start/{convoy_id}")
async def start_convoy_simulation(
    convoy_id: int,
    speed_multiplier: float = Query(2.0, description="Speed multiplier for demo (2 = 2x faster)"),
    db: AsyncSession = Depends(get_db)
):
    """Start vehicle movement simulation for a convoy."""
    result = await vehicle_simulator.start_convoy_simulation(db, convoy_id, speed_multiplier)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/simulation/stop/{convoy_id}")
async def stop_convoy_simulation(
    convoy_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Stop vehicle movement simulation for a convoy."""
    result = await vehicle_simulator.stop_convoy_simulation(db, convoy_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/simulation/tick")
async def simulation_tick(
    db: AsyncSession = Depends(get_db)
):
    """
    Advance simulation by one tick.
    Call this repeatedly (e.g., every second) to animate vehicles.
    """
    updates = await vehicle_simulator.update_all_vehicles(db)
    return {
        "tick_time": "now",
        "vehicles_updated": len(updates),
        "updates": updates
    }


@router.get("/telemetry")
async def get_all_telemetry():
    """Get real-time telemetry for all active vehicles."""
    return vehicle_simulator.get_all_telemetry()


@router.get("/telemetry/{asset_id}")
async def get_vehicle_telemetry(asset_id: int):
    """Get detailed telemetry for a specific vehicle."""
    telemetry = vehicle_simulator.get_vehicle_telemetry(asset_id)
    if not telemetry:
        raise HTTPException(status_code=404, detail="Vehicle not in active simulation")
    return telemetry


@router.get("/status")
async def get_simulation_status():
    """Get overall simulation status."""
    return {
        "active_convoys": list(vehicle_simulator.active_simulations.keys()),
        "active_vehicles": len(vehicle_simulator.vehicle_states),
        "simulations": {
            convoy_id: {
                "status": sim["status"],
                "started_at": sim["started_at"].isoformat(),
                "speed_multiplier": sim["speed_multiplier"]
            }
            for convoy_id, sim in vehicle_simulator.active_simulations.items()
        }
    }


@router.get("/vehicles")
async def get_simulated_vehicles(
    db: AsyncSession = Depends(get_db)
):
    """Get all vehicles currently in simulation with full details."""
    vehicle_ids = list(vehicle_simulator.vehicle_states.keys())
    
    if not vehicle_ids:
        return []
    
    result = await db.execute(
        select(TransportAsset).where(TransportAsset.id.in_(vehicle_ids))
    )
    assets = result.scalars().all()
    
    vehicles = []
    for asset in assets:
        state = vehicle_simulator.vehicle_states.get(asset.id, {})
        vehicles.append({
            "id": asset.id,
            "name": asset.name,
            "callsign": asset.callsign,
            "asset_type": asset.asset_type,
            "category": asset.category,
            
            # Position
            "lat": asset.current_lat,
            "lng": asset.current_long,
            "bearing": asset.bearing,
            
            # Movement
            "speed_kmh": state.get("current_speed_kmh", 0),
            "status": state.get("status", "UNKNOWN"),
            "formation_position": state.get("formation_position", 0),
            
            # Fuel & Range
            "fuel_percent": asset.fuel_status,
            "fuel_type": asset.fuel_type,
            "range_remaining_km": (asset.fuel_status / 100) * (asset.fuel_capacity_liters or 200) * (asset.fuel_consumption_km_per_liter or 3),
            
            # Capacity
            "capacity_tons": asset.capacity_tons,
            "max_personnel": asset.max_personnel,
            
            # Performance
            "max_speed_kmh": asset.max_speed_kmh,
            
            # Communication
            "has_radio": asset.has_radio,
            "has_gps": asset.has_gps,
            
            # Assignment
            "convoy_id": asset.current_convoy_id,
            "assigned_unit": asset.assigned_unit,
            
            # Maintenance
            "total_km": asset.total_km_traveled,
            "last_maintenance": asset.last_maintenance_date.isoformat() if asset.last_maintenance_date else None,
            
            # Obstacle Response
            "obstacle_response": state.get("obstacle_response")
        })
    
    return vehicles


import random
from datetime import datetime, timedelta
from app.models.obstacle import Obstacle


@router.post("/start-demo")
async def start_full_demo(
    speed_multiplier: float = Query(2.0, description="Speed for demo"),
    db: AsyncSession = Depends(get_db)
):
    """
    Start a full demonstration with all available convoys moving.
    """
    # Get all convoys that are IN_TRANSIT or PLANNED
    result = await db.execute(
        select(Convoy).where(Convoy.status.in_(["IN_TRANSIT", "PLANNED"]))
    )
    convoys = result.scalars().all()
    
    started = []
    for convoy in convoys:
        try:
            result = await vehicle_simulator.start_convoy_simulation(
                db, convoy.id, speed_multiplier
            )
            if "error" not in result:
                started.append(convoy.id)
        except Exception as e:
            print(f"Failed to start convoy {convoy.id}: {e}")
    
    return {
        "status": "demo_started",
        "convoys_started": started,
        "speed_multiplier": speed_multiplier
    }


@router.post("/stop-demo")
async def stop_full_demo(
    db: AsyncSession = Depends(get_db)
):
    """Stop all active simulations."""
    convoy_ids = list(vehicle_simulator.active_simulations.keys())
    
    for convoy_id in convoy_ids:
        await vehicle_simulator.stop_convoy_simulation(db, convoy_id)
    
    return {
        "status": "demo_stopped",
        "convoys_stopped": convoy_ids
    }


@router.post("/reset-demo")
async def reset_demo(
    db: AsyncSession = Depends(get_db)
):
    """Reset demo: stop simulations, clear obstacles, and restart fresh."""
    # Stop all simulations
    convoy_ids = list(vehicle_simulator.active_simulations.keys())
    for convoy_id in convoy_ids:
        await vehicle_simulator.stop_convoy_simulation(db, convoy_id)
    
    # Clear all active obstacles
    result = await db.execute(
        select(Obstacle).where(Obstacle.is_active == True)
    )
    obstacles = result.scalars().all()
    for obs in obstacles:
        obs.is_active = False
    await db.commit()
    
    # Reset vehicle obstacle responses
    vehicle_simulator.vehicle_states.clear()
    vehicle_simulator.active_simulations.clear()
    
    return {
        "status": "demo_reset",
        "convoys_stopped": convoy_ids,
        "obstacles_cleared": len(obstacles)
    }


@router.post("/inject-threat")
async def inject_threat_near_vehicle(
    auto_resolve_seconds: int = Query(8, description="Auto-resolve obstacle after this many seconds (0 to disable)"),
    db: AsyncSession = Depends(get_db)
):
    """
    Inject an obstacle directly in front of a randomly selected active vehicle.
    Automatically generates countermeasure and resolves after delay (simulating AI response).
    """
    from app.services.countermeasure_engine import CountermeasureEngine
    
    # Get all active vehicle states
    vehicle_states = vehicle_simulator.vehicle_states
    if not vehicle_states:
        raise HTTPException(status_code=400, detail="No active vehicles")
    
    # Pick a random moving vehicle (not already halted)
    moving_vehicles = [aid for aid, state in vehicle_states.items() 
                       if state.get("status") not in ["HALTED_OBSTACLE", "ARRIVED"]]
    
    if not moving_vehicles:
        # All vehicles halted, pick any
        moving_vehicles = list(vehicle_states.keys())
    
    asset_id = random.choice(moving_vehicles)
    
    # Get the asset to find its current position
    asset = await db.get(TransportAsset, asset_id)
    if not asset or not asset.current_lat:
        raise HTTPException(status_code=400, detail="Vehicle position unknown")
    
    # Generate obstacle types for military scenarios  
    obstacle_types = [
        ("IED_SUSPECTED", "CRITICAL", True, "IED signature detected by reconnaissance drone. Route blocked."),
        ("AMBUSH_RISK", "HIGH", True, "Intelligence indicates hostile activity. Convoy halted for tactical assessment."),
        ("LANDSLIDE", "HIGH", True, "Road blocked by landslide. Engineering support requested."),
        ("BRIDGE_DAMAGE", "HIGH", True, "Bridge structural damage reported. Weight restriction in effect."),
        ("HOSTILE_FIRE", "CRITICAL", True, "Taking fire from hostile position. Immediate halt ordered."),
    ]
    
    obs_type, severity, blocks, description = random.choice(obstacle_types)
    
    # Create obstacle slightly ahead of vehicle (0.2-0.5 km ahead in bearing direction)
    import math
    bearing_rad = math.radians(asset.bearing or 0)
    offset_km = random.uniform(0.2, 0.5)
    
    # Move forward in bearing direction
    new_lat = asset.current_lat + (offset_km / 111.0) * math.cos(bearing_rad)
    new_lng = asset.current_long + (offset_km / (111.0 * math.cos(math.radians(asset.current_lat)))) * math.sin(bearing_rad)
    
    # Create the obstacle
    obstacle = Obstacle(
        obstacle_type=obs_type,
        severity=severity,
        latitude=new_lat,
        longitude=new_lng,
        radius_km=0.8,  # 800m radius to ensure vehicle enters it
        blocks_route=blocks,
        speed_reduction_factor=0.0 if blocks else 0.3,
        title=f"Threat detected near {asset.name}",
        description=description,
        estimated_duration_hours=random.uniform(0.5, 2.0),
        impact_score=90.0 if blocks else 50.0,
        is_active=True,
        detected_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(hours=1),
        generated_by="JANUS_AI"
    )
    
    db.add(obstacle)
    await db.flush()  # Get obstacle ID before countermeasure
    
    # Generate countermeasure using AI engine
    engine = CountermeasureEngine(db)
    countermeasure = await engine.generate_countermeasure(obstacle)
    
    await db.commit()
    await db.refresh(obstacle)
    
    # Schedule auto-resolution if enabled
    if auto_resolve_seconds > 0 and countermeasure:
        import asyncio
        asyncio.create_task(_auto_resolve_obstacle(obstacle.id, countermeasure.id, auto_resolve_seconds))
    
    return {
        "status": "threat_injected",
        "obstacle_id": obstacle.id,
        "obstacle_type": obs_type,
        "severity": severity,
        "blocks_route": blocks,
        "target_vehicle": asset.name,
        "vehicle_position": {"lat": asset.current_lat, "lng": asset.current_long},
        "obstacle_position": {"lat": new_lat, "lng": new_lng},
        "countermeasure_id": countermeasure.id if countermeasure else None,
        "auto_resolve_in_seconds": auto_resolve_seconds if auto_resolve_seconds > 0 else None
    }


async def _auto_resolve_obstacle(obstacle_id: int, countermeasure_id: int, delay_seconds: int):
    """Background task to auto-resolve obstacle after delay (simulates AI execution)."""
    import asyncio
    from app.core.database import SessionLocal
    
    print(f"[AUTO-RESOLVE] Scheduling resolution of obstacle {obstacle_id} in {delay_seconds}s")
    await asyncio.sleep(delay_seconds)
    print(f"[AUTO-RESOLVE] Executing resolution of obstacle {obstacle_id}")
    
    async with SessionLocal() as db:
        try:
            # Update countermeasure to EXECUTED
            from app.models.obstacle import Countermeasure
            cm = await db.get(Countermeasure, countermeasure_id)
            if cm and cm.status in ["PROPOSED", "PENDING"]:
                cm.status = "EXECUTED"
                cm.executed_at = datetime.utcnow()
                print(f"[AUTO-RESOLVE] Countermeasure {countermeasure_id} marked as EXECUTED")
            
            # Resolve the obstacle
            obs = await db.get(Obstacle, obstacle_id)
            if obs and obs.is_active:
                obs.is_active = False
                obs.is_countered = True
                obs.countered_at = datetime.utcnow()
                print(f"[AUTO-RESOLVE] Obstacle {obstacle_id} resolved")
            
            await db.commit()
        except Exception as e:
            print(f"[AUTO-RESOLVE] Error: {e}")

