from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.api.endpoints import assets, convoys, routes, optimization, tcps, transit_camps, obstacles, vehicles, advanced, tracking

# Register all models
import app.models.asset 
import app.models.convoy
import app.models.route
import app.models.tcp
import app.models.transit_camp
import app.models.convoy_asset
import app.models.obstacle  # AI Obstacle/Countermeasure models
import app.models.tracking  # Military convoy tracking models

# Initialize the FastAPI application
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI-Based Transport and Road Space Management System for Military Operations",
    version="2.0.0"
)

# Set up CORS (Cross-Origin Resource Sharing)
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "*",  # Allow all for development
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    # Create tables on startup (simplest way for dev)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# Register Routers
app.include_router(assets.router, prefix=f"{settings.API_V1_STR}/assets", tags=["Assets"])
app.include_router(convoys.router, prefix=f"{settings.API_V1_STR}/convoys", tags=["Convoys"])
app.include_router(routes.router, prefix=f"{settings.API_V1_STR}/routes", tags=["Routes"])
app.include_router(tcps.router, prefix=f"{settings.API_V1_STR}/tcps", tags=["TCPs"])
app.include_router(transit_camps.router, prefix=f"{settings.API_V1_STR}/transit-camps", tags=["Transit Camps"])
app.include_router(optimization.router, prefix=f"{settings.API_V1_STR}/optimization", tags=["AI Optimization"])
app.include_router(obstacles.router, prefix=f"{settings.API_V1_STR}/obstacles", tags=["AI Obstacles & Simulation"])
app.include_router(vehicles.router, prefix=f"{settings.API_V1_STR}/vehicles", tags=["Vehicle Simulation"])
app.include_router(advanced.router, prefix=f"{settings.API_V1_STR}/advanced", tags=["Advanced AI Operations"])
app.include_router(tracking.router, prefix=f"{settings.API_V1_STR}/tracking", tags=["Military Convoy Tracking"])

# Basic Health Check Endpoint
@app.get("/")
async def root():
    """
    Simple health check to verify the API is running.
    """
    return {"message": "AI Transport Ops System is running"}
