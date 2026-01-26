# Sprint 5: Veritas Integration

**Goal:** Veritas can manage tasks programmatically and spawn sub-agents.

**Started:** 2026-01-26
**Status:** In Progress

---

## Stories

| ID | Title | Status | Notes |
|----|-------|--------|-------|
| US-501 | CLI for task management | ✅ Complete | `vk` command globally available |
| US-502 | MCP server for external clients | ✅ Complete | stdio transport, 8 tools, 3 resources |
| US-503 | Veritas sub-agent integration | ✅ Complete | automation endpoints, CLI, MCP tools |
| US-504 | Memory system sync | ✅ Complete | summary endpoints, CLI vk memory, MCP tools |
| US-505 | Teams notification integration | ⏳ Todo | |

---

## Progress Log

### 2026-01-26

**US-501: CLI for task management** ✅
- Created `cli/` package with Commander.js
- Commands implemented:
  - `vk list` - list tasks with filters (--status, --type, --project, --verbose, --json)
  - `vk show <id>` - display task details
  - `vk create <title>` - create new tasks (--type, --project, --description, --priority)
  - `vk update <id>` - modify task fields
  - `vk start <id>` - start agent on task (--agent)
  - `vk stop <id>` - stop running agent
  - `vk archive <id>` - archive completed task
  - `vk delete <id>` - delete task
- Features:
  - JSON output option for all commands
  - Partial ID matching (use last 6 chars)
  - Color-coded output with chalk
  - Type icons (💻 🔍 📝 ⚡)
- Linked globally via npm link

**US-502: MCP server for external clients** ✅
- Created `mcp/` package with @modelcontextprotocol/sdk
- Tools implemented:
  - `list_tasks` - list with filters
  - `get_task` - get by ID (partial match)
  - `create_task` - create new task
  - `update_task` - modify fields
  - `start_agent` - start agent on task
  - `stop_agent` - stop running agent
  - `archive_task` - archive completed
  - `delete_task` - delete permanently
- Resources:
  - `kanban://tasks` - all tasks
  - `kanban://tasks/active` - in-progress/review
  - `kanban://task/{id}` - specific task
- Stdio transport for Claude Desktop
- Updated README with MCP config instructions

**US-503: Veritas sub-agent integration** ✅
- Added 'veritas' to AgentType enum
- New Task.automation field:
  - `sessionKey` - Clawdbot session key
  - `spawnedAt` - when sub-agent started
  - `completedAt` - when sub-agent finished
  - `result` - result summary
- API endpoints:
  - `POST /api/automation/:id/start` - start automation
  - `POST /api/automation/:id/complete` - complete automation
  - `GET /api/automation/pending` - list pending
  - `GET /api/automation/running` - list running
- CLI commands:
  - `vk automation:pending` (alias: ap)
  - `vk automation:running` (alias: ar)
  - `vk automation:start <id>` (alias: as)
  - `vk automation:complete <id>` (alias: ac)
- MCP tools:
  - `list_pending_automation`
  - `list_running_automation`
  - `start_automation`
  - `complete_automation`

**US-504: Memory system sync** ✅
- API endpoints:
  - `GET /api/summary` - overall status counts, projects, high-priority
  - `GET /api/summary/recent?hours=N` - recently completed tasks
  - `GET /api/summary/memory?hours=N` - markdown for memory files
- CLI commands:
  - `vk summary` - show kanban overview
  - `vk memory` - get memory-formatted summary
  - `vk memory -o ~/clawd/memory/YYYY-MM-DD.md` - append to file
- MCP tools:
  - `get_summary` - JSON summary
  - `get_memory_summary` - markdown summary

**Usage for Veritas:**
```bash
# During heartbeat, sync completed tasks to daily memory
vk memory -o ~/clawd/memory/$(date +%Y-%m-%d).md
```

---

## Commits

- `bec40a0` feat(US-501): CLI for task management
- `751a3bc` feat(US-502): MCP server for external clients
- `6112517` feat(US-503): Veritas sub-agent integration
- `7d7e92e` feat(US-504): Memory system sync
