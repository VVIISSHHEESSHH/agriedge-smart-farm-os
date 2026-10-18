import React from 'react';
import type { Sector } from '../services/api';

interface OmniAcreMapProps {
  sectors: Sector[];
  selectedSectorId?: number;
  onSelectSector: (sector: Sector) => void;
  isSimulatingIrrigation?: boolean;
}

export const OmniAcreMap: React.FC<OmniAcreMapProps> = ({
  sectors,
  selectedSectorId,
  onSelectSector,
  isSimulatingIrrigation = false,
}) => {
  // Sector layout coordinates for 2D parcel grid (A1, A2, B1, B2)
  const mapLayout = [
    { gridCode: 'A1', x: 20, y: 20, width: 230, height: 155 },
    { gridCode: 'A2', x: 270, y: 20, width: 230, height: 155 },
    { gridCode: 'B1', x: 20, y: 195, width: 230, height: 155 },
    { gridCode: 'B2', x: 270, y: 195, width: 230, height: 155 },
  ];

  const getStatusTheme = (status: string) => {
    switch (status) {
      case 'alert':
        return {
          fill: '#2A1816',
          stroke: '#D97746',
          header: '#3B1F1B',
          badge: '#E28D5C',
          text: '#F5C2A5',
          label: 'Priority Review',
        };
      case 'watch':
        return {
          fill: '#262215',
          stroke: '#C9944A',
          header: '#352F1B',
          badge: '#E0AA59',
          text: '#F5DFC0',
          label: 'Hydration Watch',
        };
      default:
        return {
          fill: '#1B2418',
          stroke: '#628549',
          header: '#243220',
          badge: '#7E9B64',
          text: '#C8E0B4',
          label: 'Optimal Vitality',
        };
    }
  };

  return (
    <div className="omnicare-map-wrapper">
      <div className="map-legend">
        <span className="legend-item">
          <span className="legend-dot dot-optimal"></span> Optimal Vitality
        </span>
        <span className="legend-item">
          <span className="legend-dot dot-watch"></span> Hydration Watch
        </span>
        <span className="legend-item">
          <span className="legend-dot dot-alert"></span> Priority Review
        </span>
        {isSimulatingIrrigation && (
          <span className="legend-item pulse-water-tag">
            <span className="flowing-water-dot"></span> Active Simulation Flow
          </span>
        )}
      </div>

      <svg
        viewBox="0 0 520 376"
        className="omnicare-svg-canvas"
        role="img"
        aria-label="OmniAcre Interactive Farm Ecosystem Map"
      >
        <defs>
          <pattern id="soilMicroGrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255, 255, 255, 0.035)" strokeWidth="1" />
          </pattern>

          {/* Biological Root Network / Canal Flow Filters */}
          <linearGradient id="canalGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4A90C4" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#87CEEB" stopOpacity="1" />
            <stop offset="100%" stopColor="#4A90C4" stopOpacity="0.8" />
          </linearGradient>

          <filter id="activeSectorGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#D97746" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* Deep Soil Substrate Base */}
        <rect x="0" y="0" width="520" height="376" fill="#141812" rx="14" />
        <rect x="0" y="0" width="520" height="376" fill="url(#soilMicroGrid)" rx="14" />

        {/* Dynamic Water Canal Network Arteries */}
        <g className={`irrigation-arteries ${isSimulatingIrrigation ? 'canal-active-flow' : ''}`}>
          {/* Central Cross Arteries */}
          <path
            d="M 260 10 L 260 366"
            className="canal-artery vertical-canal"
          />
          <path
            d="M 10 185 L 510 185"
            className="canal-artery horizontal-canal"
          />
          {/* Sub-capillaries */}
          <circle cx="260" cy="185" r="9" className="canal-hub" />
        </g>

        {/* Parcels */}
        {sectors.map((sector, index) => {
          const layout = mapLayout[index % mapLayout.length];
          const isSelected = sector.id === selectedSectorId;
          const theme = getStatusTheme(sector.health_status);

          return (
            <g
              key={sector.id}
              className={`map-sector-group ${isSelected ? 'is-selected' : ''}`}
              onClick={() => onSelectSector(sector)}
              style={{ cursor: 'pointer' }}
              filter={isSelected ? 'url(#activeSectorGlow)' : undefined}
            >
              {/* Parcel Background */}
              <rect
                x={layout.x}
                y={layout.y}
                width={layout.width}
                height={layout.height}
                rx="12"
                fill={theme.fill}
                stroke={isSelected ? '#E28D5C' : theme.stroke}
                strokeWidth={isSelected ? '2.5' : '1.2'}
                className="sector-rect"
              />

              {/* Biological internal canopy veins (subtle SVG lines) */}
              <g className="parcel-internal-veins" opacity="0.35">
                <path
                  d={`M ${layout.x + 15} ${layout.y + layout.height - 15} Q ${layout.x + 70} ${layout.y + 70} ${layout.x + layout.width - 25} ${layout.y + 40}`}
                  stroke={theme.stroke}
                  strokeWidth="1.2"
                  fill="none"
                />
                <path
                  d={`M ${layout.x + 60} ${layout.y + 80} Q ${layout.x + 110} ${layout.y + 115} ${layout.x + 150} ${layout.y + 130}`}
                  stroke={theme.stroke}
                  strokeWidth="0.8"
                  fill="none"
                />
              </g>

              {/* Parcel Header Strip */}
              <rect
                x={layout.x}
                y={layout.y}
                width={layout.width}
                height="34"
                rx="12"
                fill={theme.header}
              />
              <rect
                x={layout.x}
                y={layout.y + 22}
                width={layout.width}
                height="12"
                fill={theme.header}
              />

              {/* Sector Grid Code Circle */}
              <circle cx={layout.x + 22} cy={layout.y + 17} r="10" fill={theme.badge} />
              <text
                x={layout.x + 22}
                y={layout.y + 21}
                fill="#141812"
                fontSize="10"
                fontWeight="800"
                textAnchor="middle"
              >
                {layout.gridCode}
              </text>

              {/* Sector Title */}
              <text
                x={layout.x + 38}
                y={layout.y + 21}
                fill="#F7F3EE"
                fontSize="12"
                fontWeight="700"
              >
                {sector.name.length > 20 ? `${sector.name.substring(0, 18)}...` : sector.name}
              </text>

              {/* Crop & Parcel Area */}
              <text
                x={layout.x + 18}
                y={layout.y + 60}
                fill="#A6AC9F"
                fontSize="11.5"
              >
                Crop: <tspan fill="#F7F3EE" fontWeight="700">{sector.crop}</tspan>
              </text>
              <text
                x={layout.x + 18}
                y={layout.y + 80}
                fill="#A6AC9F"
                fontSize="11"
              >
                Root Zone: <tspan fill="#F7F3EE">{sector.area_hectares} ha · {sector.target_moisture_min}%-{sector.target_moisture_max}%</tspan>
              </text>

              {/* Status Badge Tag */}
              <rect
                x={layout.x + 18}
                y={layout.y + 98}
                width="142"
                height="22"
                rx="6"
                fill="rgba(255, 255, 255, 0.06)"
                stroke={theme.stroke}
                strokeWidth="1"
              />
              <circle cx={layout.x + 28} cy={layout.y + 109} r="4" fill={theme.badge} />
              <text
                x={layout.x + 38}
                y={layout.y + 113}
                fill={theme.text}
                fontSize="9.5"
                fontWeight="800"
                letterSpacing="0.04em"
              >
                {theme.label.toUpperCase()}
              </text>

              {/* Tap to Inspect Indicator */}
              <text
                x={layout.x + 18}
                y={layout.y + 140}
                fill={isSelected ? '#E28D5C' : '#8E9485'}
                fontSize="10.5"
                fontWeight={isSelected ? '700' : '500'}
              >
                {isSelected ? '● Inspected Focus' : 'Tap to inspect biometrics →'}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
