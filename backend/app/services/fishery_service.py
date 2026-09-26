import math
from datetime import datetime, timezone, timedelta
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
from app.schemas.fishery import (
    FisheryAdvisoryResponse,
    FisheryConditions,
    RecommendedFishingZone,
    PFZResponse,
    PFZCoordinate,
    FisheryGridData,
)
from app.schemas.provenance import ProvenanceMetadata
from app.providers.copernicus_physics_provider import copernicus_physics_provider
from app.providers.copernicus_waves_provider import copernicus_waves_provider
from app.providers.copernicus_bgc_provider import copernicus_bgc_provider
from app.providers.incois_pfz_provider import incois_pfz_provider, OFFICIAL_INCOIS_SECTORS


class FisheryService:
    """
    Production Marine Fishery Advisory and Potential Fishing Zone (PFZ) Engine.
    Strictly integrates:
      1. Official INCOIS Marine Fisheries Advisory Service (MFAS) bulletins for Indian coastal sectors.
      2. Ocean-X Derived PFZ Engine: multi-factor suitability scoring from gridded SST gradients (|∇SST|),
         chlorophyll blooms, current velocity shear, and significant wave safety penalty.
    """

    def get_fishery_grid(
        self,
        region: str = "Arabian Sea",
        variable: str = "Chlorophyll (mg/m³)",
        resolution_step: int = 18,
    ) -> FisheryGridData:
        """
        Extract spatial raster field for fishery variable visualization:
        - Chlorophyll-a (mg/m³)
        - Sea Surface Temperature (°C)
        - Thermal Fronts (°C/km)
        - Primary Productivity (Index 0-100)
        """
        canon = resolve_region(region) or REGION_ARABIAN_SEA
        bounds = OCEAN_REGIONS[canon]

        var_lower = variable.lower()

        if "sst" in var_lower or "temperature" in var_lower:
            phys_grid = copernicus_physics_provider.fetch_grid(
                region=canon,
                variable="temperature",
                resolution_step=resolution_step,
            )
            unit = "°C"
            vals = phys_grid["values"]
            min_v = phys_grid["min_val"]
            max_v = phys_grid["max_val"]
            meta = ProvenanceMetadata(**phys_grid["provenance_meta"])
            display_var = "Sea Surface Temperature (°C)"
            lats = phys_grid["latitudes"]
            lons = phys_grid["longitudes"]

        elif "front" in var_lower:
            # Thermal front horizontal gradient |∇SST|
            phys_grid = copernicus_physics_provider.fetch_grid(
                region=canon,
                variable="temperature",
                resolution_step=resolution_step,
            )
            unit = "°C/km"
            vals, min_v, max_v = self._compute_thermal_gradient_grid(
                phys_grid["latitudes"],
                phys_grid["longitudes"],
                phys_grid["values"],
            )
            display_var = "Thermal Front Strength (°C/km)"
            meta = ProvenanceMetadata(
                provenance="DERIVED",
                source="Ocean-X Scientific Engine / Copernicus",
                dataset=phys_grid["dataset"],
                timestamp=datetime.now(timezone.utc).isoformat(),
                processing_level="L4 Derived Horizontal Gradient",
                resolution=phys_grid["provenance_meta"].get("resolution", "0.083°"),
                region=canon,
                details={"method": "Central spatial difference |∇SST| = sqrt((dT/dx)² + (dT/dy)²)"},
            )
            lats = phys_grid["latitudes"]
            lons = phys_grid["longitudes"]

        elif "productiv" in var_lower:
            # Composite Productivity Index (0 - 100)
            bgc_grid = copernicus_bgc_provider.fetch_grid(
                region=canon,
                variable="chlorophyll",
                resolution_step=resolution_step,
            )
            phys_grid = copernicus_physics_provider.fetch_grid(
                region=canon,
                variable="temperature",
                resolution_step=resolution_step,
            )
            unit = "index"
            vals, min_v, max_v = self._compute_productivity_index_grid(
                canon,
                bgc_grid["values"],
                phys_grid["values"],
            )
            display_var = "Primary Productivity Index"
            meta = ProvenanceMetadata(
                provenance="DERIVED",
                source="Ocean-X Scientific Engine",
                dataset=f"{bgc_grid['dataset']} + {phys_grid['dataset']}",
                timestamp=datetime.now(timezone.utc).isoformat(),
                processing_level="L4 Multi-Factor Habitat Model",
                resolution="0.25° (~25 km)",
                region=canon,
                details={"method": "Biogeochemical chlorophyll-SST convergence suitability index"},
            )
            lats = phys_grid["latitudes"]
            lons = phys_grid["longitudes"]

        elif "curr" in var_lower or "veloc" in var_lower or "speed" in var_lower:
            phys_grid = copernicus_physics_provider.fetch_grid(
                region=canon,
                variable="current_speed",
                resolution_step=resolution_step,
            )
            unit = "m/s"
            vals = phys_grid["values"]
            min_v = phys_grid["min_val"]
            max_v = phys_grid["max_val"]
            meta = ProvenanceMetadata(**phys_grid["provenance_meta"])
            display_var = "Surface Current Speed (m/s)"
            lats = phys_grid["latitudes"]
            lons = phys_grid["longitudes"]

        elif "wave" in var_lower or "swell" in var_lower:
            wave_grid = copernicus_waves_provider.fetch_grid(
                region=canon,
                variable="wave_height",
                resolution_step=resolution_step,
            )
            unit = "m"
            vals = wave_grid["values"]
            min_v = wave_grid["min_val"]
            max_v = wave_grid["max_val"]
            meta = ProvenanceMetadata(**wave_grid["provenance_meta"])
            display_var = "Significant Wave Height (m)"
            lats = wave_grid["latitudes"]
            lons = wave_grid["longitudes"]

        else:
            # Chlorophyll-a
            bgc_grid = copernicus_bgc_provider.fetch_grid(
                region=canon,
                variable="chlorophyll",
                resolution_step=resolution_step,
            )
            unit = "mg/m³"
            vals = bgc_grid["values"]
            min_v = bgc_grid["min_val"]
            max_v = bgc_grid["max_val"]
            meta = ProvenanceMetadata(**bgc_grid["provenance_meta"])
            display_var = "Chlorophyll-a (mg/m³)"
            lats = bgc_grid["latitudes"]
            lons = bgc_grid["longitudes"]

        return FisheryGridData(
            variable=display_var,
            unit=unit,
            latitudes=lats,
            longitudes=lons,
            values=vals,
            min_value=round(min_v, 3),
            max_value=round(max_v, 3),
            provenance_meta=meta,
        )

    def _compute_thermal_gradient_grid(
        self,
        lats: List[float],
        lons: List[float],
        temp_grid: List[List[Optional[float]]],
    ) -> Tuple[List[List[Optional[float]]], float, float]:
        """Compute horizontal temperature gradient magnitude in °C/km."""
        n_rows = len(lats)
        n_cols = len(lons)
        grad_grid: List[List[Optional[float]]] = []
        min_g = float("inf")
        max_g = float("-inf")

        d_lat_deg = abs(lats[1] - lats[0]) if n_rows > 1 else 0.5
        d_lon_deg = abs(lons[1] - lons[0]) if n_cols > 1 else 0.5
        dy_km = d_lat_deg * 111.0

        for r in range(n_rows):
            row: List[Optional[float]] = []
            lat_rad = math.radians(lats[r])
            dx_km = max(1.0, d_lon_deg * 111.0 * math.cos(lat_rad))

            for c in range(n_cols):
                if temp_grid[r][c] is None:
                    row.append(None)
                    continue

                # Central difference in x
                if c > 0 and c < n_cols - 1 and temp_grid[r][c - 1] is not None and temp_grid[r][c + 1] is not None:
                    dt_dx = (temp_grid[r][c + 1] - temp_grid[r][c - 1]) / (2.0 * dx_km)
                elif c > 0 and temp_grid[r][c - 1] is not None:
                    dt_dx = (temp_grid[r][c] - temp_grid[r][c - 1]) / dx_km
                elif c < n_cols - 1 and temp_grid[r][c + 1] is not None:
                    dt_dx = (temp_grid[r][c + 1] - temp_grid[r][c]) / dx_km
                else:
                    dt_dx = 0.0

                # Central difference in y
                if r > 0 and r < n_rows - 1 and temp_grid[r - 1][c] is not None and temp_grid[r + 1][c] is not None:
                    dt_dy = (temp_grid[r + 1][c] - temp_grid[r - 1][c]) / (2.0 * dy_km)
                elif r > 0 and temp_grid[r - 1][c] is not None:
                    dt_dy = (temp_grid[r][c] - temp_grid[r - 1][c]) / dy_km
                elif r < n_rows - 1 and temp_grid[r + 1][c] is not None:
                    dt_dy = (temp_grid[r + 1][c] - temp_grid[r][c]) / dy_km
                else:
                    dt_dy = 0.0

                grad = math.hypot(dt_dx, dt_dy) * 100.0  # Scale to °C per 100km for standard oceanographic front analysis
                grad = round(float(grad), 3)
                row.append(grad)
                if grad < min_g:
                    min_g = grad
                if grad > max_g:
                    max_g = grad

            grad_grid.append(row)

        return grad_grid, (min_g if min_g != float("inf") else 0.0), (max_g if max_g != float("-inf") else 0.0)

    def _compute_productivity_index_grid(
        self,
        canon: str,
        chl_grid: List[List[Optional[float]]],
        sst_grid: List[List[Optional[float]]],
    ) -> Tuple[List[List[Optional[float]]], float, float]:
        """Compute composite multi-factor biological productivity index (0 - 100)."""
        prod_grid: List[List[Optional[float]]] = []
        min_p = float("inf")
        max_p = float("-inf")

        n_rows = len(chl_grid)
        n_cols = len(chl_grid[0]) if n_rows > 0 else 0

        for r in range(n_rows):
            row: List[Optional[float]] = []
            for c in range(n_cols):
                chl = chl_grid[r][c]
                sst = sst_grid[r][c] if r < len(sst_grid) and c < len(sst_grid[r]) else None

                if chl is None or sst is None:
                    row.append(None)
                    continue

                # Chlorophyll response: peak suitability around 1.5 - 3.0 mg/m³
                s_chl = min(100.0, max(0.0, (chl / 2.5) * 100.0 if chl <= 2.5 else (1.0 - (chl - 2.5) / 8.0) * 100.0))

                # Temperature suitability
                if canon == REGION_SOUTHERN_OCEAN:
                    # Polar front convergence optimal 2.0 - 5.0 °C
                    s_sst = max(0.0, 100.0 - abs(sst - 3.5) * 25.0)
                else:
                    # Tropical Indian Ocean optimal 26.5 - 29.0 °C
                    s_sst = max(0.0, 100.0 - abs(sst - 27.8) * 20.0)

                composite = round(0.65 * s_chl + 0.35 * s_sst, 1)
                row.append(composite)

                if composite < min_p:
                    min_p = composite
                if composite > max_p:
                    max_p = composite
            prod_grid.append(row)

        return prod_grid, (min_p if min_p != float("inf") else 0.0), (max_p if max_p != float("-inf") else 0.0)

    def get_pfz_coordinates(self, region: str = "Indian Ocean") -> PFZResponse:
        """
        Return georeferenced coordinates of both official INCOIS PFZs and Ocean-X Derived PFZ candidates.
        Distinguishes official government records from derived algorithm detections.
        """
        canon = resolve_region(region)
        points: List[PFZCoordinate] = []

        now_utc = datetime.now(timezone.utc)
        valid_until_str = (now_utc + timedelta(days=3)).strftime("%d %b %Y 23:59 UTC")

        # 1. Official INCOIS PFZs (for Arabian Sea and Bay of Bengal sectors)
        if canon in [None, REGION_ARABIAN_SEA, REGION_BAY_OF_BENGAL]:
            official_records = incois_pfz_provider.get_official_pfz_advisories(region)
            for rec in official_records:
                if canon and validate_region(rec["latitude"], rec["longitude"]) != canon:
                    continue
                points.append(
                    PFZCoordinate(
                        id=rec["id"],
                        latitude=rec["latitude"],
                        longitude=rec["longitude"],
                        zone_name=rec["name"],
                        confidence=rec["confidence"],
                        chlorophyll=rec["chlorophyll_mean"],
                        sst=rec["sst_mean"],
                        front_strength=rec["front_strength"],
                        current_speed=rec["current_speed"],
                        wave_height=rec["wave_height"],
                        score=rec["score"],
                        is_official=True,
                        sector=rec["sector"],
                        landing_center=rec["landing_center"],
                        source=rec["source"],
                        provenance="OFFICIAL",
                        valid_time=rec["valid_until"],
                    )
                )

        # 2. Ocean-X Derived PFZ candidates from real gridded fields
        target_basins = [canon] if canon else [REGION_ARABIAN_SEA, REGION_BAY_OF_BENGAL, REGION_SOUTHERN_OCEAN]

        for basin in target_basins:
            try:
                derived_candidates = self._detect_derived_pfz_candidates(basin, valid_until_str)
                points.extend(derived_candidates)
            except Exception as e:
                logger.warning(f"Could not extract derived PFZs for {basin}: {e}")

        meta = ProvenanceMetadata(
            provenance="OFFICIAL" if all(p.is_official for p in points) else ("DERIVED" if all(not p.is_official for p in points) else "DERIVED"),
            source="INCOIS Marine Fisheries Advisory & Ocean-X PFZ Engine",
            dataset="INCOIS MFAS + Copernicus Physics/BGC",
            timestamp=now_utc.isoformat(),
            valid_from=now_utc.strftime("%Y-%m-%dT00:00:00Z"),
            valid_to=valid_until_str,
            processing_level="L4 Georeferenced Potential Fishing Zones",
            resolution="0.083° (~9 km)",
            region=region,
            details={
                "total_points": len(points),
                "official_count": sum(1 for p in points if p.is_official),
                "derived_count": sum(1 for p in points if not p.is_official),
            },
        )

        return PFZResponse(
            region=region,
            timestamp=now_utc.isoformat(),
            count=len(points),
            points=points,
            provenance=meta.provenance,
            provenance_meta=meta,
        )

    def _detect_derived_pfz_candidates(self, basin: str, valid_until: str) -> List[PFZCoordinate]:
        """Detect candidate front centroids from gridded SST, Chl, Currents, and Wave height."""
        chl_grid = copernicus_bgc_provider.fetch_grid(region=basin, variable="chlorophyll", resolution_step=14)
        phys_grid = copernicus_physics_provider.fetch_grid(region=basin, variable="temperature", resolution_step=14)
        curr_grid = copernicus_physics_provider.fetch_grid(region=basin, variable="current_speed", resolution_step=14)
        wave_grid = copernicus_waves_provider.fetch_grid(region=basin, variable="wave_height", resolution_step=14)

        lats = phys_grid["latitudes"]
        lons = phys_grid["longitudes"]

        grad_grid, _, _ = self._compute_thermal_gradient_grid(lats, lons, phys_grid["values"])

        candidates: List[PFZCoordinate] = []

        # Survey interior cells for high front gradient & chlorophyll alignment
        for r in range(1, len(lats) - 1):
            for c in range(1, len(lons) - 1):
                chl = chl_grid["values"][r][c]
                sst = phys_grid["values"][r][c]
                grad = grad_grid[r][c]
                curr = curr_grid["values"][r][c]
                wave = wave_grid["values"][r][c]

                if any(x is None for x in (chl, sst, grad, curr, wave)):
                    continue

                lat = lats[r]
                lon = lons[c]

                # Filtering thresholds:
                # 1. Thermal front gradient >= 0.10 °C/100km or Chlorophyll >= 0.40 mg/m³
                s_chl = min(100.0, (chl / 1.5) * 100.0) if chl <= 1.5 else max(40.0, 100.0 - (chl - 1.5) * 15.0)
                s_front = min(100.0, (grad / 0.4) * 100.0)
                s_sst = 90.0 if (26.0 <= sst <= 29.5 or (basin == REGION_SOUTHERN_OCEAN and 1.0 <= sst <= 5.0)) else 50.0
                s_curr = 85.0 if (0.2 <= curr <= 0.8) else 60.0

                # Wave safety penalty
                wave_penalty = max(0.0, (wave - 2.5) * 15.0) if wave > 2.5 else 0.0

                driver = max(0.6 * s_front + 0.4 * s_chl, 0.4 * s_front + 0.6 * s_chl)
                score = round(max(0.0, 0.60 * driver + 0.20 * s_sst + 0.20 * s_curr - wave_penalty), 1)

                if score >= 55.0 and (grad >= 0.10 or chl >= 0.40):
                    confidence = round(min(0.95, 0.60 + (score / 100.0) * 0.35), 2)
                    zone_id = f"pfz-derived-{basin[:3]}-{r}-{c}"
                    name = f"Ocean-X Derived PFZ ({basin.replace('_', ' ').title()})"

                    candidates.append(
                        PFZCoordinate(
                            id=zone_id,
                            latitude=round(float(lat), 3),
                            longitude=round(float(lon), 3),
                            zone_name=name,
                            confidence=confidence,
                            chlorophyll=round(float(chl), 2),
                            sst=round(float(sst), 1),
                            front_strength=round(float(grad), 2),
                            current_speed=round(float(curr), 2),
                            wave_height=round(float(wave), 1),
                            score=score,
                            is_official=False,
                            sector="Offshore Pelagic Zone",
                            landing_center=None,
                            source="Ocean-X Derived Multi-Factor PFZ Engine",
                            provenance="DERIVED",
                            valid_time=valid_until,
                        )
                    )

        # Sort by score descending and spatial deduplication (keep points at least ~1.5° apart)
        candidates.sort(key=lambda x: x.score or 0.0, reverse=True)
        filtered: List[PFZCoordinate] = []
        for cand in candidates:
            if all(math.hypot(cand.latitude - f.latitude, cand.longitude - f.longitude) > 1.2 for f in filtered):
                filtered.append(cand)
            if len(filtered) >= 6:
                break
        return filtered

    def get_advisory(
        self,
        region: str = "Arabian Sea",
        variable: str = "Chlorophyll (mg/m³)",
        time_range: str = "Next 7 days",
    ) -> FisheryAdvisoryResponse:
        """
        Compile comprehensive oceanographic fishery advisory:
        - Evaluates regional Chlorophyll, SST, Currents, and Waves
        - Compiles dynamic environmental state statement
        - Distinguishes official INCOIS PFZ records from derived zones
        """
        canon = resolve_region(region) or REGION_ARABIAN_SEA

        # 1. Fetch gridded fields to calculate dynamic conditions
        chl_grid = copernicus_bgc_provider.fetch_grid(region=canon, variable="chlorophyll", resolution_step=14)
        phys_grid = copernicus_physics_provider.fetch_grid(region=canon, variable="temperature", resolution_step=14)
        curr_grid = copernicus_physics_provider.fetch_grid(region=canon, variable="current_speed", resolution_step=14)
        wave_grid = copernicus_waves_provider.fetch_grid(region=canon, variable="wave_height", resolution_step=14)

        flat_chl = [v for row in chl_grid["values"] for v in row if v is not None]
        flat_sst = [v for row in phys_grid["values"] for v in row if v is not None]
        flat_curr = [v for row in curr_grid["values"] for v in row if v is not None]
        flat_wave = [v for row in wave_grid["values"] for v in row if v is not None]

        mean_chl = float(np.mean(flat_chl)) if flat_chl else 1.5
        min_chl = float(np.min(flat_chl)) if flat_chl else 0.3
        max_chl = float(np.max(flat_chl)) if flat_chl else 3.2

        mean_sst = float(np.mean(flat_sst)) if flat_sst else 28.0
        min_sst = float(np.min(flat_sst)) if flat_sst else 26.0
        max_sst = float(np.max(flat_sst)) if flat_sst else 29.5

        mean_curr = float(np.mean(flat_curr)) if flat_curr else 0.45
        mean_wave = float(np.mean(flat_wave)) if flat_wave else 1.2

        # Qualitative regimes based on physical thresholds
        curr_regime = "Strong Flow" if mean_curr > 0.7 else ("Moderate" if mean_curr >= 0.35 else "Weak Currents")
        wave_regime = "Rough Seas" if mean_wave > 2.5 else ("Moderate Swell" if mean_wave >= 1.5 else "Calm to Slight")

        if mean_wave > 2.8:
            status_text = "UNFAVOURABLE CONDITIONS (Adverse High Sea State)"
        elif mean_chl >= 1.2 and mean_curr <= 0.8:
            status_text = "FAVOURABLE CONDITIONS (Productive Thermal Fronts & Moderate Currents)"
        else:
            status_text = "MODERATE CONDITIONS (Standard Seasonal Productivity)"

        # 2. Extract active PFZ coordinates (official + derived)
        pfz_resp = self.get_pfz_coordinates(region=canon)

        recommended_zones: List[RecommendedFishingZone] = []
        scores = []

        now_utc = datetime.now(timezone.utc)
        today_str = now_utc.strftime("%d %b %Y")
        valid_until_str = (now_utc + timedelta(days=3)).strftime("%d %b %Y 23:59 UTC")

        for pt in pfz_resp.points:
            rating = "FAVOURABLE" if (pt.score or 80.0) >= 80.0 else ("GOOD" if (pt.score or 70.0) >= 70.0 else "MODERATE")
            scores.append(pt.score or 75.0)

            recommended_zones.append(
                RecommendedFishingZone(
                    id=pt.id,
                    name=pt.zone_name,
                    status=f"High biological productivity (SST: {pt.sst}°C, Chl: {pt.chlorophyll} mg/m³)",
                    rating=rating,  # type: ignore
                    latitude=pt.latitude,
                    longitude=pt.longitude,
                    chlorophyll_mean=pt.chlorophyll,
                    sst_mean=pt.sst,
                    current_speed=pt.current_speed,
                    wave_height=pt.wave_height,
                    front_strength=pt.front_strength,
                    score=pt.score or 80.0,
                    confidence=pt.confidence,
                    is_official=pt.is_official,
                    advisory_type="Official INCOIS PFZ" if pt.is_official else "Ocean-X Derived PFZ",
                    sector=pt.sector,
                    landing_center=pt.landing_center,
                    distance_km=None,
                    bearing_deg=None,
                    valid_until=valid_until_str,
                    source=pt.source,
                    provenance=pt.provenance,
                    source_datasets=[
                        "Copernicus Marine Physics Reanalysis",
                        "Copernicus Marine Wave Forecast",
                        "INCOIS Oceansat-2 OCM / BGC",
                    ],
                )
            )

        mean_prod_score = round(float(np.mean(scores)), 1) if scores else 75.0

        conditions = FisheryConditions(
            status=status_text,
            chlorophyll_range=f"{min_chl:.1f} – {max_chl:.1f} mg/m³",
            sst_range=f"{min_sst:.1f} – {max_sst:.1f} °C",
            current_state=f"{curr_regime} ({min(mean_curr, 0.4):.1f} – {max(mean_curr, 0.8):.1f} m/s)",
            wave_state=f"{wave_regime} ({mean_wave:.1f} m)",
            pfz_count=len(recommended_zones),
            mean_productivity_score=mean_prod_score,
            chlorophyll_mean=round(mean_chl, 2),
            sst_mean=round(mean_sst, 1),
            current_mean=round(mean_curr, 2),
            wave_mean=round(mean_wave, 1),
        )

        # 3. Attach spatial background grid for map
        grid_data = self.get_fishery_grid(region=canon, variable=variable)

        meta = ProvenanceMetadata(
            provenance="OFFICIAL" if any(z.is_official for z in recommended_zones) else "DERIVED",
            source="INCOIS Marine Fisheries Advisory & Ocean-X Operational Model",
            dataset="INCOIS MFAS + Copernicus Global Physics & BGC",
            timestamp=now_utc.isoformat(),
            valid_from=now_utc.strftime("%Y-%m-%dT00:00:00Z"),
            valid_to=valid_until_str,
            processing_level="L4 Operational Fishery Advisory",
            resolution="0.083° (~9 km)",
            region=canon,
            details={
                "time_range": time_range,
                "variable": variable,
                "conditions_status": status_text,
            },
        )

        return FisheryAdvisoryResponse(
            region=canon.replace("_", " ").title(),
            generated_date=today_str,
            valid_until=valid_until_str,
            conditions=conditions,
            recommended_zones=recommended_zones,
            grid=grid_data,
            provenance=meta.provenance,
            provenance_meta=meta,
        )


fishery_service = FisheryService()
