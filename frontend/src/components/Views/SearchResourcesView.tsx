import React, { useState } from 'react';
import { Search, SlidersHorizontal, ArrowUpRight } from 'lucide-react';
import { OceanState } from '../../ocean/OceanState';

interface SearchResultItem {
  id: string;
  title: string;
  source: string;
  variables: string;
  spatial: string;
  temporal: string;
  type: string;
}

const SEARCH_ITEMS: SearchResultItem[] = [
  {
    id: 'res-1',
    title: 'INCOIS Indian Ocean Model (IOCM)',
    source: 'Numerical Simulation',
    variables: 'Temperature, Salinity, Currents, BGC',
    spatial: 'Indian Ocean',
    temporal: '2000 - Present',
    type: 'Model',
  },
  {
    id: 'res-2',
    title: 'Argo Float Profiles (Global)',
    source: 'In-Situ Profilers',
    variables: 'Temperature, Salinity, Oxygen',
    spatial: 'Global',
    temporal: '2000 - Present',
    type: 'Argo',
  },
  {
    id: 'res-3',
    title: 'Glider Observations (Indian Ocean)',
    source: 'Autonomous Gliders',
    variables: 'Temperature, Salinity, Currents',
    spatial: 'Indian Ocean',
    temporal: '2019 - Present',
    type: 'Glider',
  },
  {
    id: 'res-4',
    title: 'Arabian Sea Mooring Array (RAMA)',
    source: 'Moored Buoy Network',
    variables: 'Temperature, Salinity, Winds, Fluxes',
    spatial: 'Arabian Sea',
    temporal: '2004 - 2024',
    type: 'Mooring',
  },
];

export const SearchResourcesView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'search' | 'resources' | 'saved'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [datasetType, setDatasetType] = useState('All');
  const [region, setRegion] = useState('All Regions');
  const [instrument, setInstrument] = useState('All');
  const [depthRange, setDepthRange] = useState('0 - 2000 m');
  const [timeRange, setTimeRange] = useState('2009 - 2024');
  const [source, setSource] = useState('All');
  const [results, setResults] = useState<SearchResultItem[]>(SEARCH_ITEMS);

  React.useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (datasetType && datasetType !== 'All') params.set('type', datasetType);
    if (region) params.set('region', region);

    fetch(`/api/search?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setResults(data);
        }
      })
      .catch(() => {
        // Fall back to static items
      });
  }, [searchQuery, datasetType, region]);

  const handleView = (item: SearchResultItem) => {
    if (item.type === 'Argo' || item.type === 'Glider') {
      OceanState.getInstance().setActivePage('obs-profile');
    } else {
      OceanState.getInstance().setActivePage('3d-ocean');
    }
  };

  return (
    <div className="ariel-view-container search-resources-view">
      {/* Top Tabs */}
      <div className="view-top-tabs">
        <button
          type="button"
          className={`view-tab-btn ${activeTab === 'search' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          Search Data
        </button>
        <button
          type="button"
          className={`view-tab-btn ${activeTab === 'resources' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('resources')}
        >
          Resources
        </button>
        <button
          type="button"
          className={`view-tab-btn ${activeTab === 'saved' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('saved')}
        >
          Saved Items
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="search-bar-row">
        <div className="search-input-wrap">
          <Search size={15} className="search-icon-left text-teal" />
          <input
            type="text"
            className="ariel-search-field"
            placeholder="Search datasets, variables, regions, instruments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button type="button" className="ariel-btn-teal btn-md">
          Search
        </button>
        <button type="button" className="ariel-btn-outline-teal btn-md">
          <SlidersHorizontal size={13} /> Advanced
        </button>
      </div>

      {/* Filter Controls Row */}
      <div className="search-filters-row">
        <div className="filter-item">
          <span className="filter-label">Dataset Type</span>
          <select
            className="ariel-select select-xs"
            value={datasetType}
            onChange={(e) => setDatasetType(e.target.value)}
          >
            <option value="All">All</option>
            <option value="Model">Model</option>
            <option value="Argo">Argo</option>
            <option value="Glider">Glider</option>
            <option value="Mooring">Mooring</option>
          </select>
        </div>

        <div className="filter-item">
          <span className="filter-label">Region</span>
          <select
            className="ariel-select select-xs"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            <option value="All Regions">All Regions (3 Basins)</option>
            <option value="Bay of Bengal">Bay of Bengal</option>
            <option value="Arabian Sea">Arabian Sea</option>
            <option value="Southern Ocean">Southern Ocean</option>
          </select>
        </div>

        <div className="filter-item">
          <span className="filter-label">Instrument</span>
          <select
            className="ariel-select select-xs"
            value={instrument}
            onChange={(e) => setInstrument(e.target.value)}
          >
            <option value="All">All</option>
            <option value="Argo Floats">Argo Floats</option>
            <option value="Gliders">Gliders</option>
            <option value="CTD/BGC">CTD/BGC</option>
            <option value="HF-Radar">HF-Radar</option>
          </select>
        </div>

        <div className="filter-item">
          <span className="filter-label">Depth Range</span>
          <select
            className="ariel-select select-xs"
            value={depthRange}
            onChange={(e) => setDepthRange(e.target.value)}
          >
            <option value="0 - 2000 m">0 - 2000 m</option>
            <option value="0 - 500 m">0 - 500 m</option>
            <option value="500 - 2000 m">500 - 2000 m</option>
            <option value="Deep Abyssal">Deep Abyssal (&gt;2000m)</option>
          </select>
        </div>

        <div className="filter-item">
          <span className="filter-label">Time Range</span>
          <select
            className="ariel-select select-xs"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <option value="2009 - 2024">2009 - 2024</option>
            <option value="Last 30 Days">Last 30 Days</option>
            <option value="Last 1 Year">Last 1 Year</option>
            <option value="Historical Archive">Historical Archive</option>
          </select>
        </div>

        <div className="filter-item">
          <span className="filter-label">Source</span>
          <select
            className="ariel-select select-xs"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="All">All</option>
            <option value="INCOIS">INCOIS</option>
            <option value="Copernicus">Copernicus</option>
            <option value="Ifremer">Ifremer</option>
          </select>
        </div>
      </div>

      {/* Results Section */}
      <div className="search-results-section">
        <div className="results-header">
          <span className="results-count-title">Search Results (114)</span>
          <span className="results-filter-summary">Filtered by Indian Ocean · NetCDF & In-Situ</span>
        </div>

        <div className="results-cards-grid">
          {results.map((item) => (
            <div key={item.id} className="resource-result-card">
              <div className="res-card-top">
                <div className="res-title-group">
                  <h3 className="res-card-title">{item.title}</h3>
                  <span className="res-source-badge">{item.source}</span>
                </div>
                <button
                  type="button"
                  className="ariel-btn-teal btn-xs"
                  onClick={() => handleView(item)}
                >
                  View <ArrowUpRight size={11} />
                </button>
              </div>

              <div className="res-meta-specs">
                <div className="res-spec-item">
                  <span className="res-spec-label">Variables:</span>
                  <span className="res-spec-val text-teal">{item.variables}</span>
                </div>
                <div className="res-spec-item">
                  <span className="res-spec-label">Spatial:</span>
                  <span className="res-spec-val">{item.spatial}</span>
                  <span className="res-spec-divider">|</span>
                  <span className="res-spec-label">Temporal:</span>
                  <span className="res-spec-val font-mono">{item.temporal}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
