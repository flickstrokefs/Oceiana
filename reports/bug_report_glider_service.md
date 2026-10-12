# 🐛 Bug Report: Glider Service Import Crash

**File affected:** `backend/app/services/glider_service.py` (Lines 61 & 114)  
**Severity:** High (Breaks glider loading / crashes backend startup)  
**Fix Time:** ~2 minutes  

---

### 1. In Simple Words: What is Happening?
Imagine you are standing inside your bedroom, but you ask someone to "open the front door of the house to get to your desk." You're already inside the house!

When we start the backend server (on Render or locally with `uvicorn main:app`), we run it from inside the **`backend/`** folder. 
Because we are already inside `backend/`, Python expects to see `scripts/`. But the code is asking for `backend.scripts/`. 

Python gets confused, says *"I cannot find any folder named 'backend'"*, and crashes with:
```text
ModuleNotFoundError: No module named 'backend'
```

---

### 2. How Does This Impact the Overall Project?
1. **Glider Feature Fails:** Any time the app tries to load or fetch underwater gliders, it fails.
2. **Crash on Clean Startup:** If the glider cache is empty (e.g. fresh clone on a judge's laptop or new deployment on Render), the server fails to auto-ingest and crashes.
3. **Broken Frontend Views:** On the 3D globe, underwater glider paths and mission charts will show errors or stay blank.

---

### 3. How to Fix It (Quick 2-Minute Fix)

Open **`backend/app/services/glider_service.py`**:

#### Fix 1 (Line 61):
Change:
```python
from backend.scripts.ingest_ifremer_gliders import run_full_ingestion
```
To:
```python
try:
    from scripts.ingest_ifremer_gliders import run_full_ingestion
except ModuleNotFoundError:
    from backend.scripts.ingest_ifremer_gliders import run_full_ingestion
```

#### Fix 2 (Line 114):
Change:
```python
from backend.scripts.ingest_ifremer_gliders import fetch_and_normalize_mission
```
To:
```python
try:
    from scripts.ingest_ifremer_gliders import fetch_and_normalize_mission
except ModuleNotFoundError:
    from backend.scripts.ingest_ifremer_gliders import fetch_and_normalize_mission
```

*(This `try/except` ensures it works no matter where you start the server from: inside `backend/` or from the main project folder).*
