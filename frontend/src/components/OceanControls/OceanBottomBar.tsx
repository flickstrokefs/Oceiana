import React, { useEffect, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, ChevronDown } from 'lucide-react';
import { OceanState } from '../../ocean/OceanState';
import { PALETTE_STOPS } from '../../ocean/color/colorRangeUtils';
import { currentSpeedFromSample } from '../../services/oceanService';
import type { OceanStateSnapshot } from '../../types/ocean';

const units: Record<string, string> = { temperature: '°C', salinity: 'PSU', current: 'm/s', chlorophyll: 'mg/m³' };
const number = (value: number | null | undefined, unit = '') => value == null || !Number.isFinite(value) ? 'N/A' : `${value.toFixed(2)}${unit ? ` ${unit}` : ''}`;
const coord = (value: number, axis: 'lat' | 'lon') => `${Math.abs(value).toFixed(3)}°${axis === 'lat' ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W')}`;

export const OceanBottomBar: React.FC<{ variableName?: string }> = () => {
  const state = OceanState.getInstance();
  const [snapshot, setSnapshot] = useState<OceanStateSnapshot>(() => state.getSnapshot());
  const [isPlaying, setIsPlaying] = useState(false);
  const [showCrossSection, setShowCrossSection] = useState(false);
  useEffect(() => state.subscribe(setSnapshot), [state]);
  const points = state.getTimeseriesPoints();
  const index = state.getTimeseriesIndex();
  useEffect(() => {
    if (!isPlaying || points.length < 2) return;
    const timer = window.setInterval(() => state.setTimeseriesIndex((state.getTimeseriesIndex() + 1) % points.length), 1000);
    return () => window.clearInterval(timer);
  }, [isPlaying, points.length, state]);
  const sample = state.getPointSample();
  const unit = units[snapshot.activeVariable] || '';
  const value = snapshot.activeVariable === 'temperature' ? sample?.temperature : snapshot.activeVariable === 'salinity' ? sample?.salinity : snapshot.activeVariable === 'chlorophyll' ? sample?.chlorophyll : currentSpeedFromSample(sample);
  const activeTimestamp = points[index]?.timestamp;

  return <>
    <div className="telemetry-hud-chip" aria-label="Viewport Spatial Readout">
      {snapshot.queryPoint && sample ? <><span className="hud-metric"><span className="hud-label">Lat:</span> <span className="mono-val">{coord(sample.latitude, 'lat')}</span></span><span className="hud-divider">|</span><span className="hud-metric"><span className="hud-label">Lon:</span> <span className="mono-val">{coord(sample.longitude, 'lon')}</span></span><span className="hud-divider">|</span><span className="hud-metric"><span className="hud-label">Depth:</span> <span className="mono-val">{number(sample.depth, 'm')}</span></span><span className="hud-divider">|</span><span className="hud-metric"><span className="hud-label">Value:</span> <span className="mono-val">{number(value, unit)}</span></span></> : <span className="hud-metric"><span className="hud-label">Point readout:</span> <span className="mono-val">{snapshot.profileStatus === 'loading' ? 'Loading…' : snapshot.profileStatus === 'error' ? 'Unavailable' : 'Select a point on the globe'}</span></span>}
      <span className="hud-divider">|</span><button type="button" className="hud-cross-btn" onClick={() => setShowCrossSection(!showCrossSection)} title="Cross-section data is not available from the current API"><span>{showCrossSection ? 'Cross-section unavailable' : 'Show Cross-section'}</span><ChevronDown size={11} /></button>
    </div>
    <div className="ocean-vertical-colorbar" aria-label="Variable Palette Legend"><span className="colorbar-title">{snapshot.activeVariable} ({unit})</span><div className="colorbar-scale-container"><div className="colorbar-ticks"><span>{snapshot.visualization.maxVal.toFixed(2)}</span><span>{((snapshot.visualization.minVal + snapshot.visualization.maxVal) / 2).toFixed(2)}</span><span>{snapshot.visualization.minVal.toFixed(2)}</span></div><div className="colorbar-bar" style={{ background: `linear-gradient(to top, ${PALETTE_STOPS[snapshot.visualization.palette].join(', ')})` }} /></div></div>
    <div className="ocean-timeline-dock" aria-label="Temporal Playback Controller">
      <div className="timeline-ctrls"><button type="button" className="timeline-btn" onClick={() => state.setTimeseriesIndex(index - 1)} disabled={!points.length} aria-label="Step backward"><SkipBack size={12} /></button><button type="button" className="timeline-btn timeline-play-btn" onClick={() => setIsPlaying(!isPlaying)} disabled={points.length < 2} aria-label={isPlaying ? 'Pause' : 'Play'}>{isPlaying ? <Pause size={13} /> : <Play size={13} />}</button><button type="button" className="timeline-btn" onClick={() => state.setTimeseriesIndex(index + 1)} disabled={!points.length} aria-label="Step forward"><SkipForward size={12} /></button></div>
      <div className="timeline-track-wrap"><input type="range" min="0" max={Math.max(0, points.length - 1)} value={Math.min(index, Math.max(0, points.length - 1))} onChange={e => state.setTimeseriesIndex(Number(e.target.value))} className="timeline-range" aria-label="Time timeline position" disabled={!points.length} /><div className="timeline-labels-row">{points.map((point, i) => <span key={point.timestamp} className={`timeline-date-label ${index === i ? 'timeline-active-date' : ''}`} onClick={() => state.setTimeseriesIndex(i)}>{new Date(point.timestamp).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}</span>)}</div></div>
      <div className="timeline-meta-group"><div className="timeline-timestamp-chip"><span className="live-pulse" /><span className="timestamp-text">{snapshot.timeseriesStatus === 'loading' ? 'Loading timeline…' : snapshot.timeseriesStatus === 'error' ? `Timeline unavailable: ${snapshot.timeseriesError}` : activeTimestamp ? new Date(activeTimestamp).toUTCString() : 'Select a point to load timeline'}</span></div></div>
    </div>
  </>;
};
