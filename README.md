<div align="center">

# 🗳️ bun-poll

**Real-time polls, zero dependencies.**

A lightweight poll app built entirely with [Bun](https://bun.sh) native APIs.
No frameworks. No npm bloat. Just fast, live polls with WebSocket-powered updates.

[![MIT Licence](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENCE)
[![Bun](https://img.shields.io/badge/runtime-Bun-f9f1e1?logo=bun&logoColor=000)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/lang-TypeScript-3178c6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/database-SQLite-003B57?logo=sqlite&logoColor=fff)](https://www.sqlite.org/)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](#)
[![CI](https://github.com/danjdewhurst/bun-poll/actions/workflows/ci.yml/badge.svg)](https://github.com/danjdewhurst/bun-poll/actions/workflows/ci.yml)

![bun-poll preview](preview.png)

</div>

---

## Why bun-poll?

Most poll tools are over-engineered SaaS products or require a dozen packages just to get started. **bun-poll** takes a different approach:

- **Zero runtime dependencies** — only Bun and its built-in APIs
- **Single command to run** — no build step, no bundler config, no Docker
- **Real-time by default** — every vote broadcasts instantly via WebSockets
- **SQLite persistence** — WAL mode for concurrent reads, no external database needed

---

## Features

| | Feature | Description |
|---|---|---|
| ⚡ | **Instant creation** | Create polls in seconds — no sign-up required |
| 📡 | **Live results** | Votes broadcast to all viewers instantly via WebSockets |
| 👁️ | **Live viewer count** | See how many people are watching a poll in real time |
| 🔗 | **Shareable links** | Unique short URLs for voting, separate admin links for managing |
| ☑️ | **Single & multiple choice** | Configurable per poll |
| ⏱️ | **Poll expiry** | Optional time limit on voting |
| 📅 | **Scheduled polls** | Set a future start time so voting opens automatically |
| 🛡️ | **Vote deduplication** | One vote per browser and IP, enforced client-side and at the database level |
| 📤 | **Results export** | Download results as CSV or JSON, or copy a plain-text summary |
| 🔧 | **Poll management** | Close voting early, reset votes, or delete polls from the admin page |
| 🛡️ | **Input guardrails** | Length limits, rate limiting on votes, and Content-Security-Policy headers |
| 💾 | **SQLite persistence** | WAL mode, zero external services |
| 🎛️ | **Feature flags** | Toggle exports, WebSockets, or admin actions on/off via environment variables |
| 🖼️ | **Embeddable polls** | Compact `<iframe>` embed mode for blogs and docs via `/embed/:shareId` |
| 🪶 | **Vanilla frontend** | No build step, no framework — just HTML/CSS/JS via Bun's HTML imports |

---

## Demo

Try it out at **[bun-poll.onrender.com](https://bun-poll.onrender.com/)**

> [!CAUTION]
> This is a demo instance — not intended for production use. Data is not properly persisted and may be reset at any time.

---

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

Open **[http://localhost:3000](http://localhost:3000)** to create your first poll.

---

## How It Works

1. **Create** a poll at `/` — enter a question, add options, hit create
2. **Share** the voting link with participants
3. **Vote** at `/poll/:shareId` — results appear live after voting
4. **Monitor** results at the admin link — real-time updates with a share link for easy distribution

---

## Project Structure

```
index.ts                      Entry point — Bun.serve() with routes & WebSockets
src/
  db.ts                       SQLite schema, migrations, prepared statements
  types.ts                    Shared TypeScript interfaces
  server-ref.ts               Module-level server reference for WS broadcasting
  routes/
    polls.ts                  API route handlers (create, get, vote, admin)
    websocket.ts              WebSocket open/close/message handlers
frontend/
  home.html / home.js         Poll creation page
  poll.html / poll.js         Voting & live results page
  admin.html / admin.js       Admin results & share link page
  embed.html / embed.js / embed.css  Compact embeddable poll view
  styles.css                  Shared styles
index.test.ts                 Integration tests
```

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DB_PATH` | `bun-poll.sqlite` | SQLite database file path |
| `FEATURE_EXPORTS` | `true` | Enable CSV/JSON export and copy summary |
| `FEATURE_WEBSOCKET` | `true` | Enable WebSocket live updates and viewer counts |
| `FEATURE_ADMIN_MANAGEMENT` | `true` | Enable close, reset, and delete actions |

> Bun loads `.env` files automatically — no dotenv needed.

### Feature Flags

Any feature flag can be disabled by setting it to `"false"` or `"0"` in your `.env` or shell environment. Disabled features return **403** from the API and their UI sections are hidden automatically. A `GET /api/features` endpoint returns the current flag state as JSON.

```bash
# Example: run with exports and admin management disabled
FEATURE_EXPORTS=false FEATURE_ADMIN_MANAGEMENT=false bun --hot index.ts
```

---

## Testing

```bash
bun test
```

Covers poll creation, voting, deduplication (token + IP), expiry, scheduled polls, multi-choice validation, embeds, and page rendering.

---

## Linting & Formatting

The project uses [Biome](https://biomejs.dev) for linting and formatting.

```bash
# Check for lint and formatting issues
bun run lint

# Auto-format all files
bun run format

# Check and auto-fix everything
bun run check
```

---

## Releases

Versioning is fully automated via [Release Please](https://github.com/googleapis/release-please). On every push to `main`, the workflow analyses conventional commit messages and:

1. Creates or updates a **Release PR** with a version bump and changelog
2. When merged, tags the release and publishes a **GitHub Release**

Version bumps follow [Semantic Versioning](https://semver.org):

| Commit prefix | Version bump | Example |
|---|---|---|
| `fix:` | Patch | 0.1.0 → 0.1.1 |
| `feat:` | Minor | 0.1.0 → 0.2.0 |
| `feat!:` / `BREAKING CHANGE:` | Major | 0.1.0 → 1.0.0 |

---

## Requirements

- [Bun](https://bun.sh) v1.1.0+

That's it. No other runtime dependencies. The database is SQLite via `bun:sqlite`, the server is `Bun.serve()`, and the frontend is plain HTML/CSS/JS bundled by Bun's HTML imports.

---

## Documentation

- **[Getting Started](docs/getting-started.md)** — installation, running, and configuration
- **[API Reference](docs/api.md)** — endpoints, WebSocket, request/response examples
- **[Architecture](docs/architecture.md)** — project structure, database schema, design decisions
- **[Testing](docs/testing.md)** — running tests, coverage, test suite reference

## Roadmap

See **[ROADMAP.md](ROADMAP.md)** for planned features and ideas — contributions welcome!

## Contributing

Feel free to open an issue or submit a pull request.

---

<div align="center">

**[MIT Licence](LICENCE)** — Made by [Daniel Dewhurst](https://github.com/danjdewhurst)

</div>
