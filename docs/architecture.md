# Architecture

bun-poll is a server-rendered polling application with zero runtime dependencies. Everything is built on [Bun](https://bun.sh) native APIs.

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Bun |
| HTTP server | `Bun.serve()` |
| WebSockets | `Bun.serve()` built-in WebSocket support |
| Database | SQLite via `bun:sqlite` |
| Frontend | Plain HTML/CSS/JS via Bun's HTML imports |
| Bundling | Bun's built-in bundler (HTML imports) |

No Express, no Vite, no ORM, no npm runtime packages.

---

## Project Structure

```
index.ts                      Entry point — Bun.serve() with routes and WebSockets
index.test.ts                 Integration tests (bun:test)
src/
  db.ts                       SQLite schema, pragmas, prepared statements
  types.ts                    Shared TypeScript interfaces
  server-ref.ts               Module-level server reference for WS broadcasting
  routes/
    polls.ts                  API route handlers (create, get, vote, admin, export, summary, close, delete, reset)
    health.ts                 GET /health handler
    websocket.ts              WebSocket open/close/message handlers
frontend/
  home.html / home.js         Poll creation page
  poll.html / poll.js         Voting and live results page
  admin.html / admin.js       Admin results and share link page
  embed.html / embed.js / embed.css  Compact embeddable poll view
  styles.css                  Shared stylesheet
```

---

## Request Flow

1. `Bun.serve()` in `index.ts` matches incoming requests against named routes
2. HTML routes (`/`, `/poll/:shareId`, `/admin/:adminId`, `/embed/:shareId`) serve bundled HTML files directly via Bun's HTML imports
3. API routes (`/api/polls/*`) delegate to handler functions in `src/routes/polls.ts` (including export, summary, close, reset, and delete endpoints under `/api/polls/admin/:adminId/`)
4. The `fetch` fallback handles WebSocket upgrades on `/ws/:shareId` and returns 404 for everything else
5. After a successful vote, the handler calls `server.publish()` to broadcast updated results to all WebSocket subscribers on that poll's topic

---

## Database

SQLite with WAL (write-ahead logging) mode for concurrent read performance. Foreign keys are enforced.

### Schema

**polls**

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER | Primary key, autoincrement |
| `share_id` | TEXT | 8-char hex, unique — used in public URLs |
| `admin_id` | TEXT | UUID v4, unique — used in admin URLs |
| `question` | TEXT | The poll question |
| `allow_multiple` | INTEGER | 0 = single choice, 1 = multiple choice |
| `starts_at` | INTEGER | Unix ms timestamp, nullable — voting blocked before this time |
| `expires_at` | INTEGER | Unix ms timestamp, nullable |
| `created_at` | INTEGER | Unix ms timestamp |

**options**

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER | Primary key, autoincrement |
| `poll_id` | INTEGER | Foreign key to polls, cascade delete |
| `text` | TEXT | Option label |
| `position` | INTEGER | Display order (0-based) |

**votes**

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER | Primary key, autoincrement |
| `poll_id` | INTEGER | Foreign key to polls, cascade delete |
| `option_id` | INTEGER | Foreign key to options, cascade delete |
| `voter_token` | TEXT | Client-generated UUID |
| `voter_ip` | TEXT | Voter's IP address (default empty string) |
| `created_at` | INTEGER | Unix ms timestamp |

An index `idx_votes_poll_ip` on `(poll_id, voter_ip)` supports fast IP-based dedup lookups.

A `UNIQUE(poll_id, option_id, voter_token)` constraint prevents the same voter from casting duplicate votes on the same option. `INSERT OR IGNORE` provides a database-level backstop.

### Prepared Statements

All queries are compiled once at module load time using `db.prepare()`. This avoids re-parsing SQL on every request. See `src/db.ts` for the full list.

---

## WebSocket Architecture

WebSocket support is built into `Bun.serve()` — no external library needed.

### Connection Lifecycle

1. Client connects to `/ws/<shareId>`
2. The `fetch` fallback matches the path and calls `server.upgrade()` with `{ data: { shareId } }`
3. On `open`, the socket subscribes to the pub/sub topic `poll-<shareId>`, the viewer count for that poll is incremented, and a `viewers` message is broadcast to all subscribers
4. On `close`, the viewer count is decremented and the updated count is broadcast before the socket unsubscribes
5. Client messages are ignored (server-push only)

### Viewer Tracking

An in-memory `Map<string, number>` tracks the number of connected WebSocket clients per poll (`shareId` to count). On each connect/disconnect, a `{ type: "viewers", count }` message is published to all subscribers. Entries are cleaned up when the count reaches zero.

### Broadcasting

When a vote is recorded in `src/routes/polls.ts`, the handler calls:

```ts
server.publish(`poll-${shareId}`, JSON.stringify(message));
```

This delivers updated results to every connected client on that poll, with no polling or manual fan-out.

### Server Reference

The server instance is created in `index.ts` but needed in `src/routes/polls.ts` for broadcasting. `src/server-ref.ts` acts as a simple module-level singleton to bridge this:

- `setServer(s)` — called once after `Bun.serve()`
- `getServer()` — called by route handlers when they need to publish

---

## Frontend

Each page is a standalone HTML file that imports its own JS. Bun's HTML imports handle bundling automatically — no build step or config needed.

### Pages

| Route | HTML | JS | Purpose |
|---|---|---|---|
| `/` | `home.html` | `home.js` | Create a poll |
| `/poll/:shareId` | `poll.html` | `poll.js` | Vote and view live results |
| `/admin/:adminId` | `admin.html` | `admin.js` | Admin dashboard with share link |
| `/embed/:shareId` | `embed.html` | `embed.js` | Compact embeddable poll view |

### Shared Styles

`frontend/styles.css` defines a dark theme with CSS custom properties. Key design tokens:

- Backgrounds: `--bg`, `--surface`, `--surface-raised`
- Text: `--text`, `--text-secondary`, `--text-muted`
- Accent gradient: `--accent-start` (orange) to `--accent-end` (yellow)
- Fonts: `DM Sans` (body), `Instrument Serif` (headings)

### Voter Token

Each browser generates a UUID per poll (`voter_token_<shareId>` in localStorage). This token is sent with votes and used to check `has_voted` status. It's a client-side deduplication mechanism backed by the database-level unique constraint.

The server also records the voter's IP address and checks it as a secondary deduplication layer. A vote is blocked if either the token or the IP has already voted on that poll. Existing votes from before the IP migration (with an empty IP field) are not matched.

---

## Rate Limiting

The vote endpoint is protected by an in-memory rate limiter (`src/rate-limit.ts`). Each client IP is allowed a maximum of 10 vote requests per 60-second sliding window. The implementation uses a `Map<string, { count, resetAt }>` with periodic cleanup of expired entries every 60 seconds via `setInterval`.

When a client exceeds the limit, the server responds with HTTP 429 and includes a `Retry-After` header indicating how many seconds remain until the window resets. The client IP is extracted from the `X-Forwarded-For` or `X-Real-IP` headers, falling back to `"unknown"` for direct connections.

This is deliberately simple — an in-memory store is sufficient for a single-process Bun server. If horizontal scaling were needed, a shared store (e.g. Redis) would replace the `Map`.

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `DB_PATH` | `bun-poll.sqlite` | SQLite database file path |

Bun loads `.env` files automatically — no dotenv needed.
