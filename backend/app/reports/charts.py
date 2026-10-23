"""
app.reports.charts — Headless matplotlib charting utilities for Oceiana reports.

Generates self-contained base64 PNG data URIs.
- Palette: Colorblind-safe sequential and diverging (viridis, plasma, cividis, coolwarm).
- Every figure carries axis units, legends, and a mandatory source footer.
- Renders entirely offline without network access.
"""

from __future__ import annotations

import base64
import io
import logging
from typing import List, Optional

import matplotlib
matplotlib.use("Agg")  # Non-interactive headless backend
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

logger = logging.getLogger("ariel.reports.charts")

plt.rcParams.update({
    "font.sans-serif": ["DejaVu Sans", "Helvetica", "Arial"],
    "font.family": "sans-serif",
    "figure.autolayout": True,
    "figure.dpi": 150,
})


def fig_to_base64_png(fig: plt.Figure) -> str:
    """Convert matplotlib figure to base64 data-uri string and close figure."""
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", dpi=150)
    plt.close(fig)
    buf.seek(0)
    encoded = base64.b64encode(buf.read()).decode("utf-8")
    return f"data:image/png;base64,{encoded}"


def plot_basin_scatter(
    lons: np.ndarray,
    lats: np.ndarray,
    values: np.ndarray,
    val_label: str,
    title: str,
    cmap: str = "viridis",
    source_text: str = "Source: Argo — Ifremer ERDDAP (DOI 10.17882/42182)",
    cbar_limits: Optional[tuple[float, float]] = None,
) -> str:
    """
    Plot spatial scatter of Argo profile locations color-coded by a metric (MLD, D26, TCHP).
    """
    fig, ax = plt.subplots(figsize=(6.5, 5.0))

    # Basin boundaries for Bay of Bengal (5–23°N, 80–100°E)
    ax.set_xlim(80, 100)
    ax.set_ylim(5, 23)
    ax.set_xlabel("Longitude (°E)", fontsize=10)
    ax.set_ylabel("Latitude (°N)", fontsize=10)
    ax.set_title(title, fontsize=11, fontweight="bold", pad=10)
    ax.grid(True, linestyle="--", alpha=0.4)

    # Simplified Indian subcontinent coastline sketch
    coast_lon = [80.0, 80.2, 82.0, 85.0, 87.0, 89.0, 92.0, 92.5]
    coast_lat = [13.0, 15.0, 17.0, 19.5, 21.5, 22.0, 21.0, 15.0]
    ax.plot(coast_lon, coast_lat, color="#888888", linestyle=":", linewidth=1.2, label="Coast outline")

    vmin, vmax = cbar_limits if cbar_limits else (None, None)
    sc = ax.scatter(
        lons, lats, c=values, cmap=cmap, vmin=vmin, vmax=vmax,
        s=45, edgecolor="black", linewidth=0.5, alpha=0.9, zorder=5
    )

    cbar = fig.colorbar(sc, ax=ax, fraction=0.046, pad=0.04)
    cbar.set_label(val_label, fontsize=9)
    cbar.ax.tick_params(labelsize=8)

    # Mandatory source footer
    fig.text(0.12, 0.01, source_text, fontsize=7, color="#555555", style="italic")

    return fig_to_base64_png(fig)


def plot_profile_ensemble(
    df: pd.DataFrame,
    max_profiles: int = 15,
    source_text: str = "Source: Argo — Ifremer ERDDAP (DOI 10.17882/42182)",
) -> str:
    """
    Plot vertical profile ensemble of Temperature and Salinity vs Depth.
    """
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(7.5, 4.5), sharey=True)

    p_col = "PRES"
    t_col = "TEMP"
    s_col = "PSAL"

    profiles = list(df.groupby("PROFILE_ID"))[:max_profiles]

    for _, grp in profiles:
        clean = grp.dropna(subset=[p_col, t_col, s_col]).sort_values(p_col)
        if len(clean) > 5:
            ax1.plot(clean[t_col], clean[p_col], color="#1f77b4", alpha=0.35, linewidth=1.0)
            ax2.plot(clean[s_col], clean[p_col], color="#2ca02c", alpha=0.35, linewidth=1.0)

    # Invert y-axis for depth
    ax1.set_ylim(500, 0)
    ax1.set_xlabel("Temperature (°C)", fontsize=9)
    ax1.set_ylabel("Pressure / Depth (dbar ≈ m)", fontsize=9)
    ax1.set_title("Temperature Profiles", fontsize=10, fontweight="bold")
    ax1.grid(True, linestyle="--", alpha=0.4)

    # Annotate 26°C isotherm threshold
    ax1.axvline(26.0, color="#d62728", linestyle="--", linewidth=1.0, label="26°C threshold (D26)")
    ax1.legend(loc="lower left", fontsize=8)

    ax2.set_xlabel("Practical Salinity (PSU)", fontsize=9)
    ax2.set_title("Salinity Profiles", fontsize=10, fontweight="bold")
    ax2.grid(True, linestyle="--", alpha=0.4)

    fig.text(0.12, 0.01, source_text, fontsize=7, color="#555555", style="italic")

    return fig_to_base64_png(fig)


def plot_cyclone_track_overlay(
    lons_obs: np.ndarray,
    lats_obs: np.ndarray,
    tchp_obs: np.ndarray,
    storm_track: Optional[pd.DataFrame] = None,
    storm_name: str = "Tropical Cyclone",
    source_text: str = "Source: Argo (Ifremer) & IBTrACS v04r01 (NOAA NCEI)",
) -> str:
    """
    Plot TCHP scatter in BoB overlaid with IBTrACS storm track points.
    """
    fig, ax = plt.subplots(figsize=(6.8, 5.2))

    ax.set_xlim(80, 100)
    ax.set_ylim(5, 23)
    ax.set_xlabel("Longitude (°E)", fontsize=10)
    ax.set_ylabel("Latitude (°N)", fontsize=10)
    ax.set_title(f"TCHP & Storm Track Overlay: {storm_name}", fontsize=11, fontweight="bold", pad=10)
    ax.grid(True, linestyle="--", alpha=0.4)

    # TCHP observation background
    sc = ax.scatter(
        lons_obs, lats_obs, c=tchp_obs, cmap="YlOrRd", vmin=0, vmax=100,
        s=50, edgecolor="black", linewidth=0.5, alpha=0.85, zorder=3, label="Argo TCHP (kJ/cm²)"
    )
    cbar = fig.colorbar(sc, ax=ax, fraction=0.046, pad=0.04)
    cbar.set_label("TCHP (kJ/cm²)", fontsize=9)

    # Overlay storm track if available
    if storm_track is not None and not storm_track.empty:
        s_lon = storm_track["lon"].values.astype(float)
        s_lat = storm_track["lat"].values.astype(float)
        ax.plot(s_lon, s_lat, color="#800080", linewidth=2.5, linestyle="-", marker="o", markersize=4,
                label=f"{storm_name} Best Track", zorder=6)

    ax.legend(loc="lower right", fontsize=8)
    fig.text(0.12, 0.01, source_text, fontsize=7, color="#555555", style="italic")

    return fig_to_base64_png(fig)


def plot_validation_residual_by_depth(
    depth_bins: List[str],
    rmse_values: List[float],
    bias_values: List[float],
    source_text: str = "Source: Argo Observations vs CMEMS PHY Analysis",
) -> str:
    """
    Plot bar chart of Model vs In-situ RMSE and Bias across depth bins.
    """
    fig, ax = plt.subplots(figsize=(6.5, 4.0))

    x = np.arange(len(depth_bins))
    width = 0.35

    ax.bar(x - width/2, rmse_values, width, label="Temperature RMSE (°C)", color="#d62728", alpha=0.8)
    ax.bar(x + width/2, bias_values, width, label="Temperature Bias (°C)", color="#1f77b4", alpha=0.8)

    ax.axhline(0, color="black", linewidth=0.8)
    ax.set_ylabel("Error (°C)", fontsize=9)
    ax.set_xlabel("Depth Strata", fontsize=9)
    ax.set_title("Model vs Observation Error by Depth Band", fontsize=10, fontweight="bold")
    ax.set_xticks(x)
    ax.set_xticklabels(depth_bins, fontsize=8)
    ax.legend(loc="upper right", fontsize=8)
    ax.grid(True, linestyle="--", alpha=0.3, axis="y")

    fig.text(0.12, 0.01, source_text, fontsize=7, color="#555555", style="italic")

    return fig_to_base64_png(fig)
