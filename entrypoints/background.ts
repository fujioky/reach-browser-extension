// Runs every share. The popup and the right-click menu only hand a URL over;
// the work — a request that can take a minute — has to outlive the popup,
// which closes as soon as it loses focus.
//
// Job state goes to session storage, where the popup renders it. Nothing else
// in memory matters across a restart, so a job still marked running when the
// background starts again was cut off and is reported as such.

import { browser, defineBackground } from '#imports';

import { toAccessControl } from '@/utils/access';
import { createShareLink, SignedOutError } from '@/utils/api';
import { copyToClipboard } from '@/utils/clipboard';
import { jobsItem, MAX_JOBS, POST_URL_PATTERNS, type Job, type ShareMessage } from '@/utils/jobs';
import { connectionItem, defaultOptionsItem } from '@/utils/settings';

const MENU_LINK = 'share-link';
const MENU_PAGE = 'share-page';

export default defineBackground(() => {
  void updateJobs((jobs) =>
    jobs.map((job) =>
      job.status === 'running'
        ? { ...job, status: 'error', error: '扩展后台被浏览器中断了，请重试' }
        : job,
    ),
  );

  browser.runtime.onInstalled.addListener(async () => {
    await browser.contextMenus.removeAll();
    browser.contextMenus.create({
      id: MENU_LINK,
      title: '用 Reach 分享此链接',
      contexts: ['link'],
      targetUrlPatterns: POST_URL_PATTERNS,
    });
    browser.contextMenus.create({
      id: MENU_PAGE,
      title: '用 Reach 分享此页',
      contexts: ['page'],
      documentUrlPatterns: POST_URL_PATTERNS,
    });
  });

  browser.contextMenus.onClicked.addListener(async (info) => {
    const url = info.menuItemId === MENU_LINK ? info.linkUrl : info.pageUrl;
    if (!url) return;
    await runShare({
      type: 'share',
      id: crypto.randomUUID(),
      url,
      options: await defaultOptionsItem.getValue(),
    });
  });

  browser.runtime.onMessage.addListener((message: ShareMessage) => {
    if (message?.type === 'share') void runShare(message);
  });

  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== 'popup') return;
    openPopups += 1;
    port.onDisconnect.addListener(() => {
      openPopups -= 1;
    });
  });

  browser.notifications.onClicked.addListener(async (notificationId) => {
    const job = (await jobsItem.getValue()).find((j) => j.id === notificationId);
    if (job?.status === 'done') await browser.tabs.create({ url: job.result.adminUrl });
    await browser.notifications.clear(notificationId);
  });

  // Firefox resets an idle event page's timer only when an extension event
  // arrives; the keep-awake writes below come back here as one.
  browser.storage.onChanged.addListener(() => {});
});

/** Popups currently open. Results they are showing need no notification. */
let openPopups = 0;

const running = new Set<string>();
let keepAwake: ReturnType<typeof setInterval> | undefined;

async function runShare({ id, url, options }: ShareMessage) {
  const startedAt = Date.now();
  const connection = await connectionItem.getValue();
  if (!connection) {
    await finish({ id, url, options, startedAt, status: 'error', error: '请先在扩展设置里登录 Reach' });
    return;
  }

  running.add(id);
  syncActivity();
  // A retry reuses its job's id and moves it back to the top.
  await updateJobs((jobs) => [
    { id, url, options, startedAt, status: 'running', stage: null },
    ...jobs.filter((j) => j.id !== id),
  ]);

  let job: Job;
  try {
    const result = await createShareLink(
      connection,
      { url, accessControl: toAccessControl(options) },
      (stage) =>
        void updateJobs((jobs) =>
          jobs.map((j) => (j.id === id && j.status === 'running' ? { ...j, stage } : j)),
        ),
    );
    const copied = await copyToClipboard(result.shareUrl);
    job = { id, url, options, startedAt, status: 'done', result, copied };
  } catch (err) {
    if (err instanceof SignedOutError) await connectionItem.setValue(null);
    job = { id, url, options, startedAt, status: 'error', error: (err as Error).message };
  } finally {
    running.delete(id);
    syncActivity();
  }
  await finish(job);
}

async function finish(job: Job) {
  await updateJobs((jobs) =>
    jobs.some((j) => j.id === job.id) ? jobs.map((j) => (j.id === job.id ? job : j)) : [job, ...jobs],
  );
  if (openPopups > 0) return;

  const iconUrl = browser.runtime.getURL('/icon/128.png');
  if (job.status === 'done') {
    await browser.notifications.create(job.id, {
      type: 'basic',
      iconUrl,
      title: job.copied ? '分享链接已复制' : '分享链接已生成（复制失败，请在扩展里复制）',
      message: `${job.result.title}\n${job.result.shareUrl}`,
    });
  } else if (job.status === 'error') {
    await browser.notifications.create(job.id, {
      type: 'basic',
      iconUrl,
      title: '分享失败',
      message: job.error,
    });
  }
}

let jobsWrite: Promise<unknown> = Promise.resolve();

/** Serialized read-modify-write, newest first, capped at MAX_JOBS. */
function updateJobs(update: (jobs: Job[]) => Job[]): Promise<void> {
  const run = jobsWrite.then(async () => {
    const jobs = update(await jobsItem.getValue());
    await jobsItem.setValue(jobs.slice(0, MAX_JOBS));
  });
  jobsWrite = run.catch(() => {});
  return run;
}

/** Badge count while shares run, and keep the background alive until they end. */
function syncActivity() {
  void browser.action.setBadgeText({ text: running.size ? String(running.size) : '' });
  void browser.action.setBadgeBackgroundColor({ color: '#5b4fe9' });

  if (running.size > 0 && !keepAwake) {
    // Chrome resets its 30s idle timer on any extension API call; Firefox on
    // the storage.onChanged event this write triggers.
    keepAwake = setInterval(() => void browser.storage.session.set({ keepAwake: Date.now() }), 20_000);
  } else if (running.size === 0 && keepAwake) {
    clearInterval(keepAwake);
    keepAwake = undefined;
  }
}
