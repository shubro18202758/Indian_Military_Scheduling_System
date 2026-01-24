"""
Dynamic Scenario Generator
===========================

Generates realistic, dynamic military convoy scenarios:
1. Weather Events - Storms, fog, blizzards affecting routes
2. Security Threats - IEDs, ambushes, hostile activity
3. Natural Hazards - Landslides, floods, avalanches
4. Infrastructure Issues - Bridge damage, road blocks
5. Tactical Situations - Enemy movement, border tensions

All scenarios are:
- Generative (not hardcoded)
- Context-aware (considers terrain, weather, time)
- Probabilistic (based on realistic occurrence rates)
- Escalating (can increase in severity over time)
"""

import random
import math
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum


class ScenarioType(Enum):
    WEATHER = "WEATHER"
    SECURITY = "SECURITY"
    NATURAL = "NATURAL"
    INFRASTRUCTURE = "INFRASTRUCTURE"
    TACTICAL = "TACTICAL"
    LOGISTICAL = "LOGISTICAL"


class EventSeverity(Enum):
    ADVISORY = "ADVISORY"      # Information only
    CAUTION = "CAUTION"        # Proceed with care
    WARNING = "WARNING"        # Consider alternatives
    CRITICAL = "CRITICAL"      # Immediate action needed
    EMERGENCY = "EMERGENCY"    # Mission threatening


@dataclass
class ScenarioEvent:
    """A single scenario event"""
    event_id: str
    scenario_type: ScenarioType
    event_subtype: str
    severity: EventSeverity
    title: str
    description: str
    location: Tuple[float, float]
    radius_km: float
    affected_routes: List[str]
    start_time: datetime
    estimated_duration_hours: float
    probability_of_escalation: float
    recommended_actions: List[str]
    ai_assessment: str
    is_active: bool = True
    resolved_at: Optional[datetime] = None


@dataclass
class ScenarioTemplate:
    """Template for generating scenarios"""
    subtype: str
    base_probability: float
    severity_weights: Dict[str, float]
    duration_range: Tuple[float, float]
    radius_range: Tuple[float, float]
    descriptions: List[str]
    actions: List[str]
    terrain_boost: List[str]  # Terrain types that increase probability
    weather_boost: List[str]  # Weather conditions that increase probability
    time_boost: List[str]     # Time periods that increase probability


class DynamicScenarioGenerator:
    """
    Generates dynamic, realistic scenarios for convoy simulations.
    All scenarios are procedurally generated based on conditions.
    """
    
    # Scenario templates for each type
    TEMPLATES = {
        ScenarioType.WEATHER: [
            ScenarioTemplate(
                subtype="BLIZZARD",
                base_probability=0.05,
                severity_weights={"WARNING": 0.4, "CRITICAL": 0.5, "EMERGENCY": 0.1},
                duration_range=(4, 24),
                radius_range=(20, 100),
                descriptions=[
                    "Heavy snowfall with visibility below 50m",
                    "Blizzard conditions developing rapidly",
                    "Severe winter storm warning in effect",
                    "Whiteout conditions reported by forward units"
                ],
                actions=["HALT_CONVOY", "SEEK_SHELTER", "ACTIVATE_HEATING"],
                terrain_boost=["LADAKH_HIGH", "SIACHEN", "HIMALAYAN_FOOTHILLS"],
                weather_boost=["SNOW", "COLD"],
                time_boost=["WINTER", "NIGHT"]
            ),
            ScenarioTemplate(
                subtype="FOG_DENSE",
                base_probability=0.15,
                severity_weights={"CAUTION": 0.3, "WARNING": 0.5, "CRITICAL": 0.2},
                duration_range=(2, 8),
                radius_range=(10, 50),
                descriptions=[
                    "Dense fog reducing visibility to 100m",
                    "Radiation fog developing in valleys",
                    "Heavy mist conditions on mountain passes",
                    "Visibility severely compromised"
                ],
                actions=["REDUCE_SPEED", "INCREASE_SPACING", "USE_FOG_LIGHTS"],
                terrain_boost=["KASHMIR_VALLEY", "HIMALAYAN_FOOTHILLS"],
                weather_boost=["HUMID", "COLD"],
                time_boost=["DAWN", "DUSK", "NIGHT"]
            ),
            ScenarioTemplate(
                subtype="DUST_STORM",
                base_probability=0.1,
                severity_weights={"WARNING": 0.5, "CRITICAL": 0.4, "EMERGENCY": 0.1},
                duration_range=(1, 6),
                radius_range=(30, 150),
                descriptions=[
                    "Major dust storm approaching from northwest",
                    "Sand visibility reduced to near zero",
                    "Haboob conditions developing",
                    "Severe dust and sand advisory"
                ],
                actions=["HALT_CONVOY", "PROTECT_EQUIPMENT", "SEAL_VEHICLES"],
                terrain_boost=["RAJASTHAN_DESERT"],
                weather_boost=["HOT", "WINDY"],
                time_boost=["AFTERNOON", "EVENING"]
            ),
            ScenarioTemplate(
                subtype="HEAVY_RAIN",
                base_probability=0.2,
                severity_weights={"CAUTION": 0.4, "WARNING": 0.4, "CRITICAL": 0.2},
                duration_range=(2, 12),
                radius_range=(15, 80),
                descriptions=[
                    "Heavy rainfall exceeding 50mm/hour",
                    "Monsoon conditions causing road flooding",
                    "Intense precipitation affecting traction",
                    "Flash flood watch in effect"
                ],
                actions=["REDUCE_SPEED", "AVOID_CROSSINGS", "MONITOR_WATER_LEVELS"],
                terrain_boost=["KASHMIR_VALLEY", "NORTHEAST", "HIMALAYAN_FOOTHILLS"],
                weather_boost=["MONSOON", "HUMID"],
                time_boost=["MONSOON_SEASON"]
            ),
        ],
        ScenarioType.SECURITY: [
            ScenarioTemplate(
                subtype="IED_SUSPECTED",
                base_probability=0.03,
                severity_weights={"CRITICAL": 0.6, "EMERGENCY": 0.4},
                duration_range=(2, 8),
                radius_range=(0.5, 2),
                descriptions=[
                    "Suspected IED detected by advance patrol",
                    "Unusual object reported on route",
                    "EOD team dispatched to investigate",
                    "Possible explosive device near checkpoint"
                ],
                actions=["FULL_HALT", "ESTABLISH_CORDON", "REQUEST_EOD", "ALTERNATE_ROUTE"],
                terrain_boost=["KASHMIR_VALLEY", "NORTHEAST"],
                weather_boost=[],
                time_boost=["NIGHT", "DAWN"]
            ),
            ScenarioTemplate(
                subtype="AMBUSH_RISK",
                base_probability=0.05,
                severity_weights={"WARNING": 0.3, "CRITICAL": 0.5, "EMERGENCY": 0.2},
                duration_range=(1, 4),
                radius_range=(1, 5),
                descriptions=[
                    "Intelligence indicates possible ambush setup",
                    "Suspicious movement detected near route",
                    "Hostile activity reported in sector",
                    "Unidentified armed personnel sighted"
                ],
                actions=["DEFENSIVE_FORMATION", "REQUEST_ESCORT", "ALTERNATE_ROUTE", "AIR_SUPPORT"],
                terrain_boost=["KASHMIR_VALLEY", "NORTHEAST", "HIMALAYAN_FOOTHILLS"],
                weather_boost=["FOG", "RAIN"],
                time_boost=["NIGHT", "DAWN", "DUSK"]
            ),
            ScenarioTemplate(
                subtype="BORDER_TENSION",
                base_probability=0.02,
                severity_weights={"WARNING": 0.4, "CRITICAL": 0.4, "EMERGENCY": 0.2},
                duration_range=(12, 72),
                radius_range=(10, 50),
                descriptions=[
                    "Increased activity observed across LAC",
                    "Border patrol reports unusual movement",
                    "Elevated threat level in sector",
                    "SIGINT indicates potential incursion"
                ],
                actions=["HEIGHTENED_ALERT", "SECURE_COMMUNICATIONS", "COORDINATE_WITH_COMMAND"],
                terrain_boost=["LADAKH_HIGH", "SIACHEN"],
                weather_boost=[],
                time_boost=[]
            ),
        ],
        ScenarioType.NATURAL: [
            ScenarioTemplate(
                subtype="LANDSLIDE",
                base_probability=0.08,
                severity_weights={"WARNING": 0.3, "CRITICAL": 0.5, "EMERGENCY": 0.2},
                duration_range=(4, 48),
                radius_range=(0.5, 5),
                descriptions=[
                    "Major landslide blocking route",
                    "Rock and debris fall on highway",
                    "Slope failure after heavy rain",
                    "Mountain section collapsed"
                ],
                actions=["FULL_HALT", "ALTERNATE_ROUTE", "REQUEST_ENGINEERING", "AWAIT_CLEARANCE"],
                terrain_boost=["HIMALAYAN_FOOTHILLS", "KASHMIR_VALLEY", "LADAKH_HIGH"],
                weather_boost=["RAIN", "HEAVY_RAIN", "MONSOON"],
                time_boost=["MONSOON_SEASON"]
            ),
            ScenarioTemplate(
                subtype="AVALANCHE",
                base_probability=0.04,
                severity_weights={"CRITICAL": 0.5, "EMERGENCY": 0.5},
                duration_range=(6, 72),
                radius_range=(1, 10),
                descriptions=[
                    "Avalanche reported on mountain pass",
                    "Snow slide blocking main route",
                    "Multiple avalanches in sector",
                    "Pass closed due to avalanche danger"
                ],
                actions=["FULL_HALT", "EVACUATE_DANGER_ZONE", "ALTERNATE_ROUTE", "AWAIT_CLEARANCE"],
                terrain_boost=["LADAKH_HIGH", "SIACHEN"],
                weather_boost=["SNOW", "BLIZZARD"],
                time_boost=["WINTER", "EARLY_SPRING"]
            ),
            ScenarioTemplate(
                subtype="FLOODING",
                base_probability=0.1,
                severity_weights={"CAUTION": 0.2, "WARNING": 0.4, "CRITICAL": 0.3, "EMERGENCY": 0.1},
                duration_range=(6, 48),
                radius_range=(5, 30),
                descriptions=[
                    "River levels exceeding safe crossing depth",
                    "Flash flooding reported on route",
                    "Low-lying sections underwater",
                    "Bridge approaches submerged"
                ],
                actions=["HALT_AT_CROSSING", "ASSESS_WATER_DEPTH", "ALTERNATE_ROUTE", "AWAIT_LEVELS"],
                terrain_boost=["KASHMIR_VALLEY", "PUNJAB_PLAINS", "NORTHEAST"],
                weather_boost=["RAIN", "HEAVY_RAIN", "MONSOON"],
                time_boost=["MONSOON_SEASON"]
            ),
            ScenarioTemplate(
                subtype="EARTHQUAKE",
                base_probability=0.01,
                severity_weights={"WARNING": 0.2, "CRITICAL": 0.4, "EMERGENCY": 0.4},
                duration_range=(1, 24),
                radius_range=(50, 200),
                descriptions=[
                    "Seismic activity detected in region",
                    "Earthquake damage reported on route",
                    "Aftershocks continuing",
                    "Infrastructure integrity uncertain"
                ],
                actions=["HALT_CONVOY", "ASSESS_ROUTE", "CHECK_BRIDGES", "COORDINATE_WITH_HQ"],
                terrain_boost=["HIMALAYAN_FOOTHILLS", "KASHMIR_VALLEY", "LADAKH_HIGH"],
                weather_boost=[],
                time_boost=[]
            ),
        ],
        ScenarioType.INFRASTRUCTURE: [
            ScenarioTemplate(
                subtype="BRIDGE_DAMAGE",
                base_probability=0.05,
                severity_weights={"WARNING": 0.3, "CRITICAL": 0.5, "EMERGENCY": 0.2},
                duration_range=(12, 168),
                radius_range=(0.2, 1),
                descriptions=[
                    "Bridge structural damage detected",
                    "Load-bearing capacity compromised",
                    "Temporary closure for inspection",
                    "Bridge partially collapsed"
                ],
                actions=["ALTERNATE_ROUTE", "REQUEST_ENGINEERING", "WEIGHT_RESTRICTION", "AWAIT_REPAIRS"],
                terrain_boost=["HIMALAYAN_FOOTHILLS", "KASHMIR_VALLEY"],
                weather_boost=["FLOOD", "EARTHQUAKE"],
                time_boost=[]
            ),
            ScenarioTemplate(
                subtype="ROAD_DAMAGE",
                base_probability=0.1,
                severity_weights={"CAUTION": 0.3, "WARNING": 0.4, "CRITICAL": 0.3},
                duration_range=(4, 72),
                radius_range=(0.5, 5),
                descriptions=[
                    "Road surface severely damaged",
                    "Large potholes and cracks on route",
                    "Pavement failure after heavy traffic",
                    "Section of road washed away"
                ],
                actions=["REDUCE_SPEED", "SINGLE_FILE", "ENGINEERING_SUPPORT", "ALTERNATE_ROUTE"],
                terrain_boost=["HIMALAYAN_FOOTHILLS", "LADAKH_HIGH"],
                weather_boost=["RAIN", "FREEZE_THAW"],
                time_boost=[]
            ),
        ],
        ScenarioType.TACTICAL: [
            ScenarioTemplate(
                subtype="ENEMY_MOVEMENT",
                base_probability=0.02,
                severity_weights={"WARNING": 0.3, "CRITICAL": 0.5, "EMERGENCY": 0.2},
                duration_range=(2, 12),
                radius_range=(10, 50),
                descriptions=[
                    "Significant enemy troop movement detected",
                    "Hostile forces massing near route",
                    "UAV surveillance shows military buildup",
                    "HUMINT reports enemy patrol activity"
                ],
                actions=["HEIGHTENED_ALERT", "SECURE_PERIMETER", "REQUEST_AIR_COVER", "COORDINATE_WITH_COMMAND"],
                terrain_boost=["LADAKH_HIGH", "SIACHEN"],
                weather_boost=[],
                time_boost=[]
            ),
            ScenarioTemplate(
                subtype="ARTILLERY_THREAT",
                base_probability=0.01,
                severity_weights={"CRITICAL": 0.5, "EMERGENCY": 0.5},
                duration_range=(1, 6),
                radius_range=(5, 20),
                descriptions=[
                    "Artillery fire detected in sector",
                    "Incoming fire reported near route",
                    "Counter-battery operations in progress",
                    "Shell impacts within route corridor"
                ],
                actions=["IMMEDIATE_HALT", "SEEK_COVER", "DISPERSE_CONVOY", "AWAIT_ALL_CLEAR"],
                terrain_boost=["LADAKH_HIGH", "SIACHEN"],
                weather_boost=[],
                time_boost=[]
            ),
        ],
        ScenarioType.LOGISTICAL: [
            ScenarioTemplate(
                subtype="FUEL_SHORTAGE",
                base_probability=0.08,
                severity_weights={"CAUTION": 0.4, "WARNING": 0.4, "CRITICAL": 0.2},
                duration_range=(4, 24),
                radius_range=(0, 0),
                descriptions=[
                    "Fuel reserves running low at forward base",
                    "Refueling point temporarily closed",
                    "Fuel supply convoy delayed",
                    "Emergency fuel rationing in effect"
                ],
                actions=["OPTIMIZE_FUEL_USAGE", "REQUEST_RESUPPLY", "ADJUST_ROUTE_FOR_FUEL", "REDUCE_SPEED"],
                terrain_boost=[],
                weather_boost=["BLIZZARD", "DUST_STORM"],
                time_boost=[]
            ),
            ScenarioTemplate(
                subtype="VEHICLE_BREAKDOWN",
                base_probability=0.15,
                severity_weights={"CAUTION": 0.5, "WARNING": 0.4, "CRITICAL": 0.1},
                duration_range=(1, 8),
                radius_range=(0, 0),
                descriptions=[
                    "Vehicle in convoy experiencing mechanical failure",
                    "Engine overheating in lead vehicle",
                    "Transmission failure reported",
                    "Tire blowout on convoy vehicle"
                ],
                actions=["DISPATCH_RECOVERY", "REDISTRIBUTE_CARGO", "FIELD_REPAIR", "CONTINUE_WITH_REMAINING"],
                terrain_boost=["LADAKH_HIGH", "RAJASTHAN_DESERT"],
                weather_boost=["EXTREME_HEAT", "EXTREME_COLD"],
                time_boost=[]
            ),
        ],
    }
    
    def __init__(self):
        self.active_events: Dict[str, ScenarioEvent] = {}
        self.event_history: List[ScenarioEvent] = []
        self.event_counter = 0
    
    def generate_event(self,
                      location: Tuple[float, float],
                      terrain: str,
                      weather: str,
                      time_of_day: str,
                      route_ids: List[str],
                      force_type: Optional[ScenarioType] = None) -> Optional[ScenarioEvent]:
        """
        Generate a dynamic scenario event based on current conditions.
        Returns None if no event should occur based on probability.
        """
        # Select scenario type
        if force_type:
            scenario_type = force_type
        else:
            scenario_type = self._select_scenario_type(terrain, weather, time_of_day)
        
        if not scenario_type:
            return None
        
        # Select template
        templates = self.TEMPLATES.get(scenario_type, [])
        if not templates:
            return None
        
        # Weight templates by conditions
        weighted_templates = []
        for template in templates:
            weight = template.base_probability
            
            # Boost based on terrain
            if terrain in template.terrain_boost:
                weight *= 3.0
            
            # Boost based on weather
            if weather in template.weather_boost:
                weight *= 2.5
            
            # Boost based on time
            if time_of_day in template.time_boost:
                weight *= 2.0
            
            weighted_templates.append((template, weight))
        
        # Check if event occurs
        total_weight = sum(w for _, w in weighted_templates)
        if random.random() > min(0.8, total_weight):
            return None
        
        # Select template
        r = random.uniform(0, total_weight)
        cumulative = 0
        selected_template = weighted_templates[0][0]
        
        for template, weight in weighted_templates:
            cumulative += weight
            if r <= cumulative:
                selected_template = template
                break
        
        # Generate event from template
        return self._generate_from_template(
            selected_template, 
            scenario_type,
            location,
            route_ids
        )
    
    def _select_scenario_type(self, terrain: str, weather: str, time_of_day: str) -> Optional[ScenarioType]:
        """Select which type of scenario to generate."""
        weights = {
            ScenarioType.WEATHER: 0.3,
            ScenarioType.NATURAL: 0.25,
            ScenarioType.SECURITY: 0.15,
            ScenarioType.INFRASTRUCTURE: 0.15,
            ScenarioType.TACTICAL: 0.05,
            ScenarioType.LOGISTICAL: 0.1
        }
        
        # Adjust weights based on conditions
        if weather in ["SNOW", "BLIZZARD", "RAIN", "FOG"]:
            weights[ScenarioType.WEATHER] += 0.2
        
        if terrain in ["KASHMIR_VALLEY", "NORTHEAST"]:
            weights[ScenarioType.SECURITY] += 0.1
        
        if terrain in ["LADAKH_HIGH", "SIACHEN"]:
            weights[ScenarioType.TACTICAL] += 0.05
            weights[ScenarioType.NATURAL] += 0.1
        
        if terrain in ["HIMALAYAN_FOOTHILLS"]:
            weights[ScenarioType.NATURAL] += 0.15
        
        # Select type
        types = list(weights.keys())
        probs = [weights[t] for t in types]
        total = sum(probs)
        probs = [p / total for p in probs]
        
        return random.choices(types, weights=probs)[0]
    
    def _generate_from_template(self,
                               template: ScenarioTemplate,
                               scenario_type: ScenarioType,
                               location: Tuple[float, float],
                               route_ids: List[str]) -> ScenarioEvent:
        """Generate a specific event from a template."""
        self.event_counter += 1
        event_id = f"EVT-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{self.event_counter:04d}"
        
        # Select severity
        severity_options = list(template.severity_weights.keys())
        severity_probs = list(template.severity_weights.values())
        severity_str = random.choices(severity_options, weights=severity_probs)[0]
        severity = EventSeverity[severity_str]
        
        # Generate description
        description = random.choice(template.descriptions)
        
        # Calculate duration
        duration = random.uniform(*template.duration_range)
        
        # Calculate radius
        radius = random.uniform(*template.radius_range)
        
        # Add location variance
        lat_var = random.uniform(-0.02, 0.02)
        lng_var = random.uniform(-0.02, 0.02)
        event_location = (location[0] + lat_var, location[1] + lng_var)
        
        # Select recommended actions
        num_actions = min(3, len(template.actions))
        actions = random.sample(template.actions, num_actions)
        
        # Generate AI assessment
        ai_assessment = self._generate_ai_assessment(template.subtype, severity, duration)
        
        # Calculate escalation probability
        escalation_prob = 0.1 if severity in [EventSeverity.ADVISORY, EventSeverity.CAUTION] else 0.3
        
        event = ScenarioEvent(
            event_id=event_id,
            scenario_type=scenario_type,
            event_subtype=template.subtype,
            severity=severity,
            title=f"{template.subtype.replace('_', ' ').title()} Detected",
            description=description,
            location=event_location,
            radius_km=radius,
            affected_routes=route_ids,
            start_time=datetime.utcnow(),
            estimated_duration_hours=duration,
            probability_of_escalation=escalation_prob,
            recommended_actions=actions,
            ai_assessment=ai_assessment
        )
        
        self.active_events[event_id] = event
        return event
    
    def _generate_ai_assessment(self, subtype: str, severity: EventSeverity, duration: float) -> str:
        """Generate an AI assessment of the event."""
        assessments = {
            "BLIZZARD": f"GUARDIAN AI: Severe weather event. Recommend shelter-in-place for {duration:.1f}h. Monitor for stranded vehicles.",
            "FOG_DENSE": "GUARDIAN AI: Visibility-limited operations. Maintain convoy integrity. Consider delaying movement.",
            "DUST_STORM": "GUARDIAN AI: Protect sensitive equipment. Filter systems critical. Await clearance.",
            "IED_SUSPECTED": "GUARDIAN AI: CRITICAL - Full stop mandatory. EOD clearance required. No approach within 500m.",
            "AMBUSH_RISK": "GUARDIAN AI: Defensive posture advised. Consider air support or escort. Alternate routing recommended.",
            "LANDSLIDE": "GUARDIAN AI: Route blocked. Engineering assessment needed. Estimate clearance in {duration:.0f}h.",
            "AVALANCHE": "GUARDIAN AI: DANGER - Multiple slide risk. Do not proceed. Await stability assessment.",
            "FLOODING": "GUARDIAN AI: Water crossing hazardous. Verify depth before proceeding. Alternative routes available.",
            "BRIDGE_DAMAGE": "GUARDIAN AI: Structural integrity unknown. Weight restrictions in effect. Engineering priority.",
        }
        
        base = assessments.get(subtype, f"GUARDIAN AI: {subtype} event detected. Proceed with caution.")
        
        if severity == EventSeverity.EMERGENCY:
            base = "⚠️ EMERGENCY: " + base
        elif severity == EventSeverity.CRITICAL:
            base = "🔴 CRITICAL: " + base
        
        return base
    
    def update_events(self, current_time: datetime) -> List[ScenarioEvent]:
        """
        Update all active events:
        - Resolve expired events
        - Escalate events if probability triggers
        - Return list of changed events
        """
        changed = []
        
        for event_id, event in list(self.active_events.items()):
            # Check if event should end
            end_time = event.start_time + timedelta(hours=event.estimated_duration_hours)
            
            if current_time >= end_time:
                event.is_active = False
                event.resolved_at = current_time
                self.event_history.append(event)
                del self.active_events[event_id]
                changed.append(event)
                continue
            
            # Check for escalation
            if random.random() < event.probability_of_escalation * 0.01:  # Per update
                old_severity = event.severity
                if event.severity == EventSeverity.CAUTION:
                    event.severity = EventSeverity.WARNING
                elif event.severity == EventSeverity.WARNING:
                    event.severity = EventSeverity.CRITICAL
                elif event.severity == EventSeverity.CRITICAL:
                    event.severity = EventSeverity.EMERGENCY
                
                if event.severity != old_severity:
                    event.description += f" [ESCALATED from {old_severity.value}]"
                    changed.append(event)
        
        return changed
    
    def get_events_affecting_location(self, lat: float, lng: float) -> List[ScenarioEvent]:
        """Get all active events that affect a specific location."""
        affected = []
        
        for event in self.active_events.values():
            dist = self._haversine(lat, lng, event.location[0], event.location[1])
            if dist <= event.radius_km:
                affected.append(event)
        
        return affected
    
    def get_events_affecting_route(self, route_id: str) -> List[ScenarioEvent]:
        """Get all active events affecting a specific route."""
        return [e for e in self.active_events.values() if route_id in e.affected_routes]
    
    def resolve_event(self, event_id: str, resolution: str = "CLEARED") -> bool:
        """Manually resolve an event."""
        if event_id in self.active_events:
            event = self.active_events[event_id]
            event.is_active = False
            event.resolved_at = datetime.utcnow()
            event.description += f" [RESOLVED: {resolution}]"
            self.event_history.append(event)
            del self.active_events[event_id]
            return True
        return False
    
    def generate_scenario_burst(self,
                               location: Tuple[float, float],
                               terrain: str,
                               intensity: str = "MODERATE") -> List[ScenarioEvent]:
        """
        Generate a burst of related events for heightened scenario.
        Useful for stress testing or dramatic simulation.
        """
        events = []
        
        intensity_config = {
            "LOW": {"count": 1, "severity_boost": 0},
            "MODERATE": {"count": 2, "severity_boost": 0.2},
            "HIGH": {"count": 3, "severity_boost": 0.4},
            "EXTREME": {"count": 5, "severity_boost": 0.6}
        }
        
        config = intensity_config.get(intensity, intensity_config["MODERATE"])
        
        for _ in range(config["count"]):
            # Force event generation
            scenario_type = random.choice(list(ScenarioType))
            event = self.generate_event(
                location=location,
                terrain=terrain,
                weather="CLEAR",
                time_of_day="DAY",
                route_ids=[],
                force_type=scenario_type
            )
            if event:
                events.append(event)
        
        return events
    
    def _haversine(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two points."""
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c
    
    def to_dict(self, event: ScenarioEvent) -> Dict[str, Any]:
        """Convert event to dictionary for API."""
        return {
            "event_id": event.event_id,
            "scenario_type": event.scenario_type.value,
            "event_subtype": event.event_subtype,
            "severity": event.severity.value,
            "title": event.title,
            "description": event.description,
            "location": {
                "lat": event.location[0],
                "lng": event.location[1]
            },
            "radius_km": event.radius_km,
            "affected_routes": event.affected_routes,
            "start_time": event.start_time.isoformat(),
            "estimated_duration_hours": event.estimated_duration_hours,
            "probability_of_escalation": event.probability_of_escalation,
            "recommended_actions": event.recommended_actions,
            "ai_assessment": event.ai_assessment,
            "is_active": event.is_active,
            "resolved_at": event.resolved_at.isoformat() if event.resolved_at else None
        }


# Global instance
scenario_generator = DynamicScenarioGenerator()
