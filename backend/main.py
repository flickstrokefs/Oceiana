"""
ARIEL Ocean Data API — Main Application Entrypoint.
Exposes the production FastAPI application factory from app.main.
"""

from app.main import app
from data_service import (
    dataset_summary,
    get_observations,
    standardize_profiles,
    add_density_products,
    add_vertical_gradients,
)


def get_scientific_data():
    """
    Load the standardized Argo dataset and calculate
    derived oceanographic products.
    """
    df = standardize_profiles()
    df = add_density_products(df)
    df = add_vertical_gradients(df)
    return df


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)