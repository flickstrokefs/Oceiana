import React, { useEffect, useState } from 'react';
import { OceanState } from '../../ocean/OceanState';
import type { OceanMode, OceanVariable } from '../../types/ocean';
import { Compass } from 'lucide-react';

interface HeaderControlsProps {
  onResetView?: () => void;
}

export const HeaderControls: React.FC<HeaderControlsProps> = ({ onResetView }) => {
  const [mode, setMode] = useState<OceanMode>('surface');
  const [activeVar, setActiveVar] = useState<OceanVariable>('temperature');

  useEffect(() => {
    const unsub = OceanState.getInstance().subscribe((snapshot) => {
      setMode(snapshot.mode);
      setActiveVar(snapshot.activeVariable);
    });
    return unsub;
  }, []);

  const handleModeChange = (newMode: OceanMode) => {
    OceanState.getInstance().setMode(newMode);
  };

  const handleVarChange = (v: OceanVariable) => {
    OceanState.getInstance().setActiveVariable(v);
  };

  return (
    <header className="header-controls">
      <div className="brand-group">
        <div className="brand-title">
          <span className="brand-primary">OCEAN-X</span>
          <span className="brand-sub">DIGITAL OCEAN ENGINE</span>
        </div>
        <div className="telemetry-tag">
          <span className="dot-active"></span>
          INDIAN OCEAN // ARABIAN SEA
        </div>
      </div>

      <div className="mode-switch-container">
        <button
          onClick={() => handleModeChange('surface')}
          className={`mode-btn ${mode === 'surface' ? 'mode-active' : ''}`}
        >
          SURFACE
        </button>
        <button
          onClick={() => handleModeChange('underwater')}
          className={`mode-btn ${mode === 'underwater' ? 'mode-active' : ''}`}
        >
          UNDERWATER
        </button>
      </div>

      <div className="variable-selector-group">
        <button
          onClick={() => handleVarChange('temperature')}
          className={`var-btn ${activeVar === 'temperature' ? 'var-active' : ''}`}
        >
          TEMP (°C)
        </button>
        <button
          onClick={() => handleVarChange('salinity')}
          className={`var-btn ${activeVar === 'salinity' ? 'var-active' : ''}`}
        >
          SALINITY
        </button>
        <button
          onClick={() => handleVarChange('chlorophyll')}
          className={`var-btn ${activeVar === 'chlorophyll' ? 'var-active' : ''}`}
        >
          CHLOROPHYLL
        </button>
      </div>

      <button onClick={onResetView} className="icon-action-btn" title="Reset View">
        <Compass size={16} />
        RESET
      </button>
    </header>
  );
};
