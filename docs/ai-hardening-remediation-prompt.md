# AI Hardening Remediation Prompt

Use this prompt with a coding-capable AI agent that can read and edit the repository directly.

## Prompt

You are working inside the repository at `c:\Users\Admin\campus`.

Your mission is to continue the hardening and code-quality remediation until the project can honestly target `9.5/10` in every rubric category.

Before writing code, you must read these files and treat them as the source of truth:
1. `HARDENING_BASELINE.md`
2. `HARDENING_BACKLOG.md`
3. `HARDENING_EXECUTION_PLAN.md`

## Objective

Raise the project from its current state to a `9.5/10` standard across:
1. Folder organization
2. Architecture
3. API design
4. Database and queries
5. Performance
6. Constants/enums/config
7. Validation/error handling
8. Security
9. Documentation/DX

## Non-negotiable rules

1. Do not stop at analysis or planning.
2. Make real code changes in this repository.
3. Every improvement must include code, tests, and evidence where applicable.
4. Do not claim completion based on documentation alone.
5. Do not revert unrelated user changes.
6. Prefer minimal-risk, production-defensible changes over broad rewrites.
7. If you encounter a hard blocker, explain it briefly and continue with the next highest-value task.

## What to do first

Start with `FE-201` from `HARDENING_BACKLOG.md`.

Reason:
1. Remaining unsafe DOM string rendering is still capping Security, Frontend quality, and part of Performance.
2. This work has direct measurable effect and will unlock higher scores in multiple categories.

## FE-201 required execution

You must:
1. Audit all remaining `innerHTML`, `outerHTML`, and `insertAdjacentHTML` usage under `public/js/` and `views/`.
2. Classify each usage into:
   - safe static-only
   - dynamic but already escaped
   - unsafe and must be rewritten
3. Rewrite unsafe dynamic DOM string rendering to DOM API, `textContent`, `setAttribute`, `appendChild`, or a centralized safe helper.
4. If a safe helper is needed, implement it once and reuse it.
5. Update or extend hardening/security checks so new unsafe patterns fail automatically.
6. Add or update tests/evidence that prove user-controlled values no longer flow into unsafe HTML APIs.

## FE-201 output requirements

When you finish FE-201 in this turn, you must also:
1. Update `HARDENING_BACKLOG.md` status or progress notes only if the code really supports it.
2. Add or update evidence in `docs/` if you generate a useful audit artifact.
3. Run the relevant repo tests if possible.
4. Summarize exactly what was changed and what still remains.

## If FE-201 finishes with time remaining

Move immediately to `ARCH-201`.

For `ARCH-201`, you must:
1. Introduce or expand `repositories/` for critical domains.
2. Move query construction, projections, populations, and aggregate pipelines out of controllers and into repository methods.
3. Reduce direct model access from API controllers.
4. Keep service boundaries explicit and testable.

## Standards for all code changes

1. Keep controllers thin.
2. Prefer explicit naming over clever abstractions.
3. Preserve existing behavior unless you are fixing a documented risk.
4. Maintain the existing error envelope conventions.
5. Keep security-sensitive logic server-side.
6. Avoid introducing new unsafe frontend HTML rendering patterns.
7. Add focused tests, not placeholder tests.

## Evidence expectations

For every completed task, provide at least one of:
1. A passing repo test
2. A new or updated hardening control
3. A grep/audit result showing risk reduction
4. A runtime artifact under `docs/evidence/` when the task is performance or concurrency related

## Completion bar for each task

Do not mark a task done unless:
1. The code is actually changed
2. The new behavior is verifiable
3. The result moves at least one rubric category closer to `9.5`

## Final response format

At the end of your work, respond with:
1. What you changed
2. What you verified
3. What remains for the same backlog item
4. Which backlog item should be done next

## Start now

Begin with a repository-wide audit for `FE-201`, then implement the highest-risk fixes first.
