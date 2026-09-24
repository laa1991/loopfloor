#!/usr/bin/env node
/**
 * tool-usage-census — count how often each tool name is called, and in how many sessions.
 *
 * WHY THIS EXISTS
 *   A tool surface grows quietly. Counting how often each name is actually used is the cheapest way
 *   to tell apart "in use" from "installed and never touched" — and to keep a trimming decision
 *   from being a guess. See the parent repo's notes on the tool surface.
 *
 * USAGE
 *   node tool-usage-census.mjs --log-dir <dir> [--top N] [--filter a,b]
 *   node tool-usage-census.mjs --help
 *
 * INPUT FORMAT (this is a contract, not an assumption)
 *   - one JSON object per line (JSONL);
 *   - a line counts as a tool call iff `type === "tool/call"` and `data.name` is a non-empty string;
 *   - files whose first four bytes are the zstd magic (`28 b5 2f fd`) are read as **multi-frame**
 *     zstd (each frame decompressed separately, then concatenated); anything else is read as UTF-8.
 *
 * CONVENTIONS (a number without these is unusable)
 *   - **read-only**: nothing is written, moved or deleted.
 *   - call count  = occurrences of `data.name` (no name normalization).
 *   - session count = number of *files* a name appears in (100 calls in one file still count 1).
 *   - files that fail to decode are counted as `bad` and **reported, never skipped silently**;
 *     the scan surface (files / rows / bad / empty) is printed with the result.
 *   - as-of = the moment it runs.
 *   - blind spot: this counts how often a name is *called*. For something injected into every turn,
 *     that number says nothing about its cost — a name can be cheap to call and expensive to carry.
 *
 * EXIT CODES
 *   0 ok · 2 bad usage (e.g. --log-dir missing) · 3 the directory does not exist
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { zstdDecompressSync } from 'node:zlib'

const MAGIC = [0x28, 0xb5, 0x2f, 0xfd]

const USAGE = `tool-usage-census — tool-call census over a directory of session logs

  node tool-usage-census.mjs --log-dir <dir> [--top N] [--filter a,b]
  node tool-usage-census.mjs --help

  --log-dir <dir>   required; scanned recursively
  --top <N>         print only the first N tool names (0 = all)
  --filter <a,b>    print only names containing one of these substrings
`

const argv = process.argv.slice(2)
const argOf = (flag) => {
  const i = argv.indexOf(flag)
  return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined
}

if (argv.includes('--help') || argv.includes('-h') || argv.length === 0) {
  process.stdout.write(USAGE)
  process.exit(argv.length === 0 ? 2 : 0)
}

const logDir = argOf('--log-dir')
const top = Number(argOf('--top') ?? '0') || 0
const filter = (argOf('--filter') ?? '').split(',').map((s) => s.trim()).filter(Boolean)

if (logDir === undefined) {
  process.stderr.write('missing --log-dir\n\n' + USAGE)
  process.exit(2)
}
try {
  if (!statSync(logDir).isDirectory()) throw new Error('not a directory')
} catch {
  process.stderr.write(`--log-dir is not a readable directory: ${logDir}\n`)
  process.exit(3)
}

/** Multi-frame zstd: one file may hold several independent frames; decompress each, then concatenate. */
function decodeMultiFrame(raw) {
  const starts = []
  for (let i = 0; i < raw.length - 3; i += 1) {
    if (raw[i] === MAGIC[0] && raw[i + 1] === MAGIC[1] && raw[i + 2] === MAGIC[2] && raw[i + 3] === MAGIC[3]) {
      starts.push(i)
    }
  }
  let text = ''
  for (let k = 0; k < starts.length; k += 1) {
    const end = k + 1 < starts.length ? starts[k + 1] : raw.length
    try {
      text += zstdDecompressSync(raw.subarray(starts[k], end)).toString('utf8')
    } catch {
      text += '\n'
    }
  }
  return text
}

function decode(raw) {
  const isZstd =
    raw.length >= 4 && raw[0] === MAGIC[0] && raw[1] === MAGIC[1] && raw[2] === MAGIC[2] && raw[3] === MAGIC[3]
  return isZstd ? decodeMultiFrame(raw) : raw.toString('utf8')
}

function* walk(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    else if (entry.isFile()) yield path
  }
}

const calls = new Map() // name -> call count
const sessions = new Map() // name -> Set(file)
let files = 0
let bad = 0
let rows = 0
let empty = 0
const startedAt = Date.now()

for (const file of walk(logDir)) {
  files += 1
  if (files % 100 === 0) {
    process.stderr.write(`  …scanned ${files} files / ${((Date.now() - startedAt) / 1000).toFixed(1)}s\n`)
  }
  let text
  try {
    text = decode(readFileSync(file))
  } catch {
    bad += 1
    continue
  }
  if (text.length === 0) empty += 1
  for (const line of text.split('\n')) {
    if (!line.includes('"tool/call"')) continue
    let record
    try {
      record = JSON.parse(line)
    } catch {
      continue
    }
    if (record.type !== 'tool/call' || record.data == null) continue
    rows += 1
    const name = record.data.name
    if (typeof name !== 'string' || name === '') continue
    calls.set(name, (calls.get(name) ?? 0) + 1)
    if (!sessions.has(name)) sessions.set(name, new Set())
    sessions.get(name).add(file)
  }
}

const total = [...calls.values()].reduce((a, b) => a + b, 0)
console.log(`=== tool names x calls (as-of ${new Date().toISOString()}) ===`)
console.log(
  `scan surface: ${files} files · ${rows} tool/call rows · bad ${bad} · empty ${empty} · ` +
    `${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
)
console.log(
  `total tool/call: ${total} · distinct names: ${calls.size}${filter.length ? ` (filter "${filter.join(',')}")` : ''}\n`,
)

let entries = [...calls.entries()].sort((a, b) => b[1] - a[1])
if (filter.length) entries = entries.filter(([name]) => filter.some((f) => name.includes(f)))
if (top > 0) entries = entries.slice(0, top)

console.log('   calls  sessions  name')
for (const [name, count] of entries) {
  console.log(`${String(count).padStart(8)}  ${String(sessions.get(name).size).padStart(8)}  ${name}`)
}
