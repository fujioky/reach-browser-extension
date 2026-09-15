// Share history. The background runs every share and records it here; the
// popup renders whatever is there. A share takes seconds to minutes and the
// popup closes the moment it loses focus, so it can never own the work itself.
//
// Kept in `local` so the history — and the link for a post shared yesterday —
// survives a browser restart.

import { MatchPattern, storage } from '#imports';

import type { ShareOptions } from './access';
import type { ShareResult, ShareStage } from './api';

interface JobBase {
  id: string;
  url: string;
  options: ShareOptions;
  startedAt: number;
}

export type Job =
  | (JobBase & { status: 'running'; stage: ShareStage | null })
  | (JobBase & { status: 'done'; result: ShareResult; copied: boolean })
  | (JobBase & { status: 'error'; error: string });

/** Newest first. */
export const historyItem = storage.defineItem<Job[]>('local:shareHistory', { fallback: [] });

export const MAX_HISTORY = 50;

export type BackgroundMessage =
  | { type: 'share'; id: string; url: string; options: ShareOptions }
  | { type: 'forget'; ids: string[] };

/** Pages Reach can mirror — also the right-click menu's URL filter. */
export const POST_URL_PATTERNS = [
  '*://x.com/*/status/*',
  '*://twitter.com/*/status/*',
  '*://mobile.twitter.com/*/status/*',
  '*://*.youtube.com/watch*',
  '*://*.youtube.com/shorts/*',
  '*://*.youtube.com/live/*',
  '*://youtu.be/*',
];

const postMatchers = POST_URL_PATTERNS.map((pattern) => new MatchPattern(pattern));

export function isPostUrl(url: string | undefined): url is string {
  if (!url) return false;
  try {
    return postMatchers.some((matcher) => matcher.includes(url));
  } catch {
    return false;
  }
}

/**
 * Which post a link points at, so history finds a share whatever form the link
 * took — twitter.com or x.com, a ?s=20 tail, a /photo/1 suffix, youtu.be or a
 * watch URL. Anything unrecognised is keyed by the URL itself.
 */
export function postKey(url: string): string {
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed;
  }
  const host = parsed.hostname.replace(/^(www|mobile|m)\./, '');

  if (host === 'x.com' || host === 'twitter.com') {
    const status = parsed.pathname.match(/\/status(?:es)?\/(\d+)/)?.[1];
    if (status) return `x:${status}`;
  }
  const videoId =
    host === 'youtu.be'
      ? parsed.pathname.split('/')[1]
      : host === 'youtube.com'
        ? parsed.pathname === '/watch'
          ? parsed.searchParams.get('v')
          : parsed.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/)?.[1]
        : null;
  if (videoId) return `youtube:${videoId}`;

  return `${parsed.origin}${parsed.pathname}${parsed.search}`;
}

export function stageLabel(stage: ShareStage | null): string {
  if (!stage) return '连接 Reach…';
  switch (stage.phase) {
    case 'fetching':
      return '抓取帖子内容…';
    case 'images':
      return `转存图片 ${stage.done + 1}/${stage.total}…`;
    case 'saving':
      return '生成分享链接…';
  }
}
