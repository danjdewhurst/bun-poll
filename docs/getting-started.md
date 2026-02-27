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

## Linting & Formatting

The project uses [Biome](https://biomejs.dev) for linting and formatting. Available scripts:

```bash
# Check for lint and formatting issues
bun run lint

# Auto-format all files
bun run format

# Check and auto-fix everything (lint + format)
bun run check
```

Configuration lives in `biome.json` at the project root.

---

## Usage

1. Open `http://localhost:3000` in your browser
2. Enter a question and at least two options
3. Optionally enable multiple choice, set an expiry time, or schedule a future start time
4. Click **Create Poll**
5. Share the **voting link** with participants
6. Keep the **admin link** private — it gives access to the admin dashboard

Voters see live results after casting their vote. The admin dashboard shows real-time results as votes come in via WebSocket.

### Embedding a Poll

You can embed any poll in an external page using an `<iframe>`:

```html
<iframe src="http://localhost:3000/embed/<shareId>" width="400" height="300" frameborder="0"></iframe>
```

The embed page shows a compact view with minimal chrome, suitable for blogs and documentation.

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
