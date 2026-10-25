import type { Entry } from '../shared/contracts';
import type { Transport } from './memtimeClient';
import { AppError } from './errors';
export function createDemoTransport(): Transport {
  const clients = [
    { id: 1, name: 'Northstar Studio' },
    { id: 2, name: 'Acme Digital' },
    { id: 3, name: 'Internal' },
  ];
  const projects = [
    { id: 11, clientId: 1, name: 'Brand platform' },
    { id: 12, clientId: 1, name: 'Customer portal' },
    { id: 21, clientId: 2, name: 'Website launch' },
    { id: 31, clientId: 3, name: 'Operations' },
  ];
  const tasks = [
    { id: 101, projectId: 11, name: 'Discovery', parent: 0 },
    { id: 102, projectId: 11, name: 'Customer interviews', parent: 101 },
    { id: 103, projectId: 11, name: 'Design system', parent: 0 },
    { id: 104, projectId: 12, name: 'API integration', parent: 0 },
    { id: 201, projectId: 21, name: 'Frontend development', parent: 0 },
    { id: 301, projectId: 31, name: 'Planning', parent: 0 },
  ];
  const entries: Entry[] = Array.from({ length: 64 }, (_, i) => ({
    id: i + 1,
    taskId: [101, 102, 103, 104, 201, 301][i % 6],
    comment: [
      'Discovery workshop',
      'Customer interview synthesis',
      'Component library',
      'Integration review',
    ][i % 4],
    start: new Date(Date.UTC(2026, 9, 23 - i, 8)).toISOString(),
    end: new Date(Date.UTC(2026, 9, 23 - i, 9, 30)).toISOString(),
    createdAt: new Date(Date.UTC(2026, 9, 23 - i, 9, 31)).toISOString(),
  }));
  return async (path, method, params, input) => {
    if (method === 'GET') {
      const c = path.match(/^\/clients\/(\d+)\/projects$/),
        p = path.match(/^\/projects\/(\d+)\/tasks$/);
      if (
        (c && !clients.some((x) => x.id === Number(c[1]))) ||
        (p && !projects.some((x) => x.id === Number(p[1])))
      )
        throw new AppError(404, 'NOT_FOUND', 'Resource not found.');
      const rows =
        path === '/clients'
          ? clients
          : path === '/time-entries'
            ? entries
            : c
              ? projects.filter((x) => x.clientId === Number(c[1]))
              : p
                ? tasks.filter((x) => x.projectId === Number(p[1]))
                : [];
      const { offset = 0, limit = 10, sortBy = 'id', order = 'asc' } = params ?? {};
      return [...rows]
        .sort((a, b) => {
          const x = (a as unknown as Record<string, unknown>)[sortBy],
            y = (b as unknown as Record<string, unknown>)[sortBy];
          return (
            (typeof x === 'number' && typeof y === 'number'
              ? x - y
              : String(x).localeCompare(String(y))) * (order === 'desc' ? -1 : 1)
          );
        })
        .slice(offset, offset + limit);
    }
    if (!input) throw new AppError(400, 'VALIDATION', 'Entry body is required.');
    if (!tasks.some((t) => t.id === input.taskId))
      throw new AppError(400, 'VALIDATION', 'Task does not exist in demo data.');
    const now = new Date().toISOString();
    if (method === 'POST') {
      const entry = {
        ...input,
        id: Math.max(...entries.map((x) => x.id)) + 1,
        createdAt: now,
        updatedAt: now,
      };
      entries.push(entry);
      return entry;
    }
    const id = Number(path.split('/').at(-1)),
      index = entries.findIndex((e) => e.id === id);
    if (index < 0) throw new AppError(404, 'NOT_FOUND', 'Time entry no longer exists.');
    entries[index] = { ...entries[index], ...input, updatedAt: now };
    return entries[index];
  };
}
