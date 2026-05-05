# Claude Code Implementation Prompt — Subscription-Based Service Access System

## Project Context

This is the **Integrated Climate-Intelligent Salt Production Ecosystem** — a final year research project. The system is a microservices-based platform serving different user types in Sri Lanka's salt industry. We need to implement a subscription/plan-based access control system across multiple services.

**Repositories:**
- **Backend (Monorepo):** `C:\Development\python\Final-Year-Research-25-26J-431`
- **Frontend:** `C:\Development\python\Final-Year-Research-25-26J-431-Frontend`

---

## Phase 1: Audit Existing Auth & User Service

### 1.1 — Understand Current Auth Flow
- Review the existing **auth and user service** in the backend monorepo (`@apps/` directory).
- Map out how **registration and login** currently work (JWT, session, OAuth, etc.).
- Identify the **user types** currently supported and how they're stored (DB schema, enums, etc.).

### 1.2 — Identify User Types & Type-Specific Fields
The system has these user types, each requiring **specific onboarding data**:
- **Landowner** (salt land owners)
- **PSS** (Provincial Salt Suppliers)
- **Salt Distributor**
- **Laboratory**

**Task:** Check if the current user/auth service supports storing type-specific profile data. If not, design and build endpoints for an **onboarding flow** that captures additional details per user type.

### 1.3 — Frontend Onboarding Audit
- Review the frontend repo (`Final-Year-Research-25-26J-431-Frontend`) for any existing onboarding UI or multi-step registration flow.
- Determine if it already sends type-specific data to the backend, or if new API endpoints are needed.

**Deliverable:** A clear mapping of what exists vs. what needs to be built for user registration + onboarding per user type.

---

## Phase 2: Subscription & Plan Service

### 2.1 — Create a Dedicated Plan/Subscription Service
Build a new microservice (or module) called **`plan-service`** (or `subscription-service`) responsible for:

- **Plan Definitions** — Store and manage the 3 plan tiers (Free, Pro, Lab Plan).
- **User-Plan Assignment** — Track which plan each user is on.
- **14-Day Pro Trial** — When a new user registers, automatically assign them a **14-day Pro trial**. Track trial start/end dates and auto-downgrade to Free upon expiry.
- **Feature Entitlements** — Define which features are available per plan AND per user type (see Phase 3 below).

### 2.2 — Payment Integration (PayHere)
- Integrate **PayHere** (Sri Lankan payment gateway) for plan purchases/upgrades.
- Build endpoints for:
  - Initiating a payment session
  - Handling PayHere webhook callbacks (success, failure, recurring)
  - Recording payment history
- Create a **`payment-service`** (or payment module within plan-service) to track all transactions.

---

## Phase 3: Feature-Plan-UserType Access Matrix

This is the **core access control logic**. Each feature is tied to a plan AND specific user types.

### Free Plan
| Feature | Allowed User Types |
|---|---|
| Weather Data | Landowner, PSS, Salt Distributor |
| Salinity | Landowner, PSS |

### Pro Plan
| Feature | Allowed User Types |
|---|---|
| Deals | Landowner, Salt Distributor |
| Planner | Landowner |
| Production Forecast | Landowner, Salt Distributor |
| Demand/Price Forecast | Landowner |
| Distributor Recommendation | Salt Distributor |
| Waste Valorant | PSS |

### Lab Plan (Laboratory users only)
| Feature | Allowed User Types |
|---|---|
| Quality Vision Control | Laboratory |
| Salt Crystal Impurity Checker | Laboratory |
| Realtime Statistics | Laboratory |
| Batch-Related Identification | Laboratory |

> **Important Note:** Pro plan includes all Free features. Lab Plan is standalone for Laboratory users.

---

## Phase 4: Middleware-Based Endpoint Access Validation

### The Core Problem
Each feature listed above maps to **specific API endpoints** across multiple services. We need a way to validate that a user's **plan + user type** allows them to hit a given endpoint.

### 4.1 — Audit Existing Middleware
- Check the backend monorepo for any **existing subscription middleware** (there should already be some middleware for subscription-related things — review and extend it).

### 4.2 — Design the Access Control Middleware
Build (or extend) a **gateway-level or per-service middleware** that:

1. **Extracts** the authenticated user's ID from the request (JWT token).
2. **Looks up** the user's current plan (Free / Pro / Lab) and user type (Landowner / PSS / Salt Distributor / Laboratory).
3. **Checks** if the requested endpoint/feature is allowed for that plan + user type combination.
4. **Allows or rejects (403)** the request accordingly.

### 4.3 — Feature-to-Endpoint Mapping
Create a **configuration or database table** that maps:
```
feature_key -> [list of endpoint patterns it covers]
```

For example:
```json
{
  "weather_data": ["/api/weather/*", "/api/climate/*"],
  "salinity": ["/api/salinity/*"],
  "deals": ["/api/deals/*"],
  "production_forecast": ["/api/forecast/production/*"],
  "quality_vision_control": ["/api/vision/quality/*"],
  // ... etc.
}
```

Then the middleware cross-references:
```
User Request → Which feature? → Is (user_type + plan) allowed? → Allow/Deny
```

### 4.4 — Trial Expiry Handling
- The middleware should also check if the user is on a **trial** and whether it has expired.
- If trial expired and no paid plan → downgrade to Free automatically and restrict access accordingly.

---

## Phase 5: Core Service Scaffolding

The system has **4 core services**:

| Service | Status | Purpose |
|---|---|---|
| `crystallization-service` | Exists (`@apps/crystallization-service`) | Salt crystallization predictions & data |
| `vision-service` | Exists (`@apps/vision-service`) | Image-based quality control (YOLOv8) |
| `compass-service` | **New — to be created** | Weather, salinity, forecasting, recommendations |
| `valor-service` | **New — to be created** | Waste valorization features |

**Task:** Scaffold `compass-service` and `valor-service` following the same project structure as the existing services. Ensure they are wired into the monorepo, share the same auth middleware, and are registered with the plan-based access control system.

---

## Implementation Order (Suggested)

```
Step 1 → Audit existing auth, user service, and subscription middleware
Step 2 → Design and implement user type-specific onboarding endpoints
Step 3 → Build the plan-service (plan definitions, trial tracking, feature entitlements)
Step 4 → Build the access control middleware (plan + user type → endpoint validation)
Step 5 → Integrate PayHere payment gateway
Step 6 → Scaffold compass-service and valor-service
Step 7 → Wire all features to their respective services with proper access control
Step 8 → Frontend integration (onboarding flow, plan selection UI, feature gating)
```

---

## Key Principles

- **Check before building** — Always audit what exists in both repos before writing new code.
- **Extend existing middleware** — Don't reinvent; build on what's already there for subscription validation.
- **Config-driven access control** — The feature-plan-usertype matrix should be configurable (DB or config file), not hardcoded in middleware logic.
- **Fail closed** — If plan/type info can't be resolved, deny access by default.
- **Clean separation** — Plan management, payment processing, and access validation should be separate concerns even if in the same service.
