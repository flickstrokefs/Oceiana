# Oceiana live-data source files

This archive contains the source files that manage live glider data and the related ocean-data ingestion/API flow, extracted from the uploaded repository.

Included:
- `glider_reader/glider_port_reader.py`: physical glider serial/COM port reader; can forward telemetry to the local FastAPI endpoint.
- Backend glider API, schemas, live telemetry state service, provider integrations, ingestion scripts and related ocean/dataset services.
- Frontend live-glider API service, glider service, live sensor panel and resource view.
- Backend entry points, configuration, dependencies and glider tests.

Excluded intentionally:
- `.venv`, `node_modules`, Python bytecode and test caches.
- Per-glider cached JSON snapshots (these are data/cache artifacts, not source code).
- Unrelated UI, assets and application files.

Important:
- `glider_reader/glider_port_reader.py` is a standalone local serial reader. It needs the correct COM port and baud rate and the `pyserial` dependency.
- The reader forwards to `http://127.0.0.1:8000/api/gliders/live` when run with `--forward`; check its CLI options before use.
- The backend live telemetry service uses in-memory history, so history resets when the backend restarts.
- This is a focused source bundle, not a standalone complete application. Existing package imports may require other repository files when integrating it.
- Cached records and source code are different: a cached glider JSON record does not prove a live provider is currently reachable.
