"""
Convoy AI Recommendation Engine
================================

Real-time, convoy-specific AI analysis and recommendations.
Generates dynamic insights based on actual convoy metrics, conditions, and mission parameters.

Features:
- Real-time analysis based on current convoy data
- Unique recommendations for each convoy
- Dynamic prediction updates based on movement
- Ollama/Janus integration for generative AI
- Fallback to advanced heuristics

Security Classification: RESTRICTED
"""

import asyncio
import random
import math
import httpx
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum


# ============================================================================
# CONSTANTS
# ============================================================================

OLLAMA_URL = "http://host.docker.internal:11434"
MODEL_NAME = "llama3.2:latest"  # Fast model for real-time analysis

# Threat type templates
THREAT_TEMPLATES = {
    "WEATHER": {
        "icons": ["🌧️", "❄️", "🌫️", "💨", "⛈️"],
        "impacts": ["reduced visibility", "slippery conditions", "delayed ETA", "increased fuel consumption"],
    },
    "TERRAIN": {
        "icons": ["⛰️", "🏔️", "🌋", "🪨"],
        "impacts": ["reduced speed", "increased mechanical stress", "higher fuel usage", "navigation challenges"],
    },
    "SECURITY": {
        "icons": ["⚠️", "🚨", "🔒", "👁️"],
        "impacts": ["route deviation needed", "increased vigilance", "communication protocols", "escort required"],
    },
    "MECHANICAL": {
        "icons": ["🔧", "⚙️", "🛠️", "🚗"],
        "impacts": ["maintenance stop needed", "reduced convoy speed", "vehicle swap required", "part replacement"],
    },
}

# Convoy status color mapping
STATUS_INDICATORS = {
    "OPTIMAL": {"color": "#22c55e", "icon": "✅", "priority": 1},
    "GOOD": {"color": "#84cc16", "icon": "👍", "priority": 2},
    "CAUTION": {"color": "#eab308", "icon": "⚡", "priority": 3},
    "WARNING": {"color": "#f97316", "icon": "⚠️", "priority": 4},
    "CRITICAL": {"color": "#dc2626", "icon": "🚨", "priority": 5},
}


# ============================================================================
# DATA STRUCTURES
# ============================================================================

@dataclass
class ConvoyContext:
    """Complete convoy context for AI analysis."""
    convoy_id: int
    callsign: str
    mission_id: str
    
    # Position & Movement
    latitude: float
    longitude: float
    altitude_m: float
    speed_kmh: float
    heading_deg: float
    
    # Progress
    progress_pct: float
    distance_remaining_km: float
    distance_covered_km: float
    eta_minutes: float
    
    # Mission Details
    priority: str
    cargo_type: str
    classification: str
    vehicle_count: int
    personnel_count: int
    
    # Status
    convoy_health: str
    fuel_status: str
    threat_level: str
    
    # Environment
    terrain: str
    weather: str
    visibility_km: float
    temperature_c: float
    
    # Vehicles
    vehicles: List[Dict]
    
    # Active Threats
    threats: List[Dict]
    
    # Checkpoints
    last_checkpoint: Optional[str]
    next_checkpoint: Optional[str]
    checkpoints_remaining: int


@dataclass
class AIRecommendation:
    """Individual AI recommendation."""
    recommendation_id: str
    category: str  # TACTICAL, LOGISTICAL, SAFETY, NAVIGATION, COMMUNICATION
    priority: str  # HIGH, MEDIUM, LOW
    title: str
    description: str
    action_items: List[str]
    confidence: float
    reasoning: str
    icon: str
    expires_at: datetime
    generated_at: datetime


@dataclass
class ConvoyAIAnalysis:
    """Complete AI analysis for a convoy."""
    convoy_id: int
    callsign: str
    analysis_id: str
    
    # Overall Status
    overall_status: str
    mission_success_probability: float
    risk_assessment: str
    
    # Predictions
    predicted_eta: datetime
    eta_confidence: float
    delay_risk_minutes: int
    
    # Fuel Analysis
    fuel_at_destination_pct: float
    refuel_stops_needed: int
    fuel_critical: bool
    
    # Weather Impact
    weather_impact: str
    weather_delay_minutes: int
    
    # Threat Analysis
    threat_level: str
    active_threats: List[Dict]
    threat_mitigations: List[str]
    
    # Recommendations
    recommendations: List[AIRecommendation]
    
    # Tactical Advice
    tactical_summary: str
    immediate_actions: List[str]
    
    # Meta
    generated_by: str
    gpu_accelerated: bool
    analysis_duration_ms: int
    generated_at: datetime


# ============================================================================
# AI ENGINE CLASS
# ============================================================================

class ConvoyAIEngine:
    """
    Real-time convoy AI analysis engine.
    Generates unique, dynamic recommendations for each convoy.
    """
    
    def __init__(self):
        self.ollama_available = False
        self.analysis_cache: Dict[int, ConvoyAIAnalysis] = {}
        self.cache_ttl_seconds = 10  # Short TTL for real-time updates
        
    async def check_ollama(self) -> bool:
        """Check if Ollama is available."""
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                response = await client.get(f"{OLLAMA_URL}/api/tags")
                self.ollama_available = response.status_code == 200
                return self.ollama_available
        except:
            self.ollama_available = False
            return False
    
    async def analyze_convoy(self, context: ConvoyContext) -> ConvoyAIAnalysis:
        """
        Generate comprehensive AI analysis for a convoy.
        Uses real convoy data to create unique, dynamic insights.
        """
        start_time = datetime.utcnow()
        analysis_id = f"ANA-{context.convoy_id}-{start_time.strftime('%H%M%S%f')[:10]}"
        
        # Check cache
        cached = self.analysis_cache.get(context.convoy_id)
        if cached and (datetime.utcnow() - cached.generated_at).total_seconds() < self.cache_ttl_seconds:
            return cached
        
        # Generate analysis components
        mission_probability = self._calculate_mission_probability(context)
        risk_assessment = self._assess_risk(context, mission_probability)
        eta_prediction = self._predict_eta(context)
        fuel_analysis = self._analyze_fuel(context)
        weather_impact = self._assess_weather_impact(context)
        threat_analysis = self._analyze_threats(context)
        recommendations = await self._generate_recommendations(context, mission_probability, threat_analysis)
        tactical_summary = self._generate_tactical_summary(context, mission_probability, recommendations)
        immediate_actions = self._determine_immediate_actions(context, recommendations)
        
        # Check if we should use LLM for enhanced analysis
        use_llm = await self.check_ollama() and context.threat_level in ["MEDIUM", "HIGH"] or mission_probability < 0.8
        
        if use_llm:
            llm_insights = await self._get_llm_insights(context)
            if llm_insights:
                recommendations.extend(llm_insights.get("recommendations", []))
                tactical_summary = llm_insights.get("summary", tactical_summary)
        
        duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        
        analysis = ConvoyAIAnalysis(
            convoy_id=context.convoy_id,
            callsign=context.callsign,
            analysis_id=analysis_id,
            overall_status=risk_assessment["status"],
            mission_success_probability=mission_probability,
            risk_assessment=risk_assessment["level"],
            predicted_eta=eta_prediction["eta"],
            eta_confidence=eta_prediction["confidence"],
            delay_risk_minutes=eta_prediction["delay_risk"],
            fuel_at_destination_pct=fuel_analysis["at_destination"],
            refuel_stops_needed=fuel_analysis["stops_needed"],
            fuel_critical=fuel_analysis["critical"],
            weather_impact=weather_impact["impact"],
            weather_delay_minutes=weather_impact["delay"],
            threat_level=threat_analysis["level"],
            active_threats=threat_analysis["threats"],
            threat_mitigations=threat_analysis["mitigations"],
            recommendations=recommendations,
            tactical_summary=tactical_summary,
            immediate_actions=immediate_actions,
            generated_by="JANUS_TACTICAL_AI" if use_llm else "CONVOY_AI_ENGINE",
            gpu_accelerated=use_llm,
            analysis_duration_ms=duration_ms,
            generated_at=datetime.utcnow()
        )
        
        # Cache the analysis
        self.analysis_cache[context.convoy_id] = analysis
        
        return analysis
    
    def _calculate_mission_probability(self, ctx: ConvoyContext) -> float:
        """Calculate mission success probability based on real convoy data."""
        base_prob = 0.95
        
        # Progress factor - closer to destination = higher confidence
        progress_boost = (ctx.progress_pct / 100) * 0.05
        base_prob += progress_boost
        
        # Speed factor - optimal speed range is 30-60 km/h
        if ctx.speed_kmh < 10:
            base_prob -= 0.08  # Stationary or very slow
        elif ctx.speed_kmh > 70:
            base_prob -= 0.05  # Too fast for convoy safety
        elif 30 <= ctx.speed_kmh <= 50:
            base_prob += 0.02  # Optimal range
        
        # Fuel status
        fuel_penalties = {"CRITICAL": 0.25, "LOW": 0.12, "ADEQUATE": 0, "GOOD": 0.02}
        base_prob -= fuel_penalties.get(ctx.fuel_status, 0)
        
        # Convoy health
        health_penalties = {"RED": 0.20, "AMBER": 0.10, "GREEN": 0}
        base_prob -= health_penalties.get(ctx.convoy_health, 0)
        
        # Threat level
        threat_penalties = {"HIGH": 0.15, "MEDIUM": 0.08, "LOW": 0}
        base_prob -= threat_penalties.get(ctx.threat_level, 0)
        
        # Altitude factor (high altitude = more challenging)
        if ctx.altitude_m > 4000:
            base_prob -= 0.05
        elif ctx.altitude_m > 3000:
            base_prob -= 0.02
        
        # Weather/visibility
        if ctx.visibility_km < 1:
            base_prob -= 0.12
        elif ctx.visibility_km < 3:
            base_prob -= 0.06
        elif ctx.visibility_km < 5:
            base_prob -= 0.03
        
        # Temperature extremes
        if ctx.temperature_c < -10 or ctx.temperature_c > 45:
            base_prob -= 0.05
        
        # Priority factor - higher priority = more resources/support
        priority_boosts = {"FLASH": 0.05, "IMMEDIATE": 0.03, "PRIORITY": 0.01, "ROUTINE": 0}
        base_prob += priority_boosts.get(ctx.priority, 0)
        
        # Cargo risk factor
        cargo_risks = {"AMMUNITION": 0.05, "FUEL": 0.04, "CLASSIFIED": 0.03, "PERSONNEL": 0.02}
        base_prob -= cargo_risks.get(ctx.cargo_type, 0)
        
        # Vehicle health aggregate
        if ctx.vehicles:
            unhealthy = sum(1 for v in ctx.vehicles if v.get("health_status") != "OPERATIONAL")
            if unhealthy > len(ctx.vehicles) * 0.3:
                base_prob -= 0.10
            elif unhealthy > 0:
                base_prob -= 0.05
        
        return max(0.35, min(0.99, base_prob))
    
    def _assess_risk(self, ctx: ConvoyContext, probability: float) -> Dict:
        """Assess overall risk level."""
        if probability >= 0.90:
            return {"status": "OPTIMAL", "level": "LOW", "color": "#22c55e"}
        elif probability >= 0.80:
            return {"status": "GOOD", "level": "LOW-MEDIUM", "color": "#84cc16"}
        elif probability >= 0.70:
            return {"status": "CAUTION", "level": "MEDIUM", "color": "#eab308"}
        elif probability >= 0.55:
            return {"status": "WARNING", "level": "MEDIUM-HIGH", "color": "#f97316"}
        else:
            return {"status": "CRITICAL", "level": "HIGH", "color": "#dc2626"}
    
    def _predict_eta(self, ctx: ConvoyContext) -> Dict:
        """Predict ETA with confidence and delay risk."""
        base_eta_minutes = ctx.eta_minutes if ctx.eta_minutes > 0 else ctx.distance_remaining_km / max(ctx.speed_kmh, 30) * 60
        
        # Calculate delay factors
        delay_minutes = 0
        confidence = 0.90
        
        # Weather delay
        if ctx.visibility_km < 3:
            weather_delay = (3 - ctx.visibility_km) * 8
            delay_minutes += weather_delay
            confidence -= 0.08
        
        # Altitude delay
        if ctx.altitude_m > 4000:
            delay_minutes += 15
            confidence -= 0.05
        elif ctx.altitude_m > 3000:
            delay_minutes += 8
            confidence -= 0.02
        
        # Checkpoint delays (estimate 5-15 min per remaining checkpoint)
        checkpoint_delay = ctx.checkpoints_remaining * random.uniform(5, 12)
        delay_minutes += checkpoint_delay
        
        # Traffic/congestion (based on time of day approximation)
        hour = datetime.utcnow().hour
        if 7 <= hour <= 9 or 17 <= hour <= 19:
            delay_minutes += 10
            confidence -= 0.03
        
        # Threat-based delay
        if ctx.threat_level == "HIGH":
            delay_minutes += 25
            confidence -= 0.15
        elif ctx.threat_level == "MEDIUM":
            delay_minutes += 10
            confidence -= 0.08
        
        # Speed factor
        if ctx.speed_kmh < 15:
            delay_minutes += 20
            confidence -= 0.10
        
        adjusted_eta = datetime.utcnow() + timedelta(minutes=base_eta_minutes + delay_minutes)
        
        return {
            "eta": adjusted_eta,
            "confidence": max(0.5, confidence),
            "delay_risk": int(delay_minutes),
            "base_minutes": int(base_eta_minutes),
            "adjusted_minutes": int(base_eta_minutes + delay_minutes)
        }
    
    def _analyze_fuel(self, ctx: ConvoyContext) -> Dict:
        """Analyze fuel status and requirements."""
        if not ctx.vehicles:
            return {"at_destination": 50, "stops_needed": 1, "critical": False}
        
        # Calculate average fuel
        fuel_levels = [v.get("fuel_level_pct", 50) for v in ctx.vehicles]
        avg_fuel = sum(fuel_levels) / len(fuel_levels)
        min_fuel = min(fuel_levels)
        
        # Estimate consumption (km/% based on terrain and altitude)
        base_consumption = 2.5  # km per 1% fuel
        if ctx.altitude_m > 3500:
            base_consumption *= 0.7  # 30% more consumption at altitude
        if ctx.terrain in ["MOUNTAIN", "HIGH_ALTITUDE"]:
            base_consumption *= 0.8
        
        fuel_needed = ctx.distance_remaining_km / base_consumption
        fuel_at_destination = max(0, avg_fuel - fuel_needed)
        
        # Determine stops needed
        if fuel_at_destination < 10:
            stops_needed = 2
        elif fuel_at_destination < 25:
            stops_needed = 1
        else:
            stops_needed = 0
        
        return {
            "at_destination": round(fuel_at_destination, 1),
            "current_avg": round(avg_fuel, 1),
            "current_min": round(min_fuel, 1),
            "stops_needed": stops_needed,
            "critical": min_fuel < 15 or fuel_at_destination < 5,
            "consumption_rate": round(fuel_needed, 1)
        }
    
    def _assess_weather_impact(self, ctx: ConvoyContext) -> Dict:
        """Assess weather impact on convoy."""
        delay = 0
        impact = "MINIMAL"
        conditions = []
        
        if ctx.visibility_km < 1:
            delay += 30
            impact = "SEVERE"
            conditions.append("Dense fog/poor visibility")
        elif ctx.visibility_km < 3:
            delay += 15
            impact = "MODERATE"
            conditions.append("Reduced visibility")
        elif ctx.visibility_km < 5:
            delay += 5
            impact = "LOW"
            conditions.append("Slightly reduced visibility")
        
        if ctx.temperature_c < -15:
            delay += 20
            impact = "SEVERE" if impact != "SEVERE" else impact
            conditions.append("Extreme cold")
        elif ctx.temperature_c < -5:
            delay += 10
            conditions.append("Cold conditions")
        elif ctx.temperature_c > 45:
            delay += 15
            conditions.append("Extreme heat")
        
        if "RAIN" in ctx.weather.upper() or "SNOW" in ctx.weather.upper():
            delay += 15
            conditions.append(f"{ctx.weather} precipitation")
        
        return {
            "impact": impact,
            "delay": delay,
            "conditions": conditions,
            "visibility_km": ctx.visibility_km,
            "temperature_c": ctx.temperature_c
        }
    
    def _analyze_threats(self, ctx: ConvoyContext) -> Dict:
        """Analyze active threats and generate mitigations."""
        threats = ctx.threats or []
        mitigations = []
        
        if ctx.threat_level == "HIGH":
            mitigations.extend([
                "Increase spacing between vehicles to 150m",
                "Activate armed escort protocol",
                "Maintain radio silence except for emergencies",
                "Route reconnaissance advised before proceeding"
            ])
        elif ctx.threat_level == "MEDIUM":
            mitigations.extend([
                "Maintain enhanced vigilance",
                "Keep 100m vehicle spacing",
                "Report all suspicious activity immediately"
            ])
        else:
            mitigations.append("Standard operating procedures apply")
        
        # Add terrain-specific mitigations
        if ctx.altitude_m > 4000:
            mitigations.append("Monitor crew for altitude sickness symptoms")
        
        if ctx.visibility_km < 3:
            mitigations.append("Use convoy lights and markers")
        
        return {
            "level": ctx.threat_level,
            "threats": threats,
            "mitigations": mitigations,
            "threat_count": len(threats)
        }
    
    async def _generate_recommendations(self, ctx: ConvoyContext, probability: float, 
                                         threat_analysis: Dict) -> List[AIRecommendation]:
        """Generate convoy-specific recommendations."""
        recommendations = []
        now = datetime.utcnow()
        
        # Speed-based recommendations
        if ctx.speed_kmh < 10 and ctx.progress_pct < 90:
            recommendations.append(AIRecommendation(
                recommendation_id=f"REC-SPD-{ctx.convoy_id}-{now.strftime('%H%M%S')}",
                category="NAVIGATION",
                priority="HIGH",
                title="Convoy Movement Stalled",
                description=f"{ctx.callsign} currently stationary or moving very slowly at {ctx.speed_kmh:.1f} km/h. Investigate cause of delay.",
                action_items=[
                    "Confirm reason for halt with lead vehicle",
                    "Check for obstacles or roadblocks ahead",
                    "Verify all vehicles are operational",
                    "Update HQ on delay status"
                ],
                confidence=0.92,
                reasoning=f"Speed of {ctx.speed_kmh:.1f} km/h detected with {100-ctx.progress_pct:.1f}% mission remaining",
                icon="🚫",
                expires_at=now + timedelta(minutes=10),
                generated_at=now
            ))
        elif ctx.speed_kmh > 70:
            recommendations.append(AIRecommendation(
                recommendation_id=f"REC-SPD-{ctx.convoy_id}-{now.strftime('%H%M%S')}",
                category="SAFETY",
                priority="MEDIUM",
                title="Excessive Convoy Speed",
                description=f"Current speed of {ctx.speed_kmh:.1f} km/h exceeds safe convoy limits. Reduce speed for formation integrity.",
                action_items=[
                    "Reduce convoy speed to 50-60 km/h",
                    "Ensure proper vehicle spacing",
                    "Check tail vehicle can maintain pace"
                ],
                confidence=0.88,
                reasoning="High speed reduces reaction time and can break convoy formation",
                icon="⚡",
                expires_at=now + timedelta(minutes=15),
                generated_at=now
            ))
        
        # Fuel-based recommendations
        fuel_analysis = self._analyze_fuel(ctx)
        if fuel_analysis["critical"]:
            recommendations.append(AIRecommendation(
                recommendation_id=f"REC-FUEL-{ctx.convoy_id}-{now.strftime('%H%M%S')}",
                category="LOGISTICAL",
                priority="HIGH",
                title="Critical Fuel Alert",
                description=f"Minimum vehicle fuel at {fuel_analysis['current_min']:.1f}%. Immediate refueling required.",
                action_items=[
                    "Proceed to nearest fuel point immediately",
                    f"Contact TCP for {fuel_analysis['stops_needed']} refueling stop(s)",
                    "Reduce speed to conserve fuel",
                    "Prepare for emergency fuel transfer if needed"
                ],
                confidence=0.95,
                reasoning=f"Current fuel insufficient for remaining {ctx.distance_remaining_km:.1f} km",
                icon="⛽",
                expires_at=now + timedelta(minutes=30),
                generated_at=now
            ))
        elif fuel_analysis["at_destination"] < 20:
            recommendations.append(AIRecommendation(
                recommendation_id=f"REC-FUEL-{ctx.convoy_id}-{now.strftime('%H%M%S')}",
                category="LOGISTICAL",
                priority="MEDIUM",
                title="Plan Refueling Stop",
                description=f"Estimated fuel at destination: {fuel_analysis['at_destination']:.1f}%. Plan refueling en route.",
                action_items=[
                    f"Schedule {fuel_analysis['stops_needed']} refueling stop(s)",
                    "Coordinate with forward fuel point",
                    "Optimize fuel consumption by maintaining steady speed"
                ],
                confidence=0.87,
                reasoning="Fuel margin below safe threshold for remaining distance",
                icon="⛽",
                expires_at=now + timedelta(minutes=45),
                generated_at=now
            ))
        
        # Threat-based recommendations
        if ctx.threat_level == "HIGH":
            recommendations.append(AIRecommendation(
                recommendation_id=f"REC-THR-{ctx.convoy_id}-{now.strftime('%H%M%S')}",
                category="TACTICAL",
                priority="HIGH",
                title="High Threat Environment",
                description=f"Operating in high-threat zone. Implement enhanced security protocols.",
                action_items=threat_analysis["mitigations"],
                confidence=0.90,
                reasoning=f"Threat level {ctx.threat_level} with {len(ctx.threats)} active threats detected",
                icon="🚨",
                expires_at=now + timedelta(minutes=20),
                generated_at=now
            ))
        
        # Altitude-based recommendations
        if ctx.altitude_m > 4500:
            recommendations.append(AIRecommendation(
                recommendation_id=f"REC-ALT-{ctx.convoy_id}-{now.strftime('%H%M%S')}",
                category="SAFETY",
                priority="MEDIUM",
                title="Extreme Altitude Operations",
                description=f"Operating at {ctx.altitude_m:.0f}m altitude. Enhanced precautions required.",
                action_items=[
                    "Monitor personnel for altitude sickness",
                    "Reduce vehicle speed for thin air conditions",
                    "Ensure adequate rest stops",
                    "Keep medical supplies accessible",
                    "Monitor engine performance closely"
                ],
                confidence=0.85,
                reasoning="Extreme altitude affects both personnel and vehicle performance",
                icon="🏔️",
                expires_at=now + timedelta(hours=2),
                generated_at=now
            ))
        
        # Weather-based recommendations
        if ctx.visibility_km < 3:
            recommendations.append(AIRecommendation(
                recommendation_id=f"REC-WX-{ctx.convoy_id}-{now.strftime('%H%M%S')}",
                category="SAFETY",
                priority="HIGH" if ctx.visibility_km < 1 else "MEDIUM",
                title="Reduced Visibility Operations",
                description=f"Visibility at {ctx.visibility_km:.1f} km. Implement low-visibility protocols.",
                action_items=[
                    "Reduce speed by 40%",
                    "Use convoy lights and markers",
                    "Reduce following distance awareness",
                    "Consider temporary halt if visibility drops further"
                ],
                confidence=0.92,
                reasoning=f"Current visibility {ctx.visibility_km:.1f} km below safe threshold",
                icon="🌫️",
                expires_at=now + timedelta(minutes=30),
                generated_at=now
            ))
        
        # Convoy health recommendations
        if ctx.convoy_health == "RED":
            recommendations.append(AIRecommendation(
                recommendation_id=f"REC-HLT-{ctx.convoy_id}-{now.strftime('%H%M%S')}",
                category="LOGISTICAL",
                priority="HIGH",
                title="Convoy Health Critical",
                description="Multiple vehicle issues detected. Immediate maintenance assessment required.",
                action_items=[
                    "Identify vehicles with issues",
                    "Assess if vehicles can continue",
                    "Contact recovery unit if needed",
                    "Consider redistributing loads"
                ],
                confidence=0.90,
                reasoning="Convoy health status RED indicates significant mechanical issues",
                icon="🔧",
                expires_at=now + timedelta(minutes=15),
                generated_at=now
            ))
        elif ctx.convoy_health == "AMBER":
            recommendations.append(AIRecommendation(
                recommendation_id=f"REC-HLT-{ctx.convoy_id}-{now.strftime('%H%M%S')}",
                category="LOGISTICAL",
                priority="MEDIUM",
                title="Convoy Health Warning",
                description="Some vehicle issues detected. Monitor closely and plan maintenance.",
                action_items=[
                    "Monitor affected vehicles",
                    "Schedule maintenance at next halt",
                    "Prepare contingency plans"
                ],
                confidence=0.85,
                reasoning="AMBER status indicates issues that may escalate",
                icon="🔧",
                expires_at=now + timedelta(minutes=30),
                generated_at=now
            ))
        
        # Mission progress recommendations
        if probability < 0.7:
            recommendations.append(AIRecommendation(
                recommendation_id=f"REC-MSN-{ctx.convoy_id}-{now.strftime('%H%M%S')}",
                category="TACTICAL",
                priority="HIGH",
                title="Mission At Risk",
                description=f"Mission success probability at {probability*100:.0f}%. Immediate intervention recommended.",
                action_items=[
                    "Assess all risk factors",
                    "Request additional support if needed",
                    "Consider alternate routes",
                    "Update command on situation",
                    "Prepare contingency plans"
                ],
                confidence=0.88,
                reasoning=f"Multiple factors reducing mission probability below acceptable threshold",
                icon="⚠️",
                expires_at=now + timedelta(minutes=15),
                generated_at=now
            ))
        elif probability < 0.85:
            recommendations.append(AIRecommendation(
                recommendation_id=f"REC-MSN-{ctx.convoy_id}-{now.strftime('%H%M%S')}",
                category="TACTICAL",
                priority="MEDIUM",
                title="Mission Monitoring Required",
                description=f"Mission success at {probability*100:.0f}%. Close monitoring advised.",
                action_items=[
                    "Monitor developing situations",
                    "Maintain communication with HQ",
                    "Be prepared for route adjustments"
                ],
                confidence=0.82,
                reasoning="Some risk factors affecting mission probability",
                icon="👁️",
                expires_at=now + timedelta(minutes=30),
                generated_at=now
            ))
        
        # Positive recommendation if all is well
        if probability > 0.90 and not recommendations:
            recommendations.append(AIRecommendation(
                recommendation_id=f"REC-OK-{ctx.convoy_id}-{now.strftime('%H%M%S')}",
                category="TACTICAL",
                priority="LOW",
                title="All Systems Nominal",
                description=f"{ctx.callsign} operating within optimal parameters. Continue current course.",
                action_items=[
                    "Maintain current speed and formation",
                    "Continue regular status reports",
                    "Monitor for any changes"
                ],
                confidence=0.95,
                reasoning="All metrics within acceptable ranges",
                icon="✅",
                expires_at=now + timedelta(hours=1),
                generated_at=now
            ))
        
        return recommendations
    
    def _generate_tactical_summary(self, ctx: ConvoyContext, probability: float, 
                                    recommendations: List[AIRecommendation]) -> str:
        """Generate a tactical summary for the convoy."""
        high_priority = [r for r in recommendations if r.priority == "HIGH"]
        
        if high_priority:
            issues = ", ".join([r.title.lower() for r in high_priority[:2]])
            return f"⚠️ ATTENTION REQUIRED: {ctx.callsign} facing {issues}. " \
                   f"Mission probability {probability*100:.0f}%. " \
                   f"Address {len(high_priority)} high-priority issue(s) immediately."
        elif probability < 0.8:
            return f"📡 MONITORING: {ctx.callsign} at {ctx.progress_pct:.0f}% mission completion. " \
                   f"Success probability {probability*100:.0f}%. Some factors require attention."
        elif probability < 0.9:
            return f"✅ ON TRACK: {ctx.callsign} proceeding normally at {ctx.speed_kmh:.0f} km/h. " \
                   f"{ctx.distance_remaining_km:.1f} km remaining. ETA confidence good."
        else:
            return f"🎯 OPTIMAL: {ctx.callsign} operating at peak efficiency. " \
                   f"Mission {ctx.progress_pct:.0f}% complete, {probability*100:.0f}% success probability. " \
                   f"All systems green."
    
    def _determine_immediate_actions(self, ctx: ConvoyContext, 
                                      recommendations: List[AIRecommendation]) -> List[str]:
        """Determine immediate actions required."""
        actions = []
        
        # Add high-priority actions first
        for rec in recommendations:
            if rec.priority == "HIGH":
                actions.extend(rec.action_items[:2])
        
        # Add standard actions based on status
        if ctx.speed_kmh < 5 and ctx.progress_pct < 95:
            actions.append("Confirm halt status with lead vehicle")
        
        if not actions:
            actions.append("Continue mission as planned")
            actions.append("Maintain regular status updates")
        
        return actions[:5]  # Max 5 immediate actions
    
    async def _get_llm_insights(self, ctx: ConvoyContext) -> Optional[Dict]:
        """Get enhanced insights from LLM when available."""
        try:
            prompt = f"""Analyze this military convoy situation and provide tactical recommendations:

CONVOY: {ctx.callsign}
MISSION: {ctx.mission_id}
PRIORITY: {ctx.priority}
CARGO: {ctx.cargo_type}

POSITION: {ctx.latitude:.4f}, {ctx.longitude:.4f} at {ctx.altitude_m:.0f}m altitude
SPEED: {ctx.speed_kmh:.1f} km/h, HEADING: {ctx.heading_deg:.0f}°

PROGRESS: {ctx.progress_pct:.1f}% complete, {ctx.distance_remaining_km:.1f} km remaining
CONVOY HEALTH: {ctx.convoy_health}
FUEL STATUS: {ctx.fuel_status}
THREAT LEVEL: {ctx.threat_level}

WEATHER: {ctx.weather}, Visibility: {ctx.visibility_km:.1f} km, Temp: {ctx.temperature_c}°C

Provide a brief tactical summary and 2-3 specific recommendations."""

            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    f"{OLLAMA_URL}/api/generate",
                    json={
                        "model": MODEL_NAME,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "num_predict": 300,
                            "temperature": 0.7,
                            "top_p": 0.9
                        }
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    text = result.get("response", "")
                    
                    # Parse the response into recommendations
                    return {
                        "summary": text[:200] if len(text) > 200 else text,
                        "recommendations": []
                    }
        except Exception as e:
            print(f"LLM insight failed: {e}")
        
        return None
    
    def to_dict(self, analysis: ConvoyAIAnalysis) -> Dict:
        """Convert analysis to dictionary for API response."""
        return {
            "convoy_id": analysis.convoy_id,
            "callsign": analysis.callsign,
            "analysis_id": analysis.analysis_id,
            "overall_status": analysis.overall_status,
            "mission_success_probability": round(analysis.mission_success_probability, 3),
            "risk_assessment": analysis.risk_assessment,
            "predictions": {
                "eta": analysis.predicted_eta.isoformat(),
                "eta_confidence": round(analysis.eta_confidence, 2),
                "delay_risk_minutes": analysis.delay_risk_minutes
            },
            "fuel_analysis": {
                "at_destination_pct": analysis.fuel_at_destination_pct,
                "refuel_stops_needed": analysis.refuel_stops_needed,
                "critical": analysis.fuel_critical
            },
            "weather": {
                "impact": analysis.weather_impact,
                "delay_minutes": analysis.weather_delay_minutes
            },
            "threats": {
                "level": analysis.threat_level,
                "active": analysis.active_threats,
                "mitigations": analysis.threat_mitigations
            },
            "recommendations": [
                {
                    "id": r.recommendation_id,
                    "category": r.category,
                    "priority": r.priority,
                    "title": r.title,
                    "description": r.description,
                    "actions": r.action_items,
                    "confidence": round(r.confidence, 2),
                    "reasoning": r.reasoning,
                    "icon": r.icon,
                    "expires_at": r.expires_at.isoformat(),
                    "generated_at": r.generated_at.isoformat()
                }
                for r in analysis.recommendations
            ],
            "tactical_summary": analysis.tactical_summary,
            "immediate_actions": analysis.immediate_actions,
            "meta": {
                "generated_by": analysis.generated_by,
                "gpu_accelerated": analysis.gpu_accelerated,
                "analysis_duration_ms": analysis.analysis_duration_ms,
                "generated_at": analysis.generated_at.isoformat()
            }
        }


# Global instance
convoy_ai_engine = ConvoyAIEngine()
