// What the extension lets you set on a share: a few expiry presets, a view cap
// and burn-after-read on the link, plus the mirror's access password. Reach
// accepts more (unique-visitor caps, an exact expiry); those stay in the admin
// UI, where any link can be edited.

export type ExpiryPreset = 'never' | '1d' | '7d' | '30d';

/**
 * The password belongs to the mirror, so it applies to every link of that
 * post. 'keep' sends nothing: a new mirror stays open, an existing one keeps
 * whatever password it already has.
 */
export type PasswordChoice = 'keep' | 'inherit' | 'custom';

export interface ShareOptions {
  expiry: ExpiryPreset;
  maxViews: number | null;
  burnAfterRead: boolean;
  passwordMode: PasswordChoice;
  /** Only used with passwordMode 'custom'. */
  password: string;
}

export const DEFAULT_SHARE_OPTIONS: ShareOptions = {
  expiry: 'never',
  maxViews: null,
  burnAfterRead: false,
  passwordMode: 'keep',
  password: '',
};

export const EXPIRY_PRESETS: Array<{ value: ExpiryPreset; label: string; days: number | null }> = [
  { value: 'never', label: '不限', days: null },
  { value: '1d', label: '1 天', days: 1 },
  { value: '7d', label: '7 天', days: 7 },
  { value: '30d', label: '30 天', days: 30 },
];

export const PASSWORD_CHOICES: Array<{ value: PasswordChoice; label: string; title: string }> = [
  { value: 'keep', label: '不设置', title: '新镜像不加密；已有镜像保持原来的密码' },
  { value: 'inherit', label: '系统密码', title: '使用 Reach「系统设置」里的统一密码' },
  { value: 'custom', label: '单独密码', title: '为这条帖子的镜像单独设置密码' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** A custom password has to be filled in before the share can go. */
export function canShareWith(options: ShareOptions): boolean {
  return options.passwordMode !== 'custom' || options.password.trim().length > 0;
}

/** The request's accessControl and password, with the expiry counted from `now`. */
export function toShareRequest(options: ShareOptions, now = Date.now()) {
  const days = EXPIRY_PRESETS.find((preset) => preset.value === options.expiry)?.days ?? null;
  return {
    accessControl: {
      expiresAt: days ? new Date(now + days * DAY_MS).toISOString() : null,
      maxViews: options.maxViews,
      burnAfterRead: options.burnAfterRead,
    },
    password:
      options.passwordMode === 'custom'
        ? { mode: 'custom' as const, value: options.password.trim() }
        : options.passwordMode === 'inherit'
          ? { mode: 'inherit' as const }
          : undefined,
  };
}

export type ShareRequestOptions = ReturnType<typeof toShareRequest>;
