import React, { useState } from 'react';
import {
  Sliders,
  Database,
  Globe,
  Users,
  Info,
  Check,
  Zap,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [subTab, setSubTab] = useState<'general' | 'viz' | 'sources' | 'map' | 'users' | 'about'>('general');
  const [displayMode, setDisplayMode] = useState<'operational' | 'public'>('operational');
  const [defaultVar, setDefaultVar] = useState('temperature');
  const [defaultPalette, setDefaultPalette] = useState('Turbo');
  const [defaultExag, setDefaultExag] = useState('5x');
  const [defaultDepth, setDefaultDepth] = useState('Surface');
  const [tempUnit, setTempUnit] = useState('°C');
  const [salUnit, setSalUnit] = useState('PSU');
  const [depthUnit, setDepthUnit] = useState('metres (m)');
  const [apiEndpoint, setApiEndpoint] = useState('https://data.incois.gov.in/api');
  const [realtimeUpdates, setRealtimeUpdates] = useState(true);
  const [cacheData, setCacheData] = useState(true);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [savedStatus, setSavedStatus] = useState(false);

  const handleTestConnection = () => {
    setTestStatus('Testing...');
    setTimeout(() => {
      setTestStatus('Connected · Latency 42ms');
    }, 450);
  };

  const handleSave = () => {
    setSavedStatus(true);
    setTimeout(() => setSavedStatus(false), 2000);
  };

  return (
    <div className="ariel-view-container settings-view">
      <div className="settings-layout-split">
        {/* Left Sub-navigation */}
        <aside className="settings-subnav">
          <button
            type="button"
            className={`subnav-item ${subTab === 'general' ? 'subnav-active' : ''}`}
            onClick={() => setSubTab('general')}
          >
            <Sliders size={14} />
            <span>General</span>
          </button>
          <button
            type="button"
            className={`subnav-item ${subTab === 'viz' ? 'subnav-active' : ''}`}
            onClick={() => setSubTab('viz')}
          >
            <Zap size={14} />
            <span>Visualization</span>
          </button>
          <button
            type="button"
            className={`subnav-item ${subTab === 'sources' ? 'subnav-active' : ''}`}
            onClick={() => setSubTab('sources')}
          >
            <Database size={14} />
            <span>Data Sources</span>
          </button>
          <button
            type="button"
            className={`subnav-item ${subTab === 'map' ? 'subnav-active' : ''}`}
            onClick={() => setSubTab('map')}
          >
            <Globe size={14} />
            <span>Map & Globe</span>
          </button>
          <button
            type="button"
            className={`subnav-item ${subTab === 'users' ? 'subnav-active' : ''}`}
            onClick={() => setSubTab('users')}
          >
            <Users size={14} />
            <span>User & Access</span>
          </button>
          <button
            type="button"
            className={`subnav-item ${subTab === 'about' ? 'subnav-active' : ''}`}
            onClick={() => setSubTab('about')}
          >
            <Info size={14} />
            <span>About</span>
          </button>
        </aside>

        {/* Right Settings Form */}
        <div className="settings-form-panel">
          <div className="form-panel-header">
            <h2 className="settings-panel-title">General Settings</h2>
            <span className="settings-subtitle">System configuration & oceanographic preferences</span>
          </div>

          <div className="settings-form-body">
            {/* Display Mode */}
            <div className="form-group-section">
              <span className="section-title">Display Mode</span>
              <div className="radio-group-horiz">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="displayMode"
                    checked={displayMode === 'operational'}
                    onChange={() => setDisplayMode('operational')}
                  />
                  <span>Operational (Full Features)</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="displayMode"
                    checked={displayMode === 'public'}
                    onChange={() => setDisplayMode('public')}
                  />
                  <span>Public View (Restricted)</span>
                </label>
              </div>
            </div>

            {/* Default Visualization */}
            <div className="form-group-section">
              <span className="section-title">Default Visualization</span>
              <div className="fields-grid-two">
                <div className="field-block">
                  <label className="field-label">Default Variable</label>
                  <select
                    className="ariel-select"
                    value={defaultVar}
                    onChange={(e) => setDefaultVar(e.target.value)}
                  >
                    <option value="temperature">Temperature (°C)</option>
                    <option value="salinity">Salinity (PSU)</option>
                    <option value="current">Current Speed (m/s)</option>
                    <option value="chlorophyll">Chlorophyll (mg/m³)</option>
                  </select>
                </div>

                <div className="field-block">
                  <label className="field-label">Default Color Palette</label>
                  <select
                    className="ariel-select"
                    value={defaultPalette}
                    onChange={(e) => setDefaultPalette(e.target.value)}
                  >
                    <option value="Turbo">Turbo</option>
                    <option value="Viridis">Viridis</option>
                    <option value="Plasma">Plasma</option>
                    <option value="Coolwarm">Coolwarm</option>
                  </select>
                </div>

                <div className="field-block">
                  <label className="field-label">Default Vertical Exaggeration</label>
                  <select
                    className="ariel-select"
                    value={defaultExag}
                    onChange={(e) => setDefaultExag(e.target.value)}
                  >
                    <option value="1x">1x</option>
                    <option value="3x">3x</option>
                    <option value="5x">5x</option>
                    <option value="10x">10x</option>
                  </select>
                </div>

                <div className="field-block">
                  <label className="field-label">Default Depth</label>
                  <select
                    className="ariel-select"
                    value={defaultDepth}
                    onChange={(e) => setDefaultDepth(e.target.value)}
                  >
                    <option value="Surface">Surface</option>
                    <option value="100m">100m</option>
                    <option value="500m">500m</option>
                    <option value="1000m">1000m</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Units */}
            <div className="form-group-section">
              <span className="section-title">Units</span>
              <div className="fields-grid-three">
                <div className="field-block">
                  <label className="field-label">Temperature</label>
                  <select
                    className="ariel-select"
                    value={tempUnit}
                    onChange={(e) => setTempUnit(e.target.value)}
                  >
                    <option value="°C">°C (Celsius)</option>
                    <option value="K">K (Kelvin)</option>
                  </select>
                </div>

                <div className="field-block">
                  <label className="field-label">Salinity</label>
                  <select
                    className="ariel-select"
                    value={salUnit}
                    onChange={(e) => setSalUnit(e.target.value)}
                  >
                    <option value="PSU">PSU</option>
                    <option value="g/kg">g/kg (Absolute)</option>
                  </select>
                </div>

                <div className="field-block">
                  <label className="field-label">Depth</label>
                  <select
                    className="ariel-select"
                    value={depthUnit}
                    onChange={(e) => setDepthUnit(e.target.value)}
                  >
                    <option value="metres (m)">metres (m)</option>
                    <option value="feet (ft)">feet (ft)</option>
                    <option value="dbar">dbar (Pressure)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Data & API */}
            <div className="form-group-section">
              <span className="section-title">Data & API</span>
              <div className="api-endpoint-row">
                <div className="field-block flex-grow">
                  <label className="field-label">API Endpoint (REST / OPeNDAP)</label>
                  <div className="input-with-action">
                    <input
                      type="text"
                      className="ariel-input"
                      value={apiEndpoint}
                      onChange={(e) => setApiEndpoint(e.target.value)}
                    />
                    <button
                      type="button"
                      className="ariel-btn-outline-teal btn-sm"
                      onClick={handleTestConnection}
                    >
                      Test Connection
                    </button>
                  </div>
                  {testStatus && (
                    <span className="test-status-text text-teal text-xs mt-1 block">
                      {testStatus}
                    </span>
                  )}
                </div>
              </div>

              <div className="checkboxes-stack mt-3">
                <label className="checkbox-row-compact">
                  <input
                    type="checkbox"
                    checked={realtimeUpdates}
                    onChange={(e) => setRealtimeUpdates(e.target.checked)}
                  />
                  <span>Enable real-time data updates</span>
                </label>
                <label className="checkbox-row-compact">
                  <input
                    type="checkbox"
                    checked={cacheData}
                    onChange={(e) => setCacheData(e.target.checked)}
                  />
                  <span>Cache data for faster loading</span>
                </label>
              </div>
            </div>
          </div>

          <div className="settings-form-footer">
            <button
              type="button"
              className="ariel-btn-teal btn-md"
              onClick={handleSave}
            >
              {savedStatus ? (
                <>
                  <Check size={14} /> Settings Saved
                </>
              ) : (
                'Save Settings'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
