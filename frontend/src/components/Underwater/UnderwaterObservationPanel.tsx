import React, { useEffect, useState } from 'react';
import { OceanState } from '../../ocean/OceanState';
import type { ArgoProfile, GliderTrajectory } from '../../types/ocean';
import { Radio, Navigation, Eye } from 'lucide-react';

export const UnderwaterObservationPanel: React.FC = () => {
  const [argoList, setArgoList] = useState<ArgoProfile[]>([]);
  const [gliderList, setGliderList] = useState<GliderTrajectory[]>([]);
  const [currentDepth, setCurrentDepth] = useState<number>(0);

  useEffect(() => {
    const oceanState = OceanState.getInstance();
    const provider = oceanState.getProvider();
    setArgoList(provider.getArgoProfiles());
    setGliderList(provider.getGliderTrajectories());

    const unsub = oceanState.subscribe((snapshot) => {
      setCurrentDepth(snapshot.parameters.depth);
    });
    return unsub;
  }, []);

  const handleSelectArgo = (argo: ArgoProfile) => {
    OceanState.getInstance().selectObservation({
      type: 'argo',
      data: argo,
    });
  };

  const handleSelectGlider = (glider: GliderTrajectory) => {
    OceanState.getInstance().selectObservation({
      type: 'glider',
      data: glider,
    });
  };

  return (
    <div className="ocean-panel underwater-obs-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <Radio className="icon-cyan animate-pulse-slow" size={16} />
          <h2 className="panel-title">IN-SITU OBSERVATORIES</h2>
        </div>
        <span className="badge-live">{argoList.length + gliderList.length} ACTIVE</span>
      </div>

      <div className="obs-summary-text">
        <span>Argo CTD profiles & deep gliders intersecting Stratum -{currentDepth}m:</span>
      </div>

      <div className="obs-units-list">
        {argoList.map((argo) => {
          // Find nearest node reading to current depth
          let nearestNode = argo.nodes[0];
          let minDiff = Infinity;
          for (const n of argo.nodes) {
            const diff = Math.abs(n.depth - currentDepth);
            if (diff < minDiff) {
              minDiff = diff;
              nearestNode = n;
            }
          }

          return (
            <div
              key={argo.id}
              onClick={() => handleSelectArgo(argo)}
              className="obs-unit-card"
              title="Click to view CTD Vertical Profile"
            >
              <div className="obs-card-top">
                <div className="obs-card-name">
                  <span className="obs-dot dot-argo"></span>
                  <span className="obs-name-text">{argo.stationCode}</span>
                </div>
                <button className="view-profile-mini-btn">
                  <Eye size={12} />
                  <span>PROFILE</span>
                </button>
              </div>

              <div className="obs-card-telemetry">
                <div className="telemetry-chip">
                  <span className="chip-label">NODE @ -{nearestNode.depth}m:</span>
                  <span className="chip-val font-mono">{nearestNode.temperature}°C / {nearestNode.salinity} PSU</span>
                </div>
              </div>
            </div>
          );
        })}

        {gliderList.map((glider) => (
          <div
            key={glider.id}
            onClick={() => handleSelectGlider(glider)}
            className="obs-unit-card"
            title="Click to view Glider Mission Track"
          >
            <div className="obs-card-top">
              <div className="obs-card-name">
                <span className="obs-dot dot-glider"></span>
                <span className="obs-name-text">{glider.name}</span>
              </div>
              <button className="view-profile-mini-btn">
                <Navigation size={12} />
                <span>TRACK</span>
              </button>
            </div>
            <div className="obs-card-telemetry">
              <div className="telemetry-chip">
                <span className="chip-label">MISSION:</span>
                <span className="chip-val font-mono">{glider.mission}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
