from data_service import (
    standardize_profiles,
    add_density_products,
    add_vertical_gradients,
    save_processed_data,
    save_derived_data,
    save_gradient_data,
)


def main():
    print("=== Ariel DATA PREPROCESSING PIPELINE ===")

    print("\n[1/4] Standardizing Argo profiles...")
    standardized = standardize_profiles()
    print(f"       Rows: {len(standardized)}")

    print("\n[2/4] Saving standardized dataset...")
    print(f"       {save_processed_data()}")

    print("\n[3/4] Computing TEOS-10 derived products...")
    derived = add_density_products(standardized)
    print(f"       Rows: {len(derived)}")
    print(f"       SA / CT / SIGMA0 computed")

    print("\n[4/4] Computing vertical gradients...")
    gradient = add_vertical_gradients(derived)
    print(f"       Rows: {len(gradient)}")
    print(f"       Temperature gradient computed")
    print(f"       Salinity gradient computed")
    print(f"       Density gradient computed")

    print("\n=== SAVING OUTPUTS ===")
    print(f"Standardized: {save_processed_data()}")
    print(f"Derived:     {save_derived_data()}")
    print(f"Gradients:   {save_gradient_data()}")

    print("\n=== PIPELINE COMPLETE ===")


if __name__ == "__main__":
    main()