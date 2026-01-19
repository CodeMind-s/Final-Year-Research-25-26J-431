<img width="4362" height="875" alt="logo" src="https://github.com/user-attachments/assets/9c7085ea-bac9-4bda-b541-28f876b849ac" />

# Brinex Server - Crystallization Prediction System


A microservices-based salt crystallization management and prediction system built with NestJS, Python ML services, and gRPC.

## 📋 Table of Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Installation](#installation)
- [Running the Project](#running-the-project)
- [API Endpoints](#api-endpoints)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## 🏗️ Architecture

The system follows a three-tier microservices architecture deployed in Docker containers orchestrated by Kubernetes.

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                             KUBERNETES CLUSTER                                    ║
║  ┌─────────────────────────────────────────────────────────────────────────────┐  ║
║  │                          DOCKER CONTAINERS                                  │  ║
║  │                                                                             │  ║
║  │  ┌───────────────────────────────────────────────────────────────────────┐  │  ║
║  │  │                     LEVEL 1 - API GATEWAY                             │  │  ║
║  │  │                   ┌─────────────────────┐                             │  │  ║
║  │  │                   │   API Gateway       │                             │  │  ║
║  │  │                   │   (Port 3400)       │                             │  │  ║
║  │  │                   └──────────┬──────────┘                             │  │  ║
║  │  └──────────────────────────────┼────────────────────────────────────────┘  │  ║
║  │                                 │ gRPC                                      │  ║
║  │      ┌──────────────────────────┼──────────────────────────┐                │  ║
║  │      ▼                          ▼                          ▼                │  ║
║  │  ┌───────────────────────────────────────────────────────────────────────┐  │  ║
║  │  │                   LEVEL 2 - CORE SERVICES (gRPC)                      │  │  ║
║  │  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐          │  │  ║
║  │  │  │Auth Service│ │Email Svc   │ │Log Service │ │User Service│          │  │  ║
║  │  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘          │  │  ║
║  │  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐          │  │  ║
║  │  │  │Crystall.   │ │Vision Svc  │ │Valor Svc   │ │Compass Svc │          │  │  ║
║  │  │  │Service     │ │            │ │            │ │            │          │  │  ║
║  │  │  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘          │  │  ║
║  │  └────────┼──────────────┼──────────────┼──────────────┼─────────────────┘  │  ║
║  │           │ Kafka        │ Kafka        │ Kafka        │ Kafka              │  ║
║  │           ▼              ▼              ▼              ▼                    │  ║
║  │  ┌───────────────────────────────────────────────────────────────────────┐  │  ║
║  │  │                   LEVEL 3 - ML SERVICES (Kafka)                       │  │  ║
║  │  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐          │  │  ║
║  │  │  │Crystall.   │ │Vision ML   │ │Valor ML    │ │Compass ML  │          │  │  ║
║  │  │  │ML Service  │ │Service     │ │Service     │ │Service     │          │  │  ║
║  │  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘          │  │  ║
║  │  └───────────────────────────────────────────────────────────────────────┘  │  ║
║  │                                                                             │  ║
║  └─────────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                   ║
║  ┌─────────────────────────────────────────────────────────────────────────────┐  ║
║  │                          INFRASTRUCTURE                                     │  ║
║  │     ┌───────────────────────┐      ┌───────────────────────┐                │  ║
║  │     │       MongoDB         │      │   Kafka / Zookeeper   │                │  ║
║  │     │  (L2 Services DB)     │      │  (L2 ↔ L3 Messaging)  │                │  ║
║  │     └───────────────────────┘      └───────────────────────┘                │  ║
║  └─────────────────────────────────────────────────────────────────────────────┘  ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

### Communication Patterns

| Layer | Protocol | Description |
|-------|----------|-------------|
| **L1 → L2** | gRPC | API Gateway communicates with all core services via gRPC |
| **L2 → L3** | Kafka | Core services communicate with ML services via Kafka message queue |
| **L2 → DB** | MongoDB | All Level 2 services persist data in MongoDB |

### Deployment Stack

- **Containerization**: Docker
- **Orchestration**: Kubernetes
- **Message Queue**: Apache Kafka with Zookeeper
- **Database**: MongoDB

## ✅ Prerequisites

### Required Software

- **Node.js**: v18+ and npm
- **Python**: v3.12+
- **Docker**: Latest version
- **Docker Compose**: Latest version

### Verify Installation

```bash
node --version    # Should be v18+
npm --version
python --version  # Should be 3.12+
docker --version
docker-compose --version
```

## 🔧 Environment Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/Final-Year-Research-25-26J-431.git
cd Final-Year-Research-25-26J-431
```

### 2. Install Node.js Dependencies

```bash
npm install
```

### 3. Set Up Python Virtual Environment

```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows (PowerShell):
.venv\Scripts\Activate.ps1

# On Windows (CMD):
.venv\Scripts\activate.bat

# On macOS/Linux:
source .venv/bin/activate
```

### 4. Install Python Dependencies

```bash
pip install -r apps/crystallization-ml-service/requirements.txt
```

Required packages:
- `grpcio>=1.62.0`
- `grpcio-tools>=1.62.0`
- `protobuf>=4.25.0`
- `numpy>=1.26.0`
- `tensorflow>=2.16.1`
- `keras>=3.0.0`
- `python-dateutil>=2.8.2`

### 5. Environment Variables

Create `.env` files for each service or set environment variables:

#### API Gateway
```env
PORT=3400
MONGODB_URI=mongodb://localhost:27017/brinex
JWT_SECRET=your-secret-key
```

#### Crystallization ML Service
```env
GRPC_PORT=50055
MODEL_PATH=models/best_hybrid_model.keras
```

### 6. Start Docker Services

Start MongoDB, Kafka, and Zookeeper:

```bash
docker-compose up -d
```

Verify services are running:
```bash
docker-compose ps
```

## 🚀 Running the Project

### Quick Start

**1. Start Docker services:**
```bash
docker-compose up -d
```

**2. Start all NestJS services:**
```bash
nx run-many -t serve --all
```

**3. Start ML service (in a separate terminal):**
```bash
.venv\Scripts\Activate.ps1  # Activate virtual environment
cd apps/crystallization-ml-service
python src/main.py
```

> **Note:** The ML service runs separately from the NestJS services.

---

### Option 1: Run All Services Together

Start all NestJS microservices:
```bash
nx run-many -t serve --all
```

In a **separate terminal**, start the ML service:
```bash
# Make sure virtual environment is activated
.venv\Scripts\Activate.ps1

# Navigate to ML service directory
cd apps/crystallization-ml-service

# Run the service
python src/main.py
```

### Option 2: Run Services Individually

**Terminal 1 - API Gateway:**
```bash
nx serve api-gateway
```

**Terminal 2 - Crystallization Service:**
```bash
nx serve crystallization-service
```

**Terminal 3 - Auth Service:**
```bash
nx serve auth-service
```

**Terminal 4 - User Service:**
```bash
nx serve user-service
```

**Terminal 5 - Logs Service:**
```bash
nx serve logs-service
```

**Terminal 6 - ML Service:**
```bash
.venv\Scripts\Activate.ps1
cd apps/crystallization-ml-service
python src/main.py
```

### Verify Services are Running

You should see:
- ✅ `API Gateway running on: http://localhost:3400/api/v1`
- ✅ `Crystallization Service running on gRPC port 50054`
- ✅ `Crystallization ML Service running on gRPC port 50055`
- ✅ `Auth microservice listening on gRPC channel`
- ✅ `User microservice listening on gRPC channel`
- ✅ `Logs Service running on gRPC port 50056`

## 📡 API Endpoints

### Crystallization Endpoints

Base URL: `http://localhost:3400/api/v1/crystallization`

#### Get ML Predictions
```http
POST /predictions
Authorization: Bearer <token>
Content-Type: application/json

{
  "start_date": "2025-12-14",
  "forecast_days": 60,
  "current_values": {
    "waterTemperature": 28.5,
    "lagoon": 2,
    "orBrineLevel": 4.5,
    "orBoundLevel": 1.5,
    "irBrineLevel": 5.5,
    "irBoundLevel": 1.5,
    "eastChannel": 7,
    "westChannel": 6.5
  }
}
```

#### Daily Measurements
- `POST /daily-measurement` - Create measurement
- `GET /daily-measurement/:date` - Get by date
- `PATCH /daily-measurement/:id` - Update measurement
- `DELETE /daily-measurement/:id` - Delete measurement

### Authentication
- `POST /api/v1/auth/sign-in` - Sign in
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/verify-otp` - Verify OTP

## 🧪 Testing

### Test Prediction API

```bash
curl -X POST http://localhost:3400/api/v1/crystallization/predictions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2025-12-14",
    "forecast_days": 60,
    "current_values": {
      "waterTemperature": 28.5,
      "lagoon": 2,
      "orBrineLevel": 4.5,
      "orBoundLevel": 1.5,
      "irBrineLevel": 5.5,
      "irBoundLevel": 1.5,
      "eastChannel": 7,
      "westChannel": 6.5
    }
  }'
```

Expected Response:
```json
{
  "status": "success",
  "daily_parameters_forecast": {
    "total_days": 60
  },
  "model_info": {
    "model_type": "LSTM_Hybrid_with_Weather",
    "performance_metrics": {
      "test_r2_score": 0.7750
    }
  },
  "monthly_production_6months": {
    "total_production": 60289.28
  }
}
```

## 🔧 Troubleshooting

### Port Already in Use

If you see `EADDRINUSE` errors:
```bash
# On Windows
netstat -ano | findstr :3400
taskkill /PID <PID> /F

# On macOS/Linux
lsof -ti:3400 | xargs kill -9
```

### ML Service Port Conflict

If the ML service fails with "Failed to bind to address [::]:50055":
- Check if the service is already running: `Get-Process python`
- Kill existing Python processes or use a different terminal

### Python Module Not Found

```bash
# Ensure virtual environment is activated
.venv\Scripts\Activate.ps1

# Reinstall dependencies
pip install -r apps/crystallization-ml-service/requirements.txt
```

### gRPC Connection Refused

Ensure all services are running in the correct order:
1. Docker services (MongoDB, Kafka, Zookeeper)
2. ML Service (port 50055)
3. Microservices (Crystallization, Auth, User, Logs)
4. API Gateway (port 3400)

### Database Connection Issues

```bash
# Restart MongoDB
docker-compose restart

# Check MongoDB logs
docker-compose logs
```

## 📂 Project Structure

```
Final-Year-Research-25-26J-431/
├── apps/
│   ├── api-gateway/               # API Gateway (Port 3400)
│   ├── auth-service/              # Authentication Service
│   ├── user-service/              # User Management Service
│   ├── logs-service/              # Logging Service
│   ├── crystallization-service/  # Crystallization Business Logic
│   └── crystallization-ml-service/ # ML Prediction Service (Python)
├── proto/                         # gRPC Proto Definitions
├── .venv/                         # Python Virtual Environment
├── docker-compose.yml             # Docker Services Configuration
└── package.json                   # Node.js Dependencies
```

## 🛠️ Tech Stack

- **Framework**: NestJS
- **Language**: TypeScript, Python
- **Communication**: gRPC
- **Database**: MongoDB
- **Message Queue**: Kafka
- **ML Framework**: TensorFlow/Keras
- **Build Tool**: Nx

## 📝 License

MIT License

## 👥 Contributors

<a href="https://github.com/bhashanasirimanna">
  <img src="https://github.com/bhashanasirimanna.png" width="50" height="50" style="border-radius: 50%;" alt="bhashanasirimanna"/>
</a>
<a href="https://github.com/thimeshaA">
  <img src="https://github.com/thimeshaA.png" width="50" height="50" style="border-radius: 50%;" alt="thimeshaA"/>
</a>
<a href="https://github.com/arshartisan">
  <img src="https://github.com/arshartisan.png" width="50" height="50" style="border-radius: 50%;" alt="arshartisan"/>
</a>
<a href="https://github.com/randinim">
  <img src="https://github.com/randinim.png" width="50" height="50" style="border-radius: 50%;" alt="randinim"/>
</a>

| Contributor | GitHub |
|-------------|--------|
| Bhashana Sirimanna | [@bhashanasirimanna](https://github.com/bhashanasirimanna) |
| Thimesha A | [@thimeshaA](https://github.com/thimeshaA) |
| Arsh Artisan | [@arshartisan](https://github.com/arshartisan) |
| Randini M | [@randinim](https://github.com/randinim) |


---

For more information, please refer to the [documentation](docs/) or contact the development team.
