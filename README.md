# ⚡ GridWise — AI-Powered Grid Reliability Platform

> **IBM Bob AI Innovation Hackathon 2026**  
> **Problem Statement U1 — Power Outage Prediction & Grid Equipment Failure Advisor**

GridWise is an AI-powered grid reliability platform designed to help grid operators identify high-risk equipment, predict potential power outages, understand the reasons behind equipment failures, estimate customer impact, and take preventive action before failures occur.

---

## 👥 Team

| Field | Details |
|---|---|
| **Project Name** | GridWise |
| **Problem Statement** | U1 — Power Outage Prediction & Grid Equipment Failure Advisor |
| **Hackathon** | IBM Bob AI Innovation Hackathon 2026 |
| **Team Name** | Balck Clover |
| **Team Lead** | Jigar Kotecha |
| **Members** | Add team members here |

---

## 🎯 Problem Statement

Power-grid equipment such as transformers and substations can fail because of multiple factors including equipment age, high temperature, excessive load, vibration, voltage conditions, maintenance gaps, previous failures, and weather conditions.

Grid operators need a reliable and easy-to-understand system that can identify high-risk equipment, predict potential outage risk, explain the major risk factors, estimate the affected customers and area, and recommend preventive actions.

---

## 💡 Our Solution

**GridWise** converts grid operational and equipment data into actionable risk intelligence for grid operators.

The platform analyzes equipment conditions, historical information, maintenance records, and environmental conditions to calculate an explainable risk score.

The system follows:

```text
Grid Data
    ↓
Risk Analysis
    ↓
Equipment Failure Risk
    ↓
Outage Risk Prediction
    ↓
Customer & Area Impact
    ↓
Preventive Recommendations
```

Instead of only showing a risk number, GridWise explains:

> **Risk → Why → Impact → Action**

This helps operators understand the situation and prioritize preventive maintenance.

---

## ✨ Key Features

### 🔴 1. Equipment Failure Risk

GridWise calculates a risk score for individual grid equipment.

Risk levels:

| Score | Risk Level |
|---:|---|
| 0–39 | 🟢 Low |
| 40–59 | 🟡 Medium |
| 60–79 | 🟠 High |
| 80–100 | 🔴 Critical |

---

### 📊 2. Explainable Risk Analysis

The system considers multiple factors when calculating equipment risk:

| Risk Factor | Weight |
|---|---:|
| Load Stress | 25% |
| Thermal Stress | 20% |
| Equipment Age | 18% |
| Maintenance Gap | 15% |
| Failure History | 12% |
| Weather / Environment | 6% |
| Vibration | 4% |

The weighted approach makes the result easier to understand because operators can see which factors are contributing to the risk.

---

### ⚠️ 3. Outage Risk Prediction

GridWise analyzes equipment and grid zones to provide:

- Outage risk score
- Risk level
- Outage probability
- Critical equipment count
- High-risk equipment count
- Potentially affected customers
- Main risk drivers

---

### 🗺️ 4. Zone-Level Risk

The dashboard provides a zone-level view of grid reliability.

Operators can identify:

- High-risk zones
- Critical equipment
- Customer impact
- Major risk factors
- Potential outage areas

This helps operators prioritize areas that could have a larger impact.

---

### 🛠️ 5. Preventive Recommendations

GridWise generates recommended preventive actions according to the detected risk factors.

Examples:

```text
High Load
    ↓
Reduce load / redistribute load

High Temperature
    ↓
Inspect cooling system

Old Equipment
    ↓
Schedule preventive inspection

Maintenance Overdue
    ↓
Schedule maintenance

Repeated Failures
    ↓
Perform detailed equipment inspection
```

---

### 🔬 6. What-If Simulator

GridWise provides a What-If simulation feature.

Operators can change hypothetical equipment conditions and immediately see how the risk changes.

For example:

```text
Current Load       → 75%
What-If Load       → 95%

Current Temperature → 65°C
What-If Temperature → 85°C

        ↓

Recalculate Risk

        ↓

New Risk Score
New Risk Level
Risk Factors
Recommendations
```

The simulation does not modify the original stored dataset.

---

### 🔔 7. Alerts

GridWise highlights important risk conditions through alerts.

Operators can:

- View alerts
- Identify high-priority issues
- Check affected equipment
- Acknowledge alerts
- Dismiss recommendations when appropriate

---

### 📈 8. Grid Operator Dashboard

The dashboard provides a centralized view of:

- Overall grid health
- Equipment risk
- Outage risk
- Zone risk
- Customer impact
- Alerts
- Recommendations
- What-If simulations

---

# 🧠 Risk Intelligence Engine

GridWise currently uses an **explainable weighted-factor risk model** for the hackathon prototype.

Each factor is normalized and combined using predefined weights.

```text
Risk Score =
    Temperature × 0.20
  + Load × 0.25
  + Vibration × 0.04
  + Age × 0.18
  + Maintenance Gap × 0.15
  + Previous Failures × 0.12
  + Weather × 0.06

Final Risk Score = Weighted Score × 100
```

### Example

```text
Equipment: Transformer T-104

Load Stress       → High
Temperature       → High
Age               → Medium
Maintenance Gap   → High
Failure History   → Medium
Weather           → Low

             ↓

Risk Score: 82/100

             ↓

Risk Level: CRITICAL

             ↓

Recommended:
Schedule immediate inspection
and reduce operational stress.
```

The architecture can later replace the current heuristic model with a trained machine-learning model.

---

# 🔄 System Workflow

```text
                  ┌─────────────────────┐
                  │     Grid Data       │
                  └──────────┬──────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │     Data Processing      │
              └────────────┬─────────────┘
                           │
                           ▼
              ┌──────────────────────────┐
              │    GridWise Risk Engine  │
              │                          │
              │ • Normalize Data         │
              │ • Calculate Risk         │
              │ • Explain Risk Factors  │
              └────────────┬─────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        Equipment      Zone Risk     Outage Risk
           Risk                         │
              │                         ▼
              │                  Customer Impact
              │
              ▼
       Recommendations
              │
              ▼
      ┌───────────────────┐
      │ GridWise Dashboard│
      └───────────────────┘
```

---

# 🛠️ Tech Stack

| Category | Technology |
|---|---|
| **Frontend** | React |
| **Language** | TypeScript |
| **Build Tool** | Vite |
| **Styling** | Tailwind CSS |
| **Charts** | Recharts |
| **State Management** | Zustand |
| **Server State** | TanStack React Query |
| **HTTP Client** | Axios |
| **Icons** | Lucide React |
| **Backend** | Python |
| **API Framework** | FastAPI |
| **Validation** | Pydantic |
| **API Documentation** | OpenAPI / Swagger |
| **Data** | Simulated Grid Dataset |
| **Version Control** | Git & GitHub |
| **AI Development Tool** | IBM Bob AI |

---

# 📁 Repository Structure

```text
GridWise/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   │
│   │   ├── routers/
│   │   │   ├── dashboard.py
│   │   │   ├── equipment.py
│   │   │   ├── zones.py
│   │   │   ├── alerts.py
│   │   │   ├── recommendations.py
│   │   │   ├── outage.py
│   │   │   ├── simulator.py
│   │   │   └── data.py
│   │   │
│   │   ├── engine/
│   │   │   ├── risk_engine.py
│   │   │   └── outage_analyzer.py
│   │   │
│   │   ├── services/
│   │   ├── schemas/
│   │   ├── data/
│   │   └── middleware/
│   │
│   └── scripts/
│       └── generate_data.py
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── api/
│   │   ├── hooks/
│   │   ├── store/
│   │   └── types/
│   │
│   ├── package.json
│   └── vite.config.ts
│
├── data/
│   ├── equipment.json
│   ├── readings.json
│   ├── zones.json
│   ├── maintenance.json
│   ├── failures.json
│   └── alerts.json
│
├── docs/
│   ├── problem-statement.md
│   ├── solution-overview.md
│   ├── architecture.md
│   └── setup-guide.md
│
├── demo/
│   ├── screenshots/
│   └── demo-video-link.txt
│
├── presentation/
│
└── README.md
```

---

# ⚡ How to Run

## Prerequisites

Install the following:

- Python 3.11+
- Node.js 18+
- npm
- Git

---

## 1️⃣ Clone the Repository

```bash
git clone https://github.com/d26it118-png/Student-Hub.git
```

> Replace the repository URL above if GridWise is stored in a different GitHub repository.

Then move into your GridWise project directory.

```bash
cd GridWise
```

---

# 2️⃣ Start Backend

Go to the backend folder:

```bash
cd backend
```

Create a virtual environment:

### Windows

```bash
python -m venv .venv
```

Activate it:

```bash
.venv\Scripts\activate
```

### macOS / Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start FastAPI:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend will run at:

```text
http://localhost:8000
```

API documentation:

```text
http://localhost:8000/docs
```

---

# 3️⃣ Start Frontend

Open a new terminal.

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Frontend will normally run at:

```text
http://localhost:5173
```

---

# 🔌 API Overview

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Check backend health |
| GET | `/api/v1/dashboard/summary` | Dashboard summary |
| GET | `/api/v1/equipment` | Get equipment |
| GET | `/api/v1/equipment/ranking` | Get highest-risk equipment |
| GET | `/api/v1/equipment/{id}` | Equipment details |
| GET | `/api/v1/equipment/{id}/risk` | Equipment risk analysis |
| GET | `/api/v1/zones` | Get grid zones |
| GET | `/api/v1/zones/{id}` | Zone details |
| GET | `/api/v1/alerts` | Get alerts |
| GET | `/api/v1/alerts/unread-count` | Get unread alert count |
| PATCH | `/api/v1/alerts/{id}/acknowledge` | Acknowledge alert |
| GET | `/api/v1/recommendations` | Get recommendations |
| PATCH | `/api/v1/recommendations/{id}/dismiss` | Dismiss recommendation |
| GET | `/api/v1/outage/predictions` | Outage predictions |
| GET | `/api/v1/outage/fleet` | Fleet outage overview |
| GET | `/api/v1/outage/zones/{zone_id}` | Zone outage analysis |
| GET | `/api/v1/outage/impact` | Customer impact |
| POST | `/api/v1/simulator/score` | Run What-If simulation |
| GET | `/api/v1/data/status` | Check data status |
| POST | `/api/v1/data/refresh` | Refresh risk calculations |

---

# 🧪 Example What-If Scenario

Example hypothetical equipment conditions:

```text
Temperature        : 82°C
Load               : 94%
Vibration          : 6.5 mm/s
Equipment Age      : 18 years
Maintenance Gap    : 240 days
Previous Failures  : 2
Weather            : Storm
```

GridWise processes these values and returns:

```text
Risk Score
Risk Level
Risk Factors
Main Risk Drivers
Potential Impact
Recommended Actions
```

This allows operators to test possible scenarios before making operational decisions.

---

# 📊 Data

The hackathon MVP uses simulated grid data representing:

- Transformers
- Substations
- Equipment readings
- Temperature
- Load
- Voltage
- Vibration
- Equipment age
- Maintenance history
- Historical failures
- Weather conditions
- Grid zones
- Alerts

The simulated data allows the complete product workflow to be demonstrated without requiring access to private utility infrastructure.

---

# 🖥️ Dashboard

The GridWise dashboard is designed around the workflow of a grid operator.

```text
┌─────────────────────────────────────────────┐
│              GRIDWISE DASHBOARD             │
├─────────────────────────────────────────────┤
│                                             │
│  Grid Health     Outage Risk    Customers   │
│     92%             18%           12,450    │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  🔴 Critical Equipment                      │
│                                             │
│  Transformer T-104       Risk: 87           │
│  Transformer T-212       Risk: 82           │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  Zone Risk Overview                          │
│                                             │
│  Zone A       🟢 Low                        │
│  Zone B       🟡 Medium                     │
│  Zone C       🔴 Critical                   │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  Preventive Recommendations                 │
│                                             │
│  • Inspect T-104                            │
│  • Reduce load on Zone C                    │
│  • Schedule overdue maintenance             │
│                                             │
└─────────────────────────────────────────────┘
```

---

# 🚀 Future Scope

## Phase 1 — Current MVP

- Equipment risk scoring
- Outage risk analysis
- Zone-level risk
- Customer impact estimation
- Explainable risk factors
- Preventive recommendations
- Alerts
- What-If simulator
- Operator dashboard

## Phase 2 — Machine Learning

Future versions can use historical utility data to train machine-learning models for:

- Equipment failure prediction
- Outage probability prediction
- Anomaly detection
- Risk calibration
- Failure pattern detection

## Phase 3 — Real-Time Monitoring

The system can be extended to integrate:

- IoT sensors
- SCADA systems
- Real-time load data
- Temperature sensors
- Vibration sensors
- Weather APIs

## Phase 4 — Advanced Grid Intelligence

Future improvements could include:

- Grid topology analysis
- Failure propagation prediction
- Automated maintenance prioritization
- Crew dispatch optimization
- More accurate customer impact estimation
- Real-time outage forecasting

## Phase 5 — Enterprise Deployment

Potential enterprise features:

- Role-based authentication
- Audit logs
- Cloud deployment
- Monitoring
- Model governance
- Utility system integrations
- High availability
- Secure data pipelines

---

# ⚠️ Known Limitations

- The current prototype uses simulated data.
- The risk engine is currently an explainable weighted-factor model.
- It is not a production-validated machine-learning prediction system.
- Weather conditions are represented using predefined inputs.
- Customer impact is an estimation based on the available simulated data.
- The prototype is designed for hackathon demonstration and would require extensive validation before production deployment.
- Real utility deployment would require integration with operational systems and appropriate security controls.

---

# 🔐 Safety & Reliability

GridWise is designed as a **decision-support prototype**, not an autonomous control system.

The platform does not directly control grid equipment.

All recommendations should be reviewed by qualified grid operators before being used for real operational decisions.

---

# 🏅 What We're Most Proud Of

The strongest part of GridWise is the connection between:

```text
DATA
  ↓
RISK
  ↓
EXPLANATION
  ↓
IMPACT
  ↓
ACTION
```

Rather than giving operators only a prediction, GridWise tries to answer four important questions:

### 1. What is at risk?

Identify high-risk equipment and zones.

### 2. Why is it at risk?

Show the major contributing factors.

### 3. What could happen?

Estimate outage and customer impact.

### 4. What should we do?

Provide preventive recommendations.

This creates a practical and explainable workflow for grid reliability decision support.

---

# 🎥 Demo

| Artifact | Location |
|---|---|
| 📹 Demo Video | `demo/demo-video-link.txt` |
| 🖼️ Screenshots | `demo/screenshots/` |
| 📊 Presentation | `presentation/` |
| 📚 Documentation | `docs/` |

---

# 📚 Documentation

Additional project documentation:

- [`Problem Statement`](docs/problem-statement.md)
- [`Solution Overview`](docs/solution-overview.md)
- [`Architecture`](docs/architecture.md)
- [`Setup Guide`](docs/setup-guide.md)

---

# ⚖️ Disclaimer

GridWise is a **hackathon prototype** created for the IBM Bob AI Innovation Hackathon 2026.

The project uses simulated data and prototype risk calculations.

Risk scores, outage predictions, customer impact estimates, and recommendations are **not guaranteed real-world predictions** and should not be used as a substitute for validated utility engineering, safety procedures, or operational control systems.

---

# 📜 License

This project was developed for the **IBM Bob AI Innovation Hackathon 2026**.

Add an appropriate open-source license before distributing the project for production use.

---

## ⭐ GridWise

> **Predict Risk. Understand Why. Prevent Outages. Protect Customers.**