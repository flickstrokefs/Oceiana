import React, { useState } from 'react';
import { OceanState } from '../../ocean/OceanState';
import { Search, Menu, User } from 'lucide-react';

interface HeaderControlsProps {
  onToggleSidebar?: () => void;
  onResetView?: () => void;
}

export const HeaderControls: React.FC<HeaderControlsProps> = ({
  onToggleSidebar,
  onResetView,
}) => {
  const [viewMode, setViewMode] = useState<
    '3d-ocean' | 'underwater' | 'depth-slice' | 'isosurface'
  >('3d-ocean');
  const [searchQuery, setSearchQuery] = useState('');

  const handleModeClick = (
    mode: '3d-ocean' | 'underwater' | 'depth-slice' | 'isosurface'
  ) => {
    setViewMode(mode);

    if (mode === 'underwater' || mode === 'depth-slice') {
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
      {/* Brand & Menu Bar Group */}
      <div className="top-brand-group">
        {onToggleSidebar && (
          <button
            type="button"
            className="header-menu-toggle"
            onClick={onToggleSidebar}
            title="Toggle Sidebar"
            aria-label="Toggle Sidebar"
          >
            <Menu size={14} />
          </button>
        )}
        <a
          href="/"
          className="brand-logo-text-horiz"
          title="Return to ARIEL Landing Page"
          style={{ textDecoration: 'none', cursor: 'pointer' }}
          onClick={(e) => {
            if (window.parent && window.parent !== window) {
              e.preventDefault();
              window.parent.postMessage({ type: 'ARIEL_CLOSE_GLOBE' }, '*');
            }
          }}
        >
          <span className="brand-org-tag">INCOIS</span>
          <span className="brand-divider">/</span>
          <span className="brand-main-title">ARIEL</span>
          <span className="brand-sub-title">Advanced Ocean Intelligence</span>
        </a>

        {/* Desktop Menu Bar (Section 9) */}
        <nav className="desktop-menu-bar" aria-label="Application Menu">
          <button
            type="button"
            className="menu-bar-item"
            onClick={() => onResetView?.()}
            title="File menu"
          >
            File
          </button>
          <button
            type="button"
            className="menu-bar-item"
            onClick={() => onResetView?.()}
            title="Reset Camera View"
          >
            View
          </button>
          <button
            type="button"
            className="menu-bar-item"
            onClick={() => OceanState.getInstance().setActivePage('3d-ocean')}
            title="Toggle layers"
          >
            Layers
          </button>
          <button
            type="button"
            className="menu-bar-item"
            onClick={() => OceanState.getInstance().setActivePage('obs-profile')}
            title="Open Observation Profile Analysis"
          >
            Tools
          </button>
          <button
            type="button"
            className="menu-bar-item"
            onClick={() => onResetView?.()}
            title="Window view"
          >
            Window
          </button>
          <button
            type="button"
            className="menu-bar-item"
            onClick={() =>
              alert(
                'ARIEL Ocean Intelligence Platform\nINCOIS / Ministry of Earth Sciences\nProblem Statement: SIH26067'
              )
            }
            title="Help & Reference"
          >
            Help
          </button>
        </nav>
      </div>

      {/* Center Search Bar - Rectangular, restrained */}
      <form className="top-search-form" onSubmit={handleSearchSubmit}>
        <div className="search-input-container">
          <Search size={13} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search location (e.g. Arabian Sea or 15.4 N, 73.2 E)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </form>

      {/* Center Mode Selector Buttons - Compact rectangular */}
      <div className="top-mode-pills" role="tablist" aria-label="Visualization Mode">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === '3d-ocean'}
          className={`mode-pill-btn ${
            viewMode === '3d-ocean' ? 'mode-pill-active' : ''
          }`}
          onClick={() => handleModeClick('3d-ocean')}
        >
          Surface
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'underwater'}
          className={`mode-pill-btn ${
            viewMode === 'underwater' ? 'mode-pill-active' : ''
          }`}
          onClick={() => handleModeClick('underwater')}
        >
          Underwater
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'depth-slice'}
          className={`mode-pill-btn ${
            viewMode === 'depth-slice' ? 'mode-pill-active' : ''
          }`}
          onClick={() => handleModeClick('depth-slice')}
        >
          Depth Slice
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'isosurface'}
          className={`mode-pill-btn ${
            viewMode === 'isosurface' ? 'mode-pill-active' : ''
          }`}
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
          onClick={() =>
            OceanState.getInstance().setActivePage('data-manager')
          }
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
          onClick={() =>
            alert(
              'ARIEL Documentation & Help Center\nINCOIS / Ministry of Earth Sciences'
            )
          }
        >
          Help
        </button>

        <div
          className="user-avatar-badge"
          title="INCOIS Forecaster Session (Operational)"
        >
          <User size={13} />
        </div>
      </div>
    </header>
  );
};