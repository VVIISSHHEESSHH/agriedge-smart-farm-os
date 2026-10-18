import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { DashboardHome } from './pages/DashboardHome';
import { AdvancedOps } from './pages/AdvancedOps';
import { AgriSnapDiagnosis } from './pages/AgriSnapDiagnosis';
import {
  IrrigationPage,
  MarketplacePage,
  MarketPricesPage,
  VoiceAssistantPage,
  AlertsPage,
  SettingsPage,
} from './pages/RoutePages';
import {
  type Sector,
  type SensorReading,
  fetchFarm,
  fetchLatestSensor,
  fetchHealth,
} from './services/api';
import './App.css';

function App() {
  const [, setFarm] = useState<unknown | null>(null);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [sensorsMap, setSensorsMap] = useState<Record<number, SensorReading>>({});
  const [selectedSector, setSelectedSector] = useState<Sector | null>(null);
  const [online, setOnline] = useState<boolean>(true);
  const [lastSync, setLastSync] = useState<string>('Just now');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  const loadFarmData = async () => {
    try {
      // 1. Verify health
      await fetchHealth();
      setOnline(true);

      // 2. Load farm & sectors
      const f = await fetchFarm(1);
      setFarm(f);
      setSectors(f.sectors || []);

      // 3. Load latest sensor reading for each sector
      const readingPromises = f.sectors.map(async (sec) => {
        try {
          const r = await fetchLatestSensor(sec.id);
          return { sectorId: sec.id, reading: r };
        } catch {
          return { sectorId: sec.id, reading: null };
        }
      });

      const results = await Promise.all(readingPromises);
      const newMap: Record<number, SensorReading> = {};
      results.forEach((res) => {
        if (res.reading) newMap[res.sectorId] = res.reading;
      });
      setSensorsMap(newMap);

      setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setError(null);
    } catch (err: any) {
      console.warn('Backend probe offline/unreachable:', err);
      setOnline(false);
      setError('Cannot connect to backend server. Make sure FastAPI is running on port 8000.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFarmData();
    // Poll every 30 seconds
    const interval = setInterval(loadFarmData, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <BrowserRouter>
      <div className="agriedge-app-shell">
        <Sidebar
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <div className="agriedge-main-wrapper">
          <TopHeader
            online={online}
            lastSync={lastSync}
            onOpenMobile={() => setMobileOpen(true)}
          />

          <main className="agriedge-content-area">
            {error && (
              <div className="status-banner banner-offline" style={{ marginBottom: '1.25rem' }}>
                <span>⚠️ {error}</span>
              </div>
            )}

            {loading ? (
              <div className="loading-state-box">
                <div className="loading-pulse-spinner" />
                <p>Connecting to AgriEdge OS & loading farm telemetry...</p>
              </div>
            ) : (
              <Routes>
                <Route
                  path="/"
                  element={
                    <DashboardHome
                      sectors={sectors}
                      sensorsMap={sensorsMap}
                      selectedSector={selectedSector}
                      onSelectSector={(sec) => setSelectedSector(sec)}
                      onRefreshData={loadFarmData}
                    />
                  }
                />
                <Route
                  path="/farm"
                  element={
                    <DashboardHome
                      sectors={sectors}
                      sensorsMap={sensorsMap}
                      selectedSector={selectedSector}
                      onSelectSector={(sec) => setSelectedSector(sec)}
                      onRefreshData={loadFarmData}
                    />
                  }
                />
                <Route
                  path="/advanced-ops"
                  element={<AdvancedOps sectors={sectors} onRefreshData={loadFarmData} />}
                />
                <Route path="/agrisnap" element={<AgriSnapDiagnosis />} />
                <Route path="/irrigation" element={<IrrigationPage />} />
                <Route path="/marketplace" element={<MarketplacePage />} />
                <Route path="/prices" element={<MarketPricesPage />} />
                <Route path="/voice" element={<VoiceAssistantPage />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            )}
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
