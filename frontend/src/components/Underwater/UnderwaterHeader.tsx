import React, { useEffect, useState, useRef } from 'react';
import { OceanState } from '../../ocean/OceanState';
import {
  UNDERWATER_REGIONS,
  type OceanMode,
  type OceanVariable,
  type UnderwaterRegionId,
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
} from 'lucide-react';

interface UnderwaterHeaderProps {
  onResetView?: () => void;
}

export const UnderwaterHeader: React.FC<UnderwaterHeaderProps> = ({ onResetView }) => {
  const [depth, setDepth] = useState<number>(0);
  const [activeVar, setActiveVar] = useState<OceanVariable>('temperature');
  const [activeRegionId, setActiveRegionId] = useState<UnderwaterRegionId | null>(null);
  const [isRegionOpen, setIsRegionOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = OceanState.getInstance().subscribe((snapshot) => {
      setDepth(snapshot.parameters.depth);
      setActiveVar(snapshot.activeVariable);
      setActiveRegionId(snapshot.underwaterRegion);
    });
    return unsub;
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsRegionOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleModeChange = (mode: OceanMode) => {
    OceanState.getInstance().setMode(mode);
  };

  const handleVarChange = (v: OceanVariable) => {
    OceanState.getInstance().setActiveVariable(v);
  };

  const handleRegionSelect = (id: UnderwaterRegionId | null) => {
    OceanState.getInstance().setUnderwaterRegion(id);
    setIsRegionOpen(false);
  };

  const oceanState = OceanState.getInstance();
  const prevRegion = oceanState.getPrevRegion(activeRegionId);
  const nextRegion = oceanState.getNextRegion(activeRegionId);
  const activeRegionConfig = activeRegionId
    ? UNDERWATER_REGIONS.find((r) => r.id === activeRegionId) || null
    : null;

  return (
    <header className="header-controls underwater-header">
      <div className="brand-group">
        <div className="brand-title">
          <span className="brand-primary">OCEAN-X</span>
          <span className="brand-sub">UNDERWATER ANALYSIS WORKSPACE</span>
        </div>

        {/* Stratum Indicator */}
        <div className="stratum-indicator">
          <Layers size={13} className="icon-cyan animate-pulse-slow" />
          <span className="stratum-text">STRATUM: -{depth}m</span>
        </div>

        {/* Geographic Region Switcher Group */}
        <div className="region-nav-group" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* Previous Region Button */}
          <button
            onClick={() => handleRegionSelect(prevRegion.id)}
            className="region-nav-step-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              padding: '4px 8px',
              background: 'rgba(2, 20, 45, 0.70)',
              border: '1px solid rgba(0, 240, 255, 0.25)',
              borderRadius: '5px',
              color: '#94a3b8',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '10px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              backdropFilter: 'blur(8px)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#00f0ff';
              e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.60)';
              e.currentTarget.style.background = 'rgba(0, 240, 255, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#94a3b8';
              e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.25)';
              e.currentTarget.style.background = 'rgba(2, 20, 45, 0.70)';
            }}
            title={`Previous Region: ${prevRegion.name}`}
          >
            <ChevronLeft size={13} style={{ color: '#00f0ff' }} />
            <span style={{ maxWidth: '95px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {prevRegion.name.toUpperCase()}
            </span>
          </button>

          {/* Current Region Selector Button with Dropdown */}
          <div className="region-dropdown-container" ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setIsRegionOpen(!isRegionOpen)}
              className="region-selector-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                background: isRegionOpen || activeRegionConfig ? 'rgba(0, 240, 255, 0.16)' : 'rgba(0, 240, 255, 0.08)',
                border: activeRegionConfig ? '1px solid #00f0ff' : '1px solid rgba(0, 240, 255, 0.40)',
                borderRadius: '6px',
                color: '#00f0ff',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backdropFilter: 'blur(8px)',
                boxShadow: activeRegionConfig ? '0 0 12px rgba(0, 240, 255, 0.20)' : 'none',
              }}
              title="Click to change region or switch to Overview"
            >
              <MapPin size={12} style={{ color: '#00f0ff' }} />
              <span>
                {activeRegionConfig
                  ? activeRegionConfig.label.toUpperCase()
                  : 'REGION: OVERVIEW (4)'}
              </span>
              <ChevronDown
                size={12}
                style={{
                  transform: isRegionOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease',
                  color: '#38bdf8',
                }}
              />
            </button>

          {/* Region Dropdown Menu */}
          {isRegionOpen && (
            <div
              className="region-dropdown-menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                minWidth: '230px',
                background: 'rgba(3, 10, 28, 0.96)',
                border: '1px solid rgba(0, 240, 255, 0.45)',
                borderRadius: '8px',
                padding: '6px',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.8), 0 0 15px rgba(0, 240, 255, 0.15)',
                backdropFilter: 'blur(16px)',
                zIndex: 99999,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div
                style={{
                  fontSize: '9px',
                  color: '#64748b',
                  padding: '4px 8px',
                  letterSpacing: '0.08em',
                  fontWeight: 700,
                  fontFamily: 'JetBrains Mono, monospace',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  marginBottom: '2px',
                }}
              >
                SELECT ANALYSIS REGION
              </div>

              {/* Overview Mode Option */}
              <button
                onClick={() => handleRegionSelect(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 10px',
                  background: activeRegionId === null ? 'rgba(0, 240, 255, 0.15)' : 'transparent',
                  border: activeRegionId === null
                    ? '1px solid rgba(0, 240, 255, 0.50)'
                    : '1px solid transparent',
                  borderRadius: '5px',
                  color: activeRegionId === null ? '#38bdf8' : '#cbd5e1',
                  fontFamily: 'JetBrains Mono, monospace',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease',
                  width: '100%',
                }}
              >
                <LayoutGrid size={13} style={{ color: activeRegionId === null ? '#00f0ff' : '#64748b' }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', fontWeight: activeRegionId === null ? 700 : 500 }}>
                    ALL 4 REGIONS (OVERVIEW)
                  </span>
                  <span style={{ fontSize: '9px', color: '#64748b' }}>
                    View full Indian Ocean analytical domain
                  </span>
                </div>
              </button>

              {UNDERWATER_REGIONS.map((r) => {
                const isSelected = r.id === activeRegionId;
                return (
                  <button
                    key={r.id}
                    onClick={() => handleRegionSelect(r.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '7px 10px',
                      background: isSelected ? 'rgba(0, 240, 255, 0.15)' : 'transparent',
                      border: isSelected
                        ? '1px solid rgba(0, 240, 255, 0.50)'
                        : '1px solid transparent',
                      borderRadius: '5px',
                      color: isSelected ? '#38bdf8' : '#cbd5e1',
                      fontFamily: 'JetBrains Mono, monospace',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s ease',
                      width: '100%',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'rgba(0, 240, 255, 0.08)';
                        e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.25)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = 'transparent';
                      }
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11px',
                        fontWeight: isSelected ? 700 : 500,
                      }}
                    >
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: isSelected ? '#00f0ff' : '#475569',
                          boxShadow: isSelected ? '0 0 6px #00f0ff' : 'none',
                        }}
                      />
                      <span>{r.label}</span>
                      {isSelected && (
                        <span
                          style={{
                            fontSize: '9px',
                            color: '#00f0ff',
                            marginLeft: 'auto',
                            fontWeight: 700,
                          }}
                        >
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: '9px',
                        color: '#64748b',
                        marginLeft: '12px',
                        marginTop: '2px',
                      }}
                    >
                      {r.west}°–{r.east}°E · {r.south}°–{r.north}°N
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Next Region Button */}
        <button
          onClick={() => handleRegionSelect(nextRegion.id)}
          className="region-nav-step-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            padding: '4px 8px',
            background: 'rgba(2, 20, 45, 0.70)',
            border: '1px solid rgba(0, 240, 255, 0.25)',
            borderRadius: '5px',
            color: '#94a3b8',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '10px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            backdropFilter: 'blur(8px)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#00f0ff';
            e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.60)';
            e.currentTarget.style.background = 'rgba(0, 240, 255, 0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#94a3b8';
            e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.25)';
            e.currentTarget.style.background = 'rgba(2, 20, 45, 0.70)';
          }}
          title={`Next Region: ${nextRegion.name}`}
        >
          <span style={{ maxWidth: '95px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nextRegion.name.toUpperCase()}
          </span>
          <ChevronRight size={13} style={{ color: '#00f0ff' }} />
        </button>

        {/* Overview Mode Switch Button */}
        <button
          onClick={() => handleRegionSelect(null)}
          className="region-overview-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            background: activeRegionId === null ? 'rgba(0, 240, 255, 0.20)' : 'rgba(2, 20, 45, 0.50)',
            border: activeRegionId === null ? '1px solid #00f0ff' : '1px solid rgba(0, 240, 255, 0.20)',
            borderRadius: '5px',
            color: activeRegionId === null ? '#00f0ff' : '#64748b',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '10px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#00f0ff';
            e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.50)';
          }}
          onMouseLeave={(e) => {
            if (activeRegionId !== null) {
              e.currentTarget.style.color = '#64748b';
              e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.20)';
            }
          }}
          title="Switch to 4-region domain overview"
        >
          <LayoutGrid size={11} />
          <span>OVERVIEW</span>
        </button>
      </div>
    </div>

      {/* Mode Switcher */}
      <div className="mode-switch-container">
        <button
          onClick={() => handleModeChange('surface')}
          className="mode-btn"
        >
          SURFACE
        </button>
        <button
          className="mode-btn mode-active mode-underwater-active"
        >
          <Waves size={12} style={{ display: 'inline', marginRight: '4px' }} />
          UNDERWATER
        </button>
      </div>

      {/* Analysis Variable Selector */}
      <div className="variable-selector-group">
        <span className="analyze-label">ANALYZE:</span>
        <button
          onClick={() => handleVarChange('temperature')}
          className={`var-btn ${activeVar === 'temperature' ? 'var-active' : ''}`}
        >
          TEMP (°C)
        </button>
        <button
          onClick={() => handleVarChange('salinity')}
          className={`var-btn ${activeVar === 'salinity' ? 'var-active' : ''}`}
        >
          SALINITY
        </button>
        <button
          onClick={() => handleVarChange('current')}
          className={`var-btn ${activeVar === 'current' ? 'var-active' : ''}`}
        >
          CURRENTS
        </button>
        <button
          onClick={() => handleVarChange('chlorophyll')}
          className={`var-btn ${activeVar === 'chlorophyll' ? 'var-active' : ''}`}
        >
          CHLOROPHYLL
        </button>
      </div>

      <button onClick={onResetView} className="icon-action-btn" title="Reset View">
        <Compass size={16} />
        RESET VIEW
      </button>
    </header>
  );
};
