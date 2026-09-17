from fastapi import FastAPI, Query, HTTPException

from data_service import (
    dataset_summary,
    get_observations,
)


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="Ariel Ocean Data API",
    description=(
        "Backend API for Argo ocean observations "
        "and scientific filtering."
    ),
    version="1.1.0",
)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "Ariel Ocean Data API",
        "version": "1.1.0",
    }


# ============================================================
# DATASET SUMMARY
# ============================================================

@app.get("/api/argo")
def argo_summary():
    """
    Return scientific metadata and ranges
    for the loaded Argo dataset.
    """

    try:
        return dataset_summary()

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

    min_lat: float | None = Query(
        default=None,
        ge=-90,
        le=90,
        description="Minimum latitude.",
    ),

    max_lat: float | None = Query(
        default=None,
        ge=-90,
        le=90,
        description="Maximum latitude.",
    ),

    min_lon: float | None = Query(
        default=None,
        ge=-180,
        le=180,
        description="Minimum longitude.",
    ),

    max_lon: float | None = Query(
        default=None,
        ge=-180,
        le=180,
        description="Maximum longitude.",
    ),

    # --------------------------------------------------------
    # Pressure filters
    # --------------------------------------------------------

    min_pressure: float | None = Query(
        default=None,
        ge=0,
        description="Minimum Argo pressure in dbar.",
    ),

    max_pressure: float | None = Query(
        default=None,
        ge=0,
        description="Maximum Argo pressure in dbar.",
    ),

    # --------------------------------------------------------
    # Time filters
    # --------------------------------------------------------

    start_time: str | None = Query(
        default=None,
        description="ISO-8601 start timestamp.",
    ),

    end_time: str | None = Query(
        default=None,
        description="ISO-8601 end timestamp.",
    ),

    # --------------------------------------------------------
    # Temperature filters
    # --------------------------------------------------------

    min_temperature: float | None = Query(
        default=None,
        description="Minimum temperature in °C.",
    ),

    max_temperature: float | None = Query(
        default=None,
        description="Maximum temperature in °C.",
    ),

    # --------------------------------------------------------
    # Salinity filters
    # --------------------------------------------------------

    min_salinity: float | None = Query(
        default=None,
        description="Minimum salinity in PSU.",
    ),

    max_salinity: float | None = Query(
        default=None,
        description="Maximum salinity in PSU.",
    ),
):
    """
    Return filtered and normalized Argo observations.
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
            detail=(
                "min_pressure cannot be greater "
                "than max_pressure."
            ),
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
    # Query dataset
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

    # --------------------------------------------------------
    # Response
    # --------------------------------------------------------

    return {
        "count": len(observations),

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