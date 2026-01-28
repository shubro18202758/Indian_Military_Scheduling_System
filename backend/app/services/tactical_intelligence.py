"""
AI Tactical Intelligence System
================================

Real-time AI-powered tactical analysis for convoy operations:
1. Threat prediction based on telemetry patterns
2. Maintenance predictions from sensor data
3. Route optimization recommendations
4. Fuel efficiency analysis
5. Crew fatigue management
6. Weather impact predictions
7. Tactical situational awareness

Integrates with local Janus AI model for intelligent decision-making.
Falls back to advanced heuristics when AI is unavailable.
"""

import asyncio
import math
import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
import httpx

from app.services.realistic_physics_engine import PhysicsState, TerrainType, WeatherCondition


class ThreatLevel(Enum):
    ALPHA = "ALPHA"      # All clear - normal operations
    BRAVO = "BRAVO"      # Elevated - increased monitoring
    CHARLIE = "CHARLIE"  # High - tactical adjustments needed
    DELTA = "DELTA"      # Critical - immediate action required


class RecommendationType(Enum):
    ROUTE = "ROUTE"
    SPEED = "SPEED"
    MAINTENANCE = "MAINTENANCE"
    FUEL = "FUEL"
    CREW = "CREW"
    TACTICAL = "TACTICAL"
    WEATHER = "WEATHER"
    FORMATION = "FORMATION"


@dataclass
class TacticalPrediction:
    """AI-generated prediction"""
    prediction_id: str
    prediction_type: str
    timeframe_minutes: int
    probability: float
    impact_severity: str
    description: str
    data_sources: List[str]
    confidence: float
    generated_at: datetime


@dataclass
class TacticalRecommendation:
    """AI-generated recommendation"""
    recommendation_id: str
    recommendation_type: RecommendationType
    priority: int  # 1-5, 1 = highest
    action: str
    reasoning: str
    expected_benefit: str
    risk_if_ignored: str
    confidence: float
    expires_at: datetime


@dataclass
class TacticalAssessment:
    """Complete tactical assessment for a vehicle/convoy"""
    vehicle_id: int
    timestamp: datetime
    threat_level: ThreatLevel
    overall_status: str
    
    # Predictions
    eta_prediction: Dict[str, Any]
    fuel_prediction: Dict[str, Any]
    maintenance_prediction: Dict[str, Any]
    weather_prediction: Dict[str, Any]
    
    # Recommendations
    active_recommendations: List[TacticalRecommendation]
    
    # Situational awareness
    threats_detected: List[Dict[str, Any]]
    route_conditions: Dict[str, Any]
    
    # AI analysis
    ai_summary: str
    tactical_notes: List[str]


class TacticalIntelligenceEngine:
    """
    AI-powered tactical intelligence for convoy operations.
    Provides real-time predictions and recommendations based on telemetry data.
    """
    
    def __init__(self):
        self.ollama_url = "http://host.docker.internal:11434"
        self.model_name = "janus:latest"
        self.ai_available = False
        self.last_ai_check = None
        
        # Analysis history for pattern detection
        self.telemetry_history: Dict[int, List[PhysicsState]] = {}
        self.prediction_history: Dict[int, List[TacticalPrediction]] = {}
        
        # Thresholds for alerts (dynamically adjusted based on conditions)
        self.thresholds = {
            "engine_temp_warning": 95,
            "engine_temp_critical": 105,
            "fuel_warning_pct": 25,
            "fuel_critical_pct": 15,
            "tire_pressure_low": 28,
            "tire_pressure_high": 38,
            "brake_temp_warning": 200,
            "fatigue_warning_pct": 60,
            "fatigue_critical_pct": 80,
            "visibility_poor_m": 500,
            "battery_low_pct": 30,
        }
    
    async def check_ai_availability(self) -> bool:
        """Check if local AI is available."""
        now = datetime.utcnow()
        if self.last_ai_check and (now - self.last_ai_check).seconds < 30:
            return self.ai_available
        
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.ollama_url}/api/tags")
                self.ai_available = response.status_code == 200
        except:
            self.ai_available = False
        
        self.last_ai_check = now
        return self.ai_available
    
    async def generate_tactical_assessment(
        self,
        vehicle_id: int,
        physics_state: PhysicsState,
        route_info: Dict[str, Any],
        convoy_info: Dict[str, Any],
        active_threats: List[Dict[str, Any]]
    ) -> TacticalAssessment:
        """
        Generate comprehensive tactical assessment for a vehicle.
        Combines physics data, route info, and AI analysis.
        """
        now = datetime.utcnow()
        
        # Store telemetry for pattern analysis
        if vehicle_id not in self.telemetry_history:
            self.telemetry_history[vehicle_id] = []
        self.telemetry_history[vehicle_id].append(physics_state)
        # Keep last 100 samples
        self.telemetry_history[vehicle_id] = self.telemetry_history[vehicle_id][-100:]
        
        # Calculate threat level
        threat_level = self._calculate_threat_level(physics_state, active_threats)
        
        # Generate predictions
        eta_prediction = self._predict_eta(physics_state, route_info)
        fuel_prediction = self._predict_fuel(physics_state, route_info)
        maintenance_prediction = self._predict_maintenance(physics_state)
        weather_prediction = self._predict_weather_impact(physics_state, route_info)
        
        # Generate recommendations
        recommendations = self._generate_recommendations(
            physics_state, route_info, threat_level,
            eta_prediction, fuel_prediction, maintenance_prediction
        )
        
        # Route conditions analysis
        route_conditions = self._analyze_route_conditions(physics_state, route_info)
        
        # Generate AI summary if available
        ai_summary = await self._generate_ai_summary(
            physics_state, threat_level, recommendations
        )
        
        # Tactical notes
        tactical_notes = self._generate_tactical_notes(
            physics_state, threat_level, active_threats
        )
        
        # Determine overall status
        if threat_level == ThreatLevel.DELTA:
            overall_status = "CRITICAL - IMMEDIATE ACTION REQUIRED"
        elif threat_level == ThreatLevel.CHARLIE:
            overall_status = "HIGH ALERT - TACTICAL ADJUSTMENTS NEEDED"
        elif threat_level == ThreatLevel.BRAVO:
            overall_status = "ELEVATED - INCREASED MONITORING"
        else:
            overall_status = "NOMINAL - MISSION PROCEEDING"
        
        return TacticalAssessment(
            vehicle_id=vehicle_id,
            timestamp=now,
            threat_level=threat_level,
            overall_status=overall_status,
            eta_prediction=eta_prediction,
            fuel_prediction=fuel_prediction,
            maintenance_prediction=maintenance_prediction,
            weather_prediction=weather_prediction,
            active_recommendations=recommendations,
            threats_detected=[t for t in active_threats if t.get("distance_km", 999) < 10],
            route_conditions=route_conditions,
            ai_summary=ai_summary,
            tactical_notes=tactical_notes
        )
    
    def _calculate_threat_level(
        self,
        state: PhysicsState,
        threats: List[Dict[str, Any]]
    ) -> ThreatLevel:
        """Calculate overall threat level from multiple factors."""
        score = 0
        
        # Mechanical threats
        if state.engine_temp_c > self.thresholds["engine_temp_critical"]:
            score += 30
        elif state.engine_temp_c > self.thresholds["engine_temp_warning"]:
            score += 15
        
        # Fuel threats
        fuel_pct = (state.fuel_liters / 300) * 100  # Assuming 300L tank
        if fuel_pct < self.thresholds["fuel_critical_pct"]:
            score += 25
        elif fuel_pct < self.thresholds["fuel_warning_pct"]:
            score += 10
        
        # Tire issues
        for pressure in state.tire_pressures_psi:
            if pressure < self.thresholds["tire_pressure_low"]:
                score += 10
        
        # Brake overheating
        for temp in state.brake_temps_c:
            if temp > self.thresholds["brake_temp_warning"]:
                score += 15
        
        # Crew fatigue
        if state.driver_fatigue_pct > self.thresholds["fatigue_critical_pct"]:
            score += 20
        elif state.driver_fatigue_pct > self.thresholds["fatigue_warning_pct"]:
            score += 10
        
        # Visibility
        if state.visibility_m < self.thresholds["visibility_poor_m"]:
            score += 15
        
        # External threats
        for threat in threats:
            if threat.get("severity") == "CRITICAL":
                score += 40
            elif threat.get("severity") == "WARNING":
                score += 20
        
        # Determine level
        if score >= 60:
            return ThreatLevel.DELTA
        elif score >= 40:
            return ThreatLevel.CHARLIE
        elif score >= 20:
            return ThreatLevel.BRAVO
        else:
            return ThreatLevel.ALPHA
    
    def _predict_eta(
        self,
        state: PhysicsState,
        route_info: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Predict arrival time based on current conditions."""
        remaining_km = route_info.get("remaining_km", 100)
        current_speed = state.velocity_ms * 3.6
        
        # Calculate average speed considering conditions
        # Visibility impact
        visibility_factor = min(1.0, state.visibility_m / 5000)
        # Road friction impact
        friction_factor = state.road_friction_coef
        # Fatigue impact
        fatigue_factor = 1 - (state.driver_fatigue_pct / 200)
        
        effective_speed = current_speed * visibility_factor * friction_factor * fatigue_factor
        effective_speed = max(10, effective_speed)  # Minimum 10 km/h
        
        if effective_speed > 0:
            hours_remaining = remaining_km / effective_speed
        else:
            hours_remaining = 999
        
        eta = datetime.utcnow() + timedelta(hours=hours_remaining)
        
        # Calculate variance based on conditions
        variance_minutes = int(hours_remaining * 60 * 0.1 * (1 / max(0.5, friction_factor)))
        
        return {
            "estimated_arrival": eta.isoformat(),
            "hours_remaining": round(hours_remaining, 2),
            "minutes_remaining": int(hours_remaining * 60),
            "current_speed_kmh": round(current_speed, 1),
            "effective_speed_kmh": round(effective_speed, 1),
            "remaining_km": round(remaining_km, 1),
            "confidence": round(visibility_factor * friction_factor * 100, 1),
            "variance_minutes": variance_minutes,
            "factors": {
                "visibility_impact": round((1 - visibility_factor) * 100, 1),
                "road_condition_impact": round((1 - friction_factor) * 100, 1),
                "fatigue_impact": round((1 - fatigue_factor) * 100, 1)
            }
        }
    
    def _predict_fuel(
        self,
        state: PhysicsState,
        route_info: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Predict fuel status at destination."""
        remaining_km = route_info.get("remaining_km", 100)
        current_fuel = state.fuel_liters
        consumption_kpl = max(0.5, state.fuel_consumption_kpl)
        
        fuel_needed = remaining_km / consumption_kpl
        fuel_at_destination = current_fuel - fuel_needed
        
        # Calculate refuel recommendation
        tank_capacity = 300  # liters
        fuel_pct = (current_fuel / tank_capacity) * 100
        fuel_at_dest_pct = (fuel_at_destination / tank_capacity) * 100
        
        # Next TCP with fuel
        next_fuel_stop_km = route_info.get("next_fuel_stop_km", remaining_km)
        fuel_at_next_stop = current_fuel - (next_fuel_stop_km / consumption_kpl)
        
        status = "ADEQUATE"
        if fuel_at_destination < 0:
            status = "CRITICAL - REFUEL REQUIRED"
        elif fuel_at_dest_pct < 15:
            status = "LOW - RECOMMEND REFUEL"
        elif fuel_at_dest_pct < 25:
            status = "MARGINAL - MONITOR CLOSELY"
        
        return {
            "current_liters": round(current_fuel, 1),
            "current_pct": round(fuel_pct, 1),
            "consumption_rate_kpl": round(consumption_kpl, 2),
            "consumption_rate_lph": round(state.fuel_flow_lph, 2),
            "fuel_needed_liters": round(fuel_needed, 1),
            "fuel_at_destination_liters": round(max(0, fuel_at_destination), 1),
            "fuel_at_destination_pct": round(max(0, fuel_at_dest_pct), 1),
            "range_remaining_km": round(state.range_remaining_km, 0),
            "next_fuel_stop_km": round(next_fuel_stop_km, 1),
            "fuel_at_next_stop_liters": round(max(0, fuel_at_next_stop), 1),
            "status": status,
            "refuel_recommended": fuel_at_dest_pct < 25
        }
    
    def _predict_maintenance(
        self,
        state: PhysicsState
    ) -> Dict[str, Any]:
        """Predict maintenance needs from sensor data."""
        issues = []
        risk_score = 0
        
        # Engine analysis
        if state.engine_temp_c > 100:
            issues.append({
                "system": "ENGINE",
                "issue": "Elevated temperature",
                "severity": "WARNING" if state.engine_temp_c < 105 else "CRITICAL",
                "value": round(state.engine_temp_c, 1),
                "threshold": 100,
                "action": "Reduce load or stop for cooldown"
            })
            risk_score += 30 if state.engine_temp_c > 105 else 15
        
        # Tire analysis
        for i, (pressure, temp, wear) in enumerate(zip(
            state.tire_pressures_psi, state.tire_temps_c, state.tire_wear_pct
        )):
            tire_name = ["FL", "FR", "RL", "RR"][i]
            
            if pressure < 28:
                issues.append({
                    "system": f"TIRE_{tire_name}",
                    "issue": "Low pressure",
                    "severity": "WARNING",
                    "value": round(pressure, 1),
                    "threshold": 28,
                    "action": "Check for puncture, inflate"
                })
                risk_score += 10
            
            if wear > 70:
                issues.append({
                    "system": f"TIRE_{tire_name}",
                    "issue": "High wear",
                    "severity": "WARNING" if wear < 85 else "CRITICAL",
                    "value": round(wear, 1),
                    "threshold": 70,
                    "action": "Schedule tire replacement"
                })
                risk_score += 15 if wear > 85 else 8
        
        # Brake analysis
        for i, (temp, wear) in enumerate(zip(state.brake_temps_c, state.brake_wear_pct)):
            brake_name = ["FL", "FR", "RL", "RR"][i]
            
            if temp > 200:
                issues.append({
                    "system": f"BRAKE_{brake_name}",
                    "issue": "Overheating",
                    "severity": "WARNING" if temp < 250 else "CRITICAL",
                    "value": round(temp, 1),
                    "threshold": 200,
                    "action": "Allow cooldown, check fluid"
                })
                risk_score += 20 if temp > 250 else 10
        
        # Battery analysis
        if state.battery_soc_pct < 30:
            issues.append({
                "system": "ELECTRICAL",
                "issue": "Low battery",
                "severity": "WARNING",
                "value": round(state.battery_soc_pct, 1),
                "threshold": 30,
                "action": "Check alternator, reduce electrical load"
            })
            risk_score += 10
        
        # Transmission temperature
        if state.transmission_temp_c > 100:
            issues.append({
                "system": "TRANSMISSION",
                "issue": "High temperature",
                "severity": "WARNING",
                "value": round(state.transmission_temp_c, 1),
                "threshold": 100,
                "action": "Reduce speed on grades"
            })
            risk_score += 15
        
        # Calculate breakdown probability
        base_probability = 0.001
        risk_multiplier = 1 + (risk_score / 100)
        breakdown_probability = min(0.5, base_probability * risk_multiplier * (1 + state.engine_hours / 500))
        
        # Next service prediction
        km_since_service = state.engine_hours * 40  # Approximate km from hours
        service_interval = 5000
        next_service_km = max(0, service_interval - km_since_service)
        
        return {
            "issues": issues,
            "issue_count": len(issues),
            "risk_score": risk_score,
            "breakdown_probability_pct": round(breakdown_probability * 100, 2),
            "engine_hours": round(state.engine_hours, 2),
            "next_service_km": round(next_service_km, 0),
            "overall_health": "GOOD" if risk_score < 20 else "FAIR" if risk_score < 50 else "POOR",
            "critical_issues": len([i for i in issues if i["severity"] == "CRITICAL"]),
            "warnings": len([i for i in issues if i["severity"] == "WARNING"])
        }
    
    def _predict_weather_impact(
        self,
        state: PhysicsState,
        route_info: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Predict weather impact on operations."""
        # Current conditions
        visibility_km = state.visibility_m / 1000
        precipitation = state.precipitation_mm_hr
        road_friction = state.road_friction_coef
        
        # Speed recommendations based on conditions
        max_safe_speed = 80  # Base
        if visibility_km < 1:
            max_safe_speed = min(max_safe_speed, 30)
        elif visibility_km < 3:
            max_safe_speed = min(max_safe_speed, 50)
        
        if road_friction < 0.5:
            max_safe_speed = min(max_safe_speed, 40)
        elif road_friction < 0.7:
            max_safe_speed = min(max_safe_speed, 60)
        
        # Stopping distance
        current_speed_ms = state.velocity_ms
        # d = v²/(2*μ*g)
        stopping_distance = (current_speed_ms ** 2) / (2 * road_friction * 9.81)
        
        # Following distance recommendation
        reaction_time = 1.5  # seconds
        reaction_distance = current_speed_ms * reaction_time
        safe_following_distance = reaction_distance + stopping_distance * 1.5
        
        return {
            "visibility_km": round(visibility_km, 1),
            "precipitation_mm_hr": round(precipitation, 1),
            "road_friction_coefficient": round(road_friction, 2),
            "road_condition": "DRY" if road_friction > 0.8 else "WET" if road_friction > 0.6 else "SLIPPERY",
            "max_safe_speed_kmh": round(max_safe_speed, 0),
            "current_speed_kmh": round(state.velocity_ms * 3.6, 1),
            "speed_advisory": "REDUCE" if state.velocity_ms * 3.6 > max_safe_speed else "OK",
            "stopping_distance_m": round(stopping_distance, 1),
            "safe_following_distance_m": round(safe_following_distance, 1),
            "ambient_temp_c": round(state.ambient_temp_c, 1),
            "ice_risk": state.ambient_temp_c < 3 and road_friction < 0.7,
            "operational_impact": "MINIMAL" if road_friction > 0.8 and visibility_km > 5 else 
                                 "MODERATE" if road_friction > 0.6 and visibility_km > 2 else "SEVERE"
        }
    
    def _generate_recommendations(
        self,
        state: PhysicsState,
        route_info: Dict[str, Any],
        threat_level: ThreatLevel,
        eta_pred: Dict[str, Any],
        fuel_pred: Dict[str, Any],
        maint_pred: Dict[str, Any]
    ) -> List[TacticalRecommendation]:
        """Generate tactical recommendations based on all analysis."""
        recommendations = []
        now = datetime.utcnow()
        
        # Speed recommendations
        current_speed = state.velocity_ms * 3.6
        if state.visibility_m < 1000:
            recommendations.append(TacticalRecommendation(
                recommendation_id=f"REC-SPD-{now.strftime('%H%M%S')}",
                recommendation_type=RecommendationType.SPEED,
                priority=2,
                action=f"Reduce speed to {min(40, current_speed):.0f} km/h",
                reasoning=f"Visibility reduced to {state.visibility_m:.0f}m",
                expected_benefit="Improved safety margin, better reaction time",
                risk_if_ignored="Collision risk, inability to respond to obstacles",
                confidence=0.9,
                expires_at=now + timedelta(minutes=15)
            ))
        
        # Fuel recommendations
        if fuel_pred["refuel_recommended"]:
            priority = 1 if fuel_pred["status"] == "CRITICAL - REFUEL REQUIRED" else 3
            recommendations.append(TacticalRecommendation(
                recommendation_id=f"REC-FUEL-{now.strftime('%H%M%S')}",
                recommendation_type=RecommendationType.FUEL,
                priority=priority,
                action="Proceed to nearest refueling point",
                reasoning=f"Fuel at {fuel_pred['current_pct']:.1f}%, estimated {fuel_pred['fuel_at_destination_pct']:.1f}% at destination",
                expected_benefit="Mission continuity assured",
                risk_if_ignored="Mission failure due to fuel exhaustion",
                confidence=0.95,
                expires_at=now + timedelta(hours=1)
            ))
        
        # Maintenance recommendations
        if maint_pred["critical_issues"] > 0:
            recommendations.append(TacticalRecommendation(
                recommendation_id=f"REC-MAINT-{now.strftime('%H%M%S')}",
                recommendation_type=RecommendationType.MAINTENANCE,
                priority=1,
                action="IMMEDIATE HALT - Critical maintenance required",
                reasoning=f"{maint_pred['critical_issues']} critical issue(s) detected",
                expected_benefit="Prevent catastrophic failure",
                risk_if_ignored="Vehicle breakdown, mission failure, crew safety risk",
                confidence=0.95,
                expires_at=now + timedelta(minutes=5)
            ))
        elif maint_pred["warnings"] > 0:
            recommendations.append(TacticalRecommendation(
                recommendation_id=f"REC-MAINT-{now.strftime('%H%M%S')}",
                recommendation_type=RecommendationType.MAINTENANCE,
                priority=3,
                action="Schedule maintenance check at next TCP",
                reasoning=f"{maint_pred['warnings']} warning(s) detected",
                expected_benefit="Prevent escalation to critical failure",
                risk_if_ignored="Issue may escalate during mission",
                confidence=0.85,
                expires_at=now + timedelta(hours=2)
            ))
        
        # Crew fatigue recommendations
        if state.driver_fatigue_pct > 60:
            priority = 1 if state.driver_fatigue_pct > 80 else 2
            recommendations.append(TacticalRecommendation(
                recommendation_id=f"REC-CREW-{now.strftime('%H%M%S')}",
                recommendation_type=RecommendationType.CREW,
                priority=priority,
                action="Driver rotation or rest stop required",
                reasoning=f"Driver fatigue at {state.driver_fatigue_pct:.0f}%",
                expected_benefit="Maintained alertness, reduced accident risk",
                risk_if_ignored="Increased accident probability, mission safety compromised",
                confidence=0.9,
                expires_at=now + timedelta(minutes=30)
            ))
        
        # Tactical recommendations for threat levels
        if threat_level in [ThreatLevel.CHARLIE, ThreatLevel.DELTA]:
            recommendations.append(TacticalRecommendation(
                recommendation_id=f"REC-TAC-{now.strftime('%H%M%S')}",
                recommendation_type=RecommendationType.TACTICAL,
                priority=1 if threat_level == ThreatLevel.DELTA else 2,
                action="Increase interval, activate defensive measures",
                reasoning=f"Threat level {threat_level.value} - elevated risk",
                expected_benefit="Reduced convoy vulnerability",
                risk_if_ignored="Entire convoy exposed to threats",
                confidence=0.85,
                expires_at=now + timedelta(minutes=10)
            ))
        
        # Sort by priority
        recommendations.sort(key=lambda r: r.priority)
        
        return recommendations
    
    def _analyze_route_conditions(
        self,
        state: PhysicsState,
        route_info: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Analyze current route conditions."""
        return {
            "current_terrain": route_info.get("terrain", "UNKNOWN"),
            "gradient_deg": round(state.gradient_deg, 1),
            "altitude_m": round(state.altitude_m, 0),
            "road_surface": "GOOD" if state.road_friction_coef > 0.7 else "FAIR" if state.road_friction_coef > 0.5 else "POOR",
            "road_friction": round(state.road_friction_coef, 2),
            "segment_progress_pct": route_info.get("segment_progress_pct", 0),
            "remaining_km": route_info.get("remaining_km", 0),
            "next_waypoint_km": route_info.get("next_waypoint_km", 0),
            "next_tcp": route_info.get("next_tcp", None),
            "restricted_zones_ahead": route_info.get("restricted_zones", []),
            "elevation_change_ahead_m": route_info.get("elevation_change", 0)
        }
    
    def _generate_tactical_notes(
        self,
        state: PhysicsState,
        threat_level: ThreatLevel,
        threats: List[Dict[str, Any]]
    ) -> List[str]:
        """Generate tactical situation notes."""
        notes = []
        
        # Status based on threat level
        if threat_level == ThreatLevel.ALPHA:
            notes.append("✓ All systems nominal - mission proceeding as planned")
        elif threat_level == ThreatLevel.BRAVO:
            notes.append("⚡ Elevated alert - increased situational awareness required")
        elif threat_level == ThreatLevel.CHARLIE:
            notes.append("⚠️ High alert - tactical adjustments in effect")
        else:
            notes.append("🔴 CRITICAL ALERT - Immediate action required")
        
        # Environmental notes
        if state.visibility_m < 1000:
            notes.append(f"📡 Limited visibility: {state.visibility_m:.0f}m - NVG recommended")
        
        if state.ambient_temp_c < 0:
            notes.append(f"❄️ Sub-zero conditions: {state.ambient_temp_c:.1f}°C - Ice risk on route")
        elif state.ambient_temp_c > 40:
            notes.append(f"🌡️ Extreme heat: {state.ambient_temp_c:.1f}°C - Monitor engine temps")
        
        # Signature notes
        if state.thermal_signature > 0.8:
            notes.append("🔥 High thermal signature - vulnerable to IR detection")
        
        if state.acoustic_signature_db > 90:
            notes.append("🔊 Elevated noise level - reduce speed in sensitive areas")
        
        # Threat notes
        for threat in threats:
            if threat.get("distance_km", 999) < 5:
                notes.append(f"⚠️ {threat.get('type', 'Unknown')} threat {threat.get('distance_km', 0):.1f}km ahead")
        
        return notes
    
    async def _generate_ai_summary(
        self,
        state: PhysicsState,
        threat_level: ThreatLevel,
        recommendations: List[TacticalRecommendation]
    ) -> str:
        """Generate AI summary using local model or fallback."""
        # Check if AI is available
        ai_available = await self.check_ai_availability()
        
        if ai_available:
            try:
                return await self._call_janus_for_summary(state, threat_level, recommendations)
            except Exception as e:
                print(f"AI summary generation failed: {e}")
        
        # Fallback to heuristic summary
        return self._generate_heuristic_summary(state, threat_level, recommendations)
    
    async def _call_janus_for_summary(
        self,
        state: PhysicsState,
        threat_level: ThreatLevel,
        recommendations: List[TacticalRecommendation]
    ) -> str:
        """Call Janus AI for tactical summary."""
        prompt = f"""TACTICAL SITUATION BRIEF - Generate concise military-style assessment.

Vehicle Status:
- Speed: {state.velocity_ms * 3.6:.1f} km/h
- Fuel: {state.fuel_liters:.0f}L ({(state.fuel_liters/300)*100:.0f}%)
- Engine: {state.engine_temp_c:.0f}°C, {state.engine_rpm} RPM
- Visibility: {state.visibility_m:.0f}m
- Road Friction: {state.road_friction_coef:.2f}

Threat Level: {threat_level.value}
Active Recommendations: {len(recommendations)}
Priority 1 Actions: {len([r for r in recommendations if r.priority == 1])}

Generate 2-3 sentence tactical assessment in military brevity format."""

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.ollama_url}/api/generate",
                    json={
                        "model": self.model_name,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.3,
                            "num_predict": 100
                        }
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return result.get("response", self._generate_heuristic_summary(state, threat_level, recommendations))
        except Exception as e:
            print(f"Janus AI call failed: {e}")
        
        return self._generate_heuristic_summary(state, threat_level, recommendations)
    
    def _generate_heuristic_summary(
        self,
        state: PhysicsState,
        threat_level: ThreatLevel,
        recommendations: List[TacticalRecommendation]
    ) -> str:
        """Generate summary using heuristics when AI is unavailable."""
        speed_kmh = state.velocity_ms * 3.6
        fuel_pct = (state.fuel_liters / 300) * 100
        
        status_map = {
            ThreatLevel.ALPHA: "GUARDIAN: Mission nominal",
            ThreatLevel.BRAVO: "GUARDIAN: Elevated monitoring active",
            ThreatLevel.CHARLIE: "GUARDIAN: High alert status",
            ThreatLevel.DELTA: "GUARDIAN: CRITICAL - Action required"
        }
        
        summary = f"{status_map[threat_level]}. "
        
        if speed_kmh < 10:
            summary += "Vehicle stationary. "
        else:
            summary += f"Moving at {speed_kmh:.0f} km/h. "
        
        if fuel_pct < 25:
            summary += f"Low fuel ({fuel_pct:.0f}%). "
        
        priority_1 = len([r for r in recommendations if r.priority == 1])
        if priority_1 > 0:
            summary += f"{priority_1} priority action(s) required."
        else:
            summary += "No immediate actions required."
        
        return summary
    
    def to_dict(self, assessment: TacticalAssessment) -> Dict[str, Any]:
        """Convert assessment to dictionary for API response."""
        return {
            "vehicle_id": assessment.vehicle_id,
            "timestamp": assessment.timestamp.isoformat(),
            "threat_level": assessment.threat_level.value,
            "overall_status": assessment.overall_status,
            "eta_prediction": assessment.eta_prediction,
            "fuel_prediction": assessment.fuel_prediction,
            "maintenance_prediction": assessment.maintenance_prediction,
            "weather_prediction": assessment.weather_prediction,
            "recommendations": [
                {
                    "id": r.recommendation_id,
                    "type": r.recommendation_type.value,
                    "priority": r.priority,
                    "action": r.action,
                    "reasoning": r.reasoning,
                    "expected_benefit": r.expected_benefit,
                    "risk_if_ignored": r.risk_if_ignored,
                    "confidence": r.confidence,
                    "expires_at": r.expires_at.isoformat()
                }
                for r in assessment.active_recommendations
            ],
            "threats_detected": assessment.threats_detected,
            "route_conditions": assessment.route_conditions,
            "ai_summary": assessment.ai_summary,
            "tactical_notes": assessment.tactical_notes
        }


# Global instance
tactical_intelligence = TacticalIntelligenceEngine()
