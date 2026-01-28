"""
AI Load Management API Endpoints
================================
Complete API for AI-powered load management, vehicle sharing,
movement planning, and dynamic notifications.

Implements all requirements from the problem statement:
- Load and volume management
- Vehicle sharing between entities
- Prioritization of load
- Movement planning (vehicles, routes, halts, road space)
- Dynamic planning and entity notifications
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

from app.core.database import get_db
from app.services.ai_load_engine import AILoadManagementEngine

router = APIRouter(prefix="/ai-load", tags=["AI Load Management"])


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class LoadPriorityRequest(BaseModel):
    """Request model for load priority calculation"""
    cargo_category: str = Field(default="GENERAL", description="Type of cargo")
    stated_priority: str = Field(default="ROUTINE", description="Stated priority level")
    weight_tons: float = Field(default=0.0, description="Weight in tons")
    required_delivery_time: Optional[datetime] = None
    is_hazardous: bool = False
    requires_escort: bool = False
    requesting_entity: str = ""


class VehicleMatchRequest(BaseModel):
    """Request model for vehicle matching"""
    cargo_category: str = Field(default="GENERAL")
    weight_tons: float = Field(default=5.0)
    volume_cubic_m: float = Field(default=10.0)
    is_hazardous: bool = False
    requires_refrigeration: bool = False
    personnel_count: int = 0


class SharingRequest(BaseModel):
    """Request model for vehicle sharing"""
    requesting_entity: str = Field(..., description="Entity requesting vehicles")
    vehicle_type: str = Field(default="TRUCK", description="Type of vehicle needed")
    quantity: int = Field(default=1, ge=1, le=20)
    duration_hours: int = Field(default=24, ge=1, le=168)
    purpose: str = Field(default="Transport mission")
    priority: str = Field(default="ROUTINE")


class NotificationRequest(BaseModel):
    """Request model for sending notifications"""
    entity_name: str = Field(..., description="Target entity")
    notification_type: str = Field(default="INFO")
    title: str = Field(..., description="Notification title")
    message: str = Field(..., description="Notification message")
    priority: str = Field(default="ROUTINE")
    convoy_id: Optional[int] = None
    action_required: Optional[str] = None


# ============================================================================
# LOAD PRIORITIZATION ENDPOINTS
# ============================================================================

@router.get("/priority-queue")
async def get_priority_queue(db: AsyncSession = Depends(get_db)):
    """
    Get AI-prioritized queue of all pending loads.
    Sorted by calculated priority score (highest first).
    """
    engine = AILoadManagementEngine(db)
    queue = await engine.get_prioritized_load_queue()
    
    return {
        "status": "success",
        "queue_size": len(queue),
        "high_priority_count": sum(1 for l in queue if l["priority_score"] >= 70),
        "queue": queue,
        "ai_engine": engine.engine_version
    }


@router.post("/calculate-priority")
async def calculate_priority(
    request: LoadPriorityRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Calculate AI priority score for a specific load.
    Returns score (0-100) with detailed reasoning.
    """
    engine = AILoadManagementEngine(db)
    score, reason = await engine.calculate_load_priority_score(
        cargo_category=request.cargo_category,
        stated_priority=request.stated_priority,
        weight_tons=request.weight_tons,
        required_delivery_time=request.required_delivery_time,
        is_hazardous=request.is_hazardous,
        requires_escort=request.requires_escort,
        requesting_entity=request.requesting_entity
    )
    
    return {
        "status": "success",
        "priority_score": round(score, 1),
        "reasoning": reason,
        "priority_band": "CRITICAL" if score >= 80 else "HIGH" if score >= 60 else "MEDIUM" if score >= 40 else "LOW"
    }


# ============================================================================
# VEHICLE MATCHING ENDPOINTS
# ============================================================================

@router.post("/match-vehicle")
async def match_vehicle_to_load(
    request: VehicleMatchRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Find optimal vehicles for a specific load.
    Returns ranked list with suitability scores.
    """
    engine = AILoadManagementEngine(db)
    matches = await engine.find_optimal_vehicle_for_load(
        cargo_category=request.cargo_category,
        weight_tons=request.weight_tons,
        volume_cubic_m=request.volume_cubic_m,
        is_hazardous=request.is_hazardous,
        requires_refrigeration=request.requires_refrigeration,
        personnel_count=request.personnel_count
    )
    
    return {
        "status": "success",
        "matches_found": len(matches),
        "best_match": matches[0] if matches else None,
        "all_matches": matches,
        "cargo_requirements": {
            "category": request.cargo_category,
            "weight_tons": request.weight_tons,
            "volume_cubic_m": request.volume_cubic_m,
            "special_requirements": {
                "hazardous": request.is_hazardous,
                "refrigerated": request.requires_refrigeration
            }
        }
    }


# ============================================================================
# VEHICLE SHARING ENDPOINTS
# ============================================================================

@router.get("/sharing/status")
async def get_sharing_status(db: AsyncSession = Depends(get_db)):
    """
    Get current vehicle sharing pool status.
    Shows available vehicles and sharing opportunities.
    """
    engine = AILoadManagementEngine(db)
    status = await engine.get_vehicle_sharing_status()
    
    return {
        "status": "success",
        **status
    }


@router.post("/sharing/request")
async def request_vehicle_sharing(
    request: SharingRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Submit a vehicle sharing request.
    AI evaluates and returns approval/denial with reasoning.
    """
    engine = AILoadManagementEngine(db)
    result = await engine.evaluate_sharing_request(
        requesting_entity=request.requesting_entity,
        vehicle_type=request.vehicle_type,
        quantity=request.quantity,
        duration_hours=request.duration_hours,
        purpose=request.purpose,
        priority=request.priority
    )
    
    return {
        "status": "success",
        **result
    }


# ============================================================================
# MOVEMENT PLANNING ENDPOINTS
# ============================================================================

@router.get("/movement-plan/{convoy_id}")
async def get_movement_plan(
    convoy_id: int,
    departure_time: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Generate optimal movement plan for a convoy.
    Includes route, halts, road space allocation, and timing.
    """
    engine = AILoadManagementEngine(db)
    plan = await engine.generate_movement_plan(convoy_id, departure_time)
    
    if "error" in plan:
        raise HTTPException(status_code=404, detail=plan["error"])
    
    return {
        "status": "success",
        **plan
    }


@router.get("/road-space")
async def get_road_space_utilization(db: AsyncSession = Depends(get_db)):
    """
    Get current road space utilization across all routes.
    Includes optimal departure windows and congestion status.
    """
    engine = AILoadManagementEngine(db)
    utilization = await engine.get_road_space_utilization()
    
    return {
        "status": "success",
        **utilization
    }


# ============================================================================
# NOTIFICATION ENDPOINTS
# ============================================================================

@router.get("/notifications")
async def get_notifications(
    convoy_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Get AI-generated notifications for entities en-route.
    Includes threat alerts, progress updates, and arrival notices.
    """
    engine = AILoadManagementEngine(db)
    notifications = await engine.generate_entity_notifications(convoy_id)
    
    return {
        "status": "success",
        "count": len(notifications),
        "critical_count": sum(1 for n in notifications if n["priority"] in ["FLASH", "IMMEDIATE"]),
        "notifications": notifications
    }


@router.post("/notifications/send")
async def send_notification(
    request: NotificationRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Send a specific notification to an entity.
    Returns confirmation of dispatch.
    """
    engine = AILoadManagementEngine(db)
    result = await engine.send_notification_to_entity(
        entity_name=request.entity_name,
        notification_type=request.notification_type,
        title=request.title,
        message=request.message,
        priority=request.priority,
        convoy_id=request.convoy_id,
        action_required=request.action_required
    )
    
    return {
        "status": "success",
        **result
    }


# ============================================================================
# COMPREHENSIVE DASHBOARD
# ============================================================================

@router.get("/dashboard")
async def get_ai_dashboard(db: AsyncSession = Depends(get_db)):
    """
    Get comprehensive AI load management dashboard.
    Single endpoint for complete operational picture.
    
    Includes:
    - Load priority queue
    - Vehicle sharing status
    - Movement plans
    - Road space utilization
    - Active notifications
    - AI summary and recommendations
    """
    engine = AILoadManagementEngine(db)
    dashboard = await engine.get_comprehensive_ai_dashboard()
    
    return {
        "status": "success",
        **dashboard
    }


# ============================================================================
# QUICK ACTIONS
# ============================================================================

@router.post("/quick-assign/{convoy_id}")
async def quick_assign_vehicles(
    convoy_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Quick AI action to assign optimal vehicles to a convoy.
    Returns assignment recommendations.
    """
    engine = AILoadManagementEngine(db)
    
    # Get convoy's cargo requirements
    from app.models.convoy import Convoy
    from sqlalchemy import select
    
    convoy_result = await db.execute(
        select(Convoy).where(Convoy.id == convoy_id)
    )
    convoy = convoy_result.scalar_one_or_none()
    
    if not convoy:
        raise HTTPException(status_code=404, detail=f"Convoy {convoy_id} not found")
    
    # Find matching vehicles
    matches = await engine.find_optimal_vehicle_for_load(
        cargo_category=convoy.cargo_type or "GENERAL",
        weight_tons=convoy.cargo_weight_tons or 10.0,
        volume_cubic_m=30.0,
        is_hazardous=convoy.cargo_type in ["AMMUNITION", "FUEL_POL"],
        requires_refrigeration=convoy.cargo_type == "MEDICAL",
        personnel_count=convoy.personnel_count or 0
    )
    
    return {
        "status": "success",
        "convoy_id": convoy_id,
        "convoy_name": convoy.name,
        "cargo_type": convoy.cargo_type,
        "current_vehicles": convoy.vehicle_count,
        "recommended_assignments": matches[:convoy.vehicle_count or 3],
        "action": "ASSIGN" if matches else "NO_VEHICLES_AVAILABLE"
    }


@router.post("/quick-plan/{convoy_id}")
async def quick_generate_plan(
    convoy_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Quick AI action to generate movement plan for a convoy.
    Returns optimized plan with halts and timing.
    """
    engine = AILoadManagementEngine(db)
    plan = await engine.generate_movement_plan(convoy_id)
    
    if "error" in plan:
        raise HTTPException(status_code=404, detail=plan["error"])
    
    return {
        "status": "success",
        "action": "PLAN_GENERATED",
        "plan_summary": {
            "plan_id": plan["plan_id"],
            "departure": plan["timing"]["planned_departure"],
            "arrival": plan["timing"]["estimated_arrival"],
            "duration_hours": plan["timing"]["total_duration_hours"],
            "halts": len(plan["planned_halts"]),
            "optimization_score": plan["optimization_scores"]["overall_score"],
            "risk_level": plan["ai_risk_assessment"]["overall_risk"]
        },
        "full_plan": plan
    }
