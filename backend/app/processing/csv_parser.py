import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import pandas as pd
import numpy as np
from app.core.errors import IngestionError
from .netcdf_parser import VARIABLE_ALIASES


class CSVParser:
    """Parser for CSV and delimited ASCII oceanographic cruise tables."""

    @staticmethod
    def read_csv(file_path: Path | str) -> pd.DataFrame:
        path_str = str(file_path)
        if not os.path.exists(path_str):
            raise IngestionError(f"File not found: {path_str}")

        # Try comma, then tab, then whitespace
        for sep in [",", "\t", r"\s+"]:
            try:
                df = pd.read_csv(path_str, sep=sep, engine="python")
                if len(df.columns) > 2:
                    return df
            except Exception:
                continue

        raise IngestionError(f"Unable to parse delimited file {path_str}")

    @classmethod
    def match_column(cls, df: pd.DataFrame, target_type: str) -> Optional[str]:
        aliases = VARIABLE_ALIASES.get(target_type, [target_type])
        cols = list(df.columns)
        for col in cols:
            if col in aliases or col.lower() in [a.lower() for a in aliases]:
                return col
        return None

    @classmethod
    def inspect_csv(cls, df: pd.DataFrame) -> Dict[str, Any]:
        detected = []
        for col in df.columns:
            matched_type = "unknown"
            for var_type in VARIABLE_ALIASES:
                matched = cls.match_column(df[[col]], var_type)
                if matched:
                    matched_type = var_type
                    break

            detected.append({
                "name": str(col),
                "standard_name": matched_type,
                "units": "",
                "dimensions": [f"rows:{len(df)}"],
                "detected_type": str(df[col].dtype),
                "is_coordinate": matched_type in ["latitude", "longitude", "depth", "time"],
                "is_ocean_variable": matched_type not in ["latitude", "longitude", "depth", "time", "unknown"],
            })

        lat_col = cls.match_column(df, "latitude")
        lon_col = cls.match_column(df, "longitude")
        spatial_bounds = None
        if lat_col and lon_col:
            try:
                lats = pd.to_numeric(df[lat_col], errors="coerce").dropna()
                lons = pd.to_numeric(df[lon_col], errors="coerce").dropna()
                spatial_bounds = {
                    "min_lat": float(lats.min()),
                    "max_lat": float(lats.max()),
                    "min_lon": float(lons.min()),
                    "max_lon": float(lons.max()),
                }
            except Exception:
                pass

        depth_col = cls.match_column(df, "depth")
        depth_range = None
        if depth_col:
            try:
                d = pd.to_numeric(df[depth_col], errors="coerce").dropna()
                depth_range = [float(d.min()), float(d.max())]
            except Exception:
                pass

        return {
            "dimensions": {"rows": len(df), "columns": len(df.columns)},
            "coordinates": [c["name"] for c in detected if c["is_coordinate"]],
            "detected_variables": detected,
            "spatial_bounds": spatial_bounds,
            "depth_range": depth_range,
            "attributes": {},
        }
