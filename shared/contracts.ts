import { z } from 'zod';
export const entitySchema = z.object({ id: z.number().int().nonnegative(), name: z.string() });
export const clientSchema = entitySchema;
export const projectSchema = entitySchema.extend({ clientId: z.number().int().nonnegative() });
export const taskSchema = entitySchema.extend({
  parent: z.number().int().nonnegative().nullable().default(0),
});
export const entrySchema = z.object({
  id: z.number().int().nonnegative(),
  taskId: z.number().int().nonnegative(),
  comment: z.string(),
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }).optional(),
});
// z.object strips unknown fields, including credential-bearing userId values.
export const entryInputSchema = z
  .object({
    taskId: z.number().int().positive(),
    comment: z.string().refine((v) => v.trim().length > 0, 'Describe your work.'),
    start: z.iso.datetime({ offset: true }),
    end: z.iso.datetime({ offset: true }),
  })
  .refine((v) => Date.parse(v.end) > Date.parse(v.start), {
    message: 'End must be after start.',
    path: ['end'],
  });
export type Client = z.infer<typeof clientSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Entry = z.infer<typeof entrySchema>;
export type EntryInput = z.infer<typeof entryInputSchema>;
export interface Page<T> {
  items: T[];
  offset: number;
  limit: number;
  mayHaveMore: boolean;
}
export interface PageParams {
  limit: number;
  offset: number;
  sortBy: string;
  order: 'asc' | 'desc';
}
export type ErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'AUTHENTICATION'
  | 'RATE_LIMITED'
  | 'UPSTREAM'
  | 'INVALID_RESPONSE'
  | 'OUTCOME_UNKNOWN'
  | 'FORBIDDEN'
  | 'CONFIGURATION';
export interface ErrorBody {
  code: ErrorCode;
  message: string;
  retryAfter?: number;
  fields?: Record<string, string>;
}
