import React, { useEffect, useState, useRef } from 'react';
import {
  Radio,
  AlertTriangle,
  Clock,
  Compass,
  Activity,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  fetchLiveGliderStatus,
  type LiveGliderStatus,
  type LiveGliderObservation,
} from '../../services/liveGliderService';

interface LiveGliderSensorPanelProps {
  compact?: boolean;
}

export const LiveGliderSensorPanel: React.FC<LiveGliderSensorPanelProps> = ({ compact = false }) => {
  const [gliderStatus, setGliderStatus] = useState<LiveGliderStatus | null>(null);
  const [cachedObservation, setCachedObservation] = useState<LiveGliderObservation | null>(null);
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null);
  const [backendReachable, setBackendReachable] = useState<boolean>(true);
  const [expanded, setExpanded] = useState<boolean>(!compact);

  const lastFetchTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    let isMounted = true;

    const poll = async () => {
      const data = await fetchLiveGliderStatus();
      if (!isMounted) return;

      if (data) {
        setBackendReachable(true);
        setGliderStatus(data);
        if (data.latest) {
          setCachedObservation(data.latest);
        }
        if (data.seconds_since_last_update !== null && data.seconds_since_last_update !== undefined) {
          setSecondsAgo(Math.round(data.seconds_since_last_update));
          lastFetchTimeRef.current = Date.now();
        }
      } else {
        setBackendReachable(false);
      }
    };

    // Immediate initial poll
    void poll();

    // Poll every 1000ms for real-time telemetry updates
    const intervalId = window.setInterval(poll, 1000);

    // Independent 1s ticker for elapsed seconds
    const tickId = window.setInterval(() => {
      if (!isMounted) return;
      const elapsed = Math.round((Date.now() - lastFetchTimeRef.current) / 1000);
      setSecondsAgo(elapsed);
    }, 1000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.clearInterval(tickId);
    };
  }, []);

  const obs = gliderStatus?.latest || cachedObservation;
  const isOnline = gliderStatus?.status === 'ONLINE';
  const isStale = gliderStatus?.status === 'STALE';
  const fallbackActive = gliderStatus?.ds18b20_fallback_active || obs?.ds18b20_fallback_active || false;
  const portName = gliderStatus?.glider_id?.match(/COM\d+/i)?.[0]?.toUpperCase() 
    || obs?.source?.match(/com\d+/i)?.[0]?.toUpperCase() 
    || 'COM5';

  const getStatusBadge = () => {
    if (!backendReachable) {
      return (
        <span className="live-status-pill pill-error">
          <span className="live-dot dot-red" />
          BACKEND OFFLINE
        </span>
      );
    }
    if (isOnline) {
      return (
        <span className="live-status-pill pill-online animate-pulse-subtle">
          <span className="live-dot dot-green animate-ping-dot" />
          LIVE {portName}
        </span>
      );
    }
    if (isStale) {
      return (
        <span className="live-status-pill pill-stale">
          <span className="live-dot dot-yellow" />
          STALE DATA
        </span>
      );
    }
    return (
      <span className="live-status-pill pill-idle">
        <span className="live-dot dot-gray" />
        AWAITING TELEMETRY
      </span>
    );
  };

  return (
    <div className={`live-glider-card ${isOnline ? 'border-live' : ''} ${isStale ? 'border-stale' : ''}`}>
      {/* Top Header */}
      <div
        className="live-glider-header"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
      >
        <div className="live-glider-title-group">
          <Radio size={14} className={isOnline ? 'icon-cyan animate-pulse' : 'icon-dim'} />
          <span className="live-glider-name">
            {gliderStatus?.glider_id || `GLIDER-PHYSICAL-${portName}`}
          </span>
          <span className="live-glider-port-tag">{portName}</span>
          {obs?.depth_cm !== null && obs?.depth_cm !== undefined && (
            <span className="live-glider-depth-tag font-mono">
              {Number(obs.depth_cm).toFixed(1)} cm
            </span>
          )}
        </div>

        <div className="live-glider-actions">
          {getStatusBadge()}
          <button
            type="button"
            className="live-collapse-btn"
            aria-label={expanded ? 'Collapse sensor card' : 'Expand sensor card'}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Expanded Sensor Telemetry Content */}
      {expanded && (
        <div className="live-glider-body">
          {/* Active Warnings Banner */}
          {fallbackActive && (
            <div className="live-warning-banner">
              <AlertTriangle size={13} className="warning-icon" />
              <div className="warning-text">
                <strong>HARDWARE WARNING:</strong> DS18B20 sensor not found. Device reports fallback 25°C.
                <div className="warning-sub">Temperature marked as UNVERIFIED. Not scientifically validated.</div>
              </div>
            </div>
          )}

          {/* Stale Warning Banner if data stopped arriving */}
          {isStale && (
            <div className="live-stale-banner">
              <Clock size={12} />
              <span>
                No fresh packets for {secondsAgo ? `${secondsAgo}s` : 'a while'}. Displaying last retained reading.
              </span>
            </div>
          )}

          {!obs ? (
            <div className="live-awaiting-state">
              <Activity size={18} className="animate-spin-slow icon-cyan" />
              <span>Awaiting telemetry from port reader...</span>
              <span className="sub-hint">Run: .\glider_reader\.venv\Scripts\python.exe glider_reader\glider_port_reader.py --forward</span>
            </div>
          ) : (
            <div className="live-metrics-grid">
              {/* Depth Reading */}
              <div className="live-metric-box metric-depth">
                <div className="metric-box-label">
                  <Layers size={11} />
                  <span>REPORTED DEPTH</span>
                </div>
                <div className="metric-box-val font-mono">
                  {obs.depth_cm !== null && obs.depth_cm !== undefined ? (
                    <>
                      {obs.depth_cm.toFixed(1)} <span className="metric-unit">cm</span>
                    </>
                  ) : (
                    <span className="val-na">N/A</span>
                  )}
                </div>
                <div className="metric-box-status text-cyan">In-situ pressure sounding</div>
              </div>

              {/* Temperature Reading */}
              <div className={`live-metric-box metric-temp ${fallbackActive ? 'metric-box-unverified' : ''}`}>
                <div className="metric-box-label">
                  <span>WATER TEMPERATURE</span>
                  {fallbackActive && (
                    <span className="unverified-tag">UNVERIFIED</span>
                  )}
                </div>
                <div className="metric-box-val font-mono">
                  {obs.temp_c !== null && obs.temp_c !== undefined ? (
                    <>
                      {obs.temp_c.toFixed(2)} <span className="metric-unit">°C</span>
                    </>
                  ) : (
                    <span className="val-na">N/A</span>
                  )}
                </div>
                <div className="metric-box-status">
                  {fallbackActive ? (
                    <span className="status-warn">DS18B20 fallback active (unverified)</span>
                  ) : (
                    <span className="status-ok">Reported (unverified calibration)</span>
                  )}
                </div>
              </div>

              {/* Turbidity Reading */}
              <div className="live-metric-box">
                <div className="metric-box-label">
                  <span>TURBIDITY</span>
                </div>
                <div className="metric-box-val font-mono">
                  {obs.ntu !== null && obs.ntu !== undefined ? (
                    <>
                      {obs.ntu} <span className="metric-unit">NTU</span>
                    </>
                  ) : (
                    <span className="val-na">N/A</span>
                  )}
                  {obs.turb_v !== null && obs.turb_v !== undefined && (
                    <span className="metric-sub-val font-mono">({obs.turb_v.toFixed(3)}V)</span>
                  )}
                </div>
                <div className="metric-box-status text-muted">Unverified calibration</div>
              </div>

              {/* TDS Reading */}
              <div className="live-metric-box">
                <div className="metric-box-label">
                  <span>TOTAL DISSOLVED SOLIDS</span>
                </div>
                <div className="metric-box-val font-mono">
                  {obs.tds_ppm !== null && obs.tds_ppm !== undefined ? (
                    <>
                      {obs.tds_ppm} <span className="metric-unit">ppm</span>
                    </>
                  ) : (
                    <span className="val-na">N/A</span>
                  )}
                  {obs.tds_v !== null && obs.tds_v !== undefined && (
                    <span className="metric-sub-val font-mono">({obs.tds_v.toFixed(3)}V)</span>
                  )}
                </div>
                <div className="metric-box-status text-muted">Unverified calibration</div>
              </div>

              {/* GPS Status Row */}
              <div className="live-meta-row">
                <div className="meta-item">
                  <Compass size={11} className="meta-icon" />
                  <span className="meta-label">GEOGRAPHIC POSITION:</span>
                  <span className="meta-val font-mono">
                    {obs.latitude !== null && obs.latitude !== undefined && obs.longitude !== null && obs.longitude !== undefined ? (
                      `${obs.latitude.toFixed(4)}°, ${obs.longitude.toFixed(4)}°`
                    ) : (
                      <span className="meta-unavail">No hardware GPS fix (depth-only track)</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Telemetry Timestamp Footer */}
              <div className="live-footer-row">
                <div className="footer-ts">
                  <Clock size={10} />
                  <span>Observed: {obs.timestamp}</span>
                </div>
                <div className="footer-received">
                  {secondsAgo !== null && (
                    <span className={secondsAgo > 15 ? 'text-warn' : 'text-cyan'}>
                      {secondsAgo === 0 ? 'Updated just now' : `Updated ${secondsAgo}s ago`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
