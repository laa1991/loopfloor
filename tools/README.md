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
