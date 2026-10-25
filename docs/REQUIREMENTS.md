# Assignment requirements and verification

| Requirement                     | Implementation                                                      | Evidence                                            |
| ------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------- |
| Retrieve clients                | Lazy hierarchy root uses GET /clients                               | HTTP and hierarchy tests                            |
| Retrieve client projects        | Expand client calls GET /clients/:id/projects                       | Lazy-loading component and browser tests            |
| Retrieve project tasks          | Expand project calls GET /projects/:id/tasks                        | HTTP, component and browser tests                   |
| Display Client → Project → Task | Nested disclosure hierarchy                                         | Browser workflow                                    |
| Access all collection pages     | Load more appends records without replacing earlier pages           | Hierarchy pagination test and normalized page tests |
| Display time entries            | GET /time-entries                                                   | HTTP and browser tests                              |
| Required columns                | ID, Task ID, Comment, Start, End, Created At                        | Browser workflow; duration is additional            |
| Entry pagination                | limit/offset and rows 10/20/50                                      | HTTP and browser workflow                           |
| Time entries per task           | Progressive scan and local filter; partial results clearly labelled | Browser scans first 50 and final page               |
| Create                          | POST taskId/comment/start/end                                       | HTTP, editor and browser tests                      |
| Create confirmation             | Returned entry ID, comment, context and duration                    | Browser success panel                               |
| Update                          | PUT /time-entries/:id with all four fields                          | HTTP, editor and browser tests                      |
| Update confirmation             | Returned ID/comment, task/duration and Edit saved entry             | Browser update and success panel                    |
| ISO timestamps                  | Local-to-ISO conversion and runtime validation                      | Date/DST and payload tests                          |
| Invalid input                   | Frontend and server validation                                      | HTTP and editor tests                               |
| 400 invalid JSON                | JSON middleware maps parse failures to safe error                   | HTTP malformed body test                            |
| 404 missing resource            | Draft preserved; meaningful error                                   | HTTP and editor tests                               |
| Bearer authentication           | Server adds Authorization on upstream fetch                         | Transport test                                      |
| 15 calls / 60 seconds           | Shared rolling limiter, cooldown and read reuse                     | Limiter, deduplication and explicit-refresh tests   |
| JSON responses                  | Response schemas; safe local error envelope                         | Adapter and HTTP tests                              |
| Customer usability              | Contextual task picker, duration, draft guard, clear partial state  | React/browser tests and visual review               |

## Assumptions and limits

- The API does not document task filtering; no undocumented taskId query parameter is assumed.
- A full collection page means another page may exist. No total count is fabricated.
- parent=0/null is root; other values provisionally reference task IDs within a project.
- End after start and nonblank comments are application validation choices.
- Unknown save outcomes cannot provide exactly-once guarantees without upstream idempotency.
- Local rate controls coordinate only one application process and cannot account for external key usage.
- Authenticated live reads were verified on 24 October. Live create/update acceptance remains outstanding. Demo tests do not prove live mutation acceptance.
