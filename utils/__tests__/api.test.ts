import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  checkSession,
  createShareLink,
  ReachApiError,
  signIn,
  signOut,
  SignedOutError,
  type ShareStage,
} from '../api';

const connection = { baseUrl: 'https://reach.test', token: 'reach_token', username: 'admin' };
const request = {
  url: 'https://x.com/jack/status/20',
  accessControl: { expiresAt: null, maxViews: null, burnAfterRead: false },
  password: { mode: 'custom' as const, value: 'open sesame' },
};

/** A response whose body arrives in the given chunks, the way a network stream does. */
function streamed(chunks: string[], init: ResponseInit = { status: 200 }) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, init);
}

function mockFetch(response: Response | (() => never)) {
  const fetch = vi.fn(async () => (typeof response === 'function' ? response() : response));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('signIn', () => {
  it('posts the credentials and returns the connection to store', async () => {
    const fetch = mockFetch(Response.json({ token: 'reach_new', username: 'admin' }));
    const result = await signIn('https://reach.test', { username: 'admin', password: 'pw', name: 'Chrome · Linux' });

    expect(result).toEqual({ baseUrl: 'https://reach.test', token: 'reach_new', username: 'admin' });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://reach.test/api/extension/session');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ username: 'admin', password: 'pw', name: 'Chrome · Linux' });
  });

  it("shows the server's reason for a rejected password, not a sign-out", async () => {
    mockFetch(Response.json({ error: '用户名或密码错误' }, { status: 401 }));
    const error = await signIn('https://reach.test', { username: 'admin', password: 'x', name: 'n' }).catch((e) => e);
    expect(error).toBeInstanceOf(ReachApiError);
    expect(error).not.toBeInstanceOf(SignedOutError);
    expect(error.message).toBe('用户名或密码错误');
  });

  it('explains an address with no Reach behind it', async () => {
    mockFetch(new Response('<html>404</html>', { status: 404 }));
    await expect(signIn('https://example.com', { username: 'a', password: 'b', name: 'n' })).rejects.toThrow(
      '这个地址上没有 Reach 的扩展接口',
    );
  });

  it('explains an unreachable address', async () => {
    mockFetch(() => {
      throw new TypeError('Failed to fetch');
    });
    await expect(signIn('https://reach.test', { username: 'a', password: 'b', name: 'n' })).rejects.toThrow(
      '无法连接 https://reach.test',
    );
  });
});

describe('authorized calls', () => {
  it('send the bearer token and turn a 401 into SignedOutError', async () => {
    const fetch = mockFetch(Response.json({ error: '登录已失效，请重新登录' }, { status: 401 }));
    await expect(checkSession(connection)).rejects.toBeInstanceOf(SignedOutError);
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer reach_token');
  });

  it('sign out with DELETE', async () => {
    const fetch = mockFetch(new Response(null, { status: 204 }));
    await signOut(connection);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://reach.test/api/extension/session');
    expect(init.method).toBe('DELETE');
  });
});

describe('createShareLink', () => {
  const done = {
    type: 'done',
    ok: true,
    shareUrl: 'https://reach.test/s/abc',
    adminUrl: 'https://reach.test/admin/mirrors/1',
    title: 'Hello',
    reused: false,
    fetchedAt: null,
    passwordMode: 'custom',
    warnings: [],
  };

  it('reports stages split across chunks and resolves with the done line', async () => {
    const lines = [
      JSON.stringify({ type: 'stage', phase: 'fetching' }),
      JSON.stringify({ type: 'stage', phase: 'images', done: 0, total: 2 }),
      JSON.stringify(done),
    ].join('\n');
    // Cut mid-line to prove lines are reassembled.
    mockFetch(streamed([lines.slice(0, 20), lines.slice(20, 70), `${lines.slice(70)}\n`]));

    const stages: ShareStage[] = [];
    const result = await createShareLink(connection, request, (stage) => stages.push(stage));

    expect(stages).toEqual([{ type: 'stage', phase: 'fetching' }, { type: 'stage', phase: 'images', done: 0, total: 2 }]);
    expect(result).toMatchObject({ shareUrl: 'https://reach.test/s/abc', passwordMode: 'custom' });
  });

  it('posts the link, its access control and the mirror password', async () => {
    const fetch = mockFetch(streamed([JSON.stringify(done)]));
    await createShareLink(connection, request, () => {});
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://reach.test/api/extension/share');
    expect(JSON.parse(init.body as string)).toEqual(request);
  });

  it('accepts a final line without a trailing newline', async () => {
    mockFetch(streamed([JSON.stringify(done)]));
    await expect(createShareLink(connection, request, () => {})).resolves.toMatchObject({ title: 'Hello' });
  });

  it("rejects with the server's message on a failed done line", async () => {
    mockFetch(streamed([`${JSON.stringify({ type: 'done', ok: false, error: '内容不存在或已删除' })}\n`]));
    await expect(createShareLink(connection, request, () => {})).rejects.toThrow('内容不存在或已删除');
  });

  it('treats a stream that ends without a verdict as a timeout', async () => {
    mockFetch(streamed([`${JSON.stringify({ type: 'stage', phase: 'fetching' })}\n{"type":"do`]));
    await expect(createShareLink(connection, request, () => {})).rejects.toThrow('提前结束');
  });

  it('signs out on 401 before the stream opens', async () => {
    mockFetch(Response.json({ error: '登录已失效，请重新登录' }, { status: 401 }));
    await expect(createShareLink(connection, request, () => {})).rejects.toBeInstanceOf(SignedOutError);
  });
});
