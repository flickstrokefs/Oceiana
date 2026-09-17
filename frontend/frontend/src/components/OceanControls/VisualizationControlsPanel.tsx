import React, { useState, useEffect, useMemo } from 'react';
import { OceanState } from '../../ocean/OceanState';
import type { OceanVariable } from '../../types/ocean';
import type { ColorRange } from '../../ocean/color/colorTypes';
import { normalizeHex, sortRanges } from '../../ocean/color/colorRangeUtils';
import { ColorRangeEditor } from '../../ocean/color/ColorRangeEditor';
import { Plus, Sliders, ChevronDown } from 'lucide-react';

export const VisualizationControlsPanel: React.FC = () => {
  const [variable, setVariable] = useState<OceanVariable>('temperature');
  const [ranges, setRanges] = useState<ColorRange[]>(() => OceanState.getInstance().getColorRanges());
  const [showRangeEditor, setShowRangeEditor] = useState(false);
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

  // Section collapse states
  const [variableOpen, setVariableOpen] = useState(true);
  const [isosurfaceOpen, setIsosurfaceOpen] = useState(true);
  const [colorbarOpen, setColorbarOpen] = useState(true);
  const [opacityOpen, setOpacityOpen] = useState(true);
  const [exaggerationOpen, setExaggerationOpen] = useState(true);

  useEffect(() => {
    const unsub = OceanState.getInstance().subscribe((snapshot) => {
      setVariable(snapshot.activeVariable);
      setRanges(snapshot.colorRanges[snapshot.activeVariable] || []);
    });
    return unsub;
  }, []);

  const sortedRanges = useMemo(() => sortRanges(ranges), [ranges]);

  const dynamicGradient = useMemo(() => {
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
    return `linear-gradient(90deg, ${stops.join(', ')})`;
  }, [sortedRanges]);

  const activeMin = sortedRanges.length ? sortedRanges[0].min : minVal;
  const activeMax = sortedRanges.length ? sortedRanges[sortedRanges.length - 1].max : maxVal;

  const handleVarChange = (v: OceanVariable) => {
    setVariable(v);
    OceanState.getInstance().setActiveVariable(v);
  };

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
                  <option value="oxygen">Dissolved Oxygen (ml/L)</option>
                </select>
                <button
                  type="button"
                  className="ariel-btn-outline btn-compact"
                  onClick={() => alert('Variable added to visualization stack.')}
                >
                  <Plus size={11} /> Add variable
                </button>
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
                  onChange={(e) => setIsosurfaceEnabled(e.target.checked)}
                />
                <span className="check-label">Enabled</span>
              </label>

              {isosurfaceEnabled && (
                <div className="isosurface-inputs-row">
                  <div className="input-col">
                    <span className="sub-label">Variable</span>
                    <select
                      className="ariel-select select-sm"
                      value={isosurfaceVar}
                      onChange={(e) => setIsosurfaceVar(e.target.value)}
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
                        onChange={(e) => setIsosurfaceVal(parseFloat(e.target.value) || 0)}
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
              {/* Scientific palette bar */}
              <div
                className="colorbar-preview"
                style={{ background: dynamicGradient || 'linear-gradient(90deg, #2d5e94, #38bdf8)' }}
                aria-label="Active scientific color gradient"
              />

              <div className="colorbar-limits-row">
                <div className="limit-col">
                  <span className="sub-label">Min</span>
                  <span className="mono-val">{activeMin}</span>
                </div>
                <div className="limit-col">
                  <span className="sub-label">Max</span>
                  <span className="mono-val">{activeMax}</span>
                </div>
              </div>

              <div style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  className="ariel-btn-outline btn-compact"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => setShowRangeEditor(!showRangeEditor)}
                >
                  <Sliders size={12} /> {showRangeEditor ? 'Close Range Editor' : 'Configure Ranges'}
                </button>
              </div>

              {showRangeEditor && (
                <div style={{ marginTop: '8px' }}>
                  <ColorRangeEditor
                    variable={variable}
                    isOpen={showRangeEditor}
                    onClose={() => setShowRangeEditor(false)}
                    title={variable.toUpperCase()}
                  />
                </div>
              )}
            </div>
          )}

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
                onChange={(e) => setVertExaggeration(parseInt(e.target.value, 10))}
                className="ariel-slider"
              />
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
