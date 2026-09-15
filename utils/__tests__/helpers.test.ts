import { describe, expect, it } from 'vitest';

import { canShareWith, DEFAULT_SHARE_OPTIONS, toShareRequest } from '../access';
import { isPostUrl, postKey, stageLabel } from '../jobs';
import { describeBrowser, normalizeBaseUrl } from '../settings';

describe('toShareRequest', () => {
  const now = Date.UTC(2026, 8, 15, 12, 0, 0);

  it('leaves expiry open and sends no password by default', () => {
    expect(toShareRequest(DEFAULT_SHARE_OPTIONS, now)).toEqual({
      accessControl: { expiresAt: null, maxViews: null, burnAfterRead: false },
      password: undefined,
    });
  });

  it('counts preset days from now and passes the caps through', () => {
    expect(toShareRequest({ ...DEFAULT_SHARE_OPTIONS, expiry: '7d', maxViews: 3, burnAfterRead: true }, now).accessControl).toEqual({
      expiresAt: '2026-09-22T12:00:00.000Z',
      maxViews: 3,
      burnAfterRead: true,
    });
  });

  it('sends the site password choice, or the trimmed custom password', () => {
    expect(toShareRequest({ ...DEFAULT_SHARE_OPTIONS, passwordMode: 'inherit', password: 'ignored' }, now).password).toEqual({ mode: 'inherit' });
    expect(toShareRequest({ ...DEFAULT_SHARE_OPTIONS, passwordMode: 'custom', password: ' abc ' }, now).password).toEqual({
      mode: 'custom',
      value: 'abc',
    });
    // A password typed and then switched away from is not sent.
    expect(toShareRequest({ ...DEFAULT_SHARE_OPTIONS, passwordMode: 'keep', password: 'abc' }, now).password).toBeUndefined();
  });

  it('holds a custom-password share back until the password is filled in', () => {
    expect(canShareWith({ ...DEFAULT_SHARE_OPTIONS, passwordMode: 'custom', password: '  ' })).toBe(false);
    expect(canShareWith({ ...DEFAULT_SHARE_OPTIONS, passwordMode: 'custom', password: 'x' })).toBe(true);
    expect(canShareWith({ ...DEFAULT_SHARE_OPTIONS, passwordMode: 'inherit' })).toBe(true);
  });
});

describe('postKey', () => {
  it('gives every form of a post link the same key', () => {
    const tweet = [
      'https://x.com/jack/status/20',
      'https://twitter.com/jack/status/20?s=20',
      'https://mobile.twitter.com/jack/status/20/photo/1',
      'https://x.com/i/web/status/20',
    ].map(postKey);
    expect(new Set(tweet)).toEqual(new Set(['x:20']));

    const video = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
      'https://youtu.be/dQw4w9WgXcQ?si=abc',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    ].map(postKey);
    expect(new Set(video)).toEqual(new Set(['youtube:dQw4w9WgXcQ']));
  });

  it('keeps different posts apart and falls back to the URL', () => {
    expect(postKey('https://x.com/jack/status/21')).not.toBe(postKey('https://x.com/jack/status/20'));
    expect(postKey('https://example.com/a?b=1#c')).toBe('https://example.com/a?b=1');
    expect(postKey(' not a url ')).toBe('not a url');
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
