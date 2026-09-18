import React, { useEffect, useState } from 'react';
import { ChevronDown, Database, Table2, Navigation } from 'lucide-react';
import { OceanState } from '../../ocean/OceanState';
import type { ArgoProfile, GliderTrajectory } from '../../types/ocean';

export const DataInstrumentsPanel: React.FC = () => {
  const [modelOpen, setModelOpen] = useState(true);
  const [instrumentOpen, setInstrumentOpen] = useState(true);
  const [comparisonOpen, setComparisonOpen] = useState(true);
  const [comparisonTab, setComparisonTab] = useState<'glider' | 'argo' | 'all'>('all');
  const [glidersList, setGlidersList] = useState<GliderTrajectory[]>(() => OceanState.getInstance().getGliders());
  const [argoList, setArgoList] = useState<ArgoProfile[]>(() => OceanState.getInstance().getArgoProfiles());

  useEffect(() => {
    const unsub = OceanState.getInstance().subscribe((snapshot) => {
      if (snapshot.gliders && snapshot.gliders.length > 0) {
        setGlidersList(snapshot.gliders);
      }
      if (snapshot.argoProfiles && snapshot.argoProfiles.length > 0) {
        setArgoList(snapshot.argoProfiles);
      }
    });
    return unsub;
  }, []);

  // Model variable selections
  const [modelVars, setModelVars] = useState({
    temp: true,
    salinity: false,
    currents: true,
    chlorophyll: false,
    oxygen: false,
  });

  // Instrument selections
  const [instruments, setInstruments] = useState({
    argo: true,
    gliders: true,
    ctd: false,
    bgc: false,
    moorings: false,
    hfRadar: false,
    adcp: false,
  });

  const toggleModelVar = (key: keyof typeof modelVars) => {
    setModelVars((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleInstrument = (key: keyof typeof instruments) => {
    setInstruments((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFlyToGlider = (glider: GliderTrajectory) => {
    OceanState.getInstance().selectObservation({ type: 'glider', data: glider });
    const latest = glider.waypoints[glider.waypoints.length - 1];
    if (latest) {
      OceanState.getInstance().requestFlyToLocation(latest.latitude, latest.longitude, 750000);
    }
  };

  return (
    <aside className="ariel-panel panel-right-data" aria-label="Data & Instruments">
      {/* Title Bar - No numerical prefix */}
      <div className="panel-title-bar">
        <h2 className="panel-heading">Data & Instruments</h2>
        <Database size={13} className="panel-head-icon" />
      </div>

      <div className="panel-content-scroll">
        {/* Section 1: Model Data */}
        <div className="data-accordion-item">
          <div
            className="accordion-header"
            onClick={() => setModelOpen(!modelOpen)}
            role="button"
            tabIndex={0}
          >
            <span className="accordion-title">
              <ChevronDown
                size={13}
                className={`accordion-chevron ${modelOpen ? 'expanded' : ''}`}
              />
              Model data — INCOIS-IOCM
            </span>
          </div>

          {modelOpen && (
            <div className="accordion-body">
              <div className="checklist-group">
                <label className="data-metric-row">
                  <div className="data-metric-label">
                    <input
                      type="checkbox"
                      checked={modelVars.temp}
                      onChange={() => toggleModelVar('temp')}
                    />
                    <span>Temperature</span>
                  </div>
                  <span className="data-metric-val">10°C</span>
                </label>

                <label className="data-metric-row">
                  <div className="data-metric-label">
                    <input
                      type="checkbox"
                      checked={modelVars.salinity}
                      onChange={() => toggleModelVar('salinity')}
                    />
                    <span>Salinity</span>
                  </div>
                  <span className="data-metric-val">35 PSU</span>
                </label>

                <label className="data-metric-row">
                  <div className="data-metric-label">
                    <input
                      type="checkbox"
                      checked={modelVars.currents}
                      onChange={() => toggleModelVar('currents')}
                    />
                    <span>Currents</span>
                  </div>
                  <span className="data-metric-val">1.2 m/s</span>
                </label>

                <label className="data-metric-row">
                  <div className="data-metric-label">
                    <input
                      type="checkbox"
                      checked={modelVars.chlorophyll}
                      onChange={() => toggleModelVar('chlorophyll')}
                    />
                    <span>Chlorophyll</span>
                  </div>
                  <span className="data-metric-val">2 mg/m³</span>
                </label>

                <label className="data-metric-row">
                  <div className="data-metric-label">
                    <input
                      type="checkbox"
                      checked={modelVars.oxygen}
                      onChange={() => toggleModelVar('oxygen')}
                    />
                    <span>Oxygen</span>
                  </div>
                  <span className="data-metric-val">5 mg/L</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Instrument Data */}
        <div className="data-accordion-item">
          <div
            className="accordion-header"
            onClick={() => setInstrumentOpen(!instrumentOpen)}
            role="button"
            tabIndex={0}
          >
            <span className="accordion-title">
              <ChevronDown
                size={13}
                className={`accordion-chevron ${instrumentOpen ? 'expanded' : ''}`}
              />
              Instrument data
            </span>
          </div>

          {instrumentOpen && (
            <div className="accordion-body">
              <div className="checklist-group">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={instruments.argo}
                    onChange={() => toggleInstrument('argo')}
                  />
                  <span className="check-label">Argo floats</span>
                  {argoList.length > 0 && (
                    <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#c79a5b', fontFamily: 'monospace', fontWeight: 600 }}>
                      {argoList.length} ACTIVE
                    </span>
                  )}
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={instruments.gliders}
                    onChange={() => toggleInstrument('gliders')}
                  />
                  <span className="check-label">Gliders</span>
                  {glidersList.length > 0 && (
                    <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#00f0ff', fontFamily: 'monospace', fontWeight: 600 }}>
                      {glidersList.length} ACTIVE
                    </span>
                  )}
                </label>

                {instruments.gliders && glidersList.length > 0 && (
                  <div style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px', margin: '4px 0 6px 0' }}>
                    {glidersList.map((g) => {
                      return (
                        <div
                          key={g.id}
                          onClick={() => handleFlyToGlider(g)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px 6px',
                            background: 'rgba(0, 240, 255, 0.05)',
                            border: '1px solid rgba(0, 240, 255, 0.18)',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          title={`Focus camera on ${g.name}`}
                        >
                          <span style={{ color: '#cbd5e1', fontSize: '10px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }}>
                            ● {g.name.replace(/\(.*\)/, '').trim()}
                          </span>
                          <span style={{ color: '#00f0ff', fontSize: '9px', fontFamily: 'monospace', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Navigation size={9} />
                            VIEW
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={instruments.ctd}
                    onChange={() => toggleInstrument('ctd')}
                  />
                  <span className="check-label">CTD</span>
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={instruments.bgc}
                    onChange={() => toggleInstrument('bgc')}
                  />
                  <span className="check-label">BGC</span>
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={instruments.moorings}
                    onChange={() => toggleInstrument('moorings')}
                  />
                  <span className="check-label">Moorings</span>
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={instruments.hfRadar}
                    onChange={() => toggleInstrument('hfRadar')}
                  />
                  <span className="check-label">HF Radar</span>
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={instruments.adcp}
                    onChange={() => toggleInstrument('adcp')}
                  />
                  <span className="check-label">ADCP</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Data Comparison - No numerical prefix */}
        <div className="data-accordion-item">
          <div
            className="accordion-header"
            onClick={() => setComparisonOpen(!comparisonOpen)}
            role="button"
            tabIndex={0}
          >
            <span className="accordion-title">
              <ChevronDown
                size={13}
                className={`accordion-chevron ${comparisonOpen ? 'expanded' : ''}`}
              />
              Data comparison
            </span>
            <Table2 size={12} className="panel-head-icon" />
          </div>

          {comparisonOpen && (
            <div className="accordion-body">
              <div className="comparison-tabs-row" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={comparisonTab === 'glider'}
                  className={`comp-tab-btn ${comparisonTab === 'glider' ? 'comp-tab-active' : ''}`}
                  onClick={() => setComparisonTab('glider')}
                >
                  Model vs Glider
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={comparisonTab === 'argo'}
                  className={`comp-tab-btn ${comparisonTab === 'argo' ? 'comp-tab-active' : ''}`}
                  onClick={() => setComparisonTab('argo')}
                >
                  Model vs Argo
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={comparisonTab === 'all'}
                  className={`comp-tab-btn ${comparisonTab === 'all' ? 'comp-tab-active' : ''}`}
                  onClick={() => setComparisonTab('all')}
                >
                  All
                </button>
              </div>

              <table className="ariel-compact-table">
                <thead>
                  <tr>
                    <th>Variable</th>
                    {(comparisonTab === 'all' || comparisonTab === 'glider' || comparisonTab === 'argo') && <th>Model</th>}
                    {(comparisonTab === 'all' || comparisonTab === 'glider') && <th>Glider</th>}
                    {(comparisonTab === 'all' || comparisonTab === 'argo') && <th>Argo</th>}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Temperature °C</td>
                    {(comparisonTab === 'all' || comparisonTab === 'glider' || comparisonTab === 'argo') && <td>18.2</td>}
                    {(comparisonTab === 'all' || comparisonTab === 'glider') && <td>18.4</td>}
                    {(comparisonTab === 'all' || comparisonTab === 'argo') && <td>18.1</td>}
                  </tr>
                  <tr>
                    <td>Salinity PSU</td>
                    {(comparisonTab === 'all' || comparisonTab === 'glider' || comparisonTab === 'argo') && <td>35.0</td>}
                    {(comparisonTab === 'all' || comparisonTab === 'glider') && <td>35.1</td>}
                    {(comparisonTab === 'all' || comparisonTab === 'argo') && <td>35.1</td>}
                  </tr>
                  <tr>
                    <td>Current m/s</td>
                    {(comparisonTab === 'all' || comparisonTab === 'glider' || comparisonTab === 'argo') && <td>0.6</td>}
                    {(comparisonTab === 'all' || comparisonTab === 'glider') && <td>0.6</td>}
                    {(comparisonTab === 'all' || comparisonTab === 'argo') && <td>0.6</td>}
                  </tr>
                  <tr>
                    <td>Chlorophyll mg/m³</td>
                    {(comparisonTab === 'all' || comparisonTab === 'glider' || comparisonTab === 'argo') && <td>0.4</td>}
                    {(comparisonTab === 'all' || comparisonTab === 'glider') && <td>0.6</td>}
                    {(comparisonTab === 'all' || comparisonTab === 'argo') && <td>0.8</td>}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
