import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Page, Client, Project, Task } from '../shared/contracts';
export interface TaskOption extends Task {
  label: string;
}
export function useTaskOptions(): TaskOption[] {
  const queryClient = useQueryClient();
  function collect() {
    const clients = new Map<number, string>(),
      projects = new Map<number, { name: string; clientId: number }>(),
      tasks: TaskOption[] = [];
    for (const query of queryClient.getQueryCache().findAll({ queryKey: ['hierarchy'] })) {
      const path = String(query.queryKey[1]);
      const pages =
        (query.state.data as { pages: Page<Client | Project | Task>[] } | undefined)?.pages ?? [];
      if (path === '/clients')
        for (const p of pages) for (const c of p.items) clients.set(c.id, c.name);
      if (/^\/clients\/\d+\/projects$/.test(path))
        for (const p of pages)
          for (const item of p.items) {
            const project = item as Project;
            projects.set(project.id, { name: project.name, clientId: project.clientId });
          }
    }
    for (const query of queryClient.getQueryCache().findAll({ queryKey: ['hierarchy'] })) {
      const match = String(query.queryKey[1]).match(/^\/projects\/(\d+)\/tasks$/);
      if (!match) continue;
      const project = projects.get(Number(match[1]));
      const pages = (query.state.data as { pages: Page<Task>[] } | undefined)?.pages ?? [];
      for (const page of pages)
        for (const task of page.items)
          tasks.push({
            ...task,
            label: `${clients.get(project?.clientId ?? 0) ?? 'Client'} / ${project?.name ?? 'Project'} / ${task.name} · #${task.id}`,
          });
    }
    return [...new Map(tasks.map((task) => [task.id, task])).values()].sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }
  const [options, setOptions] = useState(collect);
  useEffect(
    () =>
      queryClient.getQueryCache().subscribe(() => {
        const next = collect();
        setOptions((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next));
      }),
    [queryClient],
  );
  return options;
}
