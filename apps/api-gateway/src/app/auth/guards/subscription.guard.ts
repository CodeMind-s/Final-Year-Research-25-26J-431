import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SUBSCRIPTION_CHECK_KEY } from '../decorators/public.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  private readonly logger = new Logger(SubscriptionGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip subscription checking for public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (isPublic) {
      return true;
    }

    const requiredLevel = this.reflector.getAllAndOverride<number>(SUBSCRIPTION_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    this.logger.debug(`Required subscription level: ${requiredLevel}`);
    
    // If no subscription level is required, allow access
    if (requiredLevel === undefined || requiredLevel === null) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    this.logger.debug(`User from request: ${JSON.stringify(user)}`);

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    // Get user's subscription level (default to 0 if not set)
    const userSubscriptionLevel = user.subscriptionLevel ?? 0;
    
    this.logger.debug(`User subscription level: ${userSubscriptionLevel}, Required level: ${requiredLevel}`);
    
    // Check if user's subscription level meets the requirement
    if (userSubscriptionLevel < requiredLevel) {
      throw new ForbiddenException(`Subscription level ${requiredLevel} or higher required. Your current level is ${userSubscriptionLevel}.`);
    }

    return true;
  }
}
