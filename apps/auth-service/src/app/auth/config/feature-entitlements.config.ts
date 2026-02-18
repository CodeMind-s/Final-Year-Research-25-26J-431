export interface FeatureEntitlement {
  key: string;
  plans: string[];
  allowedRoles: string[];
}

export const FEATURE_ENTITLEMENTS: FeatureEntitlement[] = [
  {
    key: 'weather_data',
    plans: ['free', 'pro'],
    allowedRoles: ['LANDOWNER', 'SALTSOCIETY', 'DISTRIBUTOR'],
  },
  {
    key: 'salinity',
    plans: ['free', 'pro'],
    allowedRoles: ['LANDOWNER', 'SALTSOCIETY'],
  },
  {
    key: 'deals',
    plans: ['pro'],
    allowedRoles: ['LANDOWNER', 'DISTRIBUTOR'],
  },
  {
    key: 'planner',
    plans: ['pro'],
    allowedRoles: ['LANDOWNER'],
  },
  {
    key: 'production_forecast',
    plans: ['pro'],
    allowedRoles: ['LANDOWNER', 'DISTRIBUTOR'],
  },
  {
    key: 'demand_price_forecast',
    plans: ['pro'],
    allowedRoles: ['LANDOWNER'],
  },
  {
    key: 'distributor_recommendation',
    plans: ['pro'],
    allowedRoles: ['DISTRIBUTOR'],
  },
  {
    key: 'waste_valorant',
    plans: ['pro'],
    allowedRoles: ['SALTSOCIETY'],
  },
  {
    key: 'quality_vision_control',
    plans: ['lab'],
    allowedRoles: ['LABORATORY'],
  },
  {
    key: 'salt_crystal_impurity_checker',
    plans: ['lab'],
    allowedRoles: ['LABORATORY'],
  },
  {
    key: 'realtime_statistics',
    plans: ['lab'],
    allowedRoles: ['LABORATORY'],
  },
  {
    key: 'batch_identification',
    plans: ['lab'],
    allowedRoles: ['LABORATORY'],
  },
];
