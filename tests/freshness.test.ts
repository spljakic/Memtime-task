import { expect, it, vi } from 'vitest';
import { createTransport, createMemtimeClient } from '../server/memtimeClient';
import { RateLimiter } from '../server/rateLimiter';
const params = { limit: 10, offset: 0, sortBy: 'id', order: 'asc' as const };
function reply(name = 'Old') {
  return new Response(JSON.stringify([{ id: 1, name }]));
}
it('an explicit refresh bypasses a fresh cache entry', async () => {
  let n = 0;
  const f = vi.fn(async () => reply(++n === 1 ? 'Old' : 'New'));
  const client = createMemtimeClient(createTransport({ key: 'key', fetchImpl: f }));
  await client.list('/clients', params);
  const refreshed = await client.list('/clients', params, true);
  expect(refreshed.items[0]).toMatchObject({ name: 'New' });
  expect(f).toHaveBeenCalledTimes(2);
});
it('simultaneous explicit refreshes share one upstream dispatch', async () => {
  let release!: (r: Response) => void;
  const f = vi.fn(
    async () =>
      new Promise<Response>((r) => {
        release = r;
      }),
  );
  const client = createMemtimeClient(createTransport({ key: 'key', fetchImpl: f }));
  const a = client.list('/clients', params, true),
    b = client.list('/clients', params, true);
  release(reply());
  await Promise.all([a, b]);
  expect(f).toHaveBeenCalledOnce();
});
it('refresh still passes through the shared request limiter', async () => {
  const limiter = new RateLimiter(Date.now, 1);
  const f = vi.fn(async () => reply());
  const client = createMemtimeClient(createTransport({ key: 'key', fetchImpl: f, limiter }));
  await client.list('/clients', params);
  await expect(client.list('/clients', params, true)).rejects.toMatchObject({ status: 429 });
  expect(f).toHaveBeenCalledOnce();
});
it('invalid shapes never poison the shared cache', async () => {
  let n = 0;
  const f = vi.fn(async () => (++n === 1 ? new Response('{"unexpected":[]}') : reply('Valid')));
  const client = createMemtimeClient(createTransport({ key: 'key', fetchImpl: f }));
  await expect(client.list('/clients', params)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  expect((await client.list('/clients', params)).items[0]).toMatchObject({ name: 'Valid' });
  expect(f).toHaveBeenCalledTimes(2);
});
it('transport cache retains only sanitized response data', async () => {
  const fixture = {
    id: 1,
    taskId: 101,
    comment: 'Work',
    start: '2026-10-23T08:00:00Z',
    end: '2026-10-23T09:00:00Z',
    createdAt: '2026-10-23T09:00:00Z',
    userId: 'secret',
  };
  const transport = createTransport({
    key: 'key',
    fetchImpl: vi.fn(async () => new Response(JSON.stringify([fixture]))),
  });
  const first = await transport('/time-entries', 'GET', params),
    second = await transport('/time-entries', 'GET', params);
  expect(first).toEqual(second);
  expect(JSON.stringify(second)).not.toContain('secret');
});
it('a refresh cannot be overwritten by an older in-flight read', async () => {
  let release!: (r: Response) => void,
    n = 0;
  const f = vi.fn(async () =>
    ++n === 1
      ? new Promise<Response>((r) => {
          release = r;
        })
      : reply('Fresh'),
  );
  const client = createMemtimeClient(createTransport({ key: 'key', fetchImpl: f }));
  const old = client.list('/clients', params);
  await client.list('/clients', params, true);
  release(reply('Stale'));
  await old;
  expect((await client.list('/clients', params)).items[0]).toMatchObject({ name: 'Fresh' });
  expect(f).toHaveBeenCalledTimes(2);
});

it('accepts live-style task responses that omit the documented parent field', async () => {
  const client = createMemtimeClient(async () => [
    { id: 101, projectId: 11, name: 'Task without parent' },
  ]);
  const page = await client.list('/projects/11/tasks', params);
  expect(page.items[0]).toMatchObject({ id: 101, name: 'Task without parent', parent: 0 });
  expect(page.items[0]).not.toHaveProperty('projectId');
});
