import { useState } from 'react';
import type { TaskOption } from '../taskOptions';
export function TaskPicker({
  options,
  value,
  onChange,
}: {
  options: TaskOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const matches = options.filter((t) => t.label.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="task-picker">
      <label htmlFor="task-search">Search loaded tasks</label>
      <input
        id="task-search"
        type="search"
        value={search}
        placeholder="Client, project or task name"
        onChange={(e) => setSearch(e.target.value)}
      />
      <label htmlFor="task-choice" className="sr-only">
        Choose loaded task
      </label>
      <select
        id="task-choice"
        value={matches.some((t) => String(t.id) === value) ? value : ''}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
      >
        <option value="">
          {options.length ? 'Choose a task…' : 'Open a project in the directory to load tasks'}
        </option>
        {matches.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      <p className="hint">
        Search covers {options.length} loaded tasks. You can also enter a task ID below.
      </p>
    </div>
  );
}
