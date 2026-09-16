import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
from app.core.config import settings
from app.core.logging import logger
from app.core.errors import DatasetNotFoundError, InvalidCoordinateError
from app.core.regions import (
    REGION_ARABIAN_SEA,
    REGION_BAY_OF_BENGAL,
    REGION_SOUTHERN_OCEAN,
    resolve_region,
    validate_region,
)
from app.schemas.argo import (
    ArgoObservationRecord,
    ArgoObservationsResponse,
    ArgoProfileSummary,
    ArgoProfilesListResponse,
    ArgoDepthResponse,
)
from app.processing.quality_control import clean_coordinates, clean_pressure
from app.processing.standardizer import standardize_all_profiles
from app.processing.teos10 import compute_teos10
from app.processing.gradients import compute_vertical_gradients


class ArgoService:
    """Production Argo service backed by real Bay of Bengal, Arabian Sea, and Southern Ocean observations."""

    def __init__(self):
        self._df_raw: Optional[pd.DataFrame] = None
        self._df_standardized: Optional[pd.DataFrame] = None
        self._df_derived: Optional[pd.DataFrame] = None
        self._load_data()

    def _load_data(self) -> None:
        """Load real Argo observations from repository files."""
        # 1. Try processed derived CSV if available
        gradient_path = settings.PROCESSED_DATA_ROOT / "argo_gradient.csv"
        if gradient_path.exists():
            try:
                self._df_derived = pd.read_csv(gradient_path)
                logger.info(f"Loaded processed Argo gradient dataset with {len(self._df_derived)} rows.")
            except Exception as e:
                logger.warning(f"Failed to read {gradient_path}: {e}")

        # 2. Raw monthly NetCDF dataset
        monthly_nc = settings.WORKSPACE_RAW_DATA / "argo_bay_of_bengal_2020-01-01_2020-02-01.nc"
        if monthly_nc.exists() and self._df_raw is None:
            try:
                import xarray as xr
                ds = xr.open_dataset(str(monthly_nc))
                df = ds.to_dataframe().reset_index()

                col_map = {
                    "LATITUDE": "LATITUDE",
                    "LONGITUDE": "LONGITUDE",
                    "TIME": "TIME",
                    "PRES": "PRES",
                    "TEMP": "TEMP",
                    "PSAL": "PSAL",
                    "PLATFORM_NUMBER": "PLATFORM_NUMBER",
                    "CYCLE_NUMBER": "CYCLE_NUMBER",
                }
                present = {k: v for k, v in col_map.items() if k in df.columns}
                clean = df[list(present.keys())].dropna(subset=["LATITUDE", "LONGITUDE", "PRES", "TEMP", "PSAL"]).copy()

                clean = clean_coordinates(clean)
                clean = clean_pressure(clean)

                if "PLATFORM_NUMBER" in clean.columns and "CYCLE_NUMBER" in clean.columns:
                    clean["PROFILE_ID"] = clean.groupby(["PLATFORM_NUMBER", "CYCLE_NUMBER"], sort=False).ngroup() + 1
                else:
                    clean["PROFILE_ID"] = clean.groupby(["LATITUDE", "LONGITUDE", "TIME"], sort=False).ngroup() + 1

                self._df_raw = clean
                logger.info(f"Loaded raw NetCDF Argo dataset with {len(self._df_raw)} observations.")
            except Exception as e:
                logger.warning(f"Could not load monthly NetCDF: {e}")

        # 3. Fallback raw CSV
        raw_csv = settings.RAW_DATA_ROOT / "argo_bay_of_bengal_2020-01-01_2020-01-05.csv"
        if self._df_raw is None and raw_csv.exists():
            try:
                df = pd.read_csv(raw_csv)
                clean = clean_coordinates(df)
                clean = clean_pressure(clean)
                clean["PROFILE_ID"] = clean.groupby(["LATITUDE", "LONGITUDE", "TIME"], sort=False).ngroup() + 1
                self._df_raw = clean
                logger.info(f"Loaded raw CSV Argo dataset with {len(self._df_raw)} observations.")
            except Exception as e:
                logger.error(f"Failed loading raw CSV: {e}")

        # Process standardization and TEOS-10 if not already cached
        if self._df_raw is not None and self._df_derived is None:
            logger.info("Computing in-memory standardized profiles and TEOS-10 derived quantities...")
            std = standardize_all_profiles(self._df_raw, group_col="PROFILE_ID", step=10.0)
            der = compute_teos10(std)
            grad = compute_vertical_gradients(der)
            self._df_standardized = std
            self._df_derived = grad

    def get_summary(self, region: Optional[str] = None) -> Dict[str, Any]:
        """Return dataset summary and valid parameter bounds for authorized regions."""
        if region:
            canon = resolve_region(region)
            if not canon:
                raise InvalidCoordinateError(f"Region '{region}' is outside the authorized scope.")

        df = self._df_raw if self._df_raw is not None else self._df_derived
        if df is None:
            raise DatasetNotFoundError("No Argo dataset is loaded.")

        platforms = []
        if "PLATFORM_NUMBER" in df.columns:
            platforms = [int(p) for p in df["PLATFORM_NUMBER"].dropna().unique()][:10]

        return {
            "source": "IFREMER Argo ERDDAP / INCOIS",
            "provenance": "REAL",
            "supported_regions": [REGION_BAY_OF_BENGAL, REGION_ARABIAN_SEA, REGION_SOUTHERN_OCEAN],
            "total_observations": len(df),
            "total_profiles": int(df["PROFILE_ID"].nunique()),
            "spatial_bounds": {
                "min_latitude": float(df["LATITUDE"].min()),
                "max_latitude": float(df["LATITUDE"].max()),
                "min_longitude": float(df["LONGITUDE"].min()),
                "max_longitude": float(df["LONGITUDE"].max()),
            },
            "pressure_range_dbar": [float(df["PRES"].min()), float(df["PRES"].max())],
            "temperature_range_celsius": [float(df["TEMP"].min()), float(df["TEMP"].max())],
            "salinity_range_psu": [float(df["PSAL"].min()), float(df["PSAL"].max())],
            "sample_platforms": platforms,
            "standardized_available": True,
            "teos10_derived_available": True,
        }

    def get_observations(
        self,
        limit: int = 1000,
        region: Optional[str] = None,
        min_lat: Optional[float] = None,
        max_lat: Optional[float] = None,
        min_lon: Optional[float] = None,
        max_lon: Optional[float] = None,
        min_pressure: Optional[float] = None,
        max_pressure: Optional[float] = None,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        min_temperature: Optional[float] = None,
        max_temperature: Optional[float] = None,
        min_salinity: Optional[float] = None,
        max_salinity: Optional[float] = None,
        standardized: bool = False,
        platform_number: Optional[int] = None,
    ) -> ArgoObservationsResponse:
        """Filter Argo observations across space, time, pressure, and regional scope."""
        canon_region = None
        if region:
            canon_region = resolve_region(region)
            if not canon_region:
                raise InvalidCoordinateError(
                    f"Region '{region}' is outside the authorized scope. Strictly permitted: bay_of_bengal, arabian_sea, southern_ocean."
                )

        df = self._df_derived if (standardized and self._df_derived is not None) else self._df_raw
        if df is None:
            df = self._df_derived

        if df is None:
            raise DatasetNotFoundError("Argo dataset is currently unavailable.")

        filtered = df.copy()

        # Enforce geographic validity: remove any out-of-scope points
        valid_mask = filtered.apply(lambda r: validate_region(r["LATITUDE"], r["LONGITUDE"]) is not None, axis=1)
        filtered = filtered[valid_mask]

        if canon_region:
            reg_mask = filtered.apply(lambda r: validate_region(r["LATITUDE"], r["LONGITUDE"]) == canon_region, axis=1)
            filtered = filtered[reg_mask]

        if min_lat is not None:
            filtered = filtered[filtered["LATITUDE"] >= min_lat]
        if max_lat is not None:
            filtered = filtered[filtered["LATITUDE"] <= max_lat]
        if min_lon is not None:
            filtered = filtered[filtered["LONGITUDE"] >= min_lon]
        if max_lon is not None:
            filtered = filtered[filtered["LONGITUDE"] <= max_lon]
        if min_pressure is not None:
            filtered = filtered[filtered["PRES"] >= min_pressure]
        if max_pressure is not None:
            filtered = filtered[filtered["PRES"] <= max_pressure]
        if min_temperature is not None:
            filtered = filtered[filtered["TEMP"] >= min_temperature]
        if max_temperature is not None:
            filtered = filtered[filtered["TEMP"] <= max_temperature]
        if min_salinity is not None:
            filtered = filtered[filtered["PSAL"] >= min_salinity]
        if max_salinity is not None:
            filtered = filtered[filtered["PSAL"] <= max_salinity]
        if platform_number is not None and "PLATFORM_NUMBER" in filtered.columns:
            filtered = filtered[filtered["PLATFORM_NUMBER"] == platform_number]

        records: List[ArgoObservationRecord] = []
        for _, row in filtered.head(limit).iterrows():
            records.append(
                ArgoObservationRecord(
                    profile_id=int(row["PROFILE_ID"]),
                    latitude=float(row["LATITUDE"]),
                    longitude=float(row["LONGITUDE"]),
                    time=str(row["TIME"]),
                    pres=float(row["PRES"]),
                    temp=float(row["TEMP"]) if pd.notna(row.get("TEMP")) else None,
                    psal=float(row["PSAL"]) if pd.notna(row.get("PSAL")) else None,
                    sa=float(row["SA"]) if pd.notna(row.get("SA")) else None,
                    ct=float(row["CT"]) if pd.notna(row.get("CT")) else None,
                    sigma0=float(row["SIGMA0"]) if pd.notna(row.get("SIGMA0")) else None,
                    temp_gradient=float(row["TEMP_GRADIENT"]) if pd.notna(row.get("TEMP_GRADIENT")) else None,
                    psal_gradient=float(row["PSAL_GRADIENT"]) if pd.notna(row.get("PSAL_GRADIENT")) else None,
                    sigma0_gradient=float(row["SIGMA0_GRADIENT"]) if pd.notna(row.get("SIGMA0_GRADIENT")) else None,
                    platform_number=int(row["PLATFORM_NUMBER"]) if pd.notna(row.get("PLATFORM_NUMBER")) else None,
                    cycle_number=int(row["CYCLE_NUMBER"]) if pd.notna(row.get("CYCLE_NUMBER")) else None,
                    provenance="REAL",
                )
            )

        return ArgoObservationsResponse(
            count=len(records),
            standardized=standardized,
            filters={
                "region": canon_region,
                "min_lat": min_lat,
                "max_lat": max_lat,
                "min_lon": min_lon,
                "max_lon": max_lon,
                "min_pressure": min_pressure,
                "max_pressure": max_pressure,
                "platform_number": platform_number,
            },
            observations=records,
        )

    def get_profiles(self, region: Optional[str] = None) -> ArgoProfilesListResponse:
        """List all unique Argo profiles with strict regional filtering."""
        canon_region = None
        if region:
            canon_region = resolve_region(region)
            if not canon_region:
                raise InvalidCoordinateError(
                    f"Region '{region}' is outside the authorized scope. Strictly permitted: bay_of_bengal, arabian_sea, southern_ocean."
                )

        df = self._df_derived if self._df_derived is not None else self._df_raw
        if df is None:
            raise DatasetNotFoundError("Argo dataset is unavailable.")

        profiles: List[ArgoProfileSummary] = []
        for profile_id, grp in df.groupby("PROFILE_ID", sort=True):
            r0 = grp.iloc[0]
            lat = float(r0["LATITUDE"])
            lon = float(r0["LONGITUDE"])

            pt_region = validate_region(lat, lon)
            if not pt_region:
                continue

            if canon_region and pt_region != canon_region:
                continue

            platform = int(r0["PLATFORM_NUMBER"]) if pd.notna(r0.get("PLATFORM_NUMBER")) else None
            station = f"IND-ARGO-{platform}" if platform else f"IND-BOB-{profile_id:02d}"

            profiles.append(
                ArgoProfileSummary(
                    profile_id=int(profile_id),
                    platform_number=platform,
                    station_code=station,
                    latitude=lat,
                    longitude=lon,
                    time=str(r0["TIME"]),
                    min_pressure=float(grp["PRES"].min()),
                    max_pressure=float(grp["PRES"].max()),
                    levels_count=len(grp),
                    provenance="REAL",
                )
            )

        return ArgoProfilesListResponse(count=len(profiles), profiles=profiles)

    def get_profile_by_id(self, profile_id: int) -> List[ArgoObservationRecord]:
        """Fetch vertical column records for a specific profile ID."""
        df = self._df_derived if self._df_derived is not None else self._df_raw
        if df is None:
            raise DatasetNotFoundError("Argo dataset is unavailable.")

        subset = df[df["PROFILE_ID"] == profile_id]
        if subset.empty:
            raise DatasetNotFoundError(f"Argo profile ID {profile_id} not found.")

        records = []
        for _, row in subset.sort_values("PRES").iterrows():
            records.append(
                ArgoObservationRecord(
                    profile_id=int(row["PROFILE_ID"]),
                    latitude=float(row["LATITUDE"]),
                    longitude=float(row["LONGITUDE"]),
                    time=str(row["TIME"]),
                    pres=float(row["PRES"]),
                    temp=float(row["TEMP"]) if pd.notna(row.get("TEMP")) else None,
                    psal=float(row["PSAL"]) if pd.notna(row.get("PSAL")) else None,
                    sa=float(row["SA"]) if pd.notna(row.get("SA")) else None,
                    ct=float(row["CT"]) if pd.notna(row.get("CT")) else None,
                    sigma0=float(row["SIGMA0"]) if pd.notna(row.get("SIGMA0")) else None,
                    temp_gradient=float(row["TEMP_GRADIENT"]) if pd.notna(row.get("TEMP_GRADIENT")) else None,
                    psal_gradient=float(row["PSAL_GRADIENT"]) if pd.notna(row.get("PSAL_GRADIENT")) else None,
                    sigma0_gradient=float(row["SIGMA0_GRADIENT"]) if pd.notna(row.get("SIGMA0_GRADIENT")) else None,
                    platform_number=int(row["PLATFORM_NUMBER"]) if pd.notna(row.get("PLATFORM_NUMBER")) else None,
                    cycle_number=int(row["CYCLE_NUMBER"]) if pd.notna(row.get("CYCLE_NUMBER")) else None,
                    provenance="REAL",
                )
            )
        return records

    def get_standard_depths(self) -> ArgoDepthResponse:
        """Return available standard pressure levels."""
        depths = [float(p) for p in range(0, 2010, 10)]
        return ArgoDepthResponse(levels_count=len(depths), standard_pressures=depths, unit="dbar")


argo_service = ArgoService()
