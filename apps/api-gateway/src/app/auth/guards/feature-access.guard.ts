import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Logger,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClientGrpcProxy } from '@nestjs/microservices';
import { firstValueFrom, catchError } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { FEATURE_KEY } from '../decorators/feature.decorator';
import { FEATURE_ENDPOINT_MAP } from '../config/feature-endpoint-map.config';
import { FEATURE_ENTITLEMENTS } from '../config/feature-entitlements.config';
import { Request } from 'express';

@Injectable()
export class FeatureAccessGuard implements CanActivate {
  private authService: any;
  private readonly logger = new Logger(FeatureAccessGuard.name);

  constructor(
    private reflector: Reflector,
    @Optional() @Inject('AUTH_PACKAGE') private authClient: ClientGrpcProxy,
  ) {
    if (this.authClient) {
      this.authService = this.authClient.getService('AuthService');
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Skip public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    if (!user) {
      return true; // JwtAuthGuard handles auth; if no user, let it pass (shouldn't happen)
    }

    // 2. Skip ADMIN/SUPERADMIN — always allowed
    if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') {
      return true;
    }

    // 3. Get feature from @RequireFeature decorator
    let featureKey = this.reflector.getAllAndOverride<string>(FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 4. Fall back to path-based auto-detection
    if (!featureKey) {
      const path = request.path;
      const match = FEATURE_ENDPOINT_MAP.find((m) => m.pattern.test(path));
      if (match) {
        featureKey = match.featureKey;
      }
    }

    // 5. No feature requirement → allow
    if (!featureKey) {
      return true;
    }

    // 6. Fast path: local JWT check
    const entitlement = FEATURE_ENTITLEMENTS.find((e) => e.key === featureKey);
    if (entitlement) {
      // Check role
      if (!entitlement.allowedRoles.includes(user.role)) {
        throw new ForbiddenException({
          reason: 'role_not_allowed',
          message: `Your role (${user.role}) does not have access to this feature`,
          requiredRoles: entitlement.allowedRoles,
        });
      }

      // Check plan
      if (user.plan && entitlement.plans.includes(user.plan)) {
        // If on a trial, use gRPC fallback to verify trial is still active
        if (user.isTrialActive) {
          return this.grpcFallback(user.userId, featureKey, user.role, entitlement.plans);
        }
        return true;
      }

      // Plan not in allowed list — deny
      if (user.plan && !entitlement.plans.includes(user.plan)) {
        throw new ForbiddenException({
          reason: 'plan_required',
          message: `Your plan (${user.plan}) does not include this feature`,
          requiredPlans: entitlement.plans,
        });
      }
    }

    // 7. Fallback: gRPC CheckFeatureAccess (authoritative)
    return this.grpcFallback(user.userId, featureKey, user.role, entitlement?.plans);
  }

  private async grpcFallback(
    userId: string,
    featureKey: string,
    userRole: string,
    requiredPlans?: string[],
  ): Promise<boolean> {
    if (!this.authService) {
      this.logger.warn('AUTH_PACKAGE not available for gRPC fallback, allowing request');
      return true;
    }

    try {
      const result = await firstValueFrom(
        this.authService.CheckFeatureAccess({ userId, featureKey, userRole }).pipe(
          catchError((error: any) => {
            this.logger.error(`gRPC CheckFeatureAccess error: ${error.message}`);
            throw new ForbiddenException('Unable to verify feature access');
          }),
        ),
      ) as { allowed: boolean; reason?: string; requiredPlans?: string[] };

      if (!result.allowed) {
        throw new ForbiddenException({
          reason: result.reason || 'access_denied',
          message: `Access denied to feature: ${featureKey}`,
          requiredPlans: result.requiredPlans || requiredPlans || [],
        });
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(`Unexpected error in feature access check: ${error}`);
      throw new ForbiddenException('Unable to verify feature access');
    }
  }
}
