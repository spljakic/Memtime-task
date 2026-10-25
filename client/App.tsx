import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Entry, Task } from '../shared/contracts';
import { request } from './api';
import { Hierarchy } from './features/Hierarchy';
import { TimeEntries } from './features/TimeEntries';
import { EntryEditor } from './features/EntryEditor';
import { useTaskOptions } from './taskOptions';
import { entryDuration, formatDuration } from './entrySummary';
export function App() {
  const [task, setTask] = useState<Task | null>(null),
    [editor, setEditor] = useState<{ entry: Entry | null } | null>(null),
    [notice, setNotice] = useState(''),
    [saved, setSaved] = useState<Entry | null>(null);
  const tasks = useTaskOptions();
  const config = useQuery({
    queryKey: ['config'],
    queryFn: () => request<{ demo: boolean }>('/config'),
    staleTime: Infinity,
  });
  const context = task
    ? (tasks.find((t) => t.id === task.id)?.label ?? `${task.name} · #${task.id}`)
    : null;
  return (
    <>
      <header>
        <a className="brand" href="/" aria-label="Memtime workspace">
          <img src="/memtime-mark.svg" alt="" width="38" height="38" />
          memtime<span className="brand-sub"> / integrations workspace</span>
        </a>
        <span className={`badge ${config.data?.demo ? 'demo' : 'live'}`}>
          <span className="status-dot" />
          {config.isError
            ? 'Connection unavailable'
            : config.data
              ? config.data.demo
                ? 'DEMO · resets on restart'
                : 'LIVE API'
              : 'Connecting…'}
        </span>
      </header>
      <main>
        <div className="intro">
          <div>
            <p className="eyebrow">LESS ADMIN. MORE FOCUS.</p>
            <h1>Your time, connected.</h1>
            <p>A clear path from your projects to accurate time entries.</p>
          </div>
          <button className="primary new-entry" onClick={() => setEditor({ entry: null })}>
            + New time entry
          </button>
        </div>
        <div className="workspace-context">
          <span className="context-icon" aria-hidden="true">
            ↳
          </span>
          <div>
            <span className="context-label">CURRENT WORKSPACE</span>
            <p>{context ?? 'All clients and projects'}</p>
          </div>
          {task && <button onClick={() => setTask(null)}>Clear selection</button>}
        </div>
        <div role="status" aria-live="polite" className={notice ? 'success' : ''}>
          {notice}
          {saved && (
            <div className="saved-details">
              <span>
                {tasks.find((t) => t.id === saved.taskId)?.label ?? `Task #${saved.taskId}`}
              </span>
              <strong>{formatDuration(entryDuration(saved))}</strong>
              <button onClick={() => setEditor({ entry: saved })}>Edit saved entry</button>
              <button
                onClick={() => {
                  const selected = tasks.find((t) => t.id === saved.taskId);
                  setTask(
                    selected ?? { id: saved.taskId, name: `Task #${saved.taskId}`, parent: 0 },
                  );
                  setEditor({ entry: null });
                }}
              >
                Add another entry
              </button>
              <button
                aria-label="Dismiss saved confirmation"
                onClick={() => {
                  setSaved(null);
                  setNotice('');
                }}
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
        <div className="workspace">
          <Hierarchy selected={task?.id ?? null} onSelect={setTask} />
          <TimeEntries
            task={task}
            onClearTask={() => setTask(null)}
            onEdit={(entry) => setEditor({ entry })}
          />
        </div>
        <footer>
          <span>Dates are shown in your device timezone.</span>
          <span>
            {config.data?.demo ? 'Demo changes are temporary.' : 'Connected to the interview API.'}
          </span>
        </footer>
      </main>
      {editor && (
        <EntryEditor
          entry={editor.entry}
          task={task}
          options={tasks}
          onClose={() => setEditor(null)}
          onSaved={setNotice}
          onResult={setSaved}
        />
      )}
    </>
  );
}
