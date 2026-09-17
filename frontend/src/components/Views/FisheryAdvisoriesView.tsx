import React, { useState } from 'react';
import { Fish, CheckCircle2, Sparkles } from 'lucide-react';

export const FisheryAdvisoriesView: React.FC = () => {
  const [variable, setVariable] = useState('Chlorophyll (mg/m³)');
  const [region, setRegion] = useState('Indian Ocean');
  const [timeRange, setTimeRange] = useState('Next 7 days');
  const [generating, setGenerating] = useState(false);
  const [advisoryDate, setAdvisoryDate] = useState('12 Sep 2024');
  const [zones, setZones] = useState([
    { name: 'Eastern Arabian Sea', status: 'High productivity (thermal front)', dot: 'dot-green' },
    { name: 'Persian Bay of Bengal', status: 'Good conditions', dot: 'dot-green' },
    { name: 'Western Bay of Bengal', status: 'Good conditions', dot: 'dot-green' },
    { name: 'Equatorial Indian Ocean', status: 'Moderate conditions', dot: 'dot-teal' },
  ]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/fishery/advisory?region=${encodeURIComponent(region)}&variable=${encodeURIComponent(variable)}&time_range=${encodeURIComponent(timeRange)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.generated_date) setAdvisoryDate(data.generated_date);
        if (Array.isArray(data.recommended_zones)) {
          setZones(data.recommended_zones.map((z: { name: string; status: string; rating: string }) => ({
            name: z.name,
            status: z.status,
            dot: z.rating === 'FAVOURABLE' || z.rating === 'GOOD' ? 'dot-green' : 'dot-teal',
          })));
        }
      }
    } catch {
      // Fall back smoothly
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="ariel-view-container fishery-view">
      {/* Top Controls Bar */}
      <div className="hazard-top-controls">
        <div className="control-field-inline">
          <label className="ctrl-label">Variable</label>
          <select
            className="ariel-select select-sm"
            value={variable}
            onChange={(e) => setVariable(e.target.value)}
          >
            <option value="Chlorophyll (mg/m³)">Chlorophyll (mg/m³)</option>
            <option value="Sea Surface Temperature (°C)">Sea Surface Temperature (°C)</option>
            <option value="Primary Productivity">Primary Productivity</option>
            <option value="Thermal Fronts">Thermal Fronts</option>
          </select>
        </div>

        <div className="control-field-inline">
          <label className="ctrl-label">Region</label>
          <select
            className="ariel-select select-sm"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            <option value="All Regions">All Regions (3 Basins)</option>
            <option value="Arabian Sea">Arabian Sea (West Coast)</option>
            <option value="Bay of Bengal">Bay of Bengal (East Coast)</option>
            <option value="Southern Ocean">Southern Ocean (Subantarctic Front)</option>
          </select>
        </div>

        <div className="control-field-inline">
          <label className="ctrl-label">Time Range</label>
          <select
            className="ariel-select select-sm"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <option value="Next 7 days">Next 7 days</option>
            <option value="Next 3 days">Next 3 days</option>
            <option value="Current 24h">Current 24h</option>
          </select>
        </div>

        <button
          type="button"
          className="ariel-btn-teal btn-sm"
          onClick={handleGenerate}
          disabled={generating}
        >
          <Sparkles size={12} /> {generating ? 'Computing PFZ...' : 'Generate Advisory'}
        </button>
      </div>

      {/* Main Split Layout */}
      <div className="hazard-main-grid">
        {/* Left Geospatial Chlorophyll Map */}
        <div className="hazard-map-panel">
          <div className="map-wrapper-relative">
            <svg viewBox="0 0 600 380" className="hazard-geospatial-svg" aria-label="Chlorophyll map">
              {/* Ocean Dark Background */}
              <rect x="0" y="0" width="600" height="380" fill="#0c0e12" />

              {/* Coastal shelf contours */}
              <path d="M 180,90 Q 250,180 270,240" stroke="#161920" strokeWidth="1" strokeDasharray="3,3" fill="none" />
              <path d="M 310,100 Q 320,180 290,240" stroke="#161920" strokeWidth="1" strokeDasharray="3,3" fill="none" />

              {/* Landmass (Indian Subcontinent) */}
              <path
                d="M 240,40 L 290,40 L 320,90 L 300,160 L 285,220 L 280,235 L 275,220 L 245,170 L 210,130 L 190,100 L 210,55 Z"
                fill="#161920"
                stroke="#20242b"
                strokeWidth="1.5"
              />
              <path
                d="M 40,40 L 120,40 L 130,80 L 110,130 L 70,120 L 40,80 Z"
                fill="#161920"
                stroke="#20242b"
                strokeWidth="1.2"
              />
              <ellipse cx="295" cy="250" rx="8" ry="12" fill="#161920" stroke="#20242b" strokeWidth="1" />
              <path
                d="M 370,50 L 430,70 L 450,150 L 430,220 L 400,240 L 390,200 L 380,130 Z"
                fill="#161920"
                stroke="#20242b"
                strokeWidth="1.2"
              />

              {/* Chlorophyll Productivity Blooms (Coastal Upwelling) */}
              <defs>
                <radialGradient id="chlWestCoast" cx="40%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.95" />
                  <stop offset="35%" stopColor="#f59e0b" stopOpacity="0.85" />
                  <stop offset="65%" stopColor="#10b981" stopOpacity="0.75" />
                  <stop offset="90%" stopColor="#06b6d4" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#082538" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="chlEastCoast" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
                  <stop offset="45%" stopColor="#10b981" stopOpacity="0.8" />
                  <stop offset="80%" stopColor="#06b6d4" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#082538" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* West Coast High Chlorophyll Blooms */}
              <ellipse cx="230" cy="160" rx="42" ry="70" fill="url(#chlWestCoast)" transform="rotate(22 230 160)" />
              <ellipse cx="260" cy="210" rx="28" ry="42" fill="url(#chlWestCoast)" transform="rotate(22 260 210)" />

              {/* Bay of Bengal Northern Delta Bloom */}
              <ellipse cx="340" cy="110" rx="60" ry="38" fill="url(#chlEastCoast)" />
              <ellipse cx="320" cy="165" rx="35" ry="50" fill="url(#chlEastCoast)" transform="rotate(-15 320 165)" />

              {/* Potential Fishing Zone Highlighting Points */}
              <circle cx="218" cy="170" r="4" fill="#2d5e94" stroke="#ffffff" strokeWidth="1.5" className="animate-ping-slow" />
              <circle cx="248" cy="215" r="4" fill="#2d5e94" stroke="#ffffff" strokeWidth="1.5" className="animate-ping-slow" />
              <circle cx="330" cy="120" r="4" fill="#2d5e94" stroke="#ffffff" strokeWidth="1.5" className="animate-ping-slow" />

              {/* Labels */}
              <text x="140" y="190" fill="#94a3b8" fontSize="10" fontWeight="bold">Eastern Arabian Sea PFZ</text>
              <text x="360" y="190" fill="#94a3b8" fontSize="10" fontWeight="bold">Bay of Bengal PFZ</text>
            </svg>

            {/* Vertical Chlorophyll Log Colorbar on Right */}
            <div className="hazard-map-colorbar">
              <span className="colorbar-unit">Chlorophyll (mg/m³)</span>
              <div className="colorbar-vertical-scale">
                <div className="scale-labels">
                  <span>10</span>
                  <span>1.0</span>
                  <span>0.1</span>
                  <span>0.01</span>
                </div>
                <div className="scale-bar-gradient chl-gradient" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Advisory Summary Panel */}
        <div className="advisory-summary-panel">
          <div className="panel-head-between">
            <div className="adv-head-title">
              <h3 className="panel-title">Advisory for {region}</h3>
              <span className="adv-gen-date font-mono">Generated: {advisoryDate}</span>
            </div>
            <Fish size={16} className="text-teal" />
          </div>

          {/* Favourable Conditions Badge */}
          <div className="favourable-badge-wrap">
            <div className="favourable-badge">
              <CheckCircle2 size={15} />
              <span>Favourable Conditions</span>
            </div>
          </div>

          {/* Key Conditions Card */}
          <div className="key-conditions-block">
            <span className="block-title">Key Conditions</span>
            <div className="conditions-list">
              <div className="cond-item">
                <span className="c-label">Chlorophyll:</span>
                <span className="c-val text-teal">0.3 – 2.5 mg/m³</span>
              </div>
              <div className="cond-item">
                <span className="c-label">SST:</span>
                <span className="c-val">26 – 29 °C</span>
              </div>
              <div className="cond-item">
                <span className="c-label">Current:</span>
                <span className="c-val">Moderate (0.4 – 0.8 m/s)</span>
              </div>
            </div>
          </div>

          {/* Recommended Zones List */}
          <div className="recommended-zones-block">
            <span className="block-title">Recommended Zones</span>
            <div className="zones-list">
              {zones.map((z) => (
                <div key={z.name} className="zone-item">
                  <span className={`zone-bullet ${z.dot}`} />
                  <div className="zone-desc">
                    <strong className="zone-name">{z.name}</strong>
                    <span className="zone-status-text">{z.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
