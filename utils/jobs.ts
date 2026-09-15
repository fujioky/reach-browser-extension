// Share jobs live in session storage: the background runs them, the popup
// renders whatever is there. A share takes seconds to minutes and the popup
// closes the moment it loses focus, so it can never own the work itself.

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

export const jobsItem = storage.defineItem<Job[]>('session:jobs', { fallback: [] });

/** How many recent jobs the popup keeps listing. */
export const MAX_JOBS = 8;

export interface ShareMessage {
  type: 'share';
  id: string;
  url: string;
  options: ShareOptions;
}

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
