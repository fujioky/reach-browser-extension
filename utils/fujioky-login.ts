import { ReachApiError } from './api';
import { isFujiokyUrl, normalizeBaseUrl, type Connection } from './settings';

const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export async function createProof() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  return { verifier, challenge };
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

async function post(baseUrl: string, path: string, body: unknown, signal: AbortSignal) {
  signal.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${baseUrl}/api/extension/${path}`, {
      method: 'POST', credentials: 'omit', redirect: 'error', signal: controller.signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new ReachApiError(typeof data.error === 'string' ? data.error :
      response.status === 404 ? '这个 Reach 地址尚未启用 FUJIOKY 扩展登录，请使用生产地址或更新服务器' : '暂时无法完成授权，请重试', response.status);
    return { status: response.status, data };
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof ReachApiError) throw error;
    throw new ReachApiError('无法连接 FUJIOKY，请检查网络后重试');
  } finally {
    clearTimeout(timer); signal.removeEventListener('abort', abort);
  }
}

/** The verifier lives only in this options page. The browser tab carries a
 * short-lived request id, never the verifier, extension token or a password. */
export async function signInFujioky(baseUrl: string, options: {
  name: string;
  signal: AbortSignal;
  openAuthorization: (url: string) => Promise<() => Promise<void>>;
}): Promise<Connection> {
  const origin = normalizeBaseUrl(baseUrl);
  if (!origin || !isFujiokyUrl(origin) || new URL(origin).protocol !== 'https:') {
    throw new ReachApiError('FUJIOKY 登录必须使用 https://fujioky.com 或其子域名');
  }
  const { verifier, challenge } = await createProof();
  const { data: started } = await post(origin, 'authorization', { challenge, method: 'S256', name: options.name }, options.signal);
  let verification: URL;
  try { verification = new URL(started.verificationUrl); } catch { throw new ReachApiError('服务器返回了无效的授权页面'); }
  if (verification.origin !== origin || verification.pathname !== '/extension/authorize' || verification.username || verification.password ||
      !/^[A-Za-z0-9_-]{43}$/.test(started.requestId) || verification.searchParams.get('request') !== started.requestId) {
    throw new ReachApiError('服务器返回了无效的授权页面');
  }
  const expires = Date.parse(started.expiresAt);
  if (!Number.isFinite(expires) || expires <= Date.now()) throw new ReachApiError('登录申请已过期，请重试');
  const deadline = Math.min(expires, Date.now() + 300000);
  const interval = Math.min(10, Math.max(2, Number(started.interval) || 2)) * 1000;
  options.signal.throwIfAborted();
  const closeAuthorization = await options.openAuthorization(verification.href);
  let consecutiveFailures = 0;
  try {
    while (Date.now() < deadline) {
      await pause(interval, options.signal);
      let result;
      try {
        result = await post(origin, 'authorization/token', { requestId: started.requestId, verifier }, options.signal);
        consecutiveFailures = 0;
      } catch (error) {
        if (error instanceof ReachApiError && (!error.status || error.status >= 500) && ++consecutiveFailures < 4) continue;
        throw error;
      }
      if (result.status === 202 && result.data.status === 'pending') continue;
      const { token, username, status } = result.data;
      if (status !== 'authorized' || typeof token !== 'string' || !token.startsWith('member_reach_') || typeof username !== 'string') {
        throw new ReachApiError('服务器返回了无效的登录结果');
      }
      return { baseUrl: origin, token, username };
    }
    throw new ReachApiError('登录申请已过期，请重新点击登录');
  } finally {
    await closeAuthorization().catch(() => {});
  }
}
