export interface FeatureFlags {
  readonly exports: boolean;
  readonly websocket: boolean;
  readonly adminManagement: boolean;
}

function parseFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() !== "false" && value !== "0";
}

const features: FeatureFlags = Object.freeze({
  exports: parseFlag(process.env.FEATURE_EXPORTS, true),
  websocket: parseFlag(process.env.FEATURE_WEBSOCKET, true),
  adminManagement: parseFlag(process.env.FEATURE_ADMIN_MANAGEMENT, true),
});

let _testOverrides: Partial<FeatureFlags> | null = null;

export function _overrideFeaturesForTest(overrides: Partial<FeatureFlags> | null): void {
  _testOverrides = overrides;
}

export function getFeatures(): FeatureFlags {
  if (_testOverrides) return { ...features, ..._testOverrides };
  return features;
}
