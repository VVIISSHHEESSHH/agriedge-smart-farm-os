import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  MapPin,
  ScanLine,
  Droplets,
  Store,
  TrendingUp,
  Activity,
  Mic,
  Bell,
  Settings,
  Sprout,
  X,
} from 'lucide-react';

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onCloseMobile }) => {
  const monitoringNav = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'OmniAcre Farm Map', path: '/farm', icon: MapPin },
    { name: 'Smart Irrigation', path: '/irrigation', icon: Droplets },
    { name: 'Advanced Ops', path: '/advanced-ops', icon: Activity },
  ];

  const intelligenceNav = [
    { name: 'AgriSnap AI Diagnosis', path: '/agrisnap', icon: ScanLine },
    { name: 'Produce Marketplace', path: '/marketplace', icon: Store },
    { name: 'Mandi Price Trends', path: '/prices', icon: TrendingUp },
    { name: 'Outbreak Radar', path: '/alerts', icon: Bell },
    { name: 'Voice Assistant', path: '/voice', icon: Mic },
  ];

  const systemNav = [
    { name: 'Settings & Language', path: '/settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={onCloseMobile} aria-hidden="true" />
      )}

      <aside className={`app-sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div className="brand-icon-box">
            <Sprout size={22} className="brand-sprout" />
          </div>
          <div className="brand-text">
            <span className="brand-title">AgriEdge</span>
            <span className="brand-badge">SMART FARM OS</span>
          </div>
          {mobileOpen && (
            <button className="mobile-close-btn" onClick={onCloseMobile} aria-label="Close menu">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Navigation Groups */}
        <div className="sidebar-scrollable">
          <div className="nav-group">
            <div className="nav-group-title">Farm Management</div>
            <nav className="nav-list">
              {monitoringNav.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) => `sidebar-nav-link ${isActive ? 'nav-active' : ''}`}
                    onClick={onCloseMobile}
                  >
                    <Icon size={18} className="nav-item-icon" />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div className="nav-group">
            <div className="nav-group-title">Intelligence & Trade</div>
            <nav className="nav-list">
              {intelligenceNav.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => `sidebar-nav-link ${isActive ? 'nav-active' : ''}`}
                    onClick={onCloseMobile}
                  >
                    <Icon size={18} className="nav-item-icon" />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div className="nav-group">
            <div className="nav-group-title">System</div>
            <nav className="nav-list">
              {systemNav.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => `sidebar-nav-link ${isActive ? 'nav-active' : ''}`}
                    onClick={onCloseMobile}
                  >
                    <Icon size={18} className="nav-item-icon" />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Sidebar Footer with Farm Info */}
        <div className="sidebar-footer">
          <div className="farm-info-card">
            <div className="farm-avatar">🌾</div>
            <div className="farm-meta">
              <div className="farm-name">Surya Model Farm</div>
              <div className="farm-sub">Pune · 2.5 Hectares</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
