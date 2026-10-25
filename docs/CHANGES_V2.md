# Version 2 changes

## Usability

- Refined blue/white interface, workspace context, row feedback, reduced-motion support and a reference-inspired SVG brand mark.
- The SVG is a manually redrawn approximation of the user-supplied screenshot, not an official downloaded brand asset. Replace it with an official asset if available.
- Search and choose from loaded tasks using client/project/task context. Search is explicitly scoped to loaded records and does not imply global API search.
- Duration column and summary for the displayed page only. Required assignment columns remain intact.
- Saved-entry confirmation exposes task context, duration, Edit saved entry, Add another entry and Dismiss.
- Add another entry retains the saved task and clears the comment; it does not silently duplicate the previous entry.

## Integration

- Explicit Refresh bypasses read cache via the local Cache-Control: no-cache request header. This header is interpreted locally and is not forwarded as an unsupported upstream query parameter.
- Fresh requests still pass through shared rate limits and coalesce identical in-flight refreshes.
- Cache generations prevent older reads from replacing refreshed cache data.
- Responses are validated and sanitized before entering the shared server cache.
- Progressive task scan requests revalidate data when dispatched. Previously accumulated pages are still a non-snapshot view.

## Setup and verification

- A preinstall Node check gives a readable message for unsupported runtimes.
- Development/start scripts create a demo .env only when none exists; existing live configuration is never overwritten.
- Node 24 is suggested in .nvmrc. Minimum remains Node 22.15.
- Vitest updated to 4.1.12 following the dependency audit. Full dependency audit reported zero known vulnerabilities at verification time, including development dependencies. Audit results can change with new advisories.
- Added unit/component/integration tests for task selection, duration summaries, client pagination, explicit refresh, cache race conditions and save-success/refresh-failure.
- The Windows-ready ZIP contains a single memtime-project folder, as requested. It includes a project-local public npm registry setting and Install-and-Run.cmd, which supplies an explicit public registry argument without changing global configuration.

## Live read observations

Authenticated read endpoints responded successfully on 24 October. The observed task payload omitted parent; the adapter defaults it to a root and a regression test covers this live/documentation difference. No real mutation was performed.
