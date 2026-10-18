import React, { useState, useEffect } from 'react';
import type {
  Sector,
  SensorReading,
  IrrigationLog,
} from '../services/api';
import {
  fetchSensorHistory,
  fetchIrrigationLogs,
  triggerSensorSimulation,
} from '../services/api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Activity,
  Layers,
  Database,
  RefreshCw,
  Camera,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

interface AdvancedOpsProps {
  sectors: Sector[];
  onRefreshData: () => void;
}

export const AdvancedOps: React.FC<AdvancedOpsProps> = ({ sectors, onRefreshData }) => {
  const [activeSectorId, setActiveSectorId] = useState<number>(sectors[0]?.id || 1);
  const [history, setHistory] = useState<SensorReading[]>([]);
  const [logs, setLogs] = useState<IrrigationLog[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedSector = sectors.find((s) => s.id === activeSectorId) || sectors[0];

  const loadSectorTelemetry = async (sectorId: number) => {
    setLoading(true);
    try {
      const [h, l] = await Promise.all([
        fetchSensorHistory(sectorId, 20),
        fetchIrrigationLogs(sectorId),
      ]);
      const formattedHistory = h.map((item) => ({
        ...item,
        time: new Date(item.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }));
      setHistory(formattedHistory.reverse());
      setLogs(l);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSectorId) {
      loadSectorTelemetry(activeSectorId);
    }
  }, [activeSectorId]);

  const handleTriggerSim = async () => {
    setSimulating(true);
    try {
      await triggerSensorSimulation(activeSectorId);
      await loadSectorTelemetry(activeSectorId);
      onRefreshData();
      setMessage('New deterministic simulation cycle computed and persisted to SQLite.');
    } catch (err: any) {
      setMessage(`Simulation error: ${err.message}`);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="advanced-ops-layout">
      {/* Operator Mode Banner */}
      <div className="ops-header-banner">
        <div className="ops-banner-left">
          <div className="ops-badge-group">
            <span className="ops-tag">TELEMETRY & OPERATIONS</span>
            <span className="simul-badge-operator">[SIMULATED ENVIRONMENT]</span>
          </div>
          <h1 className="ops-banner-title">Advanced Farm Telemetry & Automation Logs</h1>
          <p className="ops-banner-desc">
            Raw root-zone chemistry stream, historical time-series interpolation, and rule-based actuation decision trails.
          </p>
        </div>

        <div className="ops-banner-right">
          <button
            className="btn-trigger-pulse"
            onClick={handleTriggerSim}
            disabled={simulating}
          >
            <RefreshCw size={15} className={simulating ? 'spin' : ''} />
            <span>{simulating ? 'Computing Cycle...' : 'Generate Telemetry Pulse'}</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="ops-success-alert">
          <CheckCircle2 size={16} />
          <span>{message}</span>
        </div>
      )}

      {/* Sector Selector Tabs */}
      <div className="ops-sector-tabs-row">
        {sectors.map((sec) => (
          <button
            key={sec.id}
            className={`ops-pill-tab ${sec.id === activeSectorId ? 'is-active' : ''}`}
            onClick={() => setActiveSectorId(sec.id)}
          >
            <span className="tab-crop-name">{sec.name}</span>
            <span className="tab-crop-type">({sec.crop})</span>
            <span className={`tab-status-dot dot-${sec.health_status}`} />
          </button>
        ))}
      </div>

      <div className="ops-meta-strip">
        <div className="meta-text">
          Inspecting <strong>{selectedSector?.name}</strong> · Area: {selectedSector?.area_hectares} ha · Target Root Moisture: {selectedSector?.target_moisture_min}% – {selectedSector?.target_moisture_max}%
        </div>
      </div>

      {/* Time-Series Chart Card */}
      <section className="ops-card">
        <div className="ops-card-header">
          <div className="ops-card-title">
            <Activity size={18} className="icon-olive" />
            <h3>Soil Moisture & Root Temperature (Time-Series)</h3>
          </div>
          <span className="data-points-badge">Last {history.length} Data Points</span>
        </div>

        {loading ? (
          <div className="ops-loading-box">Fetching sensor telemetry from SQLite...</div>
        ) : history.length > 0 ? (
          <div className="chart-render-wrapper">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={history} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7DF" />
                <XAxis dataKey="time" stroke="#6C7165" fontSize={11} tickLine={false} />
                <YAxis stroke="#6C7165" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E5E7DF',
                    borderRadius: '8px',
                    color: '#20251C',
                    boxShadow: '0 4px 12px rgba(32, 37, 28, 0.08)',
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
                <Line
                  type="monotone"
                  dataKey="moisture_pct"
                  name="Soil Moisture (%)"
                  stroke="#3B6324"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#3B6324' }}
                  activeDot={{ r: 5 }}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
                <Line
                  type="monotone"
                  dataKey="temp_c"
                  name="Soil Temp (°C)"
                  stroke="#C85A48"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#C85A48' }}
                  activeDot={{ r: 5 }}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="ops-empty-box">No historical telemetry recorded for this sector yet.</div>
        )}
      </section>

      {/* Raw Environmental & N-P-K Chemistry Table */}
      <section className="ops-card">
        <div className="ops-card-header">
          <div className="ops-card-title">
            <Database size={18} className="icon-brown" />
            <h3>Raw Environmental Chemistry Log (N-P-K & pH)</h3>
          </div>
          <span className="simul-badge-pill">[SIMULATED READINGS]</span>
        </div>

        <div className="table-container">
          <table className="clean-saas-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Moisture (%)</th>
                <th>Temp (°C)</th>
                <th>pH</th>
                <th>Nitrogen</th>
                <th>Phosphorus</th>
                <th>Potassium</th>
                <th>Sim Seed</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id}>
                  <td className="text-muted">{new Date(row.recorded_at).toLocaleTimeString()}</td>
                  <td><strong>{row.moisture_pct}%</strong></td>
                  <td>{row.temp_c}°C</td>
                  <td>{row.ph}</td>
                  <td>{row.nitrogen_ppm} ppm</td>
                  <td>{row.phosphorus_ppm} ppm</td>
                  <td>{row.potassium_ppm} ppm</td>
                  <td><code className="seed-code">{row.sim_seed}</code></td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={8} className="table-empty-row">No sensor entries logged yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Irrigation Engine Decision Audit Log */}
      <section className="ops-card">
        <div className="ops-card-header">
          <div className="ops-card-title">
            <Layers size={18} className="icon-terracotta" />
            <h3>Automated Irrigation Decision & Rule Audit Trail</h3>
          </div>
          <div className="safety-badge">
            <ShieldCheck size={14} />
            <span>Pure Software Simulation · No Hardware Attached</span>
          </div>
        </div>

        <div className="table-container">
          <table className="clean-saas-table">
            <thead>
              <tr>
                <th>Triggered At</th>
                <th>Decision</th>
                <th>Rule Code</th>
                <th>Duration</th>
                <th>Moisture at Decision</th>
                <th>Agronomic Plain-Text Rationale</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="text-muted">{new Date(log.triggered_at).toLocaleString()}</td>
                  <td>
                    <span className={`decision-chip chip-${log.decision}`}>
                      {log.decision.toUpperCase()}
                    </span>
                  </td>
                  <td><code className="rule-code">{log.rule_code}</code></td>
                  <td>{log.duration_minutes > 0 ? `${log.duration_minutes} mins` : 'None'}</td>
                  <td>{log.moisture_at_decision}%</td>
                  <td className="text-wrap-reason">{log.reason_plain}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="table-empty-row">No automated decisions logged yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Canopy Optical Sensor Placeholder */}
      <section className="ops-card">
        <div className="ops-card-header">
          <div className="ops-card-title">
            <Camera size={18} className="icon-olive" />
            <h3>Field Optical & Multispectral Sensor Interface</h3>
          </div>
        </div>
        <div className="canopy-camera-placeholder">
          <Camera size={32} className="text-muted" />
          <div>
            <strong>Optical / Canopy Camera Stream Interface</strong>
            <p>
              Hardware camera stream placeholder for remote drone or stationary IoT camera feeds. For real mobile/browser leaf disease screening, use <strong>AgriSnap AI</strong> with our in-browser TensorFlow Lite model.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
