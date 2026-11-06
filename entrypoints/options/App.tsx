// Options: choose authentication from the Reach host and configure defaults
// for right-click shares.

import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';

import { ReachMark } from '@/components/ReachMark';
import { ShareOptionsFields } from '@/components/ShareOptionsFields';
import { useStorageValue } from '@/components/useStorageValue';
import { checkSession, signIn, signOut, SignedOutError } from '@/utils/api';
import { signInFujioky } from '@/utils/fujioky-login';
import {
  connectionItem,
  defaultOptionsItem,
  describeBrowser,
  lastBaseUrlItem,
  normalizeBaseUrl,
  isFujiokyUrl,
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
          <li>访问密码设在镜像上，同一条帖子的所有分享链接共用；选「不设置」不会改动镜像已有的密码。</li>
          <li>弹窗里先显示当前帖子的分享，其他分享收在「历史记录」里，点开查看。</li>
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
  const login = useRef<AbortController | null>(null);
  useEffect(() => () => login.current?.abort(), []);

  const address = baseUrl ?? (lastBaseUrl || 'https://reachs.fujioky.com');
  const fujioky = isFujiokyUrl(address);

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
        if (fujioky && !origin.startsWith('https://')) {
          setError('FUJIOKY 登录需要 HTTPS，请将地址改为 https://');
          return;
        }
        const controller = new AbortController();
        login.current = controller;
        setPending(true);
        setError(null);
        try {
          const signedIn = fujioky ? await signInFujioky(origin, {
            name: describeBrowser(), signal: controller.signal,
            openAuthorization: async (url) => {
              const settingsTab = await browser.tabs.getCurrent();
              const authTab = await browser.tabs.create({ url, active: true });
              return async () => {
                if (authTab.id !== undefined) await browser.tabs.remove(authTab.id).catch(() => {});
                if (settingsTab?.id !== undefined) await browser.tabs.update(settingsTab.id, { active: true }).catch(() => {});
              };
            },
          }) : await signIn(origin, {
            username: username.trim(),
            password,
            name: describeBrowser(),
          });
          await lastBaseUrlItem.setValue(origin);
          await connectionItem.setValue(signedIn);
        } catch (err) {
          setError(controller.signal.aborted ? '已取消登录' : (err as Error).message);
        } finally {
          login.current = null;
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
          disabled={pending}
          required
        />
      </label>
      {fujioky ? <p className="text-[12px] leading-relaxed text-muted">将打开 FUJIOKY 授权页，确认允许「Reach 浏览器扩展」连接你的账户。完成后会自动回到这里。</p> : <div className="flex gap-3">
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
      </div>}
      {error && <p role="alert" className="text-[12px] text-danger">{error}</p>}
      {pending && fujioky && <p role="status" className="text-[12px] text-muted">等待你在 FUJIOKY 页面完成登录和授权…</p>}
      <div className="flex items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-sm bg-brand px-5 py-2 text-[13px] font-semibold text-white shadow-brand transition-colors hover:bg-brand-hover disabled:opacity-60"
      >
        {pending ? '登录中…' : fujioky ? '用 FUJIOKY 登录' : '登录'}
      </button>
      {pending && fujioky && <button type="button" className="text-[12px] text-muted underline" onClick={() => login.current?.abort()}>取消</button>}
      </div>
      <p className="text-[11px] text-subtle">
        {fujioky ? '可在 Reach 后台／工作区撤销本设备，或在 FUJIOKY 账户中心「会话与授权」撤销扩展的应用授权。管理员无需 VIP。' : '使用该 Reach 站点原有的管理员账号和密码。扩展只在登录时发送密码，之后仅保存本设备令牌。'}
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
          href={`${connection.baseUrl}${isFujiokyUrl(connection.baseUrl) ? '/workspace' : '/admin'}`}
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
      {isFujiokyUrl(connection.baseUrl) && <a href="https://auth.fujioky.com/account/sessions" target="_blank" rel="noreferrer" className="text-[12px] text-muted underline">在 FUJIOKY 管理扩展授权 ↗</a>}
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
