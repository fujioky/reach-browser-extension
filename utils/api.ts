// Client for Reach's extension endpoints (/api/extension/*).
//
// Sign-in trades the admin password for a token once; every later call sends
// only the token. Sharing answers in NDJSON — `stage` lines while the server
// works, then one `done` line — so a slow upstream fetch never leaves the
// request waiting 30s for response headers, which is when Chrome gives up on
// an extension service worker.

import type { AccessControl } from './access';
import type { Connection } from './settings';

export type ShareStage =
  | { phase: 'fetching' }
  | { phase: 'images'; done: number; total: number }
  | { phase: 'saving' };

export interface ShareResult {
  shareUrl: string;
  adminUrl: string;
  title: string;
  /** The post was already mirrored; this is a new link on that mirror. */
  reused: boolean;
  fetchedAt: string | null;
  warnings: string[];
}

export class ReachApiError extends Error {
  /** HTTP status when Reach answered with an error; absent for network failures. */
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

/** The token was revoked (or never valid): the extension has to sign in again. */
export class SignedOutError extends ReachApiError {
  constructor() {
    super('登录已失效，请在扩展设置里重新登录', 401);
  }
}

async function call(baseUrl: string, path: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/extension/${path}`, init);
  } catch {
    throw new ReachApiError(`无法连接 ${baseUrl}，请检查地址和网络`);
  }
  if (response.ok) return response;

  const detail = await response
    .json()
    .then((body: { error?: unknown }) => (typeof body.error === 'string' ? body.error : null))
    .catch(() => null);
  if (response.status === 404 && !detail) {
    throw new ReachApiError('这个地址上没有 Reach 的扩展接口，请检查地址或更新 Reach', 404);
  }
  throw new ReachApiError(detail ?? `Reach 返回了 HTTP ${response.status}`, response.status);
}

function authorized(connection: Connection, init: RequestInit = {}): RequestInit {
  return { ...init, headers: { ...init.headers, Authorization: `Bearer ${connection.token}` } };
}

async function callAuthorized(connection: Connection, path: string, init: RequestInit = {}) {
  try {
    return await call(connection.baseUrl, path, authorized(connection, init));
  } catch (err) {
    if (err instanceof ReachApiError && err.status === 401) throw new SignedOutError();
    throw err;
  }
}

export async function signIn(
  baseUrl: string,
  credentials: { username: string; password: string; name: string },
): Promise<Connection> {
  const response = await call(baseUrl, 'session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  const body = (await response.json()) as { token: string; username: string };
  return { baseUrl, token: body.token, username: body.username };
}

/** Resolves when the stored token still works; throws SignedOutError when it does not. */
export async function checkSession(connection: Connection): Promise<void> {
  await callAuthorized(connection, 'session');
}

export async function signOut(connection: Connection): Promise<void> {
  await callAuthorized(connection, 'session', { method: 'DELETE' });
}

export async function createShareLink(
  connection: Connection,
  request: { url: string; accessControl: AccessControl },
  onStage: (stage: ShareStage) => void,
): Promise<ShareResult> {
  const response = await callAuthorized(connection, 'share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.body) throw new ReachApiError('Reach 没有返回内容');

  try {
    for await (const event of readNdjson(response.body)) {
      if (event.type === 'stage') {
        onStage(event as unknown as ShareStage);
      } else if (event.type === 'done') {
        if (event.ok === true) return event as unknown as ShareResult;
        throw new ReachApiError(typeof event.error === 'string' ? event.error : '分享失败');
      }
    }
  } catch (err) {
    if (err instanceof ReachApiError) throw err;
    throw new ReachApiError('与 Reach 的连接中断了，请重试');
  }
  // No verdict: the server's function hit its time limit mid-share.
  throw new ReachApiError('Reach 提前结束了响应（可能超时），请重试');
}

async function* readNdjson(body: ReadableStream<Uint8Array>): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n');
      buffer = done ? '' : (lines.pop() ?? '');
      for (const line of lines) {
        if (!line.trim()) continue;
        let event: Record<string, unknown>;
        try {
          event = JSON.parse(line);
        } catch {
          continue; // a partial line at the tail of a cut-off stream
        }
        yield event;
      }
      if (done) return;
    }
  } finally {
    reader.releaseLock();
  }
}
