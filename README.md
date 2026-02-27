# bun-poll

A lightweight, real-time poll application built entirely with [Bun](https://bun.sh) native APIs. No frameworks, no dependencies beyond Bun itself — just fast, live polls with WebSocket-powered updates.

## Features

- **Instant poll creation** — no sign-up required
- **Real-time results** — votes broadcast instantly via WebSockets
- **Shareable links** — unique short URLs for voting, separate admin links for managing
- **Single & multiple choice** — configurable per poll
- **Poll expiry** — optional time limit on voting
- **Vote deduplication** — one vote per browser, enforced client-side and at the database level
- **SQLite persistence** — WAL mode for concurrent reads, zero external services
- **Vanilla frontend** — no build step, no framework, just HTML/CSS/JS served via Bun's HTML imports

## Quick Start

```bash
# Install Bun if you haven't already
curl -fsSL https://bun.sh/install | bash

# Clone and install
git clone https://github.com/danjdewhurst/bun-poll.git
cd bun-poll
bun install

# Start the dev server
bun --hot index.ts
```

Open [http://localhost:3000](http://localhost:3000) to create your first poll.

## Usage

1. **Create** a poll at `/` — enter a question, add options, hit create
2. **Share** the voting link with participants
3. **Vote** at `/poll/:shareId` — results appear live after voting
4. **Monitor** results at the admin link — real-time updates, share link for easy distribution

## Project Structure

```
index.ts                     # Entry point — Bun.serve() with routes & WebSockets
src/
  db.ts                      # SQLite schema, migrations, prepared statements
  types.ts                   # Shared TypeScript interfaces
  server-ref.ts              # Module-level server reference for WS broadcasting
  routes/
    polls.ts                 # API route handlers (create, get, vote, admin)
    websocket.ts             # WebSocket open/close/message handlers
frontend/
  home.html / home.js        # Poll creation page
  poll.html / poll.js        # Voting & live results page
  admin.html / admin.js      # Admin results & share link page
  styles.css                 # Shared styles
index.test.ts                # Integration tests
```

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/polls` | Create a poll |
| `GET` | `/api/polls/:shareId` | Get poll with results |
| `POST` | `/api/polls/:shareId/vote` | Submit a vote |
| `GET` | `/api/polls/admin/:adminId` | Get poll results (admin) |

WebSocket connections are established at `/ws/:shareId` and receive live result broadcasts on each vote.

### Create a poll

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

Returns `{ "share_id": "a1b2c3d4", "admin_id": "uuid-..." }`.

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DB_PATH` | `bun-poll.sqlite` | SQLite database file path |

## Testing

```bash
bun test
```

Runs integration tests covering poll creation, voting, deduplication, expiry, multi-choice validation, and page rendering.

## Requirements

- [Bun](https://bun.sh) v1.1.0 or later

No other runtime dependencies. The database is SQLite via `bun:sqlite`, the server is `Bun.serve()`, and the frontend is plain HTML/CSS/JS bundled by Bun's HTML imports.

## Licence

[MIT](LICENCE) — Daniel Dewhurst
