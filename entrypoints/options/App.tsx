// Options: sign in to a Reach site with the admin account, and the access
// settings right-click shares use.

import { useEffect, useState } from 'react';

import { ReachMark } from '@/components/ReachMark';
import { ShareOptionsFields } from '@/components/ShareOptionsFields';
import { useStorageValue } from '@/components/useStorageValue';
import { checkSession, signIn, signOut, SignedOutError } from '@/utils/api';
import {
  connectionItem,
  defaultOptionsItem,
  describeBrowser,
  lastBaseUrlItem,
  normalizeBaseUrl,
  type Connection,
} from '@/utils/settings';

export function App() {
  const connection = useStorageValue(connectionItem);
  const defaults = useStorageValue(defaultOptionsItem);

  return (
    <main className="mx-auto flex max-w-[520px] flex-col gap-5 px-6 py-10">
      <div className="flex items-center gap-2.5">
        <ReachMark size={24} className="text-brand" />
        <h1 className="text-[20px] font-bold text-ink">Reach 分享 · 设置</h1>
      </div>

      <section className="rounded-md border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-[14px] font-semibold text-ink">账号</h2>
        {connection === undefined ? null : connection ? (
          <SignedIn connection={connection} />
        ) : (
          <SignInForm />
        )}
      </section>

      <section className="rounded-md border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-[14px] font-semibold text-ink">默认分享设置</h2>
        <p className="mb-4 mt-1 text-[12px] text-subtle">右键分享直接使用这组设置；弹窗里可以逐次调整。</p>
        {defaults && (
          <ShareOptionsFields value={defaults} onChange={(next) => void defaultOptionsItem.setValue(next)} />
        )}
      </section>

      <section className="rounded-md border border-border bg-surface p-5 text-[12px] leading-relaxed text-muted shadow-sm">
        <h2 className="mb-2 text-[14px] font-semibold text-ink">使用方式</h2>
        <ul className="list-disc space-y-1 pl-4">
          <li>在 X 帖子或 YouTube 视频页点扩展图标（或按 Alt+Shift+S），回车生成链接。</li>
          <li>在时间线里的帖子链接上右键「用 Reach 分享此链接」，不用打开帖子。</li>
          <li>链接生成后自动复制到剪贴板；已经镜像过的帖子会直接沿用那份镜像。</li>
          <li>快捷键可在 chrome://extensions/shortcuts（Firefox：附加组件管理器 → 管理扩展快捷键）修改。</li>
        </ul>
      </section>
    </main>
  );
}

const inputClass =
  'w-full rounded-sm border border-border bg-surface px-3 py-2 text-[13px] text-ink outline-none placeholder:text-subtle focus:border-brand';

function SignInForm() {
  const lastBaseUrl = useStorageValue(lastBaseUrlItem);
  const [baseUrl, setBaseUrl] = useState<string>();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const address = baseUrl ?? lastBaseUrl ?? '';

  return (
    <form
      className="mt-4 flex flex-col gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const origin = normalizeBaseUrl(address);
        if (!origin) {
          setError('请填写 Reach 的地址，例如 https://reach.example.com');
          return;
        }
        setPending(true);
        setError(null);
        try {
          const signedIn = await signIn(origin, {
            username: username.trim(),
            password,
            name: describeBrowser(),
          });
          await lastBaseUrlItem.setValue(origin);
          await connectionItem.setValue(signedIn);
        } catch (err) {
          setError((err as Error).message);
          setPending(false);
        }
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] text-muted">Reach 地址</span>
        <input
          type="text"
          inputMode="url"
          value={address}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://reach.example.com"
          className={inputClass}
          required
        />
      </label>
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-[12px] text-muted">管理员账号</span>
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={inputClass}
            required
          />
        </label>
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-[12px] text-muted">密码</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            required
          />
        </label>
      </div>
      {error && <p className="text-[12px] text-danger">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-sm bg-brand px-5 py-2 text-[13px] font-semibold text-white shadow-brand transition-colors hover:bg-brand-hover disabled:opacity-60"
      >
        {pending ? '登录中…' : '登录'}
      </button>
      <p className="text-[11px] text-subtle">
        密码只用来换取这个浏览器专用的令牌，不会保存。可在 Reach 后台「系统 → 浏览器扩展」查看或撤销已登录的扩展。
      </p>
    </form>
  );
}

function SignedIn({ connection }: { connection: Connection }) {
  const [status, setStatus] = useState<'checking' | 'ok' | string>('checking');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;
    checkSession(connection).then(
      () => active && setStatus('ok'),
      async (err) => {
        // A revoked token signs the extension out; the form replaces this view.
        if (err instanceof SignedOutError) await connectionItem.setValue(null);
        else if (active) setStatus((err as Error).message);
      },
    );
    return () => {
      active = false;
    };
  }, [connection]);

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="text-[13px] text-ink">
        已登录为 <b>{connection.username}</b>
        <a
          href={`${connection.baseUrl}/admin`}
          target="_blank"
          rel="noreferrer"
          className="ml-2 font-mono text-[12px] text-muted hover:text-brand"
        >
          {connection.baseUrl}
        </a>
      </div>
      {status === 'checking' && <p className="text-[12px] text-subtle">正在确认登录状态…</p>}
      {status === 'ok' && <p className="text-[12px] text-success">连接正常</p>}
      {status !== 'checking' && status !== 'ok' && <p className="text-[12px] text-warning">{status}</p>}
      <button
        type="button"
        disabled={signingOut}
        onClick={async () => {
          setSigningOut(true);
          // Revoke on the server when reachable; sign out locally regardless.
          await signOut(connection).catch(() => {});
          await connectionItem.setValue(null);
        }}
        className="self-start rounded-sm border border-border bg-surface px-4 py-1.5 text-[12px] text-muted transition-colors hover:border-danger hover:text-danger disabled:opacity-60"
      >
        {signingOut ? '退出中…' : '退出登录'}
      </button>
    </div>
  );
}
