import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import xarray as xr
from app.core.logging import logger
from app.core.errors import IngestionError

# CF conventions and operational alias map
VARIABLE_ALIASES = {
    "latitude": ["lat", "latitude", "nav_lat", "LATITUDE", "lat_rho", "y"],
    "longitude": ["lon", "longitude", "nav_lon", "LONGITUDE", "lon_rho", "x"],
    "depth": ["depth", "DEPTH", "deptht", "pres", "pressure", "PRES", "lev", "level", "z"],
    "time": ["time", "TIME", "time_counter", "date"],
    "temperature": ["temp", "TEMP", "thetao", "temperature", "to", "sea_water_temperature"],
    "salinity": ["psal", "PSAL", "so", "salinity", "sea_water_salinity", "practical_salinity"],
    "u_current": ["uo", "u", "u_current", "eastward_sea_water_velocity"],
    "v_current": ["vo", "v", "v_current", "northward_sea_water_velocity"],
    "chlorophyll": ["chl", "CHL", "chlorophyll", "chlorophyll_a", "mass_concentration_of_chlorophyll_a_in_sea_water"],
    "oxygen": ["oxygen", "OXY", "doxy", "dissolved_oxygen"],
}


class NetCDFParser:
    """Scientific NetCDF reader leveraging xarray with CF-convention resolution."""

    @staticmethod
    def open_dataset(file_path: Path | str) -> xr.Dataset:
        """Open a NetCDF dataset safely, trying netcdf4 and h5netcdf engines."""
        path_str = str(file_path)
        if not os.path.exists(path_str):
            raise IngestionError(f"NetCDF file not found: {path_str}")

        try:
            return xr.open_dataset(path_str, engine="netcdf4")
        except Exception as e1:
            try:
                return xr.open_dataset(path_str, engine="h5netcdf")
            except Exception as e2:
                try:
                    return xr.open_dataset(path_str)
                except Exception as e3:
                    raise IngestionError(f"Failed to open NetCDF file {path_str}: {e1} | {e2} | {e3}")

    @staticmethod
    def find_coordinate(ds: xr.Dataset, coord_type: str) -> Optional[str]:
        """Find matching coordinate or data variable name based on aliases."""
        aliases = VARIABLE_ALIASES.get(coord_type, [coord_type])
        for name in list(ds.coords) + list(ds.data_vars):
            if name in aliases or name.lower() in [a.lower() for a in aliases]:
                return name
            # Check standard_name and long_name attributes
            var = ds[name]
            std_name = var.attrs.get("standard_name", "").lower()
            long_name = var.attrs.get("long_name", "").lower()
            for alias in aliases:
                if alias.lower() in std_name or alias.lower() in long_name:
                    return name
        return None

    @classmethod
    def inspect_schema(cls, ds: xr.Dataset) -> Dict[str, Any]:
        """Inspect variables, dimensions, coordinates, and attributes."""
        detected = []
        for var_name in ds.data_vars:
            da = ds[var_name]
            v_type = "scalar"
            is_coord = var_name in ds.coords
            is_ocean = any(var_name in aliases or var_name.lower() in [a.lower() for a in aliases]
                           for k, aliases in VARIABLE_ALIASES.items() if k not in ["latitude", "longitude", "depth", "time"])

            detected.append({
                "name": str(var_name),
                "standard_name": str(da.attrs.get("standard_name", "")),
                "units": str(da.attrs.get("units", "")),
                "dimensions": [str(d) for d in da.dims],
                "detected_type": v_type,
                "is_coordinate": is_coord,
                "is_ocean_variable": is_ocean,
            })

        lat_coord = cls.find_coordinate(ds, "latitude")
        lon_coord = cls.find_coordinate(ds, "longitude")
        spatial_bounds = None
        if lat_coord and lon_coord:
            try:
                lat_vals = ds[lat_coord].values
                lon_vals = ds[lon_coord].values
                spatial_bounds = {
                    "min_lat": float(np.nanmin(lat_vals)),
                    "max_lat": float(np.nanmax(lat_vals)),
                    "min_lon": float(np.nanmin(lon_vals)),
                    "max_lon": float(np.nanmax(lon_vals)),
                }
            except Exception as e:
                logger.warning(f"Could not compute spatial bounds: {e}")

        depth_coord = cls.find_coordinate(ds, "depth")
        depth_range = None
        if depth_coord:
            try:
                d_vals = ds[depth_coord].values
                depth_range = [float(np.nanmin(d_vals)), float(np.nanmax(d_vals))]
            except Exception:
                pass

        dims_dict = {str(k): int(v) for k, v in getattr(ds, "sizes", ds.dims).items()}
        return {
            "dimensions": dims_dict,
            "coordinates": list(ds.coords.keys()),
            "detected_variables": detected,
            "spatial_bounds": spatial_bounds,
            "depth_range": depth_range,
            "attributes": {str(k): str(v) for k, v in ds.attrs.items()},
        }
