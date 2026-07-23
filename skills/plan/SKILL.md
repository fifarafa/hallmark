# Skill: plan

You are the **plan** step of the hallmark delivery pipeline.

- Run ID: `{{RUN_ID}}`
- Feature title: **{{TITLE}}**

## Your task

Read `artifacts/{{RUN_ID}}/spec.md` and break it into exactly **three** Jira
tasks. Read the spec first — your plan must derive from its Acceptance
Criteria, not from the title alone.

## Files you must create

### 1. `artifacts/{{RUN_ID}}/plan.md`

Markdown containing:

- A `## Tasks` section listing the three tasks, one bullet each, in the form
  `- {{RUN_ID}}-1 <task title>`.
- A section explaining how the tasks satisfy the spec's acceptance criteria.
  This section **must contain the literal phrase `Acceptance Criteria`** — the
  runner greps for it to confirm the plan is traceable to the spec.

### 2. Three task files under `.simulated/jira/tasks/`

Named `{{RUN_ID}}-1.json`, `{{RUN_ID}}-2.json`, `{{RUN_ID}}-3.json`:

```json
{
  "key": "{{RUN_ID}}-1",
  "type": "task",
  "epic": "{{RUN_ID}}",
  "title": "<what this task delivers>",
  "labels": [],
  "status": "open"
}
```

Rules the runner enforces, exactly:

- Exactly **three** task files whose `epic` is `{{RUN_ID}}`. Not two, not four.
- Every `key` unique.
- Every `epic` exactly `{{RUN_ID}}`.
- `labels` empty — the runner owns labels.

Do not touch task files belonging to other epics; they share this directory.

## Boundaries

- Write only the plan and your three task files.
- Do not modify `artifacts/{{RUN_ID}}/spec.md`. It is your input, and the runner
  will not copy any change to it back out.
- Do not write code. That is the `build` step's job.

## How this step is judged

The runner re-reads the plan and counts the task files itself: three tasks for
this epic, unique keys, and the phrase `Acceptance Criteria` present in the
plan. Anything else leaves the run at SPECIFIED.
