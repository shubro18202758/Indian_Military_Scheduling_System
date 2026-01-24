"""
Convoy Priority Scoring Engine
Uses a rule-based scoring system with weighted factors for explainability.
Can be enhanced with XGBoost for learned weights from historical data.
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
import json


class PriorityScorerEngine:
    """
    Computes priority scores for convoys based on multiple factors.
    Uses explainable rule-based scoring with optional ML enhancement.
    """
    
    # Factor weights (sum to 100 for easy interpretation)
    WEIGHTS = {
        "load_type": 25,          # Type of cargo being transported
        "urgency": 20,            # Time sensitivity
        "personnel_risk": 15,     # Personnel on board
        "terrain_difficulty": 10, # Route difficulty
        "threat_level": 15,       # Security threat on route
        "distance": 5,            # Total distance
        "weather": 5,             # Weather conditions
        "asset_value": 5,         # Value of cargo/assets
    }
    
    # Load type priority multipliers
    LOAD_TYPE_SCORES = {
        "AMMUNITION": 1.0,
        "MEDICAL": 0.95,
        "PERSONNEL": 0.9,
        "FUEL": 0.8,
        "EQUIPMENT": 0.6,
        "MIXED": 0.5,
        "GENERAL": 0.3,
    }
    
    # Terrain difficulty multipliers
    TERRAIN_SCORES = {
        "MOUNTAINOUS": 1.0,
        "MIXED": 0.6,
        "DESERT": 0.5,
        "PLAINS": 0.3,
    }
    
    # Threat level multipliers
    THREAT_SCORES = {
        "RED": 1.0,
        "ORANGE": 0.75,
        "YELLOW": 0.5,
        "GREEN": 0.2,
    }
    
    def __init__(self):
        self.factor_explanations = []
    
    def compute_priority(
        self,
        load_type: str = "GENERAL",
        is_time_critical: bool = False,
        deadline_hours: Optional[float] = None,
        personnel_count: int = 0,
        is_hazardous: bool = False,
        terrain_type: str = "PLAINS",
        threat_level: str = "GREEN",
        distance_km: float = 100.0,
        weather_impact: float = 1.0,
        cargo_value_category: str = "STANDARD",
        custom_urgency_boost: float = 0.0,
    ) -> Dict[str, Any]:
        """
        Compute priority score with full explanation.
        
        Returns:
            Dict with score (0-100), level (CRITICAL/HIGH/NORMAL/LOW), and breakdown
        """
        self.factor_explanations = []
        scores = {}
        
        # 1. Load Type Score
        load_score = self.LOAD_TYPE_SCORES.get(load_type.upper(), 0.3)
        scores["load_type"] = load_score * self.WEIGHTS["load_type"]
        self.factor_explanations.append({
            "factor": "Load Type",
            "value": load_type,
            "score": round(scores["load_type"], 2),
            "max": self.WEIGHTS["load_type"],
            "explanation": f"{load_type} cargo has {'high' if load_score > 0.7 else 'standard'} priority"
        })
        
        # 2. Urgency Score
        urgency_score = 0.2  # Base urgency
        if is_time_critical:
            urgency_score = 0.9
        elif deadline_hours is not None:
            if deadline_hours <= 6:
                urgency_score = 1.0
            elif deadline_hours <= 12:
                urgency_score = 0.8
            elif deadline_hours <= 24:
                urgency_score = 0.6
            else:
                urgency_score = 0.3
        
        urgency_score = min(1.0, urgency_score + custom_urgency_boost)
        scores["urgency"] = urgency_score * self.WEIGHTS["urgency"]
        self.factor_explanations.append({
            "factor": "Urgency",
            "value": f"Time-critical: {is_time_critical}, Deadline: {deadline_hours}h" if deadline_hours else f"Time-critical: {is_time_critical}",
            "score": round(scores["urgency"], 2),
            "max": self.WEIGHTS["urgency"],
            "explanation": f"Urgency level: {'CRITICAL' if urgency_score > 0.8 else 'NORMAL'}"
        })
        
        # 3. Personnel Risk Score
        personnel_score = 0.0
        if personnel_count > 100:
            personnel_score = 1.0
        elif personnel_count > 50:
            personnel_score = 0.8
        elif personnel_count > 20:
            personnel_score = 0.6
        elif personnel_count > 0:
            personnel_score = 0.4
        
        scores["personnel_risk"] = personnel_score * self.WEIGHTS["personnel_risk"]
        self.factor_explanations.append({
            "factor": "Personnel Risk",
            "value": f"{personnel_count} personnel",
            "score": round(scores["personnel_risk"], 2),
            "max": self.WEIGHTS["personnel_risk"],
            "explanation": f"Personnel count affects priority due to safety considerations"
        })
        
        # 4. Terrain Difficulty
        terrain_score = self.TERRAIN_SCORES.get(terrain_type.upper(), 0.3)
        scores["terrain_difficulty"] = terrain_score * self.WEIGHTS["terrain_difficulty"]
        self.factor_explanations.append({
            "factor": "Terrain Difficulty",
            "value": terrain_type,
            "score": round(scores["terrain_difficulty"], 2),
            "max": self.WEIGHTS["terrain_difficulty"],
            "explanation": f"{terrain_type} terrain requires {'prioritized scheduling' if terrain_score > 0.6 else 'standard handling'}"
        })
        
        # 5. Threat Level
        threat_score = self.THREAT_SCORES.get(threat_level.upper(), 0.2)
        scores["threat_level"] = threat_score * self.WEIGHTS["threat_level"]
        self.factor_explanations.append({
            "factor": "Threat Level",
            "value": threat_level,
            "score": round(scores["threat_level"], 2),
            "max": self.WEIGHTS["threat_level"],
            "explanation": f"Route threat level {threat_level} {'requires expedited movement' if threat_score > 0.5 else 'allows normal scheduling'}"
        })
        
        # 6. Distance Factor (longer routes need better scheduling)
        distance_score = min(1.0, distance_km / 500.0)  # Normalize to 500km max
        scores["distance"] = distance_score * self.WEIGHTS["distance"]
        self.factor_explanations.append({
            "factor": "Distance",
            "value": f"{distance_km} km",
            "score": round(scores["distance"], 2),
            "max": self.WEIGHTS["distance"],
            "explanation": f"Route distance of {distance_km}km"
        })
        
        # 7. Weather Impact
        weather_score = max(0, min(1.0, (weather_impact - 1.0) * 2))  # 1.0 = no impact, 1.5 = full impact
        scores["weather"] = weather_score * self.WEIGHTS["weather"]
        self.factor_explanations.append({
            "factor": "Weather",
            "value": f"Impact factor: {weather_impact}",
            "score": round(scores["weather"], 2),
            "max": self.WEIGHTS["weather"],
            "explanation": f"Weather conditions {'affecting' if weather_impact > 1.0 else 'not affecting'} movement"
        })
        
        # 8. Asset Value
        value_multipliers = {"CRITICAL": 1.0, "HIGH": 0.7, "STANDARD": 0.3}
        value_score = value_multipliers.get(cargo_value_category.upper(), 0.3)
        if is_hazardous:
            value_score = max(value_score, 0.8)
        scores["asset_value"] = value_score * self.WEIGHTS["asset_value"]
        self.factor_explanations.append({
            "factor": "Asset Value",
            "value": f"{cargo_value_category}, Hazardous: {is_hazardous}",
            "score": round(scores["asset_value"], 2),
            "max": self.WEIGHTS["asset_value"],
            "explanation": f"Cargo classified as {cargo_value_category} value"
        })
        
        # Calculate total score
        total_score = sum(scores.values())
        
        # Determine priority level
        if total_score >= 75:
            priority_level = "CRITICAL"
        elif total_score >= 55:
            priority_level = "HIGH"
        elif total_score >= 35:
            priority_level = "NORMAL"
        else:
            priority_level = "LOW"
        
        return {
            "score": round(total_score, 2),
            "level": priority_level,
            "breakdown": scores,
            "factors": self.factor_explanations,
            "computed_at": datetime.utcnow().isoformat(),
            "weights_used": self.WEIGHTS
        }
    
    def compute_from_convoy_dict(self, convoy: Dict[str, Any], route: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Compute priority from convoy and route dictionaries (from DB).
        """
        return self.compute_priority(
            load_type=convoy.get("load_type", "GENERAL"),
            is_time_critical=convoy.get("priority_level") == "CRITICAL",
            personnel_count=convoy.get("personnel_count", 0),
            is_hazardous=convoy.get("is_hazardous", False),
            terrain_type=convoy.get("terrain_type", "PLAINS"),
            threat_level=route.get("threat_level", "GREEN") if route else "GREEN",
            distance_km=convoy.get("total_distance_km", 100.0) or 100.0,
            weather_impact=route.get("weather_impact_factor", 1.0) if route else 1.0,
            cargo_value_category="CRITICAL" if convoy.get("load_type") in ["AMMUNITION", "MEDICAL"] else "STANDARD"
        )


# Singleton instance
priority_scorer = PriorityScorerEngine()


if __name__ == "__main__":
    # Test the scorer
    scorer = PriorityScorerEngine()
    
    # High priority convoy
    result = scorer.compute_priority(
        load_type="AMMUNITION",
        is_time_critical=True,
        personnel_count=50,
        terrain_type="MOUNTAINOUS",
        threat_level="ORANGE",
        distance_km=300,
        weather_impact=1.2
    )
    
    print(f"\n=== Priority Score: {result['score']}/100 ({result['level']}) ===")
    for factor in result["factors"]:
        print(f"  {factor['factor']}: {factor['score']}/{factor['max']} - {factor['explanation']}")
