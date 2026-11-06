// What the user sets up on the options page. Kept in `local`, not `sync`: the
// token belongs to this browser's sign-in and should not follow the account
// to other machines.

import { storage } from '#imports';

import { DEFAULT_SHARE_OPTIONS, type ShareOptions } from './access';

export interface Connection {
  /** Origin of the Reach site, e.g. https://reach.example.com */
  baseUrl: string;
  token: string;
  username: string;
}

export const connectionItem = storage.defineItem<Connection | null>('local:connection', {
  fallback: null,
});

/** The address last signed in to, kept through sign-out to prefill the form. */
export const lastBaseUrlItem = storage.defineItem<string>('local:lastBaseUrl', { fallback: '' });

/** Used for right-click shares and as the popup's starting values. */
export const defaultOptionsItem = storage.defineItem<ShareOptions>('local:shareDefaults', {
  fallback: DEFAULT_SHARE_OPTIONS,
});

/** Accepts what people paste — a bare host, a trailing slash, an admin page URL. */
export function normalizeBaseUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/[\u0000-\u001f\u007f\\]/.test(trimmed)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.hostname = url.hostname.replace(/\.$/, '');
    return url.origin;
  } catch {
    return null;
  }
}

/** Compare parsed host labels, never substrings of an address. HTTP still selects
 * FUJIOKY so it can be rejected rather than accidentally showing password login. */
export function isFujiokyUrl(input: string): boolean {
  const origin = normalizeBaseUrl(input);
  if (!origin) return false;
  const hostname = new URL(origin).hostname;
  return hostname === 'fujioky.com' || hostname.endsWith('.fujioky.com');
}

/** How this sign-in is labelled in Reach's list of extensions, e.g. "Chrome · macOS". */
export function describeBrowser(userAgent = navigator.userAgent): string {
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Firefox\//.test(userAgent)
      ? 'Firefox'
      : /Chrome\//.test(userAgent)
        ? 'Chrome'
        : '浏览器';
  const os = /Windows/.test(userAgent)
    ? 'Windows'
    : /Mac OS X/.test(userAgent)
      ? 'macOS'
      : /CrOS/.test(userAgent)
        ? 'ChromeOS'
        : /Linux/.test(userAgent)
          ? 'Linux'
          : null;
  return os ? `${browser} · ${os}` : browser;
}
