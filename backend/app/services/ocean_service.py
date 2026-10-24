import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import numpy as np
from fastapi import HTTPException
from app.core.logging import logger
from app.core.cache import cache
from app.core.regions import (
    OCEAN_REGIONS,
    REGION_ARABIAN_SEA,
    REGION_BAY_OF_BENGAL,
    REGION_SOUTHERN_OCEAN,
    resolve_region,
    validate_region,
    enforce_region_coordinate,
    normalize_longitude,
)
from app.schemas.ocean import (
    OceanSliceResponse,
    CurrentsSliceResponse,
    CurrentVector,
    OceanDataPoint,
    UnderwaterRegionDataResponse,
    OceanPointSample,
    OceanTimeSeriesResponse,
    OceanTimeSeriesPoint,
)
from app.services.model_service import model_service

# Regional definitions matching frontend UNDERWATER_REGIONS in types/ocean.ts
UNDERWATER_REGIONS_DEF = {
    "bay-of-bengal": {
        "id": "bay-of-bengal",
        "name": "Bay of Bengal",
        "west": 80.0,
        "east": 94.0,
        "south": 8.0,
        "north": 22.0,
        "depthMin": 0.0,
        "depthMax": 2000.0,
    },
    "arabian-sea": {
        "id": "arabian-sea",
        "name": "Arabian Sea",
        "west": 58.0,
        "east": 72.0,
        "south": 10.0,
        "north": 22.0,
        "depthMin": 0.0,
        "depthMax": 2000.0,
    },
    "southern-ocean": {
        "id": "southern-ocean",
        "name": "Southern Ocean",
        "west": 40.0,
        "east": 90.0,
        "south": -68.0,
        "north": -52.0,
        "depthMin": 0.0,
        "depthMax": 2000.0,
    },
}
# Map underscore keys for convenience
UNDERWATER_REGIONS_DEF["bay_of_bengal"] = UNDERWATER_REGIONS_DEF["bay-of-bengal"]
UNDERWATER_REGIONS_DEF["arabian_sea"] = UNDERWATER_REGIONS_DEF["arabian-sea"]
UNDERWATER_REGIONS_DEF["southern_ocean"] = UNDERWATER_REGIONS_DEF["southern-ocean"]


class OceanFieldService:
    """Scientific service generating sliced ocean fields, depth planes, and velocity vectors."""

    def get_parameter_slice(
        self,
        parameter: str,
        depth: float = 0.0,
        time: Optional[str] = None,
        lat_min: Optional[float] = None,
        lat_max: Optional[float] = None,
        lon_min: Optional[float] = None,
        lon_max: Optional[float] = None,
        resolution: int = 25,
        region: Optional[str] = None,
    ) -> OceanSliceResponse:
        """
        Compute structured 2D horizontal field slice at given depth.
        Strictly enforces geographic filtering so points outside Bay of Bengal,
        Arabian Sea, and Southern Ocean are masked out.
        """
        if region:
            canon = resolve_region(region)
            if not canon:
                raise HTTPException(
                    status_code=400,
                    detail=f"Region '{region}' is outside the authorized project scope. Strictly permitted: bay_of_bengal, arabian_sea, southern_ocean."
                )
            r_def = OCEAN_REGIONS[canon]
            lat_min = r_def["lat_min"]
            lat_max = r_def["lat_max"]
            lon_min = r_def["lon_min"]
            lon_max = r_def["lon_max"]
        else:
            lat_min = lat_min if lat_min is not None else 5.0
            lat_max = lat_max if lat_max is not None else 24.0
            lon_min = lon_min if lon_min is not None else 55.0
            lon_max = lon_max if lon_max is not None else 95.0

        cache_key = cache.make_key(
            "slice",
            param=parameter,
            depth=depth,
            lat_min=lat_min,
            lat_max=lat_max,
            lon_min=lon_min,
            lon_max=lon_max,
            res=resolution,
            time=time,
            region=region,
        )
        cached = cache.get(cache_key)
        if cached:
            return OceanSliceResponse(**cached)

        param_clean = parameter.lower()
        unit_map = {
            "temperature": "°C",
            "salinity": "PSU",
            "current": "m/s",
            "currents": "m/s",
            "chlorophyll": "mg/m³",
            "oxygen": "ml/L",
        }
        unit = unit_map.get(param_clean, "")

        lats = [float(x) for x in np.linspace(lat_min, lat_max, resolution)]
        lons = [float(x) for x in np.linspace(lon_min, lon_max, resolution)]

        grid: List[List[Optional[float]]] = []
        min_v = float("inf")
        max_v = float("-inf")

        for lat in lats:
            row: List[Optional[float]] = []
            for lon in lons:
                # Geographic validation: must be inside one of the 3 authorized regions
                point_region = validate_region(lat, lon)
                if not point_region:
                    row.append(None)
                    continue

                try:
                    sample = model_service.sample_model_field(lat, lon, depth)
                except Exception:
                    row.append(None)
                    continue

                if param_clean in ["current", "currents"]:
                    val = sample["current_speed"]
                elif param_clean == "salinity":
                    val = sample["salinity"]
                elif param_clean == "chlorophyll":
                    val = sample["chlorophyll"]
                elif param_clean == "oxygen":
                    val = sample["oxygen"]
                else:
                    val = sample["temperature"]

                if val is not None:
                    val = round(val, 2)
                    min_v = min(min_v, val)
                    max_v = max(max_v, val)
                row.append(val)
            grid.append(row)

        if math.isinf(min_v):
            min_v, max_v = 0.0, 1.0

        resp = OceanSliceResponse(
            parameter=parameter,
            unit=unit,
            depth=depth,
            time=time or datetime.now(timezone.utc).isoformat(),
            latitudes=lats,
            longitudes=lons,
            values=grid,
            min_val=round(min_v, 2),
            max_val=round(max_v, 2),
            provenance="DERIVED",
        )
        cache.set(cache_key, resp.model_dump(), ttl_seconds=180)
        return resp

    def get_current_vectors(
        self,
        depth: float = 0.0,
        time: Optional[str] = None,
        lat_min: Optional[float] = None,
        lat_max: Optional[float] = None,
        lon_min: Optional[float] = None,
        lon_max: Optional[float] = None,
        step: float = 2.0,
        region: Optional[str] = None,
    ) -> CurrentsSliceResponse:
        """Compute horizontal velocity vectors strictly within valid ocean regions."""
        if region:
            canon = resolve_region(region)
            if not canon:
                raise HTTPException(
                    status_code=400,
                    detail=f"Region '{region}' is outside the authorized project scope. Strictly permitted: bay_of_bengal, arabian_sea, southern_ocean."
                )
            r_def = OCEAN_REGIONS[canon]
            lat_min = r_def["lat_min"]
            lat_max = r_def["lat_max"]
            lon_min = r_def["lon_min"]
            lon_max = r_def["lon_max"]
        else:
            lat_min = lat_min if lat_min is not None else 5.0
            lat_max = lat_max if lat_max is not None else 24.0
            lon_min = lon_min if lon_min is not None else 58.0
            lon_max = lon_max if lon_max is not None else 90.0

        vectors: List[CurrentVector] = []
        lats = np.arange(lat_min, lat_max + step * 0.5, step)
        lons = np.arange(lon_min, lon_max + step * 0.5, step)

        for lat in lats:
            for lon in lons:
                if not validate_region(float(lat), float(lon)):
                    continue
                try:
                    sample = model_service.sample_model_field(float(lat), float(lon), depth)
                except Exception:
                    continue

                u = sample["u"]
                v = sample["v"]
                spd = sample["current_speed"]
                if u is None or v is None or spd is None:
                    continue
                ang = math.atan2(v, u)

                vectors.append(
                    CurrentVector(
                        latitude=round(float(lat), 3),
                        longitude=round(float(lon), 3),
                        depth=depth,
                        u=u,
                        v=v,
                        speed=spd,
                        angle=round(ang, 3),
                    )
                )

        return CurrentsSliceResponse(
            depth=depth,
            time=time or datetime.now(timezone.utc).isoformat(),
            count=len(vectors),
            vectors=vectors,
            provenance="DERIVED",
        )

    def get_regional_slice(
        self,
        region_id: str,
        depth: float = 0.0,
        variable: str = "temperature",
    ) -> UnderwaterRegionDataResponse:
        """Compute regional volumetric soundings matching UnderwaterRegionDataProvider.ts."""
        canon = resolve_region(region_id)
        if not canon or canon not in OCEAN_REGIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Region '{region_id}' is outside authorized scope. Valid regions: bay-of-bengal, arabian-sea, southern-ocean."
            )

        r = UNDERWATER_REGIONS_DEF.get(region_id, UNDERWATER_REGIONS_DEF[canon])

        lon_steps = 6
        lat_steps = 5
        lon_delta = (r["east"] - r["west"]) / lon_steps
        lat_delta = (r["north"] - r["south"]) / lat_steps

        depth_offsets = [0.0, -35.0, 35.0, -80.0, 80.0]
        points: List[OceanDataPoint] = []
        currents: List[CurrentVector] = []
        pt_id = 1

        for i in range(lat_steps + 1):
            lat = r["south"] + i * lat_delta
            for j in range(lon_steps + 1):
                lon = r["west"] + j * lon_delta
                if not validate_region(lat, lon):
                    continue

                for d_off in depth_offsets:
                    sample_depth = max(r["depthMin"], min(r["depthMax"], depth + d_off))
                    try:
                        sample = model_service.sample_model_field(lat, lon, sample_depth)
                    except Exception:
                        continue

                    val = sample["temperature"]
                    if variable.lower() == "salinity":
                        val = sample["salinity"]
                    elif variable.lower() == "chlorophyll":
                        val = sample["chlorophyll"]
                    elif variable.lower() in ["current", "currents"]:
                        val = sample["current_speed"]

                    points.append(
                        OceanDataPoint(
                            id=f"{region_id}-pt-{pt_id}",
                            latitude=round(lat, 4),
                            longitude=round(lon, 4),
                            depth=sample_depth,
                            value=round(val, 2),
                            temperature=sample["temperature"],
                            salinity=sample["salinity"],
                            chlorophyll=sample["chlorophyll"],
                            velocity={"u": sample["u"], "v": sample["v"], "w": sample["w"]},
                        )
                    )
                    pt_id += 1

                # Surface current vector at target depth
                try:
                    surf = model_service.sample_model_field(lat, lon, depth)
                    currents.append(
                        CurrentVector(
                            latitude=round(lat, 4),
                            longitude=round(lon, 4),
                            depth=depth,
                            u=surf["u"],
                            v=surf["v"],
                            speed=surf["current_speed"],
                            angle=round(math.atan2(surf["v"], surf["u"]), 3),
                        )
                    )
                except Exception:
                    pass

        return UnderwaterRegionDataResponse(
            regionId=region_id,
            depth=depth,
            variable=variable,
            timestamp=datetime.now(timezone.utc).isoformat(),
            points=points,
            currents=currents,
            provenance="DERIVED",
        )

    def get_point_sample(self, lat: float, lon: float, depth: float) -> OceanPointSample:
        reg = validate_region(lat, lon)
        if not reg:
            raise HTTPException(
                status_code=400,
                detail=f"Coordinate ({lat:.4f}, {lon:.4f}) is outside the authorized project scope (Bay of Bengal, Arabian Sea, Southern Ocean)."
            )
        sample = model_service.sample_model_field(lat, lon, depth)
        return OceanPointSample(
            latitude=lat,
            longitude=lon,
            depth=depth,
            time=datetime.now(timezone.utc).isoformat(),
            temperature=sample["temperature"],
            salinity=sample["salinity"],
            chlorophyll=sample["chlorophyll"],
            velocity={"u": sample["u"], "v": sample["v"], "w": sample["w"]},
            provenance=sample["provenance"],
        )

    def get_timeseries(
        self,
        parameter: str,
        lat: float,
        lon: float,
        depth: float = 0.0,
        days: int = 5,
    ) -> OceanTimeSeriesResponse:
        """Return 5-day temporal evolution for timeline dock."""
        reg = validate_region(lat, lon)
        if not reg:
            raise HTTPException(
                status_code=400,
                detail=f"Coordinate ({lat:.4f}, {lon:.4f}) is outside the authorized project scope."
            )

        unit = "°C" if parameter == "temperature" else ("PSU" if parameter == "salinity" else "m/s")
        points: List[OceanTimeSeriesPoint] = []

        # Query actual time-indexed source data from loaded observations
        from app.services.argo_service import argo_service
        df = argo_service._df_derived if argo_service._df_derived is not None else argo_service._df_raw

        if df is not None and not df.empty and "TIME" in df.columns:
            depth_tol = 40.0
            var_col = "TEMP" if parameter == "temperature" else ("PSAL" if parameter == "salinity" else None)
            if var_col and var_col in df.columns:
                mask = (df["PRES"] >= depth - depth_tol) & (df["PRES"] <= depth + depth_tol)
                sub = df[mask].dropna(subset=[var_col, "TIME", "LATITUDE", "LONGITUDE"]).copy()
                
                # Filter strictly within the authorized region of the requested point
                sub_reg = sub[sub.apply(lambda r: validate_region(r["LATITUDE"], r["LONGITUDE"]) == reg, axis=1)]
                if not sub_reg.empty:
                    sub_reg = sub_reg.assign(dist=(sub_reg["LATITUDE"] - lat) ** 2 + (sub_reg["LONGITUDE"] - lon) ** 2)
                    sorted_points = sub_reg.sort_values(["dist", "TIME"])
                    plat_obs = sorted_points.drop_duplicates(subset=["TIME"]).sort_values("TIME").head(days)

                    import pandas as pd
                    for _, r in plat_obs.iterrows():
                        try:
                            dt = pd.to_datetime(r["TIME"])
                            t_str = dt.isoformat()
                            if not t_str.endswith("Z") and "+" not in t_str:
                                t_str += "Z"
                        except Exception:
                            t_str = str(r["TIME"])
                        val = float(r[var_col])
                        points.append(
                            OceanTimeSeriesPoint(
                                timestamp=t_str,
                                value=round(val, 2),
                                unit=unit,
                                provenance="REAL",
                            )
                        )

        # Never synthesize fake sine waves or fabricated timestamps; missing periods remain empty
        return OceanTimeSeriesResponse(
            parameter=parameter,
            latitude=lat,
            longitude=lon,
            depth=depth,
            unit=unit,
            points=points,
        )


ocean_field_service = OceanFieldService()
