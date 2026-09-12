from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

from data_service import (
    dataset_summary,
    get_observations,
    standardize_profiles,
    add_density_products,
    add_vertical_gradients,
)
from ariel_observations import router as ariel_observations_router


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="Oceiana Ocean Data API",
    description=(
        "Backend API for Argo ocean observations, "
        "standardized profiles, seawater density products, "
        "vertical oceanographic gradients, and ARIEL Observation Profile."
    ),
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ARIEL Webpage 2 — Observation Profile (Model / Glider / Argo)
app.include_router(ariel_observations_router)


# ============================================================
# INTERNAL DATA LOADER
# ============================================================

def get_scientific_data():
    """
    Load the standardized Argo dataset and calculate
    derived oceanographic products.

    Pipeline:

        Raw Argo
            ↓
        Standard pressure grid
            ↓
        TEOS-10 derived variables
            ↓
        Vertical gradients
    """

    df = standardize_profiles()
    df = add_density_products(df)
    df = add_vertical_gradients(df)

    return df


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "Oceiana Ocean Data API",
        "version": "2.0.0",
        "data": {
            "source": "Argo",
            "standardized": True,
            "density_products": True,
            "vertical_gradients": True,
        },
        "endpoints": [
            "/api/argo",
            "/api/argo/observations",
            "/api/argo/profiles",
            "/api/argo/profile/{profile_id}",
            "/api/argo/depth",
            "/api/observations",
            "/api/observations/{id}",
            "/api/observations/{id}/profile",
        ],
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "Oceiana Ocean Data API",
    }


# ============================================================
# DATASET SUMMARY
# ============================================================

@app.get("/api/argo")
def argo_summary():
    """
    Return metadata and scientific ranges
    for the loaded Argo dataset.
    """

    try:
        summary = dataset_summary()

        # Add information about the processed scientific layer.
        df = get_scientific_data()

        summary["processed_data"] = {
            "standardized": True,
            "density_products": True,
            "vertical_gradients": True,
            "rows": int(len(df)),
            "pressure_levels": int(df["PRES"].nunique()),
        }

        summary["derived_variables"] = {
            "absolute_salinity": True,
            "conservative_temperature": True,
            "sigma0_density": True,
            "temperature_gradient": True,
            "salinity_gradient": True,
            "density_gradient": True,
        }

        return summary

    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


# ============================================================
# ARGO OBSERVATIONS
# ============================================================

@app.get("/api/argo/observations")
def argo_observations(
    # --------------------------------------------------------
    # Result limit
    # --------------------------------------------------------

    limit: int = Query(
        default=1000,
        ge=1,
        le=10000,
        description="Maximum number of observations to return.",
    ),

    # --------------------------------------------------------
    # Spatial filters
    # --------------------------------------------------------

    min_lat: Optional[float] = Query(
        default=None,
        ge=-90,
        le=90,
        description="Minimum latitude.",
    ),

    max_lat: Optional[float] = Query(
        default=None,
        ge=-90,
        le=90,
        description="Maximum latitude.",
    ),

    min_lon: Optional[float] = Query(
        default=None,
        ge=-180,
        le=180,
        description="Minimum longitude.",
    ),

    max_lon: Optional[float] = Query(
        default=None,
        ge=-180,
        le=180,
        description="Maximum longitude.",
    ),

    # --------------------------------------------------------
    # Pressure filters
    # --------------------------------------------------------

    min_pressure: Optional[float] = Query(
        default=None,
        ge=0,
        description="Minimum pressure in dbar.",
    ),

    max_pressure: Optional[float] = Query(
        default=None,
        ge=0,
        description="Maximum pressure in dbar.",
    ),

    # --------------------------------------------------------
    # Time filters
    # --------------------------------------------------------

    start_time: Optional[str] = Query(
        default=None,
        description="ISO-8601 start timestamp.",
    ),

    end_time: Optional[str] = Query(
        default=None,
        description="ISO-8601 end timestamp.",
    ),

    # --------------------------------------------------------
    # Temperature filters
    # --------------------------------------------------------

    min_temperature: Optional[float] = Query(
        default=None,
        description="Minimum temperature in °C.",
    ),

    max_temperature: Optional[float] = Query(
        default=None,
        description="Maximum temperature in °C.",
    ),

    # --------------------------------------------------------
    # Salinity filters
    # --------------------------------------------------------

    min_salinity: Optional[float] = Query(
        default=None,
        description="Minimum salinity in PSU.",
    ),

    max_salinity: Optional[float] = Query(
        default=None,
        description="Maximum salinity in PSU.",
    ),

    # --------------------------------------------------------
    # Standardized data
    # --------------------------------------------------------

    standardized: bool = Query(
        default=False,
        description=(
            "Return observations interpolated onto "
            "the common pressure grid."
        ),
    ),
):
    """
    Return filtered Argo observations.

    By default, raw validated observations are returned.

    Set standardized=true to return observations from
    the common pressure grid.
    """

    # --------------------------------------------------------
    # Validate ranges
    # --------------------------------------------------------

    if (
        min_lat is not None
        and max_lat is not None
        and min_lat > max_lat
    ):
        raise HTTPException(
            status_code=400,
            detail="min_lat cannot be greater than max_lat.",
        )

    if (
        min_lon is not None
        and max_lon is not None
        and min_lon > max_lon
    ):
        raise HTTPException(
            status_code=400,
            detail="min_lon cannot be greater than max_lon.",
        )

    if (
        min_pressure is not None
        and max_pressure is not None
        and min_pressure > max_pressure
    ):
        raise HTTPException(
            status_code=400,
            detail="min_pressure cannot be greater than max_pressure.",
        )

    if (
        min_temperature is not None
        and max_temperature is not None
        and min_temperature > max_temperature
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "min_temperature cannot be greater "
                "than max_temperature."
            ),
        )

    if (
        min_salinity is not None
        and max_salinity is not None
        and min_salinity > max_salinity
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "min_salinity cannot be greater "
                "than max_salinity."
            ),
        )

    # --------------------------------------------------------
    # Validate timestamps
    # --------------------------------------------------------

    if start_time is not None:
        try:
            from pandas import to_datetime

            to_datetime(
                start_time,
                errors="raise",
                utc=True,
            )

        except Exception:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid start_time. "
                    "Use an ISO-8601 timestamp."
                ),
            )

    if end_time is not None:
        try:
            from pandas import to_datetime

            to_datetime(
                end_time,
                errors="raise",
                utc=True,
            )

        except Exception:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid end_time. "
                    "Use an ISO-8601 timestamp."
                ),
            )

    # --------------------------------------------------------
    # Query
    # --------------------------------------------------------

    try:
        observations = get_observations(
            limit=limit,

            min_lat=min_lat,
            max_lat=max_lat,

            min_lon=min_lon,
            max_lon=max_lon,

            min_pressure=min_pressure,
            max_pressure=max_pressure,

            start_time=start_time,
            end_time=end_time,

            min_temperature=min_temperature,
            max_temperature=max_temperature,

            min_salinity=min_salinity,
            max_salinity=max_salinity,

            standardized=standardized,
        )

    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    return {
        "count": len(observations),

        "standardized": standardized,

        "filters": {
            "min_lat": min_lat,
            "max_lat": max_lat,

            "min_lon": min_lon,
            "max_lon": max_lon,

            "min_pressure": min_pressure,
            "max_pressure": max_pressure,

            "start_time": start_time,
            "end_time": end_time,

            "min_temperature": min_temperature,
            "max_temperature": max_temperature,

            "min_salinity": min_salinity,
            "max_salinity": max_salinity,
        },

        "observations": observations,
    }


# ============================================================
# PROFILE LIST
# ============================================================

@app.get("/api/argo/profiles")
def argo_profiles():
    """
    Return one metadata record for every Argo profile.

    This endpoint is intended for the globe/map layer.
    """

    try:
        df = get_scientific_data()

    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )

    profiles = []

    for profile_id, group in df.groupby("PROFILE_ID"):
        first = group.iloc[0]

        profiles.append(
            {
                "profile_id": int(profile_id),

                "latitude": float(first["LATITUDE"]),
                "longitude": float(first["LONGITUDE"]),

                "time": first["TIME"].isoformat(),

                "point_count": int(len(group)),

                "min_pressure": float(group["PRES"].min()),
                "max_pressure": float(group["PRES"].max()),

                "min_temperature": float(group["TEMP"].min()),
                "max_temperature": float(group["TEMP"].max()),

                "min_salinity": float(group["PSAL"].min()),
                "max_salinity": float(group["PSAL"].max()),

                "min_sigma0": float(group["SIGMA0"].min()),
                "max_sigma0": float(group["SIGMA0"].max()),
            }
        )

    return {
        "count": len(profiles),
        "profiles": profiles,
    }


# ============================================================
# SINGLE PROFILE
# ============================================================

@app.get("/api/argo/profile/{profile_id}")
def argo_profile(
    profile_id: int,
):
    """
    Return the complete vertical scientific profile.

    Includes:

        pressure
        temperature
        salinity
        absolute salinity
        conservative temperature
        sigma0
        temperature gradient
        salinity gradient
        density gradient
    """

    try:
        df = get_scientific_data()

    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )

    profile = df[df["PROFILE_ID"] == profile_id]

    if profile.empty:
        raise HTTPException(
            status_code=404,
            detail=f"Profile {profile_id} not found.",
        )

    first = profile.iloc[0]

    observations = []

    for _, row in profile.iterrows():

        observations.append(
            {
                "pressure": float(row["PRES"]),

                "temperature": float(row["TEMP"]),
                "salinity": float(row["PSAL"]),

                "absolute_salinity": float(row["SA"]),
                "conservative_temperature": float(row["CT"]),
                "sigma0": float(row["SIGMA0"]),

                "temperature_gradient": (
                    None
                    if row["TEMP_GRADIENT"] != row["TEMP_GRADIENT"]
                    else float(row["TEMP_GRADIENT"])
                ),

                "salinity_gradient": (
                    None
                    if row["SA_GRADIENT"] != row["SA_GRADIENT"]
                    else float(row["SA_GRADIENT"])
                ),

                "density_gradient": (
                    None
                    if row["SIGMA0_GRADIENT"] != row["SIGMA0_GRADIENT"]
                    else float(row["SIGMA0_GRADIENT"])
                ),
            }
        )

    return {
        "profile_id": int(profile_id),

        "location": {
            "latitude": float(first["LATITUDE"]),
            "longitude": float(first["LONGITUDE"]),
        },

        "time": first["TIME"].isoformat(),

        "pressure_range": {
            "min": float(profile["PRES"].min()),
            "max": float(profile["PRES"].max()),
        },

        "point_count": len(observations),

        "observations": observations,
    }


# ============================================================
# DEPTH SLICE
# ============================================================

@app.get("/api/argo/depth")
def argo_depth(
    pressure: float = Query(
        ...,
        ge=0,
        description="Target pressure/depth level in dbar.",
    ),

    tolerance: float = Query(
        default=5.0,
        gt=0,
        description=(
            "Maximum pressure difference allowed "
            "when selecting observations."
        ),
    ),

    variable: str = Query(
        default="temperature",
        description=(
            "Variable to return. "
            "temperature, salinity, sigma0, "
            "temperature_gradient, salinity_gradient, "
            "or density_gradient."
        ),
    ),
):
    """
    Return a horizontal depth/pressure slice.

    This endpoint is useful for rendering a 3D underwater
    layer at a selected depth.
    """

    allowed_variables = {
        "temperature": "TEMP",
        "salinity": "PSAL",
        "sigma0": "SIGMA0",
        "temperature_gradient": "TEMP_GRADIENT",
        "salinity_gradient": "SA_GRADIENT",
        "density_gradient": "SIGMA0_GRADIENT",
    }

    if variable not in allowed_variables:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid variable '{variable}'. "
                f"Allowed values: "
                f"{', '.join(allowed_variables.keys())}"
            ),
        )

    try:
        df = get_scientific_data()

    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )

    value_column = allowed_variables[variable]

    # Find the nearest pressure value independently for
    # each observation.
    df = df.copy()

    df["PRESSURE_DISTANCE"] = (
        df["PRES"] - pressure
    ).abs()

    df = df[
        df["PRESSURE_DISTANCE"] <= tolerance
    ]

    if df.empty:
        return {
            "pressure_requested": pressure,
            "tolerance": tolerance,
            "variable": variable,
            "count": 0,
            "points": [],
        }

    # Keep the closest pressure observation for each profile.
    df = (
        df.sort_values("PRESSURE_DISTANCE")
        .groupby("PROFILE_ID", as_index=False)
        .first()
    )

    points = []

    for _, row in df.iterrows():

        value = row[value_column]

        if value != value:
            continue

        points.append(
            {
                "profile_id": int(row["PROFILE_ID"]),

                "latitude": float(row["LATITUDE"]),
                "longitude": float(row["LONGITUDE"]),

                "pressure": float(row["PRES"]),

                "value": float(value),
            }
        )

    return {
        "pressure_requested": pressure,

        "tolerance": tolerance,

        "variable": variable,

        "count": len(points),

        "points": points,
    }


# ============================================================
# STANDARDIZED SCIENTIFIC DATA
# ============================================================

@app.get("/api/argo/scientific")
def argo_scientific(
    limit: int = Query(
        default=5000,
        ge=1,
        le=20000,
    ),

    profile_id: Optional[int] = Query(
        default=None,
    ),

    min_pressure: Optional[float] = Query(
        default=None,
        ge=0,
    ),

    max_pressure: Optional[float] = Query(
        default=None,
        ge=0,
    ),
):
    """
    Return standardized scientific observations with
    TEOS-10 products and vertical gradients.
    """

    if (
        min_pressure is not None
        and max_pressure is not None
        and min_pressure > max_pressure
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "min_pressure cannot be greater "
                "than max_pressure."
            ),
        )

    try:
        df = get_scientific_data()

    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )

    if profile_id is not None:
        df = df[df["PROFILE_ID"] == profile_id]

    if min_pressure is not None:
        df = df[df["PRES"] >= min_pressure]

    if max_pressure is not None:
        df = df[df["PRES"] <= max_pressure]

    df = df.head(limit)

    observations = []

    for _, row in df.iterrows():

        observations.append(
            {
                "profile_id": int(row["PROFILE_ID"]),

                "latitude": float(row["LATITUDE"]),
                "longitude": float(row["LONGITUDE"]),

                "time": row["TIME"].isoformat(),

                "pressure": float(row["PRES"]),

                "temperature": float(row["TEMP"]),
                "salinity": float(row["PSAL"]),

                "absolute_salinity": float(row["SA"]),
                "conservative_temperature": float(row["CT"]),
                "sigma0": float(row["SIGMA0"]),

                "temperature_gradient": (
                    None
                    if row["TEMP_GRADIENT"] != row["TEMP_GRADIENT"]
                    else float(row["TEMP_GRADIENT"])
                ),

                "salinity_gradient": (
                    None
                    if row["SA_GRADIENT"] != row["SA_GRADIENT"]
                    else float(row["SA_GRADIENT"])
                ),

                "density_gradient": (
                    None
                    if row["SIGMA0_GRADIENT"] != row["SIGMA0_GRADIENT"]
                    else float(row["SIGMA0_GRADIENT"])
                ),
            }
        )

    return {
        "count": len(observations),

        "filters": {
            "profile_id": profile_id,
            "min_pressure": min_pressure,
            "max_pressure": max_pressure,
        },

        "observations": observations,
    }


# ============================================================
# RUN DIRECTLY
# ============================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
    )