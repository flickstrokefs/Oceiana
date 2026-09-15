import React, { useState } from 'react';
import { OceanState } from '../../ocean/OceanState';
import { Search, Menu, User } from 'lucide-react';

interface HeaderControlsProps {
  onToggleSidebar?: () => void;
  onResetView?: () => void;
}

export const HeaderControls: React.FC<HeaderControlsProps> = ({
  onToggleSidebar,
}) => {
  const [viewMode, setViewMode] = useState<'3d-ocean' | 'depth-slice' | 'isosurface'>('3d-ocean');
  const [searchQuery, setSearchQuery] = useState('');

  const handleModeClick = (mode: '3d-ocean' | 'depth-slice' | 'isosurface') => {
    setViewMode(mode);
    if (mode === 'depth-slice') {
      OceanState.getInstance().setMode('underwater');
    } else {
      OceanState.getInstance().setMode('surface');
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    const q = searchQuery.toLowerCase().trim();

    if (q.includes('bengal') || q === 'bob') {
      OceanState.getInstance().requestFlyToLocation(15.0, 88.0, 1850000);
    } else if (q.includes('arabian') || q === 'as') {
      OceanState.getInstance().requestFlyToLocation(16.0, 65.0, 1850000);
    } else if (q.includes('southern') || q.includes('antarct') || q === 'so') {
      OceanState.getInstance().requestFlyToLocation(-58.0, 70.0, 3200000);
    } else {
      // Coordinate regex parser for "15.4 N, 72.2 E" or "15.4, 72.2"
      const match = q.match(/(-?\d+\.?\d*)\s*[nNsS]?,?\s*(-?\d+\.?\d*)\s*[eEwW]?/);
      if (match) {
        const lat = parseFloat(match[1]);
        const lon = parseFloat(match[2]);
        if (!isNaN(lat) && !isNaN(lon)) {
          OceanState.getInstance().requestFlyToLocation(lat, lon, 850000);
          return;
        }
      }
      // Default to central region overview
      OceanState.getInstance().requestFlyToLocation(14.0, 75.0, 2500000);
    }
  };

  return (
    <header className="ariel-top-header">
      {/* Brand Group */}
      <div className="top-brand-group">
        {onToggleSidebar && (
          <button
            type="button"
            className="header-menu-toggle"
            onClick={onToggleSidebar}
            title="Toggle ARIEL Sidebar"
          >
            <Menu size={16} />
          </button>
        )}
        <div className="brand-logo-text-horiz">
          <span className="brand-org-tag">INCOIS</span>
          <div className="brand-titles-wrap">
            <span className="brand-main-title">OCEIANA</span>
            <span className="brand-sub-title">3D Ocean Data Visualization</span>
          </div>
        </div>
      </div>

      {/* Center Search Bar */}
      <form className="top-search-form" onSubmit={handleSearchSubmit}>
        <div className="search-input-container">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search location (e.g., Arabian Sea or 15.6 N, 72.2 E)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </form>

      {/* Center Mode Selector Buttons */}
      <div className="top-mode-pills">
        <button
          type="button"
          className={`mode-pill-btn ${viewMode === '3d-ocean' ? 'mode-pill-active' : ''}`}
          onClick={() => handleModeClick('3d-ocean')}
        >
          3D Ocean
        </button>
        <button
          type="button"
          className={`mode-pill-btn ${viewMode === 'depth-slice' ? 'mode-pill-active' : ''}`}
          onClick={() => handleModeClick('depth-slice')}
        >
          Depth Slice
        </button>
        <button
          type="button"
          className={`mode-pill-btn ${viewMode === 'isosurface' ? 'mode-pill-active' : ''}`}
          onClick={() => handleModeClick('isosurface')}
        >
          Isosurface
        </button>
      </div>

      {/* Right Navigation & Avatar */}
      <div className="top-right-nav">
        <button
          type="button"
          className="top-nav-link"
          onClick={() => OceanState.getInstance().setActivePage('3d-ocean')}
        >
          Home
        </button>
        <button
          type="button"
          className="top-nav-link"
          onClick={() => OceanState.getInstance().setActivePage('data-manager')}
        >
          Datasets
        </button>
        <button
          type="button"
          className="top-nav-link"
          onClick={() => OceanState.getInstance().setActivePage('settings')}
        >
          Settings
        </button>
        <button
          type="button"
          className="top-nav-link"
          onClick={() => alert('ARIEL Documentation & Help Center')}
        >
          Help
        </button>

        <div className="user-avatar-badge" title="Forecaster Session (Active)">
          <User size={14} />
        </div>
      </div>
    </header>
  );
};
