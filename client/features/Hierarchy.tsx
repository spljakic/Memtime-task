import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { Client, Project, Task } from '../../shared/contracts';
import { getPage } from '../api';
import { ErrorNotice } from '../components';
import { buildTaskForest, type TaskNode } from './taskForest';
interface Props {
  selected: number | null;
  onSelect: (task: Task) => void;
}
function useCollection<T>(path: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['hierarchy', path],
    initialPageParam: 0,
    enabled,
    queryFn: ({ pageParam, signal }) => getPage<T>(path, pageParam, 10, signal),
    getNextPageParam: (page) => (page.mayHaveMore ? page.offset + page.items.length : undefined),
    staleTime: 5 * 60_000,
  });
}
function CollectionState({ query }: { query: ReturnType<typeof useCollection> }) {
  return (
    <>
      {query.isPending && (
        <p role="status" className="muted">
          Loading…
        </p>
      )}
      {query.isError && (
        <ErrorNotice
          error={query.error}
          onRetry={() => {
            void (query.data ? query.fetchNextPage() : query.refetch());
          }}
        />
      )}
      {query.data && !query.data.pages.some((p) => p.items.length) && (
        <p className="muted">Nothing here yet.</p>
      )}
      {query.hasNextPage && (
        <button
          className="load-more"
          disabled={query.isFetching}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetching ? 'Loading…' : 'Load more'}
        </button>
      )}
    </>
  );
}
function Tasks({ projectId, selected, onSelect }: Props & { projectId: number }) {
  const q = useCollection<Task>(`/projects/${projectId}/tasks`);
  const tasks = [
    ...new Map(q.data?.pages.flatMap((p) => p.items).map((t) => [t.id, t]) ?? []).values(),
  ];
  function render(nodes: TaskNode[], depth = 0): React.ReactNode {
    return (
      <ul className="task-list">
        {nodes.map((n) => (
          <li key={n.task.id}>
            <button
              className={`task ${selected === n.task.id ? 'selected' : ''}`}
              aria-pressed={selected === n.task.id}
              onClick={() => onSelect(n.task)}
            >
              {n.task.name}
              <small>
                #{n.task.id}
                {n.warning ? ' · ' + n.warning : ''}
              </small>
            </button>
            {depth < 40
              ? render(n.children, depth + 1)
              : n.children.length > 0 && <p>Further nesting exceeds the display limit.</p>}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <>
      {render(buildTaskForest(tasks))}
      <CollectionState query={q} />
    </>
  );
}
function Projects({ clientId, ...props }: Props & { clientId: number }) {
  const q = useCollection<Project>(`/clients/${clientId}/projects`);
  return (
    <>
      {q.data?.pages
        .flatMap((p) => p.items)
        .map((project) => (
          <Branch key={project.id} label={project.name}>
            <Tasks projectId={project.id} {...props} />
          </Branch>
        ))}
      <CollectionState query={q} />
    </>
  );
}
function Branch({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false),
    [visited, setVisited] = useState(false);
  return (
    <details
      open={open}
      onToggle={(e) => {
        const isOpen = e.currentTarget.open;
        setOpen(isOpen);
        if (isOpen) setVisited(true);
      }}
    >
      <summary>{label}</summary>
      <div>{visited && children}</div>
    </details>
  );
}
export function Hierarchy(props: Props) {
  const q = useCollection<Client>('/clients');
  return (
    <aside className="card">
      <div className="card-heading">
        <div>
          <p className="eyebrow">PROJECT DIRECTORY</p>
          <h2>Clients & tasks</h2>
        </div>
      </div>
      <p className="hint">Expand a project, then select a task to record time.</p>
      {q.data?.pages
        .flatMap((p) => p.items)
        .map((client) => (
          <Branch key={client.id} label={client.name}>
            <Projects clientId={client.id} {...props} />
          </Branch>
        ))}
      <CollectionState query={q} />
    </aside>
  );
}
