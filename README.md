# Memtime Integration Workspace

A take-home implementation for the **Senior JavaScript Engineer - Integrations Team** position.

The application supports browsing clients, projects and tasks, reviewing recorded time, and creating or updating time entries through the supplied Memtime API.

## Requirements

- Node.js **22.15 or newer**; Node.js 24 LTS recommended.
- npm.
- The supplied API key for live mode. Demo mode runs without credentials.

## Getting started

Open a terminal in the directory containing `package.json`:

```bash
npm ci
npm run dev
```

Open **http://localhost:5173**.

The backend runs on port **3001**. On first startup, the application creates a demo `.env` file if none exists. Existing configuration is never overwritten.

On Windows, you can alternatively run:

```powershell
.\Install-and-Run.cmd
```

The script installs dependencies from the public npm registry and starts the application only if installation succeeds.

## Demo and live modes

### Demo mode

Demo mode includes three clients, four projects, nested tasks and 64 time entries.

Changes are stored in memory and reset when the backend restarts. Demo requests do not consume the external API allowance.

### Live mode

Edit `.env`:

```dotenv
DEMO_MODE=false
MEMTIME_API_KEY=<provided-interview-key>
PORT=3001
HOST=127.0.0.1
```

Restart the application and confirm that the header displays **LIVE API**.

The API key stays on the backend. It must not be committed to Git or placed in a frontend environment variable.

## Features

### Clients, projects and tasks

- Expandable client → project → task hierarchy.
- Projects and tasks load when their parent branch opens.
- Pagination through “Load more”.
- Previously loaded branches remain available.
- Branch-level loading, empty and error states.
- Nested-task handling with missing-parent and cycle protection.

### Time entries

- Required columns: **ID, Task ID, Comment, Start, End and Created At**.
- Additional duration column.
- Pagination with page sizes of 10, 20 or 50.
- Task-specific entry views.
- Explicit refresh.
- Duration summaries scoped to the displayed page.

The API does not document task filtering. Task-specific views therefore retrieve entries progressively and clearly indicate when results are incomplete.

### Create and update

- Shared form for POST and PUT operations.
- Task selection using loaded client/project/task context.
- Direct task ID input.
- Required-field and time-interval validation.
- Local-time display and ISO timestamp submission.
- Overnight entries and daylight-saving ambiguity handling.
- Preservation of unchanged timestamp precision.
- Disabled submission while saving.
- Preserved drafts after failures.
- Success confirmation with the returned entry ID.
- “Edit saved entry” and “Add another entry” actions.

## Technology stack

| Area | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| Server state | TanStack Query |
| Backend | Node.js, Express |
| HTTP transport | Native fetch |
| Runtime validation | Zod |
| Styling | Plain CSS |
| Testing | Vitest, React Testing Library, Playwright |

## Architecture

The browser communicates with a small Node.js backend, which calls the Memtime API.

The backend owns:

- Bearer authentication.
- Upstream timeouts.
- Request and response validation.
- Read caching and request deduplication.
- Rate-limit coordination.
- Safe error responses.

The external API remains the source of truth. No additional database or authentication system is introduced.

## Request management

The external API permits **15 requests per 60 seconds per API key**.

The application limits unnecessary traffic through lazy loading, short-lived caching and deduplication of identical in-flight reads. Explicit refresh bypasses the relevant read cache while respecting the request budget.

Automatic retries are disabled. A mutation timeout may occur after the external service has saved the entry, so an uncertain outcome requires verification before resubmission.

The limiter operates within one backend process. It does not coordinate other applications using the same key or multiple server instances.

## Testing

Run the automated checks:

```bash
npm run typecheck
npm test
npm run build
npm run format:check
```

Install Chromium and run browser tests:

```bash
npx playwright install chromium
npm run test:e2e
```

Stop any existing application on port 3001 before running browser tests.

The recorded verification baseline includes **50 automated tests and three browser tests passing**. Tests cover API contracts, authentication, sanitization, pagination, request controls, date conversion, hierarchy handling, form recovery and complete user workflows.

## Production frontend build

```bash
npm run build
npm start
```

Open **http://localhost:3001**.

This serves the built frontend and API locally. Public deployment requires an access boundary, HTTPS and appropriate shared request coordination.

## Project structure

```text
client/
  features/       Hierarchy, entry list, editor and task picker
  api.ts          Browser API client
  dateTime.ts     Date conversion and DST handling
  entrySummary.ts Duration calculations
  taskOptions.ts  Context from loaded hierarchy data

server/
  app.ts          HTTP routes and validation
  memtimeClient.ts External API integration and caching
  rateLimiter.ts  Request budget and cooldown
  demo.ts         Isolated demo provider
  index.ts        Configuration and startup

shared/
  contracts.ts    Runtime schemas and TypeScript contracts

tests/
  browser/        End-to-end workflows
  *.test.ts       Domain and integration tests
  *.test.tsx      React component tests

scripts/
  check-node.mjs  Runtime version check
  setup.mjs       Initial demo configuration
```

## Assumptions and limitations

- Missing, zero or null task parents are treated as roots.
- A full collection page indicates that another page may exist; no total count is assumed.
- Task-specific results remain partial until the progressive scan completes.
- Offset pagination does not provide a consistent snapshot when records change.
- Entries require an end time after their start.
- The API documents no idempotency key or update version check. Exactly-once creation and concurrent-edit protection cannot be guaranteed.
- Drafts remain in memory rather than persistent offline storage.
- Authenticated live reads were checked. **Live create/update acceptance and the complete live browser workflow remain outstanding.**
- The SVG brand mark is redrawn from a supplied reference and is not an official downloaded asset.

## Installation troubleshooting

If npm inherits an unavailable private registry, install using an explicit public registry:

```bash
npm ci --registry=https://registry.npmjs.org/ --include=dev --no-audit --no-fund --fetch-retries=0 --fetch-timeout=30000
```

Do not start the application after a failed installation. Missing commands such as `concurrently` indicate that dependencies may not have installed successfully.

Keep `package-lock.json` to preserve reproducible dependency versions.

## Author

Šejla Pljakić
