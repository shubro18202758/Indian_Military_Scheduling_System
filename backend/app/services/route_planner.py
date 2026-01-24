"""
Vehicle Routing Problem (VRP) Solver using Google OR-Tools
Optimizes convoy routes considering multiple constraints.
"""
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
from typing import List, Dict, Any, Optional, Tuple
import math


class ConvoyRoutePlanner:
    """
    Solves the Vehicle Routing Problem for convoy planning.
    Optimizes routes to minimize total distance/time while respecting constraints.
    """
    
    def __init__(self):
        self.distance_matrix = None
        self.time_matrix = None
        self.locations = None
    
    def _haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance in km between two points."""
        R = 6371.0  # Earth radius in km
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c
    
    def _build_distance_matrix(self, locations: List[Dict[str, Any]]) -> List[List[int]]:
        """Build distance matrix from locations (in meters for solver precision)."""
        n = len(locations)
        matrix = [[0] * n for _ in range(n)]
        
        for i in range(n):
            for j in range(n):
                if i != j:
                    dist_km = self._haversine_distance(
                        locations[i]["lat"], locations[i]["lon"],
                        locations[j]["lat"], locations[j]["lon"]
                    )
                    matrix[i][j] = int(dist_km * 1000)  # Convert to meters
        
        return matrix
    
    def _build_time_matrix(
        self,
        distance_matrix: List[List[int]],
        speed_kmh: float = 40.0,
        service_time_minutes: int = 10
    ) -> List[List[int]]:
        """Build time matrix from distance matrix (in minutes)."""
        n = len(distance_matrix)
        speed_mpm = (speed_kmh * 1000) / 60  # meters per minute
        
        matrix = [[0] * n for _ in range(n)]
        for i in range(n):
            for j in range(n):
                if i != j:
                    travel_time = distance_matrix[i][j] / speed_mpm if speed_mpm > 0 else 0
                    matrix[i][j] = int(travel_time + service_time_minutes)
        
        return matrix
    
    def optimize_multi_convoy_routes(
        self,
        depot: Dict[str, Any],
        delivery_points: List[Dict[str, Any]],
        num_vehicles: int,
        vehicle_capacities: Optional[List[int]] = None,
        demands: Optional[List[int]] = None,
        max_distance_per_vehicle: int = 500000,  # 500 km in meters
        speed_kmh: float = 40.0,
    ) -> Dict[str, Any]:
        """
        Optimize routes for multiple convoys/vehicles.
        
        Args:
            depot: Starting point {"lat": float, "lon": float, "name": str}
            delivery_points: List of destinations with lat, lon, name, demand
            num_vehicles: Number of available vehicles/convoys
            vehicle_capacities: Capacity of each vehicle (optional)
            demands: Demand at each location (optional)
            max_distance_per_vehicle: Max distance per vehicle in meters
            speed_kmh: Average speed for time calculation
        
        Returns:
            Optimized routes for each vehicle
        """
        # Build locations list (depot at index 0)
        locations = [depot] + delivery_points
        self.locations = locations
        
        # Build matrices
        self.distance_matrix = self._build_distance_matrix(locations)
        self.time_matrix = self._build_time_matrix(self.distance_matrix, speed_kmh)
        
        # Create routing index manager
        manager = pywrapcp.RoutingIndexManager(
            len(locations),  # Number of locations
            num_vehicles,    # Number of vehicles
            0                # Depot index
        )
        
        # Create routing model
        routing = pywrapcp.RoutingModel(manager)
        
        # Distance callback
        def distance_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return self.distance_matrix[from_node][to_node]
        
        transit_callback_index = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
        
        # Add distance constraint
        routing.AddDimension(
            transit_callback_index,
            0,  # No slack
            max_distance_per_vehicle,  # Maximum distance per vehicle
            True,  # Start cumul at zero
            "Distance"
        )
        distance_dimension = routing.GetDimensionOrDie("Distance")
        distance_dimension.SetGlobalSpanCostCoefficient(100)
        
        # Add capacity constraints if provided
        if vehicle_capacities and demands:
            def demand_callback(from_index):
                from_node = manager.IndexToNode(from_index)
                if from_node == 0:  # Depot
                    return 0
                return demands[from_node - 1]  # -1 because depot is at index 0
            
            demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
            routing.AddDimensionWithVehicleCapacity(
                demand_callback_index,
                0,  # Null slack
                vehicle_capacities,  # Vehicle capacities
                True,  # Start cumul at zero
                "Capacity"
            )
        
        # Set search parameters
        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        )
        search_parameters.local_search_metaheuristic = (
            routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        )
        search_parameters.time_limit.seconds = 30
        
        # Solve
        solution = routing.SolveWithParameters(search_parameters)
        
        if not solution:
            return {
                "status": "FAILED",
                "message": "No solution found",
                "routes": []
            }
        
        # Extract solution
        routes = []
        total_distance = 0
        total_time = 0
        
        for vehicle_id in range(num_vehicles):
            route = {
                "vehicle_id": vehicle_id,
                "stops": [],
                "total_distance_km": 0,
                "estimated_time_minutes": 0,
            }
            
            index = routing.Start(vehicle_id)
            route_distance = 0
            route_time = 0
            
            while not routing.IsEnd(index):
                node = manager.IndexToNode(index)
                location = locations[node]
                
                route["stops"].append({
                    "index": node,
                    "name": location.get("name", f"Location-{node}"),
                    "lat": location["lat"],
                    "lon": location["lon"],
                    "cumulative_distance_km": round(route_distance / 1000, 2),
                })
                
                previous_index = index
                index = solution.Value(routing.NextVar(index))
                
                route_distance += self.distance_matrix[manager.IndexToNode(previous_index)][manager.IndexToNode(index)]
                route_time += self.time_matrix[manager.IndexToNode(previous_index)][manager.IndexToNode(index)]
            
            # Add return to depot
            node = manager.IndexToNode(index)
            route["stops"].append({
                "index": node,
                "name": locations[node].get("name", "Depot"),
                "lat": locations[node]["lat"],
                "lon": locations[node]["lon"],
                "cumulative_distance_km": round(route_distance / 1000, 2),
            })
            
            route["total_distance_km"] = round(route_distance / 1000, 2)
            route["estimated_time_minutes"] = route_time
            
            # Only add routes that have stops (not just depot-depot)
            if len(route["stops"]) > 2:
                routes.append(route)
                total_distance += route_distance
                total_time += route_time
        
        return {
            "status": "OPTIMAL",
            "total_distance_km": round(total_distance / 1000, 2),
            "total_time_minutes": total_time,
            "vehicles_used": len(routes),
            "routes": routes,
        }
    
    def find_optimal_route_sequence(
        self,
        waypoints: List[Dict[str, Any]],
        must_visit_order: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """
        Find optimal sequence to visit waypoints (TSP variant).
        Useful for planning single convoy route through multiple stops.
        """
        if len(waypoints) < 2:
            return {"status": "TRIVIAL", "sequence": [0] if waypoints else [], "total_distance_km": 0}
        
        locations = waypoints
        self.locations = locations
        distance_matrix = self._build_distance_matrix(locations)
        
        # Create routing model for single vehicle TSP
        manager = pywrapcp.RoutingIndexManager(len(locations), 1, 0)
        routing = pywrapcp.RoutingModel(manager)
        
        def distance_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return distance_matrix[from_node][to_node]
        
        transit_callback_index = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
        
        # Add ordering constraints if specified
        if must_visit_order:
            for i in range(len(must_visit_order) - 1):
                routing.AddPickupAndDelivery(
                    manager.NodeToIndex(must_visit_order[i]),
                    manager.NodeToIndex(must_visit_order[i + 1])
                )
        
        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        )
        
        solution = routing.SolveWithParameters(search_parameters)
        
        if not solution:
            return {"status": "FAILED", "sequence": [], "total_distance_km": 0}
        
        # Extract sequence
        sequence = []
        total_distance = 0
        index = routing.Start(0)
        
        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            sequence.append({
                "index": node,
                "name": locations[node].get("name", f"Point-{node}"),
                "lat": locations[node]["lat"],
                "lon": locations[node]["lon"],
            })
            previous_index = index
            index = solution.Value(routing.NextVar(index))
            total_distance += distance_matrix[manager.IndexToNode(previous_index)][manager.IndexToNode(index)]
        
        return {
            "status": "OPTIMAL",
            "sequence": sequence,
            "total_distance_km": round(total_distance / 1000, 2),
        }


# Singleton instance
route_planner = ConvoyRoutePlanner()


if __name__ == "__main__":
    planner = ConvoyRoutePlanner()
    
    # Test multi-convoy routing
    depot = {"lat": 32.6896, "lon": 74.8376, "name": "Jammu HQ"}
    
    destinations = [
        {"lat": 33.0, "lon": 75.0, "name": "Forward Base Alpha"},
        {"lat": 33.2, "lon": 75.2, "name": "Supply Point Bravo"},
        {"lat": 33.5, "lon": 75.1, "name": "Checkpoint Charlie"},
        {"lat": 33.8, "lon": 75.0, "name": "Transit Camp Delta"},
        {"lat": 33.98, "lon": 74.77, "name": "Srinagar HQ"},
    ]
    
    result = planner.optimize_multi_convoy_routes(
        depot=depot,
        delivery_points=destinations,
        num_vehicles=2,
        speed_kmh=45,
    )
    
    print(f"\n=== Multi-Convoy Route Optimization ===")
    print(f"Status: {result['status']}")
    print(f"Total Distance: {result['total_distance_km']} km")
    print(f"Vehicles Used: {result['vehicles_used']}")
    
    for route in result["routes"]:
        print(f"\n--- Vehicle {route['vehicle_id']} ---")
        print(f"Distance: {route['total_distance_km']} km")
        print(f"Time: {route['estimated_time_minutes']} min")
        for stop in route["stops"]:
            print(f"  -> {stop['name']} ({stop['cumulative_distance_km']} km)")
