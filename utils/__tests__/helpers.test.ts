import { describe, expect, it } from 'vitest';

import { toAccessControl } from '../access';
import { isPostUrl, stageLabel } from '../jobs';
import { describeBrowser, normalizeBaseUrl } from '../settings';

describe('toAccessControl', () => {
  const now = Date.UTC(2026, 8, 15, 12, 0, 0);

  it('leaves expiry open for "never"', () => {
    expect(toAccessControl({ expiry: 'never', maxViews: null, burnAfterRead: false }, now)).toEqual({
      expiresAt: null,
      maxViews: null,
      burnAfterRead: false,
    });
  });

  it('counts preset days from now and passes the caps through', () => {
    expect(toAccessControl({ expiry: '7d', maxViews: 3, burnAfterRead: true }, now)).toEqual({
      expiresAt: '2026-09-22T12:00:00.000Z',
      maxViews: 3,
      burnAfterRead: true,
    });
  });
});

describe('isPostUrl', () => {
  it.each([
    'https://x.com/jack/status/20',
    'https://twitter.com/jack/status/20?s=20',
    'https://mobile.twitter.com/jack/status/20/photo/1',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
  ])('recognises %s', (url) => {
    expect(isPostUrl(url)).toBe(true);
  });

  it.each([
    'https://x.com/home',
    'https://x.com/jack',
    'https://www.youtube.com/',
    'https://www.youtube.com/@channel',
    'https://example.com/jack/status/20',
    'chrome://extensions',
    '',
    undefined,
  ])('ignores %s', (url) => {
    expect(isPostUrl(url)).toBe(false);
  });
});

describe('normalizeBaseUrl', () => {
  it.each([
    ['https://reach.example.com', 'https://reach.example.com'],
    ['reach.example.com', 'https://reach.example.com'],
    ['https://reach.example.com/', 'https://reach.example.com'],
    ['https://reach.example.com/admin/extension', 'https://reach.example.com'],
    [' http://127.0.0.1:3000 ', 'http://127.0.0.1:3000'],
  ])('%s → %s', (input, origin) => {
    expect(normalizeBaseUrl(input)).toBe(origin);
  });

  it('rejects what cannot be an address', () => {
    expect(normalizeBaseUrl('')).toBeNull();
    expect(normalizeBaseUrl('http://')).toBeNull();
  });
});

describe('describeBrowser', () => {
  it.each([
    ['Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36', 'Chrome · Linux'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0', 'Edge · Windows'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:154.0) Gecko/20100101 Firefox/154.0', 'Firefox · macOS'],
  ])('%s', (ua, name) => {
    expect(describeBrowser(ua)).toBe(name);
  });
});

describe('stageLabel', () => {
  it('counts the image being transferred, one-based', () => {
    expect(stageLabel({ phase: 'images', done: 0, total: 3 })).toBe('转存图片 1/3…');
    expect(stageLabel(null)).toBe('连接 Reach…');
  });
});
