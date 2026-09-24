# loopfloor

**Long-horizon work: how it fails quietly — and how to make it speak up.**

> [中文 README](README.zh.md) · body of the material: [`docs/`](docs/) · fixed terminology: [`docs/GLOSSARY.zh-en.md`](docs/GLOSSARY.zh-en.md)
>
> **Status**: v1 (2026-09-25). English front page; the body is written in Chinese. Code is **Apache-2.0** ([`LICENSE`](LICENSE)); documents and data are **CC-BY-4.0** ([`LICENSE-docs`](LICENSE-docs)). Attribution: `laa1991`. Public: <https://github.com/laa1991/loopfloor>.

## What this is

A field guide to one layer of agent systems: **what sits between the scheduler and the model** — the work that outlives a single context window, a single compaction, or a single process generation.

Long-horizon work fails in ways that **do not throw**. Nothing errors, nothing retries, nothing turns red; the result just quietly becomes something else. This repository collects the failure modes, the criteria that make them visible, and the smallest runnable pieces we could hand over.

**We ship the ruler, not the hand** — a criterion, not an implementation. Everything here is a shape, a measurement convention, or one runnable demo; the implementations that produced these readings stay where they are.

## The four ways it breaks quietly

| # | Failure mode | What goes wrong | Where it lands |
|---|---|---|---|
| 1 | **Context overflow** | the working set outgrows the window | compaction |
| 2 | **Lost state** | after a window switch, a compaction or a restart, nothing says where the work stood | continuation pointer · externalized task state |
| 3 | **Goal drift** | the next action stops being derived from the goal and starts being derived from whatever was read most recently | a goal that is re-read every turn |
| 4 | **False completion** | "done" is a claim rather than a pointer to something outside | criteria that must name an external object |

The four are connected: compaction costs state, lost state costs direction, and when nothing outside
the system has to agree, nobody notices the difference.

**The design has no roles.** Where other systems add a manager / executor / auditor, this one adds
structure: state that can be diffed, replayed and recomputed. Roles are behaviour and cannot be
replayed; data can. *(The first half of that claim now has a runnable demonstration — see below.
The second half is still an argument, and this repository says so out loud rather than dressing it up.)*

## What is in this repository, and what is deliberately not

**In**: things that can reproduce a conclusion (criteria, shapes, conventions), plus generic
infrastructure that is harmless to copy.

**Out** — each with its reason:

- **Scheduling and planning turns** — a decision layer that only makes sense inside the runtime it runs in; outside that context it is a flowchart with no way to tell right from wrong.
- **The gap → criterion → distillation chain** — it is bound to our internal measurement conventions; shipping it would produce something that looks reproducible and is not.
- **Memory layers and memory stores** — they hold private material.
- **Our internal criterion set** — the *shape* of a criterion can be shipped; *our* set is not.
- **Persona core, prompt and knowledge injection** — a lot worth going deeper into; glad to talk privately.
- **Implementations of mechanisms such as compaction** — this repository says where each failure mode lands and by what criterion, not how anyone built it.
- **Deployment paths, credentials, personal identifiers** — no exceptions.

The four areas that used to sit alongside this one are not deleted, they **moved**: operational
reliability, channel/topology handling, and permission registries belong to deployment and
operations; the seven-layer self-audit is a *diagnostic method, not an implementation*, and belongs
in a technical write-up. This repository does not claim to cover them, and deliberately leaves no
empty scaffolding behind — an empty directory reads as "not written yet".

## Layout

| Path | What it is |
|---|---|
| [`README.zh.md`](README.zh.md) | the Chinese front page (the full version) |
| [`docs/00-位置与对照.md`](docs/00-位置与对照.md) | where this sits relative to adjacent public work, with verbatim quotes and line numbers |
| [`docs/01-四格.md`](docs/01-四格.md) | the four failure modes, their carriers, and the readings behind them |
| [`docs/02-模块-pointer.md`](docs/02-模块-pointer.md) | the continuation pointer: shape and conventions |
| [`docs/03-模块-task-surface.md`](docs/03-模块-task-surface.md) | externalized task state: shape and conventions |
| [`docs/04-模块-tooling.md`](docs/04-模块-tooling.md) | the tool surface: gating, loading, trimming |
| [`docs/05-尺自己也会安静地错.md`](docs/05-尺自己也会安静地错.md) | when the **ruler** fails quietly: three criteria, one measurement convention, one first-hand instance |
| [`docs/GLOSSARY.zh-en.md`](docs/GLOSSARY.zh-en.md) | fixed Chinese → English terminology |
| [`demo/`](demo/) | a runnable replay demo (`node demo/check.mjs` from the repository root, exit code is the verdict) |

## The demo, and what it does not show

```sh
node demo/check.mjs        # from the repository root; exit code is the verdict
```

**Seven criteria, two of which are negative controls.** The reason: some checks *cannot fail* —
"the same input replayed twice gives the same output" passes for **any** deterministic function — so a
check like that is a smoke test, not evidence. Each such check therefore ships with a neighbour that
**must fail**: the fold must read nothing outside the log (no clock, randomness, environment, network),
and the same scan has to fire on a deliberately tainted copy of that source. Likewise the closing line
must cite a record that **exists and is not the completion itself** — and a log that cites nothing is
its negative control. **What each criterion does *not* prove** is written down in `demo/README.md`.

What it does **not** show: there is no model in that demo. It measures where recomputability *ends*,
and the answer is unexpectedly simple — **you can recompute exactly what the log recorded, and
nothing else**. Do not read it as evidence about model determinism; read it as bookkeeping.

## Status

Batch 1: shapes, conventions and one runnable demo. Implementation code is not part of this batch.
The readings in `docs/` carry their measurement conventions, how to recompute them, and their blind
spots; anything not measured is marked as not measured.

## License and attribution

- **Code**: Apache-2.0 — see [`LICENSE`](LICENSE).
- **Documents and data**: CC-BY-4.0 — see [`LICENSE-docs`](LICENSE-docs).
- **Attribution**: `laa1991` — see [`CITATION.cff`](CITATION.cff).

Published: <https://github.com/laa1991/loopfloor> — public, default branch `main`. The commit identities
were settled **before** the first push, not rewritten after it.
