# OpenMine — Rockfall Detection & Mine Safety Intelligence

> **AI-assisted digital twin for open-pit mine monitoring, rockfall risk analysis, and operational intelligence.**

OpenMine is an intelligent mine-monitoring platform designed to support safer and more informed operations in open-pit mining environments.

The system combines **machine learning, real-time mine telemetry, risk analysis, 3D visualization, and an AI operations copilot** into a unified digital-twin interface.

The project is built around the **RockSentinel** intelligence layer, which processes mine data, analyzes risk trends, and provides evidence-based operational insights.

---

## Overview

Rockfalls are a major safety concern in open-pit mining. Detecting abnormal conditions early requires more than a single prediction model — it requires continuous observation of mine conditions, temporal analysis, risk consolidation, and clear operational interpretation.

OpenMine addresses this through a layered architecture:

```text
Mine / Sensor Data
        │
        ▼
Realtime Data Layer
        │
        ▼
ML Risk & Trend Analysis
        │
        ▼
Risk Consolidation
        │
        ├──────────────► Digital Twin / Dashboard
        │
        ▼
RockSentinel AI
        │
        ▼
Evidence-Based Operational Insights
```

The platform is intended to provide a single environment for monitoring mine conditions, exploring predicted risk, understanding trends, and interacting with an AI assistant using the available system context.

---

## Key Capabilities

### Rockfall Risk Intelligence

The RockSentinel ML package provides the core machine-learning workflow for risk analysis.

Current components include:

- Risk prediction
- Risk consolidation
- Temporal trend modelling
- LSTM-based trend training
- Model-backed risk outputs
- Structured prediction results for frontend integration

---

### Digital Twin Interface

OpenMine provides an interactive web interface representing mine conditions through a digital-twin style experience.

The frontend uses:

- React
- TypeScript
- Vite
- Three.js
- React Three Fiber
- Drei
- Post-processing effects
- Framer Motion

The 3D layer enables mine environments and operational information to be represented visually rather than relying exclusively on conventional dashboards.

---

### Real-Time Monitoring

The application contains a realtime service layer for working with continuously changing mine data.

The architecture is designed around:

- sensor observations
- gateway information
- timestamped measurements
- operational status
- alerts
- prediction outputs
- live system context

This data can be consumed by both the dashboard and the AI operations layer.

---

### RockSentinel AI

OpenMine includes **RockSentinel AI**, an operational AI copilot designed specifically for mine monitoring.

Unlike a generic chatbot, RockSentinel AI is designed to answer questions using the system's supplied operational context.

The assistant is instructed to:

- avoid fabricating sensor values
- avoid inventing alerts
- avoid inventing predictions
- use only supplied system data
- explain the reasoning behind its response
- reference relevant evidence
- reference sensor IDs
- reference gateway IDs
- reference timestamps
- provide technical recommendations

Operational responses follow a structured format:

```text
Summary
Evidence
AI Reasoning
Recommendation
Confidence
```

Where applicable, the assistant can also provide information suitable for:

- trend charts
- sensor tables
- alert timelines
- gateway status
- deployment quality

---

## Technology Stack

### Frontend

| Technology | Purpose |
|---|---|
| React | UI framework |
| TypeScript | Application language |
| Vite | Development and build tooling |
| Tailwind CSS | UI styling |
| Three.js | 3D rendering |
| React Three Fiber | React integration for Three.js |
| Drei | 3D utilities |
| React Three Postprocessing | Visual effects |
| Framer Motion | Interface animation |
| Recharts | Data visualization |
| Zustand | Application state |
| React Router | Routing |
| Lucide React | Icons |

### Backend / Services

The repository contains a dedicated backend layer under `backend/` for supporting the application and its data services.

The project also includes:

- prediction services
- realtime services
- assistant services
- application state management
- structured mine data models

### Machine Learning

The `RockSentinel-ML-Package` contains the machine-learning components responsible for risk analysis and temporal modelling.

Current ML modules include:

```text
train_trend_lstm.py
predict_risk.py
consolidate_risk.py
```

These components provide a separation between model development and the main application interface.

### AI

RockSentinel AI currently integrates with the **Groq API**.

The AI middleware runs server-side so that the API key is not exposed to the browser.

---

## Project Structure

```text
OpenMine-Rockfall-Detection/
│
├── backend/
│   ├── app/
│   ├── requirements.txt
│   └── .env.example
│
├── RockSentinel-ML-Package/
│   ├── data/
│   ├── models/
│   ├── src/
│   │   ├── train_trend_lstm.py
│   │   ├── predict_risk.py
│   │   └── consolidate_risk.py
│   ├── requirements-integration.txt
│   └── INTEGRATION_README.md
│
├── src/
│   ├── components/
│   │   ├── designer/
│   │   ├── layout/
│   │   ├── pages/
│   │   ├── three/
│   │   └── ui/
│   │
│   ├── data/
│   │   ├── mockData.ts
│   │   ├── mockDesigner.ts
│   │   ├── designerCatalog.ts
│   │   ├── designerTypes.ts
│   │   └── types.ts
│   │
│   ├── hooks/
│   │   └── usePrediction.ts
│   │
│   ├── pages/
│   │   └── RockSentinelAI.tsx
│   │
│   ├── services/
│   │   ├── assistantService.ts
│   │   ├── predictionService.ts
│   │   └── realtime.ts
│   │
│   ├── store/
│   │   ├── AppContext.tsx
│   │   └── designerStore.ts
│   │
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
│
├── public/
│
├── assistant-middleware.ts
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Getting Started

### Prerequisites

Make sure the following are installed:

- Node.js
- npm
- Python 3.x
- Git

For AI functionality, you will also need a Groq API key.

---

## Installation

Clone the repository:

```bash
git clone https://github.com/NithilSuganthan/OpenMine-Rockfall-Detection.git
cd OpenMine-Rockfall-Detection
```

Install frontend dependencies:

```bash
npm install
```

---

## Configure RockSentinel AI

Create a `.env` file in the project root:

```env
GROQ_API_KEY=your_groq_api_key
```

The repository includes `.env.example` as a template.

The Groq key is consumed by the server-side Vite middleware and is not intended to be exposed to the client-side bundle.

---

## Run the Frontend

Start the Vite development server:

```bash
npm run dev
```

Then open the local development URL shown in your terminal.

---

## Build for Production

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

---

## Machine Learning Package

The ML components are located inside:

```text
RockSentinel-ML-Package/
```

The package contains separate stages for model development and deployment.

### Trend Model Training

The LSTM training workflow is implemented in:

```text
RockSentinel-ML-Package/src/train_trend_lstm.py
```

### Risk Prediction

Risk inference is handled by:

```text
RockSentinel-ML-Package/src/predict_risk.py
```

### Risk Consolidation

Multiple risk signals can be consolidated using:

```text
RockSentinel-ML-Package/src/consolidate_risk.py
```

This separation makes it possible to evolve the machine-learning pipeline independently from the visualization layer.

---

## AI Assistant Architecture

RockSentinel AI is implemented through a server-side middleware layer:

```text
Frontend
   │
   │ POST /api/assistant
   ▼
Vite Server Middleware
   │
   │ Structured mine context
   ▼
RockSentinel AI Prompt
   │
   ▼
Groq API
   │
   ▼
Operational Response
   │
   ▼
Frontend
```

The middleware supports both:

- standard JSON responses
- streaming NDJSON responses

This allows the UI to display AI responses progressively when streaming is enabled.

---

## Design Philosophy

OpenMine is designed around several principles.

### Evidence First

The AI should work from available system information rather than inventing missing values.

### Operational Context

The platform is designed for mine operations rather than general-purpose conversation.

### Explainability

Risk information should be understandable to an operator, including the underlying evidence and reasoning.

### Modular Architecture

The frontend, backend, realtime services, AI layer, and ML package are separated so each component can evolve independently.

### Human-in-the-Loop

The system is intended to support engineering and operational decision-making, not replace human supervision.

---

## Current Architecture

```text
                 ┌──────────────────────┐
                 │      OpenMine UI     │
                 │ React + Three.js     │
                 └──────────┬───────────┘
                            │
             ┌──────────────┼──────────────┐
             │              │              │
             ▼              ▼              ▼
        Realtime        Prediction      RockSentinel
         Services        Services            AI
             │              │              │
             └──────────────┼──────────────┘
                            ▼
                   ┌─────────────────┐
                   │     Backend     │
                   └────────┬────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │ RockSentinel ML     │
                 │ Risk + Trend Models │
                 └─────────────────────┘
```

---

## Safety & Scope

OpenMine is a research and engineering project intended to support mine monitoring and risk analysis.

Predictions, alerts, and AI-generated recommendations should be treated as **decision-support outputs** and validated against appropriate engineering procedures, sensor integrity, site conditions, and operational expertise before being used for safety-critical decisions.

The system should not be treated as a replacement for certified mine-safety systems, professional engineering judgement, or site-specific regulatory procedures.

---

## Roadmap

Potential future development includes:

- integration with physical mine sensors
- expanded realtime telemetry ingestion
- improved rockfall datasets
- additional machine-learning models
- model evaluation and benchmarking
- geospatial mine mapping
- historical event analysis
- automated anomaly detection
- improved 3D mine digital twins
- persistent alert management
- multi-site mine support
- edge deployment for low-latency inference
- expanded AI operational workflows

---

## Contributing

Contributions, ideas, issues, and experiments are welcome.

A typical contribution workflow:

```bash
git checkout -b feature/your-feature
```

Make your changes, test them locally, and submit a pull request.

For larger changes, opening an issue first is recommended so the proposed architecture or feature can be discussed.

---

## License

Add the project's chosen license here before publishing the repository for external reuse.

---

## Author

**Nithil Suganthan**

GitHub: [@NithilSuganthan](https://github.com/NithilSuganthan)

Project: [OpenMine — Rockfall Detection](https://github.com/NithilSuganthan/OpenMine-Rockfall-Detection)

---

## Acknowledgements

OpenMine combines modern web visualization, machine learning, realtime systems, and generative AI into a unified mining-safety research platform.

Built with:

**React · TypeScript · Vite · Three.js · React Three Fiber · Tailwind CSS · Framer Motion · Python · Machine Learning · Groq**
