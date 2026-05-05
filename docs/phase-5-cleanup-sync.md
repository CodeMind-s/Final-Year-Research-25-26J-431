# Phase 5: Final Cleanup & Sync

> Ensure consistency across all services and remove stale code.

## Checklist

- [ ] 5.1 Update API Gateway auth.controller.ts
- [ ] 5.2 Sync user-service subscription stubs
- [ ] 5.3 Update docker-compose.yml environment variables

---

## 5.1 Update API Gateway Auth Controller

**File:** `apps/api-gateway/src/app/auth/auth.controller.ts`

- Remove the post-OTP-verification block that calls `CreateSubscription` with a free plan (approximately lines 80-94)
- Auth-service now handles trial/plan assignment internally during `verifyOtp`
- The gateway should no longer attempt to create subscriptions — it just forwards the OTP response

---

## 5.2 Sync User-Service Subscription Stubs

**File:** `apps/user-service/src/app/user/user.service.ts`

- Update `checkSubscriptionAccess` to use new plan values (`'free'`, `'pro'`, `'lab'` instead of `'basic'`, `'premium'`)
- Update `getSubscription` to reflect new plan structure
- Remove any references to `stripe_subscription_id`

---

## 5.3 Update docker-compose.yml

**File:** `docker-compose.yml`

Remove:
```yaml
STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}
STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET}
```

Add:
```yaml
PAYHERE_MERCHANT_ID: ${PAYHERE_MERCHANT_ID}
PAYHERE_MERCHANT_SECRET: ${PAYHERE_MERCHANT_SECRET}
PAYHERE_SANDBOX: ${PAYHERE_SANDBOX:-true}
PAYHERE_NOTIFY_URL: ${PAYHERE_NOTIFY_URL}
FRONTEND_URL: ${FRONTEND_URL}
```

---

## Verification

```bash
# Full CI check — all services must pass
npx nx run-many -t lint test build typecheck
```

### End-to-End Scenarios to Verify

| Scenario | Expected Behavior |
|----------|-------------------|
| New LANDOWNER registers | Gets 14-day Pro trial → Can access weather, salinity, deals, planner |
| Trial expires | Downgraded to Free → Can only access weather, salinity |
| LABORATORY registers | Gets Lab Plan → Can access vision features |
| DISTRIBUTOR on Free | Cannot access deals → Upgrades via PayHere → Can access deals |
| ADMIN | Can access everything regardless of plan |
