# GridWise — AI-Powered Grid Reliability Platform

IBM Bob AI Innovation Hackathon | Problem U1: Power Outage Prediction & Grid Equipment Failure Advisor

## Quick Start

### Prerequisites
- Python 3.11+ (found at `%LOCALAPPDATA%\Programs\Python\Python313\` or use the bundled path)
- Node.js 18+

### 1. Start the Backend

```bash
cd backend
.venv\Scripts\activate          # Windows
# OR: source .venv/bin/activate  # macOS/Linux
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend runs at: http://localhost:8000
API docs at:     http://localhost:8000/docs

### 2. Start the Frontend

```bash
cd frontend
npm install    # first time only
npm run dev
```

Frontend runs at: http://localhost:5173

### 3. One-Command Launch (Windows)

```bat
start-gridwise.bat
```

## Architecture

```
gridwise/
├── backend/          FastAPI + Python risk engine
│   ├── app/
│   │   ├── config.py           Settings (env-based)
│   │   ├── main.py             App factory + startup
│   │   ├── routers/            API endpoints
│   │   ├── engine/             Risk scoring + recommender
│   │   ├── services/           Business logic
│   │   ├── schemas/            Pydantic models
│   │   ├── data/               In-memory store + loader
│   │   └── middleware/         CORS, error handling
│   └── scripts/
│       └── generate_data.py    Simulated dataset generator
├── frontend/         React + Vite + TypeScript
│   └── src/
│       ├── pages/              Dashboard, Equipment, Zones, etc.
│       ├── components/         Reusable UI components
│       ├── api/                Typed API client
│       ├── hooks/              React Query hooks
│       ├── store/              Zustand state
│       └── types/              TypeScript types
└── data/             Simulated grid data (JSON)
    ├── equipment.json
    ├── readings.json
    ├── zones.json
    ├── maintenance.json
    ├── failures.json
    └── alerts.json
```

## API Endpoints (Phase 1)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | System health check |
| GET | /api/v1/dashboard/summary | Full dashboard data |
| GET | /api/v1/equipment | Equipment list with filters |
| GET | /api/v1/equipment/ranking | Top N by risk score |
| GET | /api/v1/equipment/{id} | Equipment detail |
| GET | /api/v1/equipment/{id}/risk | Risk score + factors |
| GET | /api/v1/zones | All zones with risk |
| GET | /api/v1/zones/{id} | Zone detail |
| GET | /api/v1/alerts | Alert list |
| GET | /api/v1/alerts/unread-count | Unread count |
| PATCH | /api/v1/alerts/{id}/acknowledge | Acknowledge alert |
| GET | /api/v1/recommendations | All recommendations |
| PATCH | /api/v1/recommendations/{id}/dismiss | Dismiss recommendation |
| GET | /api/v1/data/status | Data status |
| POST | /api/v1/data/refresh | Re-score all equipment |

## Important Notes

- This is a hackathon prototype using **simulated data**.
- Predictions are not real-world operational guarantees.
- The risk scoring model is a weighted multi-factor algorithm — fully explainable.
- All risk scores include factor breakdowns (no black-box AI).

## Python Path Note

If `python` is not in PATH, use the full path:
```
C:\Users\<user>\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe
```
