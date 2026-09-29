import React, { useEffect, useState } from 'react';
import { OceanState } from '../../ocean/OceanState';
import {
  type UnderwaterRegionId,
  type OceanDomainId,
  UNDERWATER_REGIONS,
  OCEAN_DOMAINS,
} from '../../types/ocean';
import {
  X,
  Compass,
  MapPin,
  Waves,
  Grid,
  Layers,
  ArrowUpRight,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface SeaScientificProfile {
  name: string;
  domainName: string;
  maxDepthFt: string;
  maxDepthM: string;
  gridResolution: string;
  depthLayers: string;
  cellWidth: string;
  cellDepth: string;
  coordinates: string;
  nauticalCoords: string;
  bounds: string;
  bathymetricFeature: string;
  surfaceTemp: string;
  surfaceSalinity: string;
  azimuthDeg: number;
}

const SEA_SCIENTIFIC_DATA: Record<string, SeaScientificProfile> = {
  'arabian-sea': {
    name: 'Arabian Sea',
    domainName: 'Indian Ocean Macro Basin',
    maxDepthFt: '11,483 ft max depth',
    maxDepthM: '3,500 m',
    gridResolution: '40×40 grid',
    depthLayers: '20 depth layers',
    cellWidth: '~58 km cell width',
    cellDepth: '~574 ft cell depth',
    coordinates: '15.40° N, 65.00° E',
    nauticalCoords: "15°24'00\" N · 65°00'00\" E",
    bounds: '51.02°–74.34° E · -0.70°–25.60° N',
    bathymetricFeature: 'Indus Submarine Fan · Carlsberg Mid-Ocean Ridge',
    surfaceTemp: '28.2 °C',
    surfaceSalinity: '35.5 PSU',
    azimuthDeg: 320,
  },
  'bay-of-bengal': {
    name: 'Bay of Bengal',
    domainName: 'Northern Indian Ocean Basin',
    maxDepthFt: '13,123 ft max depth',
    maxDepthM: '4,000 m',
    gridResolution: '40×40 grid',
    depthLayers: '20 depth layers',
    cellWidth: '~44 km cell width',
    cellDepth: '~656 ft cell depth',
    coordinates: '14.10° N, 87.60° E',
    nauticalCoords: "14°06'00\" N · 87°36'00\" E",
    bounds: '78.90°–95.05° E · 5.73°–24.38° N',
    bathymetricFeature: 'Ganges Deep-Sea Fan · Ninety East Ridge',
    surfaceTemp: '29.1 °C',
    surfaceSalinity: '33.2 PSU',
    azimuthDeg: 45,
  },
  'andaman-sea': {
    name: 'Andaman Sea',
    domainName: 'Eastern Indian Ocean Basin',
    maxDepthFt: '13,780 ft max depth',
    maxDepthM: '4,200 m',
    gridResolution: '30×30 grid',
    depthLayers: '18 depth layers',
    cellWidth: '~25 km cell width',
    cellDepth: '~765 ft cell depth',
    coordinates: '10.90° N, 95.50° E',
    nauticalCoords: "10°54'00\" N · 95°30'00\" E",
    bounds: '92.39°–99.14° E · 5.53°–17.75° N',
    bathymetricFeature: 'Andaman Back-Arc Spreading Rift · Sewell Seamount',
    surfaceTemp: '29.5 °C',
    surfaceSalinity: '32.8 PSU',
    azimuthDeg: 80,
  },
  'laccadive-sea': {
    name: 'Laccadive Sea',
    domainName: 'Central Indian Ocean Basin',
    maxDepthFt: '8,858 ft max depth',
    maxDepthM: '2,700 m',
    gridResolution: '30×30 grid',
    depthLayers: '18 depth layers',
    cellWidth: '~31 km cell width',
    cellDepth: '~492 ft cell depth',
    coordinates: '06.20° N, 76.00° E',
    nauticalCoords: "06°12'00\" N · 76°00'00\" E",
    bounds: '71.98°–80.59° E · -0.69°–14.79° N',
    bathymetricFeature: 'Chagos-Laccadive Ridge · Minicoy Abyssal Plain',
    surfaceTemp: '28.8 °C',
    surfaceSalinity: '35.1 PSU',
    azimuthDeg: 190,
  },
  'java-sea': {
    name: 'Java Sea',
    domainName: 'Tropical Indonesian Shelf',
    maxDepthFt: '656 ft max depth',
    maxDepthM: '200 m',
    gridResolution: '25×25 grid',
    depthLayers: '8 depth layers',
    cellWidth: '~66 km cell width',
    cellDepth: '~82 ft cell depth',
    coordinates: '05.00° S, 111.00° E',
    nauticalCoords: "05°00'00\" S · 111°00'00\" E",
    bounds: '104.53°–119.49° E · 7.81°S–1.55° S',
    bathymetricFeature: 'Sunda Continental Shelf · Karimata Maritime Strait',
    surfaceTemp: '29.8 °C',
    surfaceSalinity: '32.0 PSU',
    azimuthDeg: 120,
  },
  'indian-ocean': {
    name: 'Indian Ocean',
    domainName: 'Indian Ocean Macro Basin (IHO v3)',
    maxDepthFt: '22,966 ft max depth',
    maxDepthM: '7,000 m',
    gridResolution: '50×50 grid',
    depthLayers: '25 depth layers',
    cellWidth: '~270 km cell width',
    cellDepth: '~919 ft cell depth',
    coordinates: '10.00° S, 80.00° E',
    nauticalCoords: "10°00'00\" S · 80°00'00\" E",
    bounds: '20.00°–146.90° E · 60.00°S–10.45° N',
    bathymetricFeature: 'Central Indian Ridge · Java Trench · Wharton Basin',
    surfaceTemp: '26.5 °C',
    surfaceSalinity: '34.8 PSU',
    azimuthDeg: 180,
  },
  'southern-ocean': {
    name: 'Southern Ocean',
    domainName: 'Circumpolar Antarctic Basin (IHO v3)',
    maxDepthFt: '22,966 ft max depth',
    maxDepthM: '7,000 m',
    gridResolution: '45×45 grid',
    depthLayers: '25 depth layers',
    cellWidth: '~180 km cell width',
    cellDepth: '~919 ft cell depth',
    coordinates: '67.50° S, 83.50° E',
    nauticalCoords: "67°30'00\" S · 83°30'00\" E",
    bounds: '180.00°W–180.00°E · 85.56°–60.00° S',
    bathymetricFeature: 'Antarctic Circumpolar Current · Enderby Abyssal Plain',
    surfaceTemp: '-1.2 °C',
    surfaceSalinity: '34.0 PSU',
    azimuthDeg: 215,
  },
};

/**
 * Hand-drawn technical nautical compass rose SVG.
 * Inspired by scientific field notebooks and historical hydrographic charts.
 */
const HandDrawnCompassRose: React.FC<{ azimuthDeg?: number }> = ({ azimuthDeg = 320 }) => (
  <svg
    viewBox="0 0 120 120"
    className="nautical-compass-svg"
    aria-label="Hand-drawn nautical compass"
  >
    <defs>
      {/* Subtle organic sketch filter for hand-drawn technical aesthetic */}
      <filter id="nauticalInk" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.6" />
      </filter>
    </defs>

    <g filter="url(#nauticalInk)">
      {/* Outer graduation ring */}
      <circle cx="60" cy="60" r="54" fill="none" stroke="#D6AE63" strokeWidth="1.2" strokeDasharray="2,3" opacity="0.65" />
      <circle cx="60" cy="60" r="51" fill="none" stroke="#20242A" strokeWidth="0.8" opacity="0.3" />

      {/* Inner bathymetric sounding contour rings */}
      <circle cx="60" cy="60" r="41" fill="none" stroke="#7FB8AD" strokeWidth="0.75" strokeDasharray="3,4" opacity="0.45" />
      <circle cx="60" cy="60" r="28" fill="none" stroke="#EFA58F" strokeWidth="0.75" opacity="0.3" />
      <circle cx="60" cy="60" r="14" fill="none" stroke="#D87862" strokeWidth="0.6" strokeDasharray="1,2" opacity="0.4" />

      {/* Crosshairs & Latitude/Longitude grid lines */}
      <line x1="60" y1="3" x2="60" y2="117" stroke="#20242A" strokeWidth="0.65" opacity="0.3" />
      <line x1="3" y1="60" x2="117" y2="60" stroke="#20242A" strokeWidth="0.65" opacity="0.3" />

      {/* Diagonal quadrant guides */}
      <line x1="22" y1="22" x2="98" y2="98" stroke="#D6AE63" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.35" />
      <line x1="22" y1="98" x2="98" y2="22" stroke="#D6AE63" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.35" />

      {/* Degree ticks (every 30 deg) */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = 60 + 51 * Math.sin(rad);
        const y1 = 60 - 51 * Math.cos(rad);
        const x2 = 60 + (deg % 90 === 0 ? 44 : 47) * Math.sin(rad);
        const y2 = 60 - (deg % 90 === 0 ? 44 : 47) * Math.cos(rad);
        return (
          <line
            key={deg}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={deg % 90 === 0 ? '#D87862' : '#20242A'}
            strokeWidth={deg % 90 === 0 ? '1' : '0.6'}
            opacity={deg % 90 === 0 ? '0.85' : '0.4'}
          />
        );
      })}

      {/* Rotating Azimuth Pointer / Compass Needle */}
      <g transform={`rotate(${azimuthDeg} 60 60)`}>
        {/* North pointer (Coral & Gold) */}
        <polygon points="60,12 64.5,58 60,54" fill="#D87862" />
        <polygon points="60,12 55.5,58 60,54" fill="#EFA58F" />

        {/* South pointer (Deep Navy & Sand) */}
        <polygon points="60,108 64.5,62 60,66" fill="#17324A" opacity="0.75" />
        <polygon points="60,108 55.5,62 60,66" fill="#91A98F" opacity="0.65" />

        {/* Center nautical pivot */}
        <circle cx="60" cy="60" r="4.5" fill="#FAF6F0" stroke="#D87862" strokeWidth="1.2" />
        <circle cx="60" cy="60" r="1.8" fill="#17324A" />
      </g>

      {/* Cardinal Labels in Classic Editorial Serif */}
      <text x="60" y="9" textAnchor="middle" fontSize="8" fontFamily="'Cormorant Garamond', Georgia, serif" fontWeight="700" fill="#D87862">
        N
      </text>
      <text x="114" y="63" textAnchor="middle" fontSize="7.5" fontFamily="'Cormorant Garamond', Georgia, serif" fontWeight="700" fill="#17324A">
        E
      </text>
      <text x="60" y="117" textAnchor="middle" fontSize="7.5" fontFamily="'Cormorant Garamond', Georgia, serif" fontWeight="700" fill="#17324A">
        S
      </text>
      <text x="7" y="63" textAnchor="middle" fontSize="7.5" fontFamily="'Cormorant Garamond', Georgia, serif" fontWeight="700" fill="#17324A">
        W
      </text>
    </g>
  </svg>
);

export const ContextualCompass: React.FC = () => {
  const [selectedDomain, setSelectedDomain] = useState<OceanDomainId | null>(null);
  const [activeRegionId, setActiveRegionId] = useState<UnderwaterRegionId | null>(null);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    const oceanState = OceanState.getInstance();
    const unsub = oceanState.subscribe((snapshot) => {
      setSelectedDomain(snapshot.selectedOceanDomain ?? null);
      setActiveRegionId(snapshot.underwaterRegion ?? null);
    });
    return unsub;
  }, []);

  /*
   * CONTEXTUAL RULE:
   * No Ocean Domain / sea selected:
   * → hide compass information block completely.
   */
  const hasDomain = Boolean(selectedDomain);
  const hasSpecificSea = Boolean(activeRegionId && activeRegionId !== 'indian-ocean');

  if (!hasDomain && !hasSpecificSea) {
    return null;
  }

  const handleSelectSea = (seaId: UnderwaterRegionId) => {
    OceanState.getInstance().setUnderwaterRegion(seaId);
    // Request fly-to center of that sea
    const profile = SEA_SCIENTIFIC_DATA[seaId];
    if (profile) {
      const reg = UNDERWATER_REGIONS.find((r) => r.id === seaId);
      if (reg) {
        const lat = (reg.south + reg.north) / 2;
        const lon = (reg.west + reg.east) / 2;
        OceanState.getInstance().requestFlyToLocation(lat, lon, 1850000);
      }
    }
  };

  const handleClearSelection = () => {
    OceanState.getInstance().setOceanDomain(null);
    OceanState.getInstance().setUnderwaterRegion(null);
  };

  /*
   * CASE 1: Ocean Domain Selected (no specific sea selected)
   * → Show Domain Interface.
   */
  if (hasDomain && !hasSpecificSea) {
    const domainDef = OCEAN_DOMAINS.find((d) => d.id === selectedDomain);
    const domainTitle = domainDef ? domainDef.label : 'Indian Ocean Analytical Domain';
    const subSeas = domainDef
      ? domainDef.children
          .map((id) => UNDERWATER_REGIONS.find((r) => r.id === id))
          .filter((r): r is NonNullable<typeof r> => Boolean(r))
      : [];

    return (
      <div className="contextual-compass-container contextual-domain-container" aria-label="Ocean Domain Interface">
        <div className="compass-card-header">
          <div className="compass-header-kicker">
            <span className="nautical-symbol">✦</span>
            <span>OCEANOGRAPHIC MISSION DOMAIN</span>
          </div>
          <button
            type="button"
            className="compass-close-btn"
            onClick={handleClearSelection}
            title="Deselect Domain"
            aria-label="Close Domain Panel"
          >
            <X size={12} />
          </button>
        </div>

        <div className="domain-card-body">
          <div className="domain-title-group">
            <h3 className="domain-serif-title">{domainTitle}</h3>
            <span className="domain-extent-mono">
              {domainDef?.id === 'southern-ocean'
                ? '180.00°W–180.00°E · 85.56°–60.00°S'
                : '20.00°–146.90°E · 60.00°S–25.60°N'}
            </span>
          </div>

          <p className="domain-description-text">
            {domainDef?.description ||
              'Indian Ocean macro analytical domain bounded by 20°E, 147°E, 60°S and the Asian continent.'}
          </p>

          <div className="domain-subseas-section">
            <div className="subseas-heading">
              <Compass size={11} className="subseas-icon" />
              <span>REGIONAL SUB-BASINS & SEAS ({subSeas.length})</span>
            </div>

            <div className="domain-subseas-grid">
              {subSeas.map((sea) => (
                <button
                  key={sea.id}
                  type="button"
                  className="subsea-select-card"
                  onClick={() => handleSelectSea(sea.id)}
                >
                  <div className="subsea-card-top">
                    <span className="subsea-name">{sea.name}</span>
                    <ArrowUpRight size={10} className="subsea-arrow" />
                  </div>
                  <span className="subsea-bounds">{sea.boundsLabel}</span>
                  <span className="subsea-depth">Max: {sea.depthMax.toLocaleString()} m</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="domain-card-footer">
          <span className="domain-status-note">
            Select a specific sea to deploy high-resolution contextual compass &amp; grid profiling.
          </span>
        </div>
      </div>
    );
  }

  /*
   * CASE 2: Specific Sea Selected
   * → Show Compass + Selected Sea + Actual Coordinates + Actual Scientific Information + Relevant Grid/Mesh Information.
   */
  const seaProfile =
    (activeRegionId && SEA_SCIENTIFIC_DATA[activeRegionId]) || SEA_SCIENTIFIC_DATA['arabian-sea'];

  return (
    <div
      className={`contextual-compass-container contextual-sea-container ${minimized ? 'compass-minimized' : ''}`}
      aria-label="Contextual Nautical Compass & Hydrographic Profile"
    >
      {/* Header Bar */}
      <div className="compass-card-header">
        <div className="compass-header-kicker">
          <span className="nautical-symbol">⌖</span>
          <span>HYDROGRAPHIC CARTOGRAPHY // {seaProfile.domainName.toUpperCase()}</span>
        </div>
        <div className="compass-header-actions">
          <button
            type="button"
            className="compass-minimize-btn"
            onClick={() => setMinimized(!minimized)}
            title={minimized ? 'Expand Compass Card' : 'Minimize Compass Card'}
            aria-label="Toggle Minimize"
          >
            {minimized ? <Maximize2 size={11} /> : <Minimize2 size={11} />}
          </button>
          <button
            type="button"
            className="compass-close-btn"
            onClick={handleClearSelection}
            title="Deselect Sea"
            aria-label="Close Compass Panel"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {!minimized ? (
        <div className="compass-card-body">
          {/* Main Visual & Geographic Block */}
          <div className="compass-visual-layout">
            {/* Hand-drawn Technical Compass SVG */}
            <div className="compass-rose-wrapper">
              <HandDrawnCompassRose azimuthDeg={seaProfile.azimuthDeg} />
              <div className="compass-bearing-readout">
                <span className="bearing-num">{seaProfile.azimuthDeg}°</span>
                <span className="bearing-lbl">AZIMUTH</span>
              </div>
            </div>

            {/* Sea Title & Geographic Coordinates */}
            <div className="compass-identity-col">
              <div className="sea-title-badge">INCOIS REGIONAL DOMAIN</div>
              <h2 className="sea-serif-title">{seaProfile.name}</h2>
              <div className="sea-coords-box">
                <div className="coord-row">
                  <MapPin size={10} className="coord-icon" />
                  <span className="coord-mono">{seaProfile.nauticalCoords}</span>
                </div>
                <div className="bounds-row">
                  <span className="bounds-label">BOUNDS:</span>
                  <span className="bounds-mono">{seaProfile.bounds}</span>
                </div>
              </div>

              {/* Bathymetric feature annotation */}
              <div className="bathymetric-annotation">
                <span className="annotation-kicker">BATHYMETRIC SECTOR</span>
                <span className="annotation-val">{seaProfile.bathymetricFeature}</span>
              </div>
            </div>
          </div>

          {/* Scientific Specification & Grid/Mesh Information Grid */}
          <div className="scientific-metrics-section">
            <div className="section-mini-heading">
              <Waves size={10} className="mini-icon" />
              <span>HYDROGRAPHIC PROFILE &amp; COMPUTATIONAL MESH</span>
            </div>

            <div className="scientific-grid-four">
              {/* Max Depth */}
              <div className="metric-pill">
                <span className="metric-kicker">SOUNDING FLOOR</span>
                <span className="metric-strong font-mono">{seaProfile.maxDepthFt}</span>
                <span className="metric-sub font-mono">({seaProfile.maxDepthM})</span>
              </div>

              {/* Grid Resolution */}
              <div className="metric-pill">
                <span className="metric-kicker">
                  <Grid size={9} /> COMPUTATIONAL GRID
                </span>
                <span className="metric-strong font-mono">{seaProfile.gridResolution}</span>
                <span className="metric-sub font-mono">{seaProfile.cellWidth}</span>
              </div>

              {/* Vertical Layers */}
              <div className="metric-pill">
                <span className="metric-kicker">
                  <Layers size={9} /> DEPTH STRATIFICATION
                </span>
                <span className="metric-strong font-mono">{seaProfile.depthLayers}</span>
                <span className="metric-sub font-mono">{seaProfile.cellDepth}</span>
              </div>

              {/* Hydrographic Baseline */}
              <div className="metric-pill">
                <span className="metric-kicker">BASELINE TELEMETRY</span>
                <span className="metric-strong font-mono">{seaProfile.surfaceTemp}</span>
                <span className="metric-sub font-mono">{seaProfile.surfaceSalinity}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Minimized Ribbon View */
        <div className="compass-minimized-row" onClick={() => setMinimized(false)}>
          <Compass size={13} className="mini-compass-icon" />
          <span className="mini-sea-name">{seaProfile.name}</span>
          <span className="mini-coords font-mono">{seaProfile.coordinates}</span>
          <span className="mini-depth font-mono">{seaProfile.maxDepthFt}</span>
          <span className="mini-grid font-mono">{seaProfile.gridResolution}</span>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="compass-card-footer">
        <span className="carto-footnote">
          Technical Field Chart · INCOIS-HCOM Real-Time Boundary Model
        </span>
        <div className="sea-switch-mini">
          {UNDERWATER_REGIONS.filter(
            (r) => r.id !== 'southern-ocean' && r.id !== 'indian-ocean'
          ).map((sea) => (
            <button
              key={sea.id}
              type="button"
              className={`mini-sea-chip ${activeRegionId === sea.id ? 'chip-active' : ''}`}
              onClick={() => handleSelectSea(sea.id)}
            >
              {sea.name.replace(' Sea', '')}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ContextualCompass;
