# API Reference

All endpoints return JSON. The server runs on `PORT` (default `3000`).

---

## Polls

### Create a Poll

`POST /api/polls`

**Request body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `question` | string | Yes | The poll question (non-empty after trim) |
| `options` | string[] | Yes | At least 2 option labels |
| `allow_multiple` | boolean | No | Allow voters to select more than one option (default `false`) |
| `expires_in_minutes` | number | No | Minutes until voting closes (omit for no expiry) |

**Example:**

```bash
curl -X POST http://localhost:3000/api/polls \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Favourite language?",
    "options": ["TypeScript", "Rust", "Go"],
    "allow_multiple": false,
    "expires_in_minutes": 60
  }'
```

**Response (`200`):**

```json
{
  "share_id": "a1b2c3d4",
  "admin_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

- `share_id` — 8-character hex string used in voting links
- `admin_id` — UUID v4 used in the admin link (keep private)

**Errors:**

| Status | Reason |
|---|---|
| `400` | Empty question or fewer than 2 options |
| `500` | Database insert failure |

---

### Get a Poll

`GET /api/polls/:shareId`

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `voter_token` | string | Optional. If provided, `has_voted` reflects whether this token has voted. |

**Response (`200`):**

```json
{
  "poll": {
    "id": 1,
    "share_id": "a1b2c3d4",
    "question": "Favourite language?",
    "allow_multiple": 0,
    "expires_at": 1700003600000,
    "created_at": 1700000000000
  },
  "options": [
    { "id": 1, "poll_id": 1, "text": "TypeScript", "position": 0, "votes": 3 },
    { "id": 2, "poll_id": 1, "text": "Rust", "position": 1, "votes": 1 },
    { "id": 3, "poll_id": 1, "text": "Go", "position": 2, "votes": 0 }
  ],
  "total_votes": 4,
  "has_voted": false
}
```

Note: `admin_id` is deliberately excluded from this response.

**Errors:**

| Status | Reason |
|---|---|
| `404` | Poll not found |

---

### Vote on a Poll

`POST /api/polls/:shareId/vote`

**Request body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `option_ids` | number[] | Yes | IDs of chosen options (one for single-choice, one or more for multi-choice) |
| `voter_token` | string | Yes | Unique identifier for the voter (typically a UUID stored in the browser) |

**Response (`200`):**

```json
{
  "options": [
    { "id": 1, "poll_id": 1, "text": "TypeScript", "position": 0, "votes": 4 }
  ],
  "total_votes": 5,
  "has_voted": true
}
```

A successful vote also triggers a WebSocket broadcast to all connected clients on that poll.

**Errors:**

| Status | Reason |
|---|---|
| `400` | Missing `voter_token`, empty `option_ids`, multiple options on a single-choice poll, or invalid option ID |
| `404` | Poll not found |
| `409` | Voter has already voted on this poll |
| `410` | Poll has expired |

---

### Get Poll (Admin)

`GET /api/polls/admin/:adminId`

Returns the full poll data including the `admin_id`. No `has_voted` field is included.

**Response (`200`):**

```json
{
  "poll": {
    "id": 1,
    "share_id": "a1b2c3d4",
    "admin_id": "550e8400-e29b-41d4-a716-446655440000",
    "question": "Favourite language?",
    "allow_multiple": 0,
    "expires_at": null,
    "created_at": 1700000000000
  },
  "options": [...],
  "total_votes": 5
}
```

**Errors:**

| Status | Reason |
|---|---|
| `404` | Poll not found |

---

### Export Results

`GET /api/polls/admin/:adminId/export`

Downloads poll results in CSV or JSON format.

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `format` | string | `csv` or `json` (default: `json`) |

**CSV response (`200`):**

```
Option,Votes,Percentage
TypeScript,3,60%
Rust,1,20%
Go,1,20%
```

Headers: `Content-Type: text/csv`, `Content-Disposition: attachment; filename="poll-<shareId>.csv"`

**JSON response (`200`):**

```json
{
  "question": "Favourite language?",
  "options": [
    { "text": "TypeScript", "votes": 3, "percentage": "60%" },
    { "text": "Rust", "votes": 1, "percentage": "20%" },
    { "text": "Go", "votes": 1, "percentage": "20%" }
  ],
  "total_votes": 5,
  "exported_at": "2026-02-27T12:00:00.000Z"
}
```

Headers: `Content-Type: application/json`, `Content-Disposition: attachment; filename="poll-<shareId>.json"`

**Errors:**

| Status | Reason |
|---|---|
| `404` | Poll not found |

---

### Results Summary

`GET /api/polls/admin/:adminId/summary`

Returns a plain-text summary suitable for pasting into chat or email.

**Response (`200`):**

```
Poll: Favourite language?

TypeScript: 3 votes (60%)
Rust: 1 votes (20%)
Go: 1 votes (20%)

Total: 5 votes
```

Headers: `Content-Type: text/plain`

**Errors:**

| Status | Reason |
|---|---|
| `404` | Poll not found |

---

## Health

### Health Check

`GET /health`

Returns server status, uptime, poll count, and database connectivity.

**Response (`200`):**

```json
{
  "status": "ok",
  "uptime_seconds": 12345,
  "polls": 42,
  "database": "ok"
}
```

**Degraded response (`503`):**

If the database query fails, the endpoint returns:

```json
{
  "status": "degraded",
  "uptime_seconds": 12345,
  "polls": null,
  "database": "error"
}
```

---

## WebSocket

### Live Results

`ws://localhost:3000/ws/:shareId`

Connect to receive real-time vote broadcasts for a specific poll. The server pushes messages; client messages are ignored.

**Message format:**

```json
{
  "type": "results",
  "options": [
    { "id": 1, "poll_id": 1, "text": "TypeScript", "position": 0, "votes": 4 }
  ],
  "total_votes": 5
}
```

A message is broadcast every time a vote is recorded on the poll.
