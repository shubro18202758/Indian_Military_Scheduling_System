"""
AI Obstacle Generator - Simulates Janus 7B model behavior
Generates realistic, context-aware obstacles to test the management system.

This module creates diverse obstacle scenarios based on:
- Geographic context (terrain, altitude, weather patterns)
- Temporal context (time of day, season)
- Route characteristics (traffic density, strategic importance)
- Historical patterns (common incident locations)
"""

import asyncio
import random
import math
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.obstacle import Obstacle, SimulationEvent
from app.models.route import Route
from app.models.convoy import Convoy


# Obstacle type configurations with realistic parameters
OBSTACLE_CONFIGS = {
    # Natural obstacles
    "LANDSLIDE": {
        "severity_weights": {"HIGH": 0.4, "CRITICAL": 0.3, "MEDIUM": 0.3},
        "duration_range": (4, 48),  # hours
        "radius_range": (0.2, 1.5),  # km
        "blocks_route_prob": 0.7,
        "speed_reduction": (0.0, 0.3),
        "terrain_affinity": ["MOUNTAINOUS", "HILLY"],
        "seasonal_boost": {"monsoon": 2.0, "winter": 1.5},
        "title_templates": [
            "Landslide at KM {km}",
            "Major earth slip near {location}",
            "Hillside collapse blocking route"
        ]
    },
    "ROCKFALL": {
        "severity_weights": {"MEDIUM": 0.5, "HIGH": 0.3, "LOW": 0.2},
        "duration_range": (1, 8),
        "radius_range": (0.1, 0.5),
        "blocks_route_prob": 0.4,
        "speed_reduction": (0.3, 0.7),
        "terrain_affinity": ["MOUNTAINOUS"],
        "title_templates": [
            "Rockfall debris on road",
            "Boulder obstruction at KM {km}",
            "Rock slide clearing required"
        ]
    },
    "AVALANCHE": {
        "severity_weights": {"CRITICAL": 0.6, "HIGH": 0.4},
        "duration_range": (8, 72),
        "radius_range": (0.5, 3.0),
        "blocks_route_prob": 0.95,
        "speed_reduction": (0.0, 0.1),
        "terrain_affinity": ["MOUNTAINOUS"],
        "seasonal_boost": {"winter": 3.0},
        "altitude_min": 3000,
        "title_templates": [
            "Avalanche blocking passage",
            "Snow avalanche at high altitude sector",
            "Major avalanche - route impassable"
        ]
    },
    "FLOODING": {
        "severity_weights": {"HIGH": 0.4, "MEDIUM": 0.4, "CRITICAL": 0.2},
        "duration_range": (2, 24),
        "radius_range": (0.3, 2.0),
        "blocks_route_prob": 0.5,
        "speed_reduction": (0.1, 0.5),
        "terrain_affinity": ["PLAINS", "VALLEY"],
        "seasonal_boost": {"monsoon": 3.0},
        "title_templates": [
            "Flash flooding on road",
            "Water logging at low-lying section",
            "River overflow affecting route"
        ]
    },
    
    # Weather obstacles
    "WEATHER_SEVERE": {
        "severity_weights": {"HIGH": 0.5, "CRITICAL": 0.3, "MEDIUM": 0.2},
        "duration_range": (2, 12),
        "radius_range": (5, 50),
        "blocks_route_prob": 0.3,
        "speed_reduction": (0.2, 0.5),
        "title_templates": [
            "Severe weather warning issued",
            "Heavy storm approaching",
            "Extreme weather conditions"
        ]
    },
    "SNOWFALL": {
        "severity_weights": {"MEDIUM": 0.4, "HIGH": 0.4, "CRITICAL": 0.2},
        "duration_range": (4, 24),
        "radius_range": (2, 20),
        "blocks_route_prob": 0.4,
        "speed_reduction": (0.2, 0.6),
        "terrain_affinity": ["MOUNTAINOUS"],
        "seasonal_boost": {"winter": 2.5},
        "altitude_min": 2000,
        "title_templates": [
            "Heavy snowfall reducing visibility",
            "Snow accumulation on route",
            "Blizzard conditions"
        ]
    },
    "FOG": {
        "severity_weights": {"LOW": 0.3, "MEDIUM": 0.5, "HIGH": 0.2},
        "duration_range": (1, 8),
        "radius_range": (1, 10),
        "blocks_route_prob": 0.1,
        "speed_reduction": (0.4, 0.7),
        "time_affinity": [(4, 9), (18, 22)],  # Early morning, evening
        "title_templates": [
            "Dense fog advisory",
            "Low visibility due to fog",
            "Fog bank reducing visibility to 50m"
        ]
    },
    
    # Security threats
    "SECURITY_THREAT": {
        "severity_weights": {"HIGH": 0.5, "CRITICAL": 0.4, "MEDIUM": 0.1},
        "duration_range": (2, 12),
        "radius_range": (1, 5),
        "blocks_route_prob": 0.6,
        "speed_reduction": (0.0, 0.3),
        "title_templates": [
            "Security alert in sector",
            "Suspicious activity reported",
            "Area under security review"
        ]
    },
    "IED_SUSPECTED": {
        "severity_weights": {"CRITICAL": 0.7, "HIGH": 0.3},
        "duration_range": (2, 8),
        "radius_range": (0.5, 2),
        "blocks_route_prob": 1.0,
        "speed_reduction": (0.0, 0.0),
        "title_templates": [
            "Suspected IED - Route closed",
            "Explosive device suspected at KM {km}",
            "EOD team dispatched - route blocked"
        ]
    },
    "AMBUSH_RISK": {
        "severity_weights": {"HIGH": 0.6, "CRITICAL": 0.3, "MEDIUM": 0.1},
        "duration_range": (4, 24),
        "radius_range": (2, 10),
        "blocks_route_prob": 0.4,
        "speed_reduction": (0.0, 0.5),
        "time_affinity": [(0, 5), (19, 24)],  # Night hours
        "title_templates": [
            "Ambush risk assessment elevated",
            "Intelligence suggests threat in area",
            "High-risk zone identified"
        ]
    },
    
    # Infrastructure issues
    "BRIDGE_DAMAGE": {
        "severity_weights": {"CRITICAL": 0.5, "HIGH": 0.4, "MEDIUM": 0.1},
        "duration_range": (24, 168),
        "radius_range": (0.1, 0.3),
        "blocks_route_prob": 0.8,
        "speed_reduction": (0.0, 0.2),
        "title_templates": [
            "Bridge structural damage reported",
            "Bridge weight limit reduced",
            "Bridge under emergency inspection"
        ]
    },
    "TCP_CLOSURE": {
        "severity_weights": {"MEDIUM": 0.5, "HIGH": 0.4, "LOW": 0.1},
        "duration_range": (1, 6),
        "radius_range": (0.2, 0.5),
        "blocks_route_prob": 0.3,
        "speed_reduction": (0.0, 0.5),
        "title_templates": [
            "TCP temporarily closed",
            "Checkpoint closure for maintenance",
            "TCP operations suspended"
        ]
    },
    
    # Accidents and breakdowns
    "ACCIDENT": {
        "severity_weights": {"MEDIUM": 0.4, "HIGH": 0.4, "LOW": 0.2},
        "duration_range": (0.5, 4),
        "radius_range": (0.1, 0.3),
        "blocks_route_prob": 0.5,
        "speed_reduction": (0.2, 0.6),
        "title_templates": [
            "Vehicle accident blocking lane",
            "Multi-vehicle collision reported",
            "Accident - recovery operations underway"
        ]
    },
    "BREAKDOWN_ZONE": {
        "severity_weights": {"LOW": 0.4, "MEDIUM": 0.5, "HIGH": 0.1},
        "duration_range": (1, 4),
        "radius_range": (0.1, 0.2),
        "blocks_route_prob": 0.2,
        "speed_reduction": (0.5, 0.8),
        "title_templates": [
            "Broken down vehicle on route",
            "Heavy vehicle breakdown causing delays",
            "Recovery vehicle en route"
        ]
    }
}

# Severity impact multipliers
SEVERITY_IMPACT = {
    "LOW": 25,
    "MEDIUM": 50,
    "HIGH": 75,
    "CRITICAL": 95
}


class ObstacleGenerator:
    """
    AI-powered obstacle generator that creates realistic scenarios.
    Simulates the behavior of Janus 7B model for obstacle generation.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.generation_count = 0
        
    def _get_current_season(self) -> str:
        """Determine current season for J&K region"""
        month = datetime.now().month
        if month in [12, 1, 2]:
            return "winter"
        elif month in [6, 7, 8, 9]:
            return "monsoon"
        elif month in [3, 4, 5]:
            return "spring"
        else:
            return "autumn"
    
    def _get_time_weight(self, hour: int, time_affinity: List[Tuple[int, int]]) -> float:
        """Check if current hour matches time affinity"""
        for start, end in time_affinity:
            if start <= hour <= end:
                return 2.0
        return 1.0
    
    def _select_obstacle_type(self, route: Route) -> str:
        """Select appropriate obstacle type based on route characteristics"""
        terrain = route.terrain_type or "MIXED"
        candidates = []
        weights = []
        
        season = self._get_current_season()
        hour = datetime.now().hour
        
        for obs_type, config in OBSTACLE_CONFIGS.items():
            weight = 1.0
            
            # Terrain affinity
            if "terrain_affinity" in config:
                if terrain in config["terrain_affinity"]:
                    weight *= 2.0
                else:
                    weight *= 0.3
            
            # Seasonal boost
            if "seasonal_boost" in config and season in config["seasonal_boost"]:
                weight *= config["seasonal_boost"][season]
            
            # Time affinity
            if "time_affinity" in config:
                weight *= self._get_time_weight(hour, config["time_affinity"])
            
            # Altitude check (rough estimate based on route)
            if "altitude_min" in config:
                if route.has_high_altitude_pass:
                    weight *= 1.5
                else:
                    weight *= 0.2
            
            candidates.append(obs_type)
            weights.append(weight)
        
        # Normalize weights
        total = sum(weights)
        weights = [w / total for w in weights]
        
        return random.choices(candidates, weights=weights, k=1)[0]
    
    def _select_severity(self, obstacle_type: str) -> str:
        """Select severity based on configured weights"""
        config = OBSTACLE_CONFIGS[obstacle_type]
        severities = list(config["severity_weights"].keys())
        weights = list(config["severity_weights"].values())
        return random.choices(severities, weights=weights, k=1)[0]
    
    def _generate_location_on_route(self, route: Route) -> Tuple[float, float, float]:
        """Generate a realistic location along a route"""
        waypoints = route.waypoints or []
        if len(waypoints) < 2:
            return route.start_lat, route.start_long, 0.0
        
        # Pick a random segment
        idx = random.randint(0, len(waypoints) - 2)
        
        # Interpolate along segment
        progress = random.random()
        lat1, lon1 = waypoints[idx]
        lat2, lon2 = waypoints[idx + 1]
        
        lat = lat1 + (lat2 - lat1) * progress
        lon = lon1 + (lon2 - lon1) * progress
        
        # Estimate km marker
        km_marker = (idx / len(waypoints)) * (route.total_distance_km or 100)
        
        return lat, lon, km_marker
    
    def _generate_title(self, obstacle_type: str, km_marker: float, location: str = "sector") -> str:
        """Generate a realistic title"""
        config = OBSTACLE_CONFIGS[obstacle_type]
        template = random.choice(config["title_templates"])
        return template.format(km=round(km_marker, 1), location=location)
    
    def _generate_description(self, obstacle_type: str, severity: str, route_name: str) -> str:
        """Generate contextual description (simulating LLM output)"""
        descriptions = {
            "LANDSLIDE": f"A {severity.lower()} severity landslide has been detected on {route_name}. Debris and earth material are obstructing the carriageway. Engineering assessment teams have been notified.",
            "ROCKFALL": f"Rock debris has fallen onto the road surface. {severity} priority clearance required. Vehicles advised to proceed with caution in adjacent areas.",
            "AVALANCHE": f"Snow avalanche has blocked the high-altitude section of {route_name}. {severity} alert issued. BRO teams mobilized for clearance operations.",
            "FLOODING": f"Water levels rising at low-lying section of route. {severity} flooding conditions. Vehicles with low ground clearance advised to halt.",
            "WEATHER_SEVERE": f"Severe weather system affecting the region. {severity} conditions expected. All convoy movements under review.",
            "SNOWFALL": f"Heavy snowfall reducing visibility and road conditions. {severity} weather advisory in effect. Snow clearing operations ongoing.",
            "FOG": f"Dense fog reducing visibility significantly. {severity} advisory for all movements. Reduced speed mandatory.",
            "SECURITY_THREAT": f"Intelligence indicates {severity.lower()} security threat in the sector. Enhanced vigilance required. Security forces alerted.",
            "IED_SUSPECTED": f"Suspected IED reported at location. {severity} ALERT. All movements halted. EOD team dispatched.",
            "AMBUSH_RISK": f"Intelligence assessment indicates {severity.lower()} ambush risk in sector. Enhanced security protocols activated.",
            "BRIDGE_DAMAGE": f"Structural concerns identified at bridge. {severity} inspection underway. Weight restrictions may apply.",
            "TCP_CLOSURE": f"Traffic Control Point temporarily non-operational. {severity} priority rerouting may be required.",
            "ACCIDENT": f"Vehicle accident on route. {severity} impact on traffic flow. Recovery operations in progress.",
            "BREAKDOWN_ZONE": f"Heavy vehicle breakdown causing obstruction. {severity} delays expected. Recovery en route."
        }
        return descriptions.get(obstacle_type, f"Obstacle detected on route. Severity: {severity}")
    
    async def generate_obstacle(self, route_id: Optional[int] = None) -> Obstacle:
        """Generate a single obstacle"""
        
        # Get route
        if route_id:
            result = await self.db.execute(select(Route).where(Route.id == route_id))
            route = result.scalars().first()
        else:
            result = await self.db.execute(select(Route))
            routes = result.scalars().all()
            route = random.choice(routes) if routes else None
        
        if not route:
            raise ValueError("No routes available for obstacle generation")
        
        # Generate obstacle parameters
        obstacle_type = self._select_obstacle_type(route)
        severity = self._select_severity(obstacle_type)
        config = OBSTACLE_CONFIGS[obstacle_type]
        
        lat, lon, km_marker = self._generate_location_on_route(route)
        
        duration = random.uniform(*config["duration_range"])
        radius = random.uniform(*config["radius_range"])
        blocks_route = random.random() < config["blocks_route_prob"]
        speed_reduction = random.uniform(*config["speed_reduction"]) if not blocks_route else 0.0
        
        title = self._generate_title(obstacle_type, km_marker)
        description = self._generate_description(obstacle_type, severity, route.name)
        
        # Create obstacle
        obstacle = Obstacle(
            obstacle_type=obstacle_type,
            severity=severity,
            latitude=lat,
            longitude=lon,
            radius_km=radius,
            route_id=route.id,
            route_km_marker=km_marker,
            estimated_duration_hours=duration,
            expires_at=datetime.utcnow() + timedelta(hours=duration),
            impact_score=SEVERITY_IMPACT[severity],
            blocks_route=blocks_route,
            speed_reduction_factor=speed_reduction,
            generated_by="JANUS_SIM",
            generation_context={
                "season": self._get_current_season(),
                "hour": datetime.now().hour,
                "terrain": route.terrain_type,
                "generation_id": self.generation_count
            },
            title=title,
            description=description
        )
        
        self.db.add(obstacle)
        self.generation_count += 1
        
        return obstacle
    
    async def generate_scenario(self, num_obstacles: int = 3) -> List[Obstacle]:
        """Generate a complete scenario with multiple related obstacles"""
        obstacles = []
        
        for _ in range(num_obstacles):
            obstacle = await self.generate_obstacle()
            obstacles.append(obstacle)
        
        await self.db.commit()
        
        # Refresh to get IDs
        for obs in obstacles:
            await self.db.refresh(obs)
        
        return obstacles
    
    async def find_affected_convoys(self, obstacle: Obstacle) -> List[int]:
        """Identify convoys affected by an obstacle"""
        result = await self.db.execute(
            select(Convoy).where(
                Convoy.status.in_(["IN_TRANSIT", "SCHEDULED", "HALTED"]),
                Convoy.route_id == obstacle.route_id
            )
        )
        convoys = result.scalars().all()
        
        affected = []
        for convoy in convoys:
            # Check if convoy is near obstacle
            if convoy.current_lat and convoy.current_long:
                dist = self._haversine(
                    convoy.current_lat, convoy.current_long,
                    obstacle.latitude, obstacle.longitude
                )
                if dist < obstacle.radius_km + 20:  # Within 20km of obstacle
                    affected.append(convoy.id)
        
        return affected
    
    def _haversine(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two points in km"""
        R = 6371
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return R * c
