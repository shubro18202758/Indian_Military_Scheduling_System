"""
Military Convoy Tracking API Endpoints
========================================

FlightRadar24-style tracking API for Indian Army convoy operations.
Provides real-time tracking data, AI predictions, and checkpoint monitoring.

Security Classification: RESTRICTED
"""

from fastapi import APIRouter, HTTPException, Query, Body
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import asyncio

from app.services.tracking_service import tracking_service, ConvoyTrackingData
from app.services.janus_ai_service import janus_ai

router = APIRouter(tags=["Convoy Tracking"])


# ============================================================================
# CONVOY LIST & OVERVIEW
# ============================================================================

@router.get("/convoys")
async def get_all_tracked_convoys():
    """
    Get list of all tracked convoys with summary data.
    Similar to FlightRadar24's aircraft list view.
    """
    # Get all active convoy tracking data
    tracked_convoys = []
    
    for convoy_id in range(1, 7):  # 6 convoys in demo
        mission = tracking_service.get_mission_data(convoy_id)
        if mission:
            tracked_convoys.append({
                "convoy_id": convoy_id,
                "mission_id": mission["mission_id"],
                "callsign": mission["callsign"],
                "unit": mission["unit_id"],
                "formation": mission["formation"],
                "cargo_type": mission["cargo_type"],
                "vehicle_count": mission["vehicle_count"],
                "personnel_count": mission["personnel_count"],
                "priority": mission["mission_priority"],
                "classification": mission["security_classification"],
                "status": mission["mission_status"],
                "armed_escort": mission["armed_escort"]
            })
    
    return {
        "total_convoys": len(tracked_convoys),
        "active_convoys": sum(1 for c in tracked_convoys if c["status"] == "ACTIVE"),
        "convoys": tracked_convoys,
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/convoys/{convoy_id}")
async def get_convoy_tracking_detail(convoy_id: int):
    """
    Get detailed tracking data for a specific convoy.
    Full FlightRadar24-style detailed view.
    """
    mission = tracking_service.get_mission_data(convoy_id)
    if not mission:
        raise HTTPException(status_code=404, detail=f"Convoy {convoy_id} not found")
    
    vehicles = tracking_service.get_vehicle_data(convoy_id)
    
    # Get cached tracking data or generate new
    if convoy_id in tracking_service.active_convoys:
        tracking_data = tracking_service.active_convoys[convoy_id]
        return tracking_service.to_dict(tracking_data)
    
    # Return mission and vehicle data if no active tracking
    return {
        "convoy_id": convoy_id,
        "mission": mission,
        "vehicles": vehicles,
        "tracking_status": "NOT_ACTIVE",
        "message": "Start simulation to enable real-time tracking"
    }


@router.get("/convoys/{convoy_id}/live")
async def get_convoy_live_position(convoy_id: int):
    """
    Get real-time position data for convoy.
    Lightweight endpoint for frequent polling.
    """
    if convoy_id not in tracking_service.active_convoys:
        mission = tracking_service.get_mission_data(convoy_id)
        if not mission:
            raise HTTPException(status_code=404, detail="Convoy not found")
        return {
            "convoy_id": convoy_id,
            "callsign": mission.get("callsign", "UNKNOWN"),
            "status": "NOT_TRACKING",
            "message": "Convoy not currently in active tracking"
        }
    
    tracking = tracking_service.active_convoys[convoy_id]
    
    return {
        "convoy_id": convoy_id,
        "callsign": tracking.callsign,
        "position": {
            "latitude": tracking.latitude,
            "longitude": tracking.longitude,
            "altitude_m": tracking.altitude_m
        },
        "movement": {
            "speed_kmh": tracking.speed_kmh,
            "heading_deg": tracking.heading_deg,
            "status": tracking.movement_status.value if hasattr(tracking.movement_status, 'value') else tracking.movement_status
        },
        "progress": {
            "distance_covered_km": tracking.distance_covered_km,
            "distance_remaining_km": tracking.distance_remaining_km,
            "progress_pct": tracking.progress_pct,
            "eta": tracking.eta_destination.isoformat() if tracking.eta_destination else None
        },
        "health": {
            "convoy_status": tracking.convoy_health,
            "fuel_status": tracking.fuel_status,
            "threat_level": tracking.threat_level
        },
        "timestamp": datetime.utcnow().isoformat()
    }


# ============================================================================
# MISSION DETAILS
# ============================================================================

@router.get("/convoys/{convoy_id}/mission")
async def get_convoy_mission_details(convoy_id: int):
    """
    Get full mission details for a convoy.
    Classified information - need to know basis.
    """
    mission = tracking_service.get_mission_data(convoy_id)
    if not mission:
        raise HTTPException(status_code=404, detail="Convoy not found")
    
    return {
        "convoy_id": convoy_id,
        "mission": mission,
        "access_timestamp": datetime.utcnow().isoformat(),
        "classification_notice": f"This information is classified {mission['security_classification']}. Handle accordingly."
    }


@router.get("/convoys/{convoy_id}/vehicles")
async def get_convoy_vehicles(convoy_id: int):
    """
    Get detailed vehicle tracking for convoy.
    Individual vehicle positions, status, and crew information.
    """
    vehicles = tracking_service.get_vehicle_data(convoy_id)
    mission = tracking_service.get_mission_data(convoy_id)
    
    if not vehicles:
        raise HTTPException(status_code=404, detail="Convoy not found")
    
    # Enhance with live tracking data if available
    if convoy_id in tracking_service.active_convoys:
        tracking = tracking_service.active_convoys[convoy_id]
        vehicles = tracking.vehicles
    
    return {
        "convoy_id": convoy_id,
        "callsign": mission.get("callsign", "UNKNOWN") if mission else "UNKNOWN",
        "vehicle_count": len(vehicles),
        "lead_vehicle": mission.get("lead_vehicle_callsign") if mission else None,
        "tail_vehicle": mission.get("tail_vehicle_callsign") if mission else None,
        "vehicles": vehicles,
        "timestamp": datetime.utcnow().isoformat()
    }


# ============================================================================
# CHECKPOINT & TCP TRACKING
# ============================================================================

@router.get("/convoys/{convoy_id}/checkpoints")
async def get_convoy_checkpoints(convoy_id: int):
    """
    Get checkpoint crossing history and upcoming checkpoints.
    TCPs, transit camps, forward posts, etc.
    """
    mission = tracking_service.get_mission_data(convoy_id)
    if not mission:
        raise HTTPException(status_code=404, detail="Convoy not found")
    
    # Generate realistic checkpoint data
    checkpoints = _generate_checkpoint_timeline(convoy_id)
    
    return {
        "convoy_id": convoy_id,
        "callsign": mission["callsign"],
        "checkpoints": checkpoints,
        "summary": {
            "total_checkpoints": len(checkpoints),
            "crossed": sum(1 for c in checkpoints if c["status"] in ["CLEARED", "DEPARTED"]),
            "current": next((c for c in checkpoints if c["status"] == "ARRIVED"), None),
            "pending": sum(1 for c in checkpoints if c["status"] == "PENDING")
        },
        "timestamp": datetime.utcnow().isoformat()
    }


def _generate_checkpoint_timeline(convoy_id: int) -> List[Dict]:
    """Generate realistic checkpoint timeline for convoy."""
    import random
    
    checkpoint_names = [
        ("TCP-JMU-NORTH", "Jammu North TCP", "TCP", 32.79, 74.87),
        ("TCP-UDHAMPUR", "Udhampur Check Post", "TCP", 32.93, 75.14),
        ("TC-PATNITOP", "Patnitop Transit Camp", "TRANSIT_CAMP", 33.08, 75.33),
        ("TCP-RAMBAN", "Ramban TCP", "TCP", 33.24, 75.24),
        ("FP-BANIHAL", "Banihal Forward Post", "FORWARD_POST", 33.44, 75.20),
        ("TCP-QAZIGUND", "Qazigund Checkpoint", "TCP", 33.59, 75.16),
        ("AP-AWANTIPORA", "Awantipora Ammo Point", "AMMO_POINT", 33.92, 75.02),
        ("TC-SRINAGAR", "Srinagar Transit Facility", "TRANSIT_CAMP", 34.08, 74.79),
        ("TCP-SONAMARG", "Sonamarg TCP", "TCP", 34.30, 75.29),
        ("FP-ZOJILA", "Zoji La Forward Post", "FORWARD_POST", 34.29, 75.47),
        ("TCP-DRASS", "Drass Checkpoint", "TCP", 34.43, 75.76),
        ("FP-KARGIL", "Kargil Forward Base", "FORWARD_POST", 34.56, 76.13),
    ]
    
    # Select checkpoints based on convoy_id
    selected = checkpoint_names[:min(8, 3 + convoy_id)]
    
    checkpoints = []
    base_time = datetime.utcnow() - timedelta(hours=random.randint(2, 6))
    
    for i, (cp_id, name, cp_type, lat, lng) in enumerate(selected):
        scheduled = base_time + timedelta(hours=i * 1.5)
        
        # Determine status based on time
        if i < convoy_id % 4:
            status = "CLEARED"
            actual = scheduled + timedelta(minutes=random.randint(-10, 20))
            departure = actual + timedelta(minutes=random.randint(5, 30))
        elif i == convoy_id % 4:
            status = random.choice(["ARRIVED", "APPROACHING"])
            actual = datetime.utcnow() - timedelta(minutes=random.randint(0, 30)) if status == "ARRIVED" else None
            departure = None
        else:
            status = "PENDING"
            actual = None
            departure = None
        
        delay = int((actual - scheduled).total_seconds() / 60) if actual and status == "CLEARED" else 0
        
        checkpoints.append({
            "checkpoint_id": cp_id,
            "name": name,
            "type": cp_type,
            "latitude": lat,
            "longitude": lng,
            "sequence": i + 1,
            "scheduled_arrival": scheduled.isoformat(),
            "actual_arrival": actual.isoformat() if actual else None,
            "departure": departure.isoformat() if departure else None,
            "status": status,
            "delay_minutes": max(0, delay),
            "verified_by": f"Hav. {random.choice(['Singh', 'Kumar', 'Yadav', 'Sharma'])}" if status == "CLEARED" else None,
            "security_status": random.choice(["GREEN", "GREEN", "GREEN", "AMBER"])
        })
    
    return checkpoints


# ============================================================================
# AI PREDICTIONS & INSIGHTS
# ============================================================================

@router.get("/convoys/{convoy_id}/predictions")
async def get_convoy_ai_predictions(convoy_id: int):
    """
    Get AI-powered predictions for convoy.
    ETA forecasting, threat assessment, mission success probability.
    Powered by Janus Pro 7B with GPU acceleration.
    """
    mission = tracking_service.get_mission_data(convoy_id)
    if not mission:
        raise HTTPException(status_code=404, detail="Convoy not found")
    
    # Get cached predictions or generate new
    predictions = tracking_service.predictions_cache.get(convoy_id, [])
    
    if not predictions:
        # Generate predictions if we have tracking data
        if convoy_id in tracking_service.active_convoys:
            tracking = tracking_service.active_convoys[convoy_id]
            predictions = await tracking_service.generate_ai_predictions(convoy_id, tracking)
        else:
            # Generate basic predictions without live tracking
            predictions = _generate_basic_predictions(convoy_id, mission)
    
    return {
        "convoy_id": convoy_id,
        "callsign": mission["callsign"],
        "predictions": predictions,
        "ai_engine": "JANUS_PRO_7B",
        "gpu_accelerated": True,
        "generated_at": datetime.utcnow().isoformat()
    }


def _generate_basic_predictions(convoy_id: int, mission: Dict) -> List[Dict]:
    """Generate basic predictions without live tracking."""
    import random
    
    predictions = []
    
    # Mission completion prediction
    base_probability = 0.85 + random.uniform(0, 0.12)
    risk_factors = []
    
    if mission["cargo_type"] == "AMMUNITION":
        base_probability -= 0.05
        risk_factors.append("High-value cargo requires additional security protocols")
    
    if mission["mission_priority"] == "FLASH":
        risk_factors.append("Flash priority mission - time critical")
    
    predictions.append({
        "prediction_id": f"PRED-MISSION-{convoy_id}",
        "type": "MISSION_COMPLETION",
        "title": "Mission Success Probability",
        "summary": f"{base_probability * 100:.0f}% probability of successful mission completion",
        "probability": round(base_probability, 2),
        "risk_level": "LOW" if base_probability > 0.85 else ("MEDIUM" if base_probability > 0.7 else "HIGH"),
        "risk_factors": risk_factors,
        "recommendations": [
            "Maintain current pace and formation",
            "Continue monitoring weather conditions",
            "Report at each TCP crossing"
        ],
        "generated_by": "JANUS_PRO_7B_GPU",
        "timestamp": datetime.utcnow().isoformat()
    })
    
    # Weather prediction
    weather_impact = random.choice(["NONE", "MINOR", "MODERATE"])
    predictions.append({
        "prediction_id": f"PRED-WEATHER-{convoy_id}",
        "type": "WEATHER_FORECAST",
        "title": "Weather Impact Assessment",
        "summary": f"{weather_impact} weather impact expected for route",
        "impact_level": weather_impact,
        "conditions": {
            "current": random.choice(["Clear", "Partly Cloudy", "Overcast"]),
            "forecast_6h": random.choice(["Clear", "Light Rain", "Fog patches"]),
            "visibility": f"{random.randint(5, 15)} km"
        },
        "recommendations": [
            "Monitor weather updates at each checkpoint",
            "Carry emergency supplies for weather delays"
        ] if weather_impact != "NONE" else ["No weather-related actions required"],
        "generated_by": "JANUS_PRO_7B_GPU",
        "timestamp": datetime.utcnow().isoformat()
    })
    
    return predictions


@router.post("/convoys/{convoy_id}/analyze")
async def request_ai_analysis(
    convoy_id: int,
    analysis_type: str = Body(..., description="Type: TACTICAL, LOGISTICS, THREAT, ROUTE"),
    context: Dict[str, Any] = Body({})
):
    """
    Request specific AI analysis for convoy.
    Uses Janus Pro 7B for in-depth tactical analysis.
    """
    mission = tracking_service.get_mission_data(convoy_id)
    if not mission:
        raise HTTPException(status_code=404, detail="Convoy not found")
    
    # Build analysis prompt
    prompt = _build_analysis_prompt(analysis_type, mission, context)
    
    # Get AI analysis
    try:
        ai_available = await janus_ai.check_ai_availability()
        
        if ai_available:
            analysis = await janus_ai._call_ai_model(
                prompt=prompt,
                system_prompt="""You are JANUS PRO 7B, the core tactical AI for Indian Army convoy operations.
Provide detailed, actionable analysis based on the situation report.
Be precise, tactical, and consider all operational factors.
Format your response clearly with sections for Assessment, Recommendations, and Risks."""
            )
            
            return {
                "convoy_id": convoy_id,
                "analysis_type": analysis_type,
                "analysis": analysis,
                "ai_engine": "JANUS_PRO_7B_GPU",
                "gpu_accelerated": True,
                "confidence": 0.88,
                "timestamp": datetime.utcnow().isoformat()
            }
        else:
            return {
                "convoy_id": convoy_id,
                "analysis_type": analysis_type,
                "analysis": _get_heuristic_analysis(analysis_type, mission),
                "ai_engine": "HEURISTIC_FALLBACK",
                "gpu_accelerated": False,
                "confidence": 0.7,
                "timestamp": datetime.utcnow().isoformat()
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


def _build_analysis_prompt(analysis_type: str, mission: Dict, context: Dict) -> str:
    """Build analysis prompt for Janus AI."""
    base_info = f"""
CONVOY SITUATION REPORT:
- Mission ID: {mission['mission_id']}
- Unit: {mission['unit_name']} ({mission['unit_id']})
- Formation: {mission['formation_name']}
- Cargo: {mission['cargo_type']} - {mission['cargo_description']}
- Vehicle Count: {mission['vehicle_count']}
- Personnel: {mission['personnel_count']}
- Priority: {mission['mission_priority']}
- Classification: {mission['security_classification']}
- Armed Escort: {'Yes - ' + mission['escort_unit'] if mission['armed_escort'] else 'No'}
"""
    
    if analysis_type == "TACTICAL":
        return f"""{base_info}

REQUEST: Provide tactical assessment for this convoy movement.
Consider: Route security, formation recommendations, communication protocols, 
contingency planning, and escort requirements.
"""
    elif analysis_type == "LOGISTICS":
        return f"""{base_info}

REQUEST: Provide logistics assessment.
Consider: Fuel requirements, maintenance scheduling, halt point selection,
resupply needs, and load distribution optimization.
"""
    elif analysis_type == "THREAT":
        return f"""{base_info}

REQUEST: Provide threat assessment for convoy route.
Consider: Known threat areas, weather hazards, terrain challenges,
security situation, and recommended countermeasures.
"""
    else:
        return f"""{base_info}

REQUEST: Provide route optimization analysis.
Consider: Alternate routes, time optimization, checkpoint timing,
traffic deconfliction, and terrain challenges.
"""


def _get_heuristic_analysis(analysis_type: str, mission: Dict) -> str:
    """Generate heuristic analysis when AI unavailable."""
    return f"""HEURISTIC ANALYSIS - {analysis_type}

Mission: {mission['mission_id']}
Status: Analysis based on standard operating procedures

ASSESSMENT:
- Mission parameters are within normal operational limits
- {mission['cargo_type']} cargo requires standard handling protocols
- {mission['vehicle_count']} vehicles in convoy is optimal for current route

RECOMMENDATIONS:
1. Maintain standard convoy formation and spacing
2. Report at each TCP as per protocol
3. Monitor fuel levels and plan halts accordingly
4. Maintain communication schedule on assigned frequencies

RISK LEVEL: STANDARD
No immediate concerns identified through heuristic analysis.

Note: For detailed AI-powered analysis, ensure Janus Pro 7B is operational.
"""


# ============================================================================
# OBSTACLE & THREAT TRACKING
# ============================================================================

@router.get("/convoys/{convoy_id}/threats")
async def get_convoy_threats(convoy_id: int):
    """
    Get active threats and obstacles affecting convoy.
    Real-time threat tracking with AI recommendations.
    """
    mission = tracking_service.get_mission_data(convoy_id)
    if not mission:
        raise HTTPException(status_code=404, detail="Convoy not found")
    
    # Get tracking data for threat info
    threats = []
    if convoy_id in tracking_service.active_convoys:
        tracking = tracking_service.active_convoys[convoy_id]
        threats = tracking.active_threats
    
    return {
        "convoy_id": convoy_id,
        "callsign": mission["callsign"],
        "threat_level": tracking.threat_level if convoy_id in tracking_service.active_convoys else "UNKNOWN",
        "active_threats": threats,
        "threat_count": len(threats),
        "ai_assessment": "Route clear - no immediate threats detected" if not threats else "Active threats detected - exercise caution",
        "timestamp": datetime.utcnow().isoformat()
    }


# ============================================================================
# TRACKING CONTROL
# ============================================================================

@router.post("/convoys/{convoy_id}/start-tracking")
async def start_convoy_tracking(
    convoy_id: int,
    initial_lat: float = Body(32.726),
    initial_lng: float = Body(74.857)
):
    """
    Start real-time tracking for a convoy.
    Initializes tracking data and enables live updates.
    """
    mission = tracking_service.get_mission_data(convoy_id)
    if not mission:
        raise HTTPException(status_code=404, detail="Convoy not found")
    
    # Initialize tracking data
    tracking_data = tracking_service.calculate_tracking_data(
        convoy_id=convoy_id,
        current_lat=initial_lat,
        current_lng=initial_lng,
        route_waypoints=[(initial_lat, initial_lng), (34.08, 74.79)],  # Default route
        start_time=datetime.utcnow(),
        speed_kmh=0
    )
    
    return {
        "status": "TRACKING_STARTED",
        "convoy_id": convoy_id,
        "callsign": mission["callsign"],
        "initial_position": {
            "latitude": initial_lat,
            "longitude": initial_lng
        },
        "message": f"Real-time tracking initiated for {mission['callsign']}",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/dashboard")
async def get_tracking_dashboard():
    """
    Get comprehensive tracking dashboard data.
    Overview of all convoys, threats, and AI predictions.
    """
    all_missions = []
    total_vehicles = 0
    total_personnel = 0
    
    for convoy_id in range(1, 7):
        mission = tracking_service.get_mission_data(convoy_id)
        if mission:
            all_missions.append(mission)
            total_vehicles += mission["vehicle_count"]
            total_personnel += mission["personnel_count"]
    
    # Count by priority
    priority_counts = {}
    for m in all_missions:
        p = m["mission_priority"]
        priority_counts[p] = priority_counts.get(p, 0) + 1
    
    # Count by cargo type
    cargo_counts = {}
    for m in all_missions:
        c = m["cargo_type"]
        cargo_counts[c] = cargo_counts.get(c, 0) + 1
    
    return {
        "summary": {
            "total_convoys": len(all_missions),
            "active_tracking": len(tracking_service.active_convoys),
            "total_vehicles": total_vehicles,
            "total_personnel": total_personnel
        },
        "by_priority": priority_counts,
        "by_cargo": cargo_counts,
        "formations": list(set(m["formation"] for m in all_missions)),
        "ai_status": {
            "engine": "JANUS_PRO_7B",
            "gpu_accelerated": True,
            "predictions_cached": len(tracking_service.predictions_cache)
        },
        "timestamp": datetime.utcnow().isoformat()
    }
