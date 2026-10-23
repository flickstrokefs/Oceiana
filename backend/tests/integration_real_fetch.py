"""
integration_real_fetch.py — Real network integration tests.
Run with:  python -m pytest tests/integration_real_fetch.py -v -s

These tests make REAL network calls. They are skipped in offline CI.
Each test caches its result to disk so subsequent runs work offline.
"""

import os
import pytest

# ── skip markers ─────────────────────────────────────────────────────────────
NEEDS_NETWORK = pytest.mark.skipif(
    os.environ.get("CI") == "true",
    reason="Skipped in CI — requires internet"
)

NEEDS_CMEMS = pytest.mark.skipif(
    not (os.environ.get("CMEMS_USERNAME") and os.environ.get("CMEMS_PASSWORD")),
    reason="Skipped — set CMEMS_USERNAME and CMEMS_PASSWORD in .env to enable"
)


# ── IBTrACS (free, no login) ─────────────────────────────────────────────────
class TestIBTrACSReal:

    @NEEDS_NETWORK
    def test_fetch_ibtracs_ni_returns_data(self):
        from app.data.cyclone_tracks import fetch_ibtracs_ni
        df = fetch_ibtracs_ni()
        assert len(df) > 0
        assert "NAME" in df.columns
        print(f"\n  IBTrACS: {len(df)} rows, {df['NAME'].nunique()} unique storms")

    @NEEDS_NETWORK
    def test_amphan_in_ibtracs(self):
        from app.data.cyclone_tracks import fetch_ibtracs_ni, get_storm_track
        df = fetch_ibtracs_ni()
        amphan = get_storm_track(df, "AMPHAN")
        assert len(amphan) > 0, "AMPHAN not found in IBTrACS NI"
        print(f"\n  AMPHAN: {len(amphan)} 6-hourly fixes")

    @NEEDS_NETWORK
    def test_fani_in_ibtracs(self):
        from app.data.cyclone_tracks import fetch_ibtracs_ni, get_storm_track
        df = fetch_ibtracs_ni()
        fani = get_storm_track(df, "FANI")
        assert len(fani) > 0, "FANI not found in IBTrACS NI"
        print(f"\n  FANI: {len(fani)} 6-hourly fixes")

    @NEEDS_NETWORK
    def test_ibtracs_bob_filter(self):
        from app.data.cyclone_tracks import fetch_ibtracs_ni, filter_bob_tracks
        df = fetch_ibtracs_ni()
        bob = filter_bob_tracks(df)
        assert len(bob) > 0
        assert (bob["LAT"] >= 5.0).all()
        assert (bob["LAT"] <= 23.0).all()
        print(f"\n  BoB filtered: {len(bob)} rows ({bob['NAME'].nunique()} storms)")


# ── SST / Chl from NOAA ERDDAP (free, no login) ─────────────────────────────
class TestSSTChlReal:

    @NEEDS_NETWORK
    def test_fetch_sst_returns_data(self):
        from app.data.sst_chl_fetch import fetch_mur_sst
        import numpy as np
        ds = fetch_mur_sst(
            start="2020-01-15", end="2020-01-16",
            bbox=[80.0, 5.0, 100.0, 23.0],
        )
        assert ds is not None
        sst_var = [v for v in ds.data_vars if "sst" in v.lower() or "analysed" in v.lower()]
        assert len(sst_var) > 0, f"No SST variable. Got: {list(ds.data_vars)}"
        sst = ds[sst_var[0]].values.astype(float)
        finite = sst[~np.isnan(sst)]
        assert 20.0 < float(finite.mean()) < 35.0, f"SST mean implausible: {finite.mean():.2f}"
        print(f"\n  SST mean: {finite.mean():.2f} C  (N={len(finite)} pixels)")

    @NEEDS_NETWORK
    def test_fetch_chl_returns_data(self):
        """VIIRS chl for Jan 2020 — ERDDAP griddap 404 for arbitrary dates is a
        known limitation (server requires exact monthly time-axis snapping).
        Per master-prompt rule: we raise DataNotAvailableError, never substitute.
        """
        from app.data.sst_chl_fetch import fetch_viirs_chl, DataNotAvailableError
        try:
            ds = fetch_viirs_chl(
                start="2020-01-01", end="2020-01-31",
                bbox=[80.0, 5.0, 100.0, 23.0],
            )
            # If it succeeds, validate the data
            assert ds is not None
            chl_var = [v for v in ds.data_vars if "chl" in v.lower() or "chlor" in v.lower()]
            assert len(chl_var) > 0, f"No Chl variable. Got: {list(ds.data_vars)}"
            print(f"\n  Chl variable found: {chl_var[0]} (SUCCESS)")
        except DataNotAvailableError as e:
            # Acceptable: ERDDAP griddap 404 for this time range — UNVERIFIED
            print(f"\n  Chl UNVERIFIED for Jan 2020 (ERDDAP 404): {str(e)[:100]}")
            pytest.skip("VIIRS chl ERDDAP griddap unavailable for Jan 2020 — UNVERIFIED, not substituted")

    @NEEDS_NETWORK
    def test_sst_manifest_provenance_real(self):
        """Verify SST manifest records provenance=REAL.
        Uses the real cache populated by test_fetch_sst_returns_data to avoid
        redundant ERDDAP network requests and server 503 rate limits.
        """
        from app.data.sst_chl_fetch import fetch_mur_sst
        from app.data.cache_utils import read_manifest, make_cache_key
        fetch_mur_sst(start="2020-01-15", end="2020-01-16",
                      bbox=[80.0, 5.0, 100.0, 23.0])
        # stride=10 is the default in fetch_mur_sst — must match the key
        key = make_cache_key("sst", start="2020-01-15", end="2020-01-16",
                             bbox=[80.0, 5.0, 100.0, 23.0], stride=10)
        m = read_manifest("sst", key)
        assert m is not None, "Manifest not written after SST fetch"
        assert m["provenance"] == "REAL"
        print(f"\n  Manifest provenance: {m['provenance']} OK")


# ── CMEMS (requires credentials in .env) ─────────────────────────────────────
class TestCMEMSReal:

    @NEEDS_CMEMS
    @NEEDS_NETWORK
    def test_fetch_cmems_physics_returns_data(self):
        from app.data.cmems_fetch import fetch_cmems_physics
        import numpy as np
        ds = fetch_cmems_physics(
            start="2020-01-01", end="2020-01-07",
            bbox=[80.0, 5.0, 100.0, 23.0],
        )
        assert ds is not None
        temp_var = [v for v in ds.data_vars if "temp" in v.lower() or "thetao" in v.lower()]
        assert len(temp_var) > 0, f"No temperature variable. Got: {list(ds.data_vars)}"
        t = ds[temp_var[0]].values.astype(float)
        finite = t[~np.isnan(t)]
        assert 2.0 < float(finite.mean()) < 35.0
        print(f"\n  CMEMS temp mean: {finite.mean():.2f} C  (N={len(finite)} values)")

    @NEEDS_CMEMS
    @NEEDS_NETWORK
    def test_cmems_manifest_tagged_simulated(self):
        """Verify CMEMS data is tagged provenance=SIMULATED (not REAL).
        
        Checks both the dataset attrs and that a manifest file exists in cache.
        Avoids monkeypatching — uses the real cache populated by the previous test.
        """
        from app.data.cmems_fetch import fetch_cmems_physics
        from app.data.cache_utils import MANIFEST_DIR
        from pathlib import Path
        # Re-fetch (will use cache from previous test)
        ds = fetch_cmems_physics(
            start="2020-01-01", end="2020-01-07",
            bbox=[80.0, 5.0, 100.0, 23.0],
            force_refresh=False,
        )
        # 1. Dataset attrs must say SIMULATED
        assert ds.attrs.get("provenance") == "SIMULATED", \
            f"Dataset provenance attr must be SIMULATED, got: {ds.attrs.get('provenance')}"
        # 2. At least one cmems manifest file must exist in cache
        manifest_dir = Path(MANIFEST_DIR)
        cmems_manifests = list(manifest_dir.glob("cmems_*.json")) if manifest_dir.exists() else []
        assert len(cmems_manifests) > 0, \
            f"No cmems manifest files found in {manifest_dir}"
        print(f"\n  CMEMS provenance attr: {ds.attrs['provenance']} OK")
        print(f"  CMEMS manifests on disk: {len(cmems_manifests)}")
