import { SetMetadata } from '@nestjs/common';

export const PLAN_LEVELS_KEY = 'requiredPlanLevels';
export const RequirePlan = (...levels: number[]) =>
  SetMetadata(PLAN_LEVELS_KEY, levels);
