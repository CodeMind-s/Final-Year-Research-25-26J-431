# Phase 3: Access Control Guard (API Gateway)

> Replace numeric-level SubscriptionGuard with feature-based FeatureAccessGuard.

## Checklist

- [x] 3.1 Create `@RequireFeature` decorator
- [x] 3.2 Create FeatureAccessGuard
- [x] 3.3 Update guard pipeline in AuthModule
- [x] 3.4 Update JwtAuthGuard to extract plan from JWT
- [x] 3.5 Update Express Request type definition
- [x] 3.6 Update controllers — replace per-route guards with `@RequireFeature`
- [x] 3.7 Clean up modules (remove SubscriptionGuard re-registrations)
- [x] 3.8 Remove old subscription guard artifacts

---

## 3.1 Create Feature Decorator

**New file:** `apps/api-gateway/src/app/auth/decorators/feature.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';

export const FEATURE_KEY = 'requiredFeature';
export const RequireFeature = (featureKey: string) =>
  SetMetadata(FEATURE_KEY, featureKey);
```

---

## 3.2 Create FeatureAccessGuard

**New file:** `apps/api-gateway/src/app/auth/guards/feature-access.guard.ts`

Global APP_GUARD that:

1. Skips `@Public()` routes (check `IS_PUBLIC_KEY` metadata)
2. Skips ADMIN/SUPERADMIN roles (always allowed)
3. Gets feature requirement from `@RequireFeature` decorator metadata
4. Falls back to path-based auto-detection via `FEATURE_ENDPOINT_MAP`
5. If no feature requirement found → allow (route is unprotected by feature)
6. **Fast path:** Local JWT check (plan + role from token)
7. **Fallback:** gRPC `CheckFeatureAccess` call (authoritative — handles trial expiry)
8. Returns 403 with clear reason on denial: `{ reason: 'role_not_allowed' | 'plan_required', requiredPlans: [...] }`

---

## 3.3 Update Guard Pipeline

**File:** `apps/api-gateway/src/app/auth/auth.module.ts`

Register guards in order:
```
APP_GUARD: JwtAuthGuard → RolesGuard → FeatureAccessGuard
```

Remove `SubscriptionGuard` from providers entirely.

---

## 3.4 Update JwtAuthGuard

**File:** `apps/api-gateway/src/app/auth/guards/jwt-auth.guard.ts`

Extract `plan` and `isTrialActive` from JWT payload into `request.user`:

```typescript
request.user = {
  userId: payload.sub,
  email: payload.email,
  role: payload.role,
  plan: payload.plan,
  isTrialActive: payload.isTrialActive,
};
```

---

## 3.5 Update Express Request Type

**File:** `apps/api-gateway/src/app/auth/types/custom.d.ts`

Add to Request.user interface:
```typescript
plan?: string;
isTrialActive?: boolean;
```

---

## 3.6 Update Controllers

### Crystallization Controller
**File:** `apps/api-gateway/src/app/crystallization-service/crystallization.controller.ts`

- Remove `@UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)` from every method
- Remove `@SubscriptionCheck(0)` from every method
- Add `@RequireFeature('salinity')` on daily measurement endpoints
- Add `@RequireFeature('production_forecast')` on prediction endpoints

### Salt Production Controller
**File:** `apps/api-gateway/src/app/salt-production/salt-production.controller.ts`

- Same pattern — remove UseGuards, add `@RequireFeature('production_forecast')`

### Vision Controller
**File:** `apps/api-gateway/src/app/vision-service/vision.controller.ts`

- Remove class-level `@Public()`
- Keep `@Public()` only on health endpoint
- Add `@Roles(Role.LABORATORY)` at class level
- Add `@RequireFeature('quality_vision_control')` on detection/session endpoints
- Add `@RequireFeature('realtime_statistics')` on statistics endpoints

---

## 3.7 Clean Up Modules

- `apps/api-gateway/src/app/crystallization-service/crystallization.module.ts` — Remove SubscriptionGuard/JwtAuthGuard re-registration from providers
- `apps/api-gateway/src/app/salt-production/salt-production.module.ts` — Same
- `apps/api-gateway/src/app/vision-service/vision.module.ts` — Ensure AUTH_PACKAGE is available for FeatureAccessGuard gRPC fallback

---

## 3.8 Remove Old Subscription Guard Artifacts

- Delete `apps/api-gateway/src/app/auth/guards/subscription.guard.ts`
- Remove `REQUIRED_LEVEL_KEY` and `SubscriptionCheck` decorator from `apps/api-gateway/src/app/auth/decorators/public.decorator.ts`

---

## Verification

```bash
npx nx serve api-gateway   # Start gateway
# Manual API calls:
# - Public routes pass without auth
# - Protected routes check feature access
# - ADMIN bypasses all feature checks
# - LANDOWNER on free plan can access weather but not deals
```

### Verification Result (2026-02-18)

- `nx build api-gateway` — **PASSED** (webpack compiled successfully)
- No SubscriptionGuard references remain in api-gateway
- All Phase 3 items verified complete
- Additional cleanup: removed SubscriptionGuard/JwtAuthGuard re-registrations from user.module.ts
