// Share-link access control as the extension offers it: a few expiry presets,
// a view cap and burn-after-read. Reach accepts more (unique-visitor caps, an
// exact expiry); those stay in the admin UI, where any link can be edited.

export type ExpiryPreset = 'never' | '1d' | '7d' | '30d';

export interface ShareOptions {
  expiry: ExpiryPreset;
  maxViews: number | null;
  burnAfterRead: boolean;
}

export const EXPIRY_PRESETS: Array<{ value: ExpiryPreset; label: string; days: number | null }> = [
  { value: 'never', label: '不限', days: null },
  { value: '1d', label: '1 天', days: 1 },
  { value: '7d', label: '7 天', days: 7 },
  { value: '30d', label: '30 天', days: 30 },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** The request's accessControl, with the expiry counted from `now`. */
export function toAccessControl(options: ShareOptions, now = Date.now()) {
  const days = EXPIRY_PRESETS.find((preset) => preset.value === options.expiry)?.days ?? null;
  return {
    expiresAt: days ? new Date(now + days * DAY_MS).toISOString() : null,
    maxViews: options.maxViews,
    burnAfterRead: options.burnAfterRead,
  };
}

export type AccessControl = ReturnType<typeof toAccessControl>;
