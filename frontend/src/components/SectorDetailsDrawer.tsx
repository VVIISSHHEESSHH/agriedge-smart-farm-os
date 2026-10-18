import React, { useState, useEffect } from 'react';
import type {
  Sector,
  SensorReading,
  IrrigationRecommendation,
} from '../services/api';
import {
  fetchLatestSensor,
  fetchIrrigationRecommendation,
  executeSimulatedIrrigation,
  triggerSensorSimulation,
} from '../services/api';
import {
  X,
  Droplets,
  Thermometer,
  FlaskConical,
  Activity,
  Play,
  RefreshCw,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';

interface SectorDetailsDrawerProps {
  sector: Sector;
  onClose: () => void;
  onRefreshSector: () => void;
}

export const SectorDetailsDrawer: React.FC<SectorDetailsDrawerProps> = ({
  sector,
  onClose,
  onRefreshSector,
}) => {
  const [sensor, setSensor] = useState<SensorReading | null>(null);
  const [recommendation, setRecommendation] = useState<IrrigationRecommendation | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [acting, setActing] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isIrrigating, setIsIrrigating] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const s = await fetchLatestSensor(sector.id);
      setSensor(s);
    } catch {
      setSensor(null);
    }

    try {
      const rec = await fetchIrrigationRecommendation(sector.id);
      setRecommendation(rec);
    } catch {
      setRecommendation(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    setActionMessage(null);
    setIsIrrigating(false);
  }, [sector.id]);

  const handleSimulatePulse = async () => {
    setActing(true);
    try {
      await triggerSensorSimulation(sector.id);
      await loadData();
      onRefreshSector();
      setActionMessage('New simulated sensor telemetry computed & logged.');
    } catch (err: any) {
      setActionMessage(`Simulation trigger failed: ${err.message}`);
    } finally {
      setActing(false);
    }
  };

  const handleExecuteIrrigation = async () => {
    setActing(true);
    setIsIrrigating(true);
    try {
      const res = await executeSimulatedIrrigation(sector.id);
      await loadData();
      onRefreshSector();
      setActionMessage(`Simulated irrigation logged: ${res.duration_minutes} min watering cycle.`);
      setTimeout(() => setIsIrrigating(false), 6000);
    } catch (err: any) {
      setActionMessage(`Irrigation execution failed: ${err.message}`);
      setIsIrrigating(false);
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="drawer-header">
          <div>
            <div className="drawer-tag-row">
              <span className="drawer-crop-pill">{sector.crop}</span>
              <span className="drawer-area-pill">{sector.area_hectares} ha</span>
              <span className="drawer-simul-badge">[SIMULATED SECTOR]</span>
            </div>
            <h2 className="drawer-title">{sector.name}</h2>
          </div>
          <button className="drawer-close-btn" onClick={onClose} aria-label="Close drawer">
            <X size={20} />
          </button>
        </div>

        {/* Action Status Message */}
        {actionMessage && (
          <div className="drawer-alert-banner">
            <CheckCircle2 size={16} />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Drawer Body Scroll */}
        <div className="drawer-body">
          {/* Target moisture reference */}
          <div className="drawer-summary-card">
            <div className="summary-row">
              <span className="summary-label">Target Moisture Range</span>
              <strong className="summary-val">{sector.target_moisture_min}% – {sector.target_moisture_max}%</strong>
            </div>
            <div className="summary-row">
              <span className="summary-label">Parcel Health State</span>
              <span className={`drawer-health-tag tag-${sector.health_status}`}>
                {sector.health_status.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Real-time telemetry values */}
          <div className="drawer-section">
            <div className="section-title-row">
              <Activity size={16} className="section-icon" />
              <h3>Current Soil Chemistry</h3>
            </div>

            {loading ? (
              <div className="drawer-loading-text">Loading telemetry...</div>
            ) : sensor ? (
              <div className="telemetry-grid">
                <div className="telemetry-stat-card">
                  <div className="stat-head">
                    <Droplets size={14} className="icon-blue" />
                    <span>Moisture</span>
                  </div>
                  <div className="stat-value">{sensor.moisture_pct}%</div>
                  <div className="stat-sub">Volumetric soil content</div>
                </div>

                <div className="telemetry-stat-card">
                  <div className="stat-head">
                    <Thermometer size={14} className="icon-orange" />
                    <span>Temperature</span>
                  </div>
                  <div className="stat-value">{sensor.temp_c}°C</div>
                  <div className="stat-sub">Root-zone temperature</div>
                </div>

                <div className="telemetry-stat-card">
                  <div className="stat-head">
                    <FlaskConical size={14} className="icon-ph" />
                    <span>Soil pH</span>
                  </div>
                  <div className="stat-value">{sensor.ph}</div>
                  <div className="stat-sub">Slightly acidic (normal)</div>
                </div>

                <div className="telemetry-stat-card">
                  <div className="stat-head">
                    <span className="npk-dot"></span>
                    <span>N - P - K</span>
                  </div>
                  <div className="stat-value">{sensor.nitrogen_ppm} / {sensor.phosphorus_ppm} / {sensor.potassium_ppm}</div>
                  <div className="stat-sub">ppm nutrient balance</div>
                </div>
              </div>
            ) : (
              <div className="drawer-empty-state">No telemetry recorded for this parcel yet.</div>
            )}
          </div>

          {/* Irrigation Engine Recommendation */}
          <div className="drawer-section">
            <div className="section-title-row">
              <Droplets size={16} className="section-icon" />
              <h3>Automated Irrigation Decision</h3>
            </div>

            {recommendation ? (
              <div className="recommendation-card">
                <div className="rec-header">
                  <span className={`rec-decision-pill pill-${recommendation.decision}`}>
                    {recommendation.decision.toUpperCase()}
                  </span>
                  <span className="rec-duration">
                    {recommendation.duration_minutes > 0
                      ? `${recommendation.duration_minutes} min run duration`
                      : 'No watering needed'}
                  </span>
                </div>

                <p className="rec-reason">{recommendation.reason_plain}</p>

                {isIrrigating && (
                  <div className="active-irrigation-flow-banner" role="status" aria-live="polite">
                    <div className="flow-wave-animation" aria-hidden="true" />
                    <span>🌊 Active Simulated Irrigation Flow ({recommendation.duration_minutes || 25}&nbsp;Min Run)</span>
                  </div>
                )}

                <div className="rec-footer-meta">
                  <span>Rule Code: <code>{recommendation.rule_code}</code></span>
                  <span>Moisture: {recommendation.moisture_at_decision}%</span>
                </div>
              </div>
            ) : (
              <div className="drawer-empty-state">Evaluating parcel rule logic...</div>
            )}
          </div>

          {/* Interactive Simulation Controls */}
          <div className="drawer-section">
            <div className="section-title-row">
              <Play size={16} className="section-icon" />
              <h3>Operator Controls (Simulation)</h3>
            </div>

            <div className="drawer-actions-stack">
              <button
                className="btn-drawer-primary"
                onClick={handleExecuteIrrigation}
                disabled={acting}
              >
                <Play size={16} />
                <span>{acting ? 'Executing Cycle...' : 'Execute Simulated Irrigation'}</span>
              </button>

              <button
                className="btn-drawer-secondary"
                onClick={handleSimulatePulse}
                disabled={acting}
              >
                <RefreshCw size={16} className={acting ? 'spin-icon' : ''} />
                <span>Trigger New Telemetry Pulse</span>
              </button>
            </div>

            <div className="hardware-safety-note">
              <ShieldAlert size={14} />
              <span>Safety Boundary: Physical relays and water valves remain completely disconnected. All decisions are software simulation models with transparent audit logs.</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};
