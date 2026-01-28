#!/usr/bin/env python3
"""
Command Centre Seed Data
========================
भारतीय सेना (Indian Army) Logistics Command Centre

Populates realistic data for:
- Military Entities (Divisions, Brigades, Battalions, Depots)
- Load Assignments (Ammunition, Rations, Fuel, Medical)
- Vehicle Sharing Requests
- Movement Plans
- Entity Notifications
- Road Space Allocations

Security Classification: प्रतिबंधित (RESTRICTED)
"""

import asyncio
import random
from datetime import datetime, timedelta
from sqlalchemy import select, text
from app.core.database import SessionLocal, engine
from app.models.command_centre import (
    MilitaryEntity, LoadAssignment, LoadItem, VehicleSharingRequest,
    VehiclePoolStatus, MovementPlan, MovementWaypoint, EntityNotification,
    RoadSpaceAllocation, NotificationTemplate, CommandCentreMetrics
)

# ============================================================================
# REALISTIC INDIAN ARMY DATA
# ============================================================================

# Northern Command - J&K / Ladakh Sector Entities
MILITARY_ENTITIES = [
    # Corps Level
    {
        "name": "XV Corps (Chinar Corps)",
        "code": "15-CORPS",
        "entity_type": "CORPS",
        "base_latitude": 34.0837,
        "base_longitude": 74.7973,
        "sector": "J&K - Kashmir Valley",
        "commanding_officer": "Lt Gen Vikram Singh",
        "contact_radio_freq": "HF 5.640",
        "vehicle_capacity": 500,
        "storage_capacity_tons": 5000.0,
        "personnel_strength": 50000,
        "current_vehicle_count": 420,
        "current_storage_used_tons": 3500.0
    },
    {
        "name": "XIV Corps (Fire & Fury Corps)",
        "code": "14-CORPS",
        "entity_type": "CORPS",
        "base_latitude": 34.1526,
        "base_longitude": 77.5771,
        "sector": "Ladakh - Eastern Sector",
        "commanding_officer": "Lt Gen Rajeev Pant",
        "contact_radio_freq": "HF 5.720",
        "vehicle_capacity": 450,
        "storage_capacity_tons": 4500.0,
        "personnel_strength": 45000,
        "current_vehicle_count": 380,
        "current_storage_used_tons": 3200.0
    },
    # Division Level
    {
        "name": "19 Infantry Division",
        "code": "19-INF-DIV",
        "entity_type": "DIVISION",
        "base_latitude": 34.2996,
        "base_longitude": 74.4623,
        "sector": "J&K - Baramulla",
        "commanding_officer": "Maj Gen Arun Sharma",
        "contact_radio_freq": "HF 5.680",
        "vehicle_capacity": 200,
        "storage_capacity_tons": 2000.0,
        "personnel_strength": 15000,
        "current_vehicle_count": 165,
        "current_storage_used_tons": 1450.0
    },
    {
        "name": "28 Infantry Division (Mountain)",
        "code": "28-INF-DIV",
        "entity_type": "DIVISION",
        "base_latitude": 33.8883,
        "base_longitude": 74.3887,
        "sector": "J&K - Poonch",
        "commanding_officer": "Maj Gen Harpreet Singh",
        "contact_radio_freq": "HF 5.740",
        "vehicle_capacity": 180,
        "storage_capacity_tons": 1800.0,
        "personnel_strength": 12000,
        "current_vehicle_count": 145,
        "current_storage_used_tons": 1200.0
    },
    {
        "name": "3 Infantry Division (Trishul)",
        "code": "3-INF-DIV",
        "entity_type": "DIVISION",
        "base_latitude": 34.5553,
        "base_longitude": 77.5399,
        "sector": "Ladakh - Leh",
        "commanding_officer": "Maj Gen Pradeep Nair",
        "contact_radio_freq": "HF 5.760",
        "vehicle_capacity": 220,
        "storage_capacity_tons": 2200.0,
        "personnel_strength": 18000,
        "current_vehicle_count": 185,
        "current_storage_used_tons": 1650.0
    },
    # Brigade Level
    {
        "name": "68 Mountain Brigade",
        "code": "68-MTN-BDE",
        "entity_type": "BRIGADE",
        "base_latitude": 34.1641,
        "base_longitude": 77.5780,
        "sector": "Ladakh - DBO Sector",
        "commanding_officer": "Brig Manoj Kumar",
        "contact_radio_freq": "VHF 158.4",
        "vehicle_capacity": 80,
        "storage_capacity_tons": 800.0,
        "personnel_strength": 3500,
        "current_vehicle_count": 65,
        "current_storage_used_tons": 580.0
    },
    {
        "name": "114 Infantry Brigade",
        "code": "114-INF-BDE",
        "entity_type": "BRIGADE",
        "base_latitude": 34.3766,
        "base_longitude": 74.5387,
        "sector": "J&K - Uri Sector",
        "commanding_officer": "Brig Sanjay Verma",
        "contact_radio_freq": "VHF 157.8",
        "vehicle_capacity": 75,
        "storage_capacity_tons": 750.0,
        "personnel_strength": 3200,
        "current_vehicle_count": 58,
        "current_storage_used_tons": 520.0
    },
    {
        "name": "102 Infantry Brigade",
        "code": "102-INF-BDE",
        "entity_type": "BRIGADE",
        "base_latitude": 33.7782,
        "base_longitude": 76.1314,
        "sector": "J&K - Rajouri",
        "commanding_officer": "Brig Deepak Puri",
        "contact_radio_freq": "VHF 156.2",
        "vehicle_capacity": 70,
        "storage_capacity_tons": 700.0,
        "personnel_strength": 2800,
        "current_vehicle_count": 52,
        "current_storage_used_tons": 480.0
    },
    # Supply Depots
    {
        "name": "Udhampur Army Supply Depot",
        "code": "UDHAMPUR-ASD",
        "entity_type": "SUPPLY_DEPOT",
        "base_latitude": 32.9160,
        "base_longitude": 75.1419,
        "sector": "J&K - Udhampur",
        "commanding_officer": "Col Ramesh Gupta",
        "contact_radio_freq": "HF 5.820",
        "vehicle_capacity": 150,
        "storage_capacity_tons": 15000.0,
        "personnel_strength": 800,
        "current_vehicle_count": 95,
        "current_storage_used_tons": 12500.0
    },
    {
        "name": "Srinagar Central Ordnance Depot",
        "code": "SRINAGAR-COD",
        "entity_type": "ORDNANCE_DEPOT",
        "base_latitude": 34.0259,
        "base_longitude": 74.8059,
        "sector": "J&K - Srinagar",
        "commanding_officer": "Col Amit Saxena",
        "contact_radio_freq": "HF 5.860",
        "vehicle_capacity": 120,
        "storage_capacity_tons": 8000.0,
        "personnel_strength": 600,
        "current_vehicle_count": 85,
        "current_storage_used_tons": 6500.0
    },
    {
        "name": "Leh Forward Supply Base",
        "code": "LEH-FSB",
        "entity_type": "FORWARD_BASE",
        "base_latitude": 34.1526,
        "base_longitude": 77.5771,
        "sector": "Ladakh - Leh",
        "commanding_officer": "Col Vikrant Thapa",
        "contact_radio_freq": "HF 5.900",
        "vehicle_capacity": 100,
        "storage_capacity_tons": 5000.0,
        "personnel_strength": 500,
        "current_vehicle_count": 72,
        "current_storage_used_tons": 4200.0
    },
    # Logistics HQ
    {
        "name": "Northern Command Logistics HQ",
        "code": "NC-LOG-HQ",
        "entity_type": "LOGISTICS_HQ",
        "base_latitude": 32.9160,
        "base_longitude": 75.1419,
        "sector": "J&K - Udhampur",
        "commanding_officer": "Maj Gen Logistics R. Sharma",
        "contact_radio_freq": "HF 5.500",
        "vehicle_capacity": 50,
        "storage_capacity_tons": 500.0,
        "personnel_strength": 300,
        "current_vehicle_count": 35,
        "current_storage_used_tons": 150.0
    }
]

# Load Categories with realistic descriptions
LOAD_DESCRIPTIONS = {
    "AMMUNITION": [
        "5.56mm NATO rounds (1,00,000 rds)",
        "7.62mm INSAS ammunition (50,000 rds)",
        "84mm Carl Gustaf rounds",
        "81mm Mortar HE shells",
        "Hand grenades (fragmentation)",
        "Illumination flares and signal cartridges",
        "Anti-tank guided missiles (Konkurs)",
        "40mm UBGL grenades",
    ],
    "RATIONS": [
        "Composite rations (7-day packs) - 500 personnel",
        "Ready-to-eat meals (MREs) - 1000 units",
        "Fresh rations - vegetables, fruits, meat",
        "Special high-altitude rations",
        "Emergency survival rations",
        "Cooking gas cylinders (14.2kg)",
        "Drinking water (20L jerry cans)",
        "Winter special rations with high calories",
    ],
    "FUEL_POL": [
        "High-speed diesel (HSD) - 15,000 liters",
        "Motor spirit (petrol) - 5,000 liters",
        "Aviation turbine fuel (ATF)",
        "Lubricating oils and greases",
        "Kerosene for heating",
        "Engine coolant - extreme cold grade",
        "Hydraulic fluid for vehicles",
        "Diesel exhaust fluid (AdBlue)",
    ],
    "MEDICAL": [
        "Emergency medical kits (trauma)",
        "Altitude sickness medication",
        "Blood products and plasma",
        "Surgical equipment and consumables",
        "Oxygen cylinders for high altitude",
        "Frostbite treatment supplies",
        "Antibiotics and pain medication",
        "Field hospital equipment",
    ],
    "EQUIPMENT": [
        "Thermal imaging devices",
        "Night vision goggles (NVG)",
        "Radio communication sets (VHF/HF)",
        "Arctic warfare clothing",
        "Tents and shelter material",
        "Generator sets (5kVA)",
        "Solar power units",
        "Tactical gear and body armor",
    ],
    "CONSTRUCTION": [
        "Prefab shelters for high altitude",
        "Bunker construction material",
        "Barbed wire and fencing",
        "Cement and construction aggregate",
        "Steel reinforcement bars",
        "Heating equipment for bunkers",
        "Snow clearing equipment parts",
        "Bailey bridge components",
    ]
}

# Vehicle types for sharing
VEHICLE_TYPES = [
    "Tata LPTA 1615 (4-ton)",
    "Ashok Leyland Stallion (10-ton)",
    "Tatra HEMMT (12-ton 8x8)",
    "BMP-2 Armoured",
    "Maruti Gypsy",
    "Mahindra Scorpio",
    "POL Tanker (12,000L)",
    "Recovery Vehicle (Scam)",
    "Ambulance (Tempo Traveler)",
    "Water Bowser (5,000L)"
]

# Notification messages
NOTIFICATION_MESSAGES = {
    "CONVOY_APPROACHING": [
        "Convoy {convoy} approaching checkpoint. ETA: {eta} minutes",
        "Inbound convoy {convoy} expected at your location. Prepare for reception",
        "ALERT: Military convoy {convoy} en route. Clear road space"
    ],
    "CONVOY_ARRIVED": [
        "Convoy {convoy} arrived at destination. Unloading commenced",
        "Delivery complete - Convoy {convoy} at {location}"
    ],
    "THREAT_ALERT": [
        "PRIORITY: Threat detected on route {route}. Exercise caution",
        "Intelligence report: Suspicious activity near {location}. Heightened alert",
        "Weather + Threat compound risk on {route}. Consider delay"
    ],
    "WEATHER_WARNING": [
        "Snowfall warning for next 6 hours. Road conditions deteriorating",
        "High winds expected. Avoid Khardung La pass if possible",
        "Avalanche warning for {route}. All movements suspended"
    ],
    "HALT_REQUIRED": [
        "Mandatory halt ordered due to road conditions",
        "Security situation requires convoy to halt at current location",
        "Night movement restrictions in effect. Resume at dawn"
    ],
    "LOAD_READY": [
        "Load {load_id} ready for pickup at {location}",
        "Priority cargo staged for immediate dispatch",
        "Ammunition consignment cleared for movement"
    ],
    "ETA_UPDATE": [
        "Convoy {convoy} ETA revised: Now expected at {eta}",
        "Delay notification: {convoy} delayed by {delay} hours due to {reason}"
    ],
    "ROAD_SPACE_ALLOCATED": [
        "Road space allocated: {route} from {start_time} to {end_time}",
        "Priority passage confirmed for {convoy}. Other movements yield"
    ]
}


async def seed_command_centre():
    """Seed all Command Centre data"""
    print("=" * 60)
    print("भारतीय सेना - INDIAN ARMY")
    print("Command Centre Data Seeding")
    print("=" * 60)
    
    async with SessionLocal() as session:
        # Check existing data
        result = await session.execute(text("SELECT COUNT(*) FROM military_entities"))
        count = result.scalar()
        
        if count > 0:
            print(f"\n⚠️  Found {count} existing entities. Clearing data...")
            await session.execute(text("DELETE FROM entity_notifications"))
            await session.execute(text("DELETE FROM movement_waypoints"))
            await session.execute(text("DELETE FROM movement_plans"))
            await session.execute(text("DELETE FROM vehicle_pool_status"))
            await session.execute(text("DELETE FROM vehicle_sharing_requests"))
            await session.execute(text("DELETE FROM load_items"))
            await session.execute(text("DELETE FROM load_assignments"))
            await session.execute(text("DELETE FROM road_space_allocations"))
            await session.execute(text("DELETE FROM command_centre_metrics"))
            await session.execute(text("DELETE FROM military_entities"))
            await session.commit()
            print("✓ Existing data cleared")
        
        # -----------------------------------------------------------------
        # 1. Seed Military Entities
        # -----------------------------------------------------------------
        print("\n📍 Seeding Military Entities...")
        entity_map = {}  # code -> id mapping
        
        for entity_data in MILITARY_ENTITIES:
            entity = MilitaryEntity(**entity_data)
            session.add(entity)
        
        await session.commit()
        
        # Get entity IDs
        result = await session.execute(select(MilitaryEntity))
        entities = result.scalars().all()
        for e in entities:
            entity_map[e.code] = e.id
        
        print(f"   ✓ Created {len(entities)} military entities")
        
        # -----------------------------------------------------------------
        # 2. Seed Load Assignments
        # -----------------------------------------------------------------
        print("\n📦 Seeding Load Assignments...")
        
        load_statuses = ["PENDING", "ASSIGNED", "LOADING", "IN_TRANSIT", "DELIVERED"]
        priorities = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "ROUTINE"]
        categories = list(LOAD_DESCRIPTIONS.keys())
        
        now = datetime.utcnow()
        loads_created = 0
        
        # Get depot and forward entity IDs
        depot_codes = ["UDHAMPUR-ASD", "SRINAGAR-COD", "LEH-FSB"]
        forward_codes = ["68-MTN-BDE", "114-INF-BDE", "102-INF-BDE", "19-INF-DIV", "28-INF-DIV", "3-INF-DIV"]
        
        for i in range(35):  # Create 35 load assignments
            category = random.choice(categories)
            priority = random.choice(priorities)
            status = random.choice(load_statuses)
            
            # Source from depots, destination to forward units
            source_code = random.choice(depot_codes)
            dest_code = random.choice(forward_codes)
            
            # Realistic weight based on category
            if category == "AMMUNITION":
                weight = random.uniform(2.0, 8.0)
            elif category == "FUEL_POL":
                weight = random.uniform(10.0, 25.0)
            elif category == "RATIONS":
                weight = random.uniform(5.0, 15.0)
            else:
                weight = random.uniform(1.0, 10.0)
            
            # Time calculations
            required_by = now + timedelta(hours=random.randint(6, 72))
            scheduled_pickup = now + timedelta(hours=random.randint(1, 24)) if status != "PENDING" else None
            
            completion = 0.0
            if status == "ASSIGNED":
                completion = random.uniform(0, 20)
            elif status == "LOADING":
                completion = random.uniform(20, 50)
            elif status == "IN_TRANSIT":
                completion = random.uniform(50, 90)
            elif status == "DELIVERED":
                completion = 100.0
            
            load = LoadAssignment(
                assignment_code=f"LOAD-{2026}{str(i+1).zfill(4)}",
                load_category=category,
                priority=priority,
                description=random.choice(LOAD_DESCRIPTIONS[category]),
                total_weight_tons=round(weight, 2),
                total_volume_cubic_m=round(weight * 2.5, 2),
                item_count=random.randint(10, 500),
                source_entity_id=entity_map[source_code],
                destination_entity_id=entity_map[dest_code],
                convoy_id=random.randint(1, 4) if status in ["IN_TRANSIT", "DELIVERED"] else None,
                required_by=required_by,
                scheduled_pickup=scheduled_pickup,
                status=status,
                completion_percentage=completion,
                ai_priority_score=round(random.uniform(0.3, 1.0), 2),
                urgency_factor=round(random.uniform(0.5, 2.0), 2),
                created_by="AI-Logistics-System"
            )
            session.add(load)
            loads_created += 1
        
        await session.commit()
        print(f"   ✓ Created {loads_created} load assignments")
        
        # -----------------------------------------------------------------
        # 3. Seed Vehicle Sharing Requests
        # -----------------------------------------------------------------
        print("\n🚛 Seeding Vehicle Sharing Requests...")
        
        sharing_statuses = ["REQUESTED", "APPROVED", "IN_TRANSIT", "COMPLETED", "REJECTED"]
        sharing_created = 0
        
        for i in range(20):
            # Requesting entity (forward units need vehicles)
            req_code = random.choice(forward_codes)
            # Providing entity (depots or other units)
            prov_code = random.choice([c for c in depot_codes + forward_codes if c != req_code])
            
            status = random.choice(sharing_statuses)
            start_date = now + timedelta(days=random.randint(-3, 5))
            end_date = start_date + timedelta(days=random.randint(3, 14))
            
            sharing = VehicleSharingRequest(
                request_code=f"VSR-{2026}{str(i+1).zfill(3)}",
                requesting_entity_id=entity_map[req_code],
                providing_entity_id=entity_map[prov_code] if status != "REQUESTED" else None,
                vehicle_type_required=random.choice(VEHICLE_TYPES),
                quantity_required=random.randint(2, 8),
                capacity_tons_required=round(random.uniform(10, 50), 1),
                start_date=start_date,
                end_date=end_date,
                purpose=f"Support for operations in {random.choice(['forward areas', 'high-altitude positions', 'LOC sector', 'winter stocking'])}",
                status=status,
                priority=random.choice(priorities),
                ai_match_score=round(random.uniform(0.6, 0.98), 2),
                approval_authority="Brig Logistics" if status in ["APPROVED", "IN_TRANSIT", "COMPLETED"] else None,
                approval_date=now - timedelta(days=random.randint(1, 5)) if status in ["APPROVED", "IN_TRANSIT", "COMPLETED"] else None,
                rejection_reason="Insufficient vehicles available at providing unit" if status == "REJECTED" else None
            )
            session.add(sharing)
            sharing_created += 1
        
        await session.commit()
        print(f"   ✓ Created {sharing_created} vehicle sharing requests")
        
        # -----------------------------------------------------------------
        # 4. Seed Vehicle Pool Status
        # -----------------------------------------------------------------
        print("\n🔧 Seeding Vehicle Pool Status...")
        
        pool_created = 0
        for code, eid in entity_map.items():
            entity = next((e for e in MILITARY_ENTITIES if e["code"] == code), None)
            if not entity:
                continue
            
            # Calculate realistic vehicle counts based on capacity
            cap = entity.get("vehicle_capacity", 50)
            current = entity.get("current_vehicle_count", 30)
            
            pool = VehiclePoolStatus(
                entity_id=eid,
                snapshot_time=now,
                total_trucks=int(cap * 0.5),
                available_trucks=int(cap * 0.5 * random.uniform(0.3, 0.7)),
                total_als=int(cap * 0.1),
                available_als=int(cap * 0.1 * random.uniform(0.4, 0.8)),
                total_jeeps=int(cap * 0.2),
                available_jeeps=int(cap * 0.2 * random.uniform(0.5, 0.9)),
                total_tankers=int(cap * 0.1),
                available_tankers=int(cap * 0.1 * random.uniform(0.3, 0.6)),
                total_recovery=int(cap * 0.05) or 1,
                available_recovery=1,
                total_capacity_tons=cap * 6.0,
                available_capacity_tons=cap * 6.0 * random.uniform(0.3, 0.6),
                utilization_percentage=round(random.uniform(55, 85), 1),
                shared_out_count=random.randint(0, 5),
                shared_in_count=random.randint(0, 3),
                maintenance_count=random.randint(2, 10),
                fuel_critical_count=random.randint(0, 3)
            )
            session.add(pool)
            pool_created += 1
        
        await session.commit()
        print(f"   ✓ Created {pool_created} vehicle pool statuses")
        
        # -----------------------------------------------------------------
        # 5. Seed Movement Plans
        # -----------------------------------------------------------------
        print("\n🗺️  Seeding Movement Plans...")
        
        plan_statuses = ["DRAFT", "SUBMITTED", "APPROVED", "ACTIVE", "PAUSED", "COMPLETED"]
        plans_created = 0
        
        route_names = [
            ("Udhampur - Srinagar NH44", 1),
            ("Srinagar - Leh Highway", 2),
            ("Leh - DBO Axis", 3),
            ("Uri - Baramulla Sector Road", 1),
            ("Poonch - Rajouri Link", 2)
        ]
        
        for i in range(15):
            status = random.choice(plan_statuses)
            route_name, route_id = random.choice(route_names)
            
            departure = now + timedelta(hours=random.randint(-24, 48))
            arrival = departure + timedelta(hours=random.randint(6, 24))
            
            plan = MovementPlan(
                plan_code=f"MVMT-{2026}{str(i+1).zfill(3)}",
                plan_name=f"Convoy Movement - {route_name}",
                convoy_id=random.randint(1, 4) if status in ["ACTIVE", "COMPLETED"] else None,
                primary_route_id=route_id,
                alternate_route_id=route_id + 1 if route_id < 3 else 1,
                planned_departure=departure,
                planned_arrival=arrival,
                actual_departure=departure if status in ["ACTIVE", "COMPLETED"] else None,
                actual_arrival=arrival if status == "COMPLETED" else None,
                planned_halts=[
                    {"name": "Halt Point Alpha", "lat": 33.5, "lng": 75.2, "duration_hrs": 2},
                    {"name": "Halt Point Bravo", "lat": 34.0, "lng": 76.1, "duration_hrs": 3}
                ],
                halt_count=2,
                total_halt_duration_hours=5.0,
                total_load_tons=round(random.uniform(20, 100), 1),
                vehicle_count=random.randint(5, 25),
                overall_risk_score=round(random.uniform(0.2, 0.8), 2),
                threat_assessment={
                    "level": random.choice(["LOW", "MEDIUM", "HIGH"]),
                    "factors": ["terrain", "weather", "threat_intel"]
                },
                weather_assessment={
                    "condition": random.choice(["Clear", "Cloudy", "Snow", "Rain"]),
                    "visibility_km": random.randint(2, 20),
                    "road_condition": random.choice(["Good", "Fair", "Poor"])
                },
                status=status,
                approved_by="Brig Operations" if status in ["APPROVED", "ACTIVE", "COMPLETED"] else None,
                ai_optimized=True,
                ai_optimization_score=round(random.uniform(0.7, 0.95), 2),
                ai_recommendations=[
                    "Optimal departure time adjusted for traffic",
                    "Halt points selected based on security assessment",
                    "Route selected for minimal threat exposure"
                ],
                created_by="AI-Movement-Planner"
            )
            session.add(plan)
            plans_created += 1
        
        await session.commit()
        print(f"   ✓ Created {plans_created} movement plans")
        
        # -----------------------------------------------------------------
        # 6. Seed Entity Notifications
        # -----------------------------------------------------------------
        print("\n🔔 Seeding Entity Notifications...")
        
        notification_types = list(NOTIFICATION_MESSAGES.keys())
        notif_created = 0
        
        for i in range(50):
            notif_type = random.choice(notification_types)
            messages = NOTIFICATION_MESSAGES[notif_type]
            message = random.choice(messages)
            
            # Replace placeholders with realistic values
            message = message.replace("{convoy}", f"BRAVO-{random.randint(1,9)}")
            message = message.replace("{eta}", str(random.randint(15, 120)))
            message = message.replace("{route}", random.choice(["NH44", "Leh Highway", "DBO Axis"]))
            message = message.replace("{location}", random.choice(["Srinagar", "Leh", "Uri", "Kargil"]))
            message = message.replace("{delay}", str(random.randint(1, 4)))
            message = message.replace("{reason}", random.choice(["road conditions", "security check", "weather"]))
            message = message.replace("{start_time}", "0600H")
            message = message.replace("{end_time}", "1800H")
            message = message.replace("{load_id}", f"LOAD-2026{str(random.randint(1,30)).zfill(4)}")
            
            priority = "CRITICAL" if notif_type in ["THREAT_ALERT"] else random.choice(["HIGH", "MEDIUM", "LOW"])
            is_ack = random.random() > 0.3  # 70% acknowledged
            status = "ACKNOWLEDGED" if is_ack else random.choice(["PENDING", "SENT"])
            
            notif = EntityNotification(
                notification_code=f"NOTIF-{2026}{str(i+1).zfill(4)}",
                entity_id=random.choice(list(entity_map.values())),
                notification_type=notif_type,
                priority=priority,
                title=notif_type.replace("_", " ").title(),
                message=message,
                convoy_id=random.randint(1, 4) if "CONVOY" in notif_type else None,
                sent_at=now - timedelta(minutes=random.randint(30, 120)) if status != "PENDING" else None,
                acknowledged_at=now - timedelta(minutes=random.randint(5, 60)) if is_ack else None,
                acknowledged_by=random.choice(["Ops Room", "CO", "Duty Officer"]) if is_ack else None,
                expires_at=now + timedelta(hours=random.randint(6, 48)),
                status=status,
                delivery_method="RADIO" if priority == "CRITICAL" else random.choice(["RADIO", "SYSTEM"])
            )
            session.add(notif)
            notif_created += 1
        
        await session.commit()
        print(f"   ✓ Created {notif_created} entity notifications")
        
        # -----------------------------------------------------------------
        # 7. Seed Road Space Allocations
        # -----------------------------------------------------------------
        print("\n🛣️  Seeding Road Space Allocations...")
        
        road_created = 0
        for i in range(12):
            start_time = now + timedelta(hours=random.randint(-6, 24))
            
            allocation = RoadSpaceAllocation(
                allocation_code=f"RSA-{2026}{str(i+1).zfill(3)}",
                route_id=random.randint(1, 3),
                route_segment_start_km=random.randint(0, 50),
                route_segment_end_km=random.randint(51, 150),
                allocated_to_convoy_id=random.randint(1, 4),
                start_time=start_time,
                end_time=start_time + timedelta(hours=random.randint(2, 6)),
                lane_count=random.randint(1, 2),
                direction=random.choice(["FORWARD", "REVERSE", "BOTH"]),
                max_vehicles=random.randint(15, 40),
                status=random.choice(["ALLOCATED", "AVAILABLE", "BLOCKED"]),
                has_conflict=random.random() < 0.15
            )
            session.add(allocation)
            road_created += 1
        
        await session.commit()
        print(f"   ✓ Created {road_created} road space allocations")
        
        # -----------------------------------------------------------------
        # 8. Seed Command Centre Metrics
        # -----------------------------------------------------------------
        print("\n📊 Seeding Command Centre Metrics...")
        
        for hours_ago in range(24):
            ts = now - timedelta(hours=hours_ago)
            
            metrics = CommandCentreMetrics(
                snapshot_time=ts,
                # Load Management Metrics
                total_load_pending_tons=round(random.uniform(50, 150), 1),
                total_load_in_transit_tons=round(random.uniform(80, 200), 1),
                total_load_delivered_today_tons=round(random.uniform(30, 100), 1),
                load_assignments_pending=random.randint(8, 20),
                load_assignments_active=random.randint(5, 15),
                load_assignments_completed_today=random.randint(3, 10),
                # Vehicle Sharing Metrics
                sharing_requests_pending=random.randint(3, 10),
                sharing_requests_active=random.randint(5, 12),
                vehicles_shared_out=random.randint(10, 30),
                vehicles_shared_in=random.randint(8, 25),
                sharing_utilization_rate=round(random.uniform(60, 85), 1),
                # Movement Planning Metrics
                active_movement_plans=random.randint(8, 18),
                convoys_in_transit=random.randint(3, 8),
                convoys_at_halt=random.randint(1, 4),
                convoys_completed_today=random.randint(2, 6),
                avg_eta_accuracy=round(random.uniform(85, 97), 1),
                # Road Space Metrics
                road_space_utilization=round(random.uniform(55, 80), 1),
                active_allocations=random.randint(5, 15),
                conflicts_detected=random.randint(0, 3),
                # Notification Metrics
                notifications_sent_today=random.randint(20, 50),
                notifications_pending=random.randint(5, 15),
                notifications_acknowledged=random.randint(15, 40),
                avg_acknowledgement_time_min=round(random.uniform(5, 25), 1),
                # Overall System Metrics
                system_efficiency_score=round(random.uniform(75, 95), 1),
                ai_optimization_rate=round(random.uniform(80, 98), 1)
            )
            session.add(metrics)
        
        await session.commit()
        print(f"   ✓ Created 24 hours of metrics history")
        
        # -----------------------------------------------------------------
        # Summary
        # -----------------------------------------------------------------
        print("\n" + "=" * 60)
        print("✅ COMMAND CENTRE SEEDING COMPLETE")
        print("=" * 60)
        print(f"""
Data Created:
  • Military Entities:      {len(MILITARY_ENTITIES)}
  • Load Assignments:       {loads_created}
  • Vehicle Sharing:        {sharing_created}
  • Vehicle Pool Status:    {pool_created}
  • Movement Plans:         {plans_created}
  • Notifications:          {notif_created}
  • Road Space Allocations: {road_created}
  • Metrics History:        24 hours

The Command Centre is now populated with realistic
Indian Army logistics data for the Northern Command sector.
        """)


if __name__ == "__main__":
    asyncio.run(seed_command_centre())
