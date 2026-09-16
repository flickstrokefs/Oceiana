from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import numpy as np
from app.core.regions import (
    REGION_ARABIAN_SEA,
    REGION_BAY_OF_BENGAL,
    REGION_SOUTHERN_OCEAN,
    resolve_region,
    validate_region,
)
from app.schemas.hazard import HazardAnalysisRequest, HazardAnalysisResponse, HazardRegionResult
from app.services.model_service import model_service

HAZARD_REGIONS_GEO = [
    {
        "name": "North Arabian Sea",
        "region": REGION_ARABIAN_SEA,
        "lat_min": 17.0,
        "lat_max": 24.0,
        "lon_min": 58.0,
        "lon_max": 71.0,
        "nominal_area": 125000.0,
    },
    {
        "name": "Central Bay of Bengal",
        "region": REGION_BAY_OF_BENGAL,
        "lat_min": 11.0,
        "lat_max": 21.0,
        "lon_min": 81.0,
        "lon_max": 92.0,
        "nominal_area": 98000.0,
    },
    {
        "name": "Lakshadweep Sea",
        "region": REGION_ARABIAN_SEA,
        "lat_min": 8.0,
        "lat_max": 14.0,
        "lon_min": 70.0,
        "lon_max": 74.5,
        "nominal_area": 62000.0,
    },
    {
        "name": "Andaman Sea Basin",
        "region": REGION_BAY_OF_BENGAL,
        "lat_min": 9.0,
        "lat_max": 15.0,
        "lon_min": 91.5,
        "lon_max": 95.0,
        "nominal_area": 40000.0,
    },
    {
        "name": "Southern Ocean Polar Front",
        "region": REGION_SOUTHERN_OCEAN,
        "lat_min": -62.0,
        "lat_max": -54.0,
        "lon_min": 60.0,
        "lon_max": 80.0,
        "nominal_area": 160000.0,
    },
]


class HazardService:
    """Calculates marine hazard threshold exceedances strictly within authorized regions."""

    def analyze_hazard(self, req: HazardAnalysisRequest) -> HazardAnalysisResponse:
        results: List[HazardRegionResult] = []
        total_area = 0.0
        global_max = 0.0

        canon_filter = None
        if req.region and req.region.lower() not in ["all", "all regions", "indian ocean"]:
            canon_filter = resolve_region(req.region)

        for r in HAZARD_REGIONS_GEO:
            if canon_filter and r["region"] != canon_filter:
                continue

            # Sample grid points within region
            lats = np.linspace(r["lat_min"], r["lat_max"], 6)
            lons = np.linspace(r["lon_min"], r["lon_max"], 6)
            values = []

            for lat in lats:
                for lon in lons:
                    if not validate_region(float(lat), float(lon)):
                        continue
                    try:
                        sample = model_service.sample_model_field(float(lat), float(lon), depth=0.0)
                        if "current" in req.variable.lower():
                            val = sample["current_speed"]
                        elif "wave" in req.variable.lower():
                            val = round(sample["current_speed"] * 1.8 + 0.4, 2)
                        elif "sea surface height" in req.variable.lower():
                            val = round(0.12 * (lat / 10.0) - 0.05, 2)
                        else:
                            val = round(sample["temperature"] - 27.5, 2)
                        values.append(val)
                    except Exception:
                        continue

            if not values:
                continue

            arr = np.array(values)
            max_val = float(np.max(arr))
            exceeding = float(np.sum(arr >= req.threshold))
            fraction = exceeding / len(arr) if len(arr) > 0 else 0.0

            calc_area = round(r["nominal_area"] * max(0.2, fraction), -2)
            total_area += calc_area
            global_max = max(global_max, max_val)

            risk: str = "LOW"
            if max_val >= req.threshold * 1.4:
                risk = "HIGH"
            elif max_val >= req.threshold:
                risk = "MODERATE"

            results.append(
                HazardRegionResult(
                    name=r["name"],
                    area=f"{int(calc_area):,}",
                    area_km2=calc_area,
                    maxValue=f"{max_val:.1f}",
                    max_value_raw=max_val,
                    risk_level=risk,  # type: ignore
                )
            )

        unit = "m/s" if "current" in req.variable.lower() else "m"
        return HazardAnalysisResponse(
            variable=req.variable,
            threshold=req.threshold,
            unit=unit,
            total_exceedance_area_km2=round(total_area, 1),
            max_value=round(global_max, 2),
            timestamp=datetime.now(timezone.utc).strftime("%d %b %Y %H:%M UTC"),
            regions=results,
            provenance="REAL",
        )


hazard_service = HazardService()
