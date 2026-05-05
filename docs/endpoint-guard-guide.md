# Endpoint Guard Guide

How authentication, role, and subscription-plan guards protect API Gateway endpoints, and how to apply them when creating new endpoints.

---

## Guard Pipeline

Three global guards run **in order** on every request (registered in `apps/api-gateway/src/app/auth/auth.module.ts`):

```
Request
  |
  v
JwtAuthGuard        -- Extracts & verifies the Bearer JWT; populates req.user
  |
  v
RolesGuard          -- Checks req.user.role against @Roles() decorator
  |
  v
PlanAccessGuard     -- Checks req.user.planIndex against @RequirePlan() decorator
  |
  v
Controller handler
```

All three guards skip their checks when `@Public()` is present — public endpoints bypass the entire pipeline.

### `req.user` shape (set by JwtAuthGuard)

```ts
request.user = {
  userId: string;       // JWT `sub`
  email: string;
  role: string;         // e.g. 'LANDOWNER'
  plan: string;         // e.g. 'free', 'pro', 'lab'
  planIndex: number;    // 0 = Free, 1 = Pro, 2 = Lab
  isTrialActive: boolean;
};
```

Source: `apps/api-gateway/src/app/auth/guards/jwt-auth.guard.ts`

---

## Making an Endpoint Public

Use the `@Public()` decorator on a controller method (or the entire controller class) to skip all guard checks.

```ts
import { Public } from '../auth/decorators/public.decorator';

@Public()
@Get('health')
health() {
  return { status: 'ok' };
}
```

Source: `apps/api-gateway/src/app/auth/decorators/public.decorator.ts`

**When to use:** Health checks, login/register, OTP verification, or any endpoint that unauthenticated users must reach.

---

## Restricting by Role

Use the `@Roles()` decorator to limit access to users with specific roles. If no `@Roles()` is present, any authenticated user (any role) is allowed through.

```ts
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/decorators/role.enum';

@Roles(Role.LANDOWNER)
@Post('daily-measurements')
createMeasurement(@Body() dto: CreateMeasurementDto) { ... }
```

### Available roles

Defined in `apps/api-gateway/src/app/auth/decorators/role.enum.ts`:

| Role               | Value           |
| ------------------ | --------------- |
| `Role.SUPERADMIN`  | `'SUPERADMIN'`  |
| `Role.ADMIN`       | `'ADMIN'`       |
| `Role.DISTRIBUTOR` | `'DISTRIBUTOR'` |
| `Role.LANDOWNER`   | `'LANDOWNER'`   |
| `Role.SALTSOCIETY` | `'SALTSOCIETY'` |
| `Role.LABORATORY`  | `'LABORATORY'`  |

Multiple roles can be passed: `@Roles(Role.LANDOWNER, Role.DISTRIBUTOR)`.

**Note:** `ADMIN` and `SUPERADMIN` always bypass the `PlanAccessGuard` (plan check), but they still need to pass `RolesGuard`. If you want admin-only, use `@Roles(Role.ADMIN, Role.SUPERADMIN)`.

Source: `apps/api-gateway/src/app/auth/guards/roles.guard.ts`

---

## Restricting by Subscription Plan

Use the `@RequirePlan(index, ...)` decorator to gate an endpoint behind one or more plan levels.

```ts
import { RequirePlan } from '../auth/decorators/plan.decorator';

@RequirePlan(1)
@Get('predictions')
getPredictions() { ... }
```

### Plan levels

| Level | Plan Key | Plan Name |
|-------|----------|-----------|
| 0     | `free`   | Free Plan |
| 1     | `pro`    | Pro Plan  |
| 2     | `lab`    | Lab Plan  |

The `PlanAccessGuard` reads the `@RequirePlan()` metadata, then checks:

1. **Plan level** — is `req.user.planIndex` in the required levels array? If not, 403 with `reason: 'plan_required'`.
2. **Trial** — if `isTrialActive` is true, the guard makes a gRPC call to auth-service (`CheckPlanAccess`) to verify the trial is still valid.

Source: `apps/api-gateway/src/app/auth/guards/plan-access.guard.ts`

---

## Quick Reference Examples

### Public endpoint (no auth required)

```ts
@Public()
@Get('health')
health() {
  return { status: 'ok' };
}
```

### Authenticated, any role, no plan check

```ts
@Get('profile')
getProfile(@Req() req) {
  return req.user;
}
```

No decorators needed beyond authentication (which is global).

### Admin only

```ts
@Roles(Role.ADMIN, Role.SUPERADMIN)
@Get('users')
listAllUsers() { ... }
```

### Pro plan + SALTSOCIETY only

```ts
@Roles(Role.SALTSOCIETY)
@RequirePlan(1)
@Get('predictions')
getPredictions() { ... }
```

Both checks apply: `RolesGuard` verifies SALTSOCIETY, then `PlanAccessGuard` verifies planIndex is 1 (Pro).

### Free + Pro plans (multiple levels)

```ts
@Roles(Role.SALTSOCIETY)
@RequirePlan(0, 1)
@Post('daily-measurement')
createMeasurement() { ... }
```

Users with Free (0) or Pro (1) plans can access this endpoint.

### Lab plan + LABORATORY only

```ts
@Roles(Role.LABORATORY)
@RequirePlan(2)
@Get('detections')
getDetections() { ... }
```

### Class-level decorator (applies to all methods)

```ts
@Roles(Role.LABORATORY)
@RequirePlan(2)
@Controller('api/v1/batches')
export class BatchController {
  @Get()
  list() { ... }

  @Post()
  create() { ... }

  @Public()   // overrides class-level guards for this method only
  @Get('public-stats')
  publicStats() { ... }
}
```

---

## When to Use @RequirePlan

You don't need `@RequirePlan()` for every endpoint. Here's when you do and don't:

### You need @RequirePlan when:

- The endpoint should be restricted by subscription plan (Free vs Pro vs Lab)

### You don't need it when:

- The endpoint just needs authentication (global `JwtAuthGuard` handles that automatically)
- You only need role restriction — use `@Roles()` alone
- The endpoint is public — use `@Public()`

**Example:** An endpoint for authenticated LANDOWNERs regardless of plan only needs:

```ts
@Roles(Role.LANDOWNER)
@Get('dashboard')
getDashboard() { ... }
```

No `@RequirePlan()` required. The `PlanAccessGuard` will see no plan requirement and allow the request through.

**`@RequirePlan()` is purely for plan-based gating.**

---

## Summary

| Goal | Decorator(s) |
|------|-------------|
| No auth required | `@Public()` |
| Any authenticated user | *(none — global JwtAuthGuard handles it)* |
| Specific role(s) | `@Roles(Role.X, ...)` |
| Specific plan level(s) | `@RequirePlan(0, 1)` |
| Role + plan | `@Roles(Role.X)` + `@RequirePlan(1)` |
| Admin bypass | ADMIN/SUPERADMIN skip PlanAccessGuard automatically |
