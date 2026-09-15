import React, { useState } from 'react';
import {
  UploadCloud,
  FileCheck,
  Eye,
  Settings,
  Trash2,
  CheckCircle2,
} from 'lucide-react';

interface DatasetEntry {
  id: string;
  name: string;
  type: string;
  variables: string;
  dateRange: string;
  status: 'Loaded' | 'Processing' | 'Ready';
}

const INITIAL_DATASETS: DatasetEntry[] = [
  {
    id: 'ds-1',
    name: 'INDIAN_OCEAN_MODEL.nc',
    type: 'Model',
    variables: 'Temp, Sal, Currents',
    dateRange: '2019 - 2024',
    status: 'Loaded',
  },
  {
    id: 'ds-2',
    name: 'Argo_Profiles.nc',
    type: 'Argo',
    variables: 'Temp, Sal, Oxy',
    dateRange: '2024',
    status: 'Loaded',
  },
  {
    id: 'ds-3',
    name: 'Glider_2024.csv',
    type: 'Glider',
    variables: 'Temp, Sal, Oxy',
    dateRange: '2024',
    status: 'Loaded',
  },
  {
    id: 'ds-4',
    name: 'CTD_Cruise.txt',
    type: 'CTD',
    variables: 'Temp, Sal',
    dateRange: '2023',
    status: 'Loaded',
  },
  {
    id: 'ds-5',
    name: 'BGC_Data.nc',
    type: 'BGC',
    variables: 'Chl, Oxygen, Nitrate',
    dateRange: '2022 - 2024',
    status: 'Loaded',
  },
];

export const DataManagerView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'upload' | 'sources' | 'configured'>('upload');
  const [datasets, setDatasets] = useState<DatasetEntry[]>(INITIAL_DATASETS);
  const [isDragging, setIsDragging] = useState(false);

  React.useEffect(() => {
    fetch('/api/datasets')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((d: { id: string; name: string; type: string; variables: string; date_range: string; status: string }) => ({
            id: d.id,
            name: d.name,
            type: d.type,
            variables: d.variables,
            dateRange: d.date_range,
            status: d.status as 'Loaded' | 'Processing' | 'Ready',
          }));
          setDatasets(mapped);
        }
      })
      .catch(() => {
        // Keep initial datasets fallback
      });
  }, []);

  const [detectedVars, setDetectedVars] = useState({
    lat: true,
    lon: true,
    depth: true,
    time: true,
    temp: true,
    sal: true,
    chl: false,
    currents: false,
  });

  const toggleVar = (key: keyof typeof detectedVars) => {
    setDetectedVars((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleImport = () => {
    alert('Importing dataset with selected variable mapping into NetCDF parser module...');
  };

  const handleDelete = (id: string) => {
    setDatasets((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div className="ariel-view-container data-manager-view">
      {/* Top Tabs */}
      <div className="view-top-tabs">
        <button
          type="button"
          className={`view-tab-btn ${activeTab === 'upload' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          Upload Dataset
        </button>
        <button
          type="button"
          className={`view-tab-btn ${activeTab === 'sources' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('sources')}
        >
          Available Sources
        </button>
        <button
          type="button"
          className={`view-tab-btn ${activeTab === 'configured' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('configured')}
        >
          Configured Datasets
        </button>
      </div>

      {/* Main Content */}
      <div className="data-manager-grid">
        {/* Upper Split Row */}
        <div className="upload-section-row">
          {/* Drag and drop zone */}
          <div
            className={`dropzone-card ${isDragging ? 'dropzone-active' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              alert('File uploaded: ' + (e.dataTransfer.files[0]?.name || 'dataset'));
            }}
          >
            <UploadCloud size={38} className="dropzone-icon text-teal" />
            <p className="dropzone-text-primary">Drag and drop files here</p>
            <span className="dropzone-text-divider">or</span>
            <label className="ariel-btn-teal btn-sm cursor-pointer">
              Choose File
              <input
                type="file"
                className="hidden"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) alert(`Loaded file: ${file.name}`);
                }}
              />
            </label>
            <span className="dropzone-support-formats">
              Supported formats: NetCDF (.nc), CSV, TXT, TSV
            </span>
          </div>

          {/* Detected Variables Card */}
          <div className="detected-variables-card">
            <div className="card-head-simple">
              <span className="card-title">Detected Variables (Example)</span>
              <FileCheck size={14} className="text-teal" />
            </div>

            <div className="variables-checkbox-grid">
              <label className="checkbox-row-compact">
                <input
                  type="checkbox"
                  checked={detectedVars.lat}
                  onChange={() => toggleVar('lat')}
                />
                <span>Latitude</span>
              </label>

              <label className="checkbox-row-compact">
                <input
                  type="checkbox"
                  checked={detectedVars.temp}
                  onChange={() => toggleVar('temp')}
                />
                <span>Temperature</span>
              </label>

              <label className="checkbox-row-compact">
                <input
                  type="checkbox"
                  checked={detectedVars.lon}
                  onChange={() => toggleVar('lon')}
                />
                <span>Longitude</span>
              </label>

              <label className="checkbox-row-compact">
                <input
                  type="checkbox"
                  checked={detectedVars.sal}
                  onChange={() => toggleVar('sal')}
                />
                <span>Salinity</span>
              </label>

              <label className="checkbox-row-compact">
                <input
                  type="checkbox"
                  checked={detectedVars.depth}
                  onChange={() => toggleVar('depth')}
                />
                <span>Depth</span>
              </label>

              <label className="checkbox-row-compact">
                <input
                  type="checkbox"
                  checked={detectedVars.chl}
                  onChange={() => toggleVar('chl')}
                />
                <span>Chlorophyll</span>
              </label>

              <label className="checkbox-row-compact">
                <input
                  type="checkbox"
                  checked={detectedVars.time}
                  onChange={() => toggleVar('time')}
                />
                <span>Time</span>
              </label>

              <label className="checkbox-row-compact">
                <input
                  type="checkbox"
                  checked={detectedVars.currents}
                  onChange={() => toggleVar('currents')}
                />
                <span>Currents (U,V)</span>
              </label>
            </div>

            <button
              type="button"
              className="ariel-btn-teal btn-compact-full mt-auto"
              onClick={handleImport}
            >
              Import Dataset
            </button>
          </div>
        </div>

        {/* Existing Datasets Section */}
        <div className="existing-datasets-panel">
          <div className="panel-head-simple">
            <span className="panel-title">Existing Datasets</span>
            <span className="datasets-count-chip">{datasets.length} Active</span>
          </div>

          <div className="table-responsive">
            <table className="ariel-styled-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Variables</th>
                  <th>Date Range</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((ds) => (
                  <tr key={ds.id}>
                    <td className="font-mono text-white font-medium">{ds.name}</td>
                    <td>
                      <span className={`type-badge badge-${ds.type.toLowerCase()}`}>
                        {ds.type}
                      </span>
                    </td>
                    <td className="text-slate-300">{ds.variables}</td>
                    <td className="text-slate-400 font-mono text-xs">{ds.dateRange}</td>
                    <td>
                      <span className="status-badge-loaded">
                        <CheckCircle2 size={11} className="inline mr-1" />
                        {ds.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="table-actions-group">
                        <button
                          type="button"
                          className="table-action-btn"
                          title="Preview dataset"
                          onClick={() => alert(`Previewing ${ds.name}`)}
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          type="button"
                          className="table-action-btn"
                          title="Configure schema"
                          onClick={() => alert(`Configuring ${ds.name}`)}
                        >
                          <Settings size={13} />
                        </button>
                        <button
                          type="button"
                          className="table-action-btn action-delete"
                          title="Delete dataset"
                          onClick={() => handleDelete(ds.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
