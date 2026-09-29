import React, { useState, useEffect, useRef } from 'react';
import { OceanState } from '../../ocean/OceanState';
import { Search, Menu, User, Compass, ChevronDown, MapPin } from 'lucide-react';
import {
  UNDERWATER_REGIONS,
  type UnderwaterRegionId,
  type OceanDomainId,
} from '../../types/ocean';

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
  const [selectedDomain, setSelectedDomain] = useState<OceanDomainId | null>(null);
  const [activeRegionId, setActiveRegionId] = useState<UnderwaterRegionId | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = OceanState.getInstance().subscribe((snapshot) => {
      setSelectedDomain(snapshot.selectedOceanDomain ?? null);
      setActiveRegionId(snapshot.underwaterRegion ?? null);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleSelectSea = (seaId: UnderwaterRegionId | null) => {
    setIsDropdownOpen(false);
    if (!seaId) {
      OceanState.getInstance().setOceanDomain(null);
      OceanState.getInstance().setUnderwaterRegion(null);
      return;
    }

    if (seaId === 'southern-ocean') {
      OceanState.getInstance().setOceanDomain('southern-ocean');
      OceanState.getInstance().setUnderwaterRegion('southern-ocean');
      OceanState.getInstance().requestFlyToLocation(-67.5, 83.5, 3200000);
      return;
    }

    OceanState.getInstance().setOceanDomain('indian-ocean');
    OceanState.getInstance().setUnderwaterRegion(seaId);

    const reg = UNDERWATER_REGIONS.find((r) => r.id === seaId);
    if (reg) {
      const lat = (reg.south + reg.north) / 2;
      const lon = (reg.west + reg.east) / 2;
      OceanState.getInstance().requestFlyToLocation(lat, lon, 1850000);
    }
  };

  const handleSelectDomain = (domainId: OceanDomainId) => {
    setIsDropdownOpen(false);
    OceanState.getInstance().setOceanDomain(domainId);
    OceanState.getInstance().setUnderwaterRegion(domainId);
    if (domainId === 'southern-ocean') {
      OceanState.getInstance().requestFlyToLocation(-70.0, 65.0, 4500000);
    } else {
      OceanState.getInstance().requestFlyToLocation(-12.0, 80.0, 7800000);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    const q = searchQuery.toLowerCase().trim();

    if (q.includes('bengal') || q === 'bob') {
      OceanState.getInstance().setOceanDomain('indian-ocean');
      OceanState.getInstance().setUnderwaterRegion('bay-of-bengal');
      OceanState.getInstance().requestFlyToLocation(14.1, 87.6, 1850000);
    } else if (q.includes('arabian') || q === 'as') {
      OceanState.getInstance().setOceanDomain('indian-ocean');
      OceanState.getInstance().setUnderwaterRegion('arabian-sea');
      OceanState.getInstance().requestFlyToLocation(15.4, 65.0, 1850000);
    } else if (q.includes('andaman')) {
      OceanState.getInstance().setOceanDomain('indian-ocean');
      OceanState.getInstance().setUnderwaterRegion('andaman-sea');
      OceanState.getInstance().requestFlyToLocation(10.9, 95.5, 1850000);
    } else if (q.includes('laccadive') || q.includes('lakshadweep') || q.includes('maldives')) {
      OceanState.getInstance().setOceanDomain('indian-ocean');
      OceanState.getInstance().setUnderwaterRegion('laccadive-sea');
      OceanState.getInstance().requestFlyToLocation(6.2, 76.0, 1850000);
    } else if (q.includes('java')) {
      OceanState.getInstance().setOceanDomain('indian-ocean');
      OceanState.getInstance().setUnderwaterRegion('java-sea');
      OceanState.getInstance().requestFlyToLocation(-5.0, 111.0, 1850000);
    } else if (q.includes('southern') || q.includes('antarct') || q === 'so') {
      OceanState.getInstance().setOceanDomain('southern-ocean');
      OceanState.getInstance().setUnderwaterRegion('southern-ocean');
      OceanState.getInstance().requestFlyToLocation(-67.5, 83.5, 3200000);
    } else if (q.includes('indian ocean')) {
      OceanState.getInstance().setOceanDomain('indian-ocean');
      OceanState.getInstance().requestFlyToLocation(10.0, 78.0, 3200000);
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

  const activeRegionDef = activeRegionId
    ? UNDERWATER_REGIONS.find((r) => r.id === activeRegionId)
    : null;

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

      {/* Center Search Bar & Domain/Sea Selector */}
      <div className="top-search-and-domain-group">
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

        {/* Dynamic Sea & Ocean Domain Selector Trigger */}
        <div ref={dropdownRef} className="header-domain-sea-dropdown">
          <button
            type="button"
            className={`domain-sea-trigger-btn ${activeRegionDef || selectedDomain ? 'trigger-selected' : ''}`}
            onClick={() => setIsDropdownOpen((v) => !v)}
            title="Select Ocean Domain or Marginal Sea"
          >
            <Compass size={12} className="trigger-icon" />
            <span className="trigger-label">
              {activeRegionDef
                ? activeRegionDef.name.toUpperCase()
                : selectedDomain === 'southern-ocean'
                ? 'SOUTHERN OCEAN'
                : selectedDomain === 'indian-ocean'
                ? 'INDIAN OCEAN'
                : 'SELECT REGION'}
            </span>
            <ChevronDown size={11} className="trigger-caret" />
          </button>

          {isDropdownOpen && (
            <div className="domain-sea-menu">
              <div className="dropdown-section-title">// MISSION DOMAINS</div>
              <button
                type="button"
                className={`menu-option-btn ${selectedDomain === 'indian-ocean' && !activeRegionId ? 'opt-active' : ''}`}
                onClick={() => handleSelectDomain('indian-ocean')}
              >
                <span>INDIAN OCEAN DOMAIN (OVERVIEW)</span>
              </button>
              <button
                type="button"
                className={`menu-option-btn ${selectedDomain === 'southern-ocean' ? 'opt-active' : ''}`}
                onClick={() => handleSelectDomain('southern-ocean')}
              >
                <span>SOUTHERN OCEAN DOMAIN</span>
              </button>

              <div className="dropdown-section-title">// REGIONAL SEAS (COMPASS)</div>
              {UNDERWATER_REGIONS.filter(
                (r) => r.id !== 'southern-ocean' && r.id !== 'indian-ocean'
              ).map((sea) => (
                <button
                  key={sea.id}
                  type="button"
                  className={`menu-option-btn ${activeRegionId === sea.id ? 'opt-active' : ''}`}
                  onClick={() => handleSelectSea(sea.id)}
                >
                  <MapPin size={10} />
                  <span>{sea.name}</span>
                </button>
              ))}

              <div className="dropdown-divider" />
              <button
                type="button"
                className="menu-option-btn opt-clear"
                onClick={() => handleSelectSea(null)}
              >
                <span>HIDE COMPASS (CLEAR SELECTION)</span>
              </button>
            </div>
          )}
        </div>
      </div>

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