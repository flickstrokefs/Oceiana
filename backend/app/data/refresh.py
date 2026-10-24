"""
app.data.refresh — CLI to pre-fetch and cache all real data sources.

Usage:
    # From repo root (with backend venv active):
    python -m app.data.refresh --region bob --start 2020-01-01 --end 2020-02-01

    # Full year for BoB (Argo + cyclone tracks; SST/chl/CMEMS need network):
    python -m app.data.refresh --region bob --start 2019-01-01 --end 2023-12-31

    # Cyclone case studies (fetch specific windows):
    python -m app.data.refresh --region bob --start 2020-04-01 --end 2020-05-31
    python -m app.data.refresh --region bob --start 2019-04-01 --end 2019-05-15
    python -m app.data.refresh --region bob --start 2023-05-01 --end 2023-05-20

    # CMEMS (requires credentials in .env):
    python -m app.data.refresh --region bob --start 2020-01-01 --end 2020-02-01 --cmems

Requirements:
    CMEMS_USERNAME and CMEMS_PASSWORD must be set in .env for CMEMS fetch.
    All other sources are no-login.

Offline check:
    python -m app.data.refresh --check-cache
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

# Ensure backend root is on path when run as module
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("ariel.data.refresh")

BOB_BBOX = [80.0, 5.0, 100.0, 23.0]

# Load .env
try:
    from dotenv import load_dotenv
    _env = Path(__file__).parent.parent.parent / ".env"
    if _env.exists():
        load_dotenv(_env)
        logger.info(f"Loaded .env from {_env}")
except ImportError:
    pass


def run_refresh(
    region: str,
    start: str,
    end: str,
    fetch_cmems: bool = False,
    fetch_sst: bool = True,
    fetch_chl: bool = True,
    force: bool = False,
) -> dict[str, str]:
    """
    Fetch and cache all data sources for the given region/time window.

    Returns a dict {source: status} for reporting.
    """
    results: dict[str, str] = {}
    bbox = BOB_BBOX  # only BoB supported for now

    # 1. Argo profiles
    logger.info("=== Argo profiles (Ifremer ERDDAP) ===")
    try:
        from app.data.argo_fetch import fetch_argo_bob, get_argo_manifest
        ds = fetch_argo_bob(start=start, end=end, bbox=bbox, force_refresh=force)
        m = get_argo_manifest(start=start, end=end, bbox=bbox)
        n = m.get("n_records", "?") if m else "?"
        results["argo"] = f"OK — {n} points cached"
        logger.info(f"Argo OK: {n} points")
    except Exception as e:
        results["argo"] = f"FAILED — {e}"
        logger.error(f"Argo fetch failed: {e}")

    # 2. IBTrACS cyclone tracks
    logger.info("=== IBTrACS cyclone tracks (NOAA NCEI) ===")
    try:
        from app.data.cyclone_tracks import fetch_ibtracs_ni, list_bob_storms
        df = fetch_ibtracs_ni(year_min=2015, force_refresh=force)
        storms = list_bob_storms(year_min=2015)
        results["cyclone_tracks"] = f"OK — {len(df)} rows, {len(storms)} BoB storms"
        logger.info(f"IBTrACS OK: {len(df)} rows, {len(storms)} BoB storms")
    except Exception as e:
        results["cyclone_tracks"] = f"FAILED — {e}"
        logger.error(f"IBTrACS fetch failed: {e}")

    # 3. MUR SST (optional, can be slow for long ranges)
    if fetch_sst:
        logger.info("=== MUR SST (NOAA CoastWatch ERDDAP) ===")
        try:
            from app.data.sst_chl_fetch import fetch_mur_sst
            ds_sst = fetch_mur_sst(start=start, end=end, bbox=bbox, stride=10, force_refresh=force)
            shape = dict(ds_sst.dims)
            results["sst"] = f"OK — dims={shape}"
            logger.info(f"MUR SST OK: {shape}")
        except Exception as e:
            results["sst"] = f"FAILED — {e}"
            logger.warning(f"MUR SST fetch failed (non-fatal): {e}")

    # 4. VIIRS chlorophyll
    if fetch_chl:
        logger.info("=== VIIRS chlorophyll (NOAA CoastWatch ERDDAP) ===")
        try:
            from app.data.sst_chl_fetch import fetch_viirs_chl
            ds_chl = fetch_viirs_chl(start=start, end=end, bbox=bbox, force_refresh=force)
            shape = dict(ds_chl.dims)
            results["chl"] = f"OK — dims={shape}"
            logger.info(f"VIIRS chl OK: {shape}")
        except Exception as e:
            results["chl"] = f"FAILED — {e}"
            logger.warning(f"VIIRS chl fetch failed (non-fatal): {e}")

    # 5. CMEMS (requires credentials)
    if fetch_cmems:
        logger.info("=== CMEMS physics (requires CMEMS_USERNAME + CMEMS_PASSWORD) ===")
        try:
            from app.data.cmems_fetch import fetch_cmems_physics
            ds_phy = fetch_cmems_physics(start=start, end=end, bbox=bbox, force_refresh=force)
            shape = dict(ds_phy.dims)
            results["cmems_physics"] = f"OK — dims={shape}"
            logger.info(f"CMEMS physics OK: {shape}")
        except Exception as e:
            results["cmems_physics"] = f"FAILED — {e}"
            logger.error(f"CMEMS fetch failed: {e}")
    else:
        results["cmems_physics"] = "SKIPPED (pass --cmems to fetch; requires credentials)"

    return results


def check_cache() -> None:
    """Print a summary of what is currently cached."""
    from app.data.cache_utils import CACHE_ROOT, MANIFEST_DIR
    print("\n=== Cache Status ===")
    if not CACHE_ROOT.exists():
        print("No cache directory found.")
        return

    total_mb = 0.0
    for f in CACHE_ROOT.rglob("*"):
        if f.is_file():
            mb = f.stat().st_size / 1024 / 1024
            total_mb += mb
            print(f"  {f.relative_to(CACHE_ROOT)}  ({mb:.1f} MB)")

    print(f"\nTotal cache size: {total_mb:.1f} MB")

    print("\n=== Manifests ===")
    if MANIFEST_DIR.exists():
        import json
        for mp in sorted(MANIFEST_DIR.glob("*.json")):
            m = json.loads(mp.read_text())
            print(f"  {mp.stem}: source={m.get('source','?')}, "
                  f"n={m.get('n_records','?')}, retrieved={m.get('retrieved_at','?')[:10]}")
    else:
        print("  No manifests found.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Oceiana data refresh — fetch and cache all real data sources."
    )
    parser.add_argument("--region", default="bob", choices=["bob"],
                        help="Target region (bob = Bay of Bengal)")
    parser.add_argument("--start", default="2020-01-01", help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end", default="2020-02-01", help="End date (YYYY-MM-DD)")
    parser.add_argument("--cmems", action="store_true",
                        help="Also fetch CMEMS physics (requires credentials in .env)")
    parser.add_argument("--no-sst", action="store_true", help="Skip MUR SST fetch")
    parser.add_argument("--no-chl", action="store_true", help="Skip chlorophyll fetch")
    parser.add_argument("--force", action="store_true", help="Force re-fetch ignoring cache")
    parser.add_argument("--check-cache", action="store_true", help="Print cache contents and exit")
    args = parser.parse_args()

    if args.check_cache:
        check_cache()
        return

    logger.info(f"Starting data refresh: region={args.region}, {args.start} – {args.end}")

    results = run_refresh(
        region=args.region,
        start=args.start,
        end=args.end,
        fetch_cmems=args.cmems,
        fetch_sst=not args.no_sst,
        fetch_chl=not args.no_chl,
        force=args.force,
    )

    print("\n=== Refresh Results ===")
    all_ok = True
    for source, status in results.items():
        if status.startswith("OK"):
            icon = "[OK]"
        elif status.startswith("SKIP"):
            icon = "[--]"
        else:
            icon = "[FAIL]"
            all_ok = False
        print(f"  {icon} {source}: {status}")

    if all_ok:
        logger.info("All fetches completed. App can now run offline.")
    else:
        logger.warning("Some fetches failed — see above. Non-fatal sources (SST/chl) can be retried later.")

    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
