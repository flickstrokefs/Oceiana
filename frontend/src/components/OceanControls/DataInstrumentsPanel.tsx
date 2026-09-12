import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Database, Table2 } from 'lucide-react';

export const DataInstrumentsPanel: React.FC = () => {
  const [modelOpen, setModelOpen] = useState(true);
  const [instrumentOpen, setInstrumentOpen] = useState(true);
  const [comparisonTab, setComparisonTab] = useState<'glider' | 'argo' | 'all'>('all');

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

  return (
    <aside className="ariel-panel panel-right-data">
      {/* 2. Data & Instruments */}
      <div className="panel-title-bar">
        <h2 className="panel-heading">2. Data & Instruments</h2>
        <Database size={14} className="panel-head-icon" />
      </div>

      <div className="panel-content-scroll">
        {/* Model Data Accordion */}
        <div className="data-accordion-item">
          <div
            className="accordion-header"
            onClick={() => setModelOpen(!modelOpen)}
            role="button"
            tabIndex={0}
          >
            <span className="accordion-title">
              {modelOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              Model Data
            </span>
            <span className="source-tag">INCOIS-IOCM</span>
          </div>

          {modelOpen && (
            <div className="accordion-body">
              <button
                type="button"
                className="ariel-btn-outline-teal btn-compact-full"
                onClick={() => alert('Add model variable dialog')}
              >
                <Plus size={12} /> Add Model Variable
              </button>

              <div className="checklist-group">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={modelVars.temp}
                    onChange={() => toggleModelVar('temp')}
                  />
                  <span className="check-label">Temperature (10 °C)</span>
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={modelVars.salinity}
                    onChange={() => toggleModelVar('salinity')}
                  />
                  <span className="check-label">Salinity (35 PSU)</span>
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={modelVars.currents}
                    onChange={() => toggleModelVar('currents')}
                  />
                  <span className="check-label">Currents (1.2 m/s)</span>
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={modelVars.chlorophyll}
                    onChange={() => toggleModelVar('chlorophyll')}
                  />
                  <span className="check-label">Chlorophyll (2 mg/m³)</span>
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={modelVars.oxygen}
                    onChange={() => toggleModelVar('oxygen')}
                  />
                  <span className="check-label">Oxygen (5 mg/L)</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Instrument Data Accordion */}
        <div className="data-accordion-item">
          <div
            className="accordion-header"
            onClick={() => setInstrumentOpen(!instrumentOpen)}
            role="button"
            tabIndex={0}
          >
            <span className="accordion-title">
              {instrumentOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              Instrument Data
            </span>
            <span className="source-tag">In-Situ Overlays</span>
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
                  <span className="check-label">Argo Floats</span>
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={instruments.gliders}
                    onChange={() => toggleInstrument('gliders')}
                  />
                  <span className="check-label">Gliders</span>
                </label>

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
                  <span className="check-label">HF-Radar</span>
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

              <button
                type="button"
                className="ariel-btn-outline-teal btn-compact-full"
                onClick={() => alert('Connect new sensor or dataset')}
              >
                <Plus size={12} /> Add Dataset
              </button>
            </div>
          )}
        </div>

        {/* 3. Data Comparison */}
        <div className="comparison-subpanel">
          <div className="comparison-title-row">
            <h3 className="subpanel-heading">3. Data Comparison</h3>
            <Table2 size={12} className="panel-head-icon" />
          </div>

          <div className="comparison-tabs-row">
            <button
              type="button"
              className={`comp-tab-btn ${comparisonTab === 'glider' ? 'comp-tab-active' : ''}`}
              onClick={() => setComparisonTab('glider')}
            >
              Model vs Glider
            </button>
            <button
              type="button"
              className={`comp-tab-btn ${comparisonTab === 'argo' ? 'comp-tab-active' : ''}`}
              onClick={() => setComparisonTab('argo')}
            >
              Model vs Argo
            </button>
            <button
              type="button"
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
                <td>Temperature (°C)</td>
                {(comparisonTab === 'all' || comparisonTab === 'glider' || comparisonTab === 'argo') && <td>18.2</td>}
                {(comparisonTab === 'all' || comparisonTab === 'glider') && <td>18.4</td>}
                {(comparisonTab === 'all' || comparisonTab === 'argo') && <td>18.1</td>}
              </tr>
              <tr>
                <td>Salinity (PSU)</td>
                {(comparisonTab === 'all' || comparisonTab === 'glider' || comparisonTab === 'argo') && <td>35.0</td>}
                {(comparisonTab === 'all' || comparisonTab === 'glider') && <td>35.1</td>}
                {(comparisonTab === 'all' || comparisonTab === 'argo') && <td>35.1</td>}
              </tr>
              <tr>
                <td>Current (m/s)</td>
                {(comparisonTab === 'all' || comparisonTab === 'glider' || comparisonTab === 'argo') && <td>0.6</td>}
                {(comparisonTab === 'all' || comparisonTab === 'glider') && <td>0.6</td>}
                {(comparisonTab === 'all' || comparisonTab === 'argo') && <td>0.6</td>}
              </tr>
              <tr>
                <td>Chlorophyll (mg/m³)</td>
                {(comparisonTab === 'all' || comparisonTab === 'glider' || comparisonTab === 'argo') && <td>0.4</td>}
                {(comparisonTab === 'all' || comparisonTab === 'glider') && <td>0.6</td>}
                {(comparisonTab === 'all' || comparisonTab === 'argo') && <td>0.8</td>}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </aside>
  );
};
