import React, { useEffect, useState } from 'react';
import { OceanState } from '../../ocean/OceanState';

/**
 * Small Navigation Compass Rose SVG (Hand-drawn nautical cartography style).
 * Styled to match the ARIEL Earth Observation System theme (Reference Image 1).
 * Features an 8-point nautical star with traditional faceted shading,
 * graduation rings, degree ticks, and classic cardinal lettering.
 */
interface CompassRoseProps {
  headingDeg: number;
  size?: number;
  onClick?: () => void;
}

const NauticalCompassRose: React.FC<CompassRoseProps> = ({
  headingDeg = 0,
  size = 78,
  onClick,
}) => (
  <svg
    viewBox="0 0 100 100"
    width={size}
    height={size}
    className="nautical-compass-svg-mini"
    onClick={onClick}
    role="button"
    tabIndex={0}
    aria-label="Navigation Compass. Click to orient true North"
    style={{ cursor: 'pointer' }}
  >
    <title>Navigation Compass · Click to orient true North</title>
    <defs>
      {/* Subtle organic sketch filter for hand-drawn nautical engraving */}
      <filter id="cartoInk" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.4" />
      </filter>
    </defs>

    {/* Outer static rings and degree ticks */}
    <g filter="url(#cartoInk)">
      {/* Outer border rings */}
      <circle cx="50" cy="50" r="46" fill="none" stroke="#2a3038" strokeWidth="1.1" opacity="0.75" />
      <circle cx="50" cy="50" r="43" fill="none" stroke="#8c6d46" strokeWidth="0.8" strokeDasharray="1.5,2.5" opacity="0.65" />
      <circle cx="50" cy="50" r="34" fill="none" stroke="#2a3038" strokeWidth="0.65" opacity="0.35" />

      {/* Graduation ticks around the perimeter */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const isCardinal = deg % 90 === 0;
        const r1 = 43;
        const r2 = isCardinal ? 37 : 40;
        const x1 = 50 + r1 * Math.sin(rad);
        const y1 = 50 - r1 * Math.cos(rad);
        const x2 = 50 + r2 * Math.sin(rad);
        const y2 = 50 - r2 * Math.cos(rad);
        return (
          <line
            key={deg}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={isCardinal ? '#c2410c' : '#2a3038'}
            strokeWidth={isCardinal ? 1.0 : 0.6}
            opacity={isCardinal ? 0.9 : 0.45}
          />
        );
      })}

      {/* Crosshair guidelines */}
      <line x1="50" y1="7" x2="50" y2="93" stroke="#2a3038" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.3" />
      <line x1="7" y1="50" x2="93" y2="50" stroke="#2a3038" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.3" />
    </g>

    {/* Rotating 8-Point Nautical Star with authentic faceted shading */}
    <g
      transform={`rotate(${-headingDeg} 50 50)`}
      style={{
        transformOrigin: '50px 50px',
        transition: 'transform 0.15s cubic-bezier(0.2, 0.9, 0.3, 1)',
      }}
    >
      {/* 4 Ordinal points (NE, SE, SW, NW) */}
      {/* NE */}
      <polygon points="50,50 50,22 55,45" fill="#1e242b" opacity="0.6" />
      <polygon points="50,50 50,22 45,45" fill="#8c6d46" opacity="0.5" />
      {/* SE */}
      <polygon points="50,50 78,50 55,55" fill="#1e242b" opacity="0.6" />
      <polygon points="50,50 78,50 55,45" fill="#8c6d46" opacity="0.5" />
      {/* SW */}
      <polygon points="50,50 50,78 45,55" fill="#1e242b" opacity="0.6" />
      <polygon points="50,50 50,78 55,55" fill="#8c6d46" opacity="0.5" />
      {/* NW */}
      <polygon points="50,50 22,50 45,45" fill="#1e242b" opacity="0.6" />
      <polygon points="50,50 22,50 45,55" fill="#8c6d46" opacity="0.5" />

      {/* 4 Primary Cardinal Points with traditional two-tone engraving */}
      {/* South (S) */}
      <polygon points="50,50 50,88 56,50" fill="#1e242b" opacity="0.75" />
      <polygon points="50,50 50,88 44,50" fill="#8c6d46" opacity="0.65" />

      {/* East (E) */}
      <polygon points="50,50 88,50 50,56" fill="#1e242b" opacity="0.75" />
      <polygon points="50,50 88,50 50,44" fill="#8c6d46" opacity="0.65" />

      {/* West (W) */}
      <polygon points="50,50 12,50 50,44" fill="#1e242b" opacity="0.75" />
      <polygon points="50,50 12,50 50,56" fill="#8c6d46" opacity="0.65" />

      {/* North (N) - Prominent Scientific Terracotta / Coral Accent */}
      <polygon points="50,50 50,12 56,50" fill="#c2410c" />
      <polygon points="50,50 50,12 44,50" fill="#ea580c" opacity="0.85" />

      {/* Fleur-de-lis / North Arrowhead cap */}
      <polygon points="50,6 52,14 50,12" fill="#c2410c" />
      <polygon points="50,6 48,14 50,12" fill="#ea580c" />

      {/* Center Nautical Brass Hub */}
      <circle cx="50" cy="50" r="4.2" fill="#f4efe6" stroke="#2a3038" strokeWidth="1.1" />
      <circle cx="50" cy="50" r="1.8" fill="#c2410c" />
    </g>

    {/* Classic Cardinal Direction Letters */}
    <text
      x="50"
      y="8"
      textAnchor="middle"
      fontSize="7.5"
      fontFamily="'Cormorant Garamond', Georgia, 'Times New Roman', serif"
      fontWeight="700"
      fill="#c2410c"
    >
      N
    </text>
    <text
      x="95"
      y="52.5"
      textAnchor="middle"
      fontSize="7"
      fontFamily="'Cormorant Garamond', Georgia, 'Times New Roman', serif"
      fontWeight="700"
      fill="#2a3038"
    >
      E
    </text>
    <text
      x="50"
      y="97"
      textAnchor="middle"
      fontSize="7"
      fontFamily="'Cormorant Garamond', Georgia, 'Times New Roman', serif"
      fontWeight="700"
      fill="#2a3038"
    >
      S
    </text>
    <text
      x="5"
      y="52.5"
      textAnchor="middle"
      fontSize="7"
      fontFamily="'Cormorant Garamond', Georgia, 'Times New Roman', serif"
      fontWeight="700"
      fill="#2a3038"
    >
      W
    </text>
  </svg>
);

/**
 * Small Navigation Compass anchored at the bottom-left of the viewport.
 * Resembles the compass and coordinate display in Reference Image 1.
 * Shows small navigation compass (~78px) with dynamic coordinates beside it.
 */
export const ContextualCompass: React.FC = () => {
  const [headingDeg, setHeadingDeg] = useState(0);
  const [coords, setCoords] = useState<{ lat: number; lon: number }>({
    lat: 12.9716,
    lon: 77.5946,
  });

  useEffect(() => {
    const unsub = OceanState.getInstance().subscribe((snapshot) => {
      if (typeof snapshot.cameraHeading === 'number') {
        setHeadingDeg(snapshot.cameraHeading);
      }
      if (snapshot.cameraCoords) {
        setCoords(snapshot.cameraCoords);
      }
    });
    return unsub;
  }, []);

  const handleResetNorth = () => {
    OceanState.getInstance().requestResetNorth();
  };

  const latFormatted = `${Math.abs(coords.lat).toFixed(4)}° ${coords.lat >= 0 ? 'N' : 'S'}`;
  const lonFormatted = `${Math.abs(coords.lon).toFixed(4)}° ${coords.lon >= 0 ? 'E' : 'W'}`;

  return (
    <div
      className="contextual-compass-bottom-left"
      aria-label="Navigation Compass and Geographic Coordinates"
    >
      {/* Small Nautical Compass Rose (Click to align North) */}
      <div className="compass-rose-container" onClick={handleResetNorth}>
        <NauticalCompassRose headingDeg={headingDeg} size={76} onClick={handleResetNorth} />
      </div>

      {/* Cartographic Coordinate Readout directly beside compass */}
      <div className="compass-coords-readout" onClick={handleResetNorth} title="Center coordinates · Click to orient North">
        <span className="coord-lat-line">{latFormatted}</span>
        <span className="coord-lon-line">{lonFormatted}</span>
      </div>
    </div>
  );
};

export default ContextualCompass;
