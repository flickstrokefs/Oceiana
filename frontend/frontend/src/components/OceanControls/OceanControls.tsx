import React, { useEffect, useState } from 'react';
import { OceanState } from '../../ocean/OceanState';
import type { OceanParameters } from '../../types/ocean';
import { Thermometer, Droplets, Wind, Waves, Activity, Sparkles } from 'lucide-react';

export const OceanControls: React.FC = () => {
  const [params, setParams] = useState<OceanParameters>({
    temperature: 28.0,
    salinity: 35.5,
    currentSpeed: 1.2,
    depth: 0,
    chlorophyll: 1.2,
  });

  useEffect(() => {
    const oceanState = OceanState.getInstance();
    const unsub = oceanState.subscribe((snapshot) => {
      setParams(snapshot.parameters);
    });
    return unsub;
  }, []);

  const handleChange = (key: keyof OceanParameters, val: number) => {
    const newParams = { ...params, [key]: val };
    setParams(newParams);
    OceanState.getInstance().updateParameters({ [key]: val });
  };

  const applyPreset = (
    preset: Partial<OceanParameters>,
    targetCoord?: { lat: number; lon: number; alt?: number }
  ) => {
    OceanState.getInstance().updateParameters(preset);
    if (targetCoord) {
      OceanState.getInstance().requestFlyToLocation(targetCoord.lat, targetCoord.lon, targetCoord.alt);
    }
  };

  return (
    <aside className="ocean-panel float-panel-right">
      <div className="panel-header">
        <div className="panel-title-group">
          <Activity className="icon-cyan animate-pulse-slow" size={18} />
          <h2 className="panel-title">OCEAN PARAMETERS</h2>
        </div>
        <span className="badge-live">STATE DRIVER</span>
      </div>

      <div className="control-group-list">
        {/* Temperature */}
        <div className="control-item">
          <div className="control-header">
            <label className="control-label">
              <Thermometer size={14} className="icon-amber" />
              TEMPERATURE
            </label>
            <div className="unit-value">
              <input
                type="number"
                step="0.1"
                min="0"
                max="35"
                value={params.temperature}
                onChange={(e) => handleChange('temperature', parseFloat(e.target.value) || 0)}
                className="num-input"
              />
              <span className="unit-label">°C</span>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="35"
            step="0.1"
            value={params.temperature}
            onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
            className="slider-range slider-temp"
          />
        </div>

        {/* Salinity */}
        <div className="control-item">
          <div className="control-header">
            <label className="control-label">
              <Droplets size={14} className="icon-blue" />
              SALINITY
            </label>
            <div className="unit-value">
              <input
                type="number"
                step="0.1"
                min="10"
                max="40"
                value={params.salinity}
                onChange={(e) => handleChange('salinity', parseFloat(e.target.value) || 10)}
                className="num-input"
              />
              <span className="unit-label">PSU</span>
            </div>
          </div>
          <input
            type="range"
            min="10"
            max="40"
            step="0.1"
            value={params.salinity}
            onChange={(e) => handleChange('salinity', parseFloat(e.target.value))}
            className="slider-range slider-sal"
          />
        </div>

        {/* Current Speed */}
        <div className="control-item">
          <div className="control-header">
            <label className="control-label">
              <Wind size={14} className="icon-cyan" />
              CURRENT SPEED
            </label>
            <div className="unit-value">
              <input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={params.currentSpeed}
                onChange={(e) => handleChange('currentSpeed', parseFloat(e.target.value) || 0)}
                className="num-input"
              />
              <span className="unit-label">m/s</span>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="5"
            step="0.1"
            value={params.currentSpeed}
            onChange={(e) => handleChange('currentSpeed', parseFloat(e.target.value))}
            className="slider-range slider-current"
          />
        </div>

        {/* Depth */}
        <div className="control-item">
          <div className="control-header">
            <label className="control-label">
              <Waves size={14} className="icon-teal" />
              DEPTH
            </label>
            <div className="unit-value">
              <input
                type="number"
                step="10"
                min="0"
                max="5000"
                value={params.depth}
                onChange={(e) => handleChange('depth', parseInt(e.target.value, 10) || 0)}
                className="num-input"
              />
              <span className="unit-label">m</span>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="5000"
            step="10"
            value={params.depth}
            onChange={(e) => handleChange('depth', parseInt(e.target.value, 10))}
            className="slider-range slider-depth"
          />
        </div>

        {/* Chlorophyll */}
        <div className="control-item">
          <div className="control-header">
            <label className="control-label">
              <Sparkles size={14} className="icon-green" />
              CHLOROPHYLL
            </label>
            <div className="unit-value">
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={params.chlorophyll}
                onChange={(e) => handleChange('chlorophyll', parseFloat(e.target.value) || 0)}
                className="num-input"
              />
              <span className="unit-label">mg/m³</span>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={params.chlorophyll}
            onChange={(e) => handleChange('chlorophyll', parseFloat(e.target.value))}
            className="slider-range slider-chl"
          />
        </div>
      </div>

      {/* Hydrodynamic Presets */}
      <div className="preset-section">
        <span className="preset-title">OCEAN STATE PRESETS</span>
        <div className="preset-grid">
          <button
            onClick={() =>
              applyPreset(
                {
                  temperature: 30.5,
                  salinity: 36.8,
                  currentSpeed: 0.8,
                  depth: 0,
                  chlorophyll: 0.4,
                },
                { lat: 16.0, lon: 65.0, alt: 1800000 }
              )
            }
            className="preset-btn"
          >
            Arabian Warm Pool
          </button>
          <button
            onClick={() =>
              applyPreset(
                {
                  temperature: 28.5,
                  salinity: 32.8,
                  currentSpeed: 1.2,
                  depth: 10,
                  chlorophyll: 2.1,
                },
                { lat: 15.0, lon: 88.0, alt: 1800000 }
              )
            }
            className="preset-btn"
          >
            Bay of Bengal Plume
          </button>
          <button
            onClick={() =>
              applyPreset(
                {
                  temperature: 1.8,
                  salinity: 34.0,
                  currentSpeed: 1.8,
                  depth: 50,
                  chlorophyll: 1.4,
                },
                { lat: -58.0, lon: 70.0, alt: 3200000 }
              )
            }
            className="preset-btn"
          >
            Southern Ocean Front
          </button>
          <button
            onClick={() =>
              applyPreset(
                {
                  temperature: 2.8,
                  salinity: 34.7,
                  currentSpeed: 0.3,
                  depth: 2200,
                  chlorophyll: 0.1,
                },
                { lat: 14.0, lon: 75.0, alt: 950000 }
              )
            }
            className="preset-btn"
          >
            Abyssal Stratum
          </button>
        </div>
      </div>
    </aside>
  );
};
