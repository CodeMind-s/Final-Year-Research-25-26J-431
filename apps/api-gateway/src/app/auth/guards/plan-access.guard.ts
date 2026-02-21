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
import { PLAN_LEVELS_KEY } from '../decorators/plan.decorator';
import { Request } from 'express';

@Injectable()
export class PlanAccessGuard implements CanActivate {
  private authService: any;
  private readonly logger = new Logger(PlanAccessGuard.name);

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
      return true; // JwtAuthGuard handles auth
    }

    // 2. Skip ADMIN/SUPERADMIN — always allowed
    if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') {
      return true;
    }

    // 3. Get required plan levels from @RequirePlan decorator
    const requiredLevels = this.reflector.getAllAndOverride<number[]>(
      PLAN_LEVELS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 4. No plan requirement → allow
    if (!requiredLevels || requiredLevels.length === 0) {
      return true;
    }

    // 5. Fast path: check planIndex from JWT
    const userPlanIndex: number = user.planIndex ?? 0;

    if (requiredLevels.includes(userPlanIndex)) {
      // If on a trial, verify trial is still active via gRPC
      if (user.isTrialActive) {
        return this.grpcFallback(user.userId, requiredLevels);
      }
      return true;
    }

    // 6. Plan not in required levels — deny
    throw new ForbiddenException({
      reason: 'plan_required',
      message: `Your plan (level ${userPlanIndex}) does not have access to this feature`,
      requiredPlanLevels: requiredLevels,
    });
  }

  private async grpcFallback(
    userId: string,
    requiredLevels: number[],
  ): Promise<boolean> {
    if (!this.authService) {
      this.logger.warn(
        'AUTH_PACKAGE not available for gRPC fallback, allowing request',
      );
      return true;
    }

    try {
      const result = (await firstValueFrom(
        this.authService
          .CheckPlanAccess({ userId, requiredPlanLevels: requiredLevels })
          .pipe(
            catchError((error: any) => {
              this.logger.error(
                `gRPC CheckPlanAccess error: ${error.message}`,
              );
              throw new ForbiddenException('Unable to verify plan access');
            }),
          ),
      )) as { allowed: boolean; reason?: string; requiredPlanLevels?: number[] };

      if (!result.allowed) {
        throw new ForbiddenException({
          reason: result.reason || 'access_denied',
          message: 'Access denied: plan upgrade required',
          requiredPlanLevels: result.requiredPlanLevels || requiredLevels,
        });
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(`Unexpected error in plan access check: ${error}`);
      throw new ForbiddenException('Unable to verify plan access');
    }
  }
}
