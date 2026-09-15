import io
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_upload_and_job_pipeline():
    # 1. Create small test CSV file
    csv_content = (
        "LATITUDE,LONGITUDE,PRES,TEMP,PSAL\n"
        "15.4,72.2,0.0,28.4,35.8\n"
        "15.4,72.2,50.0,26.2,35.6\n"
        "15.4,72.2,100.0,22.1,35.4\n"
        "15.4,72.2,500.0,11.5,35.0\n"
        "15.4,72.2,1000.0,6.2,34.8\n"
    ).encode("utf-8")

    file_obj = io.BytesIO(csv_content)

    # 2. Upload
    resp_upload = client.post(
        "/api/datasets/upload",
        files={"file": ("test_cruise_ctd.csv", file_obj, "text/csv")},
    )
    assert resp_upload.status_code == 200
    up_data = resp_upload.json()
    dataset_id = up_data["id"]
    assert dataset_id.startswith("ds-")
    assert up_data["status"] == "UPLOADED"

    # 3. Trigger processing job
    resp_proc = client.post(f"/api/datasets/{dataset_id}/process")
    assert resp_proc.status_code == 200
    job_data = resp_proc.json()
    job_id = job_data["job_id"]

    # 4. Check job status
    resp_stat = client.get(f"/api/datasets/{job_id}/status")
    assert resp_stat.status_code == 200
    stat_data = resp_stat.json()
    assert stat_data["status"] == "READY"
    assert stat_data["progress"] == 100

    # 5. Inspect dataset schema
    resp_detail = client.get(f"/api/datasets/{dataset_id}")
    assert resp_detail.status_code == 200
    detail = resp_detail.json()
    assert len(detail["detected_variables"]) >= 5

    # 6. Delete dataset
    resp_del = client.delete(f"/api/datasets/{dataset_id}")
    assert resp_del.status_code == 200
