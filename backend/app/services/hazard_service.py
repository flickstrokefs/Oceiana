import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from app.core.config import settings
from app.core.logging import logger
from app.core.errors import InvalidCoordinateError, DataProviderUnavailableError
from app.core.regions import (
    OCEAN_REGIONS,
    REGION_ARABIAN_SEA,
    REGION_BAY_OF_BENGAL,
    REGION_SOUTHERN_OCEAN,
    resolve_region,
    validate_region,
    normalize_longitude,
)
from app.schemas.hazard import (
    HazardAnalysisRequest,
    HazardAnalysisResponse,
    HazardRegionResult,
    HazardGridData,
)
from app.schemas.provenance import ProvenanceMetadata
from app.providers.copernicus_physics_provider import copernicus_physics_provider
from app.providers.copernicus_waves_provider import copernicus_waves_provider
from app.services.scientific_data_cache import scientific_cache

EARTH_RADIUS_KM = 6371.0088

# Geographical sub-basins within the authorized regions for regional analytical breakdown
HAZARD_SUB_BASINS = [
    {
        "name": "North Arabian Sea",
        "region": REGION_ARABIAN_SEA,
        "lat_min": 17.0,
        "lat_max": 25.5,
        "lon_min": 58.0,
        "lon_max": 72.0,
    },
    {
        "name": "Central Bay of Bengal",
        "region": REGION_BAY_OF_BENGAL,
        "lat_min": 11.0,
        "lat_max": 20.5,
        "lon_min": 82.0,
        "lon_max": 93.0,
    },
    {
        "name": "Lakshadweep & Malabar Margin",
        "region": REGION_ARABIAN_SEA,
        "lat_min": 8.0,
        "lat_max": 14.5,
        "lon_min": 70.0,
        "lon_max": 76.5,
    },
    {
        "name": "Andaman Sea Basin",
        "region": REGION_BAY_OF_BENGAL,
        "lat_min": 8.5,
        "lat_max": 15.0,
        "lon_min": 91.5,
        "lon_max": 95.0,
    },
    {
        "name": "Southern Ocean Polar Convergence",
        "region": REGION_SOUTHERN_OCEAN,
        "lat_min": -65.0,
        "lat_max": -50.0,
        "lon_min": 55.0,
        "lon_max": 85.0,
    },
]


def calculate_cell_area_km2(lat: float, d_lat_deg: float, d_lon_deg: float) -> float:
    """
    Calculate geodesic surface area of a lat/lon spherical grid cell:
    Area = R² * Δλ * |sin(φ + Δφ/2) - sin(φ - Δφ/2)|
    """
    rad_conv = math.pi / 180.0
    d_lon_rad = abs(d_lon_deg) * rad_conv
    half_dlat_rad = (abs(d_lat_deg) / 2.0) * rad_conv
    lat_rad = lat * rad_conv

    sin_top = math.sin(lat_rad + half_dlat_rad)
    sin_bot = math.sin(lat_rad - half_dlat_rad)
    return (EARTH_RADIUS_KM ** 2) * d_lon_rad * abs(sin_top - sin_bot)


class HazardService:
    """
    Operational Marine Hazard Assessment Pipeline.
    Strictly bounded to authorized basins: Bay of Bengal, Arabian Sea, Southern Ocean.
    Performs real grid retrieval, geodesic cell area calculations, and threshold exceedance analysis.
    """

    def get_hazard_grid(
        self,
        variable: str,
        region: str,
        threshold: float,
        time: Optional[str] = None,
        resolution_step: int = 18,
    ) -> HazardGridData:
        """
        Extract spatial grid and calculate exceedance mask and geodesic areas.
        """
        canon = resolve_region(region) or REGION_ARABIAN_SEA

        var_lower = variable.lower()
        if "wave" in var_lower:
            raw_grid = copernicus_waves_provider.fetch_grid(
                region=canon,
                depth=0.0,
                time=time,
                variable="wave_height",
                resolution_step=resolution_step,
            )
            unit = "m"
        elif "height" in var_lower or "ssha" in var_lower or "sea surface height" in var_lower:
            raw_grid = copernicus_physics_provider.fetch_grid(
                region=canon,
                depth=0.0,
                time=time,
                variable="ssha",
                resolution_step=resolution_step,
            )
            unit = "m"
        elif "thermal" in var_lower or "stress" in var_lower:
            # Thermal Stress Index: max(0, SST - Baseline)
            raw_grid = copernicus_physics_provider.fetch_grid(
                region=canon,
                depth=0.0,
                time=time,
                variable="temperature",
                resolution_step=resolution_step,
            )
            unit = "index"
            # Apply documented thermal baseline: 28.5 °C for tropics, 3.5 °C for polar waters
            baseline = 3.5 if canon == REGION_SOUTHERN_OCEAN else 28.5
            transformed_vals = []
            for row in raw_grid["values"]:
                new_row = []
                for v in row:
                    if v is None:
                        new_row.append(None)
                    else:
                        tsi = max(0.0, round(v - baseline, 2))
                        new_row.append(tsi)
                transformed_vals.append(new_row)
            raw_grid["values"] = transformed_vals
            raw_grid["variable"] = "Thermal Stress Index"
        else:
            # Current Speed
            raw_grid = copernicus_physics_provider.fetch_grid(
                region=canon,
                depth=0.0,
                time=time,
                variable="current_speed",
                resolution_step=resolution_step,
            )
            unit = "m/s"

        lats = raw_grid["latitudes"]
        lons = raw_grid["longitudes"]
        values = raw_grid["values"]

        d_lat = abs(lats[1] - lats[0]) if len(lats) > 1 else 0.5
        d_lon = abs(lons[1] - lons[0]) if len(lons) > 1 else 0.5

        mask: List[List[bool]] = []
        total_area = 0.0
        exceed_area = 0.0
        min_v = float("inf")
        max_v = float("-inf")

        for r_idx, lat in enumerate(lats):
            row_mask: List[bool] = []
            cell_area = calculate_cell_area_km2(lat, d_lat, d_lon)
            for c_idx, lon in enumerate(lons):
                val = values[r_idx][c_idx]
                if val is not None:
                    total_area += cell_area
                    is_exceed = float(val) >= float(threshold)
                    row_mask.append(is_exceed)
                    if is_exceed:
                        exceed_area += cell_area
                    if val < min_v:
                        min_v = val
                    if val > max_v:
                        max_v = val
                else:
                    row_mask.append(False)
            mask.append(row_mask)

        exceed_frac = (exceed_area / total_area) if total_area > 0 else 0.0

        meta_dict = raw_grid.get("provenance_meta", {})
        provenance_meta = ProvenanceMetadata(
            provenance=meta_dict.get("provenance", "MODEL"),
            source=meta_dict.get("source", "Copernicus Marine"),
            dataset=meta_dict.get("dataset", "cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m"),
            timestamp=meta_dict.get("timestamp", datetime.now(timezone.utc).isoformat()),
            valid_from=meta_dict.get("valid_from"),
            valid_to=meta_dict.get("valid_to"),
            processing_level="L4 Geospatial Hazard Grid Analysis",
            resolution=meta_dict.get("resolution", "0.083° (~9 km)"),
            region=canon,
            details={
                "variable": variable,
                "unit": unit,
                "threshold": threshold,
                "exceedance_area_km2": round(exceed_area, 1),
                "total_surveyed_km2": round(total_area, 1),
                "grid_cells": f"{len(lats)}x{len(lons)}",
            },
        )

        return HazardGridData(
            variable=variable,
            unit=unit,
            latitudes=lats,
            longitudes=lons,
            values=values,
            mask=mask,
            min_value=round(min_v, 2) if min_v != float("inf") else 0.0,
            max_value=round(max_v, 2) if max_v != float("-inf") else 0.0,
            threshold=threshold,
            exceedance_fraction=round(exceed_frac, 3),
            exceedance_area_km2=round(exceed_area, 1),
            total_area_km2=round(total_area, 1),
            provenance_meta=provenance_meta,
        )

    def analyze_hazard(self, req: HazardAnalysisRequest) -> HazardAnalysisResponse:
        """
        Execute hazard analysis across requested basins or sub-basins.
        Calculates geodesic exceedance areas and dynamic risk classifications.
        """
        canon_filter = None
        if req.region and req.region.lower() not in ["all", "all regions", "indian ocean"]:
            canon_filter = resolve_region(req.region)

        # Primary region for raster grid
        primary_region = canon_filter or REGION_ARABIAN_SEA

        # Get full spatial raster grid
        grid_data = self.get_hazard_grid(
            variable=req.variable,
            region=primary_region,
            threshold=req.threshold,
            time=req.time,
        )

        # Compute sub-basin regional analytical breakdown dynamically
        regional_results: List[HazardRegionResult] = []
        global_max = 0.0
        cumulative_exceed_area = 0.0

        for basin in HAZARD_SUB_BASINS:
            if canon_filter and basin["region"] != canon_filter:
                continue

            # Evaluate grid cells falling strictly inside this sub-basin
            b_lats = [lat for lat in grid_data.latitudes if basin["lat_min"] <= lat <= basin["lat_max"]]
            b_lons = [lon for lon in grid_data.longitudes if basin["lon_min"] <= lon <= basin["lon_max"]]

            b_vals: List[float] = []
            b_total_area = 0.0
            b_exceed_area = 0.0

            d_lat = abs(grid_data.latitudes[1] - grid_data.latitudes[0]) if len(grid_data.latitudes) > 1 else 0.5
            d_lon = abs(grid_data.longitudes[1] - grid_data.longitudes[0]) if len(grid_data.longitudes) > 1 else 0.5

            for r_idx, lat in enumerate(grid_data.latitudes):
                if not (basin["lat_min"] <= lat <= basin["lat_max"]):
                    continue
                cell_area = calculate_cell_area_km2(lat, d_lat, d_lon)
                for c_idx, lon in enumerate(grid_data.longitudes):
                    if not (basin["lon_min"] <= lon <= basin["lon_max"]):
                        continue
                    val = grid_data.values[r_idx][c_idx]
                    if val is not None:
                        b_vals.append(val)
                        b_total_area += cell_area
                        if val >= req.threshold:
                            b_exceed_area += cell_area

            # If this sub-basin had no overlapping cells in the primary grid (e.g. evaluating Southern Ocean while viewing Arabian Sea),
            # fetch its dedicated subgrid to calculate real values
            if not b_vals and basin["region"] != primary_region:
                try:
                    sub_grid = self.get_hazard_grid(
                        variable=req.variable,
                        region=basin["region"],
                        threshold=req.threshold,
                        time=req.time,
                        resolution_step=12,
                    )
                    for r_idx, lat in enumerate(sub_grid.latitudes):
                        if not (basin["lat_min"] <= lat <= basin["lat_max"]):
                            continue
                        c_area = calculate_cell_area_km2(lat, d_lat, d_lon)
                        for c_idx, lon in enumerate(sub_grid.longitudes):
                            if not (basin["lon_min"] <= lon <= basin["lon_max"]):
                                continue
                            val = sub_grid.values[r_idx][c_idx]
                            if val is not None:
                                b_vals.append(val)
                                b_total_area += c_area
                                if val >= req.threshold:
                                    b_exceed_area += c_area
                except Exception as e:
                    logger.warning(f"Could not compute sub-basin {basin['name']}: {e}")

            if not b_vals:
                continue

            arr = np.array(b_vals)
            max_v = float(np.max(arr))
            mean_v = float(np.mean(arr))
            frac = (b_exceed_area / b_total_area) if b_total_area > 0 else 0.0

            global_max = max(global_max, max_v)
            cumulative_exceed_area += b_exceed_area

            # Configurable, documented risk classification logic
            if frac >= 0.35 or max_v >= req.threshold * 1.5:
                risk: str = "CRITICAL"
            elif frac >= 0.15 or max_v >= req.threshold * 1.25:
                risk = "HIGH"
            elif frac >= 0.05 or max_v >= req.threshold:
                risk = "MODERATE"
            else:
                risk = "LOW"

            regional_results.append(
                HazardRegionResult(
                    name=basin["name"],
                    region_id=basin["name"].lower().replace(" ", "_"),
                    area=f"{int(b_exceed_area):,}",
                    area_km2=round(b_exceed_area, 1),
                    area_exceeded_km2=round(b_exceed_area, 1),
                    total_area_km2=round(b_total_area, 1),
                    maxValue=f"{max_v:.1f}",
                    max_value_raw=round(max_v, 2),
                    max_value=round(max_v, 2),
                    mean_value=round(mean_v, 2),
                    threshold=req.threshold,
                    exceedance_fraction=round(frac, 3),
                    exceedance_pct=round(frac * 100, 1),
                    risk_level=risk,  # type: ignore
                    status=f"{risk} ALERT" if risk in ["CRITICAL", "HIGH"] else "MONITORED",
                    provenance=grid_data.provenance_meta.provenance,
                    source=grid_data.provenance_meta.source,
                    unit=grid_data.unit,
                )
            )

        now_utc = datetime.now(timezone.utc)
        timestamp_display = now_utc.strftime("%d %b %Y %H:%M UTC")

        return HazardAnalysisResponse(
            variable=req.variable,
            threshold=req.threshold,
            unit=grid_data.unit,
            total_exceedance_area_km2=round(cumulative_exceed_area, 1),
            total_area_exceeded_km2=round(cumulative_exceed_area, 1),
            max_value=round(global_max if global_max > 0 else grid_data.max_value, 2),
            mean_value=round(float(np.mean([r.mean_value for r in regional_results if r.mean_value is not None])), 2) if regional_results else None,
            timestamp=timestamp_display,
            regions=regional_results,
            grid=grid_data,
            provenance=grid_data.provenance_meta.provenance,
            provenance_meta=grid_data.provenance_meta,
        )


hazard_service = HazardService()
