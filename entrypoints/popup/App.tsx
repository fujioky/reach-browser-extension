// The share popup: the link (the current tab when it is a post) and its share
// options; under them, the share for that link when there is one, then the
// rest of the history, folded away until asked for.

import { useEffect, useRef, useState } from 'react';

import { browser } from '#imports';

import { ReachMark } from '@/components/ReachMark';
import { ShareOptionsFields } from '@/components/ShareOptionsFields';
import { useStorageValue } from '@/components/useStorageValue';
import { canShareWith, type ShareOptions } from '@/utils/access';
import {
  historyItem,
  isPostUrl,
  postKey,
  stageLabel,
  type BackgroundMessage,
  type Job,
} from '@/utils/jobs';
import { connectionItem, defaultOptionsItem } from '@/utils/settings';

function send(message: BackgroundMessage) {
  // Nothing answers these messages; the result shows up in storage instead.
  void browser.runtime.sendMessage(message).catch(() => {});
}

export function App() {
  const connection = useStorageValue(connectionItem);
  const defaults = useStorageValue(defaultOptionsItem);
  const history = useStorageValue(historyItem);
  const [url, setUrl] = useState('');
  const [tabChecked, setTabChecked] = useState(false);
  const [options, setOptions] = useState<ShareOptions>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const focusedRef = useRef(false);

  // While this port is open the background shows results here, not as notifications.
  useEffect(() => {
    const port = browser.runtime.connect({ name: 'popup' });
    return () => port.disconnect();
  }, []);

  useEffect(() => {
    void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (isPostUrl(tab?.url)) setUrl(tab.url);
      setTabChecked(true);
    });
  }, []);

  useEffect(() => {
    if (defaults && !options) setOptions(defaults);
  }, [defaults, options]);

  const ready = connection !== undefined && history !== undefined && options !== undefined;

  // Opened on a post (by click or Alt+Shift+S), Enter alone shares it. Once
  // only — later focus belongs to whoever is typing.
  useEffect(() => {
    if (!ready || !tabChecked || focusedRef.current) return;
    focusedRef.current = true;
    (url ? submitRef : inputRef).current?.focus();
  }, [ready, tabChecked, url]);

  if (!ready) {
    return <div className="h-40 w-[360px] bg-paper" />;
  }

  const link = url.trim();
  const key = link ? postKey(link) : null;
  // The newest share of the post in the box — the current page unless edited.
  const current = key ? history.find((job) => postKey(job.url) === key) : undefined;
  const earlier = history.filter((job) => job !== current);
  const earlierRunning = earlier.filter((job) => job.status === 'running').length;
  const sharing = current?.status === 'running';

  return (
    <div className="w-[360px] bg-paper">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <ReachMark size={18} className="text-brand" />
        <span className="text-[14px] font-bold text-ink">Reach 分享</span>
        {connection && (
          <span className="min-w-0 truncate text-[11px] text-subtle" title={connection.baseUrl}>
            {connection.username} · {new URL(connection.baseUrl).host}
          </span>
        )}
        <button
          type="button"
          onClick={() => void browser.runtime.openOptionsPage()}
          className="ml-auto rounded-sm p-1 text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
          title="设置"
          aria-label="设置"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </header>

      {connection ? (
        <form
          className="flex flex-col gap-3 px-4 py-3.5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!link || sharing || !canShareWith(options)) return;
            send({ type: 'share', id: crypto.randomUUID(), url: link, options });
          }}
        >
          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="粘贴 X / 推特帖子或 YouTube 视频链接"
            className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-[12px] text-ink outline-none placeholder:text-subtle focus:border-brand"
            aria-label="要分享的链接"
          />
          <ShareOptionsFields value={options} onChange={setOptions} />
          <button
            ref={submitRef}
            type="submit"
            disabled={!link || sharing || !canShareWith(options)}
            className="rounded-sm bg-brand py-2 text-[13px] font-semibold text-white shadow-brand transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-subtle disabled:shadow-none"
          >
            {sharing ? '正在分享…' : current ? '再生成一个分享链接' : '生成分享链接'}
          </button>
        </form>
      ) : (
        <div className="px-4 py-6 text-center">
          <p className="text-[13px] text-muted">登录你的 Reach 后即可一键分享</p>
          <button
            type="button"
            onClick={() => void browser.runtime.openOptionsPage()}
            className="mt-3 rounded-sm bg-brand px-4 py-2 text-[13px] font-semibold text-white shadow-brand hover:bg-brand-hover"
          >
            去登录
          </button>
        </div>
      )}

      {current && (
        <div className="border-t border-border">
          <JobRow job={current} />
        </div>
      )}

      {earlier.length > 0 && (
        <section className="border-t border-border">
          <div className="flex items-center px-4 py-2">
            <button
              type="button"
              onClick={() => setHistoryOpen((open) => !open)}
              aria-expanded={historyOpen}
              className="flex items-center gap-1.5 text-[12px] text-muted hover:text-ink"
            >
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                className={`transition-transform ${historyOpen ? 'rotate-90' : ''}`}
                aria-hidden="true"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
              历史记录 · {earlier.length}
              {earlierRunning > 0 && <span className="text-brand">· {earlierRunning} 个进行中</span>}
            </button>
            {historyOpen && earlier.some((job) => job.status !== 'running') && (
              <button
                type="button"
                onClick={() => send({ type: 'forget', ids: earlier.map((job) => job.id) })}
                className="ml-auto text-[11px] text-subtle hover:text-danger"
              >
                清空
              </button>
            )}
          </div>
          {historyOpen && (
            <ul className="flex flex-col border-t border-border">
              {earlier.map((job) => (
                <li key={job.id} className="border-b border-border last:border-b-0">
                  <JobRow job={job} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function JobRow({ job }: { job: Job }) {
  return (
    <div className="px-4 py-3">
      {job.status === 'running' && (
        <div className="flex items-center gap-2.5">
          <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <div className="min-w-0">
            <div className="text-[12px] font-medium text-ink">{stageLabel(job.stage)}</div>
            <LinkText url={job.url} />
          </div>
        </div>
      )}

      {job.status === 'done' && <DoneJob job={job} />}

      {job.status === 'error' && (
        <div className="flex items-start gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-[12px] text-danger">{job.error}</div>
            <LinkText url={job.url} />
          </div>
          <button
            type="button"
            onClick={() => send({ type: 'share', id: job.id, url: job.url, options: job.options })}
            className="shrink-0 rounded-sm border border-border bg-surface px-2.5 py-1 text-[12px] text-muted hover:text-ink"
          >
            重试
          </button>
        </div>
      )}
    </div>
  );
}

function CopyButton({ text, label = '复制' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      }}
      className={`shrink-0 rounded-sm border px-2.5 py-1 text-[12px] transition-colors ${
        copied ? 'border-success text-success' : 'border-border bg-surface text-muted hover:text-ink'
      }`}
    >
      {copied ? '已复制' : label}
    </button>
  );
}

function DoneJob({ job }: { job: Extract<Job, { status: 'done' }> }) {
  const { result, options } = job;
  // The password typed for this share, when it is what now guards the mirror.
  const password =
    result.passwordMode === 'custom' && options.passwordMode === 'custom' ? options.password.trim() : null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[12px] text-success" aria-hidden="true">✓</span>
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink" title={result.title}>
          {result.title || '分享链接'}
        </span>
        <a
          href={result.adminUrl}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-[11px] text-subtle hover:text-brand"
        >
          后台
        </a>
      </div>
      <div className="flex items-center gap-1.5">
        <code className="min-w-0 flex-1 truncate rounded-sm bg-surface-2 px-2 py-1 font-mono text-[11px] text-ink">
          {result.shareUrl}
        </code>
        <CopyButton text={result.shareUrl} />
      </div>
      {result.passwordMode !== 'none' && (
        <div className="flex items-center gap-1.5 text-[11px] text-ink">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-warning" aria-hidden="true">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          {password ? (
            <>
              <span className="min-w-0 flex-1 truncate">
                访问密码 <code className="font-mono">{password}</code>
              </span>
              <CopyButton text={password} label="复制密码" />
            </>
          ) : (
            <span className="text-muted">
              {result.passwordMode === 'inherit' ? '需要系统密码才能打开' : '需要这份镜像原有的单独密码才能打开'}
            </span>
          )}
        </div>
      )}
      <div className="text-[11px] text-subtle">
        {job.copied && '已自动复制链接 · '}
        {result.reused ? `沿用已有镜像${formatFetchedAt(result.fetchedAt)}` : '新建镜像'}
        {' · '}
        {formatWhen(job.startedAt)}
      </div>
      {result.warnings.length > 0 && (
        <details className="text-[11px] text-warning">
          <summary className="cursor-pointer">{result.warnings.length} 条警告</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 break-all text-muted">
            {result.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function LinkText({ url }: { url: string }) {
  return (
    <div className="truncate text-[11px] text-subtle" title={url}>
      {url.replace(/^https?:\/\/(www\.)?/, '')}
    </div>
  );
}

function formatFetchedAt(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return `（内容抓取于 ${date.getMonth() + 1} 月 ${date.getDate()} 日）`;
}

function formatWhen(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return date.toDateString() === today.toDateString() ? time : `${date.getMonth() + 1} 月 ${date.getDate()} 日 ${time}`;
}
