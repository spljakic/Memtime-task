// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TaskPicker } from '../client/features/TaskPicker';
import { pageSummary, entryDuration } from '../client/entrySummary';
import { TimeEntries } from '../client/features/TimeEntries';
import { EntryEditor } from '../client/features/EntryEditor';
const fixture = {
  id: 77,
  taskId: 101,
  comment: 'Existing work',
  start: '2026-10-23T08:00:00Z',
  end: '2026-10-23T09:30:00Z',
  createdAt: '2026-10-23T09:31:00Z',
};
const options = [
  { id: 101, name: 'Discovery', parent: 0, label: 'Northstar / Brand / Discovery · #101' },
  { id: 201, name: 'Frontend', parent: 0, label: 'Acme / Website / Frontend · #201' },
];
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
it('searches loaded task context and selects the numeric task ID', () => {
  const change = vi.fn();
  render(<TaskPicker options={options} value="" onChange={change} />);
  fireEvent.change(screen.getByLabelText('Search loaded tasks'), { target: { value: 'Acme' } });
  expect(screen.queryByRole('option', { name: /Northstar/ })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Choose loaded task'), { target: { value: '201' } });
  expect(change).toHaveBeenCalledWith('201');
  expect(screen.getByText(/Search covers 2 loaded tasks/)).toBeVisible();
});
it('does not invent a global result when no tasks are loaded', () => {
  render(<TaskPicker options={[]} value="" onChange={vi.fn()} />);
  expect(screen.getByRole('option')).toHaveTextContent('Open a project');
});
it('sums only supplied page records and keeps precise duration arithmetic', () => {
  expect(pageSummary([fixture, { ...fixture, id: 78, taskId: 201 }])).toEqual({
    count: 2,
    duration: '3h 0m',
    taskCount: 2,
  });
  expect(pageSummary([]).duration).toBe('0h 0m');
  expect(entryDuration(fixture)).toBe(5400000);
});
it('refresh sends an explicit no-cache directive without changing pagination', async () => {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ items: [fixture], offset: 0, limit: 10, mayHaveMore: false })),
  );
  vi.stubGlobal('fetch', fetchMock);
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <TimeEntries task={null} onClearTask={vi.fn()} onEdit={vi.fn()} />
    </QueryClientProvider>,
  );
  await screen.findByText('Existing work');
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect((fetchMock.mock.calls as unknown[][])[1][1]).toMatchObject({
    headers: { 'Cache-Control': 'no-cache' },
  });
  expect(screen.getByText('Time on this page')).toBeVisible();
});
it('confirmed save stays successful when the subsequent table refresh fails', async () => {
  let reads = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT')
        return new Response(JSON.stringify({ ...fixture, comment: 'Saved successfully' }));
      if (++reads === 1)
        return new Response(
          JSON.stringify({ items: [fixture], offset: 0, limit: 10, mayHaveMore: false }),
        );
      return new Response(JSON.stringify({ code: 'UPSTREAM', message: 'List refresh failed.' }), {
        status: 502,
      });
    }),
  );
  const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    }),
    onSaved = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <TimeEntries task={null} onClearTask={vi.fn()} onEdit={vi.fn()} />
      <EntryEditor entry={fixture} task={null} onClose={vi.fn()} onSaved={onSaved} />
    </QueryClientProvider>,
  );
  await screen.findByText('Existing work');
  fireEvent.click(screen.getByRole('button', { name: 'Save entry' }));
  await waitFor(() =>
    expect(onSaved).toHaveBeenCalledWith(expect.stringContaining('Updated entry #77')),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent('List refresh failed.');
});
