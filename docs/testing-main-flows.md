# Testing Guide: User Registration, Onboarding, Trial & Payment Flows

This guide covers end-to-end testing of the 4 core workflows via Swagger UI.

---

## Prerequisites

### 1. Environment Variables

Ensure your `.env` file (at repo root) has:

```env
# MongoDB
MONGO_URI=mongodb+srv://...

# JWT
JWT_SECRET=your_secret

# Kafka
KAFKA_BROKER=localhost:29092

# Notify.lk (for phone OTP)
NOTIFY_LK_USER_ID=your_user_id
NOTIFY_LK_API_KEY=your_api_key
NOTIFY_LK_SENDER_ID=your_sender_id

# PayHere (for payment flow)
PAYHERE_MERCHANT_ID=1228391
PAYHERE_MERCHANT_SECRET=your_secret
PAYHERE_SANDBOX=true
PAYHERE_NOTIFY_URL=https://your-ngrok-domain.ngrok-free.dev/api/v1/payments/notify
FRONTEND_URL=http://localhost:3000

# Email (for email OTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email
EMAIL_PASS=your_app_password
EMAIL_FROM=your_email
```

### 2. Start Infrastructure

```bash
# Start Kafka + Zookeeper
docker-compose up -d kafka zookeeper

# Wait ~30s, then verify both are healthy
docker-compose ps
```

### 3. Start Microservices (4 separate terminals)

Start in this order and wait for each to be ready before starting the next:

**Terminal 1 - Auth Service** (must start first)

```bash
npx nx serve auth-service
# Wait for: "Auth microservice is listening on gRPC channel"
```

**Terminal 2 - User Service**

```bash
npx nx serve user-service
# Wait for: "User microservice is listening on gRPC channel"
```

**Terminal 3 - Payment Service**

```bash
npx nx serve payment-service
# Wait for: "Payment microservice is listening on gRPC channel"
```

**Terminal 4 - API Gateway** (start LAST)

```bash
npx nx serve api-gateway
# Wait for: "Application is running on: http://localhost:3400/api/v1"
```

**Terminal 5 - Point ngrok to API-Gateway**

```bash
ngrok http 3400

you need to run ngrok http 3400 during development
  whenever you're testing payments. PayHere needs a public URL to send
  notifications to your local API gateway. Without it, PayHere can't reach your
  /api/v1/payments/notify endpoint.
```

> **Proto file fix (if hot-reload breaks gRPC):**
>
> ```bash
> cp proto/*.proto dist/apps/api-gateway/proto/
> cp proto/*.proto dist/apps/payment-service/proto/
> ```

### 4. Open Swagger UI

Navigate to: **http://localhost:3400/api/v1**

Endpoints are grouped under **Auth**, **User**, and **Payments** tags.

---

## Flow 1: Create a User (LANDOWNER)

This flow creates a new user via OTP verification.

### Step 1.1: Send OTP

**Endpoint:** `POST /api/v1/auth/sign-in` (under **Auth** tag, no auth required)

#### Option A: Email OTP

```json
{
  "email": "yourname@gmail.com",
  "role": "LANDOWNER"
}
```

- Requires `email-service` running with valid email config
- OTP is also printed in the **auth-service terminal logs**

#### Option B: Phone OTP (Sri Lankan number)

```json
{
  "phone": "0774338424",
  "role": "LANDOWNER"
}
```

- Requires valid Notify.lk credentials in `.env`
- Phone numbers are auto-converted: `0774338424` -> `94774338424`
- OTP is also printed in the **auth-service terminal logs**

> **Important:** Do NOT send both `email` and `phone` together. If both are provided, only the email path executes.

**Expected Response:**

```json
{
  "success": true,
  "user": "yourname@gmail.com"
}
```

### Step 1.2: Get OTP Code

Check the **auth-service terminal** for a log line like:

```
[AuthService] Generated OTP 897361 for yourname@gmail.com with role LANDOWNER
```

### Step 1.3: Verify OTP

**Endpoint:** `POST /api/v1/auth/verify-otp` (under **Auth** tag, no auth required)

For email:

```json
{
  "email": "yourname@gmail.com",
  "code": "897361"
}
```

For phone:

```json
{
  "phone": "0774338424",
  "code": "897361"
}
```

> **Important:** Use the same identifier (email or phone) that you used in Step 1.1.

**Expected Response:**

```json
{
  "accessToken": "eyJhbGciOi...",
  "isNewUser": true,
  "isOnboarded": false
}
```

### Step 1.4: Authorize Swagger

1. Copy the `accessToken` value from the response
2. Click the **Authorize** button (lock icon at top-right of Swagger page)
3. Paste the token (without "Bearer " prefix - Swagger adds it)
4. Click **Authorize** then **Close**

All subsequent requests will include this JWT.

---

## Flow 2: Verify Pro Trial (automatic for new users)

When a new non-LABORATORY user verifies OTP, auth-service automatically starts a **14-day Pro trial**.

### Step 2.1: Decode the JWT

Go to [jwt.io](https://jwt.io) and paste the `accessToken` from Flow 1.

**Expected JWT payload:**

```json
{
  "sub": "6996ee6ca21dba4bffe595f0",
  "role": "LANDOWNER",
  "plan": "pro",
  "planIndex": 1,
  "isTrialActive": true,
  "iat": 1771499116,
  "exp": 1772103916
}
```

Key fields:

- `plan: "pro"` - User is on the Pro plan
- `isTrialActive: true` - This is a trial (not a paid subscription)
- `planIndex: 1` - Pro plan level (used for feature gating)

### Step 2.2: Verify via Personal Details

**Endpoint:** `GET /api/v1/auth/personal-details` (under **Auth** tag, requires JWT)

**Expected Response:**

```json
{
  "user": {
    "id": "...",
    "email": "yourname@gmail.com",
    "role": "LANDOWNER",
    "isOnboarded": false,
    "plan": "pro",
    "isSubscribed": false,
    "isVerified": false
  }
}
```

Verify that `plan` is `"pro"` (matching the JWT).

---

## Flow 3: Onboard User by Role

After creating a user, they need to complete role-specific onboarding.

### Step 3.1: LANDOWNER Onboarding

**Endpoint:** `POST /api/v1/auth/onboarding/landowner` (under **Auth** tag, requires JWT with LANDOWNER role)

```json
{
  "docUrls": ["https://example.com/doc1.pdf"],
  "totalBeds": 5,
  "nic": "123456789V",
  "address": "123 Salt Rd, Puttalam"
}
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Landowner onboarding successful"
}
```

### Step 3.2: LABORATORY Onboarding - NEED TO BE TESTED

> Requires a user created with `"role": "LABORATORY"`

**Endpoint:** `POST /api/v1/auth/onboarding/laboratory` (under **Auth** tag, requires JWT with LABORATORY role)

```json
{
  "docUrls": ["https://example.com/cert.pdf"],
  "laboratoryName": "Salt Quality Labs",
  "registrationNumber": "LAB-2024-001",
  "address": "456 Lab Ave, Colombo"
}
```

### Step 3.3: DISTRIBUTOR Onboarding - NEED TO BE TESTED

> Requires a user created with `"role": "DISTRIBUTOR"`

**Endpoint:** `POST /api/v1/auth/onboarding/distributor` (under **Auth** tag, requires JWT with DISTRIBUTOR role)

```json
{
  "docUrls": ["https://example.com/license.pdf"],
  "companyName": "Salt Distribution Co.",
  "registrationNumber": "DIST-2024-001",
  "address": "789 Trade St, Galle"
}
```

### Step 3.4: Verify Onboarding

**Endpoint:** `GET /api/v1/auth/personal-details` (under **Auth** tag, requires JWT)

**Expected Response (LANDOWNER example):**

```json
{
  "user": {
    "id": "...",
    "email": "yourname@gmail.com",
    "role": "LANDOWNER",
    "isOnboarded": true,
    "plan": "pro",
    "isSubscribed": false,
    "isVerified": false
  },
  "landOwnerDetails": {
    "id": "...",
    "userId": "...",
    "docUrls": ["https://example.com/doc1.pdf"],
    "totalBeds": 5,
    "nic": "123456789V",
    "address": "123 Salt Rd, Puttalam"
  }
}
```

### Step 3.5: Update Personal Details (optional)

**Endpoint:** `PUT /api/v1/user/personal-details` (under **User** tag, requires JWT)

```json
{
  "totalBeds": 10,
  "address": "456 Updated Rd, Puttalam"
}
```

---

## Flow 4: Purchase Pro Plan via PayHere - NEED TO BE TESTED

This flow tests the full payment cycle: checkout -> PayHere form -> webhook notification.

### Prerequisites for Payment Testing

1. **ngrok** must be tunneling to port 3400:
   ```bash
   ngrok http 3400 --domain your-domain.ngrok-free.dev
   ```
2. `PAYHERE_NOTIFY_URL` in `.env` must point to the ngrok URL:
   ```
   PAYHERE_NOTIFY_URL=https://your-domain.ngrok-free.dev/api/v1/payments/notify
   ```
3. PayHere sandbox account configured with the merchant ID and secret

### Step 4.1: Initiate Checkout

**Endpoint:** `POST /api/v1/payments/checkout` (under **Payments** tag, requires JWT)

```json
{
  "planKey": "pro",
  "billingCycle": "monthly"
}
```

**Expected Response:**

```json
{
  "success": true,
  "merchant_id": "1228391",
  "order_id": "ORD-1708123456789",
  "hash": "A1B2C3D4...",
  "amount": 1500,
  "currency": "LKR",
  "notify_url": "https://your-domain.ngrok-free.dev/api/v1/payments/notify",
  "return_url": "...",
  "cancel_url": "..."
}
```

Save the `order_id` - you'll need it if simulating the notification manually.

### Step 4.2: Complete Payment (PayHere Sandbox)

In a real flow, the frontend uses the checkout response payload to render the PayHere payment form. The user completes payment on PayHere's page.

**For sandbox testing:** Use the PayHere sandbox checkout page with the returned payload (merchant_id, order_id, hash, amount, currency). PayHere will automatically send a notification to your `notify_url`.

### Step 4.3: Payment Notification (automatic via PayHere)

**Endpoint:** `POST /api/v1/payments/notify` (under **Payments** tag, public - no JWT needed)

PayHere POSTs to this endpoint automatically after payment. The request body contains:

```json
{
  "merchant_id": "1228391",
  "order_id": "ORD-1708123456789",
  "payment_id": "320025071234",
  "payhere_amount": "1500.00",
  "payhere_currency": "LKR",
  "status_code": "2",
  "md5sig": "..."
}
```

Status codes: `2` = success, `0` = pending, `-1` = canceled, `-2` = failed, `-3` = chargeback.

> **Manual simulation will fail** because `md5sig` must be computed as:
>
> ```
> md5sig = MD5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + MD5(merchant_secret))
> ```
>
> Use the PayHere sandbox for correct signatures.

**Expected Response (on success):**

```json
{
  "success": true,
  "message": "Payment status updated to success"
}
```

### Step 4.4: Verify Subscription After Payment

**Endpoint:** `GET /api/v1/auth/personal-details` (under **Auth** tag, requires JWT)

After successful payment:

```json
{
  "user": {
    "plan": "pro",
    "isSubscribed": true,
    "isVerified": false
  }
}
```

The trial is deactivated and replaced with a paid pro subscription.

### Step 4.5: View Payment History

**Endpoint:** `GET /api/v1/payments` (under **Payments** tag, requires JWT)

**Expected Response:**

```json
{
  "payments": [
    {
      "id": "...",
      "orderId": "ORD-1708123456789",
      "amount": 1500,
      "currency": "LKR",
      "status": "success",
      "planKey": "pro",
      "billingCycle": "monthly"
    }
  ]
}
```

---

## Quick Reference: All Endpoints

| #   | Method | Endpoint                              | Auth              | Tag      | Purpose                      |
| --- | ------ | ------------------------------------- | ----------------- | -------- | ---------------------------- |
| 1   | POST   | `/api/v1/auth/sign-in`                | No                | Auth     | Send OTP (email or phone)    |
| 2   | POST   | `/api/v1/auth/verify-otp`             | No                | Auth     | Verify OTP, get JWT          |
| 3   | POST   | `/api/v1/auth/onboarding/landowner`   | JWT (LANDOWNER)   | Auth     | Onboard landowner            |
| 4   | POST   | `/api/v1/auth/onboarding/laboratory`  | JWT (LABORATORY)  | Auth     | Onboard laboratory           |
| 5   | POST   | `/api/v1/auth/onboarding/distributor` | JWT (DISTRIBUTOR) | Auth     | Onboard distributor          |
| 6   | GET    | `/api/v1/auth/personal-details`       | JWT               | Auth     | Get user + role details      |
| 7   | PUT    | `/api/v1/user/personal-details`       | JWT               | User     | Update role-specific details |
| 8   | POST   | `/api/v1/payments/checkout`           | JWT               | Payments | Initiate PayHere checkout    |
| 9   | POST   | `/api/v1/payments/notify`             | No                | Payments | PayHere webhook callback     |
| 10  | GET    | `/api/v1/payments`                    | JWT               | Payments | Get payment history          |
| 11  | GET    | `/api/v1/payments/:id`                | JWT               | Payments | Get single payment           |

---

## Troubleshooting

### OTP not received via email

- Ensure `email-service` is running: `npx nx serve email-service`
- Check `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` in `.env`
- OTP is always printed in auth-service terminal logs as fallback

### OTP not received via SMS

- Check `NOTIFY_LK_USER_ID`, `NOTIFY_LK_API_KEY`, `NOTIFY_LK_SENDER_ID` in `.env`
- Sender ID must be approved on your Notify.lk account
- Phone format is auto-converted: `07XXXXXXXX` -> `947XXXXXXXX`
- OTP is always printed in auth-service terminal logs as fallback

### Proto file errors after hot-reload

```bash
cp proto/*.proto dist/apps/api-gateway/proto/
cp proto/*.proto dist/apps/payment-service/proto/
```

### JWT shows `plan: "pro"` but personal-details shows `plan: "free"`

- Stop all Docker containers: `docker-compose down`
- Run all services locally with `npx nx serve <service>`
- Delete the stale test user from MongoDB Atlas (`users`, `subscriptions`, `landownerdetails` collections)
- Create a fresh test user

### Payment checkout fails

- Ensure `payment-service` is running
- Check `PAYHERE_MERCHANT_ID` and `PAYHERE_MERCHANT_SECRET` in `.env`
- Ensure a `pro` plan exists in the `plans` collection (seeded by auth-service on startup)

### PayHere notification fails with "Invalid notification hash"

- This is expected when simulating manually - the `md5sig` must be correctly computed
- Use the PayHere sandbox for real testing - it sends correct signatures automatically
- Ensure ngrok is tunneling: `ngrok http 3400 --domain your-domain.ngrok-free.dev`

### `npx nx serve <service>` webpack error

- Run `npx nx reset` to clear Nx cache and restart daemon
- Then retry `npx nx serve <service>`

docker-compose up -d --build
