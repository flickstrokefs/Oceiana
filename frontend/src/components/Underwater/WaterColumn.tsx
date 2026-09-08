import React, { useEffect, useState } from 'react';
import { OceanState } from '../../ocean/OceanState';
import type { OceanVariable } from '../../types/ocean';
import { Layers, Thermometer, Droplets, Wind, Sparkles } from 'lucide-react';

interface CheckpointData {
  depth: number;
  label: string;
  value: number;
  unit: string;
}

export const WaterColumn: React.FC = () => {
  const [selectedDepth, setSelectedDepth] = useState<number>(0);
  const [activeVar, setActiveVar] = useState<OceanVariable>('temperature');
  const [checkpoints, setCheckpoints] = useState<CheckpointData[]>([]);

  const depthLevels = [
    { depth: 0, label: '0m Surface' },
    { depth: 100, label: '100m Mixed Layer' },
    { depth: 200, label: '200m Thermocline' },
    { depth: 300, label: '300m Upper Pycnocline' },
    { depth: 400, label: '400m Mid Pycnocline' },
    { depth: 500, label: '500m Mesopelagic' },
    { depth: 750, label: '750m Intermediate' },
    { depth: 1000, label: '1000m Bathypelagic' },
    { depth: 1500, label: '1500m Deep Ocean' },
    { depth: 2000, label: '2000m Abyssal Plain' },
  ];

  useEffect(() => {
    const oceanState = OceanState.getInstance();
    const unsub = oceanState.subscribe((snapshot) => {
      setSelectedDepth(snapshot.parameters.depth);
      setActiveVar(snapshot.activeVariable);

      // Sample central Arabian Sea / Indian Ocean location (lat: 14.0, lon: 66.0) across water column
      const sampled = depthLevels.map((lvl) => {
        const field = oceanState.sampleSpatialField(14.0, 66.0, lvl.depth);
        let val = field.temperature;
        let unit = '°C';

        if (snapshot.activeVariable === 'salinity') {
          val = field.salinity;
          unit = 'PSU';
        } else if (snapshot.activeVariable === 'current') {
          val = Math.sqrt(field.velocity.u ** 2 + field.velocity.v ** 2);
          unit = 'm/s';
        } else if (snapshot.activeVariable === 'chlorophyll') {
          val = field.chlorophyll;
          unit = 'mg/m³';
        }

        return {
          depth: lvl.depth,
          label: lvl.label,
          value: parseFloat(val.toFixed(2)),
          unit,
        };
      });

      setCheckpoints(sampled);
    });

    return unsub;
  }, []);

  const handleSelectDepth = (depth: number) => {
    OceanState.getInstance().setDepth(depth);
  };

  const getVarIcon = () => {
    switch (activeVar) {
      case 'salinity':
        return <Droplets size={14} className="icon-blue" />;
      case 'current':
        return <Wind size={14} className="icon-cyan" />;
      case 'chlorophyll':
        return <Sparkles size={14} className="icon-green" />;
      default:
        return <Thermometer size={14} className="icon-amber" />;
    }
  };

  return (
    <aside className="ocean-panel water-column-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <Layers className="icon-teal" size={16} />
          <h2 className="panel-title">WATER COLUMN PROFILE</h2>
        </div>
        <div className="var-mini-tag">
          {getVarIcon()}
          <span className="var-mini-name">{activeVar.toUpperCase()}</span>
        </div>
      </div>

      <div className="water-column-list">
        {checkpoints.map((cp) => {
          const isCurrentSlice = Math.abs(selectedDepth - cp.depth) <= 40;
          const isExact = selectedDepth === cp.depth;

          return (
            <div
              key={cp.depth}
              onClick={() => handleSelectDepth(cp.depth)}
              className={`water-column-row ${isCurrentSlice ? 'row-active-slice' : ''} ${isExact ? 'row-exact-depth' : ''}`}
            >
              <div className="row-depth-label">
                <span className="depth-bullet"></span>
                <span className="depth-text">-{cp.depth}m</span>
              </div>

              <div className="row-bar-track">
                <div
                  className="row-bar-fill"
                  style={{
                    width: `${Math.min(100, Math.max(10, activeVar === 'temperature' ? (cp.value / 32) * 100 : (cp.value / 40) * 100))}%`,
                    background: activeVar === 'temperature'
                      ? 'linear-gradient(90deg, #2d82ff, #ff9100)'
                      : activeVar === 'salinity'
                      ? 'linear-gradient(90deg, #00f0ff, #00ff9d)'
                      : '#00f0ff'
                  }}
                />
              </div>

              <div className="row-val-group">
                <span className="row-val-num">{cp.value}</span>
                <span className="row-val-unit">{cp.unit}</span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
