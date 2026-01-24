import httpx
from typing import List, Optional, Dict, Any, Tuple

async def fetch_osrm_route(start_coords: List[float], end_coords: List[float]) -> Optional[List[List[float]]]:
    """
    Fetch exact driving route from OSRM (Open Source Routing Machine).
    Coords format: [lat, lon]
    Returns: List of [lat, lon] waypoints
    """
    # OSRM Public Demo Server (Free)
    base_url = "http://router.project-osrm.org/route/v1/driving/"
    
    # Format: {lon},{lat};{lon},{lat}
    coords_str = f"{start_coords[1]},{start_coords[0]};{end_coords[1]},{end_coords[0]}"
    url = f"{base_url}{coords_str}?overview=full&geometries=geojson"
    
    print(f"Fetching route data from OSRM: {url}")
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, timeout=30.0)
            resp.raise_for_status()
            data = resp.json()
            
            if "routes" in data and len(data["routes"]) > 0:
                # OSRM returns [lon, lat], we need [lat, lon]
                geometry = data["routes"][0]["geometry"]["coordinates"]
                flipped_geom = [[p[1], p[0]] for p in geometry]
                return flipped_geom
            else:
                print("No route found by OSRM.")
                return None
        except Exception as e:
            print(f"Error fetching OSRM route: {e}")
            return None


async def fetch_route_with_metadata(
    start_coords: Tuple[float, float], 
    end_coords: Tuple[float, float]
) -> Optional[Dict[str, Any]]:
    """
    Fetch route from OSRM with full metadata including distance and duration.
    Coords format: (lat, lon)
    Returns: Dict with waypoints, distance_km, duration_hours
    """
    # OSRM Public Demo Server (Free)
    base_url = "http://router.project-osrm.org/route/v1/driving/"
    
    # Format: {lon},{lat};{lon},{lat}
    coords_str = f"{start_coords[1]},{start_coords[0]};{end_coords[1]},{end_coords[0]}"
    url = f"{base_url}{coords_str}?overview=full&geometries=geojson"
    
    print(f"Fetching route with metadata from OSRM: {url}")
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, timeout=30.0)
            resp.raise_for_status()
            data = resp.json()
            
            if "routes" in data and len(data["routes"]) > 0:
                route = data["routes"][0]
                # OSRM returns [lon, lat], we need [lat, lon]
                geometry = route["geometry"]["coordinates"]
                flipped_geom = [[p[1], p[0]] for p in geometry]
                
                # Distance in meters -> km, Duration in seconds -> hours
                distance_km = route.get("distance", 0) / 1000
                duration_hours = route.get("duration", 0) / 3600
                
                return {
                    "waypoints": flipped_geom,
                    "distance_km": round(distance_km, 2),
                    "duration_hours": round(duration_hours, 2)
                }
            else:
                print("No route found by OSRM.")
                return None
        except Exception as e:
            print(f"Error fetching OSRM route with metadata: {e}")
            return None
