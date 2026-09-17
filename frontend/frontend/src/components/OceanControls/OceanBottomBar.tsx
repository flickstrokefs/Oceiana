import React, { useState, useEffect, useMemo } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronDown,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { OceanState } from '../../ocean/OceanState';
import type { OceanVariable } from '../../types/ocean';
import type { ColorRange } from '../../ocean/color/colorTypes';
import { normalizeHex, sortRanges } from '../../ocean/color/colorRangeUtils';
import { ColorRangeEditor } from '../../ocean/color/ColorRangeEditor';

const VARIABLE_LABELS: Record<OceanVariable, string> = {
  temperature: 'Temperature (°C)',
  salinity: 'Salinity (PSU)',
  current: 'Current Speed (m/s)',
  chlorophyll: 'Chlorophyll (mg/m³)',
  oxygen: 'Dissolved Oxygen (ml/L)',
};

interface OceanBottomBarProps {
  variableName?: string;
}

export const OceanBottomBar: React.FC<OceanBottomBarProps> = ({
  variableName,
}) => {
  const state = OceanState.getInstance();
  const [activeVar, setActiveVar] = useState<OceanVariable>(() => state.getSnapshot().activeVariable);
  const [ranges, setRanges] = useState<ColorRange[]>(() => state.getColorRanges());
  const [showColorEditor, setShowColorEditor] = useState(false);

  useEffect(() => {
    return state.subscribe((snapshot) => {
      setActiveVar(snapshot.activeVariable);
      setRanges(snapshot.colorRanges[snapshot.activeVariable] || []);
    });
  }, [state]);

  const sortedRanges = useMemo(() => sortRanges(ranges), [ranges]);
  const currentTitle = variableName || VARIABLE_LABELS[activeVar] || activeVar;

  const verticalGradient = useMemo(() => {
    if (!sortedRanges.length) return '';
    const start = sortedRanges[0].min;
    const end = sortedRanges[sortedRanges.length - 1].max;
    const span = Math.max(end - start, Number.EPSILON);
    const stops: string[] = [];
    sortedRanges.forEach((r) => {
      const p = ((r.min - start) / span) * 100;
      stops.push(`${normalizeHex(r.color)} ${p.toFixed(2)}%`);
    });
    const last = sortedRanges[sortedRanges.length - 1];
    stops.push(`${normalizeHex(last.color)} 100%`);
    return `linear-gradient(to top, ${stops.join(', ')})`;
  }, [sortedRanges]);

  const verticalTicks = useMemo(() => {
    if (!sortedRanges.length) return ['--', '--', '--'];
    const ticks: number[] = [];
    ticks.push(sortedRanges[sortedRanges.length - 1].max);
    for (let i = sortedRanges.length - 1; i >= 0; i--) {
      ticks.push(sortedRanges[i].min);
    }
    // De-duplicate ticks while preserving top-to-bottom order
    return Array.from(new Set(ticks)).slice(0, 5);
  }, [sortedRanges]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [timelineIndex, setTimelineIndex] = useState(3); // 12 Sep (0-4)
  const [timeStep, setTimeStep] = useState('+1 day');
  const [showCrossSection, setShowCrossSection] = useState(false);

  const dates = [
    { label: '09 Sep', date: '09 Sep 2024' },
    { label: '10 Sep', date: '10 Sep 2024' },
    { label: '11 Sep', date: '11 Sep 2024' },
    { label: '12 Sep', date: '12 Sep 2024' },
    { label: '13 Sep', date: '13 Sep 2024' },
  ];

  return (
    <>
      {/* Viewport Status / Coordinate Readout (Section 18) */}
      <div className="telemetry-hud-chip" aria-label="Viewport Spatial Readout">
        <span className="hud-metric">
          <span className="hud-label">Lat:</span>{' '}
          <span className="mono-val">15.4°N</span>
        </span>
        <span className="hud-divider">|</span>
        <span className="hud-metric">
          <span className="hud-label">Lon:</span>{' '}
          <span className="mono-val">73.2°E</span>
        </span>
        <span className="hud-divider">|</span>
        <span className="hud-metric">
          <span className="hud-label">Depth:</span>{' '}
          <span className="mono-val">500 m</span>
        </span>
        <span className="hud-divider">|</span>
        <span className="hud-metric">
          <span className="hud-label">Value:</span>{' '}
          <span className="mono-val">18.1°C</span>
        </span>
        <span className="hud-divider">|</span>
        <button
          type="button"
          className="hud-cross-btn"
          onClick={() => setShowCrossSection(!showCrossSection)}
          title="Toggle vertical cross-section projection"
        >
          <span>Show Cross-section</span>
          <ChevronDown size={11} />
        </button>
      </div>

      {/* Scientific Colorbar on bottom-right (Section 15) */}
      <div className="ocean-vertical-colorbar" aria-label="Variable Palette Legend">
        <div className="colorbar-top-action">
          <button
            type="button"
            className="colorbar-config-trigger"
            onClick={() => setShowColorEditor((v) => !v)}
            title={showColorEditor ? 'Close Range Editor' : 'Configure Color Ranges'}
            aria-label="Configure Color Ranges"
          >
            {showColorEditor ? <X size={11} /> : <SlidersHorizontal size={11} />}
          </button>
        </div>
        <span className="colorbar-title">{currentTitle}</span>
        <div className="colorbar-scale-container">
          <div className="colorbar-ticks">
            {verticalTicks.map((t, idx) => (
              <span key={`tick-${idx}`}>{t}</span>
            ))}
          </div>
          <div
            className="colorbar-bar"
            style={{
              background: verticalGradient || 'linear-gradient(to top, #2d5e94, #38bdf8)',
            }}
          />
        </div>
      </div>

      {showColorEditor && (
        <div className="ocean-surface-colorbar-popover">
          <ColorRangeEditor
            variable={activeVar}
            isOpen={showColorEditor}
            onClose={() => setShowColorEditor(false)}
            title={currentTitle}
          />
        </div>
      )}

      {/* Bottom Timeline Dock (Section 17) */}
      <div className="ocean-timeline-dock" aria-label="Temporal Playback Controller">
        {/* Playback controls */}
        <div className="timeline-ctrls">
          <button
            type="button"
            className="timeline-btn"
            title="Step backward (-1 day)"
            onClick={() => setTimelineIndex((prev) => Math.max(0, prev - 1))}
            aria-label="Step backward"
          >
            <SkipBack size={12} />
          </button>
          <button
            type="button"
            className="timeline-btn timeline-play-btn"
            title={isPlaying ? 'Pause simulation' : 'Play simulation'}
            onClick={() => setIsPlaying(!isPlaying)}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <button
            type="button"
            className="timeline-btn"
            title="Step forward (+1 day)"
            onClick={() =>
              setTimelineIndex((prev) => Math.min(dates.length - 1, prev + 1))
            }
            aria-label="Step forward"
          >
            <SkipForward size={12} />
          </button>
        </div>

        {/* Timeline Slider Track */}
        <div className="timeline-track-wrap">
          <input
            type="range"
            min="0"
            max={dates.length - 1}
            value={timelineIndex}
            onChange={(e) => setTimelineIndex(parseInt(e.target.value, 10))}
            className="timeline-range"
            aria-label="Time timeline position"
          />
          <div className="timeline-labels-row">
            {dates.map((d, i) => (
              <span
                key={d.label}
                className={`timeline-date-label ${
                  timelineIndex === i ? 'timeline-active-date' : ''
                }`}
                onClick={() => setTimelineIndex(i)}
              >
                {d.label}
              </span>
            ))}
          </div>
        </div>

        {/* Current Time Display & Step Select */}
        <div className="timeline-meta-group">
          <div className="timeline-timestamp-chip">
            <span className="live-pulse" />
            <span className="timestamp-text">
              {dates[timelineIndex].date} 14:30 UTC
            </span>
          </div>

          <div className="timeline-step-wrap">
            <select
              className="ariel-select select-xs"
              value={timeStep}
              onChange={(e) => setTimeStep(e.target.value)}
              aria-label="Playback step resolution"
            >
              <option value="+1 hour">+1 hour</option>
              <option value="+6 hours">+6 hours</option>
              <option value="+1 day">+1 day</option>
              <option value="+7 days">+7 days</option>
            </select>
          </div>
        </div>
      </div>
    </>
  );
};
