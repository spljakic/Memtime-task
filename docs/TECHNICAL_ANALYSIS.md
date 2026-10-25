# Technical analysis and architecture

## Goal and scope

Make task selection, time review, and correction of entries straightforward while treating the external API as a constrained dependency. The most important constraints are the shared 15-request-per-60-second allowance, array-only pagination, and absence of documented mutation idempotency and version checks.

Required: paginated client/project/task hierarchy; six-column entry list; POST/PUT editor; meaningful 400/404 and other failure handling; Bearer authentication.

Application choices: lazy loading, short-lived caches, positive duration validation, local timezone display, draft protection, progressive per-task filtering. These are decisions, not additional upstream guarantees.

Out of scope: deletion, client/project/task administration, billing, timers, offline synchronization, new identity systems, database replication, and cloud deployment.

## Architecture

Browser → Node.js HTTP boundary → Memtime API.

React owns display and interaction. TanStack Query owns browser server-state caching. Form values and dirty state stay local. The Node.js process owns the credential, upstream request budget, timeout, response validation, and response sanitization. The upstream service remains the source of truth.

The stack is React, TypeScript, Vite, Node.js, Express, TanStack Query, Zod, and plain CSS. TypeScript helps maintain contracts; Zod validates received JSON at runtime. No separate form package or global store is required. Plain CSS keeps the small stylesheet direct; CSS Modules would become useful with more independently styled screens.

A database is unnecessary. SQLite would introduce replication and retention decisions without removing the need to retrieve source records. Lambda is not required to demonstrate integration engineering; a multi-instance deployment would invalidate assumptions behind the local limiter and would need shared coordination.

## Responsibilities and useful patterns

The Memtime client is an API gateway boundary, not a general persistence repository. Response adapters validate the documented arrays and strip unknown fields. Injected transport, clock and limiter allow deterministic tests. Validated/sanitized read caching and identical-request coalescing conserve the quota. Task-forest construction is a pure transformation, independent of presentation. The editor explicitly distinguishes pending, rejected, confirmed, and uncertain outcomes.

SOLID is applied through coherent responsibilities and dependency boundaries. Components do not construct upstream requests. HTTP routes do not manipulate UI state. Test substitutes honour the same runtime contracts. There is no factory hierarchy or hypothetical multi-provider framework.

## Request policy

Projects load on client expansion; tasks load on project expansion. Query data remains available when branches collapse. Browser polling, focus refetch and automatic retries are disabled. Explicit retries are visible and respect cooldowns. Read caches are bounded to 200 keys and expire after 15 seconds for entries and 60 seconds for hierarchy collections. Browser hierarchy freshness is five minutes; there is no automatic background synchronization guarantee.

The rolling limiter counts upstream dispatches, including writes, and is shared across all requests through this application instance. Excess requests fail with a safe 429 and retry delay rather than building an unbounded queue. Upstream Retry-After accepts seconds or an HTTP date. A missing header uses 60 seconds.

Writes invalidate server caches before dispatch and after completion. Generation checks prevent older reads from restoring stale cache values. Matching pending reads are deduplicated. Browser mutation success removes accumulated scan queries and invalidates entry queries without refetching every previously scanned page.

No mutation is automatically retried. A failed transport or unreadable success response may leave an uncertain outcome; the draft remains and another save requires explicit verification. This cannot deliver exactly-once creation without upstream idempotency support.

## Pagination and task filtering

All documented collection requests use limit, offset, sortBy and order. A full array means another page may exist; a short page means the scan has reached its current end. No total is invented. Sorting by ID makes requests deterministic but does not make offset pagination a snapshot.

The API does not document task filtering. All-entry browsing uses ordinary upstream pages. A selected task scans 50 records at a time, filters accumulated records, and paginates matching records locally. Incomplete results are explicitly labelled; one page is never presented as complete history. A larger product should add upstream task filtering. Progressive scanning consumes quota and memory, and is a take-home-scale compromise rather than an unbounded-data solution.

## Hierarchy assumptions

Zero or null parent is treated as a root. Other parent IDs provisionally reference tasks in the project collection. Missing-parent tasks remain visible until subsequent pages allow reconciliation. Duplicate IDs are coalesced and cycles are retained with warnings rather than recursed indefinitely. Deep rendering is guarded; the current recursion display limit is 40 levels and would need a virtualized/iterative renderer for pathological nesting.

## Editor and dates

The form validates required fields, positive integer task ID and positive duration. These are application-level rules; overlap limits, working hours, maximum durations and future-date restrictions are not invented. Start/end can span midnight.

Inputs display wall time in the device timezone and submit ISO instants. Calendar rollover and nonexistent DST wall times are rejected. Repeated local hours offer explicit UTC offset selection. Unchanged stored timestamps retain precision, including when only a comment changes. The implementation targets modern timezone data and browser support; historical timezone anomalies are outside the task scope.

Save disables the form until a response arrives. Failures retain the draft. 404 does not erase work. A successful mutation produces an ID and comment notification independently of table refresh. A dirty draft requires confirmation before closing, and navigation receives the browser's unload guard. Concurrent updates remain last-write-wins because no conditional version field is documented.

## Security and privacy

The key stays in server environment configuration. Responses are sanitized before caching. Upstream userId is omitted because the supplied example contains the key. Zod object schemas strip unknown response fields. Explicit user refresh bypasses a matching read cache without bypassing the limiter. Comments and payloads are not logged. Responses use no-store, safe error categories, CSP and nosniff headers. JSON body size is bounded and endpoints/sorting parameters are allowlisted.

There is no new user identity layer. Localhost binding is the default. Public deployment requires authentication or a suitable access gateway, a fixed trusted origin, HTTPS, and a distributed request coordinator if replicated. Origin checks are defense in depth, not authorization. Data is sent to the external API; the app does not claim device-only storage.

## Verification and next improvements

Tests cover rate-window expiry, upstream cooldown, read deduplication, credential stripping, malformed responses, cache invalidation races, mutation uncertainty, HTTP create/update/errors, date conversions, cycles, lazy loading and form preservation. Browser tests cover browse/create/edit, pagination, keyboard dialog behaviour and mobile page width.

Before live submission, validate supplied credentials and contracts from a network that can reach the external service. Higher-value future API improvements are task filtering, cursor pagination, idempotency keys and optimistic concurrency. These address real limitations before more infrastructure is added.

## Observed API behaviour (24 October)

A limited authenticated read smoke check returned 200 arrays for the four required collection endpoints. The observed task did not include parent; the adapter defaults absence to root. This confirms read contracts only. Live POST/PUT and full live-browser acceptance remain separate checks.
