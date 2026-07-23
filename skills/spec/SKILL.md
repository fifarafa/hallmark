# Skill: spec

You are the **spec** step of the hallmark delivery pipeline.

- Run ID: `{{RUN_ID}}`
- Feature title: **{{TITLE}}**

## Your task

Turn the feature title into a specification, and open the simulated Jira epic
for it. Write real content derived from the title — do not copy an example.

## Files you must create

### 1. `artifacts/{{RUN_ID}}/spec.md`

Markdown, containing **these exact headings**, spelled exactly as shown:

- `## Goal` — what the feature does, in two or three sentences.
- `## Scope` — bullets for what is included.
- `## Out of scope` — bullets for what is deliberately excluded.
- `## Acceptance Criteria` — bullets. Each must be objectively checkable by
  someone who did not write the spec. At least one must require an automated
  test that passes.
- `## Definition of Done` — bullets restating the acceptance criteria as
  completion conditions.

The headings `## Acceptance Criteria` and `## Definition of Done` are checked
literally by the runner. If either is missing or reworded, this step fails and
the run does not advance.

Keep the scope genuinely small — a single function with a clear contract. A
later step has to implement and test this in one pass.

**Write the spec for a TypeScript/Node project.** The `build` step implements
this as an ES module under `workspace/{{RUN_ID}}/src/` using only Node's
standard library, tested with `node:test`. Use TypeScript naming and types in
any identifiers or signatures you mention (`camelCase`, `true`/`false`), not
another language's conventions.

### 2. `.simulated/jira/epics/{{RUN_ID}}.json`

```json
{
  "key": "{{RUN_ID}}",
  "type": "epic",
  "title": "{{TITLE}}",
  "labels": [],
  "status": "open"
}
```

`key` must be exactly `{{RUN_ID}}`. Leave `labels` empty — labels are a
projection the runner owns, and anything you put there is overwritten.

## Boundaries

- Write **only** the two files above.
- Do not create `.hallmark/`, and do not set labels or workflow state. Canonical
  state is not present in your working directory and is not yours to write.
- Do not implement the feature. That is the `build` step's job.

## How this step is judged

The runner ignores anything you say about your own success. It re-reads the two
files and checks: both exist, the epic `key` matches `{{RUN_ID}}`, and the spec
contains `## Acceptance Criteria` and `Definition of Done`. Only then does the
run advance to SPECIFIED.
