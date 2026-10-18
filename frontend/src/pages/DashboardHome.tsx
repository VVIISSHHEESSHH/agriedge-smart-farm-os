import React from 'react';
import type { Sector, SensorReading } from '../services/api';
import { SectorCard } from '../components/SectorCard';
import { OmniAcreMap } from '../components/OmniAcreMap';
import { SectorDetailsDrawer } from '../components/SectorDetailsDrawer';
import { CropHealthNetwork } from '../components/CropHealthNetwork';
import {
  AlertTriangle,
  Droplets,
  ScanLine,
  TrendingUp,
  Store,
  ArrowRight,
  ShieldAlert,
  SunMedium,
  CheckCircle2,
  RefreshCw,
  Waves,
  Scale,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface DashboardHomeProps {
  sectors: Sector[];
  sensorsMap: Record<number, SensorReading>;
  selectedSector: Sector | null;
  onSelectSector: (sector: Sector) => void;
  onRefreshData: () => void;
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({
  sectors,
  sensorsMap,
  selectedSector,
  onSelectSector,
  onRefreshData,
}) => {
  // Compute overall status summaries
  const alertCount = sectors.filter((s) => s.health_status === 'alert').length;
  const watchCount = sectors.filter((s) => s.health_status === 'watch').length;
  const optimalCount = sectors.filter((s) => s.health_status === 'healthy').length;

  // Calculate average moisture across sectors
  const readings = Object.values(sensorsMap);
  const avgMoisture = readings.length
    ? (readings.reduce((acc, r) => acc + r.moisture_pct, 0) / readings.length).toFixed(1)
    : '48.5';

  // Compute organic vitality score
  const vitalityScore = sectors.length
    ? Math.round(((optimalCount * 1.0 + watchCount * 0.6) / sectors.length) * 100)
    : 88;

  return (
    <div className="dashboard-content-layout">
      {/* 1. CINEMATIC BIOLOGY-INSPIRED HERO SECTION */}
      <CropHealthNetwork
        score={vitalityScore}
        optimalCount={optimalCount}
        totalParcels={sectors.length}
      />

      {/* 2. Farm Welcome & Environmental Summary */}
      <section className="welcome-banner-card">
        <div className="welcome-left">
          <div className="welcome-tag-row">
            <span className="farm-status-chip">● Autonomous Biosphere</span>
            <span className="location-chip">Haveli Taluka, Pune District</span>
          </div>
          <h1 className="welcome-title">Good day, Rameshwar</h1>
          <p className="welcome-subtext">
            Surya Model Farm is operating in vegetative harmony. Soil root tension is optimal across 3 of 4 parcels, with 1 priority hydration review flagged for West Terrace.
          </p>
        </div>

        <div className="welcome-right">
          <div className="weather-metric-box">
            <div className="weather-top">
              <SunMedium size={24} className="icon-sun" />
              <span className="weather-temp">29°C</span>
            </div>
            <div className="weather-desc">Solar Radiance · Humidity 54%</div>
            <div className="weather-forecast">🌧 10% Precipitation (Next 24h)</div>
          </div>
          <button className="refresh-telemetry-btn" onClick={onRefreshData} title="Sync farm telemetry">
            <RefreshCw size={15} />
            <span>Sync Biosphere</span>
          </button>
        </div>
      </section>

      {/* 3. High-Level Key Farm KPI Cards */}
      <section className="kpi-metrics-row">
        <div className="kpi-stat-card">
          <div className="kpi-icon-wrap icon-sage">
            <CheckCircle2 size={18} />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">Ecosystem Equilibrium</span>
            <div className="kpi-value-row">
              <span className="kpi-main-num">{optimalCount} / {sectors.length}</span>
              <span className="kpi-sub-badge badge-optimal">Parcels Optimal</span>
            </div>
            <span className="kpi-footnote">{watchCount} Watch · {alertCount} Urgent Alert</span>
          </div>
        </div>

        <div className="kpi-stat-card">
          <div className="kpi-icon-wrap icon-blue">
            <Waves size={18} />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">Average Root Moisture</span>
            <div className="kpi-value-row">
              <span className="kpi-main-num">{avgMoisture}%</span>
              <span className="kpi-sub-badge badge-neutral">Stable Range</span>
            </div>
            <span className="kpi-footnote">Target Root-Zone: 40% – 70%</span>
          </div>
        </div>

        <div className="kpi-stat-card">
          <div className="kpi-icon-wrap icon-amber">
            <Droplets size={18} />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">Hydrological Savings</span>
            <div className="kpi-value-row">
              <span className="kpi-main-num">1,450 L</span>
              <span className="kpi-sub-badge badge-savings">Saved This Week</span>
            </div>
            <span className="kpi-footnote">2 midday cycles skipped safely</span>
          </div>
        </div>

        <div className="kpi-stat-card">
          <div className="kpi-icon-wrap icon-brown">
            <Scale size={18} />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">Market Lot Biomass</span>
            <div className="kpi-value-row">
              <span className="kpi-main-num">3,700 kg</span>
              <span className="kpi-sub-badge badge-market">2 Active Listings</span>
            </div>
            <span className="kpi-footnote">Roma Tomatoes & Basmati Rice</span>
          </div>
        </div>
      </section>

      {/* 4. OmniAcre Map & Sector Cards Section */}
      <section className="farm-parcels-section">
        <div className="section-header-row">
          <div>
            <h2 className="section-main-heading">OmniAcre Living Farm Ecosystem & Telemetry</h2>
            <p className="section-sub-heading">
              Select any parcel on the soil matrix to inspect living capillary moisture, root temperature, and trigger simulated hydration cycles.
            </p>
          </div>
          <span className="simul-badge-pill">[SIMULATED SENSORS]</span>
        </div>

        <div className="parcels-split-layout">
          {/* 2D Farm Parcel SVG Map */}
          <div className="map-column">
            <OmniAcreMap
              sectors={sectors}
              selectedSectorId={selectedSector?.id}
              onSelectSector={onSelectSector}
            />
          </div>

          {/* Sector Cards Grid */}
          <div className="cards-column">
            <div className="parcels-grid">
              {sectors.map((sector) => (
                <SectorCard
                  key={sector.id}
                  sector={sector}
                  latestSensor={sensorsMap[sector.id]}
                  isSelected={selectedSector?.id === sector.id}
                  onSelect={onSelectSector}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Recommended Farm Actions */}
      <section className="recommended-actions-section">
        <div className="section-header-row">
          <div>
            <h2 className="section-main-heading">Targeted Agronomic Interventions</h2>
            <p className="section-sub-heading">Prioritized guidance computed from continuous sap telemetry and weather models.</p>
          </div>
        </div>

        <div className="actions-card-grid">
          <div className="action-card urgent-border">
            <div className="action-tag-line">
              <span className="action-priority-badge badge-urgent">Priority Inspection</span>
              <AlertTriangle size={16} className="text-terracotta" />
            </div>
            <h3 className="action-card-title">West Terrace (Cassava) Moisture Dip</h3>
            <p className="action-card-desc">
              Soil moisture is at 25.4% near the minimum threshold of 25%. Confirm physical soil texture before triggering the next 35-minute simulated cycle.
            </p>
            <button
              className="action-cta-btn"
              onClick={() => {
                const s = sectors.find((sec) => sec.crop.toLowerCase().includes('cassava')) || sectors[0];
                if (s) onSelectSector(s);
              }}
            >
              <span>Inspect Cassava Parcel</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="action-card sage-border">
            <div className="action-tag-line">
              <span className="action-priority-badge badge-sage">Water Optimization</span>
              <Droplets size={16} className="text-sage" />
            </div>
            <h3 className="action-card-title">East Basin (Rice) Moisture Optimal</h3>
            <p className="action-card-desc">
              Paddy flooding moisture is holding steady at 74.8%. Rain forecast indicates mild evening showers; midday sprinkler cycle can be skipped.
            </p>
            <Link to="/irrigation" className="action-cta-btn">
              <span>View Irrigation Schedule</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="action-card olive-border">
            <div className="action-tag-line">
              <span className="action-priority-badge badge-olive">AgriSnap Diagnosis</span>
              <ScanLine size={16} className="text-olive" />
            </div>
            <h3 className="action-card-title">Tomato Foliage Health Screening</h3>
            <p className="action-card-desc">
              Genuine TensorFlow Lite model is loaded in your browser memory. Snap leaf photos for instant client-side disease screening with zero image uploads.
            </p>
            <Link to="/agrisnap" className="action-cta-btn">
              <span>Launch Leaf Scanner</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* 6. Agricultural Intelligence & Marketplace Row */}
      <section className="intelligence-tiles-row">
        {/* Marketplace Tile */}
        <div className="intel-card">
          <div className="intel-top">
            <div className="intel-icon-box">
              <Store size={18} />
            </div>
            <span className="intel-tag">Direct Trade</span>
          </div>
          <h3 className="intel-title">Active Produce Listings</h3>
          <p className="intel-desc">
            You have 2 active crop lots posted: <strong>Roma Tomatoes (1,200 kg @ ₹32/kg)</strong> and <strong>Basmati Rice (2,500 kg @ ₹55/kg)</strong>.
          </p>
          <div className="intel-footer">
            <Link to="/marketplace" className="intel-link">
              <span>Manage Produce Listings</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Mandi Benchmark Price Trends Tile */}
        <div className="intel-card">
          <div className="intel-top">
            <div className="intel-icon-box">
              <TrendingUp size={18} />
            </div>
            <span className="intel-tag">[SIMULATED BENCHMARK]</span>
          </div>
          <h3 className="intel-title">Mandi Benchmark Prices</h3>
          <p className="intel-desc">
            Pune APMC Tomato reference is holding steady at <strong>₹30.50 / kg</strong> (+4.2% weekly trend). Compare your asking prices against simulated benchmarks.
          </p>
          <div className="intel-footer">
            <Link to="/prices" className="intel-link">
              <span>Explore Price Charts</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Community Disease Outbreak Radar Tile */}
        <div className="intel-card">
          <div className="intel-top">
            <div className="intel-icon-box">
              <ShieldAlert size={18} />
            </div>
            <span className="intel-tag">Community Radar</span>
          </div>
          <h3 className="intel-title">Regional Outbreak Notices</h3>
          <p className="intel-desc">
            1 community alert active in Pune district: <strong>Tomato Early Blight</strong> (Moderate severity). Preventive copper spray advisory in effect.
          </p>
          <div className="intel-footer">
            <Link to="/alerts" className="intel-link">
              <span>View Regional Radar</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* Slide-out Sector Details Drawer */}
      {selectedSector && (
        <SectorDetailsDrawer
          sector={selectedSector}
          onClose={() => onSelectSector(null as any)}
          onRefreshSector={onRefreshData}
        />
      )}
    </div>
  );
};
