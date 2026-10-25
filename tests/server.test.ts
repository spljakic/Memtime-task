import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../server/app';
import { createDemoTransport } from '../server/demo';
import { createMemtimeClient, createTransport } from '../server/memtimeClient';
import { RateLimiter, retryDelay } from '../server/rateLimiter';
import { AppError } from '../server/errors';
const params = { limit: 10, offset: 0, sortBy: 'id', order: 'asc' as const };
const input = {
  taskId: 101,
  comment: 'Integration test',
  start: '2026-10-23T08:00:00Z',
  end: '2026-10-23T09:00:00Z',
};
const fixture = { ...input, id: 1, createdAt: input.end, userId: 'secret-should-never-leak' };
function response(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), { status, headers });
}
describe('request budget', () => {
  it('limits concurrent dispatches and frees budget after the window', () => {
    let now = 0;
    const gate = new RateLimiter(() => now);
    for (let i = 0; i < 15; i++) gate.acquire();
    expect(() => gate.acquire()).toThrow(AppError);
    now = 60001;
    expect(() => gate.acquire()).not.toThrow();
  });
  it('shares upstream cooldown with all requests', () => {
    let now = 0;
    const gate = new RateLimiter(() => now);
    gate.cooldown(90);
    now = 60000;
    expect(() => gate.acquire()).toThrow();
    now = 90001;
    expect(() => gate.acquire()).not.toThrow();
  });
  it('understands seconds, HTTP dates, and missing retry headers', () => {
    expect(retryDelay('12', 0)).toBe(12);
    expect(retryDelay(new Date(90000).toUTCString(), 0)).toBe(90);
    expect(retryDelay(null, 0)).toBe(60);
  });
});
describe('Memtime boundary', () => {
  it('authenticates, deduplicates reads and caches them', async () => {
    const f = vi.fn(async (_url: unknown, _init?: RequestInit) => response([fixture]));
    const client = createMemtimeClient(createTransport({ key: 'test-key', fetchImpl: f }));
    await Promise.all([client.list('/time-entries', params), client.list('/time-entries', params)]);
    await client.list('/time-entries', params);
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer test-key' });
  });
  it('does not expose credential-bearing fields on reads or writes', async () => {
    const client = createMemtimeClient(async (_p, m) => (m === 'GET' ? [fixture] : fixture));
    expect(JSON.stringify(await client.list('/time-entries', params))).not.toContain('secret');
    expect(await client.save(input)).not.toHaveProperty('userId');
  });
  it('rejects unexpected collection shapes', async () => {
    const client = createMemtimeClient(async () => ({ items: [] }));
    await expect(client.list('/clients', params)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });
  it('marks a full array page as possibly incomplete without inventing totals', async () => {
    const client = createMemtimeClient(async () => [{ id: 1, name: 'Acme' }]);
    const page = await client.list('/clients', { ...params, limit: 1 });
    expect(page.mayHaveMore).toBe(true);
    expect(page).not.toHaveProperty('total');
  });
  it.each([400, 401, 403, 404, 429, 500])('maps upstream HTTP %s safely', async (status) => {
    const transport = createTransport({
      key: 'secret',
      fetchImpl: vi.fn(async () => response({ error: 'sensitive upstream detail' }, status)),
    });
    try {
      await transport('/clients', 'GET', params);
      throw new Error('Expected failure');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as Error).message).not.toContain('sensitive');
    }
  });
  it('does not retry writes and distinguishes unknown outcomes', async () => {
    const f = vi.fn(async () => {
      throw new Error('timeout');
    });
    const transport = createTransport({ key: 'key', fetchImpl: f });
    await expect(transport('/time-entries', 'POST', undefined, input)).rejects.toMatchObject({
      code: 'OUTCOME_UNKNOWN',
    });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('handles unreadable mutation responses as uncertain', async () => {
    const client = createMemtimeClient(
      createTransport({ key: 'key', fetchImpl: vi.fn(async () => new Response('broken')) }),
    );
    await expect(client.save(input)).rejects.toMatchObject({ code: 'OUTCOME_UNKNOWN' });
  });
  it('invalidates reads after writes', async () => {
    const f = vi.fn(async (_url: unknown, init?: RequestInit) =>
      response(init?.method === 'GET' ? [fixture] : fixture),
    );
    const client = createMemtimeClient(createTransport({ key: 'key', fetchImpl: f }));
    await client.list('/time-entries', params);
    await client.save(input);
    await client.list('/time-entries', params);
    expect(f).toHaveBeenCalledTimes(3);
  });
  it('pre-write in-flight reads cannot repopulate a post-write cache', async () => {
    let release!: (r: Response) => void;
    let calls = 0;
    const f = vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (init?.method === 'GET' && calls++ === 0)
        return new Promise<Response>((r) => {
          release = r;
        });
      return response(init?.method === 'GET' ? [{ ...fixture, comment: 'new' }] : fixture);
    });
    const client = createMemtimeClient(createTransport({ key: 'key', fetchImpl: f }));
    const old = client.list('/time-entries', params);
    await client.save(input);
    release(response([fixture]));
    await old;
    const fresh = await client.list('/time-entries', params);
    expect(fresh.items[0]).toMatchObject({ comment: 'new' });
    expect(f).toHaveBeenCalledTimes(3);
  });
});
describe('HTTP routes and demo integration', () => {
  let server: Server, base: string;
  beforeAll(async () => {
    server = createApp({ client: createMemtimeClient(createDemoTransport()), demo: true }).listen(
      0,
      '127.0.0.1',
    );
    await new Promise<void>((r) => server.once('listening', r));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
  });
  const json = (body: unknown) => ({
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  it('paginates clients, projects, tasks and entries', async () => {
    for (const path of ['/clients', '/clients/1/projects', '/projects/11/tasks', '/time-entries']) {
      const r = await fetch(base + '/api' + path + '?limit=1&offset=0');
      expect(r.status).toBe(200);
      const p = await r.json();
      expect(p.items).toHaveLength(1);
      expect(p.mayHaveMore).toBe(true);
    }
  });
  it('creates then updates all required fields', async () => {
    const created = await fetch(base + '/api/time-entries', { method: 'POST', ...json(input) });
    expect(created.status).toBe(201);
    const row = await created.json();
    const updated = await fetch(base + '/api/time-entries/' + row.id, {
      method: 'PUT',
      ...json({ ...input, comment: 'Revised' }),
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({ id: row.id, comment: 'Revised' });
  });
  it('rejects malformed JSON as 400', async () => {
    const r = await fetch(base + '/api/time-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ message: 'Invalid JSON body.' });
  });
  it('rejects negative duration, invalid task, and invalid pagination', async () => {
    for (const body of [
      { ...input, end: input.start },
      { ...input, taskId: 0 },
    ]) {
      expect(
        (await fetch(base + '/api/time-entries', { method: 'POST', ...json(body) })).status,
      ).toBe(400);
    }
    expect((await fetch(base + '/api/clients?offset=-1')).status).toBe(400);
  });
  it('returns 404 when updating a missing entry', async () => {
    expect(
      (await fetch(base + '/api/time-entries/9999', { method: 'PUT', ...json(input) })).status,
    ).toBe(404);
  });
  it('rejects cross-origin mutations', async () => {
    expect(
      (
        await fetch(base + '/api/time-entries', {
          method: 'POST',
          ...json(input),
          headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example' },
        })
      ).status,
    ).toBe(403);
  });
  it('does not expose arbitrary API proxy routes', async () => {
    expect((await fetch(base + '/api/anything')).status).toBe(404);
  });
});
