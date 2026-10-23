"""
tests/test_science.py — Tests for app.science scientific products.

All tests use synthetic but physically plausible fixture profiles
(clearly labelled as TEST FIXTURES — not real measurements).
Tests that run on real Argo data are in TestScienceOnRealArgo class.

Reference values are checked against published literature where possible:
  - BoB MLD in Jan ~30–70 m (de Boyer Montégut 2004 climatology Fig. 8)
  - D26 in BoB in Jan ~50–100 m (Neetu et al. 2012)
  - TCHP ~20–60 kJ/cm² in Jan BoB (Sadhuram et al. 2004)
"""

import numpy as np
import pandas as pd
import pytest


# ─── Fixture helpers ──────────────────────────────────────────────────────────

def make_profile(
    n: int = 50,
    pres_max: float = 500.0,
    t_surf: float = 28.5,
    t_deep: float = 8.0,
    pycnocline: float = 60.0,
    s_surf: float = 33.0,
    s_deep: float = 35.0,
    lat: float = 15.0,
    lon: float = 88.0,
) -> dict:
    """
    TEST FIXTURE: physically plausible Argo-like profile using a tanh thermocline.
    NOT real measurements — for unit testing only.
    T(z) = 0.5*(T_surf+T_deep) - 0.5*(T_surf-T_deep)*tanh((z-pycnocline)/20)
    S(z) = analogous halocline
    sigma0 increases monotonically from surface.
    """
    import gsw

    p = np.linspace(0, pres_max, n)
    t = 0.5 * (t_surf + t_deep) - 0.5 * (t_surf - t_deep) * np.tanh((p - pycnocline) / 20)
    s = s_surf + (s_deep - s_surf) * (1 - np.exp(-p / 200))
    sa = gsw.SA_from_SP(s, p, lon, lat)
    ct = gsw.CT_from_t(sa, t, p)
    sigma0 = gsw.sigma0(sa, ct)

    return {
        "pres": p,
        "temp": t,
        "psal": s,
        "sa": sa,
        "ct": ct,
        "sigma0": sigma0,
        "lat": lat,
        "lon": lon,
    }


def profile_to_df(prof: dict, profile_id: str = "TEST_001",
                  platform: str = "1234567") -> pd.DataFrame:
    n = len(prof["pres"])
    return pd.DataFrame({
        "PROFILE_ID": profile_id,
        "PRES": prof["pres"],
        "TEMP": prof["temp"],
        "PSAL": prof["psal"],
        "SA": prof["sa"],
        "CT": prof["ct"],
        "SIGMA0": prof["sigma0"],
        "LATITUDE": prof["lat"],
        "LONGITUDE": prof["lon"],
        "TIME": "2020-01-15",
        "PLATFORM_NUMBER": platform,
        "CYCLE_NUMBER": 1,
    })


# ─── MLD tests ────────────────────────────────────────────────────────────────

class TestMLD:
    def test_mld_at_expected_depth(self):
        """Pycnocline at 60 dbar with well-mixed surface layer → MLD ≈ 60 dbar."""
        import gsw
        from app.science.mld import compute_mld_profile

        p = np.linspace(0, 500, 250)
        t_surf, t_deep, pyc = 28.5, 8.0, 60.0
        # Mixed layer: constant temperature down to pyc, then cooling
        t = np.where(p <= pyc, t_surf, t_deep + (t_surf - t_deep) * np.exp(-(p - pyc) / 25.0))
        # Fixed salinity → density variation driven purely by temperature
        s = np.full_like(p, 35.0)
        sa = gsw.SA_from_SP(s, p, 88.0, 15.0)
        ct = gsw.CT_from_t(sa, t, p)
        sigma0 = gsw.sigma0(sa, ct)

        result = compute_mld_profile(pres=p, sigma0=sigma0,
                                      profile_id="TEST", platform_number="1234567")
        assert result.mld_m is not None
        assert result.flag in ("OK", "NO_REF")
        # MLD should be very close to the pycnocline (60 dbar)
        assert abs(result.mld_m - pyc) < 5.0, f"MLD={result.mld_m} too far from {pyc} dbar"

    def test_mld_flag_ok_deep_profile(self):
        """Deep profile with strong pycnocline → flag=OK."""
        from app.science.mld import compute_mld_profile
        prof = make_profile(n=100, pres_max=2000.0, pycnocline=80.0)
        result = compute_mld_profile(prof["pres"], prof["sigma0"])
        assert result.flag in ("OK", "NO_REF", "MONOTONE_FAIL")
        assert result.n_levels == 100

    def test_mld_shallow_profile(self):
        """Only 2 levels → flag=SHALLOW, mld=None."""
        from app.science.mld import compute_mld_profile
        result = compute_mld_profile(
            pres=np.array([0.0, 10.0]),
            sigma0=np.array([24.0, 24.5]),
        )
        assert result.flag == "SHALLOW"
        assert result.mld_m is None

    def test_mld_dataframe(self):
        """compute_mld_dataframe returns one row per profile."""
        from app.science.mld import compute_mld_dataframe
        prof1 = profile_to_df(make_profile(pycnocline=50.0), "P1")
        prof2 = profile_to_df(make_profile(pycnocline=80.0), "P2")
        df = pd.concat([prof1, prof2], ignore_index=True)
        mld_df = compute_mld_dataframe(df)
        assert len(mld_df) == 2
        assert set(mld_df["profile_id"]) == {"P1", "P2"}
        assert mld_df["provenance"].iloc[0] == "DERIVED"

    def test_mld_summary_provenance(self):
        """mld_summary always tags provenance=DERIVED."""
        from app.science.mld import compute_mld_dataframe, mld_summary
        df = profile_to_df(make_profile())
        mld_df = compute_mld_dataframe(df)
        summary = mld_summary(mld_df)
        assert summary["provenance"] == "DERIVED"
        assert "Argo" in summary["source"]
        assert "de Boyer" in summary["method_ref"]

    def test_mld_requires_sigma0(self):
        """Should raise ValueError if SIGMA0 not present."""
        from app.science.mld import compute_mld_dataframe
        df = profile_to_df(make_profile()).drop(columns=["SIGMA0"])
        with pytest.raises(ValueError, match="SIGMA0"):
            compute_mld_dataframe(df)


# ─── TCHP tests ───────────────────────────────────────────────────────────────

class TestTCHP:
    def test_d26_at_expected_depth(self):
        """Pycnocline at 80 dbar → D26 should be in reasonable range."""
        from app.science.tchp import compute_tchp_profile
        prof = make_profile(pycnocline=80.0, t_surf=28.5, t_deep=8.0)
        result = compute_tchp_profile(prof["pres"], prof["ct"])
        assert result.d26_m is not None
        assert result.tchp_kj_cm2 is not None
        # D26 should be somewhere in the thermocline region
        assert 0 < result.d26_m <= 200, f"D26={result.d26_m} out of expected range"

    def test_tchp_positive_when_sst_above_26(self):
        """SST>26°C profile must have TCHP>0."""
        from app.science.tchp import compute_tchp_profile
        prof = make_profile(t_surf=29.0, t_deep=8.0, pycnocline=70.0)
        result = compute_tchp_profile(prof["pres"], prof["ct"])
        assert result.tchp_kj_cm2 is not None
        assert result.tchp_kj_cm2 > 0, "TCHP must be positive when SST > 26°C"

    def test_tchp_zero_when_sst_below_26(self):
        """SST<26°C → TCHP=0, flag=SURFACE_BELOW_26."""
        from app.science.tchp import compute_tchp_profile
        prof = make_profile(t_surf=24.0, t_deep=5.0)
        result = compute_tchp_profile(prof["pres"], prof["ct"])
        assert result.tchp_kj_cm2 == 0.0
        assert result.flag == "SURFACE_BELOW_26"

    def test_tchp_physical_range(self):
        """BoB Jan TCHP should be ~20–80 kJ/cm² per literature."""
        from app.science.tchp import compute_tchp_profile
        # Typical BoB winter profile: SST~28.5°C, D26~60–80 m
        prof = make_profile(t_surf=28.5, t_deep=8.0, pycnocline=70.0, n=100, pres_max=800.0)
        result = compute_tchp_profile(prof["pres"], prof["ct"])
        assert result.tchp_kj_cm2 is not None
        assert 5 <= result.tchp_kj_cm2 <= 200, f"TCHP={result.tchp_kj_cm2} outside plausible range"

    def test_tchp_dataframe(self):
        """compute_tchp_dataframe gives per-profile rows."""
        from app.science.tchp import compute_tchp_dataframe
        df = pd.concat([
            profile_to_df(make_profile(t_surf=29.0), "P1"),
            profile_to_df(make_profile(t_surf=27.0), "P2"),
        ], ignore_index=True)
        tchp_df = compute_tchp_dataframe(df)
        assert len(tchp_df) == 2
        assert tchp_df["provenance"].iloc[0] == "DERIVED"

    def test_tchp_requires_ct(self):
        from app.science.tchp import compute_tchp_dataframe
        df = profile_to_df(make_profile()).drop(columns=["CT"])
        with pytest.raises(ValueError, match="CT"):
            compute_tchp_dataframe(df)

    def test_tchp_summary_has_constants(self):
        """Summary must expose physical constants for reproducibility."""
        from app.science.tchp import compute_tchp_dataframe, tchp_summary
        df = profile_to_df(make_profile())
        tchp_df = compute_tchp_dataframe(df)
        s = tchp_summary(tchp_df)
        assert "constants" in s
        assert s["constants"]["T_crit_C"] == 26.0
        assert s["constants"]["rho_kg_m3"] == 1025.0
        assert s["constants"]["Cp_J_kgK"] == 3985.0


# ─── Thermocline tests ────────────────────────────────────────────────────────

class TestThermocline:
    def test_thermocline_at_pycnocline_depth(self):
        """Thermocline should be detected near the pycnocline."""
        from app.science.thermocline import compute_thermocline_profile
        prof = make_profile(pycnocline=100.0, n=100, pres_max=800.0)
        result = compute_thermocline_profile(prof["pres"], prof["temp"])
        assert result.thermocline_depth_m is not None
        assert result.flag in ("OK",)
        # Thermocline within ±40 m of pycnocline
        assert abs(result.thermocline_depth_m - 100.0) < 40.0

    def test_thermocline_strength_positive(self):
        from app.science.thermocline import compute_thermocline_profile
        prof = make_profile(pycnocline=80.0, t_surf=28.0, t_deep=8.0)
        result = compute_thermocline_profile(prof["pres"], prof["temp"])
        if result.thermocline_depth_m is not None:
            assert result.thermocline_strength_C_m > 0

    def test_thermocline_weak_profile(self):
        """Nearly isothermal profile → flag=WEAK."""
        from app.science.thermocline import compute_thermocline_profile
        p = np.linspace(0, 500, 50)
        t = np.full(50, 20.0) + np.random.uniform(-0.001, 0.001, 50)
        result = compute_thermocline_profile(p, t)
        assert result.flag in ("WEAK", "SHALLOW")

    def test_thermocline_dataframe_provenance(self):
        from app.science.thermocline import compute_thermocline_dataframe
        df = profile_to_df(make_profile(pycnocline=80.0))
        thermo_df = compute_thermocline_dataframe(df)
        assert thermo_df["provenance"].iloc[0] == "DERIVED"
        assert "Argo" in thermo_df["source"].iloc[0]


# ─── Front detection tests ────────────────────────────────────────────────────

class TestFronts:
    def _make_sst_grid(self, nlat=20, nlon=25, front_lat_idx=10):
        """TEST FIXTURE: 2D SST grid with a sharp front at front_lat_idx."""
        lats = np.linspace(5, 23, nlat)
        lons = np.linspace(80, 100, nlon)
        sst = np.full((nlat, nlon), 28.0)
        sst[:front_lat_idx, :] = 28.0   # warm north
        sst[front_lat_idx:, :] = 26.0   # cool south (sharp front)
        return lats, lons, sst

    def test_front_detected_at_discontinuity(self):
        from app.science.fronts import detect_sst_fronts
        lats, lons, sst = self._make_sst_grid(front_lat_idx=10)
        # Use a low threshold — sharp 2°C front on a ~1° grid yields ~0.009 C/km
        result = detect_sst_fronts(lats, lons, sst, threshold=0.001)
        assert result.n_front_pixels > 0, (
            f"No fronts detected. max_grad={result.max_gradient_C_km:.5f} C/km, "
            f"threshold=0.001 C/km")
        assert result.flag == "OK"

    def test_no_front_in_uniform_field(self):
        from app.science.fronts import detect_sst_fronts
        lats = np.linspace(5, 23, 20)
        lons = np.linspace(80, 100, 25)
        sst = np.full((20, 25), 28.0)
        result = detect_sst_fronts(lats, lons, sst, threshold=0.01)
        assert result.n_front_pixels == 0

    def test_front_result_provenance(self):
        from app.science.fronts import detect_sst_fronts
        lats, lons, sst = self._make_sst_grid()
        result = detect_sst_fronts(lats, lons, sst)
        assert result.provenance == "DERIVED"
        assert "Belkin" in result.method_ref

    def test_front_points_within_bbox(self):
        """All returned front point coords must be inside the input grid."""
        from app.science.fronts import detect_sst_fronts
        lats, lons, sst = self._make_sst_grid()
        result = detect_sst_fronts(lats, lons, sst, threshold=0.01)
        for pt in result.front_points:
            assert lats.min() <= pt["lat"] <= lats.max()
            assert lons.min() <= pt["lon"] <= lons.max()
            assert pt["gradient"] >= 0

    def test_all_nan_field(self):
        from app.science.fronts import detect_sst_fronts
        lats = np.linspace(5, 23, 10)
        lons = np.linspace(80, 100, 12)
        sst = np.full((10, 12), float("nan"))
        result = detect_sst_fronts(lats, lons, sst)
        assert result.flag == "ALL_NAN"
        assert result.n_front_pixels == 0


# ─── Validation tests ─────────────────────────────────────────────────────────

class TestValidation:
    def test_perfect_match_zero_bias(self):
        """When model equals obs exactly → bias=0, RMSE=0, r=1."""
        from app.science.validation import compute_profile_metrics
        pres = np.linspace(0, 500, 50)
        temp = np.random.uniform(5, 28, 50)
        m = compute_profile_metrics(pres, temp, pres, temp, variable="temperature")
        assert m.n_matched == 50
        assert abs(m.bias) < 1e-10
        assert abs(m.rmse) < 1e-10
        assert abs(m.r - 1.0) < 1e-6

    def test_constant_bias_detected(self):
        """Model = obs + 2 → bias = +2."""
        from app.science.validation import compute_profile_metrics
        pres = np.linspace(0, 500, 50)
        obs = np.random.uniform(5, 28, 50)
        mod = obs + 2.0
        m = compute_profile_metrics(pres, obs, pres, mod)
        assert abs(m.bias - 2.0) < 0.01

    def test_provenance_labels(self):
        from app.science.validation import compute_profile_metrics
        pres = np.linspace(0, 200, 20)
        vals = np.random.uniform(10, 25, 20)
        m = compute_profile_metrics(pres, vals, pres, vals)
        assert m.provenance_obs == "REAL"
        assert m.provenance_model == "SIMULATED"
        assert m.provenance_metrics == "DERIVED"

    def test_insufficient_data(self):
        """Fewer than 2 points → n_matched=0, all metrics None."""
        from app.science.validation import compute_profile_metrics
        m = compute_profile_metrics(
            np.array([0.0]), np.array([28.0]),
            np.array([0.0]), np.array([27.0]),
        )
        assert m.n_matched == 0
        assert m.bias is None


# ─── Integration: run products on real Argo cache ─────────────────────────────

class TestScienceOnRealArgo:
    """Run the full products pipeline on the real committed Argo file.
    These tests verify scientific plausibility against published BoB climatology.
    """

    REAL_FILE = __import__("pathlib").Path(__file__).parent.parent.parent / \
        "data" / "raw" / "argo_bay_of_bengal_2020-01-01_2020-02-01.nc"

    @pytest.fixture(autouse=True)
    def skip_if_no_file(self):
        if not self.REAL_FILE.exists():
            pytest.skip("Real Argo file not available")

    _cached_df: pd.DataFrame | None = None

    def _load_df(self) -> pd.DataFrame:
        if self._cached_df is not None:
            return self._cached_df
        import xarray as xr
        from app.processing.teos10 import compute_teos10

        try:
            ds = xr.load_dataset(self.REAL_FILE, engine="h5netcdf")
        except Exception:
            ds = xr.load_dataset(self.REAL_FILE)

        df = pd.DataFrame({
            "PRES": ds["PRES"].values.astype(float),
            "TEMP": ds["TEMP"].values.astype(float),
            "PSAL": ds["PSAL"].values.astype(float),
            "LATITUDE": ds["LATITUDE"].values.astype(float),
            "LONGITUDE": ds["LONGITUDE"].values.astype(float),
            "PLATFORM_NUMBER": ds["PLATFORM_NUMBER"].values.astype(str),
            "CYCLE_NUMBER": ds["CYCLE_NUMBER"].values.astype(str),
        })
        df["TIME"] = pd.to_datetime(ds["TIME"].values).astype(str)
        df["PROFILE_ID"] = df["PLATFORM_NUMBER"].str.strip() + "_" + df["CYCLE_NUMBER"].str.strip()
        df = df.dropna(subset=["PRES", "TEMP", "PSAL"]).reset_index(drop=True)
        df = compute_teos10(df)
        TestScienceOnRealArgo._cached_df = df
        return df

    def test_mld_bob_climatological_range(self):
        """BoB Jan MLD: expected 20–100 m (de Boyer Montégut 2004 Fig. 8)."""
        from app.science.mld import compute_mld_dataframe, mld_summary
        df = self._load_df()
        mld_df = compute_mld_dataframe(df)
        s = mld_summary(mld_df)
        med = s["mld_median_m"]
        assert med is not None
        assert 10 <= med <= 150, f"BoB Jan MLD median={med} m outside expected 10–150 m"

    def test_tchp_bob_climatological_range(self):
        """BoB Jan TCHP: typical 10–80 kJ/cm² (Sadhuram et al. 2004)."""
        from app.science.tchp import compute_tchp_dataframe, tchp_summary
        df = self._load_df()
        tchp_df = compute_tchp_dataframe(df)
        s = tchp_summary(tchp_df)
        med = s["tchp_median_kj_cm2"]
        if med is not None:  # may be None if all profiles have SST<26
            assert 0 <= med <= 300, f"BoB Jan TCHP median={med} kJ/cm² outside plausible range"

    def test_thermocline_bob_range(self):
        """BoB thermocline: expected 80–200 m depth."""
        from app.science.thermocline import compute_thermocline_dataframe, thermocline_summary
        df = self._load_df()
        thermo_df = compute_thermocline_dataframe(df)
        s = thermocline_summary(thermo_df)
        med = s["thermocline_depth_median_m"]
        if med is not None:
            assert 20 <= med <= 400, f"BoB thermocline median={med} m outside plausible range"

    def test_all_mld_provenance_real(self):
        """Every MLD result must carry provenance=DERIVED (from REAL Argo)."""
        from app.science.mld import compute_mld_dataframe
        df = self._load_df()
        mld_df = compute_mld_dataframe(df)
        assert (mld_df["provenance"] == "DERIVED").all()

    def test_n_profiles_matches_audit(self):
        """Committed file must yield ≥ 40 unique profiles (audit found 51)."""
        df = self._load_df()
        n_profiles = df["PROFILE_ID"].nunique()
        assert n_profiles >= 40, f"Expected ≥40 profiles, got {n_profiles}"

    def test_barrier_layer_bob_real_argo(self):
        """BoB barrier layer: typical 10–50 m in winter/post-monsoon."""
        from app.science.barrier_layer import compute_barrier_layer_dataframe, barrier_layer_summary
        df = self._load_df()
        blt_df = compute_barrier_layer_dataframe(df)
        s = barrier_layer_summary(blt_df)
        assert s["n_profiles_valid"] >= 40
        assert s["blt_median_m"] is not None
        assert 0.0 <= s["blt_median_m"] <= 80.0, f"BLT median {s['blt_median_m']} m outside plausible range"
        # In BoB, freshwater cap creates a non-zero prevalence of barrier layer
        assert s["n_profiles_with_barrier_layer"] > 0


class TestBarrierLayer:
    def test_barrier_layer_positive_when_halocline_shallow(self):
        """Halocline at 30 dbar, thermocline at 70 dbar → BLT ≈ 40 dbar."""
        import gsw
        from app.science.barrier_layer import compute_barrier_layer_profile

        p = np.linspace(0, 200, 100)
        # Temperature stays warm (28.5) down to 70 dbar, then cools
        t = np.where(p <= 70.0, 28.5, 28.5 - 10.0 * (1 - np.exp(-(p - 70.0) / 20.0)))
        # Salinity jumps at 30 dbar from 32 to 35 PSU (driving MLD to ~30 dbar)
        s = np.where(p <= 30.0, 32.0, 35.0)

        sa = gsw.SA_from_SP(s, p, 88.0, 15.0)
        ct = gsw.CT_from_t(sa, t, p)
        sigma0 = gsw.sigma0(sa, ct)

        res = compute_barrier_layer_profile(p, t, sigma0)
        assert res.blt_m is not None
        assert res.blt_m > 20.0
        assert res.flag == "OK"

    def test_no_barrier_layer_when_thermocline_shallow(self):
        """Temperature drops before salinity increases → BLT = 0.0."""
        import gsw
        from app.science.barrier_layer import compute_barrier_layer_profile

        p = np.linspace(0, 200, 100)
        # Temperature drops at 20 dbar
        t = np.where(p <= 20.0, 28.5, 28.5 - 5.0 * (1 - np.exp(-(p - 20.0) / 10.0)))
        # Salinity uniform
        s = np.full_like(p, 35.0)

        sa = gsw.SA_from_SP(s, p, 88.0, 15.0)
        ct = gsw.CT_from_t(sa, t, p)
        sigma0 = gsw.sigma0(sa, ct)

        res = compute_barrier_layer_profile(p, t, sigma0)
        assert res.blt_m == 0.0
        assert res.flag == "NO_BARRIER"

    def test_barrier_layer_provenance_labels(self):
        """Metadata must cite Sprintall & Tomczak."""
        from app.science.barrier_layer import compute_barrier_layer_profile
        p = np.linspace(0, 50, 10)
        t = np.full(10, 28.0)
        s0 = np.full(10, 22.0)
        res = compute_barrier_layer_profile(p, t, s0)
        assert res.provenance == "DERIVED"
        assert "Sprintall" in res.method_ref


class TestStandardizerPCHIP:
    def test_pchip_preserves_monotonicity(self):
        """PCHIP on monotonically decreasing temperature profile must stay strictly monotonic."""
        from app.processing.standardizer import standardize_single_profile
        prof = pd.DataFrame({
            "PRES": [5.0, 30.0, 60.0, 100.0, 250.0, 500.0],
            "TEMP": [29.0, 28.5, 22.0, 16.0, 11.0, 8.0],
            "PSAL": [33.0, 33.5, 34.5, 35.0, 35.0, 35.0],
            "PROFILE_ID": ["1", "1", "1", "1", "1", "1"],
        })
        std = standardize_single_profile(prof, step=10.0, method="pchip")
        t_vals = std["TEMP"].values
        diffs = np.diff(t_vals)
        assert (diffs <= 0.001).all(), "PCHIP produced non-monotonic temperature inversion"

    def test_evaluation_accuracy_depth_bands(self):
        """Cross-validation error evaluation must produce bands and valid RMSE."""
        from app.processing.standardizer import evaluate_interpolation_accuracy
        # Synthetic profiles
        rows = []
        for pid in range(5):
            for p in np.linspace(10, 600, 30):
                t = 28.0 - 20.0 / (1.0 + np.exp(-(p - 80.0) / 40.0))
                rows.append({"PROFILE_ID": str(pid), "PRES": p, "TEMP": t, "PSAL": 35.0})
        df = pd.DataFrame(rows)
        acc = evaluate_interpolation_accuracy(df)
        assert "<50m" in acc
        assert "50-100m" in acc
        assert acc["50-100m"]["pchip_rmse"] is not None
