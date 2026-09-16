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
  LayoutGrid,
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

  useEffect(() => {
    const unsub =
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

    return unsub;
  }, [oceanState]);

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
  // DOMAIN
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

  const handleDomainSelect = (
    domainId: OceanDomainId,
  ) => {
    setDomainSafely(
      domainId,
    );

    setIsDomainOpen(false);

    /*
     * CRITICAL:
     *
     * Southern Ocean is a DOMAIN, not one of
     * the Indian Ocean underwater sea meshes.
     *
     * Therefore clear the active underwater
     * sea when switching to Southern Ocean.
     */
    if (
      domainId ===
      'southern-ocean'
    ) {
      oceanState.setUnderwaterRegion(
        null,
      );

      setActiveRegionId(
        null,
      );

      return;
    }

    /*
     * Indian Ocean:
     *
     * If there is no current Indian Ocean sea,
     * select Arabian Sea as the initial child.
     */
    if (
      domainId ===
      'indian-ocean'
    ) {
      const domain =
        OCEAN_DOMAINS.find(
          (item) =>
            item.id ===
            'indian-ocean',
        );

      if (!domain) {
        return;
      }

      const currentIsChild =
        activeRegionId !== null &&
        domain.children.includes(
          activeRegionId,
        );

      if (
        !currentIsChild &&
        domain.children.length > 0
      ) {
        oceanState.setUnderwaterRegion(
          domain.children[0],
        );

        setActiveRegionId(
          domain.children[0],
        );
      }
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
                  region.id ===
                  id,
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

  /*
   * Only show sea navigation while inside
   * Indian Ocean.
   */
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

  const handleRegionSelect = (
    id: UnderwaterRegionId | null,
  ) => {
    oceanState.setUnderwaterRegion(
      id,
    );

    if (
      id !== null
    ) {
      setDomainSafely(
        'indian-ocean',
      );

      setSelectedDomain(
        'indian-ocean',
      );
    }

    setActiveRegionId(id);
    setIsRegionOpen(false);
  };

  return (
    <header className="header-controls underwater-header">

      {/* ====================================================== */}
      {/* BRAND + OCEAN NAVIGATION                              */}
      {/* ====================================================== */}

      <div className="brand-group">

        <div className="brand-title">
          <span className="brand-primary">
            OCEAN-X
          </span>

          <span className="brand-sub">
            UNDERWATER ANALYSIS WORKSPACE
          </span>
        </div>

        {/* STRATUM */}
        <div className="stratum-indicator">
          <Layers
            size={13}
            className="icon-cyan animate-pulse-slow"
          />

          <span className="stratum-text">
            STRATUM: -{depth}m
          </span>
        </div>

        {/* ==================================================== */}
        {/* OCEAN DOMAIN                                         */}
        {/* ==================================================== */}

        <div
          ref={domainDropdownRef}
          style={{
            position:
              'relative',
          }}
        >
          <button
            onClick={() => {
              setIsDomainOpen(
                (value) =>
                  !value,
              );

              setIsRegionOpen(
                false,
              );
            }}
            style={{
              display:
                'flex',

              alignItems:
                'center',

              gap:
                '6px',

              padding:
                '5px 10px',

              background:
                'rgba(0,240,255,0.10)',

              border:
                '1px solid rgba(0,240,255,0.55)',

              borderRadius:
                '6px',

              color:
                '#00f0ff',

              fontFamily:
                'JetBrains Mono, monospace',

              fontSize:
                '10px',

              fontWeight:
                800,

              cursor:
                'pointer',

              whiteSpace:
                'nowrap',
            }}
          >
            <Globe2
              size={12}
            />

            {selectedDomain ===
            'southern-ocean'
              ? 'SOUTHERN OCEAN'
              : 'INDIAN OCEAN'}

            <ChevronDown
              size={12}
            />
          </button>

          {isDomainOpen && (
            <div
              style={{
                position:
                  'absolute',

                top:
                  'calc(100% + 6px)',

                left: 0,

                minWidth:
                  '240px',

                padding:
                  '6px',

                background:
                  'rgba(3,10,28,0.98)',

                border:
                  '1px solid rgba(0,240,255,0.45)',

                borderRadius:
                  '8px',

                boxShadow:
                  '0 15px 35px rgba(0,0,0,0.8)',

                backdropFilter:
                  'blur(16px)',

                zIndex:
                  99999,
              }}
            >

              <div
                style={{
                  padding:
                    '5px 8px',

                  fontSize:
                    '9px',

                  color:
                    '#64748b',

                  fontFamily:
                    'JetBrains Mono, monospace',

                  fontWeight:
                    700,

                  borderBottom:
                    '1px solid rgba(255,255,255,0.08)',

                  marginBottom:
                    '4px',
                }}
              >
                OCEAN DOMAINS
              </div>

              {OCEAN_DOMAINS.map(
                (domain) => {
                  const selected =
                    domain.id ===
                    selectedDomain;

                  return (
                    <button
                      key={
                        domain.id
                      }
                      onClick={() =>
                        handleDomainSelect(
                          domain.id,
                        )
                      }
                      style={{
                        width:
                          '100%',

                        display:
                          'flex',

                        alignItems:
                          'center',

                        gap:
                          '8px',

                        padding:
                          '8px',

                        background:
                          selected
                            ? 'rgba(0,240,255,0.15)'
                            : 'transparent',

                        border:
                          selected
                            ? '1px solid rgba(0,240,255,0.45)'
                            : '1px solid transparent',

                        borderRadius:
                          '5px',

                        color:
                          selected
                            ? '#00f0ff'
                            : '#cbd5e1',

                        fontFamily:
                          'JetBrains Mono, monospace',

                        fontSize:
                          '10px',

                        fontWeight:
                          selected
                            ? 800
                            : 600,

                        cursor:
                          'pointer',

                        textAlign:
                          'left',
                      }}
                    >
                      <Globe2
                        size={12}
                      />

                      {domain.label.toUpperCase()}

                      {domain.id ===
                        'indian-ocean' && (
                        <span
                          style={{
                            marginLeft:
                              'auto',

                            fontSize:
                              '8px',

                            color:
                              '#64748b',
                          }}
                        >
                          5 SEAS
                        </span>
                      )}
                    </button>
                  );
                },
              )}

            </div>
          )}
        </div>

        {/* ==================================================== */}
        {/* SEA NAVIGATION                                       */}
        {/* ==================================================== */}

        {showSeaNavigation && (
          <div
            className="region-nav-group"
            style={{
              display:
                'flex',

              alignItems:
                'center',

              gap:
                '4px',
            }}
          >

            {prevRegion && (
              <button
                onClick={() =>
                  handleRegionSelect(
                    prevRegion.id,
                  )
                }
                style={{
                  display:
                    'flex',

                  alignItems:
                    'center',

                  gap:
                    '3px',

                  padding:
                    '4px 7px',

                  background:
                    'rgba(2,20,45,0.70)',

                  border:
                    '1px solid rgba(0,240,255,0.25)',

                  borderRadius:
                    '5px',

                  color:
                    '#94a3b8',

                  fontFamily:
                    'JetBrains Mono, monospace',

                  fontSize:
                    '9px',

                  fontWeight:
                    600,

                  cursor:
                    'pointer',
                }}
              >
                <ChevronLeft
                  size={12}
                />

                {prevRegion.label.toUpperCase()}
              </button>
            )}

            {/* CURRENT SEA */}

            <div
              ref={dropdownRef}
              style={{
                position:
                  'relative',
              }}
            >
              <button
                onClick={() =>
                  setIsRegionOpen(
                    (value) =>
                      !value,
                  )
                }
                style={{
                  display:
                    'flex',

                  alignItems:
                    'center',

                  gap:
                    '6px',

                  padding:
                    '5px 9px',

                  background:
                    'rgba(0,240,255,0.14)',

                  border:
                    '1px solid #00f0ff',

                  borderRadius:
                    '6px',

                  color:
                    '#00f0ff',

                  fontFamily:
                    'JetBrains Mono, monospace',

                  fontSize:
                    '10px',

                  fontWeight:
                    800,

                  cursor:
                    'pointer',

                  whiteSpace:
                    'nowrap',
                }}
              >
                <MapPin
                  size={11}
                />

                {activeRegionConfig
                  ? activeRegionConfig.label.toUpperCase()
                  : 'SELECT SEA'}

                <ChevronDown
                  size={11}
                />
              </button>

              {isRegionOpen && (
                <div
                  style={{
                    position:
                      'absolute',

                    top:
                      'calc(100% + 6px)',

                    left: 0,

                    minWidth:
                      '245px',

                    padding:
                      '6px',

                    background:
                      'rgba(3,10,28,0.98)',

                    border:
                      '1px solid rgba(0,240,255,0.45)',

                    borderRadius:
                      '8px',

                    boxShadow:
                      '0 15px 35px rgba(0,0,0,0.8)',

                    backdropFilter:
                      'blur(16px)',

                    zIndex:
                      99999,
                  }}
                >

                  <div
                    style={{
                      padding:
                        '5px 8px',

                      color:
                        '#64748b',

                      fontFamily:
                        'JetBrains Mono, monospace',

                      fontSize:
                        '9px',

                      fontWeight:
                        700,
                    }}
                  >
                    INDIAN OCEAN · SEAS
                  </div>

                  {indianOceanRegions.map(
                    (region) => {
                      const selected =
                        region.id ===
                        activeRegionId;

                      return (
                        <button
                          key={
                            region.id
                          }
                          onClick={() =>
                            handleRegionSelect(
                              region.id,
                            )
                          }
                          style={{
                            width:
                              '100%',

                            display:
                              'flex',

                            alignItems:
                              'center',

                            gap:
                              '8px',

                            padding:
                              '8px',

                            background:
                              selected
                                ? 'rgba(0,240,255,0.15)'
                                : 'transparent',

                            border:
                              selected
                                ? '1px solid rgba(0,240,255,0.45)'
                                : '1px solid transparent',

                            borderRadius:
                              '5px',

                            color:
                              selected
                                ? '#00f0ff'
                                : '#cbd5e1',

                            fontFamily:
                              'JetBrains Mono, monospace',

                            fontSize:
                              '10px',

                            cursor:
                              'pointer',

                            textAlign:
                              'left',
                          }}
                        >
                          <span
                            style={{
                              width:
                                '5px',

                              height:
                                '5px',

                              borderRadius:
                                '50%',

                              background:
                                selected
                                  ? '#00f0ff'
                                  : '#475569',

                              boxShadow:
                                selected
                                  ? '0 0 7px #00f0ff'
                                  : 'none',
                            }}
                          />

                          {region.label}
                        </button>
                      );
                    },
                  )}

                </div>
              )}
            </div>

            {nextRegion && (
              <button
                onClick={() =>
                  handleRegionSelect(
                    nextRegion.id,
                  )
                }
                style={{
                  display:
                    'flex',

                  alignItems:
                    'center',

                  gap:
                    '3px',

                  padding:
                    '4px 7px',

                  background:
                    'rgba(2,20,45,0.70)',

                  border:
                    '1px solid rgba(0,240,255,0.25)',

                  borderRadius:
                    '5px',

                  color:
                    '#94a3b8',

                  fontFamily:
                    'JetBrains Mono, monospace',

                  fontSize:
                    '9px',

                  fontWeight:
                    600,

                  cursor:
                    'pointer',
                }}
              >
                {nextRegion.label.toUpperCase()}

                <ChevronRight
                  size={12}
                />
              </button>
            )}

          </div>
        )}

      </div>

      {/* ====================================================== */}
      {/* MODE                                                    */}
      {/* ====================================================== */}

      <div className="mode-switch-container">

        <button
          onClick={() =>
            handleModeChange(
              'surface',
            )
          }
          className="mode-btn"
        >
          SURFACE
        </button>

        <button
          className="mode-btn mode-active mode-underwater-active"
        >
          <Waves
            size={12}
            style={{
              marginRight:
                '4px',
            }}
          />

          UNDERWATER
        </button>

      </div>

      {/* ====================================================== */}
      {/* VARIABLES                                               */}
      {/* ====================================================== */}

      <div className="variable-selector-group">

        <span className="analyze-label">
          ANALYZE:
        </span>

        <button
          onClick={() =>
            handleVarChange(
              'temperature',
            )
          }
          className={`var-btn ${
            activeVar ===
            'temperature'
              ? 'var-active'
              : ''
          }`}
        >
          TEMP (°C)
        </button>

        <button
          onClick={() =>
            handleVarChange(
              'salinity',
            )
          }
          className={`var-btn ${
            activeVar ===
            'salinity'
              ? 'var-active'
              : ''
          }`}
        >
          SALINITY
        </button>

        <button
          onClick={() =>
            handleVarChange(
              'current',
            )
          }
          className={`var-btn ${
            activeVar ===
            'current'
              ? 'var-active'
              : ''
          }`}
        >
          CURRENTS
        </button>

        <button
          onClick={() =>
            handleVarChange(
              'chlorophyll',
            )
          }
          className={`var-btn ${
            activeVar ===
            'chlorophyll'
              ? 'var-active'
              : ''
          }`}
        >
          CHLOROPHYLL
        </button>

      </div>

      <button
        onClick={
          onResetView
        }
        className="icon-action-btn"
        title="Reset View"
      >
        <Compass
          size={16}
        />

        RESET VIEW
      </button>

    </header>
  );
};