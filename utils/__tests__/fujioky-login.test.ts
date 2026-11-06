import { afterEach, describe, expect, it, vi } from 'vitest';
import { isFujiokyUrl, normalizeBaseUrl } from '../settings';
import { createProof, signInFujioky } from '../fujioky-login';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('authentication follows the parsed hostname', () => {
  it.each(['fujioky.com', 'https://reachs.fujioky.com', 'https://A.FUJIOKY.COM/', 'https://fujioky.com./admin'])('uses FUJIOKY for %s', input => {
    expect(isFujiokyUrl(input)).toBe(true);
  });
  it.each(['https://evilfujioky.com', 'https://fujioky.com.evil.test', 'https://example.com/fujioky.com', 'https://fujioky.com@evil.test', 'https://fujiоky.com', 'http://127.0.0.1:3000', 'https://reach.example.com'])('never treats %s as FUJIOKY', input => {
    expect(isFujiokyUrl(input)).toBe(false);
  });
  it.each(['https://user:pass@reach.example.com', 'https://fujioky.com@evil.test', 'https://fujioky.com\\@evil.test', 'https://reachs.fujioky.com\n.evil.test'])('rejects ambiguous URL %s', input => {
    expect(normalizeBaseUrl(input)).toBeNull();
  });
  it('rejects insecure FUJIOKY without ever submitting credentials or opening a page', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    expect(isFujiokyUrl('http://reachs.fujioky.com')).toBe(true);
    await expect(signInFujioky('http://reachs.fujioky.com', {name:'n',signal:new AbortController().signal,openAuthorization:vi.fn()})).rejects.toThrow('https');
    expect(fetch).not.toHaveBeenCalled();
  });
});

it('creates fresh S256 proofs with no secret in the challenge', async () => {
  const first = await createProof(), second = await createProof();
  expect(first.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(first.challenge).toBe(await hash(first.verifier));
  expect(first.verifier).not.toBe(second.verifier);
});

async function hash(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const origin = 'https://reachs.fujioky.com';
const requestId = 'r'.repeat(43);
function fixture(responses: Response[], verificationUrl = `${origin}/extension/authorize?request=${requestId}`) {
  vi.useFakeTimers();
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({requestId,verificationUrl,expiresAt:new Date(Date.now()+300000).toISOString(),interval:2}));
  for(const response of responses) fetch.mockResolvedValueOnce(response);
  vi.stubGlobal('fetch',fetch);
  const close = vi.fn(async()=>{}), open = vi.fn(async(_url: string)=>close), controller=new AbortController();
  const promise=signInFujioky(origin,{name:'Chrome · Linux',signal:controller.signal,openAuthorization:open});
  // Observe rejections immediately while advancing the asynchronous browser flow.
  const outcome=promise.then(value=>({value,error:null}),error=>({value:null,error}));
  return {fetch,close,open,controller,outcome};
}

it('opens the same-origin authorization page, waits, and exchanges only with the verifier', async()=>{
  const x=fixture([Response.json({status:'pending'},{status:202}),Response.json({status:'authorized',token:'member_reach_test',username:'Alice'})]);
  await vi.waitFor(()=>expect(x.open).toHaveBeenCalledOnce());
  await vi.advanceTimersByTimeAsync(4000);
  const result=await x.outcome;
  expect(result.value).toEqual({baseUrl:origin,token:'member_reach_test',username:'Alice'});
  expect(x.close).toHaveBeenCalledOnce();
  const start=JSON.parse(x.fetch.mock.calls[0]![1].body);
  const exchange=JSON.parse(x.fetch.mock.calls[1]![1].body);
  expect(start).toEqual({challenge:expect.any(String),method:'S256',name:'Chrome · Linux'});
  expect(await hash(exchange.verifier)).toBe(start.challenge);
  expect(x.open.mock.calls[0]![0]).not.toContain(exchange.verifier);
  for(const [,request] of x.fetch.mock.calls) expect(request).toMatchObject({credentials:'omit',redirect:'error',method:'POST'});
});

it('does not open an authorization URL on an unexpected host', async()=>{
  const x=fixture([],'https://evil.test/extension/authorize?request='+requestId);
  expect((await x.outcome).error.message).toContain('无效的授权页面');
  expect(x.open).not.toHaveBeenCalled();
});

it('honors denial without switching to password login', async()=>{
  const x=fixture([Response.json({error:'你取消了授权',code:'access_denied'},{status:403})]);
  await vi.waitFor(()=>expect(x.open).toHaveBeenCalledOnce());
  await vi.advanceTimersByTimeAsync(2000);
  expect((await x.outcome).error.message).toBe('你取消了授权');
  expect(x.fetch).toHaveBeenCalledTimes(2);
  expect(x.close).toHaveBeenCalledOnce();
});

it('cancels polling and closes only the authorization tab opened by this operation', async()=>{
  const x=fixture([]);
  await vi.waitFor(()=>expect(x.open).toHaveBeenCalledOnce());
  x.controller.abort();
  expect((await x.outcome).error.name).toBe('AbortError');
  expect(x.fetch).toHaveBeenCalledTimes(1);
  expect(x.close).toHaveBeenCalledOnce();
});

it('retries a transient server failure with exactly the same proof', async()=>{
  const x=fixture([Response.json({error:'暂不可用'},{status:503}),Response.json({status:'authorized',token:'member_reach_ok',username:'Alice'})]);
  await vi.waitFor(()=>expect(x.open).toHaveBeenCalledOnce());
  await vi.advanceTimersByTimeAsync(4000);
  expect((await x.outcome).value?.token).toBe('member_reach_ok');
  expect(x.fetch.mock.calls[1]![1].body).toBe(x.fetch.mock.calls[2]![1].body);
});
