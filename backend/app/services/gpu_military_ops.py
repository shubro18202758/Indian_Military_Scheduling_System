"""
GPU-Accelerated Military Operations

Provides GPU-accelerated computations for:
- Large fleet analysis
- Monte Carlo threat assessment
- Parallel convoy simulation
- Matrix operations for route optimization
"""

import numpy as np
from typing import Dict, List, Any, Optional, Tuple
import random
import math
from dataclasses import dataclass

# Try to import CuPy for GPU acceleration
GPU_AVAILABLE = False
try:
    import cupy as cp
    GPU_AVAILABLE = True
except ImportError:
    cp = None
    print("[GPU_OPS] CuPy not available - falling back to NumPy")


@dataclass
class GPUConfig:
    """GPU configuration settings"""
    enabled: bool = False
    device_id: int = 0
    memory_limit_gb: float = 4.0
    batch_size: int = 1000


class GPUMilitaryOps:
    """GPU-accelerated military logistics operations"""
    
    def __init__(self, config: Optional[GPUConfig] = None):
        self.config = config or GPUConfig()
        self.gpu_available = GPU_AVAILABLE and self.config.enabled
        self.xp = cp if self.gpu_available else np
        
        if self.gpu_available:
            try:
                cp.cuda.Device(self.config.device_id).use()
                print(f"[GPU_OPS] Using GPU device {self.config.device_id}")
            except Exception as e:
                print(f"[GPU_OPS] GPU initialization failed: {e}")
                self.gpu_available = False
                self.xp = np
    
    def get_status(self) -> Dict[str, Any]:
        """Get GPU operation status"""
        status = {
            "gpu_available": self.gpu_available,
            "backend": "CuPy (CUDA)" if self.gpu_available else "NumPy (CPU)",
            "config": {
                "enabled": self.config.enabled,
                "device_id": self.config.device_id,
                "memory_limit_gb": self.config.memory_limit_gb,
            }
        }
        
        if self.gpu_available:
            try:
                device = cp.cuda.Device(self.config.device_id)
                mem_info = device.mem_info
                status["gpu_memory"] = {
                    "free_mb": round(mem_info[0] / 1024**2, 2),
                    "total_mb": round(mem_info[1] / 1024**2, 2),
                    "used_percent": round((1 - mem_info[0] / mem_info[1]) * 100, 1),
                }
            except Exception:
                pass
        
        return status
    
    # =========================================
    # FLEET ANALYSIS
    # =========================================
    
    def analyze_fleet_efficiency(self, 
                                  vehicle_data: List[Dict],
                                  distance_matrix: Optional[np.ndarray] = None) -> Dict[str, Any]:
        """
        Analyze fleet efficiency using matrix operations
        
        Args:
            vehicle_data: List of dicts with vehicle info
            distance_matrix: Optional NxN distance matrix between locations
        """
        n_vehicles = len(vehicle_data)
        
        # Convert to arrays
        capacities = self.xp.array([v.get("capacity_tons", 4) for v in vehicle_data])
        loads = self.xp.array([v.get("current_load_tons", 0) for v in vehicle_data])
        fuel_efficiency = self.xp.array([v.get("fuel_efficiency_kmpl", 3.5) for v in vehicle_data])
        
        # Calculate utilization
        utilization = loads / capacities
        utilization = self.xp.clip(utilization, 0, 1)
        
        # Fleet statistics
        avg_utilization = float(self.xp.mean(utilization))
        max_utilization = float(self.xp.max(utilization))
        min_utilization = float(self.xp.min(utilization))
        std_utilization = float(self.xp.std(utilization))
        
        # Identify underutilized vehicles
        underutilized = self.xp.where(utilization < 0.5)[0]
        overutilized = self.xp.where(utilization > 0.9)[0]
        
        # Fuel efficiency analysis
        avg_fuel_eff = float(self.xp.mean(fuel_efficiency))
        total_capacity = float(self.xp.sum(capacities))
        total_load = float(self.xp.sum(loads))
        
        # Balance score (how evenly distributed is the load)
        balance_score = 100 * (1 - std_utilization / max(avg_utilization, 0.01))
        
        return {
            "fleet_size": n_vehicles,
            "total_capacity_tons": round(total_capacity, 1),
            "total_load_tons": round(total_load, 1),
            "avg_utilization_percent": round(avg_utilization * 100, 1),
            "max_utilization_percent": round(max_utilization * 100, 1),
            "min_utilization_percent": round(min_utilization * 100, 1),
            "balance_score": round(max(0, min(100, balance_score)), 1),
            "underutilized_count": int(len(underutilized)),
            "overutilized_count": int(len(overutilized)),
            "avg_fuel_efficiency_kmpl": round(avg_fuel_eff, 2),
            "recommendations": self._generate_fleet_recommendations(
                avg_utilization, len(underutilized), len(overutilized), n_vehicles
            ),
            "computed_on": "GPU" if self.gpu_available else "CPU",
        }
    
    def _generate_fleet_recommendations(self, 
                                         avg_util: float, 
                                         underutilized: int,
                                         overutilized: int,
                                         total: int) -> List[str]:
        """Generate fleet optimization recommendations"""
        recommendations = []
        
        if avg_util < 0.6:
            recommendations.append("Fleet underutilized — consolidate loads to reduce vehicles deployed")
        if underutilized > total * 0.3:
            recommendations.append(f"{underutilized} vehicles below 50% capacity — redistribute cargo")
        if overutilized > 0:
            recommendations.append(f"{overutilized} vehicles near capacity — monitor for overloading")
        if avg_util > 0.85:
            recommendations.append("Fleet near capacity — consider adding reserve vehicles")
        
        if not recommendations:
            recommendations.append("Fleet utilization optimal — no immediate action required")
        
        return recommendations
    
    # =========================================
    # MONTE CARLO THREAT SIMULATION
    # =========================================
    
    def monte_carlo_threat_assessment(self,
                                       route_params: Dict,
                                       n_simulations: int = 10000) -> Dict[str, Any]:
        """
        Monte Carlo simulation for threat assessment
        
        Args:
            route_params: Dict with base_threat, variance factors
            n_simulations: Number of simulation runs
        """
        base_threat = route_params.get("base_threat", 0.3)
        terrain_var = route_params.get("terrain_variance", 0.1)
        time_var = route_params.get("time_variance", 0.05)
        intel_var = route_params.get("intel_variance", 0.1)
        
        # Generate random threat samples
        terrain_samples = self.xp.random.normal(0, terrain_var, n_simulations)
        time_samples = self.xp.random.normal(0, time_var, n_simulations)
        intel_samples = self.xp.random.normal(0, intel_var, n_simulations)
        
        # Calculate total threat for each simulation
        total_threats = base_threat + terrain_samples + time_samples + intel_samples
        total_threats = self.xp.clip(total_threats, 0, 1)
        
        # Statistics
        mean_threat = float(self.xp.mean(total_threats))
        std_threat = float(self.xp.std(total_threats))
        p95_threat = float(self.xp.percentile(total_threats, 95))
        p99_threat = float(self.xp.percentile(total_threats, 99))
        max_threat = float(self.xp.max(total_threats))
        
        # Threat level distribution
        green_pct = float(self.xp.mean(total_threats < 0.3) * 100)
        yellow_pct = float(self.xp.mean((total_threats >= 0.3) & (total_threats < 0.5)) * 100)
        orange_pct = float(self.xp.mean((total_threats >= 0.5) & (total_threats < 0.7)) * 100)
        red_pct = float(self.xp.mean(total_threats >= 0.7) * 100)
        
        # Confidence intervals
        ci_lower = float(self.xp.percentile(total_threats, 2.5))
        ci_upper = float(self.xp.percentile(total_threats, 97.5))
        
        return {
            "simulations_run": n_simulations,
            "mean_threat_score": round(mean_threat * 100, 1),
            "std_deviation": round(std_threat * 100, 2),
            "95th_percentile": round(p95_threat * 100, 1),
            "99th_percentile": round(p99_threat * 100, 1),
            "max_observed": round(max_threat * 100, 1),
            "confidence_interval_95": {
                "lower": round(ci_lower * 100, 1),
                "upper": round(ci_upper * 100, 1),
            },
            "threat_distribution": {
                "GREEN": round(green_pct, 1),
                "YELLOW": round(yellow_pct, 1),
                "ORANGE": round(orange_pct, 1),
                "RED": round(red_pct, 1),
            },
            "risk_assessment": self._assess_monte_carlo_risk(p95_threat, red_pct),
            "computed_on": "GPU" if self.gpu_available else "CPU",
        }
    
    def _assess_monte_carlo_risk(self, p95: float, red_pct: float) -> Dict[str, Any]:
        """Assess risk based on Monte Carlo results"""
        if p95 >= 0.7 or red_pct > 20:
            level = "CRITICAL"
            action = "ABORT or request heavy escort"
        elif p95 >= 0.5 or red_pct > 10:
            level = "HIGH"
            action = "Armed escort and alternative route planning required"
        elif p95 >= 0.3 or red_pct > 5:
            level = "MODERATE"
            action = "Enhanced vigilance, consider timing changes"
        else:
            level = "LOW"
            action = "Standard precautions sufficient"
        
        return {
            "level": level,
            "recommended_action": action,
            "escort_required": level in ["CRITICAL", "HIGH"],
        }
    
    # =========================================
    # PARALLEL CONVOY SIMULATION
    # =========================================
    
    def simulate_convoy_journey(self,
                                 convoy_params: Dict,
                                 n_scenarios: int = 1000) -> Dict[str, Any]:
        """
        Simulate convoy journey with multiple scenarios
        
        Args:
            convoy_params: Convoy configuration
            n_scenarios: Number of scenarios to simulate
        """
        distance_km = convoy_params.get("distance_km", 200)
        base_speed_kmph = convoy_params.get("base_speed_kmph", 35)
        vehicle_count = convoy_params.get("vehicle_count", 10)
        
        # Random factors
        weather_factor = self.xp.random.uniform(0.7, 1.0, n_scenarios)
        traffic_factor = self.xp.random.uniform(0.8, 1.0, n_scenarios)
        terrain_factor = self.xp.random.uniform(0.6, 1.0, n_scenarios)
        breakdown_factor = self.xp.random.uniform(0.9, 1.0, n_scenarios)
        
        # Effective speed
        effective_speeds = base_speed_kmph * weather_factor * traffic_factor * terrain_factor * breakdown_factor
        
        # Journey times
        journey_times = distance_km / effective_speeds
        
        # Add random delays (halts, checks, etc.)
        halt_delays = self.xp.random.exponential(0.5, n_scenarios)  # hours
        total_times = journey_times + halt_delays
        
        # Fuel consumption variation
        base_consumption = convoy_params.get("fuel_consumption_l", 500)
        fuel_variance = self.xp.random.normal(1.0, 0.1, n_scenarios)
        terrain_fuel_mult = 1.0 / terrain_factor
        fuel_consumed = base_consumption * fuel_variance * terrain_fuel_mult
        
        # Statistics
        results = {
            "scenarios_simulated": n_scenarios,
            "journey_time": {
                "mean_hours": round(float(self.xp.mean(total_times)), 2),
                "std_hours": round(float(self.xp.std(total_times)), 2),
                "best_case_hours": round(float(self.xp.percentile(total_times, 5)), 2),
                "worst_case_hours": round(float(self.xp.percentile(total_times, 95)), 2),
                "median_hours": round(float(self.xp.median(total_times)), 2),
            },
            "fuel_consumption": {
                "mean_liters": round(float(self.xp.mean(fuel_consumed)), 1),
                "max_liters": round(float(self.xp.percentile(fuel_consumed, 95)), 1),
                "safety_reserve_liters": round(float(self.xp.percentile(fuel_consumed, 99)) * 1.1, 1),
            },
            "effective_speed": {
                "mean_kmph": round(float(self.xp.mean(effective_speeds)), 1),
                "min_kmph": round(float(self.xp.percentile(effective_speeds, 5)), 1),
            },
            "delay_analysis": {
                "mean_delay_hours": round(float(self.xp.mean(halt_delays)), 2),
                "max_delay_hours": round(float(self.xp.percentile(halt_delays, 95)), 2),
            },
            "on_time_probability": round(float(self.xp.mean(total_times < distance_km / base_speed_kmph * 1.5)) * 100, 1),
            "computed_on": "GPU" if self.gpu_available else "CPU",
        }
        
        return results
    
    # =========================================
    # ROUTE OPTIMIZATION (A* VARIANT)
    # =========================================
    
    def optimize_route_gpu(self,
                           adjacency_matrix: np.ndarray,
                           weights: np.ndarray,
                           start: int,
                           end: int,
                           constraints: Optional[Dict] = None) -> Dict[str, Any]:
        """
        GPU-accelerated route optimization using modified Dijkstra/A*
        
        Args:
            adjacency_matrix: NxN connectivity matrix
            weights: NxN edge weights (distance/time)
            start: Start node index
            end: End node index
            constraints: Optional weight limits, avoid nodes, etc.
        """
        n_nodes = adjacency_matrix.shape[0]
        
        # Convert to GPU arrays if available
        adj = self.xp.array(adjacency_matrix)
        w = self.xp.array(weights)
        
        # Initialize distances
        distances = self.xp.full(n_nodes, self.xp.inf)
        distances[start] = 0
        visited = self.xp.zeros(n_nodes, dtype=bool)
        predecessors = self.xp.full(n_nodes, -1, dtype=int)
        
        # Apply constraints (avoid nodes)
        if constraints and "avoid_nodes" in constraints:
            for node in constraints["avoid_nodes"]:
                adj[node, :] = 0
                adj[:, node] = 0
        
        # Modified Dijkstra
        for _ in range(n_nodes):
            # Find minimum unvisited
            unvisited_distances = self.xp.where(visited, self.xp.inf, distances)
            current = int(self.xp.argmin(unvisited_distances))
            
            if distances[current] == self.xp.inf:
                break
            
            if current == end:
                break
            
            visited[current] = True
            
            # Update neighbors
            neighbors = self.xp.where(adj[current] > 0)[0]
            for neighbor in neighbors:
                neighbor = int(neighbor)
                if not visited[neighbor]:
                    new_dist = distances[current] + w[current, neighbor]
                    if new_dist < distances[neighbor]:
                        distances[neighbor] = new_dist
                        predecessors[neighbor] = current
        
        # Reconstruct path
        path = []
        current = end
        while current != -1:
            path.append(int(current))
            current = int(predecessors[current])
        path.reverse()
        
        total_distance = float(distances[end])
        
        return {
            "optimal_path": path if path[0] == start else [],
            "total_distance": round(total_distance, 2) if total_distance != float('inf') else None,
            "nodes_explored": int(self.xp.sum(visited)),
            "path_found": total_distance != float('inf'),
            "computed_on": "GPU" if self.gpu_available else "CPU",
        }
    
    # =========================================
    # LOAD BALANCING OPTIMIZATION
    # =========================================
    
    def optimize_load_distribution(self,
                                    cargo_weights: List[float],
                                    vehicle_capacities: List[float],
                                    n_iterations: int = 5000) -> Dict[str, Any]:
        """
        Optimize load distribution using parallel simulated annealing
        
        Args:
            cargo_weights: List of cargo weights
            vehicle_capacities: List of vehicle capacities
            n_iterations: Optimization iterations
        """
        n_cargo = len(cargo_weights)
        n_vehicles = len(vehicle_capacities)
        
        weights = self.xp.array(cargo_weights)
        capacities = self.xp.array(vehicle_capacities)
        
        # Initial assignment (round-robin)
        assignments = self.xp.zeros(n_cargo, dtype=int)
        for i in range(n_cargo):
            assignments[i] = i % n_vehicles
        
        best_assignments = assignments.copy()
        best_score = self._calculate_load_score(weights, capacities, assignments)
        
        temperature = 100.0
        cooling = 0.995
        
        for iteration in range(n_iterations):
            # Random swap
            new_assignments = assignments.copy()
            idx = random.randint(0, n_cargo - 1)
            new_assignments[idx] = random.randint(0, n_vehicles - 1)
            
            new_score = self._calculate_load_score(weights, capacities, new_assignments)
            
            delta = new_score - best_score
            
            if delta < 0 or random.random() < math.exp(-delta / temperature):
                assignments = new_assignments
                if new_score < best_score:
                    best_score = new_score
                    best_assignments = assignments.copy()
            
            temperature *= cooling
        
        # Calculate final distribution
        final_loads = self.xp.zeros(n_vehicles)
        for i, v in enumerate(best_assignments):
            final_loads[v] += weights[i]
        
        utilization = final_loads / capacities * 100
        
        return {
            "optimized_assignment": [int(a) for a in best_assignments],
            "vehicle_loads": [round(float(l), 1) for l in final_loads],
            "vehicle_utilization_percent": [round(float(u), 1) for u in utilization],
            "balance_score": round(100 - float(best_score), 1),
            "overloaded_vehicles": int(self.xp.sum(final_loads > capacities)),
            "iterations": n_iterations,
            "computed_on": "GPU" if self.gpu_available else "CPU",
        }
    
    def _calculate_load_score(self, 
                               weights: "np.ndarray",
                               capacities: "np.ndarray",
                               assignments: "np.ndarray") -> float:
        """Calculate load distribution score (lower is better)"""
        n_vehicles = len(capacities)
        loads = self.xp.zeros(n_vehicles)
        
        for i, v in enumerate(assignments):
            loads[v] += weights[i]
        
        # Penalty for overload
        overload_penalty = self.xp.sum(self.xp.maximum(0, loads - capacities)) * 100
        
        # Imbalance penalty
        utilization = loads / capacities
        imbalance = self.xp.std(utilization) * 10
        
        return float(overload_penalty + imbalance)


# =========================================
# SINGLETON INSTANCE
# =========================================

# Create with GPU disabled by default (enable if CUDA available)
gpu_ops = GPUMilitaryOps(GPUConfig(enabled=False))

def get_gpu_ops(enable_gpu: bool = False) -> GPUMilitaryOps:
    """Get GPU operations instance with specified configuration"""
    global gpu_ops
    if enable_gpu and GPU_AVAILABLE:
        gpu_ops = GPUMilitaryOps(GPUConfig(enabled=True))
    return gpu_ops
