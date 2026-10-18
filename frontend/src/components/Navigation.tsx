import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ScanLine,
  MapPin,
  Droplets,
  Store,
  TrendingUp,
  Mic,
  Bell,
  Settings,
  Activity,
} from 'lucide-react';

interface NavigationProps {
  online: boolean;
  lastSync: string;
}

export const Navigation: React.FC<NavigationProps> = ({ online, lastSync }) => {
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'My Farm (OmniAcre)', path: '/farm', icon: MapPin },
    { name: 'Crop Diagnosis', path: '/agrisnap', icon: ScanLine },
    { name: 'Smart Irrigation', path: '/irrigation', icon: Droplets },
    { name: 'Marketplace', path: '/marketplace', icon: Store },
    { name: 'Market Prices', path: '/prices', icon: TrendingUp },
    { name: 'Advanced Ops', path: '/advanced-ops', icon: Activity },
    { name: 'Voice Assistant', path: '/voice', icon: Mic },
    { name: 'Alerts', path: '/alerts', icon: Bell },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <header className="navbar-container">
      <div className="navbar-top">
        <div className="brand-lockup">
          <div className="brand-logo">🌾</div>
          <div>
            <div className="brand-title">AgriEdge OS</div>
            <div className="brand-subtitle">Smart Farm Operating System</div>
          </div>
        </div>

        <div className="system-status-pills">
          <div className={`status-pill ${online ? 'pill-online' : 'pill-offline'}`}>
            <span className="dot"></span>
            {online ? 'System Connected' : 'Offline Mode'}
          </div>
          <div className="sync-pill">
            Last Sync: <strong>{lastSync}</strong>
          </div>
          <div className="demo-badge">
            [SIMULATED TELEMETRY]
          </div>
        </div>
      </div>

      <nav className="nav-links-bar">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `nav-link-btn ${isActive ? 'nav-active' : ''}`
              }
            >
              <Icon size={18} className="nav-icon" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>
    </header>
  );
};
