# Application API

The application exposes a normalized local API. It does not claim to reproduce every endpoint in the external service. In live mode, calls to the external host carry the server-side Bearer key. The browser never sends that key.

| Method | Local path                  | Result                    |
| ------ | --------------------------- | ------------------------- |
| GET    | `/api/config`               | `{ demo: boolean }`       |
| GET    | `/api/clients`              | Client page               |
| GET    | `/api/clients/:id/projects` | Project page              |
| GET    | `/api/projects/:id/tasks`   | Task page                 |
| GET    | `/api/time-entries`         | Time-entry page           |
| POST   | `/api/time-entries`         | Created entry, status 201 |
| PUT    | `/api/time-entries/:id`     | Updated entry, status 200 |

Collection parameters: `limit` (1–100, default 10), `offset` (0–10,000,000, default 0), `sortBy` (allowlisted per resource, default id), `order` (asc/desc, default asc). The limits are local defensive boundaries, not claimed upstream specifications. Invalid parameters return 400. Unknown query parameters are rejected.

Collection response:

```json
{
  "items": [],
  "limit": 10,
  "offset": 0,
  "mayHaveMore": false
}
```

The upstream API returns an array. The local adapter wraps that array; it does not invent totals. Runtime schemas select the supported display fields and omit userId. Entry fields: id, taskId, comment, start, end, createdAt, optional updatedAt. Client fields: id/name. Project fields add clientId. Task fields add parent.

POST/PUT require JSON containing numeric taskId, nonblank comment, ISO start and end with timezone, and end later than start. Both endpoints return the validated upstream record with sensitive/unknown fields removed.

Error response:

```json
{
  "code": "RATE_LIMITED",
  "message": "Request limit reached. Wait before retrying.",
  "retryAfter": 12
}
```

Validation errors can additionally contain a `fields` map. Supported codes are VALIDATION, NOT_FOUND, AUTHENTICATION, RATE_LIMITED, UPSTREAM, INVALID_RESPONSE, OUTCOME_UNKNOWN, FORBIDDEN and CONFIGURATION. Safe messages avoid reflecting external response bodies. Local 429 includes Retry-After. No automatic mutation retries occur.

Deletion, user authentication, health forwarding and arbitrary URL proxying are not part of this application API.

## Explicit revalidation

A local GET with `Cache-Control: no-cache` bypasses the matching server read-cache entry. It still consumes the shared upstream budget if dispatched, and simultaneous refreshes are deduplicated. This is an application header, not an invented upstream query parameter.
