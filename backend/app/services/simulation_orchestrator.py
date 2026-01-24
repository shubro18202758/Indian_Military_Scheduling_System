"""
AI Simulation Orchestrator - Dynamic Attack/Defense Scenario Controller

This module orchestrates the interaction between the AI obstacle generator
(simulating Janus 7B) and the countermeasure engine. It runs scenarios
that demonstrate system resilience and adaptive capabilities.

Key Features:
1. Scenario-based simulation (peaceful, moderate, intense, stress-test)
2. Real-time event generation and response
3. Performance metrics tracking
4. Resilience scoring
"""

import asyncio
import random
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Callable, Any
from dataclasses import dataclass, field
from enum import Enum
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.obstacle import Obstacle, Countermeasure, SimulationEvent
from app.models.route import Route
from app.models.convoy import Convoy
from app.services.obstacle_generator import ObstacleGenerator, OBSTACLE_CONFIGS
from app.services.countermeasure_engine import CountermeasureEngine


class SimulationIntensity(Enum):
    """Simulation intensity levels"""
    PEACEFUL = "peaceful"           # Minimal obstacles, system monitoring
    MODERATE = "moderate"           # Occasional obstacles, normal operations
    INTENSE = "intense"             # Frequent obstacles, high alert
    STRESS_TEST = "stress_test"     # Maximum obstacles, system resilience test
    CHAOS = "chaos"                 # Extreme scenario, edge case testing


class SimulationMode(Enum):
    """Simulation modes"""
    CONTINUOUS = "continuous"       # Runs continuously
    SCENARIO = "scenario"           # Runs predefined scenario
    INTERACTIVE = "interactive"     # User-triggered events
    REPLAY = "replay"              # Replay previous scenario


@dataclass
class SimulationMetrics:
    """Track simulation performance metrics"""
    total_obstacles_generated: int = 0
    obstacles_by_type: Dict[str, int] = field(default_factory=dict)
    obstacles_by_severity: Dict[str, int] = field(default_factory=dict)
    total_countermeasures: int = 0
    countermeasures_by_type: Dict[str, int] = field(default_factory=dict)
    successful_countermeasures: int = 0
    failed_countermeasures: int = 0
    average_response_time_ms: float = 0
    total_eta_impact_minutes: int = 0
    convoys_affected: int = 0
    resilience_score: float = 100.0
    start_time: datetime = field(default_factory=datetime.utcnow)
    events: List[Dict] = field(default_factory=list)


# Predefined scenarios for demonstrations
SCENARIOS = {
    "winter_ops": {
        "name": "Winter Operations Challenge",
        "description": "Heavy snowfall and avalanche conditions on mountain routes",
        "duration_minutes": 30,
        "intensity": SimulationIntensity.INTENSE,
        "obstacle_weights": {
            "AVALANCHE": 3.0,
            "SNOWFALL": 2.5,
            "LANDSLIDE": 1.5,
            "WEATHER_SEVERE": 2.0,
            "FOG": 1.5
        },
        "target_obstacles": 8
    },
    "security_alert": {
        "name": "Security Alert Scenario",
        "description": "Multiple security threats along convoy routes",
        "duration_minutes": 20,
        "intensity": SimulationIntensity.INTENSE,
        "obstacle_weights": {
            "IED_SUSPECTED": 3.0,
            "AMBUSH_RISK": 2.5,
            "SECURITY_THREAT": 2.0
        },
        "target_obstacles": 5
    },
    "monsoon_season": {
        "name": "Monsoon Season Operations",
        "description": "Flooding and landslides during monsoon",
        "duration_minutes": 45,
        "intensity": SimulationIntensity.MODERATE,
        "obstacle_weights": {
            "FLOODING": 3.0,
            "LANDSLIDE": 2.5,
            "BRIDGE_DAMAGE": 2.0,
            "WEATHER_SEVERE": 1.5
        },
        "target_obstacles": 10
    },
    "resilience_test": {
        "name": "System Resilience Stress Test",
        "description": "Maximum load test for system resilience",
        "duration_minutes": 15,
        "intensity": SimulationIntensity.STRESS_TEST,
        "obstacle_weights": None,  # All types
        "target_obstacles": 20
    },
    "demo_showcase": {
        "name": "System Demonstration",
        "description": "Balanced scenario showcasing all capabilities",
        "duration_minutes": 10,
        "intensity": SimulationIntensity.MODERATE,
        "obstacle_weights": {
            "LANDSLIDE": 1.5,
            "WEATHER_SEVERE": 1.5,
            "SECURITY_THREAT": 1.0,
            "FLOODING": 1.0,
            "BREAKDOWN_ZONE": 1.0
        },
        "target_obstacles": 5
    }
}

# Intensity configurations
INTENSITY_CONFIG = {
    SimulationIntensity.PEACEFUL: {
        "obstacle_interval_range": (120, 300),  # 2-5 minutes
        "max_concurrent_obstacles": 2,
        "severity_weights": {"LOW": 0.5, "MEDIUM": 0.4, "HIGH": 0.1, "CRITICAL": 0.0}
    },
    SimulationIntensity.MODERATE: {
        "obstacle_interval_range": (45, 120),   # 45s - 2 min
        "max_concurrent_obstacles": 5,
        "severity_weights": {"LOW": 0.3, "MEDIUM": 0.4, "HIGH": 0.25, "CRITICAL": 0.05}
    },
    SimulationIntensity.INTENSE: {
        "obstacle_interval_range": (20, 60),    # 20s - 1 min
        "max_concurrent_obstacles": 10,
        "severity_weights": {"LOW": 0.15, "MEDIUM": 0.35, "HIGH": 0.35, "CRITICAL": 0.15}
    },
    SimulationIntensity.STRESS_TEST: {
        "obstacle_interval_range": (5, 20),     # 5-20 seconds
        "max_concurrent_obstacles": 20,
        "severity_weights": {"LOW": 0.1, "MEDIUM": 0.2, "HIGH": 0.4, "CRITICAL": 0.3}
    },
    SimulationIntensity.CHAOS: {
        "obstacle_interval_range": (1, 10),     # 1-10 seconds
        "max_concurrent_obstacles": 50,
        "severity_weights": {"LOW": 0.0, "MEDIUM": 0.1, "HIGH": 0.4, "CRITICAL": 0.5}
    }
}


class SimulationOrchestrator:
    """
    Orchestrates AI vs AI scenarios - obstacle generator attacks,
    countermeasure engine defends. Demonstrates system resilience.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.generator = ObstacleGenerator(db)
        self.countermeasure_engine = CountermeasureEngine(db)
        self.metrics = SimulationMetrics()
        self.running = False
        self.paused = False
        self.session_id = str(uuid.uuid4())[:8]
        self.event_callbacks: List[Callable] = []
        self.current_intensity = SimulationIntensity.MODERATE
        self.current_scenario: Optional[str] = None
    
    def add_event_callback(self, callback: Callable):
        """Add callback for real-time event notifications"""
        self.event_callbacks.append(callback)
    
    async def _notify_event(self, event_type: str, data: Dict):
        """Notify all callbacks of an event"""
        event = {
            "type": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "session_id": self.session_id,
            "data": data
        }
        self.metrics.events.append(event)
        
        # Create simulation event in DB
        sim_event = SimulationEvent(
            session_id=self.session_id,
            event_type=event_type,
            payload=data,
            severity=data.get("severity", "INFO")
        )
        self.db.add(sim_event)
        
        for callback in self.event_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(event)
                else:
                    callback(event)
            except Exception as e:
                print(f"Event callback error: {e}")
    
    async def run_scenario(self, scenario_name: str) -> SimulationMetrics:
        """Run a predefined scenario"""
        
        if scenario_name not in SCENARIOS:
            raise ValueError(f"Unknown scenario: {scenario_name}")
        
        scenario = SCENARIOS[scenario_name]
        self.current_scenario = scenario_name
        self.current_intensity = scenario["intensity"]
        
        await self._notify_event("SCENARIO_START", {
            "scenario_name": scenario["name"],
            "description": scenario["description"],
            "intensity": scenario["intensity"].value,
            "target_obstacles": scenario["target_obstacles"]
        })
        
        self.metrics = SimulationMetrics()
        self.running = True
        
        # Run for scenario duration
        end_time = datetime.utcnow() + timedelta(minutes=scenario["duration_minutes"])
        obstacles_generated = 0
        
        intensity_config = INTENSITY_CONFIG[scenario["intensity"]]
        
        while self.running and datetime.utcnow() < end_time and obstacles_generated < scenario["target_obstacles"]:
            
            if self.paused:
                await asyncio.sleep(1)
                continue
            
            # Generate obstacle
            start = datetime.utcnow()
            obstacle = await self._generate_scenario_obstacle(scenario)
            
            if obstacle:
                obstacles_generated += 1
                self._update_obstacle_metrics(obstacle)
                
                await self._notify_event("OBSTACLE_GENERATED", {
                    "obstacle_id": obstacle.id,
                    "type": obstacle.obstacle_type,
                    "severity": obstacle.severity,
                    "location": {"lat": obstacle.latitude, "lng": obstacle.longitude},
                    "blocks_route": obstacle.blocks_route
                })
                
                # Generate countermeasure
                countermeasure = await self.countermeasure_engine.generate_countermeasure(obstacle)
                response_time = (datetime.utcnow() - start).total_seconds() * 1000
                
                self._update_countermeasure_metrics(countermeasure, response_time)
                
                await self._notify_event("COUNTERMEASURE_GENERATED", {
                    "countermeasure_id": countermeasure.id,
                    "action_type": countermeasure.action_type,
                    "confidence": countermeasure.confidence_score,
                    "response_time_ms": round(response_time, 2),
                    "algorithm": countermeasure.decision_algorithm
                })
                
                # Execute countermeasure
                success = await self.countermeasure_engine.execute_countermeasure(countermeasure)
                
                await self._notify_event("COUNTERMEASURE_EXECUTED", {
                    "countermeasure_id": countermeasure.id,
                    "success": success,
                    "status": countermeasure.status
                })
            
            # Wait before next obstacle
            interval = random.uniform(*intensity_config["obstacle_interval_range"])
            await asyncio.sleep(interval)
        
        # Calculate final metrics
        self._calculate_resilience_score()
        
        await self._notify_event("SCENARIO_COMPLETE", {
            "scenario_name": scenario["name"],
            "total_obstacles": self.metrics.total_obstacles_generated,
            "total_countermeasures": self.metrics.total_countermeasures,
            "resilience_score": self.metrics.resilience_score
        })
        
        self.running = False
        await self.db.commit()
        
        return self.metrics
    
    async def _generate_scenario_obstacle(self, scenario: Dict) -> Optional[Obstacle]:
        """Generate obstacle based on scenario configuration"""
        
        # Get active routes
        result = await self.db.execute(select(Route).where(Route.status == "OPEN").limit(10))
        routes = result.scalars().all()
        
        if not routes:
            return None
        
        route = random.choice(routes)
        
        # Apply scenario-specific weights if defined
        obstacle_weights = scenario.get("obstacle_weights")
        severity_weights = INTENSITY_CONFIG[scenario["intensity"]]["severity_weights"]
        
        # Select obstacle type
        if obstacle_weights:
            weighted_types = []
            for obs_type, weight in obstacle_weights.items():
                if obs_type in OBSTACLE_CONFIGS:
                    weighted_types.extend([obs_type] * int(weight * 10))
            obstacle_type = random.choice(weighted_types) if weighted_types else None
        else:
            obstacle_type = None
        
        # Select severity based on intensity
        severity_choice = random.random()
        cumulative = 0
        selected_severity = "MEDIUM"
        for severity, weight in severity_weights.items():
            cumulative += weight
            if severity_choice < cumulative:
                selected_severity = severity
                break
        
        # Generate obstacle
        obstacle = await self.generator.generate_obstacle(
            route,
            obstacle_type=obstacle_type,
            severity_override=selected_severity
        )
        
        return obstacle
    
    async def run_continuous(self, intensity: SimulationIntensity = SimulationIntensity.MODERATE):
        """Run continuous simulation"""
        
        self.current_intensity = intensity
        self.running = True
        
        await self._notify_event("SIMULATION_START", {
            "mode": "continuous",
            "intensity": intensity.value
        })
        
        intensity_config = INTENSITY_CONFIG[intensity]
        
        while self.running:
            if self.paused:
                await asyncio.sleep(1)
                continue
            
            # Check active obstacle count
            result = await self.db.execute(
                select(func.count(Obstacle.id)).where(Obstacle.is_active == True)
            )
            active_obstacles = result.scalar() or 0
            
            if active_obstacles < intensity_config["max_concurrent_obstacles"]:
                # Generate new obstacle
                await self._generate_and_respond()
            
            # Wait before next check
            interval = random.uniform(*intensity_config["obstacle_interval_range"])
            await asyncio.sleep(interval)
    
    async def _generate_and_respond(self):
        """Generate obstacle and immediately respond"""
        
        # Get random active route
        result = await self.db.execute(
            select(Route).where(Route.status == "OPEN").order_by(func.random()).limit(1)
        )
        route = result.scalar_one_or_none()
        
        if not route:
            return
        
        start = datetime.utcnow()
        
        # Generate obstacle
        obstacle = await self.generator.generate_obstacle(route)
        self._update_obstacle_metrics(obstacle)
        
        await self._notify_event("OBSTACLE_GENERATED", {
            "obstacle_id": obstacle.id,
            "type": obstacle.obstacle_type,
            "severity": obstacle.severity,
            "impact_score": obstacle.impact_score
        })
        
        # Generate countermeasure
        countermeasure = await self.countermeasure_engine.generate_countermeasure(obstacle)
        response_time = (datetime.utcnow() - start).total_seconds() * 1000
        
        self._update_countermeasure_metrics(countermeasure, response_time)
        
        await self._notify_event("COUNTERMEASURE_GENERATED", {
            "countermeasure_id": countermeasure.id,
            "action_type": countermeasure.action_type,
            "confidence": countermeasure.confidence_score
        })
        
        # Execute
        await self.countermeasure_engine.execute_countermeasure(countermeasure)
        await self.db.commit()
    
    def _update_obstacle_metrics(self, obstacle: Obstacle):
        """Update obstacle metrics"""
        self.metrics.total_obstacles_generated += 1
        
        if obstacle.obstacle_type not in self.metrics.obstacles_by_type:
            self.metrics.obstacles_by_type[obstacle.obstacle_type] = 0
        self.metrics.obstacles_by_type[obstacle.obstacle_type] += 1
        
        if obstacle.severity not in self.metrics.obstacles_by_severity:
            self.metrics.obstacles_by_severity[obstacle.severity] = 0
        self.metrics.obstacles_by_severity[obstacle.severity] += 1
    
    def _update_countermeasure_metrics(self, countermeasure: Countermeasure, response_time_ms: float):
        """Update countermeasure metrics"""
        self.metrics.total_countermeasures += 1
        
        if countermeasure.action_type not in self.metrics.countermeasures_by_type:
            self.metrics.countermeasures_by_type[countermeasure.action_type] = 0
        self.metrics.countermeasures_by_type[countermeasure.action_type] += 1
        
        # Update average response time
        total_responses = self.metrics.successful_countermeasures + self.metrics.failed_countermeasures + 1
        self.metrics.average_response_time_ms = (
            (self.metrics.average_response_time_ms * (total_responses - 1) + response_time_ms) / total_responses
        )
        
        self.metrics.total_eta_impact_minutes += countermeasure.eta_impact_minutes or 0
    
    def _calculate_resilience_score(self):
        """Calculate overall resilience score (0-100)"""
        score = 100.0
        
        # Deduct for failed countermeasures
        if self.metrics.total_countermeasures > 0:
            failure_rate = self.metrics.failed_countermeasures / self.metrics.total_countermeasures
            score -= failure_rate * 30
        
        # Bonus for fast response times (under 500ms is excellent)
        if self.metrics.average_response_time_ms < 500:
            score += 5
        elif self.metrics.average_response_time_ms > 2000:
            score -= 10
        
        # Consider severity of obstacles handled
        critical_handled = self.metrics.obstacles_by_severity.get("CRITICAL", 0)
        if critical_handled > 0:
            score += 5 * min(critical_handled, 5)  # Bonus for handling critical
        
        self.metrics.resilience_score = max(0, min(100, score))
    
    def stop(self):
        """Stop simulation"""
        self.running = False
    
    def pause(self):
        """Pause simulation"""
        self.paused = True
    
    def resume(self):
        """Resume simulation"""
        self.paused = False
    
    def get_status(self) -> Dict:
        """Get current simulation status"""
        return {
            "session_id": self.session_id,
            "running": self.running,
            "paused": self.paused,
            "intensity": self.current_intensity.value,
            "scenario": self.current_scenario,
            "metrics": {
                "obstacles_generated": self.metrics.total_obstacles_generated,
                "countermeasures": self.metrics.total_countermeasures,
                "success_rate": (self.metrics.successful_countermeasures / 
                               max(1, self.metrics.total_countermeasures)) * 100,
                "avg_response_ms": round(self.metrics.average_response_time_ms, 2),
                "resilience_score": self.metrics.resilience_score
            },
            "duration_seconds": (datetime.utcnow() - self.metrics.start_time).total_seconds()
        }
