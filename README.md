<img width="4362" height="875" alt="logo" src="https://github.com/user-attachments/assets/9c7085ea-bac9-4bda-b541-28f876b849ac" />

# Brinex Server - Crystallization Prediction System


A microservices-based salt crystallization management and prediction system built with NestJS, ONNX Runtime, and gRPC.

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
- **Docker**: Latest version
- **Docker Compose**: Latest version

### Verify Installation

```bash
node --version    # Should be v18+
npm --version
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

### 3. Environment Variables

Create `.env` files for each service or set environment variables:

#### API Gateway
```env
PORT=3400
MONGODB_URI=mongodb://localhost:27017/brinex
JWT_SECRET=your-secret-key
```

#### Crystallization ONNX Service
```env
GRPC_URL=0.0.0.0:50055
```

### 4. Start Docker Services

Start MongoDB, Kafka, and Zookeeper:

```bash
docker-compose up -d
```

Verify services are running:
```bash
docker-compose ps
```

## 🚀 Running the Project

### Option 1: Docker Compose (Recommended)

Run all services in Docker containers with a single command:

**1. Copy environment variables:**
```bash
cp .env.example .env
# Edit .env and fill in your values (MongoDB URI, API keys, etc.)
```

**2. Start all services:**
```bash
docker compose up --build
```

This will start:
- ✅ Zookeeper (port 22181)
- ✅ Kafka (port 29092)
- ✅ Auth Service (gRPC port 50000)
- ✅ User Service (gRPC port 50053)
- ✅ Crystallization Service (gRPC port 50054)
- ✅ Crystallization ONNX Service (gRPC port 50055)
- ✅ Audit Log Service (Kafka consumer)
- ✅ Email Service (Kafka consumer)
- ✅ API Gateway (HTTP port 3400)

**3. Stop services:**
```bash
docker compose down
```

**4. View logs:**
```bash
docker compose logs -f api-gateway
docker compose logs -f crystallization-service
```

---

### Option 2: Local Development

**1. Start infrastructure services:**
```bash
docker compose up zookeeper kafka -d
```

**2. Start all NestJS services:**
```bash
nx run-many -t serve --all
```

---

### Option 3: Run Services Individually

**Terminal 1 - API Gateway:**
```bash
nx serve api-gateway
```

**Terminal 2 - Crystallization Service:**
```bash
nx serve crystallization-service
```

**Terminal 3 - Crystallization ONNX Service:**
```bash
nx serve crystallization-onnx-service
```

**Terminal 4 - Auth Service:**
```bash
nx serve auth-service
```

**Terminal 5 - User Service:**
```bash
nx serve user-service
```

**Terminal 6 - Audit Log Service:**
```bash
nx serve audit-log-service
```

### Verify Services are Running

You should see:
- ✅ `API Gateway running on: http://localhost:3400/api/v1`
- ✅ `Crystallization Service running on gRPC port 50054`
- ✅ `Crystallization ONNX Service running on gRPC port 50055`
- ✅ `Auth microservice listening on gRPC channel`
- ✅ `User microservice listening on gRPC channel`
- ✅ `Audit Log Service running on Kafka`

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

If the ONNX service fails with "Failed to bind to address [::]:50055":
- Check if the service is already running: `Get-Process node`
- Kill existing processes or use a different terminal

### gRPC Connection Refused

Ensure all services are running in the correct order:
1. Docker services (MongoDB, Kafka, Zookeeper)
2. ONNX Service (port 50055)
3. Microservices (Crystallization, Auth, User, Audit Log)
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
│   ├── audit-log-service/         # Audit Logging Service (Kafka)
│   ├── email-service/             # Email Service
│   ├── crystallization-service/   # Crystallization Business Logic
│   └── crystallization-onnx-service/ # ML Prediction Service (ONNX Runtime)
├── proto/                         # gRPC Proto Definitions
├── docker-compose.yml             # Docker Services Configuration
└── package.json                   # Node.js Dependencies
```

## 🛠️ Tech Stack

- **Framework**: NestJS
- **Language**: TypeScript
- **Communication**: gRPC, Kafka
- **Database**: MongoDB
- **Message Queue**: Kafka
- **ML Runtime**: ONNX Runtime
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
