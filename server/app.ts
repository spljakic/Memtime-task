import express from 'express';
import path from 'node:path';
import { z } from 'zod';
import { entryInputSchema } from '../shared/contracts';
import { AppError } from './errors';
import type { MemtimeClient } from './memtimeClient';
const paginationSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(10),
    offset: z.coerce.number().int().min(0).max(10_000_000).default(0),
    sortBy: z.enum(['id', 'name', 'taskId', 'start', 'end', 'createdAt']).default('id'),
    order: z.enum(['asc', 'desc']).default('asc'),
  })
  .strict();
export function createApp({
  client,
  demo = false,
  origin,
}: {
  client: MemtimeClient;
  demo?: boolean;
  origin?: string;
}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    next();
  });
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const allowed = origin
      ? [origin]
      : ['http://localhost:5173', 'http://127.0.0.1:5173', `http://${req.headers.host}`];
    if (
      req.headers['sec-fetch-site'] === 'cross-site' ||
      (req.headers.origin && !allowed.includes(req.headers.origin))
    )
      return next(new AppError(403, 'FORBIDDEN', 'Cross-origin request refused.'));
    next();
  });
  app.use(express.json({ limit: '16kb' }));
  app.get('/api/config', (_req, res) => {
    res.json({ demo });
  });
  app.get(
    /^\/api\/(clients|clients\/\d+\/projects|projects\/\d+\/tasks|time-entries)$/,
    async (req, res) => {
      const params = paginationSchema.parse(req.query),
        endpoint = req.path.slice(4);
      const fields =
        endpoint === '/time-entries'
          ? ['id', 'taskId', 'start', 'end', 'createdAt']
          : ['id', 'name', 'createdAt'];
      if (!fields.includes(params.sortBy))
        throw new AppError(400, 'VALIDATION', 'Sorting field is not valid for this resource.');
      res.json(
        await client.list(
          endpoint,
          params,
          req.get('Cache-Control')?.includes('no-cache') ?? false,
        ),
      );
    },
  );
  app.post('/api/time-entries', async (req, res) => {
    if (!req.is('application/json')) throw new AppError(415, 'VALIDATION', 'Use application/json.');
    res.status(201).json(await client.save(entryInputSchema.parse(req.body)));
  });
  app.put('/api/time-entries/:id', async (req, res) => {
    const id = z.coerce.number().int().positive().safe().parse(req.params.id);
    if (!req.is('application/json')) throw new AppError(415, 'VALIDATION', 'Use application/json.');
    res.json(await client.save(entryInputSchema.parse(req.body), id));
  });
  app.use('/api', (_req, _res, next) =>
    next(new AppError(404, 'NOT_FOUND', 'Endpoint not found.')),
  );
  app.use(express.static(path.resolve('dist')));
  app.use((_req, _res, next) =>
    next(
      new AppError(
        404,
        'NOT_FOUND',
        'Page not found. Run npm run build before npm start, or use npm run dev.',
      ),
    ),
  );
  app.use(
    (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (error instanceof z.ZodError) {
        const fields: Record<string, string> = {};
        for (const issue of error.issues) fields[issue.path.join('.') || 'form'] = issue.message;
        res
          .status(400)
          .json({ code: 'VALIDATION', message: 'Please check the request values.', fields });
        return;
      }
      if (error instanceof AppError) {
        if (error.retryAfter) res.setHeader('Retry-After', error.retryAfter);
        res.status(error.status).json({
          code: error.code,
          message: error.message,
          retryAfter: error.retryAfter,
          fields: error.fields,
        });
        return;
      }
      const e = error as { type?: string };
      if (e?.type === 'entity.parse.failed') {
        res.status(400).json({ code: 'VALIDATION', message: 'Invalid JSON body.' });
        return;
      }
      if (e?.type === 'entity.too.large') {
        res.status(413).json({ code: 'VALIDATION', message: 'Request body is too large.' });
        return;
      }
      res
        .status(500)
        .json({ code: 'UPSTREAM', message: 'An unexpected application error occurred.' });
    },
  );
  return app;
}
