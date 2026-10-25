// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EntryEditor } from '../client/features/EntryEditor';
const fixture = {
  id: 77,
  taskId: 101,
  comment: 'Existing work',
  start: '2026-10-23T08:00:00.123Z',
  end: '2026-10-23T09:00:00.456Z',
  createdAt: '2026-10-23T09:01:00Z',
};
function setup(entry: typeof fixture | null = null) {
  const onSaved = vi.fn(),
    onClose = vi.fn();
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <EntryEditor
        entry={entry}
        task={{ id: 101, name: 'Discovery', parent: 0 }}
        onClose={onClose}
        onSaved={onSaved}
      />
    </QueryClientProvider>,
  );
  return { onSaved, onClose };
}
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
beforeEach(() => {
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe('entry editor', () => {
  it('creates one entry while a submission is pending', async () => {
    let release!: (r: Response) => void;
    const fetchMock = vi.fn(
      (_url: unknown, _init?: RequestInit) =>
        new Promise<Response>((r) => {
          release = r;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { onSaved } = setup();
    fireEvent.change(screen.getByLabelText('What did you work on?'), {
      target: { value: 'Workshop' },
    });
    const save = screen.getByRole('button', { name: 'Save entry' });
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    release(new Response(JSON.stringify({ ...fixture, comment: 'Workshop' })));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.stringContaining('#77')));
  });
  it('updates with PUT and preserves unchanged timestamp precision', async () => {
    const fetchMock = vi.fn(
      async (_url: unknown, _init?: RequestInit) => new Response(JSON.stringify(fixture)),
    );
    vi.stubGlobal('fetch', fetchMock);
    setup(fixture);
    fireEvent.change(screen.getByLabelText('What did you work on?'), {
      target: { value: 'Revised' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save entry' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/time-entries/77');
    expect(options?.method).toBe('PUT');
    expect(JSON.parse(options?.body as string)).toMatchObject({
      start: fixture.start,
      end: fixture.end,
      comment: 'Revised',
    });
  });
  it('keeps a draft after a missing-resource response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ code: 'NOT_FOUND', message: 'Entry no longer exists.' }), {
            status: 404,
          }),
      ),
    );
    const { onClose } = setup(fixture);
    fireEvent.change(screen.getByLabelText('What did you work on?'), {
      target: { value: 'Keep this draft' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save entry' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('no longer exists');
    expect(screen.getByLabelText('What did you work on?')).toHaveValue('Keep this draft');
    expect(onClose).not.toHaveBeenCalled();
  });
  it('blocks blind resubmission after an uncertain outcome', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network');
      }),
    );
    setup(fixture);
    fireEvent.click(screen.getByRole('button', { name: 'Save entry' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('outcome is unknown');
    expect(screen.getByRole('button', { name: 'Save entry' })).toBeDisabled();
    expect(screen.getByLabelText('What did you work on?')).toHaveValue('Existing work');
  });
});
