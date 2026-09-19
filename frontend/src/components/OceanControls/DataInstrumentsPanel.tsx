import React, { useEffect, useState } from 'react';
import { ChevronDown, Database, Navigation, Table2 } from 'lucide-react';
import { OceanState } from '../../ocean/OceanState';
import { currentSpeedFromSample } from '../../services/oceanService';
import type { OceanStateSnapshot, GliderTrajectory, ArgoProfile } from '../../types/ocean';

const format = (value: number | null | undefined, unit: string) => value == null || !Number.isFinite(value) ? 'N/A' : `${value.toFixed(2)} ${unit}`;

export const DataInstrumentsPanel: React.FC = () => {
  const state = OceanState.getInstance();
  const [snapshot, setSnapshot] = useState<OceanStateSnapshot>(() => state.getSnapshot());
  const [modelOpen, setModelOpen] = useState(true);
  const [instrumentOpen, setInstrumentOpen] = useState(true);
  const [comparisonOpen, setComparisonOpen] = useState(true);
  const [comparisonTab, setComparisonTab] = useState<'glider' | 'argo' | 'all'>('all');
  useEffect(() => state.subscribe(setSnapshot), [state]);

  const sample = state.getPointSample();
  const profileMessage = !snapshot.queryPoint ? 'Select a point on the globe' : snapshot.profileStatus === 'loading' ? 'Loading profile…' : snapshot.profileStatus === 'error' ? `Profile unavailable: ${snapshot.profileError}` : null;
  const values: Array<[string, string, number | null | undefined, string, keyof Pick<typeof snapshot.visualization, 'showModelTemperature' | 'showModelSalinity' | 'showModelCurrents' | 'showModelChlorophyll'>]> = [
    ['Temperature', 'temperature', sample?.temperature, '°C', 'showModelTemperature'],
    ['Salinity', 'salinity', sample?.salinity, 'PSU', 'showModelSalinity'],
    ['Currents', 'currents', currentSpeedFromSample(sample), 'm/s', 'showModelCurrents'],
    ['Chlorophyll', 'chlorophyll', sample?.chlorophyll, 'mg/m³', 'showModelChlorophyll'],
  ];
  const flyToGlider = (glider: GliderTrajectory) => {
    const latest = glider.waypoints[glider.waypoints.length - 1];
    if (!latest) return;
    state.setQueryPoint(latest.latitude, latest.longitude);
    state.selectObservation({ type: 'glider', data: glider });
    state.requestFlyToLocation(latest.latitude, latest.longitude, 750000);
  };
  const flyToArgo = (argo: ArgoProfile) => {
    state.setQueryPoint(argo.latitude, argo.longitude);
    state.selectObservation({ type: 'argo', data: argo });
    state.requestFlyToLocation(argo.latitude, argo.longitude, 750000);
  };
  const modelCell = (value: number | null | undefined, unit: string) => profileMessage ? 'N/A' : format(value, unit);

  return <aside className="ariel-panel panel-right-data" aria-label="Data & Instruments">
    <div className="panel-title-bar"><h2 className="panel-heading">Data & Instruments</h2><Database size={13} className="panel-head-icon" /></div>
    <div className="panel-content-scroll">
      <div className="data-accordion-item"><div className="accordion-header" onClick={() => setModelOpen(!modelOpen)} role="button" tabIndex={0}>
        <span className="accordion-title"><ChevronDown size={13} className={`accordion-chevron ${modelOpen ? 'expanded' : ''}`} />Model data — INCOIS-IOCM</span></div>
        {modelOpen && <div className="accordion-body"><div className="checklist-group">
          {profileMessage && <div className="data-metric-val">{profileMessage}</div>}
          {values.map(([label, key, value, unit, setting]) => <label className="data-metric-row" key={key}><div className="data-metric-label">
            <input type="checkbox" checked={snapshot.visualization[setting]} onChange={() => state.updateVisualization({ [setting]: !snapshot.visualization[setting] })} /><span>{label}</span>
          </div><span className="data-metric-val">{modelCell(value, unit)}</span></label>)}
          <label className="data-metric-row"><div className="data-metric-label"><input type="checkbox" disabled /><span>Oxygen</span></div><span className="data-metric-val">N/A</span></label>
        </div></div>}
      </div>
      <div className="data-accordion-item"><div className="accordion-header" onClick={() => setInstrumentOpen(!instrumentOpen)} role="button" tabIndex={0}>
        <span className="accordion-title"><ChevronDown size={13} className={`accordion-chevron ${instrumentOpen ? 'expanded' : ''}`} />Instrument data</span></div>
        {instrumentOpen && <div className="accordion-body"><div className="checklist-group">
          <label className="checkbox-row"><input type="checkbox" checked={snapshot.visualization.showArgo} onChange={() => state.updateVisualization({ showArgo: !snapshot.visualization.showArgo })} /><span className="check-label">Argo floats</span><span className="data-metric-val">{snapshot.argoProfiles?.length ?? 0} ACTIVE</span></label>
          {snapshot.visualization.showArgo && snapshot.argoProfiles?.map((argo) => <button type="button" className="checkbox-row" key={argo.id} onClick={() => flyToArgo(argo)}><span className="check-label">● {argo.stationCode}</span><span className="data-metric-val"><Navigation size={9} /> VIEW</span></button>)}
          <label className="checkbox-row"><input type="checkbox" checked={snapshot.visualization.showGliders} onChange={() => state.updateVisualization({ showGliders: !snapshot.visualization.showGliders })} /><span className="check-label">Gliders</span><span className="data-metric-val">{snapshot.gliders?.length ?? 0} ACTIVE</span></label>
          {snapshot.visualization.showGliders && snapshot.gliders?.map((g) => <button type="button" className="checkbox-row" key={g.id} onClick={() => flyToGlider(g)}><span className="check-label">● {g.name}</span><span className="data-metric-val"><Navigation size={9} /> VIEW</span></button>)}
          {['CTD', 'BGC', 'Moorings', 'HF Radar', 'ADCP'].map((name) => <label className="checkbox-row" key={name}><input type="checkbox" disabled /><span className="check-label">{name}</span><span className="data-metric-val">N/A</span></label>)}
        </div></div>}
      </div>
      <div className="data-accordion-item"><div className="accordion-header" onClick={() => setComparisonOpen(!comparisonOpen)} role="button" tabIndex={0}>
        <span className="accordion-title"><ChevronDown size={13} className={`accordion-chevron ${comparisonOpen ? 'expanded' : ''}`} />Data comparison</span><Table2 size={12} className="panel-head-icon" /></div>
        {comparisonOpen && <div className="accordion-body"><div className="comparison-tabs-row" role="tablist">
          {(['glider', 'argo', 'all'] as const).map(tab => <button type="button" role="tab" aria-selected={comparisonTab === tab} className={`comp-tab-btn ${comparisonTab === tab ? 'comp-tab-active' : ''}`} onClick={() => setComparisonTab(tab)} key={tab}>{tab === 'all' ? 'All' : `Model vs ${tab === 'argo' ? 'Argo' : 'Glider'}`}</button>)}</div>
          <table className="ariel-compact-table"><thead><tr><th>Variable</th><th>Model</th>{comparisonTab !== 'argo' && <th>Glider</th>}{comparisonTab !== 'glider' && <th>Argo</th>}</tr></thead><tbody>
            {values.map(([label, key, value, unit]) => <tr key={key}><td>{label}</td><td>{modelCell(value, unit)}</td>{comparisonTab !== 'argo' && <td>N/A</td>}{comparisonTab !== 'glider' && <td>N/A</td>}</tr>)}
          </tbody></table></div>}
      </div>
    </div>
  </aside>;
};
