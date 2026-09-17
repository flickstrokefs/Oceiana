import React, { useState } from 'react';
import { OceanBottomBar } from '../OceanControls/OceanBottomBar';
import { OceanState } from '../../ocean/OceanState';

export const PublicView: React.FC = () => {
  const [selectedVar, setSelectedVar] = useState<'Temperature' | 'Salinity' | 'Currents' | 'Ocean Depth'>('Temperature');
  const [publicModeOn, setPublicModeOn] = useState(true);

  const handleVarClick = (varName: 'Temperature' | 'Salinity' | 'Currents' | 'Ocean Depth') => {
    setSelectedVar(varName);
    if (varName === 'Temperature') OceanState.getInstance().setActiveVariable('temperature');
    if (varName === 'Salinity') OceanState.getInstance().setActiveVariable('salinity');
    if (varName === 'Currents') OceanState.getInstance().setActiveVariable('current');
    if (varName === 'Ocean Depth') OceanState.getInstance().setActiveVariable('temperature');
  };

  const handleToggle = (on: boolean) => {
    setPublicModeOn(on);
    if (!on) {
      OceanState.getInstance().setActivePage('3d-ocean');
    }
  };

  return (
    <div className="public-view-overlay">
      {/* Top Bar with Variable Pills & Public View Switch */}
      <div className="public-top-bar">
        <div className="public-pills-group">
          {(['Temperature', 'Salinity', 'Currents', 'Ocean Depth'] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={`public-pill-btn ${selectedVar === v ? 'public-pill-active' : ''}`}
              onClick={() => handleVarClick(v)}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="public-toggle-right">
          <span className="public-toggle-label">Public View</span>
          <label className="ariel-switch">
            <input
              type="checkbox"
              checked={publicModeOn}
              onChange={(e) => handleToggle(e.target.checked)}
            />
            <span className="switch-slider round" />
          </label>
        </div>
      </div>

      {/* Vertical Colorbar & Timeline at bottom */}
      <OceanBottomBar variableName={`${selectedVar} (${selectedVar === 'Temperature' ? '°C' : selectedVar === 'Salinity' ? 'PSU' : 'm/s'})`} />
    </div>
  );
};
