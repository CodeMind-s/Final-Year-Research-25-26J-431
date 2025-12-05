import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const REQUIRED_LEVEL_KEY = 'requiredLevel';
export const SubscriptionCheck = (level: number = 0) => SetMetadata(REQUIRED_LEVEL_KEY, level);