"""
Obstacle and Simulation API Endpoints

Provides REST API for:
- Viewing active obstacles
- Triggering obstacle generation
- Viewing countermeasures
- Running/controlling simulations
- Live event streaming (SSE)
"""

import asyncio
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from app.core.database import get_db
from app.models.obstacle import Obstacle, Countermeasure, SimulationEvent
from app.models.route import Route
from app.schemas.obstacle import (
    Obstacle as ObstacleSchema,
    ObstacleCreate,
    Countermeasure as CountermeasureSchema,
    SimulationEvent as SimulationEventSchema,
    LiveUpdate,
    SimulationStatus
)
from app.services.obstacle_generator import ObstacleGenerator
from app.services.countermeasure_engine import CountermeasureEngine
from app.services.simulation_orchestrator import (
    SimulationOrchestrator, 
    SimulationIntensity,
    SCENARIOS
)

router = APIRouter()

# Global simulation instance (for single-server scenarios)
_active_simulation: Optional[SimulationOrchestrator] = None


@router.get("/obstacles", response_model=List[ObstacleSchema])
async def get_obstacles(
    active_only: bool = Query(True, description="Return only active obstacles"),
    limit: int = Query(50, description="Maximum number of obstacles to return"),
    db: AsyncSession = Depends(get_db)
):
    """Get all obstacles with optional filtering"""
    query = select(Obstacle).order_by(desc(Obstacle.created_at)).limit(limit)
    
    if active_only:
        query = query.where(Obstacle.is_active == True)
    
    result = await db.execute(query)
    obstacles = result.scalars().all()
    
    return obstacles


@router.get("/obstacles/{obstacle_id}", response_model=ObstacleSchema)
async def get_obstacle(obstacle_id: int, db: AsyncSession = Depends(get_db)):
    """Get specific obstacle details"""
    result = await db.execute(select(Obstacle).where(Obstacle.id == obstacle_id))
    obstacle = result.scalar_one_or_none()
    
    if not obstacle:
        raise HTTPException(status_code=404, detail="Obstacle not found")
    
    return obstacle


@router.post("/obstacles/generate", response_model=ObstacleSchema)
async def generate_obstacle(
    route_id: Optional[int] = None,
    auto_respond: bool = Query(True, description="Automatically generate countermeasure"),
    db: AsyncSession = Depends(get_db)
):
    """Manually generate an obstacle (for testing/demo)"""
    
    generator = ObstacleGenerator(db)
    obstacle = await generator.generate_obstacle(route_id=route_id)
    
    # Flush to get the obstacle ID before creating countermeasure
    await db.flush()
    
    if auto_respond:
        engine = CountermeasureEngine(db)
        await engine.generate_countermeasure(obstacle)
    
    await db.commit()
    
    return obstacle


@router.delete("/obstacles/{obstacle_id}")
async def resolve_obstacle(obstacle_id: int, db: AsyncSession = Depends(get_db)):
    """Mark an obstacle as resolved/inactive"""
    result = await db.execute(select(Obstacle).where(Obstacle.id == obstacle_id))
    obstacle = result.scalar_one_or_none()
    
    if not obstacle:
        raise HTTPException(status_code=404, detail="Obstacle not found")
    
    obstacle.is_active = False
    obstacle.resolved_at = datetime.utcnow()
    
    await db.commit()
    
    return {"status": "resolved", "obstacle_id": obstacle_id}


@router.get("/countermeasures", response_model=List[CountermeasureSchema])
async def get_countermeasures(
    status: Optional[str] = None,
    limit: int = Query(50),
    db: AsyncSession = Depends(get_db)
):
    """Get countermeasures with optional status filter"""
    query = select(Countermeasure).order_by(desc(Countermeasure.created_at)).limit(limit)
    
    if status:
        query = query.where(Countermeasure.status == status)
    
    result = await db.execute(query)
    countermeasures = result.scalars().all()
    
    return countermeasures


@router.get("/countermeasures/{countermeasure_id}", response_model=CountermeasureSchema)
async def get_countermeasure(countermeasure_id: int, db: AsyncSession = Depends(get_db)):
    """Get specific countermeasure details"""
    result = await db.execute(
        select(Countermeasure).where(Countermeasure.id == countermeasure_id)
    )
    countermeasure = result.scalar_one_or_none()
    
    if not countermeasure:
        raise HTTPException(status_code=404, detail="Countermeasure not found")
    
    return countermeasure


@router.post("/countermeasures/{countermeasure_id}/execute")
async def execute_countermeasure(countermeasure_id: int, db: AsyncSession = Depends(get_db)):
    """Manually execute a proposed countermeasure"""
    result = await db.execute(
        select(Countermeasure).where(Countermeasure.id == countermeasure_id)
    )
    countermeasure = result.scalar_one_or_none()
    
    if not countermeasure:
        raise HTTPException(status_code=404, detail="Countermeasure not found")
    
    if countermeasure.status not in ["PROPOSED", "PENDING"]:
        raise HTTPException(status_code=400, detail=f"Cannot execute countermeasure in {countermeasure.status} status")
    
    engine = CountermeasureEngine(db)
    success = await engine.execute_countermeasure(countermeasure)
    
    return {"success": success, "countermeasure_id": countermeasure_id, "status": countermeasure.status}


# ============ SIMULATION ENDPOINTS ============

@router.get("/simulation/scenarios")
async def get_scenarios():
    """Get list of available simulation scenarios"""
    return {
        scenario_id: {
            "name": scenario["name"],
            "description": scenario["description"],
            "duration_minutes": scenario["duration_minutes"],
            "intensity": scenario["intensity"].value,
            "target_obstacles": scenario["target_obstacles"]
        }
        for scenario_id, scenario in SCENARIOS.items()
    }


@router.get("/simulation/intensities")
async def get_intensities():
    """Get available simulation intensity levels"""
    return [
        {"id": "peaceful", "name": "Peaceful", "description": "Minimal obstacles, system monitoring"},
        {"id": "moderate", "name": "Moderate", "description": "Occasional obstacles, normal operations"},
        {"id": "intense", "name": "Intense", "description": "Frequent obstacles, high alert mode"},
        {"id": "stress_test", "name": "Stress Test", "description": "Maximum load, resilience testing"},
        {"id": "chaos", "name": "Chaos Mode", "description": "Extreme scenario, edge case testing"}
    ]


@router.post("/simulation/start")
async def start_simulation(
    scenario: Optional[str] = None,
    intensity: str = Query("moderate"),
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db)
):
    """Start a simulation (scenario or continuous)"""
    global _active_simulation
    
    if _active_simulation and _active_simulation.running:
        raise HTTPException(status_code=400, detail="Simulation already running")
    
    _active_simulation = SimulationOrchestrator(db)
    
    if scenario:
        if scenario not in SCENARIOS:
            raise HTTPException(status_code=400, detail=f"Unknown scenario: {scenario}")
        
        # Run scenario in background
        background_tasks.add_task(_run_scenario, scenario, db)
        
        return {
            "status": "started",
            "mode": "scenario",
            "scenario": scenario,
            "session_id": _active_simulation.session_id
        }
    else:
        # Start continuous simulation
        try:
            intensity_enum = SimulationIntensity(intensity)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid intensity: {intensity}")
        
        background_tasks.add_task(_run_continuous, intensity_enum, db)
        
        return {
            "status": "started",
            "mode": "continuous",
            "intensity": intensity,
            "session_id": _active_simulation.session_id
        }


async def _run_scenario(scenario_name: str, db: AsyncSession):
    """Background task for running scenario"""
    global _active_simulation
    if _active_simulation:
        await _active_simulation.run_scenario(scenario_name)


async def _run_continuous(intensity: SimulationIntensity, db: AsyncSession):
    """Background task for continuous simulation"""
    global _active_simulation
    if _active_simulation:
        await _active_simulation.run_continuous(intensity)


@router.post("/simulation/stop")
async def stop_simulation():
    """Stop the current simulation"""
    global _active_simulation
    
    if not _active_simulation or not _active_simulation.running:
        raise HTTPException(status_code=400, detail="No simulation running")
    
    _active_simulation.stop()
    
    return {"status": "stopped", "session_id": _active_simulation.session_id}


@router.post("/simulation/pause")
async def pause_simulation():
    """Pause the current simulation"""
    global _active_simulation
    
    if not _active_simulation or not _active_simulation.running:
        raise HTTPException(status_code=400, detail="No simulation running")
    
    _active_simulation.pause()
    
    return {"status": "paused", "session_id": _active_simulation.session_id}


@router.post("/simulation/resume")
async def resume_simulation():
    """Resume a paused simulation"""
    global _active_simulation
    
    if not _active_simulation:
        raise HTTPException(status_code=400, detail="No simulation to resume")
    
    _active_simulation.resume()
    
    return {"status": "resumed", "session_id": _active_simulation.session_id}


@router.get("/simulation/status")
async def get_simulation_status():
    """Get current simulation status and metrics"""
    global _active_simulation
    
    if not _active_simulation:
        return {
            "running": False,
            "session_id": None,
            "metrics": None
        }
    
    return _active_simulation.get_status()


# ============ LIVE EVENTS (SSE) ============

@router.get("/events/stream")
async def stream_events(db: AsyncSession = Depends(get_db)):
    """Server-Sent Events stream for real-time updates"""
    
    async def event_generator():
        global _active_simulation
        
        # Send initial connection message
        yield f"data: {{'type': 'connected', 'message': 'Event stream connected'}}\n\n"
        
        last_event_id = 0
        
        while True:
            # Query for new events
            result = await db.execute(
                select(SimulationEvent)
                .where(SimulationEvent.id > last_event_id)
                .order_by(SimulationEvent.id)
                .limit(10)
            )
            events = result.scalars().all()
            
            for event in events:
                event_data = {
                    "type": event.event_type,
                    "timestamp": event.timestamp.isoformat(),
                    "session_id": event.session_id,
                    "payload": event.payload,
                    "severity": event.severity
                }
                yield f"data: {event_data}\n\n"
                last_event_id = event.id
            
            # Also send current metrics if simulation is running
            if _active_simulation and _active_simulation.running:
                status = _active_simulation.get_status()
                yield f"data: {{'type': 'metrics_update', 'data': {status}}}\n\n"
            
            await asyncio.sleep(1)  # Poll every second
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/events/history", response_model=List[SimulationEventSchema])
async def get_event_history(
    session_id: Optional[str] = None,
    event_type: Optional[str] = None,
    limit: int = Query(100),
    db: AsyncSession = Depends(get_db)
):
    """Get historical simulation events"""
    query = select(SimulationEvent).order_by(desc(SimulationEvent.timestamp)).limit(limit)
    
    if session_id:
        query = query.where(SimulationEvent.session_id == session_id)
    
    if event_type:
        query = query.where(SimulationEvent.event_type == event_type)
    
    result = await db.execute(query)
    events = result.scalars().all()
    
    return events


# ============ DASHBOARD SUMMARY ============

@router.get("/dashboard/summary")
async def get_dashboard_summary(db: AsyncSession = Depends(get_db)):
    """Get summary data for AI management dashboard"""
    
    # Active obstacles count by severity
    obstacle_result = await db.execute(
        select(Obstacle.severity, func.count(Obstacle.id))
        .where(Obstacle.is_active == True)
        .group_by(Obstacle.severity)
    )
    obstacles_by_severity = dict(obstacle_result.all())
    
    # Recent countermeasures
    cm_result = await db.execute(
        select(Countermeasure)
        .order_by(desc(Countermeasure.created_at))
        .limit(5)
    )
    recent_countermeasures = cm_result.scalars().all()
    
    # Success rate
    total_cm = await db.execute(select(func.count(Countermeasure.id)))
    successful_cm = await db.execute(
        select(func.count(Countermeasure.id))
        .where(Countermeasure.success == True)
    )
    
    total = total_cm.scalar() or 0
    successful = successful_cm.scalar() or 0
    success_rate = (successful / max(1, total)) * 100
    
    return {
        "active_obstacles": {
            "total": sum(obstacles_by_severity.values()),
            "by_severity": obstacles_by_severity
        },
        "countermeasure_stats": {
            "total": total,
            "successful": successful,
            "success_rate": round(success_rate, 1)
        },
        "recent_countermeasures": [
            {
                "id": cm.id,
                "action_type": cm.action_type,
                "status": cm.status,
                "confidence": cm.confidence_score,
                "created_at": cm.created_at.isoformat()
            }
            for cm in recent_countermeasures
        ],
        "simulation_status": _active_simulation.get_status() if _active_simulation else None
    }
