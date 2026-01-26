# Veritas Kanban

A local-first task management and AI agent orchestration platform built for Brad Groux and Veritas.

## Features

- 📋 **Kanban Board** - Visual task management with drag-and-drop
- 🤖 **AI Agent Orchestration** - Spawn Claude Code, Amp, Copilot, Gemini
- 🌳 **Git Worktrees** - Isolated branches for each coding task
- 📝 **Markdown Storage** - Human-readable task files with frontmatter
- 🔍 **Code Review** - Diff viewing and inline comments
- 🌙 **Dark Mode** - Easy on the eyes

## Quick Start

```bash
# Clone the repo
git clone https://github.com/dm-bradgroux/veritas-kanban.git
cd veritas-kanban

# Install dependencies
pnpm install

# Start development
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 22+ |
| Language | TypeScript (strict) |
| Server | Express + WebSocket |
| Frontend | React 19 + Vite + shadcn/ui |
| Persistence | Markdown files (gray-matter) |
| Git | simple-git |

## Project Structure

```
veritas-kanban/
├── .devcontainer/     # Dev container config
├── server/            # Express API + WebSocket
├── web/               # React frontend
├── shared/            # Shared TypeScript types
├── tasks/             # Task storage (markdown files)
│   ├── active/        # Current tasks
│   └── archive/       # Completed tasks
└── .veritas-kanban/   # Config and runtime data
```

## Repositories

- **Work**: https://github.com/dm-bradgroux/veritas-kanban
- **Personal**: https://github.com/BradGroux/veritas-kanban

## Development

### Prerequisites

- Node.js 22+
- pnpm 9+

### Commands

```bash
pnpm dev        # Start dev server (frontend + backend)
pnpm build      # Build for production
pnpm typecheck  # Run TypeScript checks
pnpm lint       # Run ESLint
```

### Dev Container

This project includes a VS Code Dev Container configuration. Open in VS Code and select "Reopen in Container" for a consistent development environment.

## Task File Format

Tasks are stored as markdown files with YAML frontmatter:

```markdown
---
id: "task_20260126_abc123"
title: "Implement feature X"
type: "code"
status: "in-progress"
priority: "high"
project: "rubicon"
---

## Description

Details about the task...
```

## License

MIT
