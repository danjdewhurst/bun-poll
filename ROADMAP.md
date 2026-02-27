# Roadmap

Ideas and planned improvements for bun-poll. Contributions welcome — pick anything that interests you and open a PR.

---

## Near Term

### Results Export
- Download results as CSV or JSON from the admin page
- One-click copy of a results summary for pasting into chat/email

### Poll Management
- Admin can close voting early
- Admin can delete a poll entirely
- Admin can reset votes and start fresh

### Input Guardrails
- Max length limits on questions and options
- Rate limiting on the vote endpoint (per IP / per token)
- Content-Security-Policy headers

### Live Viewer Count
- Show "X people watching" on the poll and admin pages
- Track connected WebSocket clients per poll

### Health Check
- `GET /health` endpoint returning uptime, poll count, and database status
- Useful for monitoring and load balancer probes

---

## Medium Term

### Richer Poll Types
- **Ranked choice** — voters order options by preference
- **Open-ended** — free-text responses alongside fixed options
- **Image options** — option cards with uploaded or linked images

### Scheduled Polls
- Set a future start time so voting opens automatically
- "Coming soon" state shown before the start time

### Embed Mode
- Compact `<iframe>` embed for blogs and docs
- `/embed/:shareId` route with minimal chrome and a query param API for styling

### Admin Authentication
- Optional password protection on the admin page
- One-time magic link sent to the creator's email (if provided)

### Improved Voter Integrity
- Combine localStorage token with IP fingerprint for stronger dedup
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
- `GET /health` with structured JSON for orchestration

---

## Non-Goals

These are deliberately out of scope to keep bun-poll simple:

- **User accounts and auth** — polls are anonymous by design
- **Frameworks or ORMs** — Bun's native APIs are the whole point
- **Multi-database support** — SQLite is the only backend
- **Real-time collaboration editing** — this is a poll tool, not a doc editor
