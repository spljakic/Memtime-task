import type { ErrorBody, Page, EntryInput, Entry } from '../shared/contracts';
export class ApiError extends Error {
  constructor(public details: ErrorBody) {
    super(details.message);
  }
}
let blockedUntil = 0;
export async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal; fresh?: boolean } = {},
): Promise<T> {
  const method = options.method ?? 'GET',
    wait = Math.ceil((blockedUntil - Date.now()) / 1000);
  if (wait > 0)
    throw new ApiError({
      code: 'RATE_LIMITED',
      message: 'Request limit reached.',
      retryAfter: wait,
    });
  let response: Response;
  try {
    response = await fetch('/api' + path, {
      method,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.fresh ? { 'Cache-Control': 'no-cache' } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(30_000)])
        : AbortSignal.timeout(30_000),
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError({
      code: method === 'GET' ? 'UPSTREAM' : 'OUTCOME_UNKNOWN',
      message:
        method === 'GET'
          ? 'Connection failed. Please retry.'
          : 'The save outcome is unknown. Refresh the list before submitting again.',
    });
  }
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new ApiError({
      code: method === 'GET' ? 'INVALID_RESPONSE' : 'OUTCOME_UNKNOWN',
      message:
        method === 'GET'
          ? 'The application returned an unreadable response.'
          : 'The save response could not be read. Check the list before resubmitting.',
    });
  }
  if (!response.ok) {
    const details = value as ErrorBody;
    if (details.code === 'RATE_LIMITED')
      blockedUntil = Date.now() + (details.retryAfter ?? 60) * 1000;
    throw new ApiError(details);
  }
  return value as T;
}
export function getPage<T>(
  path: string,
  offset = 0,
  limit = 10,
  signal?: AbortSignal,
  fresh = false,
) {
  return request<Page<T>>(`${path}?limit=${limit}&offset=${offset}&sortBy=id&order=asc`, {
    signal,
    fresh,
  });
}
export function saveEntry(input: EntryInput, id?: number) {
  return request<Entry>(id ? `/time-entries/${id}` : '/time-entries', {
    method: id ? 'PUT' : 'POST',
    body: input,
  });
}
