# Phase 2: Plan Service Module (within auth-service)

> Core subscription logic — trial management, feature access checking, plan CRUD.

## Checklist

- [x] 2.1 Create Subscription Module, Service, and Scheduler
- [x] 2.2 Refactor AuthService (remove Stripe, inject SubscriptionService)
- [x] 2.3 Update JWT Payload (include plan + isTrialActive)
- [x] 2.4 Update Auth Controller & Module
- [x] 2.5 Clean up DTOs
- [x] 2.6 Remove Stripe dependency from package.json

---

## 2.1 Create Subscription Module

### New Files

**`apps/auth-service/src/app/auth/subscription/subscription.module.ts`**
- Registers Plan and Subscription Mongoose schemas
- Exports SubscriptionService

**`apps/auth-service/src/app/auth/subscription/subscription.service.ts`**

Key methods:

| Method | Description |
|--------|-------------|
| `seedPlans()` | Seed Free/Pro/Lab on startup if not exist |
| `getPlans()` | Return all active plans |
| `getPlan(planKey)` | Return a single plan by key |
| `createSubscription(userId, planKey, paymentMethod)` | Create subscription record |
| `getActiveSubscription(userId)` | Get user's current active subscription |
| `startProTrial(userId)` | 14-day Pro trial, status='trial', isTrial=true |
| `checkTrialExpiry(userId)` | Returns true if trial is still active |
| `expireTrial(userId)` | Downgrade user plan to 'free', deactivate trial |
| `checkFeatureAccess(userId, featureKey, userRole)` | Core access check logic |
| `processExpiredTrials()` | Bulk expiry processor |

**`apps/auth-service/src/app/auth/subscription/trial-expiry.scheduler.ts`**
- Uses `setInterval` (hourly) to call `processExpiredTrials()`
- Finds all subscriptions where `status='trial'` and `endDate < now`
- Downgrades each user to free plan

### Trial Logic

- **Non-LABORATORY new users** → `startProTrial()` → plan='pro', isTrialActive=true, 14-day duration
- **LABORATORY new users** → plan='lab' directly (Lab Plan is their only option)
- Hourly scheduler finds expired trials and downgrades to free

### Feature Access Check Logic

1. ADMIN/SUPERADMIN → bypass (always allowed)
2. Find feature in `FEATURE_ENTITLEMENTS` by key
3. Check user's role is in `allowedRoles` → else return `role_not_allowed`
4. Check subscription's planKey is in `plans` → else return `plan_required`
5. If trial and expired → auto-downgrade, recheck

---

## 2.2 Refactor AuthService

**File:** `apps/auth-service/src/app/auth/auth.service.ts`

- Remove all Stripe imports and code (`import Stripe`, constructor initialization, checkout sessions)
- Inject `SubscriptionService`
- Delegate `createSubscription`, `getSubscription`, `getPlans`, `getPlan` to SubscriptionService
- Add `checkFeatureAccess()` method that calls SubscriptionService
- Update `verifyOtp()`: after new user creation, call `subscriptionService.startProTrial(userId)` for non-lab users
- Update `oAuthSignIn()`: same trial logic for new OAuth users

---

## 2.3 Update JWT Payload

**Files:** `apps/auth-service/src/app/auth/auth.service.ts` (in `verifyOtp`, `oAuthSignIn`, `login`)

Add `plan` and `isTrialActive` to JWT payload:

```typescript
const payload = {
  sub: user._id,
  email: user.email,
  role: user.role,
  plan: user.plan,
  isTrialActive: user.isTrialActive,
};
```

This avoids a gRPC round-trip on every API request — the gateway guard can check locally from JWT.

---

## 2.4 Update Auth Controller & Module

**`apps/auth-service/src/app/auth/auth.controller.ts`**
- Add `@GrpcMethod('AuthService', 'CheckFeatureAccess')` handler
- Wire it to `authService.checkFeatureAccess()`

**`apps/auth-service/src/app/auth/auth.module.ts`**
- Register Plan and Subscription schemas with MongooseModule.forFeature
- Import SubscriptionModule (or inline SubscriptionService in providers)

---

## 2.5 Clean up DTOs

**File:** `apps/auth-service/src/app/auth/dtos/auth.dto.ts`

- Remove travel-related DTOs: `OnboardingDto`, `OnboardingBasicDto`, `OnboardingSurveyDto`, `FullOnboardingDto`
- Remove stale DTOs: `PersonalDetailsDto` (bloodType, allergies), `AccountSettingsDto`
- Update `CreateSubscriptionDto.plan` enum to `['pro', 'lab']`
- Update `PlanDto` to new structure (key, name, level, priceMonthlyLKR, featureKeys)
- Update `SignInDto` role to include `'SALTSOCIETY'`

---

## 2.6 Remove Stripe Dependency

**File:** `package.json`

```bash
npm uninstall stripe @types/stripe --legacy-peer-deps
```

---

## Verification

```bash
npx nx test auth-service    # Unit tests for subscription service, trial logic, feature access
npx nx build auth-service   # Ensure everything compiles
```

### Verification Result (2026-02-18)

- `nx build auth-service` — **PASSED** (webpack compiled successfully)
- No Stripe references remain in auth-service or package.json
- All Phase 2 items verified complete
