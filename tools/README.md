# tools

## `tool-usage-census.mjs`

Counts how often each tool name is called, and in how many session files — over a directory of
session logs. It answers one question cheaply: **which names are actually in use, and which were
installed and never touched.**

```sh
node tool-usage-census.mjs --log-dir sample-logs
```

Expected output on the bundled sample (verify you get the same — that is the point of shipping it):

```
scan surface: 2 files · 8 tool/call rows · bad 0 · empty 0 · 0.0s
total tool/call: 6 · distinct names: 4

   calls  sessions  name
       3         2  read
       1         1  grep
       1         1  consult
       1         1  bash
```

Options: `--log-dir <dir>` (required, scanned recursively) · `--top N` · `--filter a,b` · `--help`.
Exit codes: `0` ok · `2` bad usage · `3` the directory is not readable.

### Input format (a contract, not an assumption)

- one JSON object per line (JSONL);
- a line is a tool call iff `type === "tool/call"` and `data.name` is a non-empty string;
- a file starting with the zstd magic (`28 b5 2f fd`) is read as **multi-frame** zstd — each frame
  decompressed separately, then concatenated; anything else is read as UTF-8.

`sample-logs/` holds two synthetic files that exercise both the counting rules and the awkward
cases (an event with no `data.name`, a line that is not JSON at all, and a prose line that merely
mentions `tool/call`). They contain no real data.

### What it does and does not tell you

- It is **read-only** and reports its own scan surface (files / rows / bad / empty) with the result;
  files that fail to decode are counted as `bad`, never skipped silently.
- Call count means *calls*; session count means *files the name appears in* (100 calls in one file
  still count 1).
- **Blind spot**: for something injected into every turn, call count says nothing about its cost.
  A name can be cheap to call and expensive to carry. Do not use this number to justify trimming an
  always-on surface — measure that surface's share of the request instead.

### Origin

This is the ruler used for the readings in this repository, with the deployment-specific default
path removed: the log directory is an argument now, and nothing else about the counting changed.

## `check-pointer-continuity.mjs`

Asks one question of a JSONL log: **after a seam** (a window switch, a restart, a compaction), **does
the input at that seam say (1) what was last done, (2) what it is waiting on, (3) why the next step
follows?** States: ✅ `0` · ⚠️ `3` · ❌ `1` · ⚪ `4` not judgeable / not applicable — **⚪ is counted
separately and is not a pass**.

```sh
node check-pointer-continuity.mjs --selftest                    # 10 built-in fixtures; exit code is the verdict
node check-pointer-continuity.mjs --log pointer-sample.jsonl --first-round
```

Input: one JSON object per line, `{"time": <ISO string or epoch ms>, "who": "...", "text": "..."}`.
You only need an **adapter** for your own logs; the criterion does not change.
**The word forms are a contract, not a constant** — the defaults are the ones from our own logs, so
override them before you measure anything else:

```sh
node check-pointer-continuity.mjs --log your.jsonl --patterns your-patterns.json
```

`--patterns` takes `{position, waiting, why, command, artifactShape, pathChars}`, each a regex source.

**Reading the output**: the run lists *every* record in the seam round with its own ✅/❌ — including the
record that merely *marks* the seam. **Read the verdict line, not the per-record lines**: the criterion
takes the **best** record, because the question is whether *anything at all* is there.

## `check-compaction-accounting.mjs`

Asks: **after a compaction, does anything say what was dropped — and can it be retrieved?** (Verbatim
from an external survey's own gap statement: *whether a scheme knows what it dropped, whether it can
get it back*.) States: ✅ `0` an account **with** a retrievable pointer · ⚠️ `3` an account, no pointer ·
❌ `1` compacted with no account at all · ⚪ `4` no recognisable boundary.

```sh
node check-compaction-accounting.mjs --selftest                  # 6 built-in fixtures
node check-compaction-accounting.mjs --log compaction-sample.jsonl
```

Same input contract; `--patterns {boundaryWho, boundaryRe, accountRe, pointerRe}`. It **reports the
lag** between a boundary and its account — a reading, not a defect (in our own logs that lag ranged
from 19s to 725s) — and it takes the **worst** boundary: the question is whether *any* compaction
went unaccounted.

### Origin (both)

These are the two rulers behind [`docs/07`](../docs/07-两条判据的问法.md). Sanitised for shipping (no
deployment paths, no session data; the bundled samples are synthetic and in English), and **not**
claimed portable: at the time of writing they had been run against **one** producer's logs, so the
independent-vote count is still **0** (`docs/07` §6).
