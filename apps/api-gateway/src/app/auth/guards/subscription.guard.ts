import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Inject } from '@nestjs/common';
import { ClientGrpcProxy } from '@nestjs/microservices';
import { Reflector } from '@nestjs/core';
import { firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { REQUIRED_LEVEL_KEY } from '../decorators/public.decorator';
import { Request } from 'express';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  private authService: any;

  constructor(
    @Inject('AUTH_PACKAGE') private authClient: ClientGrpcProxy,
    private reflector: Reflector,
  ) {
    this.authService = this.authClient.getService('AuthService');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredLevel = this.reflector.getAllAndOverride<number>(REQUIRED_LEVEL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) || 0;

    const request = context.switchToHttp().getRequest<Request>();
    if (!request.user) {
      throw new ForbiddenException('Authentication required');
    }

    const { userId } = request.user;
    try {
      // Fetch subscription
      const subResult = await firstValueFrom(
        this.authService.GetSubscription({ userId }).pipe(
          catchError((error) => {
            console.error('Error fetching subscription:', error);
            throw new ForbiddenException('Failed to fetch subscription' , error.message);
          })
        )
      ) as { subscription: any };

      console.log('Subscription fetched:', subResult);
      if (!subResult || !subResult.subscription) {
        throw new ForbiddenException('No subscription found');
      }
      const subscription = subResult.subscription;
      // if (!subscription || subscription.status !== 'active') {
      //   throw new ForbiddenException('Active subscription required');
      // }

      // Fetch plan level
      const planResult = await firstValueFrom(
        this.authService.GetPlan({ planId: subscription.planId }).pipe(
          catchError((error) => {
            throw new ForbiddenException('Failed to fetch plan details');
          })
        )
      ) as { plan: { level: number } };

      if (planResult.plan.level < requiredLevel) {
        throw new ForbiddenException(`Plan level ${requiredLevel} or higher required`);
      }

      // Attach to request
      request['subscription'] = subscription;
      return true;
    } catch (error) {
      throw error;
    }
  }
}