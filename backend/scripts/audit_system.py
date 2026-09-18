import time
import json
import urllib.request
import urllib.error
import sys
from pathlib import Path

# Setup paths
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

BASE_URL = "http://127.0.0.1:8000"

def test_endpoint(method: str, path: str, body=None, expected_code=200):
    safe_path = urllib.parse.quote(path, safe="/:?=&[]")
    url = f"{BASE_URL}{safe_path}"
    headers = {"Content-Type": "application/json"} if body else {}
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    start_t = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            elapsed = (time.perf_counter() - start_t) * 1000
            status_code = resp.status
            content = resp.read().decode("utf-8")
            try:
                parsed = json.loads(content)
            except Exception:
                parsed = content[:200]
            
            passed = (status_code == expected_code)
            return {
                "method": method,
                "path": path,
                "expected": expected_code,
                "status": status_code,
                "elapsed_ms": round(elapsed, 2),
                "passed": passed,
                "result": parsed,
                "error": None
            }
    except urllib.error.HTTPError as e:
        elapsed = (time.perf_counter() - start_t) * 1000
        passed = (e.code == expected_code)
        err_msg = e.read().decode("utf-8") if hasattr(e, "read") else str(e)
        try:
            err_json = json.loads(err_msg)
        except Exception:
            err_json = err_msg[:200]
        return {
            "method": method,
            "path": path,
            "expected": expected_code,
            "status": e.code,
            "elapsed_ms": round(elapsed, 2),
            "passed": passed,
            "result": err_json,
            "error": err_msg
        }
    except Exception as e:
        elapsed = (time.perf_counter() - start_t) * 1000
        return {
            "method": method,
            "path": path,
            "expected": expected_code,
            "status": 0,
            "elapsed_ms": round(elapsed, 2),
            "passed": False,
            "result": None,
            "error": str(e)
        }

def run_all_tests():
    endpoints = [
        # System
        ("GET", "/", None, 200),
        ("GET", "/api/health", None, 200),
        ("GET", "/api/metadata", None, 200),
        
        # Argo
        ("GET", "/api/argo", None, 200),
        ("GET", "/api/argo?region=bay_of_bengal", None, 200),
        ("GET", "/api/argo?region=arabian_sea", None, 200),
        ("GET", "/api/argo?region=southern_ocean", None, 200),
        ("GET", "/api/argo?region=pacific", None, 400),
        ("GET", "/api/argo/observations?limit=5", None, 200),
        ("GET", "/api/argo/observations?region=bay_of_bengal&limit=5", None, 200),
        ("GET", "/api/argo/profiles", None, 200),
        ("GET", "/api/argo/profiles?region=bay_of_bengal", None, 200),
        ("GET", "/api/argo/profiles?region=arabian_sea", None, 200),
        ("GET", "/api/argo/profiles?region=southern_ocean", None, 200),
        ("GET", "/api/argo/profiles/1", None, 200),
        ("GET", "/api/argo/profiles/999999", None, 404),
        ("GET", "/api/argo/depth", None, 200),
        
        # Gliders
        ("GET", "/api/gliders", None, 200),
        ("GET", "/api/gliders?region=bay_of_bengal", None, 200),
        ("GET", "/api/gliders?region=southern_ocean", None, 200),
        ("GET", "/api/gliders?region=arabian_sea", None, 200),
        ("GET", "/api/gliders?region=atlantic", None, 400),
        ("GET", "/api/gliders/ru29-20180812T0220", None, 200),
        ("GET", "/api/gliders/ru29-20180812T0220/track", None, 200),
        ("GET", "/api/gliders/ru29-20180812T0220/track?downsample=50", None, 200),
        ("GET", "/api/gliders/ru29-20180812T0220/profile", None, 200),
        ("GET", "/api/gliders/amlr01-20191206T0452-delayed", None, 200),
        ("GET", "/api/gliders/non-existent-glider", None, 404),
        
        # Observations
        ("GET", "/api/observations", None, 200),
        ("GET", "/api/observations?type=glider", None, 200),
        ("GET", "/api/observations?type=argo", None, 200),
        ("GET", "/api/observations/ru29-20180812T0220", None, 200),
        ("GET", "/api/observations/argo-1", None, 200),
        ("GET", "/api/observations/ru29-20180812T0220/profile?type=glider", None, 200),
        ("GET", "/api/observations/argo-1/profile?type=argo", None, 200),
        
        # Ocean Fields & Depth Slices
        ("GET", "/api/ocean/depth-slice?parameter=temperature&depth=50", None, 200),
        ("GET", "/api/ocean/depth-slice?parameter=salinity&depth=100&region=bay_of_bengal", None, 200),
        ("GET", "/api/ocean/depth-slice?region=pacific", None, 400),
        ("GET", "/api/ocean/currents?depth=0", None, 200),
        ("GET", "/api/ocean/profile?lat=15.0&lon=68.0&depth=50", None, 200),
        ("GET", "/api/ocean/profile?lat=0.0&lon=75.0&depth=0", None, 400),
        ("GET", "/api/ocean/timeseries?parameter=temperature&lat=15.0&lon=68.0&depth=50", None, 200),
        ("GET", "/api/regions/bay-of-bengal/slice?depth=100&var=temperature", None, 200),
        ("GET", "/api/regions/southern-ocean/slice?depth=200&var=salinity", None, 200),
        ("GET", "/api/ocean-depth-points", None, 200),
        ("GET", "/api/ocean/temperature?depth=0", None, 200),
        
        # Datasets
        ("GET", "/api/datasets", None, 200),
        
        # Hazard Assessment
        ("GET", "/api/hazard/layers", None, 200),
        ("POST", "/api/hazard/analyze", {"variable": "current_speed", "threshold": 1.5, "region": "Arabian Sea", "forecast_period": "24h"}, 200),
        ("POST", "/api/hazard/analyze", {"variable": "current_speed", "threshold": 1.5, "region": "Pacific Ocean", "forecast_period": "24h"}, 400),
        
        # Fishery Advisories
        ("GET", "/api/fishery/advisory?region=Arabian Sea", None, 200),
        ("GET", "/api/fishery/advisory?region=Bay of Bengal", None, 200),
        ("GET", "/api/fishery/advisory?region=Pacific", None, 400),
        ("GET", "/api/fishery/pfz?region=Arabian Sea", None, 200),
        
        # Search
        ("GET", "/api/search?q=temperature", None, 200),
        ("GET", "/api/search?type=Argo", None, 200),
        ("GET", "/api/search?region=Southern Ocean", None, 200),
    ]

    print(f"Executing audit of {len(endpoints)} API endpoints against {BASE_URL}...\n")
    results = []
    for method, path, body, expected in endpoints:
        res = test_endpoint(method, path, body, expected)
        results.append(res)
        status_sym = "[PASS]" if res["passed"] else "[FAIL]"
        print(f"{status_sym} {method:4} {path:65} -> {res['status']} ({res['elapsed_ms']} ms)")
    
    total = len(results)
    passed = sum(1 for r in results if r["passed"])
    failed = total - passed
    print(f"\nAPI Audit Complete: {passed}/{total} endpoints passed ({failed} failed).")

    # Pipeline functions test
    print("\nAuditing Python Data Service Pipeline Functions...")
    pipeline_results = {}
    try:
        from data_service import (
            load_argo_data,
            standardize_profiles,
            add_density_products,
            add_vertical_gradients,
            PRIMARY_DATA_PATH,
            STANDARDIZED_PATH,
            DERIVED_PATH,
            GRADIENT_PATH,
        )
        t0 = time.perf_counter()
        raw_df = load_argo_data()
        pipeline_results["load_argo_data"] = {
            "status": "PASS",
            "rows": len(raw_df),
            "columns": list(raw_df.columns),
            "elapsed_ms": round((time.perf_counter() - t0) * 1000, 2),
            "source_file": PRIMARY_DATA_PATH.name,
        }
        print(f"[PASS] load_argo_data(): {len(raw_df)} rows loaded ({pipeline_results['load_argo_data']['elapsed_ms']} ms)")
    except Exception as e:
        pipeline_results["load_argo_data"] = {"status": "FAIL", "error": str(e)}
        print(f"[FAIL] load_argo_data(): {e}")

    try:
        from data_service import standardize_profiles
        t0 = time.perf_counter()
        std_df = standardize_profiles()
        pipeline_results["standardize_profiles"] = {
            "status": "PASS",
            "rows": len(std_df),
            "elapsed_ms": round((time.perf_counter() - t0) * 1000, 2),
            "unique_profiles": int(std_df["PROFILE_ID"].nunique()),
        }
        print(f"[PASS] standardize_profiles(): {len(std_df)} rows across {std_df['PROFILE_ID'].nunique()} profiles ({pipeline_results['standardize_profiles']['elapsed_ms']} ms)")
    except Exception as e:
        pipeline_results["standardize_profiles"] = {"status": "FAIL", "error": str(e)}
        print(f"[FAIL] standardize_profiles(): {e}")

    try:
        from data_service import add_density_products
        t0 = time.perf_counter()
        der_df = add_density_products(std_df)
        pipeline_results["add_density_products"] = {
            "status": "PASS",
            "rows": len(der_df),
            "elapsed_ms": round((time.perf_counter() - t0) * 1000, 2),
            "added_columns": ["SA", "CT", "SIGMA0"],
        }
        print(f"[PASS] add_density_products() [TEOS-10]: SA, CT, SIGMA0 added ({pipeline_results['add_density_products']['elapsed_ms']} ms)")
    except Exception as e:
        pipeline_results["add_density_products"] = {"status": "FAIL", "error": str(e)}
        print(f"[FAIL] add_density_products(): {e}")

    try:
        from data_service import add_vertical_gradients
        t0 = time.perf_counter()
        grad_df = add_vertical_gradients(der_df)
        pipeline_results["add_vertical_gradients"] = {
            "status": "PASS",
            "rows": len(grad_df),
            "elapsed_ms": round((time.perf_counter() - t0) * 1000, 2),
            "added_columns": ["TEMP_GRADIENT", "SA_GRADIENT", "SIGMA0_GRADIENT"],
        }
        print(f"[PASS] add_vertical_gradients(): Gradients added ({pipeline_results['add_vertical_gradients']['elapsed_ms']} ms)")
    except Exception as e:
        pipeline_results["add_vertical_gradients"] = {"status": "FAIL", "error": str(e)}
        print(f"[FAIL] add_vertical_gradients(): {e}")

    output_audit = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "summary": {
            "total_endpoints": total,
            "passed_endpoints": passed,
            "failed_endpoints": failed,
        },
        "endpoints": results,
        "pipelines": pipeline_results,
    }

    audit_json_path = BACKEND_DIR / "storage" / "audit_results.json"
    with open(audit_json_path, "w", encoding="utf-8") as f:
        json.dump(output_audit, f, indent=2)
    print(f"\nRaw audit JSON output saved to {audit_json_path}")

if __name__ == "__main__":
    run_all_tests()
