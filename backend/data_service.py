from pathlib import Path

import numpy as np
import pandas as pd


# ============================================================
# PATHS / CONSTANTS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

DATA_PATH = (
    Path(__file__).resolve().parent
    / "data"
    / "raw"
    / "argo_bay_of_bengal_2020-01-01_2020-01-05.csv"
)

PROCESSED_DIR = (
    BASE_DIR
    / "data"
    / "processed"
)

STANDARDIZED_PATH = (
    PROCESSED_DIR
    / "argo_standardized.csv"
)

DERIVED_PATH = (
    PROCESSED_DIR
    / "argo_derived.csv"
)

GRADIENT_PATH = (
    PROCESSED_DIR
    / "argo_gradient.csv"
)

STANDARD_PRESSURE_STEP = 10.0

REQUIRED_COLUMNS = [
    "LATITUDE",
    "LONGITUDE",
    "TIME",
    "PRES",
    "TEMP",
    "PSAL",
]


# ============================================================
# RAW ARGO DATA LOADER
# ============================================================

def load_argo_data() -> pd.DataFrame:
    """
    Load and validate the raw Argo dataset.

    Returns
    -------
    pandas.DataFrame
        Validated raw Argo observations.
    """

    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Argo dataset not found at: {DATA_PATH}"
        )

    df = pd.read_csv(DATA_PATH)

    missing_columns = [
        column
        for column in REQUIRED_COLUMNS
        if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(
            "Missing required Argo columns: "
            + ", ".join(missing_columns)
        )

    # --------------------------------------------------------
    # Normalize column types
    # --------------------------------------------------------

    numeric_columns = [
        "LATITUDE",
        "LONGITUDE",
        "PRES",
        "TEMP",
        "PSAL",
    ]

    for column in numeric_columns:
        df[column] = pd.to_numeric(
            df[column],
            errors="coerce",
        )

    df["TIME"] = pd.to_datetime(
        df["TIME"],
        errors="coerce",
        utc=True,
    )

    # --------------------------------------------------------
    # Remove invalid rows
    # --------------------------------------------------------

    df = df.dropna(
        subset=REQUIRED_COLUMNS
    ).copy()

    # --------------------------------------------------------
    # Validate geographic ranges
    # --------------------------------------------------------

    df = df[
        (df["LATITUDE"] >= -90)
        & (df["LATITUDE"] <= 90)
        & (df["LONGITUDE"] >= -180)
        & (df["LONGITUDE"] <= 180)
    ].copy()

    # --------------------------------------------------------
    # Pressure cannot be negative
    # --------------------------------------------------------

    df = df[
        df["PRES"] >= 0
    ].copy()

    # --------------------------------------------------------
    # Create profile IDs
    #
    # A profile is defined by:
    # latitude + longitude + timestamp
    # --------------------------------------------------------

    profile_columns = [
        "LATITUDE",
        "LONGITUDE",
        "TIME",
    ]

    df["PROFILE_ID"] = (
        df.groupby(
            profile_columns,
            sort=False,
        ).ngroup()
        + 1
    )

    # --------------------------------------------------------
    # Sort observations
    # --------------------------------------------------------

    df = df.sort_values(
        [
            "PROFILE_ID",
            "PRES",
        ]
    ).reset_index(drop=True)

    # --------------------------------------------------------
    # Final column order
    # --------------------------------------------------------

    df = df[
        [
            "PROFILE_ID",
            "LATITUDE",
            "LONGITUDE",
            "TIME",
            "PRES",
            "TEMP",
            "PSAL",
        ]
    ]

    return df


# ============================================================
# STANDARDIZE PROFILES
# ============================================================

def standardize_profiles() -> pd.DataFrame:
    """
    Interpolate each Argo profile onto a common
    10 dbar pressure grid.

    The common grid spans the observed pressure range
    and each profile is interpolated only within its
    own observed pressure range.

    Returns
    -------
    pandas.DataFrame
        Standardized profiles.
    """

    df = load_argo_data()

    standardized_profiles = []

    for profile_id, profile in df.groupby(
        "PROFILE_ID",
        sort=True,
    ):

        profile = profile.sort_values(
            "PRES"
        ).copy()

        # ----------------------------------------------------
        # Remove duplicate pressure levels defensively
        # ----------------------------------------------------

        profile = (
            profile
            .drop_duplicates(
                subset=["PRES"],
                keep="first",
            )
            .sort_values("PRES")
        )

        if len(profile) < 2:
            continue

        pressure_min = float(
            profile["PRES"].min()
        )

        pressure_max = float(
            profile["PRES"].max()
        )

        # ----------------------------------------------------
        # Build common pressure grid
        # ----------------------------------------------------

        start_pressure = (
            np.ceil(
                pressure_min
                / STANDARD_PRESSURE_STEP
            )
            * STANDARD_PRESSURE_STEP
        )

        end_pressure = (
            np.floor(
                pressure_max
                / STANDARD_PRESSURE_STEP
            )
            * STANDARD_PRESSURE_STEP
        )

        pressure_grid = np.arange(
            start_pressure,
            end_pressure
            + STANDARD_PRESSURE_STEP * 0.5,
            STANDARD_PRESSURE_STEP,
        )

        # ----------------------------------------------------
        # Include exact 0 dbar if profile reaches surface
        # ----------------------------------------------------

        if pressure_min <= 0:
            pressure_grid = np.insert(
                pressure_grid,
                0,
                0.0,
            )

        pressure_grid = np.unique(
            np.round(
                pressure_grid,
                6,
            )
        )

        # ----------------------------------------------------
        # Interpolate TEMP and PSAL
        # ----------------------------------------------------

        temp_interp = np.interp(
            pressure_grid,
            profile["PRES"].to_numpy(
                dtype=float
            ),
            profile["TEMP"].to_numpy(
                dtype=float
            ),
        )

        psal_interp = np.interp(
            pressure_grid,
            profile["PRES"].to_numpy(
                dtype=float
            ),
            profile["PSAL"].to_numpy(
                dtype=float
            ),
        )

        # ----------------------------------------------------
        # Profile metadata
        # ----------------------------------------------------

        latitude = float(
            profile["LATITUDE"].iloc[0]
        )

        longitude = float(
            profile["LONGITUDE"].iloc[0]
        )

        timestamp = profile[
            "TIME"
        ].iloc[0]

        standardized_profile = pd.DataFrame(
            {
                "PROFILE_ID": int(profile_id),
                "LATITUDE": latitude,
                "LONGITUDE": longitude,
                "TIME": timestamp,
                "PRES": pressure_grid,
                "TEMP": temp_interp,
                "PSAL": psal_interp,
            }
        )

        standardized_profiles.append(
            standardized_profile
        )

    if not standardized_profiles:
        raise ValueError(
            "No valid profiles were available "
            "for standardization."
        )

    result = pd.concat(
        standardized_profiles,
        ignore_index=True,
    )

    result = result.sort_values(
        [
            "PROFILE_ID",
            "PRES",
        ]
    ).reset_index(drop=True)

    return result


# ============================================================
# DENSITY / TEOS-10 PRODUCTS
# ============================================================

def add_density_products(
    df: pd.DataFrame,
) -> pd.DataFrame:
    """
    Add TEOS-10 derived oceanographic variables:

    SA     - Absolute Salinity
    CT     - Conservative Temperature
    SIGMA0 - Potential density anomaly referenced
             to the surface.

    Requires the gsw package.
    """

    try:
        import gsw
    except ImportError as exc:
        raise ImportError(
            "The 'gsw' package is required for density "
            "products. Install it with: pip install gsw"
        ) from exc

    result = df.copy()

    # --------------------------------------------------------
    # TEOS-10 requires pressure, latitude, longitude
    # --------------------------------------------------------

    result["SA"] = gsw.SA_from_SP(
        result["PSAL"].to_numpy(dtype=float),
        result["PRES"].to_numpy(dtype=float),
        result["LONGITUDE"].to_numpy(dtype=float),
        result["LATITUDE"].to_numpy(dtype=float),
    )

    result["CT"] = gsw.CT_from_t(
        result["SA"].to_numpy(dtype=float),
        result["TEMP"].to_numpy(dtype=float),
        result["PRES"].to_numpy(dtype=float),
    )

    result["SIGMA0"] = gsw.sigma0(
        result["SA"].to_numpy(dtype=float),
        result["CT"].to_numpy(dtype=float),
    )

    return result


# ============================================================
# VERTICAL GRADIENTS
# ============================================================

def add_vertical_gradients(
    df: pd.DataFrame,
) -> pd.DataFrame:
    """
    Calculate vertical gradients within each profile.

    TEMP_GRADIENT
        dTEMP / dPRES

    SA_GRADIENT
        dSA / dPRES

    SIGMA0_GRADIENT
        dSIGMA0 / dPRES

    The first observation in every profile has no previous
    pressure level, so its gradient is intentionally NaN.
    """

    result = df.copy()

    result = result.sort_values(
        [
            "PROFILE_ID",
            "PRES",
        ]
    ).reset_index(drop=True)

    # --------------------------------------------------------
    # Calculate gradients profile-by-profile
    # --------------------------------------------------------

    result["TEMP_GRADIENT"] = (
        result
        .groupby("PROFILE_ID")["TEMP"]
        .diff()
        /
        result
        .groupby("PROFILE_ID")["PRES"]
        .diff()
    )

    result["SA_GRADIENT"] = (
        result
        .groupby("PROFILE_ID")["SA"]
        .diff()
        /
        result
        .groupby("PROFILE_ID")["PRES"]
        .diff()
    )

    result["SIGMA0_GRADIENT"] = (
        result
        .groupby("PROFILE_ID")["SIGMA0"]
        .diff()
        /
        result
        .groupby("PROFILE_ID")["PRES"]
        .diff()
    )

    return result


# ============================================================
# SAVE STANDARDIZED DATA
# ============================================================

def save_processed_data() -> str:
    """
    Generate and save standardized Argo data.
    """

    PROCESSED_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    df = standardize_profiles()

    df.to_csv(
        STANDARDIZED_PATH,
        index=False,
    )

    return str(STANDARDIZED_PATH)


# ============================================================
# SAVE DERIVED DATA
# ============================================================

def save_derived_data() -> str:
    """
    Generate standardized + TEOS-10 derived data
    and save it to disk.
    """

    PROCESSED_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    df = standardize_profiles()

    df = add_density_products(
        df
    )

    df.to_csv(
        DERIVED_PATH,
        index=False,
    )

    return str(DERIVED_PATH)


# ============================================================
# SAVE GRADIENT DATA
# ============================================================

def save_gradient_data() -> str:
    """
    Generate standardized + density + gradient data
    and save it to disk.
    """

    PROCESSED_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    df = standardize_profiles()

    df = add_density_products(
        df
    )

    df = add_vertical_gradients(
        df
    )

    df.to_csv(
        GRADIENT_PATH,
        index=False,
    )

    return str(GRADIENT_PATH)


# ============================================================
# DATASET SUMMARY
# ============================================================

def dataset_summary() -> dict:
    """
    Return scientific metadata and ranges for the
    raw Argo dataset.
    """

    df = load_argo_data()

    return {
        "observations": int(len(df)),

        "profiles": int(
            df["PROFILE_ID"].nunique()
        ),

        "variables": {
            "temperature": True,
            "salinity": True,
            "pressure": True,
        },

        "spatial_extent": {
            "latitude_min": float(
                df["LATITUDE"].min()
            ),
            "latitude_max": float(
                df["LATITUDE"].max()
            ),
            "longitude_min": float(
                df["LONGITUDE"].min()
            ),
            "longitude_max": float(
                df["LONGITUDE"].max()
            ),
        },

        "time_extent": {
            "start": df["TIME"].min().isoformat(),
            "end": df["TIME"].max().isoformat(),
        },

        "depth_range": {
            "min_pressure": float(
                df["PRES"].min()
            ),
            "max_pressure": float(
                df["PRES"].max()
            ),
        },

        "temperature_range": {
            "min": float(
                df["TEMP"].min()
            ),
            "max": float(
                df["TEMP"].max()
            ),
        },

        "salinity_range": {
            "min": float(
                df["PSAL"].min()
            ),
            "max": float(
                df["PSAL"].max()
            ),
        },

        "depth_available": True,
    }


# ============================================================
# OBSERVATION API QUERY
# ============================================================

def get_observations(
    limit: int = 1000,

    min_lat: float | None = None,
    max_lat: float | None = None,

    min_lon: float | None = None,
    max_lon: float | None = None,

    min_pressure: float | None = None,
    max_pressure: float | None = None,

    start_time: str | None = None,
    end_time: str | None = None,

    min_temperature: float | None = None,
    max_temperature: float | None = None,

    min_salinity: float | None = None,
    max_salinity: float | None = None,

    standardized: bool = False,
) -> list[dict]:
    """
    Return validated Argo observations suitable for API
    responses.

    standardized=False
        Return raw observations.

    standardized=True
        Return standardized observations with:

        - Absolute Salinity
        - Conservative Temperature
        - Sigma0
        - Temperature gradient
        - Salinity gradient
        - Density gradient
    """

    # ========================================================
    # LOAD DATA
    # ========================================================

    if standardized:

        df = standardize_profiles()

        df = add_density_products(
            df
        )

        df = add_vertical_gradients(
            df
        )

    else:

        df = load_argo_data()

    # ========================================================
    # APPLY FILTERS
    # ========================================================

    if min_lat is not None:
        df = df[
            df["LATITUDE"] >= min_lat
        ]

    if max_lat is not None:
        df = df[
            df["LATITUDE"] <= max_lat
        ]

    if min_lon is not None:
        df = df[
            df["LONGITUDE"] >= min_lon
        ]

    if max_lon is not None:
        df = df[
            df["LONGITUDE"] <= max_lon
        ]

    if min_pressure is not None:
        df = df[
            df["PRES"] >= min_pressure
        ]

    if max_pressure is not None:
        df = df[
            df["PRES"] <= max_pressure
        ]

    if start_time is not None:

        start = pd.to_datetime(
            start_time,
            errors="raise",
            utc=True,
        )

        df = df[
            df["TIME"] >= start
        ]

    if end_time is not None:

        end = pd.to_datetime(
            end_time,
            errors="raise",
            utc=True,
        )

        df = df[
            df["TIME"] <= end
        ]

    if min_temperature is not None:
        df = df[
            df["TEMP"] >= min_temperature
        ]

    if max_temperature is not None:
        df = df[
            df["TEMP"] <= max_temperature
        ]

    if min_salinity is not None:
        df = df[
            df["PSAL"] >= min_salinity
        ]

    if max_salinity is not None:
        df = df[
            df["PSAL"] <= max_salinity
        ]

    # ========================================================
    # APPLY LIMIT AFTER FILTERING
    # ========================================================

    df = df.head(limit)

    # ========================================================
    # BUILD API RESPONSE
    # ========================================================

    observations = []

    for _, row in df.iterrows():

        observation = {
            "id": int(
                row["PROFILE_ID"]
            ),

            "profile_id": int(
                row["PROFILE_ID"]
            ),

            "latitude": float(
                row["LATITUDE"]
            ),

            "longitude": float(
                row["LONGITUDE"]
            ),

            "time": row["TIME"].isoformat(),

            "temperature": float(
                row["TEMP"]
            ),

            "salinity": float(
                row["PSAL"]
            ),

            "pressure": float(
                row["PRES"]
            ),
        }

        # ----------------------------------------------------
        # Add scientific derived variables
        # ----------------------------------------------------

        if standardized:

            observation.update(
                {
                    "absolute_salinity": float(
                        row["SA"]
                    ),

                    "conservative_temperature": float(
                        row["CT"]
                    ),

                    "sigma0": float(
                        row["SIGMA0"]
                    ),

                    "temperature_gradient": (
                        None
                        if pd.isna(
                            row["TEMP_GRADIENT"]
                        )
                        else float(
                            row["TEMP_GRADIENT"]
                        )
                    ),

                    "salinity_gradient": (
                        None
                        if pd.isna(
                            row["SA_GRADIENT"]
                        )
                        else float(
                            row["SA_GRADIENT"]
                        )
                    ),

                    "density_gradient": (
                        None
                        if pd.isna(
                            row["SIGMA0_GRADIENT"]
                        )
                        else float(
                            row["SIGMA0_GRADIENT"]
                        )
                    ),
                }
            )

        observations.append(
            observation
        )

    return observations