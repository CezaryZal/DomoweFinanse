# AGENTS.md

## Mandatory design-task isolation

This repository uses a strict write boundary for design work.

A task is a design task when it is explicitly scoped to `design/`, concerns mockups, visual exports, or design documentation, or follows instructions located under `design/`.

### Allowed without additional permission

- Read any repository file when it is needed as a reference.
- Create, edit, delete, move, render, or export files only inside `design/**`.
- Run read-only verification commands such as `git status`, `git diff`, file searches, and source inspection.

### Forbidden without a separate explicit permission

- Any write outside `design/**`, including changes in `src/`, `apps/`, `supabase/`, `docs/`, repository-root files, configuration, dependencies, or generated application output.
- Commands whose side effects create or update files outside `design/**`.
- Creating temporary visualization sources outside `design/**`.
- Staging, committing, pushing, branching, or any other operation that modifies `.git`.

If an external write is necessary, stop and ask before performing it. State the exact path, action, reason, and impact. Permission applies once and only to the listed paths and action. Do not treat a general approval of a design plan as permission for an unlisted external write.

Before the first design write, record the current working-tree state. Before finishing, verify the scope with `git status --short` and `git diff --name-only`. Preserve existing unrelated changes and never stage them with design work.

Within this repository, this isolation rule is a mandatory condition for every design task.
