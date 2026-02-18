export interface FeatureEndpointMapping {
  pattern: RegExp;
  featureKey: string;
}

export const FEATURE_ENDPOINT_MAP: FeatureEndpointMapping[] = [
  {
    pattern: /^\/api\/v1\/crystallization\/daily-measurements/,
    featureKey: 'salinity',
  },
  {
    pattern: /^\/api\/v1\/crystallization\/predictions/,
    featureKey: 'production_forecast',
  },
  {
    pattern: /^\/api\/v1\/vision/,
    featureKey: 'quality_vision_control',
  },
  {
    pattern: /^\/api\/v1\/salt-production/,
    featureKey: 'production_forecast',
  },
];
