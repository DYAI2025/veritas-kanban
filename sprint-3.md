# Sprint 3: Agent Orchestration

**Goal:** Spawn AI coding agents on tasks and stream their output.

**Started:** 2026-01-26
**Status:** Complete ✅

---

## Stories

| ID | Title | Status | Notes |
|----|-------|--------|-------|
| US-301 | Agent configuration | ✅ Complete | Settings UI with enable/disable |
| US-302 | Start agent on task | ✅ Complete | AgentService + API |
| US-303 | Real-time agent output streaming | ✅ Complete | WebSocket + terminal UI |
| US-304 | Agent conversation log persistence | ✅ Complete | .veritas-kanban/logs/ |
| US-305 | Send follow-up message to agent | ✅ Complete | stdin input |
| US-306 | Stop agent | ✅ Complete | SIGTERM/SIGKILL |
| US-307 | Agent completion handling | ✅ Complete | Auto status update |

---

## Progress Log

### 2026-01-26

**US-301: Agent configuration** ✅
- Settings dialog updated with agent management
- Toggle to enable/disable each agent
- Set default agent button
- Shows command and args

**US-302: Start agent on task** ✅
- AgentService with process spawning
- `POST /api/agents/:taskId/start`
- Runs in worktree directory
- Creates attempt record with ID

**US-303: Real-time agent output streaming** ✅
- WebSocket server with task subscriptions
- useAgentStream hook for React
- Terminal-style output panel (300px height)
- stdout/stderr with color coding
- Auto-scroll with pause on scroll up

**US-304: Agent conversation log persistence** ✅
- Logs at `.veritas-kanban/logs/{taskId}_{attemptId}.md`
- Markdown format with frontmatter
- Full stdin/stdout/stderr capture
- Timestamps for each message

**US-305: Send follow-up message to agent** ✅
- Text input at bottom of agent panel
- Enter key or Send button
- Writes to agent stdin
- Displayed with "You:" prefix in blue

**US-306: Stop agent** ✅
- `POST /api/agents/:taskId/stop`
- SIGTERM first, SIGKILL after 5s
- Confirmation dialog in UI
- Marks attempt as failed

**US-307: Agent completion handling** ✅
- Detects process exit code
- Status: complete (code 0) or failed
- Updates task status to "review"
- WebSocket notification to clients

---

## Commits

- `6b7a2f5` feat(US-301-307): agent orchestration
