# Getting Started

## Prerequisites

- [Bun](https://bun.sh) v1.1.0 or later

That's the only requirement. No Node.js, no Docker, no external database.

```bash
# Install Bun if you haven't already
curl -fsSL https://bun.sh/install | bash
```

---

## Installation

```bash
git clone https://github.com/danjdewhurst/bun-poll.git
cd bun-poll
bun install
```

The only installed package is `@types/bun` (dev dependency for TypeScript types). There are zero runtime dependencies.

---

## Running the Server

```bash
bun --hot index.ts
```

The server starts on `http://localhost:3000` by default. The `--hot` flag enables hot module reloading during development.

### Environment Variables

Create a `.env` file in the project root (Bun loads it automatically):

```env
PORT=3000
DB_PATH=bun-poll.sqlite
```

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `DB_PATH` | `bun-poll.sqlite` | SQLite database file path (relative to working directory) |

---

## Running Tests

```bash
bun test
```

Tests use an OS-assigned port and the same SQLite database (tables are cleared before each run). No separate test database setup is needed.

### Coverage

```bash
bun test --coverage
```

---

## Usage

1. Open `http://localhost:3000` in your browser
2. Enter a question and at least two options
3. Optionally enable multiple choice and/or set an expiry time
4. Click **Create Poll**
5. Share the **voting link** with participants
6. Keep the **admin link** private — it gives access to the admin dashboard

Voters see live results after casting their vote. The admin dashboard shows real-time results as votes come in via WebSocket.

---

## Monitoring

The `GET /health` endpoint returns server status in JSON:

```bash
curl http://localhost:3000/health
```

```json
{
  "status": "ok",
  "uptime_seconds": 12345,
  "polls": 42,
  "database": "ok"
}
```

Use this for load balancer health probes or uptime monitoring. The endpoint returns HTTP 503 with `"status": "degraded"` if the database is unreachable.
