# Changelog

All notable changes to Veritas Kanban are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-01-30

### Added

#### Agent CRUD Management

- Full Add/Edit/Remove for agents in Settings → Agents
- Add Agent form with name, type slug (auto-generated), command, and args
- Edit Agent: inline edit name, command, and args via pencil icon
- Remove Agent: trash icon with confirmation dialog (blocked for the default agent)
- `AgentType` loosened from a fixed enum (`claude-code | amp | copilot | gemini | veritas`) to any string slug — users can define completely custom agents

#### Dark/Light Mode Toggle

- Settings → General → Appearance section with toggle switch (moon/sun icon)
- Persists to localStorage; default is dark mode
- Inline script in `index.html` prevents flash of wrong theme on page load

#### UI Theme

- Primary color changed to purple (`270° 50% 40%`) with white text in dark mode
- Focus rings updated to purple
- Switch toggle thumbs: white in dark mode, black in light mode

### Fixed

#### Cross-Column Drag-and-Drop

- Tasks can now be dragged between Kanban columns reliably
- Added local state management during drag for real-time column updates
- Custom collision detection using `pointerWithin` with `rectIntersection` fallback
- Tooltips suppressed during drag operations to prevent interference

#### Dashboard

- Agent Comparison chart: fixed broken data fetch — replaced raw `fetch()` with `apiFetch()` to properly unwrap the API response envelope
- Rolling average line: changed from purple to vibrant cyan-teal to contrast new purple theme
- Bar chart hover cursor: changed from white flash to subtle muted fill
- Drill-down panels: removed duplicate X close button
- Drill-down focus rings: changed to `ring-inset` to prevent clipping at panel edges
- Dashboard section `overflow-hidden`: now only applies when the section is collapsed
- StatusTimeline: redesigned to Daily Activity (75%) + Recent Status Changes (25%) side-by-side layout
- `open-task` event: wired up so clicking tasks in drill-down panels opens the task detail panel (with API fallback for deleted tasks)

---

## [1.0.0] - 2026-01-29

### 🎉 Initial Public Release

Veritas Kanban is an AI-native project management board built for developers and autonomous coding agents.

### Features

#### Core Board

- Kanban board with drag-and-drop between columns (Backlog, To Do, In Progress, Review, Done)
- Task detail panel with full editing (title, description, priority, status, type, project, sprint)
- Subtasks with progress tracking on cards
- Task type system with icons and color-coded borders
- Sprint management with auto-archive
- Bulk operations and keyboard shortcuts

#### Code Workflow

- Git worktree integration for code tasks
- Diff viewer for code review
- Line-level review comments
- Approval workflow with review decisions
- Merge and close integration

#### AI Agent Integration

- Agent orchestration system for autonomous task execution
- Agent status tracking (idle, working, sub-agent mode)
- Time tracking per task with automatic and manual entries
- REST API designed for AI agent consumption
- MCP (Model Context Protocol) server for LLM tool integration
- CLI for headless task management

#### Dashboard & Analytics

- Sprint velocity tracking
- Cost budget tracking with daily digest
- Task-level metrics and telemetry
- Status history timeline

#### Security

- JWT authentication with secret rotation
- Admin key + API key authentication
- CSP headers with Helmet
- Rate limiting with express-rate-limit
- CORS origin validation
- WebSocket origin validation
- Server-side MIME type validation for uploads
- Markdown sanitization (XSS prevention)
- Timing-safe credential comparison
- Credential redaction from task data

#### Performance

- In-memory task caching with file watchers
- Config caching with write invalidation
- Gzip response compression
- Lazy-loaded dashboard with vendor chunk splitting (69% bundle reduction)
- Pagination and summary mode for large datasets
- Reduced polling when WebSocket connected
- Telemetry retention and automatic cleanup

#### Infrastructure

- Production Dockerfile with multi-stage build (runs as non-root)
- GitHub Actions CI pipeline
- Pre-commit hooks with husky + lint-staged
- Structured logging with pino
- Request ID middleware for tracing
- Graceful shutdown with service disposal
- Unhandled rejection and exception handlers

#### Documentation

- OpenAPI/Swagger API documentation
- Deployment guide (Docker, bare metal, nginx, Caddy, systemd)
- Security audit reports
- Contributing guide with conventional commits
- Code of Conduct (Contributor Covenant v2.1)

#### Testing

- 61 test files, 1,143 unit tests (server + frontend) with Vitest
- End-to-end tests with Playwright (19/19 passing)
- Gitleaks pre-commit hook for secret scanning

### Technical Details

- **Frontend:** React 19, Vite 6, TypeScript 5.7, Tailwind CSS 3.4, Shadcn UI
- **Backend:** Express 4.21, TypeScript, file-based storage
- **Testing:** Playwright 1.58, Vitest 4
- **Runtime:** Node.js 22+, pnpm 9+

---

_Built by [Digital Meld](https://digitalmeld.io) — AI-driven enterprise automation._

[1.1.0]: https://github.com/BradGroux/veritas-kanban/releases/tag/v1.1.0
[1.0.0]: https://github.com/BradGroux/veritas-kanban/releases/tag/v1.0.0
