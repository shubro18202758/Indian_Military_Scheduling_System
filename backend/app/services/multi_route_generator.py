"""
Multi-Route Generator
=======================

Generates multiple realistic military convoy routes for Indian Army operations:
1. Strategic Routes - Major highways connecting military bases
2. Tactical Routes - Alternative paths avoiding known threats
3. Emergency Routes - Quick evacuation/reinforcement paths
4. Logistic Routes - Supply chain optimized paths

Routes are dynamically generated with realistic waypoints based on:
- Actual Indian geography and terrain
- Military installation locations
- Known threat zones
- Weather patterns
- Seasonal variations
"""

import math
import random
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional, Any
from dataclasses import dataclass, field
from enum import Enum


class RouteCategory(Enum):
    STRATEGIC = "STRATEGIC"       # Main supply routes
    TACTICAL = "TACTICAL"         # Combat support routes
    EMERGENCY = "EMERGENCY"       # Emergency/medevac routes
    LOGISTICS = "LOGISTICS"       # Regular supply routes
    PATROL = "PATROL"            # Security patrol routes
    RECONNAISSANCE = "RECONNAISSANCE"  # Recon routes


class TerrainZone(Enum):
    KASHMIR_VALLEY = "KASHMIR_VALLEY"
    LADAKH_HIGH = "LADAKH_HIGH"
    SIACHEN = "SIACHEN"
    PUNJAB_PLAINS = "PUNJAB_PLAINS"
    RAJASTHAN_DESERT = "RAJASTHAN_DESERT"
    NORTHEAST = "NORTHEAST"
    HIMALAYAN_FOOTHILLS = "HIMALAYAN_FOOTHILLS"


@dataclass
class MilitaryBase:
    """Military installation data"""
    name: str
    code: str
    lat: float
    lng: float
    base_type: str  # COMMAND, FORWARD, LOGISTICS, AIRBASE
    capacity: int
    services: List[str]
    threat_zone: str


@dataclass
class RouteDefinition:
    """Complete route definition"""
    route_id: str
    name: str
    code: str
    category: RouteCategory
    start_base: MilitaryBase
    end_base: MilitaryBase
    waypoints: List[Tuple[float, float]]
    total_distance_km: float
    estimated_time_hours: float
    terrain_zones: List[str]
    max_altitude_m: float
    risk_level: str
    active_threats: int
    weather_zone: str
    convoy_capacity: int
    restrictions: List[str]
    color: str  # For map display


class MultiRouteGenerator:
    """
    Generates multiple realistic convoy routes for simulation.
    All routes are dynamically calculated based on real geography.
    """
    
    # Major Military Bases (representative locations)
    BASES = {
        "UDHAMPUR": MilitaryBase("Northern Command HQ", "NCHQ", 32.916, 75.141, "COMMAND", 5000, ["HQ", "LOGISTICS", "MEDICAL"], "JAMMU"),
        "JAMMU": MilitaryBase("Jammu Cantonment", "JAM", 32.726, 74.857, "LOGISTICS", 3000, ["FUEL", "AMMUNITION", "RATIONS"], "JAMMU"),
        "SRINAGAR": MilitaryBase("Srinagar Garrison", "SRN", 34.083, 74.797, "COMMAND", 4000, ["AIRBASE", "LOGISTICS", "MEDICAL"], "KASHMIR"),
        "LEH": MilitaryBase("Leh Base", "LEH", 34.152, 77.577, "FORWARD", 2000, ["FUEL", "AMMUNITION"], "LADAKH"),
        "KARGIL": MilitaryBase("Kargil Forward Base", "KRG", 34.556, 76.134, "FORWARD", 1500, ["AMMUNITION", "RATIONS"], "LADAKH"),
        "PATHANKOT": MilitaryBase("Pathankot Airbase", "PTK", 32.271, 75.652, "AIRBASE", 2500, ["AIRBASE", "FUEL"], "PUNJAB"),
        "AMRITSAR": MilitaryBase("Amritsar Cantonment", "AMR", 31.633, 74.872, "LOGISTICS", 3500, ["LOGISTICS", "MEDICAL"], "PUNJAB"),
        "CHANDIGARH": MilitaryBase("Chandimandir Cantonment", "CHD", 30.735, 76.775, "COMMAND", 4500, ["HQ", "LOGISTICS"], "HARYANA"),
        "DRAS": MilitaryBase("Dras Forward Post", "DRS", 34.431, 75.761, "FORWARD", 800, ["AMMUNITION"], "LADAKH"),
        "SIACHEN_BASE": MilitaryBase("Siachen Base Camp", "SBC", 35.421, 77.109, "FORWARD", 500, ["SPECIALIZED"], "SIACHEN"),
        "TURTUK": MilitaryBase("Turtuk Outpost", "TRT", 34.847, 76.821, "FORWARD", 300, ["PATROL"], "LADAKH"),
        "NYOMA": MilitaryBase("Nyoma ALG", "NYM", 33.191, 78.649, "FORWARD", 600, ["AIRSTRIP", "FUEL"], "LADAKH"),
        "DEMCHOK": MilitaryBase("Demchok Post", "DMK", 32.716, 79.532, "FORWARD", 200, ["PATROL"], "LADAKH"),
        "JAISALMER": MilitaryBase("Jaisalmer Cantonment", "JSM", 26.912, 70.916, "COMMAND", 3000, ["ARMOR", "LOGISTICS"], "RAJASTHAN"),
        "JODHPUR": MilitaryBase("Jodhpur Airbase", "JDP", 26.251, 73.048, "AIRBASE", 2800, ["AIRBASE", "FUEL"], "RAJASTHAN"),
    }
    
    # Strategic route corridors
    ROUTE_CORRIDORS = [
        ("JAMMU", "SRINAGAR", "NH44_MAIN", "STRATEGIC"),
        ("SRINAGAR", "LEH", "ZOJILA_ROUTE", "STRATEGIC"),
        ("SRINAGAR", "KARGIL", "SRINAGAR_KARGIL", "TACTICAL"),
        ("LEH", "SIACHEN_BASE", "SIACHEN_SUPPLY", "EMERGENCY"),
        ("UDHAMPUR", "SRINAGAR", "COMMAND_ROUTE", "STRATEGIC"),
        ("PATHANKOT", "JAMMU", "PUNJAB_LINK", "LOGISTICS"),
        ("CHANDIGARH", "JAMMU", "MAIN_SUPPLY", "LOGISTICS"),
        ("KARGIL", "LEH", "KARGIL_LEH", "TACTICAL"),
        ("LEH", "NYOMA", "EASTERN_LADAKH", "PATROL"),
        ("LEH", "DEMCHOK", "LAC_PATROL", "RECONNAISSANCE"),
        ("JAMMU", "KARGIL", "EMERGENCY_DIRECT", "EMERGENCY"),
        ("AMRITSAR", "PATHANKOT", "WESTERN_SUPPLY", "LOGISTICS"),
        ("JAISALMER", "JODHPUR", "DESERT_ROUTE", "TACTICAL"),
    ]
    
    # Color palette for routes
    ROUTE_COLORS = {
        RouteCategory.STRATEGIC: "#22c55e",    # Green
        RouteCategory.TACTICAL: "#f59e0b",     # Amber
        RouteCategory.EMERGENCY: "#ef4444",    # Red
        RouteCategory.LOGISTICS: "#3b82f6",    # Blue
        RouteCategory.PATROL: "#8b5cf6",       # Purple
        RouteCategory.RECONNAISSANCE: "#06b6d4" # Cyan
    }
    
    def __init__(self):
        self.generated_routes: Dict[str, RouteDefinition] = {}
        self.active_convoys: Dict[str, List[int]] = {}
    
    def generate_all_routes(self) -> List[RouteDefinition]:
        """Generate all predefined route corridors."""
        routes = []
        
        for start_code, end_code, route_code, category in self.ROUTE_CORRIDORS:
            start_base = self.BASES.get(start_code)
            end_base = self.BASES.get(end_code)
            
            if start_base and end_base:
                route = self.generate_route(
                    start_base, 
                    end_base, 
                    route_code,
                    RouteCategory[category]
                )
                routes.append(route)
                self.generated_routes[route.route_id] = route
        
        return routes
    
    def generate_route(self, 
                      start: MilitaryBase,
                      end: MilitaryBase,
                      code: str,
                      category: RouteCategory) -> RouteDefinition:
        """Generate a complete route between two bases."""
        
        # Generate waypoints
        waypoints = self._generate_waypoints(start, end, category)
        
        # Calculate distance
        total_distance = self._calculate_route_distance(waypoints)
        
        # Estimate time based on terrain
        terrain_zones = self._identify_terrain_zones(waypoints)
        avg_speed = self._estimate_average_speed(terrain_zones, category)
        estimated_time = total_distance / avg_speed
        
        # Find max altitude
        max_altitude = self._estimate_max_altitude(waypoints)
        
        # Assess risk
        risk_level = self._assess_route_risk(waypoints, terrain_zones)
        
        # Count active threats
        active_threats = random.randint(0, 3) if risk_level in ["HIGH", "CRITICAL"] else 0
        
        route_id = f"ROUTE_{code}_{start.code}_{end.code}"
        
        return RouteDefinition(
            route_id=route_id,
            name=f"{start.name} to {end.name}",
            code=code,
            category=category,
            start_base=start,
            end_base=end,
            waypoints=waypoints,
            total_distance_km=round(total_distance, 2),
            estimated_time_hours=round(estimated_time, 2),
            terrain_zones=terrain_zones,
            max_altitude_m=max_altitude,
            risk_level=risk_level,
            active_threats=active_threats,
            weather_zone=self._get_weather_zone(waypoints),
            convoy_capacity=self._calculate_convoy_capacity(category),
            restrictions=self._get_route_restrictions(max_altitude, terrain_zones),
            color=self.ROUTE_COLORS.get(category, "#ffffff")
        )
    
    def _generate_waypoints(self, 
                           start: MilitaryBase,
                           end: MilitaryBase,
                           category: RouteCategory) -> List[Tuple[float, float]]:
        """Generate realistic waypoints between two points."""
        waypoints = [(start.lat, start.lng)]
        
        # Calculate direct distance
        direct_dist = self._haversine(start.lat, start.lng, end.lat, end.lng)
        
        # Number of intermediate points based on distance
        num_points = max(20, int(direct_dist / 5))  # One point every ~5km
        
        # Generate path with terrain-aware deviation
        for i in range(1, num_points):
            progress = i / num_points
            
            # Base interpolation
            lat = start.lat + (end.lat - start.lat) * progress
            lng = start.lng + (end.lng - start.lng) * progress
            
            # Add realistic deviation based on terrain
            terrain_factor = self._get_terrain_factor(lat, lng)
            deviation_scale = 0.02 * terrain_factor  # More deviation in rough terrain
            
            # Curved path deviation
            curve_offset = math.sin(progress * math.pi) * deviation_scale
            
            # Random micro-deviations
            lat_dev = random.uniform(-0.005, 0.005) * terrain_factor
            lng_dev = random.uniform(-0.005, 0.005) * terrain_factor
            
            # Apply deviations
            lat += curve_offset + lat_dev
            lng += curve_offset * 0.5 + lng_dev
            
            # For mountain routes, follow valley patterns
            if self._is_mountain_region(lat, lng):
                lat, lng = self._adjust_for_valleys(lat, lng, start, end)
            
            waypoints.append((round(lat, 6), round(lng, 6)))
        
        waypoints.append((end.lat, end.lng))
        return waypoints
    
    def _haversine(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance in km between two points."""
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c
    
    def _calculate_route_distance(self, waypoints: List[Tuple[float, float]]) -> float:
        """Calculate total route distance."""
        total = 0
        for i in range(len(waypoints) - 1):
            total += self._haversine(
                waypoints[i][0], waypoints[i][1],
                waypoints[i+1][0], waypoints[i+1][1]
            )
        return total
    
    def _get_terrain_factor(self, lat: float, lng: float) -> float:
        """Get terrain difficulty factor for a location."""
        # Himalayas (higher = more difficult)
        if lat > 34:
            return 2.5
        elif lat > 32:
            return 1.8
        elif lat > 30:
            return 1.3
        # Desert regions
        if lat < 28 and lng < 75:
            return 1.5
        return 1.0
    
    def _is_mountain_region(self, lat: float, lng: float) -> bool:
        """Check if location is in mountain region."""
        return lat > 32 or (lat > 30 and lng > 76)
    
    def _adjust_for_valleys(self, lat: float, lng: float,
                           start: MilitaryBase, end: MilitaryBase) -> Tuple[float, float]:
        """Adjust coordinates to follow valley patterns."""
        # Simplified valley following
        # In reality, this would use terrain data
        lat_adjust = random.uniform(-0.01, 0.01)
        lng_adjust = random.uniform(-0.01, 0.01)
        return lat + lat_adjust, lng + lng_adjust
    
    def _identify_terrain_zones(self, waypoints: List[Tuple[float, float]]) -> List[str]:
        """Identify terrain zones along the route."""
        zones = set()
        
        for lat, lng in waypoints:
            if lat > 35:
                zones.add("SIACHEN")
            elif lat > 33.5:
                zones.add("LADAKH_HIGH")
            elif lat > 32 and lng > 74 and lng < 76:
                zones.add("KASHMIR_VALLEY")
            elif lat > 30 and lat < 33:
                zones.add("HIMALAYAN_FOOTHILLS")
            elif lat < 28 and lng < 75:
                zones.add("RAJASTHAN_DESERT")
            elif lng > 88:
                zones.add("NORTHEAST")
            else:
                zones.add("PUNJAB_PLAINS")
        
        return list(zones)
    
    def _estimate_average_speed(self, terrain_zones: List[str], 
                                category: RouteCategory) -> float:
        """Estimate average convoy speed based on terrain."""
        base_speeds = {
            "PUNJAB_PLAINS": 50,
            "HIMALAYAN_FOOTHILLS": 35,
            "KASHMIR_VALLEY": 30,
            "LADAKH_HIGH": 25,
            "SIACHEN": 15,
            "RAJASTHAN_DESERT": 40,
            "NORTHEAST": 30
        }
        
        if not terrain_zones:
            return 40
        
        avg_speed = sum(base_speeds.get(z, 40) for z in terrain_zones) / len(terrain_zones)
        
        # Category adjustments
        if category == RouteCategory.EMERGENCY:
            avg_speed *= 1.2  # Faster for emergency
        elif category == RouteCategory.LOGISTICS:
            avg_speed *= 0.9  # Slower for heavy loads
        
        return avg_speed
    
    def _estimate_max_altitude(self, waypoints: List[Tuple[float, float]]) -> float:
        """Estimate maximum altitude along route."""
        max_alt = 0
        
        for lat, lng in waypoints:
            # Simple altitude model based on latitude
            if lat > 35:
                alt = 5500 + random.uniform(-200, 200)
            elif lat > 34:
                alt = 4500 + random.uniform(-300, 300)
            elif lat > 33:
                alt = 3500 + random.uniform(-400, 400)
            elif lat > 32:
                alt = 2000 + random.uniform(-300, 300)
            else:
                alt = 500 + random.uniform(-100, 100)
            
            max_alt = max(max_alt, alt)
        
        return round(max_alt, 0)
    
    def _assess_route_risk(self, waypoints: List[Tuple[float, float]],
                          terrain_zones: List[str]) -> str:
        """Assess overall route risk level."""
        risk_score = 0
        
        # Terrain risk
        high_risk_zones = ["SIACHEN", "LADAKH_HIGH", "KASHMIR_VALLEY"]
        for zone in terrain_zones:
            if zone in high_risk_zones:
                risk_score += 30
            else:
                risk_score += 10
        
        # Altitude risk
        max_alt = self._estimate_max_altitude(waypoints)
        if max_alt > 5000:
            risk_score += 30
        elif max_alt > 4000:
            risk_score += 20
        elif max_alt > 3000:
            risk_score += 10
        
        # Normalize
        risk_score = min(100, risk_score)
        
        if risk_score > 70:
            return "CRITICAL"
        elif risk_score > 50:
            return "HIGH"
        elif risk_score > 30:
            return "MEDIUM"
        return "LOW"
    
    def _get_weather_zone(self, waypoints: List[Tuple[float, float]]) -> str:
        """Get primary weather zone for route."""
        if not waypoints:
            return "TEMPERATE"
        
        avg_lat = sum(w[0] for w in waypoints) / len(waypoints)
        
        if avg_lat > 34:
            return "ARCTIC"
        elif avg_lat > 32:
            return "ALPINE"
        elif avg_lat < 28:
            return "DESERT"
        return "TEMPERATE"
    
    def _calculate_convoy_capacity(self, category: RouteCategory) -> int:
        """Calculate maximum convoy capacity for route."""
        capacities = {
            RouteCategory.STRATEGIC: 20,
            RouteCategory.TACTICAL: 12,
            RouteCategory.EMERGENCY: 8,
            RouteCategory.LOGISTICS: 25,
            RouteCategory.PATROL: 6,
            RouteCategory.RECONNAISSANCE: 4
        }
        return capacities.get(category, 10)
    
    def _get_route_restrictions(self, max_altitude: float,
                               terrain_zones: List[str]) -> List[str]:
        """Get restrictions applicable to route."""
        restrictions = []
        
        if max_altitude > 5000:
            restrictions.append("HIGH_ALTITUDE_VEHICLES_ONLY")
            restrictions.append("OXYGEN_EQUIPMENT_REQUIRED")
        elif max_altitude > 4000:
            restrictions.append("ALTITUDE_ACCLIMATIZATION_NEEDED")
        
        if "SIACHEN" in terrain_zones:
            restrictions.append("SPECIALIZED_COLD_WEATHER_GEAR")
            restrictions.append("ESCORT_REQUIRED")
        
        if "KASHMIR_VALLEY" in terrain_zones:
            restrictions.append("SECURITY_ESCORT_RECOMMENDED")
        
        if "RAJASTHAN_DESERT" in terrain_zones:
            restrictions.append("EXTENDED_FUEL_CAPACITY")
            restrictions.append("NIGHT_MOVEMENT_PREFERRED")
        
        return restrictions
    
    def get_route_by_id(self, route_id: str) -> Optional[RouteDefinition]:
        """Get a generated route by ID."""
        return self.generated_routes.get(route_id)
    
    def get_routes_by_category(self, category: RouteCategory) -> List[RouteDefinition]:
        """Get all routes of a specific category."""
        return [r for r in self.generated_routes.values() if r.category == category]
    
    def get_routes_from_base(self, base_code: str) -> List[RouteDefinition]:
        """Get all routes originating from a base."""
        return [r for r in self.generated_routes.values() 
                if r.start_base.code == base_code or r.end_base.code == base_code]
    
    def to_dict(self, route: RouteDefinition) -> Dict[str, Any]:
        """Convert route to dictionary for API."""
        return {
            "route_id": route.route_id,
            "name": route.name,
            "code": route.code,
            "category": route.category.value,
            "start": {
                "name": route.start_base.name,
                "code": route.start_base.code,
                "lat": route.start_base.lat,
                "lng": route.start_base.lng
            },
            "end": {
                "name": route.end_base.name,
                "code": route.end_base.code,
                "lat": route.end_base.lat,
                "lng": route.end_base.lng
            },
            "waypoints": route.waypoints,
            "total_distance_km": route.total_distance_km,
            "estimated_time_hours": route.estimated_time_hours,
            "terrain_zones": route.terrain_zones,
            "max_altitude_m": route.max_altitude_m,
            "risk_level": route.risk_level,
            "active_threats": route.active_threats,
            "weather_zone": route.weather_zone,
            "convoy_capacity": route.convoy_capacity,
            "restrictions": route.restrictions,
            "color": route.color
        }
    
    def generate_scenario_routes(self, scenario_type: str) -> List[RouteDefinition]:
        """Generate routes for a specific scenario."""
        scenarios = {
            "LADAKH_SUPPLY": [
                ("JAMMU", "LEH", "SUPPLY_MAIN", "LOGISTICS"),
                ("SRINAGAR", "KARGIL", "SRINAGAR_SUPPORT", "TACTICAL"),
                ("LEH", "NYOMA", "EASTERN_PATROL", "PATROL")
            ],
            "KASHMIR_OPS": [
                ("JAMMU", "SRINAGAR", "KASHMIR_MAIN", "STRATEGIC"),
                ("UDHAMPUR", "SRINAGAR", "COMMAND_LINE", "TACTICAL"),
                ("PATHANKOT", "JAMMU", "RESUPPLY", "LOGISTICS")
            ],
            "DESERT_EXERCISE": [
                ("JODHPUR", "JAISALMER", "DESERT_MAIN", "STRATEGIC"),
                ("JAISALMER", "JODHPUR", "RETURN_ROUTE", "LOGISTICS")
            ],
            "EMERGENCY_RESPONSE": [
                ("CHANDIGARH", "SRINAGAR", "EMERGENCY_1", "EMERGENCY"),
                ("JAMMU", "KARGIL", "EMERGENCY_2", "EMERGENCY"),
                ("LEH", "SIACHEN_BASE", "SIACHEN_EMERGENCY", "EMERGENCY")
            ]
        }
        
        routes = []
        scenario_routes = scenarios.get(scenario_type, scenarios["LADAKH_SUPPLY"])
        
        for start_code, end_code, route_code, category in scenario_routes:
            start_base = self.BASES.get(start_code)
            end_base = self.BASES.get(end_code)
            
            if start_base and end_base:
                route = self.generate_route(
                    start_base,
                    end_base,
                    route_code,
                    RouteCategory[category]
                )
                routes.append(route)
                self.generated_routes[route.route_id] = route
        
        return routes


# Global instance
route_generator = MultiRouteGenerator()
