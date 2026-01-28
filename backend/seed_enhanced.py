"""
Enhanced Data Seeder
Generates comprehensive synthetic data for the AI Transport Management System.
Includes realistic military assets, convoys, routes, TCPs, and transit camps.
"""
import asyncio
import sys
import os
import random
import httpx
from datetime import datetime, timedelta

# Add the parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal, engine, Base
from app.models.asset import TransportAsset
from app.models.convoy import Convoy
from app.models.route import Route
from app.models.tcp import TCP, TCPCrossing
from app.models.transit_camp import TransitCamp, HaltRequest
from app.models.convoy_asset import ConvoyAsset


# Vehicle types with specifications
VEHICLE_SPECS = [
    {"type": "Ashok Leyland Stallion", "category": "TRANSPORT", "capacity_tons": 2.5, "capacity_volume": 8.0, "max_personnel": 15, "fuel_type": "DIESEL", "max_speed": 80, "plains_speed": 55, "mountain_speed": 35},
    {"type": "Tata 407", "category": "TRANSPORT", "capacity_tons": 2.0, "capacity_volume": 6.0, "max_personnel": 10, "fuel_type": "DIESEL", "max_speed": 75, "plains_speed": 50, "mountain_speed": 30},
    {"type": "Tatra 8x8", "category": "TRANSPORT", "capacity_tons": 10.0, "capacity_volume": 20.0, "max_personnel": 5, "fuel_type": "DIESEL", "max_speed": 70, "plains_speed": 45, "mountain_speed": 25},
    {"type": "Maruti Gypsy", "category": "SUPPORT", "capacity_tons": 0.3, "capacity_volume": 1.0, "max_personnel": 4, "fuel_type": "PETROL", "max_speed": 100, "plains_speed": 70, "mountain_speed": 45},
    {"type": "Mahindra Scorpio", "category": "SUPPORT", "capacity_tons": 0.5, "capacity_volume": 1.5, "max_personnel": 6, "fuel_type": "DIESEL", "max_speed": 95, "plains_speed": 65, "mountain_speed": 40},
    {"type": "BEML Tatra", "category": "TRANSPORT", "capacity_tons": 12.0, "capacity_volume": 25.0, "max_personnel": 3, "fuel_type": "DIESEL", "max_speed": 65, "plains_speed": 40, "mountain_speed": 20},
    {"type": "Shaktiman", "category": "TRANSPORT", "capacity_tons": 5.0, "capacity_volume": 12.0, "max_personnel": 20, "fuel_type": "DIESEL", "max_speed": 70, "plains_speed": 45, "mountain_speed": 28},
    {"type": "Ambulance (Field)", "category": "MEDICAL", "capacity_tons": 1.0, "capacity_volume": 4.0, "max_personnel": 8, "fuel_type": "DIESEL", "max_speed": 85, "plains_speed": 60, "mountain_speed": 35},
    {"type": "Recovery Vehicle", "category": "RECOVERY", "capacity_tons": 15.0, "capacity_volume": 10.0, "max_personnel": 4, "fuel_type": "DIESEL", "max_speed": 60, "plains_speed": 40, "mountain_speed": 20},
]

CALLSIGNS = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliet", "Kilo", "Lima", "Mike", "November", "Oscar", "Papa", "Quebec", "Romeo", "Sierra", "Tango"]

UNITS = ["15 Corps Transport", "16 Corps MT", "Northern Command HQ", "Udhampur Garrison", "Nagrota Brigade", "Srinagar Logistics"]

LOAD_TYPES = ["AMMUNITION", "PERSONNEL", "FUEL", "MEDICAL", "EQUIPMENT", "GENERAL", "MIXED"]


async def fetch_osrm_route(start_coords, end_coords):
    """Fetch exact driving route from OSRM."""
    base_url = "http://router.project-osrm.org/route/v1/driving/"
    coords_str = f"{start_coords[1]},{start_coords[0]};{end_coords[1]},{end_coords[0]}"
    url = f"{base_url}{coords_str}?overview=full&geometries=geojson"
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, timeout=30.0)
            resp.raise_for_status()
            data = resp.json()
            
            if "routes" in data and len(data["routes"]) > 0:
                geometry = data["routes"][0]["geometry"]["coordinates"]
                distance_m = data["routes"][0]["distance"]
                duration_s = data["routes"][0]["duration"]
                return {
                    "waypoints": [[p[1], p[0]] for p in geometry],
                    "distance_km": distance_m / 1000,
                    "duration_hours": duration_s / 3600
                }
        except Exception as e:
            print(f"OSRM Error: {e}")
    return None


async def seed_data():
    print("=" * 60)
    print("AI Transport Management System - Data Seeder")
    print("=" * 60)
    
    print("\n[1/7] Resetting Database...")
    from sqlalchemy import text
    async with engine.begin() as conn:
        # Drop all tables using CASCADE via raw SQL
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO postgres"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO public"))
        await conn.run_sync(Base.metadata.create_all)
    print("    ✓ Database reset complete")
    
    async with SessionLocal() as db:
        # =========================================
        # ROUTES
        # =========================================
        print("\n[2/7] Creating Routes...")
        
        routes_data = [
            {
                "name": "NH-44 Jammu-Srinagar Highway",
                "code": "NH44-JS",
                "start": {"name": "Jammu Tawi", "coords": [32.7266, 74.8570]},
                "end": {"name": "Srinagar", "coords": [34.0837, 74.7973]},
                "terrain": "MOUNTAINOUS",
                "risk": "HIGH",
                "threat": "ORANGE",
            },
            {
                "name": "Udhampur-Ramban Link",
                "code": "UR-LINK",
                "start": {"name": "Udhampur", "coords": [32.9160, 75.1327]},
                "end": {"name": "Ramban", "coords": [33.2451, 75.2347]},
                "terrain": "MOUNTAINOUS",
                "risk": "MEDIUM",
                "threat": "YELLOW",
            },
            {
                "name": "Pathankot-Jammu Express",
                "code": "PJ-EXP",
                "start": {"name": "Pathankot", "coords": [32.2747, 75.6522]},
                "end": {"name": "Jammu Cantt", "coords": [32.7357, 74.8649]},
                "terrain": "PLAINS",
                "risk": "LOW",
                "threat": "GREEN",
            },
        ]
        
        created_routes = []
        for route_info in routes_data:
            print(f"    Fetching route: {route_info['name']}...")
            
            route_data = await fetch_osrm_route(
                route_info["start"]["coords"],
                route_info["end"]["coords"]
            )
            
            if route_data:
                waypoints = route_data["waypoints"]
                distance = route_data["distance_km"]
                duration = route_data["duration_hours"]
            else:
                # Fallback
                waypoints = [route_info["start"]["coords"], route_info["end"]["coords"]]
                distance = 100.0
                duration = 3.0
            
            route = Route(
                name=route_info["name"],
                code=route_info["code"],
                start_name=route_info["start"]["name"],
                end_name=route_info["end"]["name"],
                start_lat=route_info["start"]["coords"][0],
                start_long=route_info["start"]["coords"][1],
                end_lat=route_info["end"]["coords"][0],
                end_long=route_info["end"]["coords"][1],
                waypoints=waypoints,
                total_distance_km=round(distance, 2),
                estimated_time_hours=round(duration, 2),
                terrain_type=route_info["terrain"],
                risk_level=route_info["risk"],
                threat_level=route_info["threat"],
                road_classification="HIGHWAY",
                max_vehicle_weight_tons=40.0,
                is_night_movement_allowed=route_info["risk"] != "HIGH",
                weather_status="CLEAR",
                weather_impact_factor=1.0 if route_info["terrain"] != "MOUNTAINOUS" else 1.1,
                has_high_altitude_pass=route_info["terrain"] == "MOUNTAINOUS",
            )
            db.add(route)
            created_routes.append(route)
        
        await db.commit()
        for r in created_routes:
            await db.refresh(r)
        print(f"    ✓ Created {len(created_routes)} routes")
        
        # =========================================
        # TRANSPORT ASSETS
        # =========================================
        print("\n[3/7] Creating Transport Assets...")
        
        created_assets = []
        for i in range(20):
            spec = random.choice(VEHICLE_SPECS)
            callsign = CALLSIGNS[i % len(CALLSIGNS)]
            
            # Random position along first route
            route = created_routes[0]
            wp_idx = random.randint(0, len(route.waypoints) - 1)
            position = route.waypoints[wp_idx]
            
            # Add some randomness to position
            lat = position[0] + random.uniform(-0.05, 0.05)
            lon = position[1] + random.uniform(-0.05, 0.05)
            
            asset = TransportAsset(
                name=f"{spec['type'][:3].upper()}-{str(i+1).zfill(3)} ({callsign})",
                asset_type=spec["type"],
                capacity_tons=spec["capacity_tons"],
                is_available=random.random() > 0.2,  # 80% available
                current_lat=lat,
                current_long=lon,
                bearing=random.uniform(0, 360),
                fuel_status=random.uniform(40, 100),
            )
            db.add(asset)
            created_assets.append(asset)
        
        await db.commit()
        for a in created_assets:
            await db.refresh(a)
        print(f"    ✓ Created {len(created_assets)} transport assets")
        
        # =========================================
        # TCPs (Traffic Control Points)
        # =========================================
        print("\n[4/7] Creating TCPs...")
        
        tcp_locations = [
            {"name": "TCP Nagrota", "code": "TCP-NAG", "km": 15, "route_idx": 0},
            {"name": "TCP Udhampur South", "code": "TCP-UDS", "km": 60, "route_idx": 0},
            {"name": "TCP Chenani", "code": "TCP-CHE", "km": 100, "route_idx": 0},
            {"name": "TCP Ramban Entry", "code": "TCP-RMB", "km": 150, "route_idx": 0},
            {"name": "TCP Banihal", "code": "TCP-BNH", "km": 200, "route_idx": 0},
            {"name": "TCP Qazigund", "code": "TCP-QZG", "km": 240, "route_idx": 0},
            {"name": "TCP Anantnag", "code": "TCP-ANG", "km": 280, "route_idx": 0},
        ]
        
        created_tcps = []
        for tcp_info in tcp_locations:
            route = created_routes[tcp_info["route_idx"]]
            
            # Interpolate position along route
            progress = min(tcp_info["km"] / (route.total_distance_km or 300), 0.99)
            wp_idx = int(len(route.waypoints) * progress)
            position = route.waypoints[wp_idx]
            
            tcp = TCP(
                name=tcp_info["name"],
                code=tcp_info["code"],
                latitude=position[0],
                longitude=position[1],
                route_id=route.id,
                route_km_marker=tcp_info["km"],
                status="ACTIVE",
                current_traffic=random.choice(["CLEAR", "CLEAR", "MODERATE", "CONGESTED"]),
                max_convoy_capacity=random.choice([3, 5, 5, 8]),
                avg_clearance_time_min=random.choice([10, 15, 15, 20]),
                opens_at="06:00",
                closes_at="22:00",
            )
            db.add(tcp)
            created_tcps.append(tcp)
        
        await db.commit()
        for t in created_tcps:
            await db.refresh(t)
        print(f"    ✓ Created {len(created_tcps)} TCPs")
        
        # =========================================
        # TRANSIT CAMPS
        # =========================================
        print("\n[5/7] Creating Transit Camps...")
        
        camp_locations = [
            {"name": "Transit Camp Udhampur", "code": "TC-UDH", "km": 55, "route_idx": 0, "capacity_v": 100, "capacity_p": 400},
            {"name": "Transit Camp Ramban", "code": "TC-RMB", "km": 155, "route_idx": 0, "capacity_v": 80, "capacity_p": 300},
            {"name": "Transit Camp Banihal", "code": "TC-BNH", "km": 210, "route_idx": 0, "capacity_v": 60, "capacity_p": 250},
            {"name": "Transit Camp Qazigund", "code": "TC-QZG", "km": 245, "route_idx": 0, "capacity_v": 50, "capacity_p": 200},
        ]
        
        created_camps = []
        for camp_info in camp_locations:
            route = created_routes[camp_info["route_idx"]]
            
            progress = min(camp_info["km"] / (route.total_distance_km or 300), 0.99)
            wp_idx = int(len(route.waypoints) * progress)
            position = route.waypoints[wp_idx]
            
            camp = TransitCamp(
                name=camp_info["name"],
                code=camp_info["code"],
                latitude=position[0],
                longitude=position[1],
                route_id=route.id,
                route_km_marker=camp_info["km"],
                vehicle_capacity=camp_info["capacity_v"],
                personnel_capacity=camp_info["capacity_p"],
                current_occupancy_vehicles=random.randint(0, camp_info["capacity_v"] // 3),
                current_occupancy_personnel=random.randint(0, camp_info["capacity_p"] // 3),
                has_fuel=True,
                has_medical=random.random() > 0.3,
                has_maintenance=random.random() > 0.5,
                has_mess=True,
                has_communication=True,
                fuel_petrol_liters=random.uniform(5000, 15000),
                fuel_diesel_liters=random.uniform(30000, 80000),
                status="OPERATIONAL",
            )
            db.add(camp)
            created_camps.append(camp)
        
        await db.commit()
        for c in created_camps:
            await db.refresh(c)
        print(f"    ✓ Created {len(created_camps)} Transit Camps")
        
        # =========================================
        # CONVOYS
        # =========================================
        print("\n[6/7] Creating Convoys...")
        
        convoy_templates = [
            {"name": "AMMO-SUPPLY-01", "load": "AMMUNITION", "priority": "CRITICAL", "personnel": 25, "hazardous": True},
            {"name": "MED-EVAC-ALPHA", "load": "MEDICAL", "priority": "HIGH", "personnel": 40, "hazardous": False},
            {"name": "RATION-WEEKLY-07", "load": "GENERAL", "priority": "NORMAL", "personnel": 15, "hazardous": False},
            {"name": "FUEL-TANKER-DELTA", "load": "FUEL", "priority": "HIGH", "personnel": 12, "hazardous": True},
            {"name": "TROOP-MOVE-BRAVO", "load": "PERSONNEL", "priority": "HIGH", "personnel": 80, "hazardous": False},
            {"name": "EQUIP-TRANSFER-03", "load": "EQUIPMENT", "priority": "NORMAL", "personnel": 20, "hazardous": False},
        ]
        
        created_convoys = []
        for i, template in enumerate(convoy_templates):
            route = created_routes[0]  # Main route
            
            start_time = datetime.utcnow() - timedelta(hours=random.randint(0, 6))
            
            convoy = Convoy(
                name=template["name"],
                start_location=route.start_name,
                end_location=route.end_name,
                start_time=start_time,
                route_id=route.id,
                status=random.choice(["IN_TRANSIT", "IN_TRANSIT", "PLANNED", "HALTED"]),
            )
            db.add(convoy)
            created_convoys.append(convoy)
        
        await db.commit()
        for c in created_convoys:
            await db.refresh(c)
        print(f"    ✓ Created {len(created_convoys)} convoys")
        
        # =========================================
        # CONVOY-ASSET ASSIGNMENTS
        # =========================================
        print("\n[7/7] Assigning Assets to Convoys...")
        
        available_assets = [a for a in created_assets if a.is_available]
        assignment_count = 0
        
        for convoy in created_convoys:
            if len(available_assets) < 2:
                break  # Not enough assets to assign
            num_assets = random.randint(2, min(4, len(available_assets)))
            assigned = random.sample(available_assets, num_assets)
            
            roles = ["LEAD", "CARGO", "CARGO", "CARGO", "ESCORT", "TAIL"]
            
            for idx, asset in enumerate(assigned):
                role = roles[idx] if idx < len(roles) else "CARGO"
                
                ca = ConvoyAsset(
                    convoy_id=convoy.id,
                    asset_id=asset.id,
                    position_in_convoy=idx + 1,
                    role=role,
                    assigned_load_tons=random.uniform(0.5, asset.capacity_tons),
                    status="EN_ROUTE" if convoy.status == "IN_TRANSIT" else "ASSIGNED",
                    distance_from_ahead_meters=random.choice([30, 50, 50, 75]),
                )
                db.add(ca)
                
                # Update asset convoy link
                asset.convoy_id = convoy.id
                asset.is_available = False
                available_assets.remove(asset)
                assignment_count += 1
        
        await db.commit()
        print(f"    ✓ Created {assignment_count} convoy-asset assignments")
        
    print("\n" + "=" * 60)
    print("✓ DATA SEEDING COMPLETE")
    print("=" * 60)
    print(f"""
Summary:
  - Routes: {len(created_routes)}
  - Assets: {len(created_assets)}
  - TCPs: {len(created_tcps)}
  - Transit Camps: {len(created_camps)}
  - Convoys: {len(created_convoys)}
  - Assignments: {assignment_count}
    """)


if __name__ == "__main__":
    try:
        asyncio.run(seed_data())
    except KeyboardInterrupt:
        print("\nSeeding cancelled.")
