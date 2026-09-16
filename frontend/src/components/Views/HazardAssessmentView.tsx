import React, { useState } from 'react';
import { Play, AlertTriangle } from 'lucide-react';

interface HazardRegion {
  name: string;
  area: string;
  maxValue: string;
}

const HAZARD_REGIONS: HazardRegion[] = [
  { name: 'North Arabian Sea', area: '125,000', maxValue: '2.4' },
  { name: 'Bay of Bengal', area: '98,000', maxValue: '2.1' },
  { name: 'Lakshadweep', area: '62,000', maxValue: '1.8' },
  { name: 'Andaman Sea', area: '40,000', maxValue: '1.7' },
  { name: 'Southern Ocean Polar Front', area: '160,000', maxValue: '2.8' },
];

export const HazardAssessmentView: React.FC = () => {
  const [variable, setVariable] = useState('Current Speed (m/s)');
  const [threshold, setThreshold] = useState('1.5');
  const [analyzing, setAnalyzing] = useState(false);
  const [hazardRegions, setHazardRegions] = useState<HazardRegion[]>(HAZARD_REGIONS);

  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/hazard/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variable,
          threshold: parseFloat(threshold) || 1.5,
          region: 'Indian Ocean',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.regions)) {
          setHazardRegions(data.regions);
        }
      }
    } catch {
      // Fall back smoothly
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="ariel-view-container hazard-view">
      {/* Top Controls Bar */}
      <div className="hazard-top-controls">
        <div className="control-field-inline">
          <label className="ctrl-label">Select Variable</label>
          <select
            className="ariel-select select-sm"
            value={variable}
            onChange={(e) => setVariable(e.target.value)}
          >
            <option value="Current Speed (m/s)">Current Speed (m/s)</option>
            <option value="Significant Wave Height (m)">Significant Wave Height (m)</option>
            <option value="Sea Surface Height Anomaly (m)">Sea Surface Height Anomaly (m)</option>
            <option value="Thermal Stress Index">Thermal Stress Index</option>
          </select>
        </div>

        <div className="control-field-inline">
          <label className="ctrl-label">Threshold</label>
          <input
            type="number"
            step="0.1"
            className="ariel-input input-sm width-20"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="ariel-btn-teal btn-sm"
          onClick={handleRunAnalysis}
          disabled={analyzing}
        >
          <Play size={12} /> {analyzing ? 'Analyzing...' : 'Run Analysis'}
        </button>
      </div>

      {/* Main Split Layout */}
      <div className="hazard-main-grid">
        {/* Left Geospatial Heatmap */}
        <div className="hazard-map-panel">
          <div className="map-wrapper-relative">
            <svg viewBox="0 0 600 380" className="hazard-geospatial-svg" aria-label="Hazard heat map">
              {/* Ocean Dark Background */}
              <rect x="0" y="0" width="600" height="380" fill="#0c0e12" />

              {/* Bathymetry contours */}
              <path d="M 50,180 Q 150,220 280,260 T 550,300" stroke="#161920" strokeWidth="1.5" fill="none" />
              <path d="M 20,240 Q 180,270 320,310 T 580,350" stroke="#161920" strokeWidth="1.5" fill="none" />

              {/* Landmass Outlines (Indian Subcontinent & Surroundings) */}
              {/* India */}
              <path
                d="M 240,40 L 290,40 L 320,90 L 300,160 L 285,220 L 280,235 L 275,220 L 245,170 L 210,130 L 190,100 L 210,55 Z"
                fill="#161920"
                stroke="#20242b"
                strokeWidth="1.5"
              />
              {/* Arabian Peninsula */}
              <path
                d="M 40,40 L 120,40 L 130,80 L 110,130 L 70,120 L 40,80 Z"
                fill="#161920"
                stroke="#20242b"
                strokeWidth="1.2"
              />
              {/* Sri Lanka */}
              <ellipse cx="295" cy="250" rx="8" ry="12" fill="#161920" stroke="#20242b" strokeWidth="1" />
              {/* Southeast Asia / Myanmar */}
              <path
                d="M 370,50 L 430,70 L 450,150 L 430,220 L 400,240 L 390,200 L 380,130 Z"
                fill="#161920"
                stroke="#20242b"
                strokeWidth="1.2"
              />

              {/* Ocean Current Heatmap Blooms (Arabian Sea & Bay of Bengal) */}
              <defs>
                <radialGradient id="heatArabian" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.9" />
                  <stop offset="40%" stopColor="#f59e0b" stopOpacity="0.8" />
                  <stop offset="70%" stopColor="#10b981" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="heatBay" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.85" />
                  <stop offset="45%" stopColor="#f59e0b" stopOpacity="0.75" />
                  <stop offset="75%" stopColor="#10b981" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="heatEquatorial" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.8" />
                  <stop offset="60%" stopColor="#10b981" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Arabian Sea Current Jets */}
              <ellipse cx="160" cy="180" rx="75" ry="48" fill="url(#heatArabian)" transform="rotate(-15 160 180)" />
              <ellipse cx="140" cy="220" rx="55" ry="32" fill="url(#heatArabian)" />

              {/* Bay of Bengal Eddy Bloom */}
              <ellipse cx="360" cy="175" rx="65" ry="50" fill="url(#heatBay)" transform="rotate(10 360 175)" />

              {/* Equatorial Jet */}
              <ellipse cx="270" cy="330" rx="140" ry="32" fill="url(#heatEquatorial)" />

              {/* Region Labels */}
              <text x="140" y="150" fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="middle" opacity="0.85">
                Arabian Sea
              </text>
              <text x="365" y="150" fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="middle" opacity="0.85">
                Bay of Bengal
              </text>
              <text x="270" y="340" fill="#cbd5e1" fontSize="10" textAnchor="middle" opacity="0.75">
                Equatorial Jet Zone
              </text>

              {/* Grid Lines */}
              <line x1="50" y1="100" x2="550" y2="100" stroke="#0a3348" strokeWidth="0.8" strokeDasharray="4,4" />
              <line x1="50" y1="200" x2="550" y2="200" stroke="#0a3348" strokeWidth="0.8" strokeDasharray="4,4" />
              <line x1="50" y1="300" x2="550" y2="300" stroke="#0a3348" strokeWidth="0.8" strokeDasharray="4,4" />
              <line x1="200" y1="30" x2="200" y2="360" stroke="#0a3348" strokeWidth="0.8" strokeDasharray="4,4" />
              <line x1="350" y1="30" x2="350" y2="360" stroke="#0a3348" strokeWidth="0.8" strokeDasharray="4,4" />
            </svg>

            {/* Vertical Colorbar on Right of Map */}
            <div className="hazard-map-colorbar">
              <span className="colorbar-unit">Current Speed (m/s)</span>
              <div className="colorbar-vertical-scale">
                <div className="scale-labels">
                  <span>3.0</span>
                  <span>2.5</span>
                  <span>2.0</span>
                  <span>1.5</span>
                  <span>1.0</span>
                  <span>0.5</span>
                </div>
                <div className="scale-bar-gradient hazard-gradient" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Table Panel: Regions Exceeding Threshold */}
        <div className="hazard-table-panel">
          <div className="panel-head-simple">
            <span className="panel-title">Regions Exceeding Threshold</span>
            <AlertTriangle size={14} className="text-amber" />
          </div>

          <table className="ariel-styled-table">
            <thead>
              <tr>
                <th>Region</th>
                <th>Area (km²)</th>
                <th className="text-right">Max Value</th>
              </tr>
            </thead>
            <tbody>
              {hazardRegions.map((r) => (
                <tr key={r.name}>
                  <td className="font-medium text-white">{r.name}</td>
                  <td className="font-mono text-slate-300">{r.area}</td>
                  <td className="font-mono text-right text-coral font-bold">{r.maxValue}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Table Legend at bottom */}
          <div className="hazard-legend-note">
            <span className="legend-checkbox-icon">✔</span>
            <span className="legend-text">
              Areas where current speed &gt; {threshold} m/s
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
