import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { localInput, localCandidates, resolveLocal, durationLabel } from '../client/dateTime';
import { buildTaskForest } from '../client/features/taskForest';
import { entryInputSchema } from '../shared/contracts';
describe('task forest', () => {
  it('connects children regardless of page order', () => {
    const roots = buildTaskForest([
      { id: 2, name: 'Child', parent: 1 },
      { id: 1, name: 'Root', parent: 0 },
    ]);
    expect(roots).toHaveLength(1);
    expect(roots[0].children[0].task.id).toBe(2);
  });
  it('retains missing-parent tasks and deduplicates records', () => {
    const task = { id: 2, name: 'Orphan', parent: 99 };
    const roots = buildTaskForest([task, task]);
    expect(roots).toHaveLength(1);
    expect(roots[0].warning).toContain('not loaded');
  });
  it('keeps cyclic and self-parented tasks visible', () => {
    const roots = buildTaskForest([
      { id: 1, name: 'A', parent: 2 },
      { id: 2, name: 'B', parent: 1 },
      { id: 3, name: 'C', parent: 3 },
    ]);
    expect(roots).toHaveLength(3);
    expect(roots.every((n) => n.warning)).toBe(true);
  });
});
describe('dates in Europe/Sarajevo', () => {
  const old = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'Europe/Sarajevo';
  });
  afterAll(() => {
    process.env.TZ = old;
  });
  it('round trips milliseconds and supports overnight intervals', () => {
    const iso = '2026-10-23T22:00:00.123Z';
    expect(resolveLocal(localInput(iso))).toBe(iso);
    expect(durationLabel(iso, '2026-10-24T01:30:00.123Z')).toBe('3h 30m');
  });
  it('rejects impossible calendar dates', () => {
    expect(localCandidates('2026-02-30T12:00')).toHaveLength(0);
  });
  it('rejects a nonexistent spring DST wall time', () => {
    expect(localCandidates('2026-03-29T02:30')).toHaveLength(0);
  });
  it('requires a choice for an autumn repeated hour', () => {
    const c = localCandidates('2026-10-25T02:30');
    expect(c).toHaveLength(2);
    expect(() => resolveLocal('2026-10-25T02:30')).toThrow('twice');
    expect(resolveLocal('2026-10-25T02:30', c[1].iso)).toBe(c[1].iso);
  });
  it('validates timezone-bearing payloads and positive intervals', () => {
    expect(
      entryInputSchema.safeParse({
        taskId: 1,
        comment: 'Work',
        start: '2026-10-23T12:00',
        end: '2026-10-23T13:00',
      }).success,
    ).toBe(false);
  });
});
