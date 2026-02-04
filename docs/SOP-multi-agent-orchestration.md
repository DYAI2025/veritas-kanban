# SOP: Multi-Agent Orchestration (PM + Workers)

When you ask “Hey Veritas, can you be the PM for this sprint and assign sub-agents?”, this is the playbook. One agent (usually Claude/Opus) acts as the project manager, spawns worker agents (Codex, Gemini, etc.), and reports back.

---

## Roles

| Role             | Description                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------- |
| **PM Agent**     | Owns the sprint, breaks work into tasks/subtasks, assigns/monitors workers, posts progress. |
| **Worker Agent** | Executes a single task end-to-end following the Agent Task SOP.                             |
| **Human Lead**   | Creates the sprint, reviews PM outputs, handles escalations.                                |

---

## PM Agent Checklist

1. **Read context**: AGENTS.md, sprint description, active tasks.
2. **Plan**: If tasks missing, create them (see Sprint Planning SOP).
3. **Assign**: For each task, either:
   - Self-assign if it’s planning/reporting work.
   - Spawn worker agent with clear instructions + acceptance criteria.
4. **Track**:
   - Update Agent Status panel using `vk agent sub-agent <count>`.
   - Make sure each worker uses `vk begin/done` so timers stay accurate.
5. **Review**:
   - Run cross-model review before marking tasks done.
   - Request fixes via subtasks or comments.
6. **Report**:
   - Post updates in task comments and daily standups (`vk summary standup --text`).
   - Ping human lead when blockers persist > 30 minutes.

---

## Worker Handoff Template

```
Task: <ID> — <Title>
Context: <link to research/requirements>
Deliverable: <clear definition of done>
Steps:
1. Run vk begin <id>.
2. Complete subtasks in order. Leave notes if deviations occur.
3. If blocked, set status blocked + explain.
4. On completion, vk done <id> "summary".
5. Request cross-model review by creating task <new id> tagged review.
Uploads: <where to store artifacts>
```

Store under `prompt-registry/worker-handoff.md`.

---

## Status Reporting Expectations

| Cadence                     | Mechanism                                            | Owner       |
| --------------------------- | ---------------------------------------------------- | ----------- |
| Start of day                | Comment on sprint tracker task summarizing plan.     | PM          |
| After each worker completes | Worker comment + PM reaction (✅/request changes).   | Worker + PM |
| Daily standup               | `vk summary standup --text` posted to comms channel. | PM          |
| Sprint end                  | Archive tasks, write lessons learned, close sprint.  | PM          |

Use emojis/reactions sparingly; detailed summaries live in comments.

---

## Error Escalation

| Issue                      | PM action                                                  |
| -------------------------- | ---------------------------------------------------------- |
| Worker exceeds time budget | Stop timer, leave comment, ping human.                     |
| Tooling failure (API down) | Run `pnpm dev:clean`, file issue, reassign.                |
| Reviewer rejects work      | Re-open task, create fix subtasks, keep reviewer looped.   |
| PM stuck                   | Escalate immediately — PMs should not be blocked > 15 min. |

---

## Example: Opus PM orchestrating Codex workers

1. **Human**: `sessions_spawn` Opus with task “Be PM for US-1600”.
2. **Opus (PM)**: Reads sprint tasks, assigns `US-1601` to itself (docs) and `US-1602` to Codex.
3. **Opus**: Runs `vk agent sub-agent 1` to show a worker is active.
4. **Opus**: Spawns Codex worker with handoff template; instructs to run `vk begin task_...` etc.
5. **Codex**: Executes, posts completion summary, requests cross-model review from Claude.
6. **Opus**: Reviews, marks done, updates sprint recap comment.
7. **Opus**: Sets agent status back to idle once all workers complete (`vk agent idle`).

Following this SOP keeps human oversight minimal while preserving accountability.
