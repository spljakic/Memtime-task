import { useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Entry, Task } from '../../shared/contracts';
import { getPage } from '../api';
import { ErrorNotice, Pagination } from '../components';
import { entryDuration, formatDuration, pageSummary } from '../entrySummary';
const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
function DateCell({ value }: { value: string }) {
  return (
    <td>
      <time dateTime={value} title={value}>
        {formatter.format(new Date(value))}
      </time>
    </td>
  );
}
function EntryRows({ entries, onEdit }: { entries: Entry[]; onEdit: (entry: Entry) => void }) {
  return (
    <div className="table-scroll">
      <table>
        <caption className="sr-only">Recorded time entries</caption>
        <thead>
          <tr>
            {['ID', 'Task ID', 'Comment', 'Start', 'End', 'Duration', 'Created At', 'Action'].map(
              (h) => (
                <th scope="col" key={h}>
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td>#{e.id}</td>
              <td>{e.taskId}</td>
              <td>{e.comment}</td>
              <DateCell value={e.start} />
              <DateCell value={e.end} />
              <td>
                <span className="duration-pill">{formatDuration(entryDuration(e))}</span>
              </td>
              <DateCell value={e.createdAt} />
              <td>
                <button aria-label={`Edit entry ${e.id}`} onClick={() => onEdit(e)}>
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Summary({ entries }: { entries: Entry[] }) {
  const summary = pageSummary(entries);
  return (
    <div className="page-summary">
      <div>
        <strong>{summary.duration}</strong>
        <span>Time on this page</span>
      </div>
      <div>
        <strong>{summary.count}</strong>
        <span>Entries on this page</span>
      </div>
      <div>
        <strong>{summary.taskCount}</strong>
        <span>Tasks on this page</span>
      </div>
    </div>
  );
}
function AllEntries({ onEdit }: { onEdit: (entry: Entry) => void }) {
  const [page, setPage] = useState(0),
    [size, setSize] = useState(10);
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  async function refresh() {
    setRefreshing(true);
    try {
      const fresh = await getPage<Entry>('/time-entries', page * size, size, undefined, true);
      queryClient.setQueryData(['entries', 'all', size, page], fresh);
    } catch (e) {
      setRefreshError(e);
    } finally {
      setRefreshing(false);
    }
  }
  const [refreshError, setRefreshError] = useState<unknown>(null);
  const q = useQuery({
    queryKey: ['entries', 'all', size, page],
    queryFn: ({ signal }) => getPage<Entry>('/time-entries', page * size, size, signal),
    staleTime: 15_000,
  });
  return (
    <>
      <div className="toolbar">
        <span>All tasks · ordered by ID</span>
        <label htmlFor="page-size">Rows</label>
        <select
          id="page-size"
          value={size}
          onChange={(e) => {
            setSize(Number(e.target.value));
            setPage(0);
          }}
        >
          {[10, 20, 50].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
        <button
          disabled={q.isFetching || refreshing}
          onClick={() => {
            setRefreshError(null);
            void refresh();
          }}
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      {refreshError !== null && <ErrorNotice error={refreshError} onRetry={() => void refresh()} />}
      {q.isPending && <p role="status">Loading time entries…</p>}
      {q.isError && <ErrorNotice error={q.error} onRetry={() => void q.refetch()} />}
      <EntryRows entries={q.data?.items ?? []} onEdit={onEdit} />
      {q.data?.items.length === 0 && <p className="muted">No entries on this page.</p>}
      <Summary entries={q.data?.items ?? []} />
      <Pagination
        page={page}
        count={q.data?.items.length ?? 0}
        busy={q.isFetching}
        hasMore={q.data?.mayHaveMore ?? false}
        onChange={setPage}
      />
    </>
  );
}
function TaskEntries({ task, onEdit }: { task: Task; onEdit: (entry: Entry) => void }) {
  const [page, setPage] = useState(0),
    queryClient = useQueryClient();
  const q = useInfiniteQuery({
    queryKey: ['entries', 'scan'],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      getPage<Entry>('/time-entries', pageParam, 50, signal, true),
    getNextPageParam: (p) => (p.mayHaveMore ? p.offset + p.items.length : undefined),
    staleTime: 15_000,
  });
  const records = [
      ...new Map(q.data?.pages.flatMap((p) => p.items).map((e) => [e.id, e]) ?? []).values(),
    ],
    matches = records.filter((e) => e.taskId === task.id),
    visible = matches.slice(page * 10, page * 10 + 10);
  return (
    <>
      <p className="hint">
        {task.name} · #{task.id}
      </p>
      <p className="scan-status" role="status">
        {matches.length} matches in {records.length} retrieved records.{' '}
        {q.hasNextPage
          ? 'Results are partial. Load more to search further.'
          : q.isSuccess
            ? 'All pages retrieved. Offset pagination may change as records are added.'
            : ''}
      </p>
      <div className="toolbar">
        <button disabled={!q.hasNextPage || q.isFetching} onClick={() => void q.fetchNextPage()}>
          {q.isFetching ? 'Loading…' : 'Search next 50 records'}
        </button>
        <button
          disabled={q.isFetching}
          onClick={() => {
            setPage(0);
            void queryClient.resetQueries({ queryKey: ['entries', 'scan'] });
          }}
        >
          Restart search
        </button>
      </div>
      {q.isError && (
        <ErrorNotice
          error={q.error}
          onRetry={() => void (q.data ? q.fetchNextPage() : q.refetch())}
        />
      )}
      <EntryRows entries={visible} onEdit={onEdit} />
      {q.isSuccess && !visible.length && (
        <p className="muted">
          {q.hasNextPage
            ? 'No matches on this page of retrieved results. Search more records.'
            : 'No entries on this page.'}
        </p>
      )}
      <Summary entries={visible} />
      <Pagination
        page={page}
        count={visible.length}
        busy={q.isFetching}
        hasMore={(page + 1) * 10 < matches.length}
        onChange={setPage}
      />
    </>
  );
}
export function TimeEntries({
  task,
  onEdit,
  onClearTask,
}: {
  task: Task | null;
  onEdit: (entry: Entry) => void;
  onClearTask: () => void;
}) {
  return (
    <section className="card entries">
      <div className="card-heading">
        <div>
          <p className="eyebrow">TIME LOG</p>
          <h2>Your time entries</h2>
        </div>
        {task && <button onClick={onClearTask}>View all tasks</button>}
      </div>
      <p className="hint">Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
      {task ? (
        <TaskEntries key={task.id} task={task} onEdit={onEdit} />
      ) : (
        <AllEntries onEdit={onEdit} />
      )}
    </section>
  );
}
