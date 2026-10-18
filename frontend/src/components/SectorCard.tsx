import React from 'react';
import type { Sector, SensorReading } from '../services/api';
import { Droplet, Thermometer, FlaskConical, Clock, ArrowRight } from 'lucide-react';

interface SectorCardProps {
  sector: Sector;
  latestSensor?: SensorReading;
  isSelected?: boolean;
  isIrrigating?: boolean;
  onSelect: (sector: Sector) => void;
}

export const SectorCard: React.FC<SectorCardProps> = ({
  sector,
  latestSensor,
  isSelected,
  isIrrigating = false,
  onSelect,
}) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'alert':
        return {
          pillClass: 'status-pill-alert',
          dotClass: 'dot-alert',
          label: 'Urgent Inspection',
        };
      case 'watch':
        return {
          pillClass: 'status-pill-watch',
          dotClass: 'dot-watch',
          label: 'Attention Needed',
        };
      default:
        return {
          pillClass: 'status-pill-optimal',
          dotClass: 'dot-optimal',
          label: 'Optimal',
        };
    }
  };

  const statusInfo = getStatusBadge(sector.health_status);
  const moisturePct = latestSensor ? latestSensor.moisture_pct : 0;

  return (
    <div
      className={`earthy-sector-card ${isSelected ? 'is-selected' : ''} ${isIrrigating ? 'card-irrigating' : ''}`}
      onClick={() => onSelect(sector)}
      role="button"
      tabIndex={0}
      aria-label={`Parcel ${sector.name}, crop ${sector.crop}, status ${statusInfo.label}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(sector);
      }}
    >
      <div className="card-top-row">
        <div>
          <span className="card-crop-tag">{sector.crop}</span>
          <h3 className="card-sector-name">{sector.name}</h3>
        </div>
        <div className={`card-status-badge ${statusInfo.pillClass}`}>
          <span className={`status-dot ${statusInfo.dotClass}`} aria-hidden="true" />
          <span>{statusInfo.label}</span>
        </div>
      </div>

      <div className="card-meta-line">
        <span>Parcel: {sector.area_hectares}&nbsp;ha</span>
        <span className="meta-sep">·</span>
        <span>Target Moisture: {sector.target_moisture_min}% – {sector.target_moisture_max}%</span>
      </div>

      {/* Moisture Progress Gauge */}
      <div className="moisture-meter-box">
        <div className="meter-label-row">
          <span className="meter-label">
            {isIrrigating ? '🌊 Simulated Watering in Progress…' : 'Current Moisture'}
          </span>
          <span className="meter-val tabular-nums">{latestSensor ? `${moisturePct}%` : 'No signal'}</span>
        </div>
        <div className="meter-track">
          <div
            className={`meter-bar ${
              isIrrigating
                ? 'bar-irrigating'
                : sector.health_status === 'alert'
                ? 'bar-alert'
                : sector.health_status === 'watch'
                ? 'bar-watch'
                : 'bar-optimal'
            }`}
            style={{ width: `${Math.min(100, Math.max(5, moisturePct))}%` }}
          />
        </div>
      </div>

      {/* Sensor Metric Grid */}
      <div className="card-metrics-grid">
        <div className="metric-box">
          <div className="metric-icon-wrap icon-moisture">
            <Droplet size={14} />
          </div>
          <div className="metric-info">
            <span className="metric-title">Moisture</span>
            <span className="metric-number">{latestSensor ? `${latestSensor.moisture_pct}%` : '—'}</span>
          </div>
        </div>

        <div className="metric-box">
          <div className="metric-icon-wrap icon-temp">
            <Thermometer size={14} />
          </div>
          <div className="metric-info">
            <span className="metric-title">Temperature</span>
            <span className="metric-number">{latestSensor ? `${latestSensor.temp_c}°C` : '—'}</span>
          </div>
        </div>

        <div className="metric-box">
          <div className="metric-icon-wrap icon-ph">
            <FlaskConical size={14} />
          </div>
          <div className="metric-info">
            <span className="metric-title">Soil pH</span>
            <span className="metric-number">{latestSensor ? latestSensor.ph : '—'}</span>
          </div>
        </div>
      </div>

      <div className="card-footer-row">
        <div className="timestamp-group">
          <Clock size={12} />
          <span>
            {latestSensor
              ? new Date(latestSensor.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Syncing'}
          </span>
          <span className="simul-tag">[SIMULATED]</span>
        </div>

        <div className="inspect-link">
          <span>Details</span>
          <ArrowRight size={13} />
        </div>
      </div>
    </div>
  );
};
