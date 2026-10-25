// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Hierarchy } from '../client/features/Hierarchy';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('loads only expanded branches and reuses their query state', async () => {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url);
      const items = url.includes('/projects/11/tasks')
        ? [{ id: 101, name: 'Discovery', parent: 0 }]
        : url.includes('/clients/1/projects')
          ? [{ id: 11, clientId: 1, name: 'Brand platform' }]
          : [{ id: 1, name: 'Northstar Studio' }];
      return new Response(JSON.stringify({ items, limit: 10, offset: 0, mayHaveMore: false }));
    }),
  );
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Hierarchy selected={null} onSelect={vi.fn()} />
    </QueryClientProvider>,
  );
  await screen.findByText('Northstar Studio');
  expect(calls).toHaveLength(1);
  const client = screen.getByText('Northstar Studio').parentElement as HTMLDetailsElement;
  client.open = true;
  fireEvent(client, new Event('toggle'));
  await screen.findByText('Brand platform');
  expect(calls).toHaveLength(2);
  const project = screen.getByText('Brand platform').parentElement as HTMLDetailsElement;
  project.open = true;
  fireEvent(project, new Event('toggle'));
  await screen.findByRole('button', { name: /Discovery/ });
  expect(calls).toHaveLength(3);
  client.open = false;
  fireEvent(client, new Event('toggle'));
  client.open = true;
  fireEvent(client, new Event('toggle'));
  await waitFor(() => expect(screen.getByRole('button', { name: /Discovery/ })).toBeVisible());
  expect(calls).toHaveLength(3);
});

it('makes every client accessible through Load more without replacing earlier records', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const offset = Number(new URL(url, 'http://localhost').searchParams.get('offset'));
      const items =
        offset === 0
          ? Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `Client ${i + 1}` }))
          : [{ id: 11, name: 'Client 11' }];
      return new Response(JSON.stringify({ items, offset, limit: 10, mayHaveMore: offset === 0 }));
    }),
  );
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Hierarchy selected={null} onSelect={vi.fn()} />
    </QueryClientProvider>,
  );
  await screen.findByText('Client 1');
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  await screen.findByText('Client 11');
  expect(screen.getByText('Client 1')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
});
