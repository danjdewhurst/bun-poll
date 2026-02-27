# Testing

bun-poll uses [bun:test](https://bun.sh/docs/cli/test) for integration testing.

---

## Running Tests

```bash
bun test
```

### With Coverage

```bash
bun test --coverage
```

---

## Test Setup

Tests spin up a real `Bun.serve()` instance on an OS-assigned port (`PORT = 0`). This means every test hits actual HTTP endpoints and the real SQLite database — there are no mocks.

Before each run, the `beforeAll` hook clears all tables (`votes`, `options`, `polls`) to ensure a clean slate. After all tests, `afterAll` stops the server.

---

## Test Suites

### `POST /api/polls` — Poll Creation

| Test | Assertion |
|---|---|
| Creates a poll | Returns 200 with 8-char `share_id` and UUID `admin_id` |
| Rejects empty question | Returns 400 |
| Rejects fewer than 2 options | Returns 400 |
| Rejects invalid `starts_at` | Returns 400 |
| Rejects `starts_at` in the past | Returns 400 |
| Rejects `starts_at` >= `expires_at` | Returns 400 |

### `GET /api/polls/:shareId` — Poll Retrieval

| Test | Assertion |
|---|---|
| Returns poll with options and results | 200, correct question, 3 options, 0 votes |
| Unknown share_id | Returns 404 |
| `has_voted` reflects voter_token | `true` after voting with the same token |

### `POST /api/polls/:shareId/vote` — Voting

| Test | Assertion |
|---|---|
| Records a vote | 200, `total_votes: 1`, correct option count |
| Duplicate vote | Returns 409 |
| Multiple options on single-choice | Returns 400 |
| Multiple options on multi-choice | Returns 200 |
| Vote on not-started poll | Returns 403 |
| Duplicate vote (same IP) | Returns 409 |
| Expired poll | Returns 410 |
| Invalid option ID | Returns 400 |

### `GET /api/polls/admin/:adminId` — Admin View

| Test | Assertion |
|---|---|
| Returns full poll data | 200, includes `admin_id` and `share_id` |
| Unknown admin_id | Returns 404 |

### `GET /api/polls/admin/:adminId/export` — Results Export

| Test | Assertion |
|---|---|
| CSV export | 200, correct `Content-Type: text/csv`, header row + option rows present |
| JSON export | 200, structured data with `question`, `options`, `total_votes`, `exported_at` |
| Default format is JSON | 200, `Content-Type: application/json` when no `format` param |
| Unknown admin_id | Returns 404 |

### `GET /api/polls/admin/:adminId/summary` — Results Summary

| Test | Assertion |
|---|---|
| Returns plain text summary | 200, `Content-Type: text/plain`, contains question, options with votes, and total |
| Unknown admin_id | Returns 404 |

### `POST /api/polls/admin/:adminId/close` — Close Poll

| Test | Assertion |
|---|---|
| Closes a poll | 200, `expires_at` set to current timestamp |
| Already closed poll | Returns 409 with "Poll is already closed" |
| Unknown admin_id | Returns 404 |

### `DELETE /api/polls/admin/:adminId` — Delete Poll

| Test | Assertion |
|---|---|
| Deletes a poll | 200, `deleted: true`, poll no longer accessible via GET |
| Unknown admin_id | Returns 404 |

### `POST /api/polls/admin/:adminId/reset` — Reset Votes

| Test | Assertion |
|---|---|
| Resets votes | 200, all options have 0 votes, `total_votes: 0` |
| Unknown admin_id | Returns 404 |

### `GET /health` — Health Check

| Test | Assertion |
|---|---|
| Returns expected shape | 200, `status: "ok"`, numeric `uptime_seconds` and `polls`, `database: "ok"` |
| Poll count reflects new polls | Count increments by 1 after creating a poll |

### HTML Pages

| Test | Assertion |
|---|---|
| Home page loads | 200, contains "Create a Poll" |
| Poll page loads | 200 for valid share_id |
| Admin page loads | 200 for valid admin_id |
| Embed page loads | 200 for valid share_id |

### Scheduled Polls

| Test | Assertion |
|---|---|
| Creates poll with valid `starts_at` | 200, poll created with `starts_at` set |
| Voting blocked before start time | 403 with "Poll has not started yet" |
| Voting allowed after start time | 200, vote recorded normally |

### Voter Integrity — IP Deduplication

| Test | Assertion |
|---|---|
| Same IP blocked on second vote | 409, duplicate detected by IP |
| Different IP allowed | 200, vote recorded |

---

## Helper

`createTestPoll(overrides)` is a shared helper that posts to `/api/polls` with sensible defaults:

```ts
{
  question: "Favourite colour?",
  options: ["Red", "Blue", "Green"]
}
```

Pass overrides to customise: `createTestPoll({ allow_multiple: true })`, `createTestPoll({ expires_in_minutes: -1 })` for an already-expired poll, or `createTestPoll({ starts_at: "2099-01-01T00:00:00Z" })` for a future-scheduled poll.
