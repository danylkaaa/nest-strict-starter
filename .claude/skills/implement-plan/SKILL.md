---
name: implement-plan
description: Orchestrates implementing a plan, spec, or feature request in the NestJS API (apps/api) with an implementer agent and a strict reviewer agent, looping until the reviewer approves or 5 attempts are used. Use whenever the user asks to implement, build, or execute a plan/spec that touches apps/api.
---

# Implement Plan

You are the orchestrator. You do not write API code yourself. You run two agents in a loop and decide when to stop:

- `api-implementer` (Sonnet): writes the code, tests, and docs
- `api-reviewer` (Opus, high effort): read-only, returns `VERDICT: APPROVE` or `VERDICT: CHANGES_REQUESTED` with findings

**Goal**: the reviewer approves. **Limit**: at most 5 implementer attempts.

## 0. Prepare

1. Get the spec. Use the plan or spec the user pointed to (read the file, or take the text from the conversation). Keep it **verbatim**; agents start with no context
2. If the spec is too vague to implement (no observable behavior, contradictory), ask the user one short clarifying question before starting. Otherwise do not ask
3. Note `git status --short` so you can tell later what the agents changed. If the working tree already has unrelated uncommitted changes, tell the user and continue only with their OK
4. Set `attempt = 0`

## 1. Loop

Repeat while `attempt < 5`:

1. `attempt += 1`
2. **Implement**
   - Attempt 1: start `api-implementer` with the verbatim spec and the instruction to follow its own process and report in its final-report format
   - Attempt 2+: send the previous review findings to the **same** implementer (`SendMessage` to its id) so it keeps its context. If it can no longer be reached, start a new `api-implementer` with the spec, the current `git diff HEAD`/status summary, and the findings
   - Pass the findings verbatim, with the attempt number ("attempt N of 5")
3. Read its report:
   - `STATUS: BLOCKED` → stop the loop. Ask the user the exact question from `Blocked on`, then continue from step 2 with their answer (this does not use up an attempt)
   - `STATUS: DONE` → go to review
4. **Review**: start a **new** `api-reviewer` each round (fresh eyes). Give it: the verbatim spec, the attempt number, the implementer's report, and the previous findings with their numbering (none on attempt 1)
5. Read the verdict on its first line:
   - `VERDICT: APPROVE` → go to Finish
   - `VERDICT: CHANGES_REQUESTED` → keep the findings, go back to step 1 (if `attempt` is 5, go to Finish as **not approved**)
6. Never edit the code yourself to speed things up, and never argue findings away. If a finding looks wrong, let the implementer dispute it with a reference to `AGENTS.md`; the reviewer decides

## 2. Finish

1. Run `pnpm check` from the repo root yourself and note the result. Do not trust reports alone
2. Report to the user, concisely:
   - **Outcome**: approved after N attempt(s), or **not approved after 5 attempts**
   - What was built (module, key files) and the `pnpm check` result
   - If not approved: the unresolved `blocker`/`major` findings from the last review, and your suggestion (adjust the spec, fix by hand, or run another round)
   - Reviewer's minor notes, if any
3. **Do not commit or push.** Offer to commit with the `commit-message` skill. Leave the changes in the working tree

## Rules

- Count attempts as implementer runs that reached review. A BLOCKED report answered by the user does not count
- Stop early and report if two consecutive rounds return the same blocker unchanged; more rounds will not help
- Each agent call is expensive; do not run review without a `DONE` report, and do not re-run a round with unchanged inputs
- Keep the user informed with one short line per round (`Attempt 2/5: reviewer requested changes (1 blocker, 2 major)`)
