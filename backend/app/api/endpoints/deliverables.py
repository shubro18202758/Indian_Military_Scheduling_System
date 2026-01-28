"""
Enhanced Deliverables API Endpoints

Provides comprehensive military logistics calculations with deep AI integration:
- VTKM Calculator with full parameters
- FOL Analysis with fleet composition
- MACP Credit Point Calculator
- TCP Planning
- Halt Schedule Generation
- Route Classification
- Threat Assessment
- Convoy Optimization
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import traceback

# Import services
from app.services.military_algorithms import (
    military_service,
    VTKMInput, VTKMCalculator,
    VehicleFleet, FOLInput, FOLCalculator,
    MACPInput, MACPCalculator,
    TCPPlanner, HaltScheduleGenerator, RouteClassifier,
    ThreatAssessment, ConvoyOptimizer,
    ThreatLevel, TerrainType, ConvoyFormation, VehicleType,
    UrgencyLevel, AmmoCategory, TCPType
)
from app.services.gpu_military_ops import gpu_ops, get_gpu_ops

router = APIRouter()


# ============================================
# REQUEST/RESPONSE MODELS
# ============================================

class VTKMRequest(BaseModel):
    vehicle_count: int = Field(..., ge=1, le=500, description="Number of vehicles in convoy")
    inter_vehicle_distance_m: float = Field(100, ge=25, le=500, description="Base inter-vehicle distance in meters")
    threat_level: str = Field("GREEN", description="Threat level: GREEN, YELLOW, ORANGE, RED")
    terrain: str = Field("PLAINS", description="Terrain type")
    formation: str = Field("COLUMN", description="Convoy formation")
    cargo_category: str = Field("GENERAL", description="Cargo classification")
    day_night: str = Field("DAY", description="DAY or NIGHT operation")
    altitude_m: float = Field(0, ge=0, le=6000, description="Altitude in meters")

class VehicleFleetItem(BaseModel):
    vehicle_type: str
    count: int = Field(..., ge=1)
    load_tons: float = Field(0, ge=0)

class FOLRequest(BaseModel):
    vehicles: List[VehicleFleetItem]
    distance_km: float = Field(..., ge=1)
    terrain: str = Field("PLAINS")
    altitude_m: float = Field(0, ge=0)
    buffer_percent: float = Field(20, ge=0, le=100)
    return_journey: bool = Field(False)
    reserve_days: int = Field(0, ge=0)

class MACPRequest(BaseModel):
    cargo_weight_tons: float = Field(..., ge=0.1)
    distance_km: float = Field(..., ge=1)
    urgency: str = Field("ROUTINE")
    terrain: str = Field("PLAINS")
    ammo_category: Optional[str] = Field(None)

class TCPRequest(BaseModel):
    route_distance_km: float = Field(..., ge=10)
    route_type: str = Field("MSR", description="MSR, TACTICAL, or URBAN")
    threat_level: str = Field("GREEN")
    include_fuel: bool = Field(True)
    include_medical: bool = Field(True)

class HaltRequest(BaseModel):
    total_distance_km: float = Field(..., ge=10)
    avg_speed_kmph: float = Field(30, ge=10, le=80)
    start_time: Optional[str] = Field(None, description="HH:MM format")
    include_night_halt: bool = Field(True)
    terrain: str = Field("PLAINS")

class RouteClassRequest(BaseModel):
    max_weight_tons: float = Field(..., ge=1)
    width_m: float = Field(..., ge=2)
    surface_type: str = Field("METALLED")
    gradient_percent: float = Field(0, ge=0, le=30)

class ThreatAssessmentRequest(BaseModel):
    terrain: str = Field("PLAINS")
    route_length_km: float = Field(..., ge=1)
    time_of_day: str = Field("DAY")
    historical_incidents: int = Field(0, ge=0)
    nearby_hostile_zones: int = Field(0, ge=0)

class FleetAnalysisRequest(BaseModel):
    vehicles: List[Dict[str, Any]]
    
class MonteCarloRequest(BaseModel):
    base_threat: float = Field(0.3, ge=0, le=1)
    terrain_variance: float = Field(0.1, ge=0, le=0.5)
    time_variance: float = Field(0.05, ge=0, le=0.3)
    intel_variance: float = Field(0.1, ge=0, le=0.5)
    simulations: int = Field(10000, ge=100, le=100000)

class ConvoySimRequest(BaseModel):
    distance_km: float = Field(..., ge=10)
    base_speed_kmph: float = Field(35, ge=10, le=80)
    vehicle_count: int = Field(..., ge=1)
    fuel_consumption_l: float = Field(500, ge=10)
    scenarios: int = Field(1000, ge=100, le=50000)

class LoadOptimizeRequest(BaseModel):
    cargo_weights: List[float]
    vehicle_capacities: List[float]
    iterations: int = Field(5000, ge=100, le=50000)


# ============================================
# HELPER FUNCTIONS
# ============================================

def parse_threat_level(level: str) -> ThreatLevel:
    try:
        return ThreatLevel[level.upper()]
    except KeyError:
        return ThreatLevel.GREEN

def parse_terrain(terrain: str) -> TerrainType:
    try:
        return TerrainType[terrain.upper()]
    except KeyError:
        return TerrainType.PLAINS

def parse_formation(formation: str) -> ConvoyFormation:
    try:
        return ConvoyFormation[formation.upper()]
    except KeyError:
        return ConvoyFormation.COLUMN

def parse_vehicle_type(vtype: str) -> VehicleType:
    try:
        return VehicleType[vtype.upper()]
    except KeyError:
        return VehicleType.SHAKTIMAN

def parse_urgency(urgency: str) -> UrgencyLevel:
    try:
        return UrgencyLevel[urgency.upper()]
    except KeyError:
        return UrgencyLevel.ROUTINE

def parse_ammo_category(cat: Optional[str]) -> Optional[AmmoCategory]:
    if not cat:
        return None
    try:
        return AmmoCategory[cat.upper()]
    except KeyError:
        return None


# ============================================
# VTKM ENDPOINTS
# ============================================

@router.post("/vtkm/calculate")
async def calculate_vtkm(request: VTKMRequest):
    """Calculate Vehicle Track Kilometer with full military parameters"""
    try:
        input_data = VTKMInput(
            vehicle_count=request.vehicle_count,
            inter_vehicle_distance_m=request.inter_vehicle_distance_m,
            threat_level=parse_threat_level(request.threat_level),
            terrain=parse_terrain(request.terrain),
            formation=parse_formation(request.formation),
            cargo_category=request.cargo_category,
            day_night=request.day_night,
            altitude_m=request.altitude_m,
        )
        
        result = military_service.vtkm.calculate(input_data)
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "engine": "MILITARY_ALGORITHMS_v2",
            "gpu_accelerated": military_service.vtkm.use_gpu,
            "data": {
                "vtkm": result.vtkm,
                "convoy_length_km": result.convoy_length_km,
                "recommended_spacing_m": result.recommended_spacing_m,
                "formation": result.formation,
                "threat_level": result.threat_level,
                "terrain_factor": result.terrain_factor,
                "speed_factor": result.speed_factor,
                "effective_speed_kmph": result.effective_speed_kmph,
                "crossing_time_min": result.crossing_time_min,
                "ai_recommendation": result.ai_recommendation,
                "confidence_score": result.confidence_score,
            }
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vtkm/parameters")
async def get_vtkm_parameters():
    """Get available VTKM parameters"""
    return {
        "threat_levels": [t.value for t in ThreatLevel],
        "terrains": [t.value for t in TerrainType],
        "formations": [f.value for f in ConvoyFormation],
        "cargo_categories": ["GENERAL", "AMMUNITION", "FUEL", "MEDICAL", "TROOPS", "EQUIPMENT", "HAZMAT"],
        "day_night": ["DAY", "NIGHT", "BLACKOUT"],
        "standard_distances": {
            "NORMAL": 50,
            "TACTICAL": 100,
            "COMBAT": 150,
            "AIR_THREAT": 200,
            "HIGH_THREAT": 250,
        }
    }


# ============================================
# FOL ENDPOINTS
# ============================================

@router.post("/fol/calculate")
async def calculate_fol(request: FOLRequest):
    """Calculate First Line of Logic (Fuel) requirements"""
    try:
        vehicles = [
            VehicleFleet(
                vehicle_type=parse_vehicle_type(v.vehicle_type),
                count=v.count,
                load_tons=v.load_tons
            ) for v in request.vehicles
        ]
        
        input_data = FOLInput(
            vehicles=vehicles,
            distance_km=request.distance_km,
            terrain=parse_terrain(request.terrain),
            altitude_m=request.altitude_m,
            buffer_percent=request.buffer_percent,
            return_journey=request.return_journey,
            reserve_days=request.reserve_days,
        )
        
        result = military_service.fol.calculate(input_data)
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "engine": "MILITARY_ALGORITHMS_v2",
            "data": {
                "diesel_liters": result.diesel_liters,
                "petrol_liters": result.petrol_liters,
                "total_fuel_liters": result.total_fuel_liters,
                "engine_oil_liters": result.engine_oil_liters,
                "gear_oil_liters": result.gear_oil_liters,
                "grease_kg": result.grease_kg,
                "altitude_correction": result.altitude_correction,
                "terrain_correction": result.terrain_correction,
                "reserve_fuel": result.reserve_fuel,
                "cost_estimate_inr": result.cost_estimate_inr,
                "per_vehicle_breakdown": result.per_vehicle_breakdown,
                "ai_recommendation": result.ai_recommendation,
            }
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/fol/vehicle-specs")
async def get_vehicle_specs():
    """Get vehicle specifications for FOL calculation"""
    from app.services.military_algorithms import VEHICLE_SPECS
    return {
        "vehicles": {v.value: specs for v, specs in VEHICLE_SPECS.items()},
        "fuel_costs_inr": {"DIESEL": 89.5, "PETROL": 96.7},
    }


# ============================================
# MACP ENDPOINTS
# ============================================

@router.post("/macp/calculate")
async def calculate_macp(request: MACPRequest):
    """Calculate Movement Ammunition Credit Points"""
    try:
        input_data = MACPInput(
            cargo_weight_tons=request.cargo_weight_tons,
            distance_km=request.distance_km,
            urgency=parse_urgency(request.urgency),
            terrain=parse_terrain(request.terrain),
            ammo_category=parse_ammo_category(request.ammo_category),
        )
        
        result = military_service.macp.calculate(input_data)
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "engine": "MILITARY_ALGORITHMS_v2",
            "data": {
                "credit_points": result.credit_points,
                "priority_score": result.priority_score,
                "recommended_vehicles": result.recommended_vehicles,
                "estimated_time_hours": result.estimated_time_hours,
                "special_handling": result.special_handling,
                "ai_recommendation": result.ai_recommendation,
            }
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# TCP ENDPOINTS
# ============================================

@router.post("/tcp/plan")
async def plan_tcps(request: TCPRequest):
    """Plan Traffic Control Posts for a route"""
    try:
        tcps = military_service.tcp.plan_tcps(
            route_distance_km=request.route_distance_km,
            route_type=request.route_type,
            threat_level=parse_threat_level(request.threat_level),
            include_fuel=request.include_fuel,
            include_medical=request.include_medical,
        )
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "engine": "MILITARY_ALGORITHMS_v2",
            "data": {
                "route_distance_km": request.route_distance_km,
                "total_tcps": len(tcps),
                "tcps": [
                    {
                        "post_id": tcp.post_id,
                        "post_type": tcp.post_type.value,
                        "location_km": tcp.location_km,
                        "personnel": tcp.personnel,
                        "equipment": tcp.equipment,
                        "communication": tcp.communication,
                    } for tcp in tcps
                ],
                "personnel_summary": self._summarize_tcp_personnel(tcps),
            }
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

def _summarize_tcp_personnel(tcps) -> Dict[str, int]:
    """Summarize total personnel required for all TCPs"""
    totals = {"Officer": 0, "JCO": 0, "OR": 0}
    for tcp in tcps:
        for role, count in tcp.personnel.items():
            totals[role] = totals.get(role, 0) + count
    return totals

# Attach helper to router context
router._summarize_tcp_personnel = _summarize_tcp_personnel


# ============================================
# HALT SCHEDULE ENDPOINTS
# ============================================

@router.post("/halt/schedule")
async def generate_halt_schedule(request: HaltRequest):
    """Generate halt schedule for convoy movement"""
    try:
        start_time = None
        if request.start_time:
            try:
                parts = request.start_time.split(":")
                start_time = datetime.now().replace(
                    hour=int(parts[0]), minute=int(parts[1]), second=0, microsecond=0
                )
            except Exception:
                start_time = datetime.now().replace(hour=6, minute=0)
        
        halts = military_service.halt.generate_schedule(
            total_distance_km=request.total_distance_km,
            avg_speed_kmph=request.avg_speed_kmph,
            start_time=start_time,
            include_night_halt=request.include_night_halt,
            terrain=parse_terrain(request.terrain),
        )
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "engine": "MILITARY_ALGORITHMS_v2",
            "data": {
                "total_distance_km": request.total_distance_km,
                "estimated_travel_hours": request.total_distance_km / request.avg_speed_kmph,
                "total_halts": len(halts),
                "halts": [
                    {
                        "halt_type": h.halt_type,
                        "start_km": h.start_km,
                        "duration_min": h.duration_min,
                        "purpose": h.purpose,
                        "facilities_required": h.facilities_required,
                    } for h in halts
                ],
                "halt_summary": {
                    "short_halts": sum(1 for h in halts if h.halt_type == "SHORT"),
                    "long_halts": sum(1 for h in halts if h.halt_type == "LONG"),
                    "night_halts": sum(1 for h in halts if h.halt_type == "NIGHT"),
                    "total_halt_time_hours": sum(h.duration_min for h in halts) / 60,
                },
            }
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ROUTE CLASSIFICATION ENDPOINTS
# ============================================

@router.post("/route/classify")
async def classify_route(request: RouteClassRequest):
    """Classify route according to NATO standards"""
    try:
        result = military_service.route.classify_route(
            max_weight_tons=request.max_weight_tons,
            width_m=request.width_m,
            surface_type=request.surface_type,
            gradient_percent=request.gradient_percent,
        )
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "engine": "MILITARY_ALGORITHMS_v2",
            "data": result,
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# THREAT ASSESSMENT ENDPOINTS
# ============================================

@router.post("/threat/assess")
async def assess_threat(request: ThreatAssessmentRequest):
    """Assess threat level for a route"""
    try:
        result = military_service.threat.assess_route_threat(
            terrain=parse_terrain(request.terrain),
            route_length_km=request.route_length_km,
            time_of_day=request.time_of_day,
            historical_incidents=request.historical_incidents,
            nearby_hostile_zones=request.nearby_hostile_zones,
        )
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "engine": "MILITARY_ALGORITHMS_v2",
            "data": result,
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/threat/monte-carlo")
async def monte_carlo_threat(request: MonteCarloRequest):
    """Monte Carlo threat simulation"""
    try:
        result = gpu_ops.monte_carlo_threat_assessment(
            route_params={
                "base_threat": request.base_threat,
                "terrain_variance": request.terrain_variance,
                "time_variance": request.time_variance,
                "intel_variance": request.intel_variance,
            },
            n_simulations=request.simulations,
        )
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "engine": "GPU_MILITARY_OPS",
            "data": result,
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# GPU OPERATIONS ENDPOINTS
# ============================================

@router.post("/gpu/fleet-analysis")
async def analyze_fleet(request: FleetAnalysisRequest):
    """GPU-accelerated fleet efficiency analysis"""
    try:
        result = gpu_ops.analyze_fleet_efficiency(request.vehicles)
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "engine": "GPU_MILITARY_OPS",
            "data": result,
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/gpu/convoy-simulation")
async def simulate_convoy(request: ConvoySimRequest):
    """GPU-accelerated convoy journey simulation"""
    try:
        result = gpu_ops.simulate_convoy_journey(
            convoy_params={
                "distance_km": request.distance_km,
                "base_speed_kmph": request.base_speed_kmph,
                "vehicle_count": request.vehicle_count,
                "fuel_consumption_l": request.fuel_consumption_l,
            },
            n_scenarios=request.scenarios,
        )
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "engine": "GPU_MILITARY_OPS",
            "data": result,
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/gpu/load-optimize")
async def optimize_load(request: LoadOptimizeRequest):
    """GPU-accelerated load distribution optimization"""
    try:
        result = gpu_ops.optimize_load_distribution(
            cargo_weights=request.cargo_weights,
            vehicle_capacities=request.vehicle_capacities,
            n_iterations=request.iterations,
        )
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "engine": "GPU_MILITARY_OPS",
            "data": result,
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/gpu/status")
async def get_gpu_status():
    """Get GPU operations and AI engine status"""
    import httpx
    
    # Check Ollama/Janus AI connection
    janus_status = {"available": False, "model": None, "backend": "NumPy (CPU)"}
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get("http://host.docker.internal:11434/api/tags")
            if resp.status_code == 200:
                data = resp.json()
                models = data.get("models", [])
                for m in models:
                    if "janus" in m.get("name", "").lower():
                        janus_status = {
                            "available": True,
                            "model": m.get("name"),
                            "size": m.get("details", {}).get("parameter_size", "Unknown"),
                            "backend": f"JANUS AI ({m.get('details', {}).get('parameter_size', '32B')})"
                        }
                        break
    except Exception as e:
        pass  # Keep default NumPy (CPU) status
    
    return {
        "status": "success",
        "timestamp": datetime.now().isoformat(),
        "gpu_ops": {**gpu_ops.get_status(), **janus_status},
        "military_algorithms": military_service.get_status(),
        "ai_engine": janus_status["backend"],
    }


# ============================================
# SERVICE STATUS
# ============================================

@router.get("/status")
async def get_service_status():
    """Get comprehensive service status"""
    import httpx
    
    # Check Ollama/Janus AI
    ai_status = "CPU_FALLBACK"
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get("http://host.docker.internal:11434/api/tags")
            if resp.status_code == 200:
                data = resp.json()
                for m in data.get("models", []):
                    if "janus" in m.get("name", "").lower():
                        ai_status = "JANUS_PRO_7B"
                        break
    except:
        pass
    
    return {
        "status": "OPERATIONAL",
        "timestamp": datetime.now().isoformat(),
        "version": "2.0.0",
        "services": {
            "military_algorithms": "ONLINE",
            "gpu_ops": "ONLINE" if gpu_ops.gpu_available else "CPU_FALLBACK",
            "ai_engine": ai_status,
        },
        "endpoints_available": 15,
        "algorithms": [
            "VTKM Calculator",
            "FOL Calculator",
            "MACP Optimizer",
            "TCP Planner",
            "Halt Schedule Generator",
            "Route Classifier",
            "Threat Assessment",
            "Monte Carlo Simulation",
            "Fleet Analysis",
            "Convoy Simulation",
            "Load Optimization",
        ],
    }

