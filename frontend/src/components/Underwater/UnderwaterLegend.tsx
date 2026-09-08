import React, { useEffect, useState } from 'react';
import { OceanState } from '../../ocean/OceanState';
import type { OceanVariable } from '../../types/ocean';

export const UnderwaterLegend: React.FC = () => {
  const [activeVar, setActiveVar] = useState<OceanVariable>('temperature');

  useEffect(() => {
    const unsub = OceanState.getInstance().subscribe((snapshot) => {
      setActiveVar(snapshot.activeVariable);
    });
    return unsub;
  }, []);

  const getLegendConfig = () => {
    switch (activeVar) {
      case 'salinity':
        return {
          title: 'SALINITY SPECTRUM (PSU)',
          min: '32.0',
          mid: '35.0',
          max: '38.0',
          gradient: 'linear-gradient(90deg, #00f0ff, #00ff9d, #ff9100, #ff0055)',
        };
      case 'current':
        return {
          title: 'CURRENT VELOCITY (m/s)',
          min: '0.0',
          mid: '1.5',
          max: '3.0+',
          gradient: 'linear-gradient(90deg, rgba(0,240,255,0.2), #00f0ff, #00ff9d, #ffffff)',
        };
      case 'chlorophyll':
        return {
          title: 'CHLOROPHYLL-A CONCENTRATION (mg/m³)',
          min: '0.0',
          mid: '2.5',
          max: '6.0+',
          gradient: 'linear-gradient(90deg, #001f3f, #0074D9, #2ECC40, #FFDC00)',
        };
      default:
        return {
          title: 'TEMPERATURE SPECTRUM (°C)',
          min: '2.0°C (Abyssal)',
          mid: '15.0°C',
          max: '30.0°C (Surface)',
          gradient: 'linear-gradient(90deg, #0022ff 0%, #00d4ff 35%, #00ff9d 55%, #ffd000 75%, #ff2200 100%)',
        };
    }
  };

  const config = getLegendConfig();

  return (
    <div className="ocean-panel underwater-legend-panel">
      <div className="legend-header">
        <span className="legend-title">{config.title}</span>
      </div>
      <div
        className="legend-color-bar"
        style={{ background: config.gradient }}
      />
      <div className="legend-labels">
        <span>{config.min}</span>
        <span>{config.mid}</span>
        <span>{config.max}</span>
      </div>
    </div>
  );
};
