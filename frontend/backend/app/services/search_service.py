from typing import Any, Dict, List, Optional
from app.core.regions import (
    REGION_ARABIAN_SEA,
    REGION_BAY_OF_BENGAL,
    REGION_SOUTHERN_OCEAN,
    resolve_region,
    validate_region,
)
from app.services.dataset_service import dataset_registry
from app.services.argo_service import argo_service
from app.services.glider_service import glider_service
from app.services.model_service import model_service


class SearchService:
    """Multi-entity catalog search engine strictly bounded to Bay of Bengal, Arabian Sea, and Southern Ocean."""

    def search(
        self,
        query: Optional[str] = None,
        item_type: Optional[str] = None,
        region: Optional[str] = None,
        depth_min: Optional[float] = None,
        depth_max: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        canon_region = None
        if region and region.lower() not in ["all", "all regions", "all regions (3 basins)", "indian ocean"]:
            canon_region = resolve_region(region)

        results: List[Dict[str, Any]] = []

        # 1. Models
        for m in model_service.list_models():
            results.append({
                "id": m["id"],
                "title": m["name"],
                "source": m["institution"],
                "variables": "Temperature, Salinity, Currents, Chlorophyll",
                "spatial": m["coverage"],
                "temporal": "2000 - Present",
                "type": "Model",
            })

        # 2. Argo floats
        try:
            argo_profiles = argo_service.get_profiles(region=canon_region).profiles
            for p in argo_profiles[:8]:
                lat_str = f"{abs(p.latitude):.1f}° {'N' if p.latitude >= 0 else 'S'}"
                lon_str = f"{abs(p.longitude):.1f}° {'E' if p.longitude >= 0 else 'W'}"
                results.append({
                    "id": f"argo-{p.profile_id}",
                    "title": f"Argo Float #{p.platform_number or p.profile_id}",
                    "source": "IFREMER Argo In-Situ GDAC",
                    "variables": "Temperature, Salinity, Pressure",
                    "spatial": f"{lat_str}, {lon_str}",
                    "temporal": p.time[:10],
                    "type": "Argo",
                })
        except Exception:
            pass

        # 3. Gliders
        for g in glider_service.list_gliders(region=canon_region):
            lat_str = f"{abs(g['latitude']):.1f}° {'N' if g['latitude'] >= 0 else 'S'}"
            lon_str = f"{abs(g['longitude']):.1f}° {'E' if g['longitude'] >= 0 else 'W'}"
            results.append({
                "id": g["id"],
                "title": g["name"],
                "source": g["operator"],
                "variables": "Temperature, Salinity, Depth",
                "spatial": f"{lat_str}, {lon_str}",
                "temporal": "2024 - Present",
                "type": "Glider",
            })

        # 4. Moorings
        moorings = [
            {
                "id": "mooring-rama-15n",
                "title": "Arabian Sea Mooring Array (RAMA 15°N 65°E)",
                "source": "Moored Buoy Network / INCOIS",
                "variables": "Temperature, Salinity, Winds, Fluxes",
                "spatial": "Arabian Sea (15°N, 65°E)",
                "temporal": "2004 - 2024",
                "type": "Mooring",
                "region": REGION_ARABIAN_SEA,
            },
            {
                "id": "mooring-bob-bd08",
                "title": "Bay of Bengal Mooring Array (BD08 18.2°N 89.7°E)",
                "source": "Moored Buoy Network / INCOIS",
                "variables": "Temperature, Salinity, Surface Currents",
                "spatial": "Bay of Bengal (18.2°N, 89.7°E)",
                "temporal": "2010 - 2024",
                "type": "Mooring",
                "region": REGION_BAY_OF_BENGAL,
            },
            {
                "id": "mooring-so-kerguelen",
                "title": "Southern Ocean Polar Convergence Mooring (54°S 68°E)",
                "source": "SOSE / International Mooring Network",
                "variables": "Temperature, Salinity, ACC Deep Velocity",
                "spatial": "Southern Ocean (54°S, 68°E)",
                "temporal": "2015 - 2024",
                "type": "Mooring",
                "region": REGION_SOUTHERN_OCEAN,
            },
        ]
        for m in moorings:
            if canon_region and m["region"] != canon_region:
                continue
            results.append({
                "id": m["id"],
                "title": m["title"],
                "source": m["source"],
                "variables": m["variables"],
                "spatial": m["spatial"],
                "temporal": m["temporal"],
                "type": m["type"],
            })

        # Apply text query filter
        if query:
            q_clean = query.lower()
            results = [
                r for r in results
                if q_clean in r["title"].lower() or q_clean in r["variables"].lower() or q_clean in r["spatial"].lower()
            ]

        # Apply type filter
        if item_type and item_type.lower() != "all":
            results = [r for r in results if r["type"].lower() == item_type.lower()]

        return results


search_service = SearchService()
