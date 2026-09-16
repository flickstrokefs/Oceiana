import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronDown,
} from 'lucide-react';

interface OceanBottomBarProps {
  variableName?: string;
}

export const OceanBottomBar: React.FC<OceanBottomBarProps> = ({
  variableName = 'Temperature (°C)',
}) => {
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
        <span className="colorbar-title">{variableName}</span>
        <div className="colorbar-scale-container">
          <div className="colorbar-ticks">
            <span>30</span>
            <span>20</span>
            <span>10</span>
            <span>0</span>
          </div>
          <div className="colorbar-bar turbo-vertical" />
        </div>
      </div>

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
