import httpx
from typing import List, Optional

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
