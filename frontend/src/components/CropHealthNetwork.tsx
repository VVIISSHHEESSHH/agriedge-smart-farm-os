import React, { useEffect, useRef, useState } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseAlpha: number;
  pulseSpeed: number;
  phase: number;
  color: string;
}

interface CropHealthNetworkProps {
  score?: number; // 0-100
  optimalCount?: number;
  totalParcels?: number;
}

export const CropHealthNetwork: React.FC<CropHealthNetworkProps> = ({
  score = 88,
  optimalCount = 3,
  totalParcels = 4,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeTab, setActiveTab] = useState<'vitality' | 'vascular' | 'chlorophyll'>('vitality');

  // Interactive 3D particle canvas effect for living bio-canopy
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 360);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 340);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    // Color tones: burnt terracotta, luminous emerald, muted gold, warm ivory
    const colors = ['#E28D5C', '#68D391', '#ECC94B', '#F7FAFC', '#D97746'];

    // Generate floating organic bio-spores & chloroplast particles
    const particleCount = 42;
    const particles: Particle[] = Array.from({ length: particleCount }, () => ({
      x: width * 0.5 + (Math.random() - 0.5) * (width * 0.65),
      y: height * 0.5 + (Math.random() - 0.5) * (height * 0.65),
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45 - 0.15, // slight upward sap drift
      radius: Math.random() * 2.2 + 1.2,
      baseAlpha: Math.random() * 0.6 + 0.25,
      pulseSpeed: Math.random() * 0.03 + 0.015,
      phase: Math.random() * Math.PI * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    let time = 0;
    const render = () => {
      time += 0.02;
      ctx.clearRect(0, 0, width, height);

      // Connect nearby particles with delicate synaptic energy filaments
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 65) {
            const alpha = (1 - dist / 65) * 0.22;
            ctx.strokeStyle = `rgba(226, 141, 92, ${alpha})`;
            ctx.lineWidth = 0.75;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw and update living particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around soft circular bio-bounds
        const cx = width * 0.5;
        const cy = height * 0.5;
        const distFromCenter = Math.hypot(p.x - cx, p.y - cy);
        if (distFromCenter > width * 0.48) {
          p.x = cx + (Math.random() - 0.5) * 40;
          p.y = cy + (Math.random() - 0.5) * 40;
        }

        const alpha = p.baseAlpha + Math.sin(time * p.pulseSpeed * 60 + p.phase) * 0.2;
        ctx.save();
        ctx.globalAlpha = Math.max(0.1, Math.min(1, alpha));
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="botanical-cinematic-stage">
      {/* Editorial Backdrop Accent */}
      <div className="cinematic-backdrop-glow" aria-hidden="true" />
      <div className="ambient-depth-grid" aria-hidden="true" />

      {/* Main Asymmetric Composition */}
      <div className="stage-content-col">
        <div className="editorial-eyebrow">
          <span className="live-pulse-emerald" />
          <span className="eyebrow-text">PHYTO-COGNITIVE CANOPY INTELLIGENCE</span>
          <span className="eyebrow-badge">REAL-TIME TELEMETRY</span>
        </div>

        <h1 className="cinematic-stage-title">
          Autonomous Living <br />
          <span className="title-gradient-accent">Canopy & Soil Biosphere</span>
        </h1>

        <p className="stage-lead-text">
          Continuous bio-impedance, vascular sap velocity, and root-zone water-potential synthesized into a predictive metabolic index across {totalParcels} active acreage parcels.
        </p>

        {/* Dynamic Interactive Metrics Bar */}
        <div className="stage-biometrics-cluster">
          <button
            type="button"
            className={`bio-metric-card ${activeTab === 'vitality' ? 'card-active' : ''}`}
            onClick={() => setActiveTab('vitality')}
          >
            <div className="bio-card-top">
              <span className="metric-tag">BIO-VITALITY</span>
              <span className="status-indicator-dot dot-emerald" />
            </div>
            <div className="bio-card-val tabular-nums">{score}%</div>
            <div className="bio-card-sub">{optimalCount} of {totalParcels} Parcels Peak</div>
          </button>

          <button
            type="button"
            className={`bio-metric-card ${activeTab === 'vascular' ? 'card-active' : ''}`}
            onClick={() => setActiveTab('vascular')}
          >
            <div className="bio-card-top">
              <span className="metric-tag">VASCULAR FLUX</span>
              <span className="status-indicator-dot dot-terracotta" />
            </div>
            <div className="bio-card-val tabular-nums">94.2 <span className="unit-label">mL/h</span></div>
            <div className="bio-card-sub">+3.8% Transpiration Peak</div>
          </button>

          <button
            type="button"
            className={`bio-metric-card ${activeTab === 'chlorophyll' ? 'card-active' : ''}`}
            onClick={() => setActiveTab('chlorophyll')}
          >
            <div className="bio-card-top">
              <span className="metric-tag">CHLOROPHYLL INDEX</span>
              <span className="status-indicator-dot dot-gold" />
            </div>
            <div className="bio-card-val tabular-nums">0.82 <span className="unit-label">NDVI</span></div>
            <div className="bio-card-sub">Luminous Vegetative Density</div>
          </button>
        </div>
      </div>

      {/* Centerpiece: Living 3D-like Botanical Hologram */}
      <div className="stage-visual-col">
        <div className="botanical-hologram-rig" aria-hidden="true">
          {/* Real-time HTML5 Bio-Particle Canvas */}
          <canvas ref={canvasRef} className="bio-particles-canvas" />

          {/* Layered Animated Multi-Depth SVG Canopy */}
          <svg viewBox="0 0 360 360" className="botanical-svg-layer">
            <defs>
              <radialGradient id="deepBioGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#D97746" stopOpacity="0.45" />
                <stop offset="40%" stopColor="#C9944A" stopOpacity="0.22" />
                <stop offset="70%" stopColor="#2B571D" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#0B0E09" stopOpacity="0" />
              </radialGradient>

              <linearGradient id="veinPrimaryStem" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#D97746" />
                <stop offset="45%" stopColor="#E28D5C" />
                <stop offset="85%" stopColor="#68D391" />
                <stop offset="100%" stopColor="#FAF7F2" />
              </linearGradient>

              <linearGradient id="lateralVeinGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ECC94B" />
                <stop offset="70%" stopColor="#D97746" />
                <stop offset="100%" stopColor="#68D391" />
              </linearGradient>

              <filter id="cinematicGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4" result="blur1" />
                <feGaussianBlur stdDeviation="10" result="blur2" />
                <feMerge>
                  <feMergeNode in="blur2" />
                  <feMergeNode in="blur1" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Depth Base Aura */}
            <circle cx="180" cy="180" r="160" fill="url(#deepBioGlow)" />

            {/* Concentric Living Cell Resonance Rings */}
            <circle cx="180" cy="180" r="145" className="hologram-ring ring-outer-dashed" />
            <circle cx="180" cy="180" r="110" className="hologram-ring ring-mid-breathing" />
            <circle cx="180" cy="180" r="75" className="hologram-ring ring-inner-core" />

            {/* Sculpted Living Leaf Silhouette & Vein Skeleton */}
            <g className="sculpted-leaf-geometry" filter="url(#cinematicGlow)">
              {/* Semi-transparent Organic Leaf Shroud */}
              <path
                d="M 180 40 C 250 80, 290 170, 180 320 C 70 170, 110 80, 180 40 Z"
                fill="rgba(43, 87, 29, 0.12)"
                stroke="rgba(104, 211, 145, 0.35)"
                strokeWidth="1.5"
                className="leaf-outer-contour"
              />

              {/* Main Axial Stem Channel */}
              <path
                d="M 180 315 Q 178 220 180 170 Q 182 105 180 45"
                className="cinematic-vein stem-pulsing"
                stroke="url(#veinPrimaryStem)"
                strokeWidth="4"
                fill="none"
              />

              {/* Left Foliage Lateral Veins */}
              <path
                d="M 180 255 C 145 235, 115 205, 95 185"
                className="cinematic-vein lateral-vein left-1"
                stroke="url(#lateralVeinGlow)"
                strokeWidth="2.5"
                fill="none"
              />
              <path
                d="M 180 205 C 135 180, 110 145, 95 105"
                className="cinematic-vein lateral-vein left-2"
                stroke="url(#lateralVeinGlow)"
                strokeWidth="2.2"
                fill="none"
              />
              <path
                d="M 180 150 C 148 125, 130 95, 120 70"
                className="cinematic-vein lateral-vein left-3"
                stroke="url(#lateralVeinGlow)"
                strokeWidth="1.8"
                fill="none"
              />

              {/* Right Foliage Lateral Veins */}
              <path
                d="M 180 260 C 218 240, 248 210, 268 185"
                className="cinematic-vein lateral-vein right-1"
                stroke="url(#lateralVeinGlow)"
                strokeWidth="2.5"
                fill="none"
              />
              <path
                d="M 180 200 C 225 175, 250 140, 265 105"
                className="cinematic-vein lateral-vein right-2"
                stroke="url(#lateralVeinGlow)"
                strokeWidth="2.2"
                fill="none"
              />
              <path
                d="M 180 140 C 212 115, 230 85, 240 70"
                className="cinematic-vein lateral-vein right-3"
                stroke="url(#lateralVeinGlow)"
                strokeWidth="1.8"
                fill="none"
              />

              {/* Bio-Photonic Node Constellation */}
              <circle cx="180" cy="170" r="8" className="bio-node node-heart" />
              <circle cx="95" cy="185" r="5" className="bio-node node-synapse" />
              <circle cx="95" cy="105" r="5.5" className="bio-node node-synapse" />
              <circle cx="120" cy="70" r="4.5" className="bio-node node-synapse" />
              <circle cx="268" cy="185" r="5" className="bio-node node-synapse" />
              <circle cx="265" cy="105" r="5.5" className="bio-node node-synapse" />
              <circle cx="240" cy="70" r="4.5" className="bio-node node-synapse" />
              <circle cx="180" cy="45" r="6" className="bio-node node-apex" />
            </g>
          </svg>

          {/* Floating Core Vitality Dial */}
          <div className="hologram-vitality-dial">
            <span className="vitality-num tabular-nums">{score}</span>
            <span className="vitality-caption">SYSTEM BIO-INDEX</span>
            <div className="vitality-ring-gauge" />
          </div>
        </div>
      </div>
    </div>
  );
};
