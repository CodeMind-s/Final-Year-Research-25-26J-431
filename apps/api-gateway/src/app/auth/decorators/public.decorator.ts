import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const SUBSCRIPTION_CHECK_KEY = 'subscriptionCheck';
export const SubscriptionCheck = (requiredLevel: number) =>
  SetMetadata(SUBSCRIPTION_CHECK_KEY, requiredLevel);