# Changelog

## [1.2.0](https://github.com/danjdewhurst/bun-poll/compare/v1.1.0...v1.2.0) (2026-02-27)


### Features

* add compact iframe embed mode for polls ([9ef699c](https://github.com/danjdewhurst/bun-poll/commit/9ef699c2f05272abbd451305d4833a031ae42352))
* add IP-based vote deduplication alongside token check ([15f2a94](https://github.com/danjdewhurst/bun-poll/commit/15f2a944c84490d0c5e0497f74e81334ebfb01df))
* add scheduled polls with future start time ([e40b338](https://github.com/danjdewhurst/bun-poll/commit/e40b338ac1d9254b4c7891c8fbc9df3ef30ca32e))
* add share buttons (copy link, email, QR code, native share) ([ede6a29](https://github.com/danjdewhurst/bun-poll/commit/ede6a298512bd8fae8e068615b07fbe86e0a80a1))


### Bug Fixes

* elevate share card stacking context above sibling cards ([eb2f4a2](https://github.com/danjdewhurst/bun-poll/commit/eb2f4a2df5187347b6959c51e6e228d221cf6fa9))
* QR popover clipped by parent card overflow ([7bd0a18](https://github.com/danjdewhurst/bun-poll/commit/7bd0a184f5d239d26a253226ee16fc158a4ead42))
* style datetime-local input and add scheduled poll support to embed ([6797d11](https://github.com/danjdewhurst/bun-poll/commit/6797d11655988b2fd0be3d22dd1acef6a37c9f66))

## [1.1.0](https://github.com/danjdewhurst/bun-poll/compare/v1.0.0...v1.1.0) (2026-02-27)


### Features

* add feature flags to toggle exports, WebSocket, and admin management ([553089c](https://github.com/danjdewhurst/bun-poll/commit/553089c8317714194a0f67cce2c070ced096e53f))

## 1.0.0 (2026-02-27)


### Features

* add GET /health endpoint with uptime, poll count, and DB status ([64e68d9](https://github.com/danjdewhurst/bun-poll/commit/64e68d94d73ba20db8590f962ce93bccb6c993b4))
* add input guardrails (validation, rate limiting, CSP) ([508fe16](https://github.com/danjdewhurst/bun-poll/commit/508fe16740b014be380c63222d4273f733155f7b))
* add live viewer count on poll and admin pages ([d46a098](https://github.com/danjdewhurst/bun-poll/commit/d46a0986aaff8ecc7ed8e9528393f9151f0f5e29))
* add poll management (close, delete, reset) ([e5273f5](https://github.com/danjdewhurst/bun-poll/commit/e5273f50a3b4dcda9d1f1305ac717a37b0c0aef0))
* add results export and summary endpoints ([5833479](https://github.com/danjdewhurst/bun-poll/commit/58334790184e2e43d2fd1ad9de829bda87d3fb5e))
* initial release of bun-poll ([977fad0](https://github.com/danjdewhurst/bun-poll/commit/977fad068972d4a3242d5ff62bdc4129000eca9e))


### Bug Fixes

* adjust spacing around real-time vote updates label ([abe4886](https://github.com/danjdewhurst/bun-poll/commit/abe48864bbfac230694a9f4b45c3d1ea612997df))
* align ASCII diagram in README How It Works section ([c0b3b30](https://github.com/danjdewhurst/bun-poll/commit/c0b3b301826c6074bd2dcba77d81a4ec59a54564))
* harden security, accessibility, and code quality across codebase ([2af989a](https://github.com/danjdewhurst/bun-poll/commit/2af989afdef407581ea825fd68875f61cae95d8a))
