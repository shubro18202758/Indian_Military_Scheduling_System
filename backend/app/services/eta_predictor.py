"""
ETA Prediction Engine
Predicts Estimated Time of Arrival for convoys based on multiple factors.
Uses a combination of physics-based calculation and learned adjustments.
"""
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
import math


class ETAPredictor:
    """
    Predicts convoy ETA using physics + heuristic adjustments.
    Can be enhanced with ML model trained on historical crossing data.
    """
    
    # Base speed adjustments by terrain (multiplier)
    TERRAIN_SPEED_FACTORS = {
        "PLAINS": 1.0,
        "DESERT": 0.85,
        "MIXED": 0.75,
        "MOUNTAINOUS": 0.55,
    }
    
    # Time-of-day factors (convoy speed varies)
    TIME_OF_DAY_FACTORS = {
        "NIGHT": 0.7,      # 22:00 - 05:00
        "DAWN": 0.85,      # 05:00 - 07:00
        "MORNING": 1.0,    # 07:00 - 12:00
        "AFTERNOON": 0.95, # 12:00 - 17:00
        "EVENING": 0.9,    # 17:00 - 22:00
    }
    
    # Traffic density impact
    TRAFFIC_FACTORS = {
        "LOW": 1.0,
        "MODERATE": 0.85,
        "HIGH": 0.65,
        "CRITICAL": 0.4,
    }
    
    # Weather impact
    WEATHER_FACTORS = {
        "CLEAR": 1.0,
        "RAIN": 0.75,
        "SNOW": 0.5,
        "FOG": 0.6,
        "LANDSLIDE_RISK": 0.3,
    }
    
    def __init__(self):
        self.prediction_log = []
    
    def _get_time_of_day_category(self, hour: int) -> str:
        """Categorize hour into time-of-day bucket."""
        if 22 <= hour or hour < 5:
            return "NIGHT"
        elif 5 <= hour < 7:
            return "DAWN"
        elif 7 <= hour < 12:
            return "MORNING"
        elif 12 <= hour < 17:
            return "AFTERNOON"
        else:
            return "EVENING"
    
    def _calculate_base_eta(
        self,
        distance_km: float,
        base_speed_kmh: float,
        num_vehicles: int = 1,
    ) -> float:
        """
        Calculate base ETA in minutes based on distance and speed.
        Accounts for convoy length overhead.
        """
        # Convoy overhead: larger convoys move slower
        convoy_overhead = 1.0 + (num_vehicles * 0.01)  # 1% slower per vehicle
        
        effective_speed = base_speed_kmh / convoy_overhead
        
        if effective_speed <= 0:
            return float('inf')
        
        base_time_hours = distance_km / effective_speed
        return base_time_hours * 60  # Convert to minutes
    
    def _apply_factors(
        self,
        base_minutes: float,
        terrain: str,
        weather: str,
        traffic: str,
        departure_hour: int,
    ) -> Tuple[float, Dict[str, float]]:
        """
        Apply adjustment factors to base ETA.
        Returns adjusted minutes and factor breakdown.
        """
        factors = {}
        
        # Terrain factor
        terrain_factor = self.TERRAIN_SPEED_FACTORS.get(terrain.upper(), 0.75)
        factors["terrain"] = terrain_factor
        
        # Weather factor
        weather_factor = self.WEATHER_FACTORS.get(weather.upper(), 1.0)
        factors["weather"] = weather_factor
        
        # Traffic factor
        traffic_factor = self.TRAFFIC_FACTORS.get(traffic.upper(), 1.0)
        factors["traffic"] = traffic_factor
        
        # Time of day factor
        time_category = self._get_time_of_day_category(departure_hour)
        time_factor = self.TIME_OF_DAY_FACTORS.get(time_category, 1.0)
        factors["time_of_day"] = time_factor
        factors["time_category"] = time_category
        
        # Combined factor (lower = longer time)
        combined_factor = terrain_factor * weather_factor * traffic_factor * time_factor
        
        # Apply to base time (divide because lower speed = more time)
        adjusted_minutes = base_minutes / combined_factor
        
        factors["combined"] = combined_factor
        return adjusted_minutes, factors
    
    def predict_eta(
        self,
        distance_km: float,
        base_speed_kmh: float = 40.0,
        num_vehicles: int = 5,
        terrain: str = "PLAINS",
        weather: str = "CLEAR",
        traffic: str = "LOW",
        departure_time: Optional[datetime] = None,
        tcp_count: int = 0,
        tcp_avg_delay_minutes: float = 10.0,
        halt_count: int = 0,
        halt_duration_minutes: float = 30.0,
    ) -> Dict[str, Any]:
        """
        Predict ETA for a convoy movement.
        
        Returns comprehensive prediction with breakdown.
        """
        if departure_time is None:
            departure_time = datetime.utcnow()
        
        departure_hour = departure_time.hour
        
        # Calculate base ETA
        base_minutes = self._calculate_base_eta(distance_km, base_speed_kmh, num_vehicles)
        
        # Apply environmental factors
        adjusted_minutes, factors = self._apply_factors(
            base_minutes, terrain, weather, traffic, departure_hour
        )
        
        # Add TCP delays
        tcp_delay = tcp_count * tcp_avg_delay_minutes
        
        # Add halt durations
        halt_time = halt_count * halt_duration_minutes
        
        # Total predicted time
        total_minutes = adjusted_minutes + tcp_delay + halt_time
        
        # Calculate confidence based on factor certainty
        # Lower factors = more uncertainty
        confidence = min(1.0, factors["combined"] + 0.2)  # Base confidence boost
        
        # Predicted arrival
        predicted_arrival = departure_time + timedelta(minutes=total_minutes)
        
        # Build result
        result = {
            "prediction": {
                "eta_minutes": round(total_minutes, 1),
                "eta_hours": round(total_minutes / 60, 2),
                "predicted_arrival": predicted_arrival.isoformat(),
                "confidence": round(confidence, 2),
            },
            "breakdown": {
                "base_travel_minutes": round(base_minutes, 1),
                "adjusted_travel_minutes": round(adjusted_minutes, 1),
                "tcp_delay_minutes": round(tcp_delay, 1),
                "halt_time_minutes": round(halt_time, 1),
            },
            "factors": {
                "terrain": {"type": terrain, "impact": factors["terrain"]},
                "weather": {"type": weather, "impact": factors["weather"]},
                "traffic": {"type": traffic, "impact": factors["traffic"]},
                "time_of_day": {"category": factors["time_category"], "impact": factors["time_of_day"]},
                "combined_factor": round(factors["combined"], 3),
            },
            "inputs": {
                "distance_km": distance_km,
                "base_speed_kmh": base_speed_kmh,
                "num_vehicles": num_vehicles,
                "departure_time": departure_time.isoformat(),
                "tcp_count": tcp_count,
                "halt_count": halt_count,
            },
            "computed_at": datetime.utcnow().isoformat(),
        }
        
        return result
    
    def predict_tcp_crossings(
        self,
        tcps: List[Dict[str, Any]],
        departure_time: datetime,
        base_speed_kmh: float = 40.0,
        terrain: str = "PLAINS",
    ) -> List[Dict[str, Any]]:
        """
        Predict crossing times for each TCP on a route.
        TCPs should have 'route_km_marker' field indicating distance from start.
        """
        crossings = []
        current_time = departure_time
        
        # Sort TCPs by distance
        sorted_tcps = sorted(tcps, key=lambda x: x.get("route_km_marker", 0))
        prev_km = 0
        
        for tcp in sorted_tcps:
            km_marker = tcp.get("route_km_marker", 0)
            segment_km = km_marker - prev_km
            
            if segment_km > 0:
                # Predict time for this segment
                eta = self.predict_eta(
                    distance_km=segment_km,
                    base_speed_kmh=base_speed_kmh,
                    terrain=terrain,
                    departure_time=current_time,
                )
                
                arrival_time = datetime.fromisoformat(eta["prediction"]["predicted_arrival"])
                
                # Add clearance time
                clearance_minutes = tcp.get("avg_clearance_time_min", 10)
                departure_after_tcp = arrival_time + timedelta(minutes=clearance_minutes)
                
                crossings.append({
                    "tcp_id": tcp.get("id"),
                    "tcp_name": tcp.get("name"),
                    "km_marker": km_marker,
                    "expected_arrival": arrival_time.isoformat(),
                    "expected_clearance": departure_after_tcp.isoformat(),
                    "segment_km": segment_km,
                    "segment_minutes": eta["prediction"]["eta_minutes"],
                })
                
                current_time = departure_after_tcp
                prev_km = km_marker
        
        return crossings


# Singleton instance
eta_predictor = ETAPredictor()


if __name__ == "__main__":
    # Test the predictor
    predictor = ETAPredictor()
    
    result = predictor.predict_eta(
        distance_km=300,
        base_speed_kmh=45,
        num_vehicles=10,
        terrain="MOUNTAINOUS",
        weather="RAIN",
        traffic="MODERATE",
        departure_time=datetime.now(),
        tcp_count=5,
        halt_count=1,
    )
    
    print(f"\n=== ETA Prediction ===")
    print(f"Distance: {result['inputs']['distance_km']} km")
    print(f"Predicted ETA: {result['prediction']['eta_hours']} hours")
    print(f"Arrival Time: {result['prediction']['predicted_arrival']}")
    print(f"Confidence: {result['prediction']['confidence'] * 100}%")
    print(f"\n--- Breakdown ---")
    for key, val in result['breakdown'].items():
        print(f"  {key}: {val} min")
    print(f"\n--- Factors ---")
    for key, val in result['factors'].items():
        if isinstance(val, dict):
            print(f"  {key}: {val}")
        else:
            print(f"  {key}: {val}")
