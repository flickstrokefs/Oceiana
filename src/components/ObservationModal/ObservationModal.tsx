import React, { useEffect, useState } from 'react';
import { OceanState } from '../../ocean/OceanState';
import type { ArgoProfile, GliderTrajectory } from '../../types/ocean';
import { X, Navigation, Radio } from 'lucide-react';

export const ObservationModal: React.FC = () => {
  const [selectedObs, setSelectedObs] = useState<{
    type: 'argo' | 'glider';
    data: ArgoProfile | GliderTrajectory;
  } | null>(null);

  useEffect(() => {
    const unsub = OceanState.getInstance().subscribe((snapshot) => {
      setSelectedObs(snapshot.selectedObservation);
    });
    return unsub;
  }, []);

  if (!selectedObs) return null;

  const close = () => {
    OceanState.getInstance().selectObservation(null);
  };

  const isArgo = selectedObs.type === 'argo';
  const argoData = isArgo ? (selectedObs.data as ArgoProfile) : null;
  const gliderData = !isArgo ? (selectedObs.data as GliderTrajectory) : null;

  return (
    <div className="obs-drawer float-panel-left">
      <div className="obs-header">
        <div className="obs-title-group">
          {isArgo ? <Radio size={18} className="icon-cyan" /> : <Navigation size={18} className="icon-magenta" />}
          <h3>{isArgo ? argoData?.name : gliderData?.name}</h3>
        </div>
        <button onClick={close} className="close-btn">
          <X size={16} />
        </button>
      </div>

      <div className="obs-body">
        {isArgo && argoData && (
          <>
            <div className="obs-meta-grid">
              <div className="meta-item">
                <span className="meta-label">STATION CODE</span>
                <span className="meta-val">{argoData.stationCode}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">COORDINATES</span>
                <span className="meta-val">
                  {argoData.latitude.toFixed(2)}°N, {argoData.longitude.toFixed(2)}°E
                </span>
              </div>
            </div>

            <h4 className="section-title">VERTICAL CTD DEPTH PROFILE</h4>
            <div className="ctd-table-wrapper">
              <table className="ctd-table">
                <thead>
                  <tr>
                    <th>DEPTH</th>
                    <th>TEMP</th>
                    <th>SALINITY</th>
                  </tr>
                </thead>
                <tbody>
                  {argoData.nodes.map((n, idx) => (
                    <tr key={idx}>
                      <td className="depth-col">{n.depth} m</td>
                      <td className="temp-col">{n.temperature.toFixed(1)} °C</td>
                      <td className="sal-col">{n.salinity.toFixed(1)} PSU</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!isArgo && gliderData && (
          <>
            <div className="obs-meta-grid">
              <div className="meta-item">
                <span className="meta-label">MISSION</span>
                <span className="meta-val">{gliderData.mission}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">WAYPOINTS</span>
                <span className="meta-val">{gliderData.waypoints.length} DIVE NODES</span>
              </div>
            </div>

            <h4 className="section-title">SAWTOOTH TRAJECTORY SUMMARY</h4>
            <div className="ctd-table-wrapper">
              <table className="ctd-table">
                <thead>
                  <tr>
                    <th>DIVE DEPTH</th>
                    <th>TEMP</th>
                    <th>SALINITY</th>
                  </tr>
                </thead>
                <tbody>
                  {gliderData.waypoints.slice(0, 7).map((wp, idx) => (
                    <tr key={idx}>
                      <td className="depth-col">{wp.depth.toFixed(0)} m</td>
                      <td className="temp-col">{wp.temperature.toFixed(1)} °C</td>
                      <td className="sal-col">{wp.salinity.toFixed(1)} PSU</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
