"""
tests/test_data_fetchers.py — Tests for app.data fetcher layer.

These tests verify:
1. cache_utils: key generation, manifest write/read, path helpers
2. argo_fetch: offline fallback to committed file, QC filter, TEOS-10
3. cyclone_tracks: offline fallback, storm extraction, BoB filter
4. sst_chl_fetch / cmems_fetch: offline-only path (no network calls in CI)

Tests NEVER call real APIs (they use offline fallback paths only).
Synthetic fixture data is in tests/ and clearly labelled.
"""

import json
import os
import sys
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

# ─── Patch cache root to a temp dir so tests don't pollute real cache ──────────
@pytest.fixture(autouse=True)
def tmp_cache(tmp_path, monkeypatch):
    """Redirect all cache I/O to a temp directory."""
    monkeypatch.setattr("app.data.cache_utils.CACHE_ROOT", tmp_path / "cache")
    monkeypatch.setattr("app.data.cache_utils.MANIFEST_DIR", tmp_path / "manifests")
    (tmp_path / "cache").mkdir()
    (tmp_path / "manifests").mkdir()
    yield tmp_path


# ─── cache_utils ───────────────────────────────────────────────────────────────

class TestCacheUtils:
    def test_make_cache_key_stable(self):
        from app.data.cache_utils import make_cache_key
        k1 = make_cache_key("argo", start="2020-01-01", end="2020-02-01", bbox=[80, 5, 100, 23])
        k2 = make_cache_key("argo", start="2020-01-01", end="2020-02-01", bbox=[80, 5, 100, 23])
        assert k1 == k2
        assert len(k1) == 16

    def test_make_cache_key_different_for_different_params(self):
        from app.data.cache_utils import make_cache_key
        k1 = make_cache_key("argo", start="2020-01-01", end="2020-02-01")
        k2 = make_cache_key("argo", start="2020-01-01", end="2020-03-01")
        assert k1 != k2

    def test_manifest_write_read_roundtrip(self, tmp_cache):
        from app.data.cache_utils import write_manifest, read_manifest, data_path
        nc_path = data_path("test", "abc123", ".nc")
        write_manifest(
            source_tag="test",
            cache_key="abc123",
            source="Test Source",
            doi_or_url="https://example.com",
            bbox=[80.0, 5.0, 100.0, 23.0],
            time_range=["2020-01-01", "2020-02-01"],
            n_records=100,
            cache_file=nc_path,
        )
        m = read_manifest("test", "abc123")
        assert m is not None
        assert m["source"] == "Test Source"
        assert m["n_records"] == 100
        assert m["provenance"] == "REAL"
        assert "retrieved_at" in m

    def test_read_manifest_returns_none_if_missing(self):
        from app.data.cache_utils import read_manifest
        assert read_manifest("nonexistent", "xyz") is None

    def test_cache_exists_false_when_empty(self):
        from app.data.cache_utils import cache_exists
        assert cache_exists("argo", "nosuchkey", ".nc") is False


# ─── argo_fetch ────────────────────────────────────────────────────────────────

class TestArgoFetch:
    """Tests using the committed real file (no network required)."""

    COMMITTED_FILE = Path(__file__).parent.parent.parent / "data" / "raw" / \
        "argo_bay_of_bengal_2020-01-01_2020-02-01.nc"

    def test_committed_file_exists(self):
        assert self.COMMITTED_FILE.exists(), \
            "Real Argo file missing: data/raw/argo_bay_of_bengal_2020-01-01_2020-02-01.nc"

    def test_load_committed_file_offline(self, monkeypatch, tmp_cache):
        """load_argo_cache falls back to committed file when cache is empty."""
        # No network: monkeypatch argopy to raise
        monkeypatch.setattr(
            "app.data.argo_fetch.fetch_argo_bob",
            lambda **kw: (_ for _ in ()).throw(RuntimeError("network disabled"))
        )
        from app.data.argo_fetch import load_argo_cache
        ds = load_argo_cache(start="2020-01-01", end="2020-02-01")
        assert ds is not None
        assert "TEMP" in ds or "PSAL" in ds or "PRES" in ds

    def test_committed_file_has_real_bob_coords(self):
        """Verify the committed file is actually in Bay of Bengal."""
        import xarray as xr
        ds = xr.open_dataset(self.COMMITTED_FILE)
        lat = ds["LATITUDE"].values.astype(float)
        lon = ds["LONGITUDE"].values.astype(float)
        # All points should be within BoB extended box (5-23N, 80-100E)
        assert float(lat.min()) >= 5.0, f"Min lat {lat.min()} < 5°N"
        assert float(lat.max()) <= 23.0, f"Max lat {lat.max()} > 23°N"
        assert float(lon.min()) >= 80.0, f"Min lon {lon.min()} < 80°E"
        assert float(lon.max()) <= 100.0, f"Max lon {lon.max()} > 100°E"
        ds.close()

    def test_committed_file_n_points(self):
        """9,124 N_POINTS as verified in Phase 0 audit."""
        import xarray as xr
        ds = xr.open_dataset(self.COMMITTED_FILE)
        n = ds.dims["N_POINTS"]
        assert n == 9124, f"Expected 9124 N_POINTS, got {n}"
        ds.close()

    def test_qc_filter_reduces_dataset(self):
        """_apply_qc with QC=[1] should keep only clean data."""
        from app.data.argo_fetch import _apply_qc
        import xarray as xr
        ds = xr.open_dataset(self.COMMITTED_FILE)
        n_before = ds.dims["N_POINTS"]
        ds_qc = _apply_qc(ds, qc_flags=[1])
        n_after = ds_qc.dims.get("N_POINTS", list(ds_qc.dims.values())[0])
        assert n_after <= n_before
        ds.close()

    def test_teos10_adds_sa_ct(self):
        """_add_teos10 should add SA and CT variables."""
        from app.data.argo_fetch import _add_teos10
        import xarray as xr
        ds = xr.open_dataset(self.COMMITTED_FILE)
        ds_t = _add_teos10(ds)
        assert "SA" in ds_t, "SA (Absolute Salinity) not added by _add_teos10"
        assert "CT" in ds_t, "CT (Conservative Temperature) not added by _add_teos10"
        # SA should be close to practical salinity (within 0.5 g/kg typically)
        sa = ds_t["SA"].values.astype(float)
        sp = ds_t["PSAL"].values.astype(float)
        diff = np.abs(sa - sp)
        assert float(np.nanmedian(diff)) < 0.5, f"SA-SP median diff too large: {np.nanmedian(diff):.3f}"
        ds.close()

    def test_manifest_written_after_cache(self, tmp_cache, monkeypatch):
        """After a successful fetch, a manifest JSON must exist."""
        import xarray as xr
        from app.data.cache_utils import read_manifest, make_cache_key
        from app.data.argo_fetch import BOB_BBOX, _cache_key, fetch_argo_bob

        # Monkeypatch argopy to return the committed real file
        committed = self.COMMITTED_FILE

        def fake_fetcher(**kwargs):
            return xr.open_dataset(committed)

        # Patch at the argopy import level inside argo_fetch
        orig_fetch = None
        import app.data.argo_fetch as af

        def _patched_fetch(start, end, bbox, qc_flags, force_refresh):
            ds = xr.open_dataset(committed)
            return ds

        monkeypatch.setattr(af, "_apply_qc", lambda ds, qc: ds)
        monkeypatch.setattr(af, "_add_teos10", lambda ds: ds)

        import importlib, unittest.mock as mock
        with mock.patch("argopy.DataFetcher") as mock_df:
            mock_df.return_value.region.return_value.to_xarray.return_value = xr.open_dataset(committed)
            ds = fetch_argo_bob(start="2020-01-01", end="2020-02-01", bbox=BOB_BBOX)

        key = _cache_key("2020-01-01", "2020-02-01", BOB_BBOX)
        m = read_manifest("argo", key)
        assert m is not None, "Manifest not written after fetch"
        assert m["provenance"] == "REAL"
        assert m["n_records"] > 0


# ─── cyclone_tracks ────────────────────────────────────────────────────────────

class TestCycloneTracks:
    """Tests for IBTrACS fetcher. Network fetch is skipped; tests use synthetic fixture."""

    @pytest.fixture
    def synthetic_ibtracs(self, tmp_path) -> pd.DataFrame:
        """A minimal synthetic IBTrACS-like DataFrame for unit testing.
        This is clearly a TEST FIXTURE — not real track data.
        Real track data is fetched by fetch_ibtracs_ni() at runtime.
        """
        rows = []
        for i in range(10):
            rows.append({
                "SID": "2020101N10085",
                "NAME": "AMPHAN",
                "ISO_TIME": pd.Timestamp("2020-05-16") + pd.Timedelta(hours=6 * i),
                "LAT": 10.0 + i * 0.8,
                "LON": 85.0 + i * 0.5,
                "WMO_WIND": 50.0 + i * 5,
                "WMO_PRES": 980.0 - i * 3,
                "BASIN": "NI",
                "SUBBASIN": "BB",
                "SEASON": 2020,
                "NATURE": "TS",
            })
        for i in range(5):
            rows.append({
                "SID": "2019091N10085",
                "NAME": "FANI",
                "ISO_TIME": pd.Timestamp("2019-04-25") + pd.Timedelta(hours=6 * i),
                "LAT": 8.0 + i * 1.2,
                "LON": 84.0 + i * 0.8,
                "WMO_WIND": 80.0 + i * 8,
                "WMO_PRES": 960.0 - i * 4,
                "BASIN": "NI",
                "SUBBASIN": "BB",
                "SEASON": 2019,
                "NATURE": "TY",
            })
        return pd.DataFrame(rows)

    def test_get_storm_track_extracts_amphan(self, synthetic_ibtracs):
        from app.data.cyclone_tracks import get_storm_track
        track = get_storm_track(synthetic_ibtracs, "AMPHAN")
        assert len(track) == 10
        assert all(track["NAME"] == "AMPHAN")

    def test_get_storm_track_case_insensitive(self, synthetic_ibtracs):
        from app.data.cyclone_tracks import get_storm_track
        track = get_storm_track(synthetic_ibtracs, "amphan")
        assert len(track) == 10

    def test_get_storm_track_not_found(self, synthetic_ibtracs):
        from app.data.cyclone_tracks import get_storm_track
        track = get_storm_track(synthetic_ibtracs, "BIPARJOY")
        assert track.empty

    def test_filter_bob_tracks(self, synthetic_ibtracs):
        from app.data.cyclone_tracks import filter_bob_tracks
        bob = filter_bob_tracks(synthetic_ibtracs)
        # All test fixtures are in BoB (lat 8-18 N, lon 84-92 E)
        assert len(bob) > 0
        assert (bob["LAT"] >= 5.0).all()
        assert (bob["LAT"] <= 23.0).all()
        assert (bob["LON"] >= 80.0).all()
        assert (bob["LON"] <= 100.0).all()

    def test_offline_raises_if_no_cache(self, tmp_cache):
        from app.data.cyclone_tracks import load_ibtracs_cache, DataNotAvailableError
        with pytest.raises(DataNotAvailableError):
            load_ibtracs_cache()

    def test_track_sorted_by_time(self, synthetic_ibtracs):
        from app.data.cyclone_tracks import get_storm_track
        track = get_storm_track(synthetic_ibtracs, "AMPHAN")
        times = pd.to_datetime(track["ISO_TIME"])
        assert (times.diff().dropna() >= pd.Timedelta(0)).all(), "Track not sorted by time"


# ─── sst_chl_fetch offline ─────────────────────────────────────────────────────

class TestSstChlOffline:
    def test_load_sst_cache_raises_when_empty(self, tmp_cache):
        from app.data.sst_chl_fetch import load_sst_cache, DataNotAvailableError
        with pytest.raises(DataNotAvailableError):
            load_sst_cache("2020-01-01", "2020-01-31")

    def test_load_chl_cache_raises_when_empty(self, tmp_cache):
        from app.data.sst_chl_fetch import load_chl_cache, DataNotAvailableError
        with pytest.raises(DataNotAvailableError):
            load_chl_cache("2020-01-01", "2020-01-31")


# ─── cmems_fetch credential check ──────────────────────────────────────────────

class TestCmemsOffline:
    def test_raises_credential_error_without_env(self, monkeypatch):
        monkeypatch.delenv("CMEMS_USERNAME", raising=False)
        monkeypatch.delenv("CMEMS_PASSWORD", raising=False)
        from app.data.cmems_fetch import fetch_cmems_physics, CMEMSCredentialError
        with pytest.raises(CMEMSCredentialError):
            fetch_cmems_physics("2020-01-01", "2020-01-07")

    def test_load_cmems_cache_raises_when_empty(self, tmp_cache):
        from app.data.cmems_fetch import load_cmems_cache, DataNotAvailableError
        with pytest.raises(DataNotAvailableError):
            load_cmems_cache("2020-01-01", "2020-01-07")
