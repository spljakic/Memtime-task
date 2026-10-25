import type { Entry } from '../shared/contracts';
export function formatDuration(ms: number) {
  const minutes = Math.round(ms / 60000);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
export function entryDuration(entry: Pick<Entry, 'start' | 'end'>) {
  return Math.max(0, Date.parse(entry.end) - Date.parse(entry.start));
}
export function pageSummary(entries: Entry[]) {
  return {
    count: entries.length,
    duration: formatDuration(entries.reduce((sum, e) => sum + entryDuration(e), 0)),
    taskCount: new Set(entries.map((e) => e.taskId)).size,
  };
}
