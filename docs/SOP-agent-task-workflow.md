# SOP: Agent Task Workflow (Create → Work → Complete)

Use this playbook anytime an agent (human or LLM) takes a task from **todo** to **done**. It standardizes status changes, time tracking, summaries, and ensures telemetry stays usable.

---

## Roles

| Role               | Responsibilities                                                                        |
| ------------------ | --------------------------------------------------------------------------------------- |
| **Human / PM**     | Defines clear task + acceptance criteria, reviews results, enforces cross-model review. |
| **Worker Agent**   | Picks up a task, updates status/time, posts results, flags blockers.                    |
| **Reviewer Agent** | Opposite-model reviewer for code or high-risk work (see Cross-Model SOP).               |

---

## Lifecycle Overview

| Stage       | Action                                                                                            | Required?   |
| ----------- | ------------------------------------------------------------------------------------------------- | ----------- |
| 0. Intake   | Task created with clear title, description, acceptance criteria, type, project, sprint.           | ✅          |
| 1. Claim    | Agent sets status `in-progress`, starts timer, sets Agent Status → working.                       | ✅          |
| 2. Work     | Agent executes subtasks; marks subtasks complete as it goes.                                      | ✅          |
| 3. Update   | Post intermediate comment(s) or blockers; set status `blocked` if waiting on human.               | As needed   |
| 4. Complete | Stop timer, set status `done`, provide completion summary + attachments, capture lessons learned. | ✅          |
| 5. Review   | Trigger cross-model review if code touched or risk level ≥ medium.                                | ✅ for code |

---

## API Flow

```bash
# Claim
curl -X PATCH http://localhost:3001/api/tasks/<id> \
  -H "Authorization: Bearer <agent-key>" \
  -H "Content-Type: application/json" \
  -d '{"status":"in-progress"}'

curl -X POST http://localhost:3001/api/tasks/<id>/time/start \
  -H "Authorization: Bearer <agent-key>"

curl -X POST http://localhost:3001/api/agent/status \
  -H "Authorization: Bearer <agent-key>" \
  -d '{"status":"working","taskId":"<id>","taskTitle":"Fix CLI"}'

# Update (optional comment)
curl -X POST http://localhost:3001/api/tasks/<id>/comments \
  -H "Authorization: Bearer <agent-key>" \
  -d '{"text":"Blocked on dependency"}'

# Complete
curl -X POST http://localhost:3001/api/tasks/<id>/time/stop \
  -H "Authorization: Bearer <agent-key>"

curl -X PATCH http://localhost:3001/api/tasks/<id> \
  -H "Authorization: Bearer <agent-key>" \
  -d '{
    "status":"done",
    "completionSummary":"Added OAuth + tests",
    "lessonsLearned":"Always stub the provider"
  }'
```

---

## CLI Flow (fast path)

```bash
vk begin <id>                         # sets in-progress, starts timer, agent status → working
# ...do the work...
vk done <id> "Added OAuth + regression test"
```

Optional helpers:

```bash
vk block <id> "Waiting on design"     # sets blocked + comment
vk unblock <id>                       # returns to in-progress, restarts timer
vk time show <id>                     # verify time entries before completing
```

---

## Prompt Template (Worker Agent)

```
Task: <ID> — <Title>
URL: http://localhost:3000/task/<ID>

1. Set status to in-progress and start the timer (vk begin <id>).
2. Work each subtask; add notes/comments as you go.
3. If blocked, set status blocked + explain why.
4. When finished:
   - Stop timer + set status done (vk done <id> "summary").
   - Attach deliverables / link to repo.
   - Fill the lessons learned field if anything should go into AGENTS/CLAUDE.
5. If you touched code, queue cross-model review task before marking done.
```

Store this under `prompt-registry/agent-task-workflow.md` so every agent run is consistent.

---

## Lessons Learned & Notifications

- Always populate the **Completion Summary**. This becomes the notification that humans skim.
- If the task produced a reusable insight, add it to the **Lessons Learned** field so it surfaces in the global lessons feed (future docs).
- Notify humans via CLI: `vk comment <id> "@channel shipped" --author Veritas`

---

## Escalation

| Situation               | Action                                                                          |
| ----------------------- | ------------------------------------------------------------------------------- |
| Blocked > 15 minutes    | Set status `blocked`, leave blocker comment, ping PM.                           |
| Time tracking forgotten | Start timer immediately, add manual entry for elapsed time with reason.         |
| Reviewer disagrees      | Re-open task, create subtasks for fixes, keep cross-model reviewer in the loop. |

Follow this SOP and every task stays audit-friendly, searchable, and trustworthy.
