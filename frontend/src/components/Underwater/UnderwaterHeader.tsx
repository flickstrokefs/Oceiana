import React, {
  useEffect,
  useState,
  useRef,
} from 'react';

import { OceanState } from '../../ocean/OceanState';

import {
  UNDERWATER_REGIONS,
  OCEAN_DOMAINS,
  type OceanMode,
  type OceanVariable,
  type UnderwaterRegionId,
  type OceanDomainId,
} from '../../types/ocean';

import {
  Compass,
  Waves,
  Layers,
  MapPin,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Globe2,
} from 'lucide-react';

interface UnderwaterHeaderProps {
  onResetView?: () => void;
}

export const UnderwaterHeader: React.FC<
  UnderwaterHeaderProps
> = ({ onResetView }) => {
  const [depth, setDepth] =
    useState<number>(0);

  const [activeVar, setActiveVar] =
    useState<OceanVariable>(
      'temperature',
    );

  const [activeRegionId, setActiveRegionId] =
    useState<UnderwaterRegionId | null>(
      null,
    );

  const [selectedDomain, setSelectedDomain] =
    useState<OceanDomainId>(
      'indian-ocean',
    );

  const [isRegionOpen, setIsRegionOpen] =
    useState(false);

  const [isDomainOpen, setIsDomainOpen] =
    useState(false);

  const dropdownRef =
    useRef<HTMLDivElement>(null);

  const domainDropdownRef =
    useRef<HTMLDivElement>(null);

  const oceanState =
    OceanState.getInstance();

  // ============================================================
  // STATE SUBSCRIPTION
  // ============================================================

  useEffect(() => {
    const unsubscribe =
      oceanState.subscribe(
        (snapshot) => {
          setDepth(
            snapshot.parameters.depth,
          );

          setActiveVar(
            snapshot.activeVariable,
          );

          setActiveRegionId(
            snapshot.underwaterRegion,
          );

          const snapshotWithDomain =
            snapshot as typeof snapshot & {
              selectedOceanDomain?: OceanDomainId;
            };

          if (
            snapshotWithDomain.selectedOceanDomain
          ) {
            setSelectedDomain(
              snapshotWithDomain.selectedOceanDomain,
            );
          }
        },
      );

    return unsubscribe;
  }, [oceanState]);

  // ============================================================
  // CLOSE DROPDOWNS
  // ============================================================

  useEffect(() => {
    const handleClickOutside = (
      event: MouseEvent,
    ) => {
      const target =
        event.target as Node;

      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(
          target,
        )
      ) {
        setIsRegionOpen(false);
      }

      if (
        domainDropdownRef.current &&
        !domainDropdownRef.current.contains(
          target,
        )
      ) {
        setIsDomainOpen(false);
      }
    };

    document.addEventListener(
      'mousedown',
      handleClickOutside,
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside,
      );
    };
  }, []);

  // ============================================================
  // MODE
  // ============================================================

  const handleModeChange = (
    mode: OceanMode,
  ) => {
    oceanState.setMode(mode);
  };

  // ============================================================
  // VARIABLE
  // ============================================================

  const handleVarChange = (
    variable: OceanVariable,
  ) => {
    oceanState.setActiveVariable(
      variable,
    );
  };

  // ============================================================
  // DOMAIN STATE
  // ============================================================

  const setDomainSafely = (
    domainId: OceanDomainId,
  ) => {
    const state =
      oceanState as typeof oceanState & {
        setOceanDomain?: (
          id: OceanDomainId,
        ) => void;
      };

    if (
      typeof state.setOceanDomain ===
      'function'
    ) {
      state.setOceanDomain(
        domainId,
      );
    }

    setSelectedDomain(
      domainId,
    );
  };

  // ============================================================
  // DOMAIN CLICK
  //
  // IMPORTANT:
  //
  // Clicking an ocean domain ALSO activates its
  // underwater geometry immediately.
  //
  // This is intentionally NOT set to null.
  // ============================================================

  const handleDomainSelect = (
    domainId: OceanDomainId,
  ) => {
    const domain =
      OCEAN_DOMAINS.find(
        (item) =>
          item.id ===
          domainId,
      );

    if (!domain) {
      return;
    }

    // 1. Set ocean domain
    setDomainSafely(
      domainId,
    );

    // 2. Close dropdown
    setIsDomainOpen(false);

    // ========================================================
    // SOUTHERN OCEAN
    // ========================================================

    if (domainId === 'southern-ocean') {
      oceanState.setOceanDomain('southern-ocean');
      setActiveRegionId('southern-ocean');
      return;
    }

    // ========================================================
    // INDIAN OCEAN
    // ========================================================

    if (domainId === 'indian-ocean') {
      oceanState.setOceanDomain('indian-ocean');
      setActiveRegionId('indian-ocean');
      return;
    }
  };

  // ============================================================
  // INDIAN OCEAN SEAS
  // ============================================================

  const indianOcean =
    OCEAN_DOMAINS.find(
      (domain) =>
        domain.id ===
        'indian-ocean',
    );

  const indianOceanRegions =
    indianOcean
      ? indianOcean.children
          .map(
            (id) =>
              UNDERWATER_REGIONS.find(
                (region) =>
                  region.id === id,
              ),
          )
          .filter(
            (
              region,
            ): region is NonNullable<
              typeof region
            > =>
              Boolean(region),
          )
      : [];

  const activeRegionConfig =
    activeRegionId
      ? UNDERWATER_REGIONS.find(
          (region) =>
            region.id ===
            activeRegionId,
        ) ?? null
      : null;

  const showSeaNavigation =
    selectedDomain ===
    'indian-ocean';

  const currentIndex =
    indianOceanRegions.findIndex(
      (region) =>
        region.id ===
        activeRegionId,
    );

  const prevRegion =
    currentIndex > 0
      ? indianOceanRegions[
          currentIndex - 1
        ]
      : currentIndex === 0
      ? indianOceanRegions[
          indianOceanRegions.length -
            1
        ]
      : null;

  const nextRegion =
    currentIndex >= 0 &&
    currentIndex <
      indianOceanRegions.length -
        1
      ? indianOceanRegions[
          currentIndex + 1
        ]
      : currentIndex ===
          indianOceanRegions.length -
            1
      ? indianOceanRegions[0]
      : null;

  // ============================================================
  // SEA CLICK
  //
  // This is the important part:
  //
  // SEA CLICK
  //     ↓
  // set domain
  //     ↓
  // set underwater region
  //     ↓
  // existing renderer reacts
  //     ↓
  // footprint + grid + mesh + vertices
  // ============================================================

  const handleRegionSelect = (
    id: UnderwaterRegionId | null,
  ) => {
    if (
      id === null
    ) {
      oceanState.setUnderwaterRegion(
        null,
      );

      setActiveRegionId(
        null,
      );

      setIsRegionOpen(
        false,
      );

      return;
    }

    // Ensure Indian Ocean domain is active.
    setDomainSafely(
      'indian-ocean',
    );

    setSelectedDomain(
      'indian-ocean',
    );

    // Activate the actual sea geometry.
    oceanState.setUnderwaterRegion(
      id,
    );

    setActiveRegionId(
      id,
    );

    setIsRegionOpen(
      false,
    );
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <header className="header-controls underwater-header">
      {/* ====================================================== */}
      {/* 1. LEFT INSTRUMENT CLUSTER: BRAND, STRATUM, DOMAIN & SEA */}
      {/* ====================================================== */}
      <div className="underwater-header-left">
        {/* BRAND & MISSION TAG */}
        <div className="brand-group top-brand-group">
          <div className="brand-logo-text-horiz">
            <span className="brand-org-tag">INCOIS</span>
            <span className="brand-divider">/</span>
            <span className="brand-main-title">ARIEL</span>
            <span className="station-code-badge">SUB-SURFACE</span>
          </div>
        </div>

        <div className="header-v-divider" />

        {/* SOUNDING DEPTH STRATUM READOUT */}
        <div className="stratum-indicator" title="Current Sounding Depth Stratum">
          <Layers size={11} className="stratum-icon" />
          <span className="stratum-text">STRATUM -{depth}m</span>
        </div>

        <div className="header-v-divider" />

        {/* OCEAN DOMAIN SELECTOR */}
        <div ref={domainDropdownRef} className="underwater-header-dropdown">
          <button
            type="button"
            onClick={() => {
              setIsDomainOpen((v) => !v);
              setIsRegionOpen(false);
            }}
            className={`underwater-dropdown-trigger domain-trigger ${isDomainOpen ? 'dropdown-active' : ''}`}
            title="Select Oceanographic Mission Domain"
          >
            <Globe2 size={11} className="dropdown-trigger-icon" />
            <span className="dropdown-trigger-label">
              {selectedDomain === 'southern-ocean' ? 'SOUTHERN OCEAN' : 'INDIAN OCEAN'}
            </span>
            <ChevronDown size={10} className="dropdown-caret" />
          </button>

          {/* DOMAIN DROPDOWN MENU */}
          {isDomainOpen && (
            <div className="underwater-dropdown-menu domain-dropdown-menu">
              <div className="underwater-dropdown-header">// MISSION_DOMAINS</div>

              {OCEAN_DOMAINS.map((domain) => {
                const selected = domain.id === selectedDomain;
                return (
                  <button
                    key={domain.id}
                    type="button"
                    onClick={() => handleDomainSelect(domain.id)}
                    className={`underwater-dropdown-item ${selected ? 'item-selected' : ''}`}
                  >
                    <Globe2 size={11} className="item-icon" />
                    <span>{domain.label.toUpperCase()}</span>
                    {domain.id === 'indian-ocean' && (
                      <span className="item-badge">5 SEAS</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* SEA NAVIGATION (PREV / CURRENT SEA DROPDOWN / NEXT) */}
        {showSeaNavigation && (
          <div className="region-nav-group">
            {/* PREVIOUS SEA BUTTON */}
            {prevRegion && (
              <button
                type="button"
                onClick={() => handleRegionSelect(prevRegion.id)}
                className="underwater-nav-step-btn prev"
                title={`Jump to ${prevRegion.label}`}
              >
                <ChevronLeft size={10} />
                <span className="step-btn-text">{prevRegion.label.toUpperCase()}</span>
              </button>
            )}

            {/* CURRENT SEA DROPDOWN */}
            <div ref={dropdownRef} className="underwater-header-dropdown">
              <button
                type="button"
                onClick={() => {
                  setIsRegionOpen((v) => !v);
                  setIsDomainOpen(false);
                }}
                className={`underwater-dropdown-trigger sea-trigger ${isRegionOpen ? 'dropdown-active' : ''}`}
                title="Select Specific Sea/Basin"
              >
                <MapPin size={10} className="dropdown-trigger-icon" />
                <span className="dropdown-trigger-label">
                  {activeRegionConfig && activeRegionConfig.id !== 'indian-ocean'
                    ? activeRegionConfig.label.toUpperCase()
                    : 'ALL INDIAN OCEAN SEAS'}
                </span>
                <ChevronDown size={10} className="dropdown-caret" />
              </button>

              {/* SEA DROPDOWN MENU */}
              {isRegionOpen && (
                <div className="underwater-dropdown-menu sea-dropdown-menu">
                  <div className="underwater-dropdown-header">// INDIAN_OCEAN_SEAS</div>

                  <button
                    type="button"
                    onClick={() => handleRegionSelect('indian-ocean')}
                    className={`underwater-dropdown-item ${activeRegionId === 'indian-ocean' || !activeRegionId ? 'item-selected' : ''}`}
                  >
                    <span className={`item-dot ${activeRegionId === 'indian-ocean' || !activeRegionId ? 'dot-active' : ''}`} />
                    <span>ALL INDIAN OCEAN (ALL SEAS & BASIN)</span>
                  </button>

                  {indianOceanRegions.map((region) => {
                    const selected = region.id === activeRegionId;
                    return (
                      <button
                        key={region.id}
                        type="button"
                        onClick={() => handleRegionSelect(region.id)}
                        className={`underwater-dropdown-item ${selected ? 'item-selected' : ''}`}
                      >
                        <span className={`item-dot ${selected ? 'dot-active' : ''}`} />
                        <span>{region.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* NEXT SEA BUTTON */}
            {nextRegion && (
              <button
                type="button"
                onClick={() => handleRegionSelect(nextRegion.id)}
                className="underwater-nav-step-btn next"
                title={`Jump to ${nextRegion.label}`}
              >
                <span className="step-btn-text">{nextRegion.label.toUpperCase()}</span>
                <ChevronRight size={10} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ====================================================== */}
      {/* 2. CENTER CONTROLS CLUSTER: MODE SWITCH & VARIABLES   */}
      {/* ====================================================== */}
      <div className="underwater-header-center">
        {/* MODE SWITCHER */}
        <div className="mode-switch-container">
          <button
            type="button"
            onClick={() => handleModeChange('surface')}
            className="mode-btn"
            title="Switch to 3D Surface Workspace"
          >
            SURFACE
          </button>

          <button
            type="button"
            className="mode-btn mode-active mode-underwater-active"
            title="Active Sub-surface Sounding Mode"
          >
            <Waves size={10} className="mode-icon" />
            <span>UNDERWATER</span>
          </button>
        </div>

        <div className="header-v-divider" />

        {/* VARIABLE SELECTOR */}
        <div className="variable-selector-group">
          <span className="analyze-label">ANALYZE:</span>

          <button
            type="button"
            onClick={() => handleVarChange('temperature')}
            className={`var-btn ${activeVar === 'temperature' ? 'var-active' : ''}`}
            title="In-Situ Water Column Temperature"
          >
            TEMP (°C)
          </button>

          <button
            type="button"
            onClick={() => handleVarChange('salinity')}
            className={`var-btn ${activeVar === 'salinity' ? 'var-active' : ''}`}
            title="Practical Salinity Scale"
          >
            SALINITY
          </button>

          <button
            type="button"
            onClick={() => handleVarChange('current')}
            className={`var-btn ${activeVar === 'current' ? 'var-active' : ''}`}
            title="Flow Velocity Vector Field"
          >
            CURRENTS
          </button>

          <button
            type="button"
            onClick={() => handleVarChange('chlorophyll')}
            className={`var-btn ${activeVar === 'chlorophyll' ? 'var-active' : ''}`}
            title="Chlorophyll Concentration"
          >
            <span className="var-btn-full">CHLOROPHYLL</span>
            <span className="var-btn-short">CHL</span>
          </button>
        </div>
      </div>

      {/* ====================================================== */}
      {/* 3. RIGHT ACTION CLUSTER: RESET CAMERA VIEW             */}
      {/* ====================================================== */}
      <div className="underwater-header-right">
        <button
          type="button"
          onClick={onResetView}
          className="icon-action-btn reset-btn"
          title="Reset Camera View to Sub-surface Nadir"
        >
          <Compass size={12} className="action-icon" />
          <span>RESET VIEW</span>
        </button>
      </div>
    </header>
  );
};