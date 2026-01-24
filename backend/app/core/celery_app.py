"""
Celery Configuration for Background Tasks

Handles asynchronous task processing for:
- Convoy position updates
- ETA recalculations
- Priority score updates
- Decision engine evaluations
"""
import os
from celery import Celery

# Get Redis URL from environment or use default
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Create Celery app
celery_app = Celery(
    "transport_ops",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        "app.tasks.convoy_tasks",
        "app.tasks.optimization_tasks",
    ]
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minute timeout
    worker_prefetch_multiplier=1,  # One task at a time for better distribution
    result_expires=3600,  # Results expire after 1 hour
)

# Task routing (optional but useful for scaling)
celery_app.conf.task_routes = {
    "app.tasks.convoy_tasks.*": {"queue": "convoy"},
    "app.tasks.optimization_tasks.*": {"queue": "optimization"},
}

# Beat schedule for periodic tasks
celery_app.conf.beat_schedule = {
    "update-convoy-positions": {
        "task": "app.tasks.convoy_tasks.update_all_convoy_positions",
        "schedule": 30.0,  # Every 30 seconds
    },
    "recalculate-priority-scores": {
        "task": "app.tasks.optimization_tasks.recalculate_all_priorities",
        "schedule": 60.0,  # Every minute
    },
    "predict-etas": {
        "task": "app.tasks.optimization_tasks.update_all_etas",
        "schedule": 60.0,  # Every minute
    },
}

# For backward compatibility if imported directly
app = celery_app
