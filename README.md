# Memtime Integration Workspace — Version 2

**Windows quick start:** open this project folder and double-click `Install-and-Run.cmd`. See `START_HERE.txt`. This package pins the public registry locally to avoid inheriting an unreachable internal Nexus registry.

A focused take-home implementation for browsing clients, projects and tasks, reviewing recorded time, and creating or updating entries.

## Run locally

Use Node.js 24 LTS (minimum 22.15) and npm. Node 20.18 is not supported. The lockfile records the installed dependency versions.

```bash
npm ci
npm run dev
```

On first run, a demo `.env` is created automatically if no `.env` exists. Existing configuration is never overwritten.

Open **http://localhost:5173**. The API runs on port 3001. Demo mode is enabled by default; its records are isolated and reset when the API restarts. The demo contains three clients, four projects, nested tasks, and 64 entries so pagination and filtering can be exercised immediately.

For the production build:

```bash
npm run build
npm start
```

Open **http://localhost:3001**. This is a local review server, not a public multi-user deployment.

## Connect to the supplied API

Copy `.env.example` to `.env`, set `DEMO_MODE=false`, and add the supplied Bearer key as `MEMTIME_API_KEY`. Restart the API process. The UI badge changes to LIVE API.

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

On macOS/Linux:

```bash
cp .env.example .env
```

The key is deliberately absent from source and examples. It belongs only in the server environment. Do not place it in a `VITE_` variable, commit `.env`, or embed it in screenshots. Live mode refuses to start without the key. The upstream URL is fixed to the supplied API host; this backend cannot proxy arbitrary URLs.

## Verify

```bash
npm run typecheck
npm test
npm run build
npm run format:check
```

Browser workflow tests run against isolated demo data:

```bash
npx playwright install chromium
npm run test:e2e
```

If Chromium is already installed in a nonstandard location, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` before running browser tests. On restricted Linux containers, `PLAYWRIGHT_NO_SANDBOX=true` enables the explicit container-only launch flags.

## Features

- Lazy client/project expansion with pagination, branch-level errors, retry, empty states, and cached reopening.
- Nested task rendering with missing-parent and cyclic-reference handling. Task parent semantics are a documented assumption.
- Time-entry table with all six required columns, page-size selection, Previous/Next, and refresh.
- Task selection opens a task-specific view and supplies the new-entry form's task ID.
- Task-specific filtering scans the documented entry endpoint incrementally. It explicitly labels incomplete results and paginates accumulated matches locally.
- A contextual loaded-task picker, duration column, page-scoped summaries and saved-entry actions.
- Explicit Refresh bypasses server read cache while preserving limiter/deduplication.
- One create/edit editor, local-time inputs, duration preview, overnight intervals, and explicit offset selection during repeated daylight-saving hours.
- Unchanged timestamps retain their original seconds and milliseconds when editing a comment.
- Duplicate submission protection, preserved drafts, discard confirmation, resource/validation errors, and unknown-save recovery.
- Success feedback contains the returned entry ID and comment. Saving and list-refresh failures are reported separately.

## Structure

- `client/features/Hierarchy.tsx`: browsing and lazy queries.
- `client/features/taskForest.ts`: hierarchy transformation independent of rendering.
- `client/features/TimeEntries.tsx`: server pagination and progressive task scanning.
- `client/features/EntryEditor.tsx`: form state, validation, submission, recovery.
- `client/dateTime.ts`: local wall-time conversion, DST ambiguity detection.
- `server/app.ts`: allowlisted HTTP routes, request validation, safe error responses.
- `server/memtimeClient.ts`: transport, authentication, bounded read cache, deduplication, adapters, cache invalidation.
- `server/rateLimiter.ts`: rolling upstream request budget and shared cooldown.
- `server/demo.ts`: isolated in-memory demo provider using the same application boundary.
- `shared/contracts.ts`: runtime schemas and inferred TypeScript contracts.
- `tests/`: domain, HTTP, integration-boundary, React, and browser workflow checks.

The styling uses one small plain CSS stylesheet rather than introducing a component library. No assets, fonts, analytics, or scripts are fetched from third-party CDNs.

## Decisions and limitations

See [requirement coverage](docs/REQUIREMENTS.md), [version 2 changes](docs/CHANGES_V2.md), [technical analysis](docs/TECHNICAL_ANALYSIS.md), [API boundary](docs/API.md), [implementation milestones](docs/IMPLEMENTATION_PLAN.md), and [verification record](docs/VERIFICATION.md).

The application has no database or new authentication system. The external API owns persistence and identity. The in-memory request budget coordinates one process only; external key usage and restarts remain outside its control. Public hosting requires an access boundary and a fixed trusted origin. An Origin check alone is not authentication.

Automatic retries are disabled, including mutations. An uncertain save requires verification before another submission. The API documents no idempotency, update version, task filter, or pagination snapshot token.

No deployment or repository publication is performed by this project. Review the implementation, configure the key locally, and verify live integration before submitting.

## Opening the download

Extract the ZIP into a new directory. Open the `memtime-project` folder inside the extracted directory. That folder contains `package.json` and `package-lock.json`. Open a terminal there, run `npm.cmd ci --registry=https://registry.npmjs.org/ --include=dev --no-audit --no-fund`, then `npm run dev`. Do not overwrite your previous project or copy its `node_modules`. Transfer your existing `.env` only if you want to reuse your local live configuration.
