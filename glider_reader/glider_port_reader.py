#!/usr/bin/env python3
"""
Ocean Glider COM Port Reader & Local Backend Ingestion Forwarder
================================================================
Reads live data from a physical ocean glider connected via serial COM port (default: COM5 on Windows)
and optionally forwards parsed telemetry to the local Oceiana FastAPI backend (http://127.0.0.1:8000/api/gliders/live).

Key Features:
- Sole owner of COM5: safely handles connection, timeout, error recovery, and Ctrl+C shutdown.
- Configurable baud rate (default: 115200) and port (default: COM5).
- Parses whitespace-separated key=value telemetry (e.g. depth_cm=49.2 temp_c=25.00 turb_v=0.682 ...).
- Automatically converts numeric values into integer/float without altering original values.
- Formats parsed fields as clean indented JSON for terminal inspection.
- Separately handles and prominently displays device warnings (e.g. # WARN: DS18B20 not found, using 25C).
- Tracks sensor health state: flags temperature as UNVERIFIED when DS18B20 fallback warning is active.
- Distinguishes device-reported values from verified/calibrated sensors (turbidity/TDS uncalibrated).
- Optional HTTP forwarding to local FastAPI backend (--forward flag), with bounded timeouts (2.0s).
- Non-blocking error handling: backend downtime does not interrupt or crash the serial reading loop.
- Never fabricates GPS coordinates or replaces missing sensor readings with zero.
- Fully backwards compatible with standalone diagnostic mode.
"""

import argparse
import datetime
import json
import queue
import sys
import threading
import time
import urllib.error
import urllib.request

try:
    import serial
    import serial.tools.list_ports
except ImportError:
    serial = None


class GliderState:
    """Tracks state and diagnostic health flags across telemetry frames."""

    def __init__(self):
        self.ds18b20_fallback_active: bool = False
        self.last_warning_msg: str | None = None
        self.active_warnings: list[str] = []
        self.warning_count: int = 0
        self.telemetry_count: int = 0
        self.total_bytes: int = 0
        self.forwarded_count: int = 0
        self.forward_fail_count: int = 0


def get_timestamp() -> str:
    """Return an ISO-like timestamp string with milliseconds for diagnostics."""
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]


def safe_display_text(text: str) -> str:
    """
    Format string so that non-printable or unencodable characters do not trigger
    UnicodeEncodeError on Windows console (e.g., cp1252 encoding).
    """
    encoding = sys.stdout.encoding or "utf-8"
    try:
        text.encode(encoding)
        return text
    except (UnicodeEncodeError, LookupError):
        return text.encode(encoding, errors="backslashreplace").decode(encoding, errors="replace")


def list_com_ports():
    """List and return all serial COM ports detected on the system."""
    if serial is None:
        print("[!] The 'pyserial' package is not installed.")
        print("    Run: python -m pip install pyserial")
        return []

    ports = list(serial.tools.list_ports.comports())
    if not ports:
        print("[-] No COM ports detected on this system.")
    else:
        print("[*] Available COM Ports:")
        for p in ports:
            desc = p.description if p.description else "No description"
            hwid = f" (HWID: {p.hwid})" if p.hwid else ""
            print(f"    - {p.device}: {desc}{hwid}")
    return ports


def parse_numeric(val_str: str):
    """
    Convert string to int or float without altering its value.
    If it is not numeric, return the string as-is.
    """
    val_str = val_str.strip()
    try:
        if "." in val_str or "e" in val_str.lower():
            return float(val_str)
        return int(val_str)
    except ValueError:
        return val_str


def parse_key_value_telemetry(text: str) -> tuple[dict, list[str]]:
    """
    Parse a whitespace-delimited key=value telemetry line.
    Returns:
      (parsed_dict, malformed_tokens)
    """
    parsed = {}
    malformed = []

    tokens = text.split()
    for token in tokens:
        if "=" in token:
            key, _, val = token.partition("=")
            key = key.strip()
            val = val.strip()
            if key and val:
                parsed[key] = parse_numeric(val)
            else:
                malformed.append(token)
        else:
            malformed.append(token)

    return parsed, malformed


def generate_sensor_status(parsed: dict, ds18b20_fallback: bool) -> list[str]:
    """
    Generate sensor-status descriptions distinguishing reported values
    from verified measurements.
    """
    status_lines = []

    # 1. Depth
    if "depth_cm" in parsed:
        status_lines.append(f"- Depth: reported ({parsed['depth_cm']} cm)")
    elif "depth_m" in parsed:
        status_lines.append(f"- Depth: reported ({parsed['depth_m']} m)")

    # 2. Temperature
    if "temp_c" in parsed or "temperature_c" in parsed:
        raw_t = parsed.get("temp_c", parsed.get("temperature_c"))
        if ds18b20_fallback:
            status_lines.append(f"- Temperature: UNVERIFIED -- device reports DS18B20 fallback (raw: {raw_t} C)")
        else:
            status_lines.append(f"- Temperature: reported ({raw_t} C), calibration not independently verified")

    # 3. Turbidity
    if "turb_v" in parsed or "ntu" in parsed:
        turb_info = []
        if "turb_v" in parsed:
            turb_info.append(f"{parsed['turb_v']}V")
        if "ntu" in parsed:
            turb_info.append(f"{parsed['ntu']} NTU")
        info_str = f" ({', '.join(turb_info)})" if turb_info else ""
        status_lines.append(f"- Turbidity: reported{info_str}, calibration not independently verified")

    # 4. TDS
    if "tds_v" in parsed or "tds_ppm" in parsed:
        tds_info = []
        if "tds_v" in parsed:
            tds_info.append(f"{parsed['tds_v']}V")
        if "tds_ppm" in parsed:
            tds_info.append(f"{parsed['tds_ppm']} ppm")
        info_str = f" ({', '.join(tds_info)})" if tds_info else ""
        status_lines.append(f"- TDS: reported{info_str}, calibration not independently verified")

    # Any other reported fields
    known_keys = {
        "depth_cm", "depth_m", "temp_c", "temperature_c",
        "turb_v", "ntu", "tds_v", "tds_ppm"
    }
    for k in parsed:
        if k not in known_keys:
            status_lines.append(f"- {k}: reported ({parsed[k]})")

    return status_lines


def handle_device_warning(text: str, state: GliderState, ts: str):
    """
    Process and prominently display device warnings such as:
    # WARN: DS18B20 not found, using 25C
    """
    state.warning_count += 1
    state.last_warning_msg = text
    if text not in state.active_warnings:
        state.active_warnings.append(text)

    # Check for DS18B20 fallback warning
    if "DS18B20" in text.upper():
        state.ds18b20_fallback_active = True

    print("\n" + "=" * 70)
    print("DEVICE WARNING RECEIVED")
    print(f"Timestamp: {ts}")
    print(f"Warning  : {safe_display_text(text)}")
    if state.ds18b20_fallback_active:
        print("Notice   : DS18B20 temperature sensor fault active. Hardware fallback in use.")
        print("           All subsequent temp_c readings are flagged as UNVERIFIED.")
    print("=" * 70)


def build_forwarding_payload(
    parsed: dict,
    raw_text: str,
    ts: str,
    state: GliderState,
    glider_id: str,
) -> dict:
    """
    Construct the JSON payload for backend ingestion according to API contract.
    Never fabricates coordinates or replaces missing sensor values with 0.
    """
    # Safe numeric extraction (retains None if absent)
    depth_cm = parsed.get("depth_cm")
    if depth_cm is not None and not isinstance(depth_cm, (int, float)):
        depth_cm = None

    temp_c = parsed.get("temp_c")
    if temp_c is not None and not isinstance(temp_c, (int, float)):
        temp_c = None

    turb_v = parsed.get("turb_v")
    if turb_v is not None and not isinstance(turb_v, (int, float)):
        turb_v = None

    ntu = parsed.get("ntu")
    if ntu is not None and not isinstance(ntu, (int, float)):
        ntu = None

    tds_v = parsed.get("tds_v")
    if tds_v is not None and not isinstance(tds_v, (int, float)):
        tds_v = None

    tds_ppm = parsed.get("tds_ppm")
    if tds_ppm is not None and not isinstance(tds_ppm, (int, float)):
        tds_ppm = None

    # Temperature verified flag is strictly False if DS18B20 fallback is active
    temp_c_verified = False if state.ds18b20_fallback_active else False

    # GPS coordinates: only if explicitly supplied by hardware
    latitude = parsed.get("lat", parsed.get("latitude"))
    if latitude is not None and not isinstance(latitude, (int, float)):
        latitude = None

    longitude = parsed.get("lon", parsed.get("longitude"))
    if longitude is not None and not isinstance(longitude, (int, float)):
        longitude = None

    payload = {
        "glider_id": glider_id,
        "timestamp": ts,
        "raw_message": raw_text,
        "depth_cm": depth_cm,
        "temp_c": temp_c,
        "temp_c_verified": temp_c_verified,
        "ds18b20_fallback_active": state.ds18b20_fallback_active,
        "turb_v": turb_v,
        "ntu": ntu,
        "turbidity_verified": False,
        "tds_v": tds_v,
        "tds_ppm": tds_ppm,
        "tds_verified": False,
        "latitude": latitude,
        "longitude": longitude,
        "warnings": list(state.active_warnings),
        "parsed_fields": parsed,
        "source": "serial_com5",
    }
    return payload


def forward_to_backend(payload: dict, api_url: str, state: GliderState):
    """
    HTTP POST forwarder to local FastAPI backend.
    Uses 127.0.0.1 to avoid Windows IPv6 resolution latency.
    """
    if "localhost" in api_url:
        api_url = api_url.replace("localhost", "127.0.0.1")

    try:
        json_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            api_url,
            data=json_bytes,
            headers={"Content-Type": "application/json", "User-Agent": "GliderPortReader/2.0"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            if resp.status in (200, 201):
                state.forwarded_count += 1
                print(f"[{get_timestamp()}] [FORWARDED -> BACKEND] Ingestion successful (HTTP {resp.status})")
            else:
                state.forward_fail_count += 1
                print(f"[{get_timestamp()}] [FORWARD WARNING] Backend returned HTTP {resp.status}")
    except urllib.error.URLError as url_err:
        state.forward_fail_count += 1
        print(f"[{get_timestamp()}] [FORWARD WARNING] Could not reach backend: {url_err.reason}. Continuing serial loop...")
    except Exception as ex:
        state.forward_fail_count += 1
        print(f"[{get_timestamp()}] [FORWARD WARNING] Ingestion error: {ex}. Continuing serial loop...")


class AsyncHttpForwarder:
    """
    Non-blocking HTTP forwarder that drains queued telemetry frames in a background worker thread.
    Ensures serial readline() is never blocked or delayed by HTTP network latency.
    """

    def __init__(self, api_url: str, state: GliderState, max_queue: int = 50):
        self.api_url = api_url.replace("localhost", "127.0.0.1")
        self.state = state
        self.queue: queue.Queue = queue.Queue(maxsize=max_queue)
        self._stop_event = threading.Event()
        self._thread = threading.Thread(target=self._worker, daemon=True)
        self._thread.start()

    def enqueue(self, payload: dict):
        try:
            self.queue.put_nowait(payload)
        except queue.Full:
            # Drop the oldest frame so live sensor telemetry stays current
            try:
                self.queue.get_nowait()
            except queue.Empty:
                pass
            try:
                self.queue.put_nowait(payload)
            except queue.Full:
                pass

    def _worker(self):
        while not self._stop_event.is_set():
            try:
                payload = self.queue.get(timeout=0.2)
            except queue.Empty:
                continue

            forward_to_backend(payload, self.api_url, self.state)
            self.queue.task_done()

    def stop(self):
        self._stop_event.set()


def process_incoming_line(
    raw_bytes: bytes,
    state: GliderState,
    forward: bool = False,
    api_url: str = "http://127.0.0.1:8000/api/gliders/live",
    glider_id: str = "GLIDER-PHYSICAL-COM5",
    forwarder: AsyncHttpForwarder | None = None,
) -> bool:
    """
    Process an incoming line from the glider serial interface.
    Handles warnings, key-value telemetry, fallback JSON, and optional HTTP forwarding.
    """
    ts = get_timestamp()

    # Step 1: Decode incoming bytes
    is_clean_decode = True
    try:
        text = raw_bytes.decode("utf-8").strip()
    except UnicodeDecodeError:
        is_clean_decode = False
        text = raw_bytes.decode("latin-1", errors="replace").strip()

    if not text:
        return False

    # Check for unreadable / corrupted bytes
    has_unprintable = any(ord(c) < 32 and c not in "\t\r\n" for c in text)
    if not is_clean_decode or has_unprintable:
        print(f"\n[{ts}] [DIAGNOSTIC WARNING] Unreadable characters detected in byte stream.")
        print(f"  Raw Hex Dump: {raw_bytes.hex(' ')}")
        print("  Notice: Please verify baud rate, parity, stop bits, and character encoding.")
        print(f"  Best-effort text: {safe_display_text(text)}")

    # Step 2: Check if this is a device warning (e.g., # WARN: ...)
    if text.startswith("# WARN:") or (text.startswith("#") and "WARN" in text.upper()):
        handle_device_warning(text, state, ts)
        return True

    # Check if this is a general device comment (# comment)
    if text.startswith("#"):
        print(f"\n[{ts}] [DEVICE COMMENT / LOG]:")
        print(f"  {safe_display_text(text)}")
        return True

    # Step 3: Check if message is JSON format (for compatibility)
    if text.startswith("{") and text.endswith("}"):
        try:
            parsed = json.loads(text)
            state.telemetry_count += 1
            print(f"\nTELEMETRY RECEIVED (JSON)")
            print(f"Timestamp: {ts}")
            print(f"\nRaw:\n{safe_display_text(text)}")
            print(f"\nParsed fields:\n{json.dumps(parsed, indent=2, ensure_ascii=False)}")
            status_lines = generate_sensor_status(parsed, state.ds18b20_fallback_active)
            if status_lines:
                print(f"\nSensor status:")
                for s in status_lines:
                    print(f"{safe_display_text(s)}")

            if forward or forwarder is not None:
                payload = build_forwarding_payload(parsed, text, ts, state, glider_id)
                if forwarder is not None:
                    forwarder.enqueue(payload)
                elif forward:
                    forward_to_backend(payload, api_url, state)
            return True
        except (json.JSONDecodeError, ValueError):
            pass

    # Step 4: Parse key-value telemetry (e.g., depth_cm=49.2 temp_c=25.00 ...)
    parsed, malformed = parse_key_value_telemetry(text)

    if parsed:
        state.telemetry_count += 1
        print(f"\nTELEMETRY RECEIVED")
        print(f"Timestamp: {ts}")
        print(f"\nRaw:\n{safe_display_text(text)}")
        print(f"\nParsed fields:\n{json.dumps(parsed, indent=2, ensure_ascii=False)}")

        status_lines = generate_sensor_status(parsed, state.ds18b20_fallback_active)
        if status_lines:
            print(f"\nSensor status:")
            for s in status_lines:
                print(f"{safe_display_text(s)}")

        if malformed:
            print(f"\n[MALFORMED TOKENS DETECTED IN MESSAGE]: {malformed}")

        if forward or forwarder is not None:
            payload = build_forwarding_payload(parsed, text, ts, state, glider_id)
            if forwarder is not None:
                forwarder.enqueue(payload)
            elif forward:
                forward_to_backend(payload, api_url, state)
        return True

    # Step 5: Unrecognized non-empty line
    print(f"\n[{ts}] [UNRECOGNIZED RAW DATA] ({len(raw_bytes)} bytes):")
    print(f"  {safe_display_text(text)}")
    return False


def run_standalone_test():
    """Verify parsing and diagnostic logic on test inputs without hardware."""
    print("=" * 70)
    print("RUNNING STANDALONE TELEMETRY & FORWARDING PARSER VERIFICATION")
    print("=" * 70)

    test_state = GliderState()

    # 1. Exact sample telemetry before warning
    print("\n--- Test 1: Exact Telemetry Sample (Prior to warning) ---")
    sample_1 = b"depth_cm=0.0 temp_c=25.00 turb_v=0.602 ntu=3000 tds_v=0.090 tds_ppm=38\n"
    process_incoming_line(sample_1, test_state)

    # 2. Warning recognition
    print("\n--- Test 2: Warning Recognition (# WARN: DS18B20 not found, using 25C) ---")
    warn_sample = b"# WARN: DS18B20 not found, using 25C\n"
    process_incoming_line(warn_sample, test_state)
    assert test_state.ds18b20_fallback_active is True, "Error: ds18b20_fallback_active should be True"

    # 3. Subsequent telemetry test (temperature must remain UNVERIFIED)
    print("\n--- Test 3: Subsequent Telemetry (Must persist UNVERIFIED temperature) ---")
    sample_3 = b"depth_cm=49.2 temp_c=25.00 turb_v=0.682 ntu=3000 tds_v=0.000 tds_ppm=0\n"
    process_incoming_line(sample_3, test_state)

    # 4. Payload validation test
    parsed, _ = parse_key_value_telemetry("depth_cm=49.2 temp_c=25.00 turb_v=0.682 ntu=3000 tds_v=0.000 tds_ppm=0")
    payload = build_forwarding_payload(parsed, "raw_sample", get_timestamp(), test_state, "GLIDER-PHYSICAL-COM5")
    assert payload["depth_cm"] == 49.2
    assert payload["temp_c"] == 25.0
    assert payload["temp_c_verified"] is False
    assert payload["ds18b20_fallback_active"] is True
    assert payload["latitude"] is None
    assert payload["longitude"] is None
    print("\n--- Test 4: Forwarding payload structure verified cleanly ---")
    print(json.dumps(payload, indent=2))

    # 5. Malformed tokens, missing fields, invalid numeric values
    print("\n--- Test 5: Malformed tokens, missing fields, invalid values ---")
    sample_malformed = b"depth_cm=0.0 stray_token invalid_val=NaN temp_c=25.00 =no_key empty_val= turb_v=1.041\n"
    process_incoming_line(sample_malformed, test_state)

    print("\n" + "=" * 70)
    print("ALL STANDALONE VERIFICATION TESTS PASSED SUCCESSFULLY")
    print("=" * 70)


def main():
    parser = argparse.ArgumentParser(
        description="Ocean Glider COM Port Reader - Read live telemetry and optionally forward to Oceiana backend."
    )
    parser.add_argument(
        "--port",
        default="COM5",
        help="Serial port to connect to (default: COM5 on Windows, or /dev/ttyUSB0 on Linux)",
    )
    parser.add_argument(
        "--baud",
        type=int,
        default=115200,
        help="Baud rate (default: 115200)",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=1.0,
        help="Read timeout in seconds (default: 1.0)",
    )
    parser.add_argument(
        "--forward",
        action="store_true",
        help="Enable HTTP telemetry forwarding to local Oceiana FastAPI backend (http://127.0.0.1:8000/api/gliders/live).",
    )
    parser.add_argument(
        "--api-url",
        default="http://127.0.0.1:8000/api/gliders/live",
        help="Backend ingestion endpoint URL (default: http://127.0.0.1:8000/api/gliders/live)",
    )
    parser.add_argument(
        "--glider-id",
        default="GLIDER-PHYSICAL-COM5",
        help="Physical glider identifier string (default: GLIDER-PHYSICAL-COM5)",
    )
    parser.add_argument(
        "--list-ports",
        action="store_true",
        help="List available COM ports on this machine and exit.",
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Run self-test on sample data without connecting to hardware.",
    )

    args = parser.parse_args()

    # Self-test mode
    if args.test:
        run_standalone_test()
        sys.exit(0)

    # Check pyserial availability
    if serial is None:
        print("\n[ERROR] Missing required library: 'pyserial'")
        print("Please install pyserial by running:")
        print("    python -m pip install pyserial\n")
        sys.exit(1)

    # List ports mode
    if args.list_ports:
        list_com_ports()
        sys.exit(0)

    port_name = args.port.strip()
    baud_rate = args.baud
    timeout_sec = args.timeout
    forward_enabled = args.forward
    api_url = args.api_url.strip()
    if "localhost" in api_url:
        api_url = api_url.replace("localhost", "127.0.0.1")
    glider_id = args.glider_id.strip()

    print("=" * 70)
    print("OCEAN GLIDER PORT READER & INGESTION FORWARDER")
    print("=" * 70)
    print(f"Target Port : {port_name}")
    print(f"Baud Rate   : {baud_rate}")
    print(f"Timeout     : {timeout_sec}s")
    print(f"Glider ID   : {glider_id}")
    print(f"Forwarding  : {'ENABLED -> ' + api_url if forward_enabled else 'DISABLED (Standalone Diagnostic Mode)'}")
    print(f"Start Time  : {get_timestamp()}")
    print("-" * 70)
    print(f"[*] Attempting to open serial connection to {port_name}...")

    ser = None
    try:
        ser = serial.Serial(
            port=port_name,
            baudrate=baud_rate,
            bytesize=serial.EIGHTBITS,
            parity=serial.PARITY_NONE,
            stopbits=serial.STOPBITS_ONE,
            timeout=timeout_sec,
        )
    except serial.SerialException as ex:
        err_msg = str(ex)
        print(f"\n[ERROR] Could not open port {port_name}: {err_msg}")
        if "FileNotFoundError" in err_msg or "cannot find" in err_msg.lower():
            print(f"  -> Port '{port_name}' does not exist or device is disconnected.")
        elif "PermissionError" in err_msg or "Access is denied" in err_msg:
            print(f"  -> Access denied to '{port_name}'.")
            print("     Another application may be using this port (e.g., Arduino IDE, PuTTY,")
            print("     another terminal window, or a running background process).")
        print("\nScanning for active COM ports on your system:")
        list_com_ports()
        print(f"\nSuggestion: To specify a different port, use:")
        print(f"    python glider_reader/glider_port_reader.py --port <PORT_NAME>")
        sys.exit(1)
    except Exception as ex:
        print(f"\n[UNEXPECTED ERROR] Failed to initialize serial connection: {ex}")
        sys.exit(1)

    print(f"[CONNECTED] Successfully established connection on {port_name} at {baud_rate} baud.")
    print("[STATUS] Awaiting incoming glider telemetry... (Press Ctrl+C to stop cleanly)\n")

    # Initialize session state & asynchronous forwarder
    state = GliderState()
    forwarder = None
    if forward_enabled:
        forwarder = AsyncHttpForwarder(api_url, state)

    has_received_data = False
    last_idle_report = time.time()
    idle_interval = 5.0  # seconds between waiting heartbeat

    try:
        while True:
            # Read line up to newline delimiter (timeout applies)
            try:
                line = ser.readline()
            except serial.SerialException as read_err:
                print(f"\n[{get_timestamp()}] [CONNECTION LOST] Serial error while reading: {read_err}")
                print("  Device may have been unplugged or reset.")
                break

            if line and len(line) > 0:
                if not has_received_data:
                    has_received_data = True
                    print(f"[{get_timestamp()}] [DATA DETECTED] Initial bytes received from transmitter.")

                state.total_bytes += len(line)
                process_incoming_line(
                    line,
                    state,
                    forward=forward_enabled,
                    api_url=api_url,
                    glider_id=glider_id,
                    forwarder=forwarder,
                )
                last_idle_report = time.time()
            else:
                # No data received during this timeout interval
                now = time.time()
                if now - last_idle_report >= idle_interval:
                    last_idle_report = now
                    if not has_received_data:
                        print(
                            f"[{get_timestamp()}] [WAITING] Listening on {port_name} ({baud_rate} baud)... "
                            "No incoming bytes yet. Ensure glider is powered on and transmitting."
                        )
                    else:
                        forward_info = f", Forwarded: {state.forwarded_count}" if forward_enabled else ""
                        print(
                            f"[{get_timestamp()}] [LISTENING] Port {port_name} active. "
                            f"Frames: {state.telemetry_count}, Warnings: {state.warning_count}{forward_info} "
                            f"({state.total_bytes} bytes). Waiting for next transmission..."
                        )

    except KeyboardInterrupt:
        print(f"\n[{get_timestamp()}] [TERMINATING] Interrupted by user (Ctrl+C).")
    finally:
        if forwarder is not None:
            forwarder.stop()
        if ser is not None and ser.is_open:
            ser.close()
            print(f"[{get_timestamp()}] [CLOSED] Serial connection to {port_name} cleanly closed.")
        print("=" * 70)
        print("Reader stopped.")


if __name__ == "__main__":
    main()
