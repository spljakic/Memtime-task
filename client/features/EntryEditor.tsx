import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { entryInputSchema, type Entry, type Task } from '../../shared/contracts';
import { ApiError, saveEntry } from '../api';
import { durationLabel, localInput, localCandidates, resolveLocal } from '../dateTime';
import { ErrorNotice } from '../components';
import { TaskPicker } from './TaskPicker';
import type { TaskOption } from '../taskOptions';
export function EntryEditor({
  entry,
  task,
  onClose,
  onSaved,
  options = [],
  onResult,
}: {
  entry: Entry | null;
  task: Task | null;
  onClose: () => void;
  onSaved: (message: string) => void;
  options?: TaskOption[];
  onResult?: (entry: Entry) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    previousFocus = useRef<HTMLElement | null>(null),
    queryClient = useQueryClient();
  const [draft, setDraft] = useState(() => {
    const now = new Date();
    return {
      taskId: String(entry?.taskId ?? task?.id ?? ''),
      comment: entry?.comment ?? '',
      start: localInput(entry?.start ?? new Date(now.getTime() - 3600000)),
      end: localInput(entry?.end ?? now),
    };
  });
  const initial = useRef(draft),
    [choices, setChoices] = useState({ start: '', end: '' }),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState<unknown>(null),
    [uncertain, setUncertain] = useState(false),
    [checking, setChecking] = useState(false);
  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof saveEntry>[0]) => saveEntry(input, entry?.id),
    retry: false,
  });
  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement;
    dialog.current?.showModal();
    return () => {
      dialog.current?.close();
      previousFocus.current?.focus();
    };
  }, []);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty || mutation.isPending) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, mutation.isPending]);
  function close() {
    if (mutation.isPending || checking) return;
    if (dirty && !window.confirm('Discard your unsaved changes?')) return;
    onClose();
  }
  function update(field: keyof typeof draft, value: string) {
    setDraft((d) => ({ ...d, [field]: value }));
    setDirty(true);
    if (field === 'start' || field === 'end') setChoices((c) => ({ ...c, [field]: '' }));
  }
  function instant(field: 'start' | 'end') {
    if (entry && draft[field] === initial.current[field] && !choices[field]) return entry[field];
    return resolveLocal(draft[field], choices[field]);
  }
  let duration = 'Choose a valid interval.';
  try {
    duration = durationLabel(instant('start'), instant('end'));
  } catch (e) {
    duration = (e as Error).message;
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mutation.isPending || uncertain) return;
    setError(null);
    try {
      const payload = entryInputSchema.safeParse({
        taskId: Number(draft.taskId),
        comment: draft.comment,
        start: instant('start'),
        end: instant('end'),
      });
      if (!payload.success) {
        const fields: Record<string, string> = {};
        payload.error.issues.forEach((i) => {
          fields[i.path.join('.')] = i.message;
        });
        throw new ApiError({
          code: 'VALIDATION',
          message: 'Please check the entry values.',
          fields,
        });
      }
      const saved = await mutation.mutateAsync(payload.data);
      // Clear scan pages instead of refetching every accumulated page after a mutation.
      queryClient.removeQueries({ queryKey: ['entries', 'scan'] });
      await queryClient.invalidateQueries({ queryKey: ['entries'], refetchType: 'none' });
      setDirty(false);
      onSaved(`${entry ? 'Updated' : 'Created'} entry #${saved.id}: ${saved.comment}`);
      onResult?.(saved);
      onClose();
      void queryClient.refetchQueries({ queryKey: ['entries'], type: 'active' });
    } catch (e) {
      setError(e);
      if (e instanceof ApiError && e.details.code === 'OUTCOME_UNKNOWN') setUncertain(true);
    }
  }
  async function refreshForVerification() {
    setChecking(true);
    await queryClient.resetQueries({ queryKey: ['entries'] });
    setChecking(false);
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby="editor-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <form onSubmit={submit}>
        <div className="card-heading">
          <div>
            <p className="eyebrow">MAKE TIME COUNT</p>
            <h2 id="editor-title">{entry ? `Edit entry #${entry.id}` : 'New time entry'}</h2>
          </div>
          <button
            type="button"
            aria-label="Close editor"
            disabled={mutation.isPending || checking}
            onClick={close}
          >
            ✕
          </button>
        </div>
        <p className="hint">
          {task && String(task.id) === draft.taskId
            ? task.name
            : 'Choose a task in the directory or enter its ID.'}
        </p>
        <fieldset disabled={mutation.isPending || checking}>
          <TaskPicker
            options={options}
            value={draft.taskId}
            onChange={(value) => update('taskId', value)}
          />
          <label htmlFor="task-id">Task ID</label>
          <input
            id="task-id"
            type="number"
            min="1"
            step="1"
            required
            value={draft.taskId}
            onChange={(e) => update('taskId', e.target.value)}
          />
          <label htmlFor="comment">What did you work on?</label>
          <textarea
            id="comment"
            required
            rows={3}
            value={draft.comment}
            placeholder="A short description of your work"
            onChange={(e) => update('comment', e.target.value)}
          />
          <div className="date-grid">
            {(['start', 'end'] as const).map((field) => {
              const candidates = localCandidates(draft[field]);
              return (
                <div key={field}>
                  <label htmlFor={field}>{field === 'start' ? 'Start' : 'End'}</label>
                  <input
                    id={field}
                    type="datetime-local"
                    step="0.001"
                    required
                    value={draft[field]}
                    onChange={(e) => update(field, e.target.value)}
                  />
                  {candidates.length > 1 && (
                    <>
                      <label htmlFor={`${field}-offset`}>UTC offset for repeated local time</label>
                      <select
                        id={`${field}-offset`}
                        value={
                          choices[field] ||
                          (entry && draft[field] === initial.current[field]
                            ? candidates.find((c) => Date.parse(c.iso) === Date.parse(entry[field]))
                                ?.iso
                            : '') ||
                          ''
                        }
                        onChange={(e) => {
                          setChoices((c) => ({ ...c, [field]: e.target.value }));
                          setDirty(true);
                        }}
                      >
                        <option value="">Choose offset</option>
                        {candidates.map((c) => (
                          <option key={c.iso} value={c.iso}>
                            UTC{c.offset}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <p className="hint">Duration: {duration}</p>
          <p className="hint">
            Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Use the following date for
            overnight work.
          </p>
        </fieldset>
        {error !== null && <ErrorNotice error={error} />}{' '}
        {uncertain && (
          <div className="warning">
            <p>
              Your draft is preserved. Close this editor and check the refreshed table before
              attempting another save.
            </p>
            <button type="button" disabled={checking} onClick={() => void refreshForVerification()}>
              {checking ? 'Refreshing…' : 'Refresh list for verification'}
            </button>
            <label>
              <input
                type="checkbox"
                onChange={(e) => {
                  if (
                    e.target.checked &&
                    window.confirm(
                      'Have you checked the entries and confirmed this change was not saved?',
                    )
                  ) {
                    setUncertain(false);
                    setError(null);
                  }
                }}
              />{' '}
              I checked; this change was not saved.
            </label>
          </div>
        )}
        <div className="form-actions">
          <button type="button" disabled={mutation.isPending || checking} onClick={close}>
            Cancel
          </button>
          <button
            className="primary"
            type="submit"
            disabled={mutation.isPending || uncertain || checking}
          >
            {mutation.isPending ? 'Saving…' : 'Save entry'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
