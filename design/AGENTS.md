# AGENTS.md

## Scope

These instructions apply to `design/` and all of its descendants.

The physical local `design/` directory is the only default write destination for work performed under these instructions.

## Mandatory write boundary

- All intentional file creation, editing, deletion, moving, rendering, and exporting must stay inside this `design/` directory.
- Repository files outside `design/` may be inspected read-only when needed to match the existing application.
- Do not modify the frontend, backend, worker, Supabase files, Cloudflare files, dependencies, lockfiles, root documentation, or repository configuration.
- Do not use `../` or an absolute external destination for a write.
- Do not run formatters, generators, builds, package managers, or scripts when they can update files outside `design/`.
- Keep editable visualization sources, previews, exports, and temporary design artifacts inside `design/`.

## Required permission for exceptions

Before any proposed write outside `design/`, stop and ask the user for explicit permission. The request must include:

1. the exact external path,
2. the exact operation,
3. the reason it is required,
4. the expected effect on the application or repository.

The permission is single-purpose and valid only for the listed operation and paths. Do not reuse an earlier permission. A generic response such as `Akceptuję plan` does not authorize an external write unless that plan explicitly listed the exact external paths and operations.

## Git and validation

- Read-only Git inspection is allowed from the repository root.
- `git add`, `git commit`, `git push`, branch changes, and all other `.git` mutations require a separate explicit user request.
- When Git publication is authorized for a design task, stage only files under `design/**`, unless the user explicitly approves additional exact paths.
- Capture `git status --short` before the first write.
- Before finishing, run `git status --short` and `git diff --name-only` and confirm that all new changes are inside `design/` or covered by a current explicit exception.
- Preserve all unrelated pre-existing modifications without editing, reverting, staging, or committing them.
