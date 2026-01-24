"""
Decision Engine with Explainable Rules
Provides AI-assisted recommendations with full transparency.
"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from enum import Enum


class RecommendationType(str, Enum):
    APPROVE = "APPROVE"
    APPROVE_WITH_CONDITIONS = "APPROVE_WITH_CONDITIONS"
    DELAY = "DELAY"
    REROUTE = "REROUTE"
    REJECT = "REJECT"
    REQUIRES_REVIEW = "REQUIRES_REVIEW"


class DecisionEngine:
    """
    Rule-based decision engine for convoy planning.
    All decisions are explainable with clear rule references.
    """
    
    def __init__(self):
        self.rules_applied = []
        self.rule_registry = self._build_rule_registry()
    
    def _build_rule_registry(self) -> Dict[str, Dict[str, Any]]:
        """Define all decision rules with metadata."""
        return {
            "R001": {
                "name": "Critical Load Priority",
                "description": "Ammunition and medical loads get priority slot allocation",
                "category": "PRIORITY",
                "auto_apply": True,
            },
            "R002": {
                "name": "Night Movement Restriction",
                "description": "Non-critical convoys should not move between 22:00-05:00 on high-risk routes",
                "category": "SAFETY",
                "auto_apply": True,
            },
            "R003": {
                "name": "Weather Hold",
                "description": "Delay departure when weather impact factor > 1.3",
                "category": "SAFETY",
                "auto_apply": True,
            },
            "R004": {
                "name": "Convoy Spacing",
                "description": "Minimum 30-minute gap between convoys on same route",
                "category": "TRAFFIC",
                "auto_apply": True,
            },
            "R005": {
                "name": "High Threat Escort",
                "description": "Convoys on RED threat routes require escort vehicles",
                "category": "SECURITY",
                "auto_apply": True,
            },
            "R006": {
                "name": "Transit Camp Capacity",
                "description": "Halt requests must not exceed camp capacity",
                "category": "LOGISTICS",
                "auto_apply": True,
            },
            "R007": {
                "name": "Fuel Range Check",
                "description": "Vehicles must have sufficient fuel for journey plus 20% reserve",
                "category": "LOGISTICS",
                "auto_apply": True,
            },
            "R008": {
                "name": "Personnel Load Limit",
                "description": "Personnel transport convoys limited to 100 personnel per convoy",
                "category": "SAFETY",
                "auto_apply": True,
            },
            "R009": {
                "name": "Route Capacity",
                "description": "Maximum 3 active convoys per route segment",
                "category": "TRAFFIC",
                "auto_apply": True,
            },
            "R010": {
                "name": "TCP Operating Hours",
                "description": "Convoys should plan to cross TCPs during operating hours",
                "category": "OPERATIONS",
                "auto_apply": True,
            },
        }
    
    def evaluate_convoy_request(
        self,
        convoy: Dict[str, Any],
        route: Optional[Dict[str, Any]] = None,
        active_convoys_on_route: int = 0,
        available_assets: List[Dict[str, Any]] = None,
        transit_camps: List[Dict[str, Any]] = None,
        tcps: List[Dict[str, Any]] = None,
        weather_conditions: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Evaluate a convoy movement request and provide recommendation.
        
        Returns decision with full explanation and conditions.
        """
        self.rules_applied = []
        conditions = []
        warnings = []
        blockers = []
        
        priority_score = convoy.get("priority_score", 50)
        priority_level = convoy.get("priority_level", "NORMAL")
        load_type = convoy.get("load_type", "GENERAL")
        personnel_count = convoy.get("personnel_count", 0)
        start_time = convoy.get("start_time")
        
        route_threat = route.get("threat_level", "GREEN") if route else "GREEN"
        route_risk = route.get("risk_level", "LOW") if route else "LOW"
        weather_impact = route.get("weather_impact_factor", 1.0) if route else 1.0
        night_allowed = route.get("is_night_movement_allowed", True) if route else True
        
        # Parse start time
        if isinstance(start_time, str):
            start_time = datetime.fromisoformat(start_time)
        elif start_time is None:
            start_time = datetime.utcnow()
        
        start_hour = start_time.hour
        
        # === RULE EVALUATIONS ===
        
        # R001: Critical Load Priority
        if load_type in ["AMMUNITION", "MEDICAL"]:
            self.rules_applied.append({
                "rule_id": "R001",
                "rule": self.rule_registry["R001"],
                "outcome": "PRIORITY_BOOST",
                "message": f"{load_type} load receives priority scheduling"
            })
        
        # R002: Night Movement Restriction
        is_night = start_hour >= 22 or start_hour < 5
        if is_night and route_risk == "HIGH" and priority_level not in ["CRITICAL", "HIGH"]:
            if not night_allowed:
                blockers.append({
                    "rule_id": "R002",
                    "message": "Night movement not permitted on this high-risk route for non-critical convoys",
                    "suggested_action": "Reschedule departure to 05:00 or later"
                })
                self.rules_applied.append({
                    "rule_id": "R002",
                    "rule": self.rule_registry["R002"],
                    "outcome": "BLOCKED",
                    "message": "Night movement blocked on high-risk route"
                })
            else:
                warnings.append({
                    "rule_id": "R002",
                    "message": "Night movement on high-risk route - proceed with caution",
                })
                self.rules_applied.append({
                    "rule_id": "R002",
                    "rule": self.rule_registry["R002"],
                    "outcome": "WARNING",
                    "message": "Night movement warning issued"
                })
        
        # R003: Weather Hold
        if weather_impact > 1.3:
            if weather_impact > 1.5:
                blockers.append({
                    "rule_id": "R003",
                    "message": f"Severe weather conditions (impact: {weather_impact}). Movement not recommended.",
                    "suggested_action": "Delay until weather improves"
                })
            else:
                conditions.append({
                    "rule_id": "R003",
                    "condition": "REDUCED_SPEED",
                    "message": f"Reduce convoy speed by {int((weather_impact - 1) * 100)}% due to weather"
                })
            self.rules_applied.append({
                "rule_id": "R003",
                "rule": self.rule_registry["R003"],
                "outcome": "BLOCKED" if weather_impact > 1.5 else "CONDITIONAL",
                "message": f"Weather impact factor: {weather_impact}"
            })
        
        # R004: Convoy Spacing
        if active_convoys_on_route > 0:
            conditions.append({
                "rule_id": "R004",
                "condition": "MAINTAIN_GAP",
                "message": f"Maintain minimum 30-minute gap from {active_convoys_on_route} active convoy(s)"
            })
            self.rules_applied.append({
                "rule_id": "R004",
                "rule": self.rule_registry["R004"],
                "outcome": "CONDITIONAL",
                "message": f"{active_convoys_on_route} active convoys on route"
            })
        
        # R005: High Threat Escort
        if route_threat == "RED":
            has_escort = any(a.get("category") == "ESCORT" or a.get("role") == "ESCORT" 
                          for a in (available_assets or []))
            if not has_escort:
                conditions.append({
                    "rule_id": "R005",
                    "condition": "ESCORT_REQUIRED",
                    "message": "Assign escort vehicles before departure - route has RED threat level"
                })
            self.rules_applied.append({
                "rule_id": "R005",
                "rule": self.rule_registry["R005"],
                "outcome": "CONDITIONAL" if not has_escort else "SATISFIED",
                "message": "High threat route - escort check"
            })
        
        # R008: Personnel Load Limit
        if personnel_count > 100:
            warnings.append({
                "rule_id": "R008",
                "message": f"Personnel count ({personnel_count}) exceeds recommended limit of 100",
            })
            conditions.append({
                "rule_id": "R008",
                "condition": "SPLIT_CONVOY",
                "message": "Consider splitting into multiple convoys for safety"
            })
            self.rules_applied.append({
                "rule_id": "R008",
                "rule": self.rule_registry["R008"],
                "outcome": "WARNING",
                "message": f"Personnel count: {personnel_count}"
            })
        
        # R009: Route Capacity
        if active_convoys_on_route >= 3:
            blockers.append({
                "rule_id": "R009",
                "message": f"Route at capacity ({active_convoys_on_route} active convoys)",
                "suggested_action": "Wait for current convoys to clear or use alternate route"
            })
            self.rules_applied.append({
                "rule_id": "R009",
                "rule": self.rule_registry["R009"],
                "outcome": "BLOCKED",
                "message": "Route capacity exceeded"
            })
        
        # === DETERMINE FINAL RECOMMENDATION ===
        if blockers:
            recommendation = RecommendationType.REJECT if len(blockers) > 1 else RecommendationType.DELAY
            recommendation_message = "Movement blocked due to rule violations"
        elif conditions:
            recommendation = RecommendationType.APPROVE_WITH_CONDITIONS
            recommendation_message = f"Approved with {len(conditions)} condition(s)"
        elif warnings:
            recommendation = RecommendationType.APPROVE_WITH_CONDITIONS
            recommendation_message = f"Approved with {len(warnings)} warning(s)"
        else:
            recommendation = RecommendationType.APPROVE
            recommendation_message = "Movement approved - all rules satisfied"
        
        # Commander override note
        override_allowed = priority_level in ["CRITICAL", "HIGH"]
        
        return {
            "recommendation": recommendation.value,
            "message": recommendation_message,
            "priority_score": priority_score,
            "priority_level": priority_level,
            "blockers": blockers,
            "conditions": conditions,
            "warnings": warnings,
            "rules_evaluated": len(self.rules_applied),
            "rules_applied": self.rules_applied,
            "commander_override_allowed": override_allowed,
            "override_note": "High-priority convoys may override non-critical warnings with commander authorization" if override_allowed else None,
            "evaluated_at": datetime.utcnow().isoformat(),
        }
    
    def get_rule_details(self, rule_id: str) -> Optional[Dict[str, Any]]:
        """Get full details of a specific rule."""
        return self.rule_registry.get(rule_id)
    
    def list_all_rules(self) -> List[Dict[str, Any]]:
        """List all rules in the registry."""
        return [
            {"rule_id": k, **v}
            for k, v in self.rule_registry.items()
        ]


# Singleton instance
decision_engine = DecisionEngine()


if __name__ == "__main__":
    engine = DecisionEngine()
    
    # Test convoy
    convoy = {
        "name": "Alpha-Move-01",
        "load_type": "AMMUNITION",
        "priority_score": 75,
        "priority_level": "HIGH",
        "personnel_count": 30,
        "start_time": datetime.now(),
    }
    
    route = {
        "name": "NH-44",
        "threat_level": "ORANGE",
        "risk_level": "HIGH",
        "weather_impact_factor": 1.2,
        "is_night_movement_allowed": True,
    }
    
    result = engine.evaluate_convoy_request(
        convoy=convoy,
        route=route,
        active_convoys_on_route=1,
    )
    
    print(f"\n=== Decision: {result['recommendation']} ===")
    print(f"Message: {result['message']}")
    print(f"\nBlockers: {len(result['blockers'])}")
    for b in result['blockers']:
        print(f"  - [{b['rule_id']}] {b['message']}")
    print(f"\nConditions: {len(result['conditions'])}")
    for c in result['conditions']:
        print(f"  - [{c['rule_id']}] {c['message']}")
    print(f"\nWarnings: {len(result['warnings'])}")
    for w in result['warnings']:
        print(f"  - [{w['rule_id']}] {w['message']}")
