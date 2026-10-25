import { createApp } from './app';
import { createMemtimeClient, createTransport } from './memtimeClient';
import { createDemoTransport } from './demo';
const mode = process.env.DEMO_MODE ?? 'true';
if (!['true', 'false'].includes(mode)) throw new Error('DEMO_MODE must be true or false.');
const demo = mode === 'true',
  key = process.env.MEMTIME_API_KEY;
if (!demo && !key?.trim()) throw new Error('MEMTIME_API_KEY is required when DEMO_MODE=false.');
const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('PORT must be between 1 and 65535.');
const client = createMemtimeClient(demo ? createDemoTransport() : createTransport({ key: key! }));
const server = createApp({ client, demo, origin: process.env.APP_ORIGIN || undefined }).listen(
  port,
  process.env.HOST ?? '127.0.0.1',
  () =>
    console.log(
      `Workspace running at http://localhost:${port} · ${demo ? 'DEMO (resets on restart)' : 'LIVE API'}`,
    ),
);
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.on(signal, () => server.close(() => process.exit(0)));
