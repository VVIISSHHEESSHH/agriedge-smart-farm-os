# AgriEdge — Smart Farm OS
> Next-generation agricultural operating system designed to make modern farming simple for farmers while AI handles complex operations in the background.

---

## 🌾 Overview
AgriEdge is an offline-capable, AI-enabled farm management platform built for modern farmers and agricultural collectives. It integrates:
- **Simple Farmer Dashboard**: Actionable crop health, tasks, and weather overviews.
- **AgriSnap AI**: In-browser TFLite screening for 10 tomato labels. The bundled artifact loads and produces model scores, but its provenance and field accuracy are not independently verified.
- **OmniAcre Monitoring**: Farm sector management with simulated soil telemetry (NPK, moisture, pH, temp).
- **Automated Irrigation Engine**: Rule-based smart watering decision simulator with complete transparency logs (no physical hardware attached).
- **Direct Marketplace**: Direct farmer-to-buyer listings, fair bidding, and market reference price benchmarks.
- **Hindi & Voice Support**: Hindi disease guidance and Hindi/English browser speech input where supported; assistant replies are currently displayed in English.
- **Community Outbreak Radar**: Geo-clustered community disease alerts.
- **Installable PWA**: Native service worker caches the app and model; IndexedDB queues AgriSnap scan metadata for reconnect sync. Farm telemetry is not cached offline.

---

## 🛠️ Technology Stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS / Vanilla CSS, Lucide icons.
- **AI / ML**: TensorFlow.js runtime with the bundled tomato TFLite model; model provenance and accuracy are unverified.
- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Pydantic v2.
- **Database**: SQLite with `aiosqlite` (development/testing) & PostgreSQL compatibility (production).
- **Offline / Storage**: Native Service Worker Cache API and IndexedDB.

---

## 🚀 Getting Started on Windows

### Prerequisites
- **Node.js** (v20+ or v24 recommended) & `npm`
- **Python** (v3.12+ recommended) & `pip`
- **Git**

---

### 1. Backend Setup (FastAPI + SQLAlchemy)

Open PowerShell and navigate to the project root:

```powershell
cd C:\Users\DELL\Desktop\farmer2\backend

# Create virtual environment (if not already created)
python -m venv .venv

# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Install dependencies
python -m pip install -r requirements-dev.txt

# Run test suite
pytest

# Start development server
uvicorn app.main:app --reload --port 8000
```

The API will be available at:
- **API root & docs**: `http://localhost:8000/docs`
- **Health endpoint**: `http://localhost:8000/health`

---

### 2. Frontend Setup (React + Vite + TypeScript)

In a separate PowerShell terminal:

```powershell
cd C:\Users\DELL\Desktop\farmer2\frontend

# Install dependencies (already initialized)
npm install

# Run development server
npm run dev
```

The web app will be available at: `http://localhost:5173`

To create a production build:
```powershell
npm run build
```

---

## 🧪 Testing

### Backend Tests
```powershell
cd C:\Users\DELL\Desktop\farmer2\backend
.\.venv\Scripts\pytest.exe
```

---

## 📁 Repository Structure
```
farmer2/
├── backend/
│   ├── app/
│   │   ├── alembic/       # DB schema migrations
│   │   ├── middleware/    # Auth and request middleware
│   │   ├── models/        # SQLAlchemy ORM models
│   │   ├── routers/       # FastAPI route endpoints
│   │   ├── schemas/       # Pydantic validation schemas
│   │   ├── services/      # Simulation & business engines
│   │   ├── config.py      # App settings
│   │   ├── database.py    # Async database session management
│   │   └── main.py        # App factory & lifespan
│   ├── tests/             # Pytest test suite with in-memory SQLite
│   ├── requirements.txt
│   └── requirements-dev.txt
├── frontend/
│   ├── src/               # React components, hooks, services, state
│   ├── public/            # Static assets and PWA manifests
│   ├── package.json
│   └── vite.config.ts
├── ml/                    # ML model assets, conversion scripts, class labels
├── simulator/             # Soil sensor, weather, and irrigation simulation logic
├── docs/                  # Architecture specs, guides, and API documentation
├── AGENTS.md              # Instructions for AI pair programming agents
├── README.md
├── .env.example
└── .gitignore
```

---

## 🔒 Security & Data Note
All simulated data (sensors, weather, market reference prices, irrigation logs) is explicitly tagged with `is_simulated: true` and labelled with `[SIMULATED]` in user-facing views. Demo authentication is intended for prototype evaluation and not for production security.
