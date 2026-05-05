# Phase 1: Schema & Proto Updates

> Foundation layer — everything else depends on this.

## Checklist

- [ ] 1.1 Update auth-service User schema
- [ ] 1.2 Update user-service User schema
- [ ] 1.3 Create Plan schema
- [ ] 1.4 Create Subscription schema
- [ ] 1.5 Create Feature Entitlements config
- [ ] 1.6 Create Feature-to-Endpoint Mapping config
- [ ] 1.7 Update `proto/auth.proto`
- [ ] 1.8 Update `proto/user.proto`

---

## 1.1 Update Auth-Service User Schema

**File:** `apps/auth-service/src/app/auth/schemas/user.schema.ts`

**Changes:**
- Change `plan` enum from `['free', 'basic', 'premium']` to `['free', 'pro', 'lab']`
- Add `trialStartDate`, `trialEndDate`, `isTrialActive` fields

```typescript
@Prop({ enum: ['free', 'pro', 'lab'], default: 'free' })
plan: string;

@Prop({ type: Date, default: null })
trialStartDate: Date | null;

@Prop({ type: Date, default: null })
trialEndDate: Date | null;

@Prop({ default: false })
isTrialActive: boolean;
```

> **Gotcha:** Use explicit `@Prop({ type: Date, default: null })` for Date|null unions — Mongoose cannot infer types from TypeScript unions.

---

## 1.2 Update User-Service User Schema

**File:** `apps/user-service/src/app/user/schemas/user.schema.ts`

Same changes as 1.1 — keep both schemas in sync.

---

## 1.3 Create Plan Schema

**New file:** `apps/auth-service/src/app/auth/schemas/plan.schema.ts`

```typescript
@Schema({ timestamps: true })
export class Plan extends Document {
  @Prop({ unique: true, required: true })
  key: string;                      // 'free' | 'pro' | 'lab'

  @Prop({ required: true })
  name: string;                     // 'Free Plan' | 'Pro Plan' | 'Lab Plan'

  @Prop({ required: true })
  level: number;                    // 0 | 1 | 2

  @Prop({ type: Number, default: 0 })
  priceMonthlyLKR: number;

  @Prop({ type: Number, default: 0 })
  priceAnnualLKR: number;

  @Prop({ type: [String], default: [] })
  featureKeys: string[];

  @Prop({ default: 'monthly' })
  duration: string;                 // 'monthly' | 'annual' | 'lifetime'

  @Prop({ default: true })
  isActive: boolean;
}
```

---

## 1.4 Create Subscription Schema

**New file:** `apps/auth-service/src/app/auth/schemas/subscription.schema.ts`

```typescript
@Schema({ timestamps: true })
export class Subscription extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Plan', required: true })
  planId: Types.ObjectId;

  @Prop({ required: true })
  planKey: string;                  // Denormalized: 'free' | 'pro' | 'lab'

  @Prop({ enum: ['active', 'inactive', 'expired', 'cancelled', 'trial'], default: 'active' })
  status: string;

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, default: null })
  endDate: Date | null;

  @Prop({ type: String, default: null })
  payHereSubscriptionId: string | null;

  @Prop({ type: String, default: null })
  payHereOrderId: string | null;

  @Prop({ default: false })
  isTrial: boolean;

  @Prop({ enum: ['payhere', 'manual', 'trial', 'free'], default: 'free' })
  paymentMethod: string;
}
```

---

## 1.5 Create Feature Entitlements Config

**New file:** `apps/auth-service/src/app/auth/config/feature-entitlements.config.ts`

TypeScript constant (not DB — changes rarely, avoids DB lookups per request):

| Feature Key | Plans | Allowed Roles |
|---|---|---|
| `weather_data` | free, pro | LANDOWNER, SALTSOCIETY, DISTRIBUTOR |
| `salinity` | free, pro | LANDOWNER, SALTSOCIETY |
| `deals` | pro | LANDOWNER, DISTRIBUTOR |
| `planner` | pro | LANDOWNER |
| `production_forecast` | pro | LANDOWNER, DISTRIBUTOR |
| `demand_price_forecast` | pro | LANDOWNER |
| `distributor_recommendation` | pro | DISTRIBUTOR |
| `waste_valorant` | pro | SALTSOCIETY |
| `quality_vision_control` | lab | LABORATORY |
| `salt_crystal_impurity_checker` | lab | LABORATORY |
| `realtime_statistics` | lab | LABORATORY |
| `batch_identification` | lab | LABORATORY |

---

## 1.6 Create Feature-to-Endpoint Mapping

**New file:** `apps/api-gateway/src/app/auth/config/feature-endpoint-map.config.ts`

Maps URL path patterns to feature keys. Used as a fallback when `@RequireFeature` decorator is not applied on a route.

Example patterns:
- `/api/v1/crystallization/daily-measurements/**` → `salinity`
- `/api/v1/crystallization/predictions/**` → `production_forecast`
- `/api/v1/vision/**` → `quality_vision_control`
- `/api/v1/salt-production/**` → `production_forecast`

---

## 1.7 Update `proto/auth.proto`

**File:** `proto/auth.proto`

**Changes:**
- Update `Plan` message: add `key`, `price_monthly_lkr`, `feature_keys[]`; remove old `price`
- Remove `HandleStripeWebhookRequest`
- Add `CheckFeatureAccess` RPC with `feature_key` + `user_role`
- Add PayHere RPCs: `InitiatePayHereCheckout`, `HandlePayHereNotification`
- Clean up `CompleteOnboardingRequest` — remove travel-related fields

---

## 1.8 Update `proto/user.proto`

**File:** `proto/user.proto`

**Changes:**
- Remove `stripe_subscription_id` from `SubscriptionData`
- Remove `CreateSubscriptionRequest`/`Response` messages (subscriptions belong in auth-service)

---

## Verification

```bash
npx nx run-many -t build   # Ensure schemas compile, no type errors
```
