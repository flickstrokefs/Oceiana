import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X,
  Boxes,
  Navigation,
  Radio,
  MapPin,
  Globe2,
  RefreshCw,
  Layers,
} from 'lucide-react';
import { OceanState } from '../../ocean/OceanState';
import { fetchObservationProfile } from '../../services/observationService';
import type {
  ObservationProfilePayload,
  ObservationSourceCard,
  ProfileVariable,
  SelectedObservation,
} from '../../types/ocean';
import { DepthProfileChart } from './DepthProfileChart';

const VARIABLE_OPTIONS: { id: ProfileVariable; label: string }[] = [
  { id: 'temperature', label: 'Temperature (°C)' },
  { id: 'salinity', label: 'Salinity (PSU)' },
  { id: 'currentSpeed', label: 'Current Speed (m/s)' },
  { id: 'chlorophyll', label: 'Chlorophyll (mg/m³)' },
  { id: 'oxygen', label: 'Oxygen (ml/L)' },
];

const SERIES_COLORS = {
  model: '#20c997',
  glider: '#f0c000',
  argo: '#e85d4c',
} as const;

function formatCoord(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(lon).toFixed(2)}° ${ew}`;
}

function formatVal(
  value: number | null | undefined,
  digits = 1,
  unit = ''
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(digits)}${unit}`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * Webpage 2 — Observation Profile
 *
 * Large modal over the existing Cesium 3D Ocean (Webpage 1).
 * Opens when an Argo / Glider marker is selected via OceanState.
 *
 * INTEGRATION PLACEHOLDER — underwater 3D structure:
 * The Cesium globe remains mounted behind this modal. When the underwater
 * mesh / structure layer is ready, mount it in CesiumViewerContainer /
 * UnderwaterEnvironment — do NOT embed a mock image here. Show on Globe
 * already flies the live camera to the selected observation.
 */
export const ObservationModal: React.FC = () => {
  const [selectedObs, setSelectedObs] = useState<SelectedObservation | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [payload, setPayload] = useState<ObservationProfilePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variable, setVariable] = useState<ProfileVariable>('temperature');
  const [loadToken, setLoadToken] = useState(0);

  useEffect(() => {
    const unsub = OceanState.getInstance().subscribe((snapshot) => {
      setSelectedObs(snapshot.selectedObservation);
      setIsOpen(snapshot.observationModalOpen);
    });
    return unsub;
  }, []);

  const loadProfile = useCallback(async (obs: SelectedObservation) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchObservationProfile(obs);
      setPayload(data);
      setVariable((prev) =>
        data.availableVariables?.includes(prev)
          ? prev
          : data.availableVariables?.[0] ?? 'temperature'
      );
    } catch {
      setPayload(null);
      setError('Unable to load observation profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !selectedObs) {
      return;
    }
    void loadProfile(selectedObs);
  }, [isOpen, selectedObs, loadToken, loadProfile]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        OceanState.getInstance().selectObservation(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const close = () => {
    OceanState.getInstance().selectObservation(null);
  };

  const closeKeepSelection = () => {
    OceanState.getInstance().closeObservationModal();
  };

  const onBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      close();
    }
  };

  const onShowOnGlobe = () => {
    OceanState.getInstance().requestShowOnGlobe();
  };

  const onRetry = () => setLoadToken((t) => t + 1);

  const availableVars = useMemo(() => {
    if (!payload?.availableVariables?.length) return VARIABLE_OPTIONS;
    return VARIABLE_OPTIONS.filter((v) => payload.availableVariables.includes(v.id));
  }, [payload]);

  const chartSeries = useMemo(() => {
    if (!payload) return [];
    const out: {
      key: 'model' | 'glider' | 'argo';
      label: string;
      color: string;
      samples: typeof payload.profile.model;
    }[] = [
      {
        key: 'model',
        label: 'Model',
        color: SERIES_COLORS.model,
        samples: payload.profile.model,
      },
    ];
    if (payload.glider) {
      out.push({
        key: 'glider',
        label: 'Glider',
        color: SERIES_COLORS.glider,
        samples: payload.profile.glider,
      });
    }
    if (payload.argo) {
      out.push({
        key: 'argo',
        label: 'Argo',
        color: SERIES_COLORS.argo,
        samples: payload.profile.argo,
      });
    }
    return out;
  }, [payload]);

  const comparisonRows = useMemo(() => {
    if (!payload) return [];
    return [
      {
        label: 'Temperature',
        unit: '°C',
        model: payload.model.surfaceValues.temperature,
        glider: payload.glider?.surfaceValues.temperature ?? null,
        argo: payload.argo?.surfaceValues.temperature ?? null,
      },
      {
        label: 'Salinity',
        unit: ' PSU',
        model: payload.model.surfaceValues.salinity,
        glider: payload.glider?.surfaceValues.salinity ?? null,
        argo: payload.argo?.surfaceValues.salinity ?? null,
      },
      {
        label: 'Current Speed',
        unit: ' m/s',
        model: payload.model.surfaceValues.currentSpeed,
        glider: payload.glider?.surfaceValues.currentSpeed ?? null,
        argo: payload.argo?.surfaceValues.currentSpeed ?? null,
      },
      {
        label: 'Chlorophyll',
        unit: ' mg/m³',
        model: payload.model.surfaceValues.chlorophyll,
        glider: payload.glider?.surfaceValues.chlorophyll ?? null,
        argo: payload.argo?.surfaceValues.chlorophyll ?? null,
      },
    ];
  }, [payload]);

  const focusCoords = useMemo(() => {
    if (!selectedObs) return null;
    if (selectedObs.type === 'argo') {
      const a = selectedObs.data as { latitude: number; longitude: number };
      return { lat: a.latitude, lon: a.longitude };
    }
    const g = selectedObs.data as {
      waypoints: { latitude: number; longitude: number }[];
    };
    const latest = g.waypoints[g.waypoints.length - 1];
    return latest ? { lat: latest.latitude, lon: latest.longitude } : null;
  }, [selectedObs]);

  if (!isOpen || !selectedObs) return null;

  const selectedType = selectedObs.type;

  return (
    <div className="op-backdrop" onClick={onBackdrop} role="presentation">
      <div
        className="op-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="op-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="op-header">
          <div className="op-header-text">
            <h1 id="op-title" className="op-title">
              OBSERVATION PROFILE
            </h1>
            <p className="op-subtitle">MODEL VS GLIDER VS ARGO</p>
          </div>

          <div className="op-header-controls">
            {focusCoords && (
              <div className="op-coord-chip">
                <MapPin size={13} />
                <span>{formatCoord(focusCoords.lat, focusCoords.lon)}</span>
              </div>
            )}
            <button
              type="button"
              className="op-show-globe-btn"
              onClick={onShowOnGlobe}
              title="Fly Cesium camera to this observation"
            >
              <Globe2 size={14} />
              SHOW ON GLOBE
            </button>
            <button
              type="button"
              className="op-close-btn"
              onClick={close}
              aria-label="Close observation profile"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="op-body">
          {loading && (
            <div className="op-state-panel">
              <Layers className="op-spin" size={22} />
              <p>Loading Observation Profile...</p>
              <span className="op-state-hint">
                Cesium globe remains mounted behind this modal.
              </span>
            </div>
          )}

          {!loading && error && (
            <div className="op-state-panel">
              <p>{error}</p>
              <button type="button" className="op-retry-btn" onClick={onRetry}>
                <RefreshCw size={14} />
                RETRY
              </button>
            </div>
          )}

          {!loading && !error && payload && (
            <>
              {/* Three comparison cards */}
              <section className="op-cards">
                <SourceCard
                  card={payload.model}
                  icon={<Boxes size={16} />}
                  accent="model"
                  highlighted={false}
                />
                <SourceCard
                  card={payload.glider}
                  icon={<Navigation size={16} />}
                  accent="glider"
                  highlighted={selectedType === 'glider'}
                  emptyLabel="No nearby glider"
                />
                <SourceCard
                  card={payload.argo}
                  icon={<Radio size={16} />}
                  accent="argo"
                  highlighted={selectedType === 'argo'}
                  emptyLabel="No nearby Argo float"
                />
              </section>

              {/* Compact surface comparison */}
              <section className="op-compare-wrap">
                <h2 className="op-section-label">SURFACE COMPARISON</h2>
                <table className="op-compare-table">
                  <thead>
                    <tr>
                      <th>VARIABLE</th>
                      <th>MODEL DATA</th>
                      <th>GLIDER DATA</th>
                      <th>ARGO DATA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map((row) => (
                      <tr key={row.label}>
                        <td>{row.label}</td>
                        <td>{formatVal(row.model, 1, row.unit)}</td>
                        <td>{formatVal(row.glider, 1, row.unit)}</td>
                        <td>{formatVal(row.argo, 1, row.unit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              {/* Variable + chart + profile table */}
              <section className="op-analysis">
                <div className="op-variable-row">
                  <label htmlFor="op-variable" className="op-section-label">
                    VARIABLE
                  </label>
                  <select
                    id="op-variable"
                    className="op-variable-select"
                    value={variable}
                    onChange={(e) => setVariable(e.target.value as ProfileVariable)}
                  >
                    {availableVars.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="op-analysis-grid">
                  <div className="op-chart-panel">
                    <h3 className="op-panel-title">
                      {VARIABLE_OPTIONS.find((v) => v.id === variable)?.label ?? variable} vs Depth
                    </h3>
                    <DepthProfileChart variable={variable} series={chartSeries} />
                  </div>

                  <div className="op-table-panel">
                    <h3 className="op-panel-title">Profile Data (Selected Variable)</h3>
                    <div className="op-profile-scroll">
                      <table className="op-profile-table">
                        <thead>
                          <tr>
                            <th>Depth (m)</th>
                            <th>Model</th>
                            <th>Glider</th>
                            <th>Argo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payload.profile.depths.map((depth, idx) => (
                            <tr key={depth}>
                              <td>{depth}</td>
                              <td>
                                {formatVal(payload.profile.model[idx]?.[variable] ?? null, 2)}
                              </td>
                              <td>
                                {formatVal(payload.profile.glider[idx]?.[variable] ?? null, 2)}
                              </td>
                              <td>
                                {formatVal(payload.profile.argo[idx]?.[variable] ?? null, 2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        <footer className="op-footer">
          <span className="op-footer-note">
            {/* Keep selection when minimizing via Show on Globe; X clears fully */}
            Press ESC or click backdrop to close. Globe state is preserved.
          </span>
          <button type="button" className="op-minimize-link" onClick={closeKeepSelection}>
            Minimize (keep selection)
          </button>
        </footer>
      </div>
    </div>
  );
};

interface SourceCardProps {
  card: ObservationSourceCard | null;
  icon: React.ReactNode;
  accent: 'model' | 'glider' | 'argo';
  highlighted: boolean;
  emptyLabel?: string;
}

const SourceCard: React.FC<SourceCardProps> = ({
  card,
  icon,
  accent,
  highlighted,
  emptyLabel = 'Unavailable',
}) => {
  if (!card) {
    return (
      <article className={`op-card op-card-${accent} op-card-empty`}>
        <div className="op-card-head">
          {icon}
          <h3>{accent === 'model' ? 'MODEL DATA' : accent === 'glider' ? 'GLIDER DATA' : 'ARGO DATA'}</h3>
        </div>
        <p className="op-card-empty-text">{emptyLabel}</p>
      </article>
    );
  }

  return (
    <article
      className={`op-card op-card-${accent}${highlighted ? ' op-card-selected' : ''}`}
    >
      <div className="op-card-head">
        {icon}
        <h3>
          {accent === 'model' ? 'MODEL DATA' : accent === 'glider' ? 'GLIDER DATA' : 'ARGO DATA'}
        </h3>
        {highlighted && <span className="op-selected-badge">SELECTED</span>}
      </div>

      {/*
        INTEGRATION: Replace this silhouette block with real instrument imagery
        or a Cesium billboard thumbnail when assets are available.
        Do NOT use a fake 3D ocean screenshot here — the live globe stays behind the modal.
      */}
      <div className={`op-card-visual op-visual-${accent}`} aria-hidden="true">
        <div className="op-visual-silhouette" />
        <span className="op-visual-caption">{card.label}</span>
      </div>

      <dl className="op-card-meta">
        <div>
          <dt>ID</dt>
          <dd>{card.id}</dd>
        </div>
        <div>
          <dt>TIME</dt>
          <dd>{formatTime(card.timestamp)}</dd>
        </div>
        <div>
          <dt>LAT</dt>
          <dd>{card.latitude.toFixed(2)}°</dd>
        </div>
        <div>
          <dt>LON</dt>
          <dd>{card.longitude.toFixed(2)}°</dd>
        </div>
        <div>
          <dt>DEPTH</dt>
          <dd>{card.depth != null ? `${Math.round(card.depth)} m` : '—'}</dd>
        </div>
        {card.status && (
          <div>
            <dt>STATUS</dt>
            <dd>{card.status}</dd>
          </div>
        )}
      </dl>

      <ul className="op-card-metrics">
        <li>
          <span>Temperature</span>
          <strong>{formatVal(card.surfaceValues.temperature, 1, ' °C')}</strong>
        </li>
        <li>
          <span>Salinity</span>
          <strong>{formatVal(card.surfaceValues.salinity, 1, ' PSU')}</strong>
        </li>
        <li>
          <span>Current Speed</span>
          <strong>{formatVal(card.surfaceValues.currentSpeed, 2, ' m/s')}</strong>
        </li>
        <li>
          <span>Chlorophyll</span>
          <strong>{formatVal(card.surfaceValues.chlorophyll, 2, ' mg/m³')}</strong>
        </li>
      </ul>
    </article>
  );
};
