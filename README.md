# 🛒 ShopAI — Autonomous AI Shopping Agent & Intelligent E-Commerce

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![LangGraph](https://img.shields.io/badge/LangGraph-Agentic_Flow-FF6F00)](https://langchain.com)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://docker.com)

**ShopAI** is a production-ready, autonomous AI shopping assistant and curated multi-category e-commerce platform. It features conversational multi-item instant checkout, multimodal visual search, evidence-based review intelligence, budget guardrails, and real-time inventory management.

---

## ✨ Key Features

- **⚡ 1-Command Autonomous Checkout**: Express order intents like `"buy 2 milk and pure honey"` or `"ek butter or milk order kar do"` and the agent autonomously checks inventory, calculates delivery and discounts, and completes atomic checkout in a single turn.
- **👁️ Multimodal Visual Search**: Upload any photo or select presets to instantly match products with detailed confidence scores and visual analysis.
- **📊 Deep Review Intelligence**: Synthesizes verified reviews into pros, cons, and honest buying verdicts with verified badge badges.
- **📦 Verified Multi-Category Catalog**: 77 hand-curated items across Daily Essentials, Luxury Collection, Organic Produce, Electronics, Fashion, and Home Care.
- **🛡️ Bulletproof Reliability**: Deterministic offline fallback engine guarantees zero downtime even during LLM API rate limits.

---

## 🚀 Quick Start (Local Development)

### 1. Clone the repository
```bash
git clone https://github.com/Alister007-arch/shopi.ai.git
cd shopi.ai
```

### 2. Configure Backend
```bash
cd backend
pip install -r requirements.txt
python setup_db.py
uvicorn main:app --reload --port 8000
```

### 3. Start Frontend
```bash
cd ../frontend
npm install
npm run dev
```

Open `http://localhost:5173` to interact with the application.

---

## 🐳 Docker / Production Deployment

### Build and Run with Docker
```bash
# Build multi-stage image
docker build -t shopai .

# Run container on port 8000
docker run -p 8000:8000 -e GROQ_API_KEY=your_groq_api_key shopai
```

---

## 🛠️ Tech Stack
- **Frontend**: React 19, Vite, Lucide Icons, Canvas Confetti, Vanilla CSS Glassmorphism
- **Backend**: FastAPI, Uvicorn, LangGraph, Groq SDK, Pydantic, Pillow
- **Database**: SQLite3 (`shopai.db`)
- **Containerization**: Docker Multi-stage
