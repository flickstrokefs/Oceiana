import React from 'react';
import { OceanState } from '../../ocean/OceanState';
import { UNDERWATER_REGIONS, type UnderwaterRegionId } from '../../types/ocean';
import { MapPin, ArrowRight, Waves, Compass } from 'lucide-react';

interface UnderwaterRegionOverviewProps {
  onSelectRegion?: (id: UnderwaterRegionId) => void;
}

export const UnderwaterRegionOverview: React.FC<UnderwaterRegionOverviewProps> = ({
  onSelectRegion,
}) => {
  const handleSelect = (id: UnderwaterRegionId) => {
    OceanState.getInstance().setUnderwaterRegion(id);
    if (onSelectRegion) {
      onSelectRegion(id);
    }
  };

  return (
    <div
      className="underwater-overview-backdrop"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, rgba(2, 11, 28, 0.65) 0%, rgba(2, 6, 23, 0.88) 100%)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        className="overview-modal-panel"
        style={{
          pointerEvents: 'auto',
          maxWidth: '820px',
          width: '90%',
          background: 'rgba(3, 14, 38, 0.94)',
          border: '1px solid rgba(0, 240, 255, 0.40)',
          borderRadius: '16px',
          padding: '28px 32px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(0, 240, 255, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              background: 'rgba(0, 240, 255, 0.10)',
              border: '1px solid rgba(0, 240, 255, 0.35)',
              borderRadius: '20px',
              color: '#00f0ff',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.08em',
            }}
          >
            <Waves size={12} />
            <span>INDIAN OCEAN 3D SCIENTIFIC DOMAIN</span>
          </div>

          <h2
            style={{
              color: '#f8fafc',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '20px',
              fontWeight: 800,
              letterSpacing: '0.04em',
              margin: '4px 0 0 0',
              textShadow: '0 0 20px rgba(0, 240, 255, 0.4)',
            }}
          >
            CHOOSE 3D ANALYSIS REGION
          </h2>

          <p
            style={{
              color: '#94a3b8',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '12px',
              margin: 0,
              maxWidth: '540px',
              lineHeight: 1.5,
            }}
          >
            Select an independent analytical ocean volume to focus high-resolution 3D depth slice, currents, and observation floats into the viewport.
          </p>
        </div>

        {/* 2x2 Region Selection Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '14px',
            marginTop: '6px',
          }}
        >
          {UNDERWATER_REGIONS.map((region) => (
            <button
              key={region.id}
              onClick={() => handleSelect(region.id)}
              className="overview-region-card"
              style={{
                background: 'rgba(5, 20, 50, 0.70)',
                border: '1px solid rgba(0, 240, 255, 0.30)',
                borderRadius: '12px',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 240, 255, 0.12)';
                e.currentTarget.style.borderColor = '#00f0ff';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.6), 0 0 20px rgba(0, 240, 255, 0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(5, 20, 50, 0.70)';
                e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.30)';
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Card Title & Bounds */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={15} style={{ color: '#00f0ff' }} />
                  <span
                    style={{
                      color: '#f8fafc',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '13px',
                      fontWeight: 700,
                      letterSpacing: '0.03em',
                    }}
                  >
                    {region.name.toUpperCase()}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    color: '#38bdf8',
                    fontFamily: 'JetBrains Mono, monospace',
                    background: 'rgba(0, 240, 255, 0.10)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid rgba(0, 240, 255, 0.20)',
                  }}
                >
                  0m → -{region.depthMax}m
                </span>
              </div>

              {/* Geographic Coordinates */}
              <div
                style={{
                  fontSize: '10px',
                  color: '#00f0ff',
                  fontFamily: 'JetBrains Mono, monospace',
                  marginBottom: '8px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Compass size={11} />
                <span>{region.boundsLabel}</span>
              </div>

              {/* Oceanographic Description */}
              <p
                style={{
                  color: '#94a3b8',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '11px',
                  lineHeight: 1.45,
                  margin: '0 0 14px 0',
                  flex: 1,
                }}
              >
                {region.description}
              </p>

              {/* Action Button Label */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  fontFamily: 'JetBrains Mono, monospace',
                  color: '#00f0ff',
                  marginTop: 'auto',
                }}
              >
                <span>OPEN 3D ANALYSIS VOLUME</span>
                <ArrowRight size={13} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
