"""
app.science.fronts — SST and chlorophyll front detection (Bay of Bengal).

Method: Belkin–O'Reilly (BOR) algorithm (2009) — gradient-based front detection
  on gridded SST or chlorophyll fields.

Algorithm:
  1. Compute gradient magnitude: |∇F| = sqrt((∂F/∂x)² + (∂F/∂y)²)
     using central finite differences on the regular grid.
  2. Convert to physical units: °C/km for SST, (mg/m³)/km for chlorophyll.
  3. Apply threshold: front exists where |∇F| > threshold.
     Default thresholds (empirical, Bay of Bengal):
       SST:  0.03 °C/km   (weak fronts typical in BoB in winter)
       Chl:  0.005 (mg/m³)/km
  4. Return a contour/mask of front pixels and peak gradient locations.

Note: This is a simple Sobel-like gradient approach. The full BOR algorithm
  includes median filtering; that step is marked TODO for Phase 4.

References:
  Belkin, I. M., & O'Reilly, J. E. (2009). An algorithm for oceanic front
  detection in chlorophyll and SST satellite imagery. Journal of Marine Systems,
  78(3), 319–326. https://doi.org/10.1016/j.jmarsys.2008.11.018

  Kostianoy, A. G., & Rodionov, S. N. (1986). On the frontal zones in the
  open ocean. Oceanology, 26(3), 302–309.

Provenance: DERIVED from REAL satellite SST/chl (MUR SST, VIIRS).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np

logger = logging.getLogger("ariel.science.fronts")

# Default thresholds
SST_FRONT_THRESHOLD_C_KM = 0.03         # °C/km
CHL_FRONT_THRESHOLD_MG_M3_KM = 0.005   # (mg/m³)/km

EARTH_RADIUS_KM = 6371.0

METHOD_REF = (
    "Belkin, I. M., & O'Reilly, J. E. (2009). An algorithm for oceanic front "
    "detection in chlorophyll and SST satellite imagery. "
    "Journal of Marine Systems, 78(3), 319–326. "
    "https://doi.org/10.1016/j.jmarsys.2008.11.018"
)


@dataclass
class FrontDetectionResult:
    variable: str                      # "sst" or "chl"
    n_front_pixels: int
    front_fraction: float              # fraction of domain with fronts
    mean_gradient_C_km: float
    max_gradient_C_km: float
    threshold_C_km: float
    # Sparse list of front pixel centres (lat, lon, gradient)
    front_points: list[dict] = field(default_factory=list)
    provenance: str = "DERIVED"
    source_sst: str = "NOAA JPL MUR SST v4.1 (L4 analysed satellite SST)"
    source_chl: str = "VIIRS-SNPP OC, NOAA CoastWatch ERDDAP"
    method: str = "Gradient magnitude |∇F| with central finite differences"
    method_ref: str = METHOD_REF
    flag: str = "OK"


def _deg_to_km_dx(lat: np.ndarray, dlon_deg: float) -> np.ndarray:
    """Convert longitude spacing (degrees) to km at a given latitude."""
    return dlon_deg * (np.pi / 180.0) * EARTH_RADIUS_KM * np.cos(np.deg2rad(lat))


def _deg_to_km_dy(dlat_deg: float) -> float:
    """Convert latitude spacing (degrees) to km."""
    return dlat_deg * (np.pi / 180.0) * EARTH_RADIUS_KM


def compute_front_mask(
    lats: np.ndarray,
    lons: np.ndarray,
    field_2d: np.ndarray,
    threshold: float,
    variable: str = "sst",
    max_front_points: int = 500,
) -> FrontDetectionResult:
    """
    Detect oceanic fronts in a 2D gridded field.

    Parameters
    ----------
    lats     : 1D array of latitudes (degrees N), shape (nlat,)
    lons     : 1D array of longitudes (degrees E), shape (nlon,)
    field_2d : 2D field array, shape (nlat, nlon), NaN for missing
    threshold: gradient threshold for front detection (same units as gradient)
    variable : "sst" or "chl"

    Returns FrontDetectionResult with front_points as a list of dicts.
    """
    nlat, nlon = field_2d.shape
    if nlat < 3 or nlon < 3:
        return FrontDetectionResult(variable=variable, n_front_pixels=0,
                                     front_fraction=0.0, mean_gradient_C_km=0.0,
                                     max_gradient_C_km=0.0, threshold_C_km=threshold,
                                     flag="TOO_SMALL")

    dlat = float(np.abs(np.diff(lats).mean())) if len(lats) > 1 else 1.0
    dlon = float(np.abs(np.diff(lons).mean())) if len(lons) > 1 else 1.0

    dy_km = _deg_to_km_dy(dlat)  # constant across domain

    # dy and dx gradients using numpy.gradient (central finite diff)
    # Returns: [d/dy, d/dx] where y=lat axis=0, x=lon axis=1
    grad_y, grad_x = np.gradient(field_2d, dy_km)

    # dx varies with latitude — correct each row
    for i, lat_i in enumerate(lats):
        dx_km = _deg_to_km_dx(np.array([lat_i]), dlon)[0]
        if dx_km > 0:
            grad_x[i, :] /= (dlon / dx_km) if dlon > 0 else 1.0
        # Actually recompute: np.gradient gives d/d(index), not d/km
        # Recompute properly row by row
        dx_km_row = _deg_to_km_dx(np.array([lat_i]), dlon)[0]
        if dx_km_row > 0:
            grad_x[i, :] = np.gradient(field_2d[i, :], dx_km_row)

    grad_mag = np.sqrt(grad_x ** 2 + grad_y ** 2)  # units: variable_unit / km

    # Mask NaN
    nan_mask = np.isnan(field_2d)
    grad_mag[nan_mask] = float("nan")

    valid = grad_mag[~nan_mask]
    if len(valid) == 0:
        return FrontDetectionResult(variable=variable, n_front_pixels=0,
                                     front_fraction=0.0, mean_gradient_C_km=0.0,
                                     max_gradient_C_km=0.0, threshold_C_km=threshold,
                                     flag="ALL_NAN")

    front_mask = grad_mag > threshold
    n_front = int(np.nansum(front_mask))
    n_total = int(np.sum(~nan_mask))
    fraction = float(n_front / n_total) if n_total > 0 else 0.0
    mean_grad = float(np.nanmean(valid))
    max_grad = float(np.nanmax(valid))

    # Collect front pixel locations (subsample if too many)
    front_pixels = list(zip(*np.where(front_mask)))
    if len(front_pixels) > max_front_points:
        step = len(front_pixels) // max_front_points
        front_pixels = front_pixels[::step]

    front_points = []
    for (i, j) in front_pixels:
        front_points.append({
            "lat": round(float(lats[i]), 4),
            "lon": round(float(lons[j]), 4),
            "gradient": round(float(grad_mag[i, j]), 5),
        })

    logger.info(
        f"Front detection ({variable}): {n_front}/{n_total} pixels "
        f"({fraction * 100:.1f}%), max_grad={max_grad:.4f}/km, "
        f"threshold={threshold}/km"
    )

    return FrontDetectionResult(
        variable=variable,
        n_front_pixels=n_front,
        front_fraction=round(fraction, 4),
        mean_gradient_C_km=round(mean_grad, 5),
        max_gradient_C_km=round(max_grad, 5),
        threshold_C_km=threshold,
        front_points=front_points,
        flag="OK",
    )


def detect_sst_fronts(
    lats: np.ndarray,
    lons: np.ndarray,
    sst_2d: np.ndarray,
    threshold: float = SST_FRONT_THRESHOLD_C_KM,
) -> FrontDetectionResult:
    """Detect SST fronts. Input: sst_2d in °C, shape (nlat, nlon)."""
    result = compute_front_mask(lats, lons, sst_2d, threshold, variable="sst")
    result.source_sst = "NOAA JPL MUR SST v4.1 (L4 analysed)"
    return result


def detect_chl_fronts(
    lats: np.ndarray,
    lons: np.ndarray,
    chl_2d: np.ndarray,
    threshold: float = CHL_FRONT_THRESHOLD_MG_M3_KM,
) -> FrontDetectionResult:
    """Detect chlorophyll fronts. Input: chl_2d in mg/m³, shape (nlat, nlon)."""
    result = compute_front_mask(lats, lons, chl_2d, threshold, variable="chl")
    result.source_chl = "VIIRS-SNPP OC (chlorophyll-a L3 monthly), NOAA CoastWatch"
    return result


def front_summary(result: FrontDetectionResult) -> dict:
    """Format front detection result for API response."""
    return {
        "variable": result.variable,
        "n_front_pixels": result.n_front_pixels,
        "front_fraction_pct": round(result.front_fraction * 100, 2),
        "mean_gradient": result.mean_gradient_C_km,
        "max_gradient": result.max_gradient_C_km,
        "threshold": result.threshold_C_km,
        "n_front_points_returned": len(result.front_points),
        "provenance": result.provenance,
        "source_sst": result.source_sst,
        "method": result.method,
        "method_ref": result.method_ref,
        "flag": result.flag,
    }
