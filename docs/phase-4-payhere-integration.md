# Phase 4: PayHere Integration

> Payment gateway for plan purchases/upgrades.

## Checklist

- [ ] 4.1 Create PayHere Service
- [ ] 4.2 Create PayHere Controller (API Gateway)
- [ ] 4.3 Update auth.proto with PayHere RPCs
- [ ] 4.4 Add environment variables

---

## 4.1 Create PayHere Service

**New file:** `apps/auth-service/src/app/auth/subscription/payhere.service.ts`

### Key Methods

| Method | Description |
|--------|-------------|
| `generateCheckoutPayload(order)` | Generate MD5 hash with merchant secret for PayHere form |
| `validateNotification(params)` | Verify webhook hash from PayHere notification |
| `initiateCheckout(userId, planKey, billingCycle)` | Create order, generate hash, return checkout payload |
| `handleNotification(params)` | Validate notification, activate/update subscription |

### PayHere Flow

1. User selects a plan in frontend
2. Frontend calls `POST /payments/payhere/checkout` with `planKey` and `billingCycle`
3. Server generates order with MD5 hash (merchant_id + order_id + amount + currency + merchant_secret)
4. Server returns checkout payload → Frontend redirects to PayHere checkout page
5. User completes payment on PayHere
6. PayHere sends POST to `notify_url` → `POST /payments/payhere/notify`
7. Server validates notification hash, checks `status_code === 2` (success)
8. Server activates subscription, updates user plan

### Hash Generation

```typescript
// Checkout hash
const hash = md5(
  merchantId +
  orderId +
  amountFormatted +
  currency +
  md5(merchantSecret).toUpperCase()
).toUpperCase();

// Notification validation hash
const localHash = md5(
  merchantId +
  orderId +
  payhere_amount +
  payhere_currency +
  statusCode +
  md5(merchantSecret).toUpperCase()
).toUpperCase();
```

---

## 4.2 Create PayHere Controller (API Gateway)

**New file:** `apps/api-gateway/src/app/auth/payhere.controller.ts`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/payments/payhere/checkout` | JWT required | Initiate checkout for a plan |
| POST | `/payments/payhere/notify` | `@Public()` | PayHere webhook (no JWT) |

### Checkout Endpoint
- Reads `planKey` and `billingCycle` from body
- Calls auth-service gRPC `InitiatePayHereCheckout`
- Returns checkout payload (merchant_id, order_id, hash, amount, etc.)

### Notify Endpoint
- Decorated with `@Public()` (PayHere sends server-to-server POST)
- Reads PayHere notification params from body
- Calls auth-service gRPC `HandlePayHereNotification`
- Returns 200 OK

---

## 4.3 Update auth.proto

**File:** `proto/auth.proto`

Add RPCs:
```protobuf
rpc InitiatePayHereCheckout(PayHereCheckoutRequest) returns (PayHereCheckoutResponse);
rpc HandlePayHereNotification(PayHereNotificationRequest) returns (PayHereNotificationResponse);
```

Add messages:
```protobuf
message PayHereCheckoutRequest {
  string user_id = 1;
  string plan_key = 2;
  string billing_cycle = 3;  // 'monthly' | 'annual'
}

message PayHereCheckoutResponse {
  string merchant_id = 1;
  string order_id = 2;
  string hash = 3;
  double amount = 4;
  string currency = 5;
  string items = 6;
  string notify_url = 7;
  string return_url = 8;
  string cancel_url = 9;
}

message PayHereNotificationRequest {
  string merchant_id = 1;
  string order_id = 2;
  string payment_id = 3;
  string payhere_amount = 4;
  string payhere_currency = 5;
  string status_code = 6;
  string md5sig = 7;
}

message PayHereNotificationResponse {
  bool success = 1;
  string message = 2;
}
```

---

## 4.4 Environment Variables

Add to `.env` / `docker-compose.yml`:

```env
PAYHERE_MERCHANT_ID=          # PayHere merchant ID
PAYHERE_MERCHANT_SECRET=      # PayHere merchant secret
PAYHERE_SANDBOX=true          # Use sandbox for testing
PAYHERE_NOTIFY_URL=           # Public webhook URL (e.g., ngrok URL in dev)
FRONTEND_URL=                 # Frontend URL for return/cancel redirects
```

---

## Verification

- Use PayHere sandbox credentials
- Test checkout → webhook → subscription activation flow
- Verify hash generation matches PayHere's expected format
- Test with invalid notification hash → should reject
