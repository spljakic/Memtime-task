# Implementation milestones and review guide

| Milestone | Deliverable                                                        | Verification                                                |
| --------- | ------------------------------------------------------------------ | ----------------------------------------------------------- |
| Contracts | Runtime schemas and explicit API assumptions                       | Adapter tests reject unexpected responses and remove userId |
| Boundary  | Allowlisted HTTP routes, authenticated transport, request controls | HTTP and fake-transport tests                               |
| Hierarchy | Paginated lazy branches and task forest                            | Branch-loading and cycle/missing-parent tests               |
| Entries   | All-entry pages and partial per-task scanning                      | Demo browse flow and browser filtering check                |
| Editor    | Shared POST/PUT form and date handling                             | React tests and date/DST tests                              |
| Recovery  | Draft preservation, uncertain outcome, cooldown                    | Mutation and rate tests                                     |
| Delivery  | Build, documentation, reproducible dependency lockfile             | Clean npm ci, typecheck, test, build                        |

The implementation is complete for the documented application scope. Live external acceptance remains a separate verification step; no real user records were written during development.

Useful interview discussion points:

1. Why a server boundary is justified for a shared Bearer key.
2. Why a database does not solve the missing task-filter capability.
3. Why read caching and mutation retries require different policies.
4. Why a timeout cannot be described as a confirmed failed save.
5. How cache generations prevent stale in-flight reads from repopulating cache after writes.
6. Why static types do not validate external JSON.
7. Which local request-limiter assumptions break under Lambda scaling.
8. What would change with idempotency, cursor pagination, and ETags.

Review the code and test scenarios before presenting. The README should describe verified behaviour rather than claims about production readiness.
