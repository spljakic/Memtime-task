import type { Task } from '../../shared/contracts';
export interface TaskNode {
  task: Task;
  children: TaskNode[];
  warning?: string;
}
export function buildTaskForest(tasks: Task[]): TaskNode[] {
  const nodes = new Map(tasks.map((task) => [task.id, { task, children: [] } as TaskNode])),
    roots: TaskNode[] = [];
  for (const n of nodes.values()) {
    const parent = n.task.parent;
    if (!parent) {
      roots.push(n);
      continue;
    }
    const seen = new Set([n.task.id]);
    let cursor: number | null = parent,
      cycle = false;
    while (cursor) {
      if (seen.has(cursor)) {
        cycle = true;
        break;
      }
      seen.add(cursor);
      cursor = nodes.get(cursor)?.task.parent ?? null;
    }
    if (cycle) {
      n.warning = 'Cyclic parent reference';
      roots.push(n);
    } else if (!nodes.has(parent)) {
      n.warning = `Parent #${parent} not loaded`;
      roots.push(n);
    } else nodes.get(parent)!.children.push(n);
  }
  return roots;
}
