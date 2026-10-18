import React, { useState } from 'react';
import {
  Menu,
  Globe,
  Radio,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface TopHeaderProps {
  online: boolean;
  lastSync: string;
  onOpenMobile: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  online,
  lastSync,
  onOpenMobile,
}) => {
  const [currentLang, setCurrentLang] = useState<'EN' | 'HI'>('EN');

  const toggleLanguage = () => {
    setCurrentLang((prev) => (prev === 'EN' ? 'HI' : 'EN'));
  };

  return (
    <header className="top-header">
      <div className="header-left">
        <button
          className="mobile-hamburger-btn"
          onClick={onOpenMobile}
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>

        <div className="farm-selector-pill">
          <span className="farm-pin-icon">📍</span>
          <div className="farm-selector-text">
            <strong>Surya Model Farm</strong>
            <span className="farm-location">Haveli Taluka, Pune, MH</span>
          </div>
        </div>
      </div>

      <div className="header-right">
        {/* Connection status */}
        <div className={`status-pill ${online ? 'pill-connected' : 'pill-disconnected'}`}>
          <Radio size={14} className={online ? 'icon-pulse' : ''} />
          <span>{online ? 'Telemetry Live' : 'Offline'}</span>
        </div>

        {/* Sync timestamp */}
        <div className="sync-info-pill" title="Last backend data sync">
          <Clock size={13} />
          <span>Synced: {lastSync}</span>
        </div>

        {/* Simulated Telemetry Warning Badge */}
        <span className="simulated-header-badge" title="All sensors are deterministic software simulations">
          [SIMULATED]
        </span>

        {/* Language Switcher */}
        <button
          className="lang-toggle-btn"
          onClick={toggleLanguage}
          title="Toggle between English and Hindi interface"
        >
          <Globe size={15} />
          <span>{currentLang === 'EN' ? 'English' : 'हिंदी'}</span>
        </button>

        {/* AgriSnap Fast Action */}
        <Link to="/agrisnap" className="header-quick-action" title="Quick Leaf Health Scan">
          <Sparkles size={15} />
          <span className="quick-action-text">Quick Scan</span>
        </Link>
      </div>
    </header>
  );
};
