# AI Tool Usage

## Tools I Used

| Tool                                              | What I used it for                                                                                                                                                                                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code                                       | Mostly writing code, testing, polishing code, and the UI; it runs the implementer and reviewer agents. Also used for brainstorming                                                                                                             |
| Codex / GPT model ($20 subscription)              | Chat mode: brainstorming the idea and milestones, comparing frameworks (NestJS vs Express), and a separate grilling session to choose the queue system (Kafka, RabbitMQ, BullMQ, or pg-boss). Used alongside Claude Code, for the same project |
| Matt Pocock's `grilling` skill                    | Stress-testing decisions: I answered questions until weak spots showed                                                                                                                                                                         |
| Plannotator                                       | Structuring my thoughts, splitting the work into milestones and then into detailed steps                                                                                                                                                       |
| Plannotator `goal` skill                          | First collects facts from me by asking questions until we agree, then runs the goal and implements it                                                                                                                                          |
| Custom agents (`api-implementer`, `api-reviewer`) | One agent writes code, a second reviews it; the `implement-plan` skill loops them and stops after 5 attempts. If an agent is blocked or lacks knowledge, it asks me                                                                            |
| Context7 (skill)                                  | Fetching current library documentation so agents do not rely on outdated training data                                                                                                                                                         |
| Excalidraw skill                                  | Diagrams explaining how the system works and where its pitfalls are                                                                                                                                                                            |
| Passeo                                            | Running and managing agent sessions                                                                                                                                                                                                            |

The repo itself is the agents' memory:

- `AGENTS.md` in the root and in every package: how to write code there, and why.
- `DECISIONS.md`: every design decision, with trade-offs and rejected options.
- `goals/<name>/`: what we are building now (`facts.md` for requirements, `plan.md` for the plan).
- `GLOSSARY.md`: shared domain vocabulary.

## What Helped Most

- **Brainstorming with AI to choose the technology.** Comparing options early (framework, queue) before writing code.
- **Context7.** Documentation stayed up to date, so generated code matched the installed library versions.
- **Goals and Plannotator.** They helped me structure my thoughts: facts first, then a plan, then implementation.
- **Two agents: implementer and reviewer.** Every change was reviewed right after it was written, which caught problems and bugs that the implementer missed.
- **An `AGENTS.md` in every sub-project.** This is a monorepo and the rules differ between packages, so each agent needs to read the rules of the package it works in.

## What I Had to Fix

- **The AI's queue advice was wrong.** The GPT model first suggested Kafka and RabbitMQ. It agreed with whatever I said, but the options did not fit the task. Only during grilling, when I answered its questions and pushed back, did it become clear they did not fit. We ended up with **pg-boss**: concurrency is handled with PostgreSQL transactions and locks at the database level, with no extra infrastructure and no transactional outbox.
- **No suitable starter template.** I spent a long time looking for a starter project that matched the stack and structure. On GitHub they are either too simple or so complex that both Claude and I got lost and could not tell how to write code in them. I picked one template by hand, removed everything unnecessary, kept only the core and the modules we need, and wrote down constraints for Claude so every agent produces the same code structure.
- **Generated code must always be checked.** Even the reviewer agent missed things. When it happened, I wrote the rule down in `AGENTS.md`. Two examples:
  - Module isolation rules were broken.
  - A repository took on too much; I had to record that repositories hold persistence only and tasks stay in the use cases.
- **Codex and Claude behave differently.** The same instructions gave different results, so rules had to be explicit enough for both.
