import React, { useState, useEffect } from 'react';
import { OceanState } from '../../ocean/OceanState';
import type { OceanVariable } from '../../types/ocean';
import { Plus, Sliders } from 'lucide-react';

export const VisualizationControlsPanel: React.FC = () => {
  const [variable, setVariable] = useState<OceanVariable>('temperature');
  const [isosurfaceEnabled, setIsosurfaceEnabled] = useState(true);
  const [isosurfaceVar, setIsosurfaceVar] = useState('temperature');
  const [isosurfaceVal, setIsosurfaceVal] = useState(20);
  const [palette, setPalette] = useState('Turbo');
  const [minVal, setMinVal] = useState(0);
  const [maxVal, setMaxVal] = useState(30);
  const [scaleType, setScaleType] = useState<'linear' | 'log'>('linear');
  const [modelOpacity, setModelOpacity] = useState(70);
  const [gliderOpacity, setGliderOpacity] = useState(100);
  const [argoOpacity, setArgoOpacity] = useState(80);
  const [vertExaggeration, setVertExaggeration] = useState(5);

  useEffect(() => {
    const unsub = OceanState.getInstance().subscribe((snapshot) => {
      setVariable(snapshot.activeVariable);
    });
    return unsub;
  }, []);

  const handleVarChange = (v: OceanVariable) => {
    setVariable(v);
    OceanState.getInstance().setActiveVariable(v);
  };

  return (
    <aside className="ariel-panel panel-left-viz">
      <div className="panel-title-bar">
        <h2 className="panel-heading">1. Visualization Controls</h2>
        <Sliders size={14} className="panel-head-icon" />
      </div>

      <div className="panel-content-scroll">
        {/* Variable Selector */}
        <div className="viz-control-section">
          <label className="viz-label" htmlFor="viz-var-select">
            Variable
          </label>
          <div className="viz-var-row">
            <select
              id="viz-var-select"
              className="ariel-select select-flex"
              value={variable}
              onChange={(e) => handleVarChange(e.target.value as OceanVariable)}
            >
              <option value="temperature">Temperature (°C)</option>
              <option value="salinity">Salinity (PSU)</option>
              <option value="current">Current Speed (m/s)</option>
              <option value="chlorophyll">Chlorophyll (mg/m³)</option>
            </select>
            <button
              type="button"
              className="ariel-btn-teal btn-compact"
              onClick={() => alert('Variable added to visualization stack.')}
            >
              <Plus size={12} /> Add Variable
            </button>
          </div>
        </div>

        {/* Isosurface Section */}
        <div className="viz-control-section">
          <div className="viz-toggle-row">
            <span className="viz-label">Isosurface</span>
            <label className="ariel-switch">
              <input
                type="checkbox"
                checked={isosurfaceEnabled}
                onChange={(e) => setIsosurfaceEnabled(e.target.checked)}
              />
              <span className="switch-slider round" />
            </label>
          </div>
          {isosurfaceEnabled && (
            <div className="isosurface-inputs-row">
              <div className="input-col">
                <span className="sub-label">Variable</span>
                <select
                  className="ariel-select select-sm"
                  value={isosurfaceVar}
                  onChange={(e) => setIsosurfaceVar(e.target.value)}
                >
                  <option value="temperature">Temperature (°C)</option>
                  <option value="salinity">Salinity (PSU)</option>
                  <option value="density">Density (kg/m³)</option>
                </select>
              </div>
              <div className="input-col input-col-val">
                <span className="sub-label">Value</span>
                <div className="unit-input-wrap">
                  <input
                    type="number"
                    className="ariel-input input-sm"
                    value={isosurfaceVal}
                    onChange={(e) => setIsosurfaceVal(parseFloat(e.target.value) || 0)}
                  />
                  <span className="input-unit">°C</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Colorbar Section */}
        <div className="viz-control-section">
          <span className="viz-label">Colorbar</span>
          <div className="colorbar-palette-row">
            <span className="sub-label">Palette</span>
            <select
              className="ariel-select select-sm"
              value={palette}
              onChange={(e) => setPalette(e.target.value)}
            >
              <option value="Turbo">Turbo</option>
              <option value="Viridis">Viridis</option>
              <option value="Plasma">Plasma</option>
              <option value="Coolwarm">Coolwarm</option>
              <option value="Jet">Jet</option>
            </select>
          </div>

          <div className="colorbar-preview turbo-gradient" />

          <div className="colorbar-limits-row">
            <div className="limit-col">
              <span className="sub-label">Min</span>
              <input
                type="number"
                className="ariel-input input-sm"
                value={minVal}
                onChange={(e) => setMinVal(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="limit-col">
              <span className="sub-label">Max</span>
              <input
                type="number"
                className="ariel-input input-sm"
                value={maxVal}
                onChange={(e) => setMaxVal(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="scale-radio-group">
            <span className="sub-label">Scale</span>
            <label className="radio-label">
              <input
                type="radio"
                name="scaleType"
                checked={scaleType === 'linear'}
                onChange={() => setScaleType('linear')}
              />
              <span>Linear</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="scaleType"
                checked={scaleType === 'log'}
                onChange={() => setScaleType('log')}
              />
              <span>Logarithmic</span>
            </label>
          </div>
        </div>

        {/* Layer Opacity */}
        <div className="viz-control-section">
          <span className="viz-label">Layer Opacity</span>
          <div className="opacity-slider-row">
            <span className="slider-target-label">Model</span>
            <input
              type="range"
              min="0"
              max="100"
              value={modelOpacity}
              onChange={(e) => setModelOpacity(parseInt(e.target.value, 10))}
              className="ariel-slider"
            />
            <span className="slider-pct">{modelOpacity}%</span>
          </div>

          <div className="opacity-slider-row">
            <span className="slider-target-label">Glider</span>
            <input
              type="range"
              min="0"
              max="100"
              value={gliderOpacity}
              onChange={(e) => setGliderOpacity(parseInt(e.target.value, 10))}
              className="ariel-slider"
            />
            <span className="slider-pct">{gliderOpacity}%</span>
          </div>

          <div className="opacity-slider-row">
            <span className="slider-target-label">Argo</span>
            <input
              type="range"
              min="0"
              max="100"
              value={argoOpacity}
              onChange={(e) => setArgoOpacity(parseInt(e.target.value, 10))}
              className="ariel-slider"
            />
            <span className="slider-pct">{argoOpacity}%</span>
          </div>
        </div>

        {/* Vertical Exaggeration */}
        <div className="viz-control-section">
          <div className="vert-exag-head">
            <span className="viz-label">Vertical Exaggeration</span>
            <span className="vert-exag-val">{vertExaggeration}x</span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            value={vertExaggeration}
            onChange={(e) => setVertExaggeration(parseInt(e.target.value, 10))}
            className="ariel-slider"
          />
          <div className="slider-ticks-row">
            <span>1x</span>
            <span>5x</span>
            <span>10x</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
