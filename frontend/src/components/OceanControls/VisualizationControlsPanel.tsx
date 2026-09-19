import React, { useState, useEffect } from 'react';
import { OceanState } from '../../ocean/OceanState';
import type { OceanVariable } from '../../types/ocean';
import { PALETTE_STOPS } from '../../ocean/color/colorRangeUtils';
import { Sliders, ChevronDown } from 'lucide-react';

export const VisualizationControlsPanel: React.FC = () => {
  const [variable, setVariable] = useState<OceanVariable>('temperature');
  const [isosurfaceEnabled, setIsosurfaceEnabled] = useState(false);
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

  // Section collapse states
  const [variableOpen, setVariableOpen] = useState(true);
  const [isosurfaceOpen, setIsosurfaceOpen] = useState(true);
  const [colorbarOpen, setColorbarOpen] = useState(true);
  const [opacityOpen, setOpacityOpen] = useState(true);
  const [exaggerationOpen, setExaggerationOpen] = useState(true);

  useEffect(() => {
    const unsub = OceanState.getInstance().subscribe((snapshot) => {
      setVariable(snapshot.activeVariable);
      setIsosurfaceEnabled(false);
      setPalette(snapshot.visualization.palette);
      setMinVal(snapshot.visualization.minVal);
      setMaxVal(snapshot.visualization.maxVal);
      setScaleType(snapshot.visualization.scaleType);
      setModelOpacity(snapshot.visualization.modelOpacity);
      setGliderOpacity(snapshot.visualization.gliderOpacity);
      setArgoOpacity(snapshot.visualization.argoOpacity);
      setVertExaggeration(snapshot.visualization.verticalExaggeration);
    });
    return unsub;
  }, []);

  const handleVarChange = (v: OceanVariable) => {
    setVariable(v);
    OceanState.getInstance().setActiveVariable(v);
  };
  const update = (partial: Parameters<OceanState['updateVisualization']>[0]) => OceanState.getInstance().updateVisualization(partial);

  return (
    <aside className="ariel-panel panel-left-viz" aria-label="Visualization Controls">
      {/* Panel Title Bar - No numerical prefix */}
      <div className="panel-title-bar">
        <h2 className="panel-heading">Visualization Controls</h2>
        <Sliders size={13} className="panel-head-icon" />
      </div>

      <div className="panel-content-scroll">
        {/* Section 1: Variable */}
        <div className="viz-collapsible-section">
          <div
            className="viz-section-header"
            onClick={() => setVariableOpen(!variableOpen)}
            role="button"
            tabIndex={0}
          >
            <span className="viz-section-title">Variable</span>
            <ChevronDown
              size={13}
              className={`viz-chevron ${variableOpen ? 'expanded' : ''}`}
            />
          </div>

          {variableOpen && (
            <div className="viz-section-content">
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
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Isosurface */}
        <div className="viz-collapsible-section">
          <div
            className="viz-section-header"
            onClick={() => setIsosurfaceOpen(!isosurfaceOpen)}
            role="button"
            tabIndex={0}
          >
            <span className="viz-section-title">Isosurface</span>
            <ChevronDown
              size={13}
              className={`viz-chevron ${isosurfaceOpen ? 'expanded' : ''}`}
            />
          </div>

          {isosurfaceOpen && (
            <div className="viz-section-content">
              <label className="checkbox-row-inline">
                <input
                  type="checkbox"
                  checked={isosurfaceEnabled}
                  disabled
                  onChange={(e) => { setIsosurfaceEnabled(e.target.checked); update({ isosurfaceEnabled: e.target.checked }); }}
                />
                <span className="check-label">Unavailable — no 3D isosurface data</span>
              </label>

              {isosurfaceEnabled && (
                <div className="isosurface-inputs-row">
                  <div className="input-col">
                    <span className="sub-label">Variable</span>
                    <select
                      className="ariel-select select-sm"
                      value={isosurfaceVar}
                      disabled
                      onChange={(e) => { setIsosurfaceVar(e.target.value); update({ isosurfaceVariable: e.target.value }); }}
                    >
                      <option value="temperature">Temperature</option>
                      <option value="salinity">Salinity</option>
                      <option value="density">Density</option>
                    </select>
                  </div>
                  <div className="input-col input-col-val">
                    <span className="sub-label">Value</span>
                    <div className="unit-input-wrap">
                      <input
                        type="number"
                        className="ariel-input input-sm mono-input"
                        value={isosurfaceVal}
                        disabled
                        onChange={(e) => { const value = parseFloat(e.target.value) || 0; setIsosurfaceVal(value); update({ isosurfaceValue: value }); }}
                      />
                      <span className="input-unit">°C</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 3: Colorbar */}
        <div className="viz-collapsible-section">
          <div
            className="viz-section-header"
            onClick={() => setColorbarOpen(!colorbarOpen)}
            role="button"
            tabIndex={0}
          >
            <span className="viz-section-title">Colorbar</span>
            <ChevronDown
              size={13}
              className={`viz-chevron ${colorbarOpen ? 'expanded' : ''}`}
            />
          </div>

          {colorbarOpen && (
            <div className="viz-section-content">
              <div className="colorbar-palette-row">
                <span className="sub-label">Palette</span>
                <select
                  className="ariel-select select-sm"
                  value={palette}
                  onChange={(e) => { setPalette(e.target.value); update({ palette: e.target.value as 'Turbo' | 'Viridis' | 'Plasma' | 'Coolwarm' | 'Jet' }); }}
                >
                  <option value="Turbo">Turbo</option>
                  <option value="Viridis">Viridis</option>
                  <option value="Plasma">Plasma</option>
                  <option value="Coolwarm">Coolwarm</option>
                  <option value="Jet">Jet</option>
                </select>
              </div>

              {/* Scientific palette bar */}
              <div className="colorbar-preview" style={{ background: `linear-gradient(to right, ${PALETTE_STOPS[palette].join(', ')})` }} />

              <div className="colorbar-limits-row">
                <div className="limit-col">
                  <span className="sub-label">Min</span>
                  <input
                    type="number"
                    className="ariel-input input-sm mono-input"
                    value={minVal}
                    onChange={(e) => { const value = parseFloat(e.target.value) || 0; setMinVal(value); update({ minVal: value, autoRange: false }); }}
                  />
                </div>
                <div className="limit-col">
                  <span className="sub-label">Max</span>
                  <input
                    type="number"
                    className="ariel-input input-sm mono-input"
                    value={maxVal}
                    onChange={(e) => { const value = parseFloat(e.target.value) || 0; setMaxVal(value); update({ maxVal: value, autoRange: false }); }}
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
                    onChange={() => { setScaleType('linear'); update({ scaleType: 'linear' }); }}
                  />
                  <span>Linear</span>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="scaleType"
                    checked={scaleType === 'log'}
                    onChange={() => { setScaleType('log'); update({ scaleType: 'log' }); }}
                  />
                  <span>Logarithmic</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Section 4: Layer Opacity */}
        <div className="viz-collapsible-section">
          <div
            className="viz-section-header"
            onClick={() => setOpacityOpen(!opacityOpen)}
            role="button"
            tabIndex={0}
          >
            <span className="viz-section-title">Layer opacity</span>
            <ChevronDown
              size={13}
              className={`viz-chevron ${opacityOpen ? 'expanded' : ''}`}
            />
          </div>

          {opacityOpen && (
            <div className="viz-section-content">
              <div className="opacity-slider-row">
                <span className="slider-target-label">Model</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={modelOpacity}
                  onChange={(e) => { const value = parseInt(e.target.value, 10); setModelOpacity(value); update({ modelOpacity: value }); }}
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
                  onChange={(e) => { const value = parseInt(e.target.value, 10); setGliderOpacity(value); update({ gliderOpacity: value }); }}
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
                  onChange={(e) => { const value = parseInt(e.target.value, 10); setArgoOpacity(value); update({ argoOpacity: value }); }}
                  className="ariel-slider"
                />
                <span className="slider-pct">{argoOpacity}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Section 5: Vertical Exaggeration */}
        <div className="viz-collapsible-section">
          <div
            className="viz-section-header"
            onClick={() => setExaggerationOpen(!exaggerationOpen)}
            role="button"
            tabIndex={0}
          >
            <span className="viz-section-title">Vertical exaggeration</span>
            <ChevronDown
              size={13}
              className={`viz-chevron ${exaggerationOpen ? 'expanded' : ''}`}
            />
          </div>

          {exaggerationOpen && (
            <div className="viz-section-content">
              <div className="vert-exag-head">
                <span className="sub-label">Factor</span>
                <span className="vert-exag-val">{vertExaggeration}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={vertExaggeration}
                disabled
                onChange={(e) => { const value = parseInt(e.target.value, 10); setVertExaggeration(value); update({ verticalExaggeration: value }); }}
                className="ariel-slider"
              />
              <span className="sub-label">Unavailable in current renderer</span>
              <div className="slider-ticks-row">
                <span>1x</span>
                <span>5x</span>
                <span>10x</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
