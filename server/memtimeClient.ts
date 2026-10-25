import { z } from 'zod';
import {
  clientSchema,
  projectSchema,
  taskSchema,
  entrySchema,
  type PageParams,
  type EntryInput,
} from '../shared/contracts';
import { AppError } from './errors';
import { RateLimiter, retryDelay } from './rateLimiter';
export type Transport = (
  path: string,
  method: string,
  params?: PageParams,
  input?: EntryInput,
  fresh?: boolean,
) => Promise<unknown>;
export function createTransport({
  key,
  fetchImpl = fetch,
  limiter = new RateLimiter(),
  now = Date.now,
}: {
  key: string;
  fetchImpl?: typeof fetch;
  limiter?: RateLimiter;
  now?: () => number;
}): Transport {
  const cache = new Map<string, { until: number; value: unknown }>();
  const pending = new Map<string, Promise<unknown>>();
  let generation = 0;
  const refreshing = new Set<string>();
  return async (path, method, params, input, fresh = false) => {
    const url = new URL('https://interview-api.memtime-demo.deno.net/api/v1' + path);
    if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    const id = url.href;
    if (method === 'GET' && fresh && !refreshing.has(id)) {
      generation++;
      cache.delete(id);
      pending.delete(id);
    }
    const epoch = generation;
    if (method === 'GET') {
      const hit = cache.get(id);
      if (hit && hit.until > now()) return hit.value;
      const inflight = pending.get(id);
      if (inflight) return inflight;
    } else {
      // Isolate reads started during a write from pre-write reads.
      generation++;
      cache.clear();
      pending.clear();
    }
    const operation = (async () => {
      limiter.acquire();
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method,
          headers: {
            Authorization: `Bearer ${key}`,
            Accept: 'application/json',
            ...(input ? { 'Content-Type': 'application/json' } : {}),
          },
          body: input ? JSON.stringify(input) : undefined,
          signal: AbortSignal.timeout(20_000),
          redirect: 'error',
        });
      } catch {
        throw new AppError(
          502,
          method === 'GET' ? 'UPSTREAM' : 'OUTCOME_UNKNOWN',
          method === 'GET'
            ? 'The external API could not be reached. Please retry.'
            : 'The save outcome is unknown. Refresh the entries before submitting again.',
        );
      }
      if (response.status === 429) {
        const delay = retryDelay(response.headers.get('retry-after'), now());
        limiter.cooldown(delay);
        throw new AppError(
          429,
          'RATE_LIMITED',
          'The external API request limit was reached.',
          delay,
        );
      }
      if (!response.ok) {
        const s = response.status;
        const code =
          s === 400
            ? 'VALIDATION'
            : s === 404
              ? 'NOT_FOUND'
              : s === 401 || s === 403
                ? 'AUTHENTICATION'
                : method === 'GET'
                  ? 'UPSTREAM'
                  : 'OUTCOME_UNKNOWN';
        const message =
          s === 400
            ? 'The API rejected the request. Check the task ID and time interval.'
            : s === 404
              ? 'The requested resource is unavailable or no longer exists.'
              : s === 401 || s === 403
                ? 'The API credentials were rejected.'
                : method === 'GET'
                  ? 'The external API is temporarily unavailable.'
                  : 'The external API could not confirm the save. Refresh before submitting again.';
        throw new AppError([400, 401, 403, 404, 429].includes(s) ? s : 502, code, message);
      }
      let value: unknown;
      try {
        value = await response.json();
      } catch {
        throw new AppError(
          502,
          method === 'GET' ? 'INVALID_RESPONSE' : 'OUTCOME_UNKNOWN',
          method === 'GET'
            ? 'The API returned invalid JSON.'
            : 'The API accepted the request but its response could not be read. Check entries before resubmitting.',
        );
      }
      // Validate and sanitize before retaining anything in the shared read cache.
      const schema =
        path === '/time-entries' || path.startsWith('/time-entries/')
          ? entrySchema
          : path === '/clients'
            ? clientSchema
            : path.endsWith('/tasks')
              ? taskSchema
              : projectSchema;
      const parsed = (method === 'GET' ? z.array(schema) : entrySchema).safeParse(value);
      if (!parsed.success)
        throw new AppError(
          502,
          method === 'GET' ? 'INVALID_RESPONSE' : 'OUTCOME_UNKNOWN',
          method === 'GET'
            ? 'The API response did not match its documented contract.'
            : 'The save response could not be validated. Check entries before resubmitting.',
        );
      value = parsed.data;
      if (method === 'GET' && epoch === generation) {
        if (cache.size >= 200) cache.delete(cache.keys().next().value!);
        cache.set(id, { value, until: now() + (path === '/time-entries' ? 15_000 : 60_000) });
      }
      return value;
    })();
    if (method === 'GET') {
      pending.set(id, operation);
      if (fresh) refreshing.add(id);
    }
    try {
      return await operation;
    } finally {
      if (method === 'GET' && pending.get(id) === operation) {
        pending.delete(id);
        refreshing.delete(id);
      }
      if (method !== 'GET') {
        generation++;
        cache.clear();
        pending.clear();
      }
    }
  };
}
export function createMemtimeClient(transport: Transport) {
  async function list(path: string, params: PageParams, fresh = false) {
    const raw = await transport(path, 'GET', params, undefined, fresh);
    const schema =
      path === '/time-entries'
        ? entrySchema
        : path === '/clients'
          ? clientSchema
          : path.endsWith('/tasks')
            ? taskSchema
            : projectSchema;
    const result = z.array(schema).safeParse(raw);
    if (!result.success)
      throw new AppError(
        502,
        'INVALID_RESPONSE',
        'The API response did not match the documented collection format.',
      );
    return {
      items: result.data,
      offset: params.offset,
      limit: params.limit,
      mayHaveMore: result.data.length === params.limit,
    };
  }
  async function save(input: EntryInput, id?: number) {
    const raw = await transport(
      id ? `/time-entries/${id}` : '/time-entries',
      id ? 'PUT' : 'POST',
      undefined,
      input,
    );
    const result = entrySchema.safeParse(raw);
    if (!result.success)
      throw new AppError(
        502,
        'OUTCOME_UNKNOWN',
        'A save response was received but could not be validated. Check entries before resubmitting.',
      );
    return result.data;
  }
  return { list, save };
}
export type MemtimeClient = ReturnType<typeof createMemtimeClient>;
