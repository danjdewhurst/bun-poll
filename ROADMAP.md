# Roadmap

Ideas and planned improvements for bun-poll. Contributions welcome — pick anything that interests you and open a PR.

---

## Near Term

_Nothing here right now — suggest something!_

---

## Medium Term

### Richer Poll Types
- **Ranked choice** — voters order options by preference
- **Open-ended** — free-text responses alongside fixed options
- **Image options** — option cards with uploaded or linked images

### Admin Authentication
- Optional password protection on the admin page
- One-time magic link sent to the creator's email (if provided)

### Improved Voter Integrity
- ~~Combine localStorage token with IP fingerprint for stronger dedup~~ ✓ (see Done)
- Optional CAPTCHA challenge on high-traffic polls

### Share Buttons
- Native Web Share API on mobile
- Quick-share buttons for common platforms (clipboard, QR code, email)

---

## Long Term

### Poll Dashboard
- Browse and search your own polls (stored in localStorage or behind auth)
- Aggregate stats: total votes cast, active polls, average participation

### Vote Analytics
- Votes-over-time chart on the admin page
- Breakdown by time of day, peak voting window

### Theming
- Light / dark mode toggle
- Per-poll accent colour chosen at creation time

### Accessibility Audit
- Full ARIA labelling and keyboard navigation
- Screen reader testing
- Reduced-motion media query support

### Internationalisation
- Extract all UI strings into a locale file
- Community-contributed translations

### Deployment Options
- Dockerfile and docker-compose example
- One-click deploy buttons (Railway, Fly.io, Render)
- ~~`GET /health` with structured JSON for orchestration~~ ✓ (see Done)

---

## Done

### Scheduled Polls
- Set a future start time so voting opens automatically
- "Coming soon" state with countdown shown before the start time
- Voting blocked with 403 until start time
- Admin page shows "Starts" date in details and "Scheduled" badge

### Live Viewer Count
- "X watching" indicator on both poll and admin pages
- In-memory tracking of connected WebSocket clients per poll
- Count broadcasts on every connect/disconnect

### Input Guardrails
- Max length limits on questions (500 chars) and options (200 chars, max 20 options)
- Rate limiting on the vote endpoint (10 requests per 60s per IP)
- Content-Security-Policy headers via `<meta>` tags on all pages

### Code Quality
- Biome for linting and formatting with `bun run lint`, `bun run format`, and `bun run check`
- GitHub Actions CI workflow runs lint and tests on pushes and PRs to `main`

### Poll Management
- Admin can close voting early via `POST /api/polls/admin/:adminId/close`
- Admin can delete a poll entirely via `DELETE /api/polls/admin/:adminId`
- Admin can reset votes and start fresh via `POST /api/polls/admin/:adminId/reset`
- Management card on the admin page with confirmation dialogs

### Results Export
- Download results as CSV or JSON from the admin page
- One-click copy of a plain-text results summary for pasting into chat/email
- Export and summary endpoints under `/api/polls/admin/:adminId/`

### Health Check
- `GET /health` endpoint returning uptime, poll count, and database status
- Returns `"degraded"` with HTTP 503 when the database is unreachable
- Useful for monitoring and load balancer probes

### Feature Flags
- Environment variables to disable exports, WebSocket live updates, or admin management actions
- `GET /api/features` endpoint for frontend discovery of enabled features
- Disabled features return 403 from the API and hide their UI sections automatically
- All features enabled by default (opt-out model)

### Embed Mode
- Compact `<iframe>` embed via `/embed/:shareId` with minimal chrome
- Standalone styles in `embed.css` — no shared stylesheet dependency
- Works in any `<iframe>` on blogs, docs, or external sites

### Improved Voter Integrity (IP Fingerprint)
- Vote dedup combines localStorage token with voter IP address
- A vote is blocked if either the token or the IP has already voted on that poll
- Existing votes from before the migration (empty IP) are not matched

---

## Non-Goals

These are deliberately out of scope to keep bun-poll simple:

- **User accounts and auth** — polls are anonymous by design
- **Frameworks or ORMs** — Bun's native APIs are the whole point
- **Multi-database support** — SQLite is the only backend
- **Real-time collaboration editing** — this is a poll tool, not a doc editor
