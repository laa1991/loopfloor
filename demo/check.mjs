#!/usr/bin/env node
/**
 * Run the criteria. Exit code is the verdict; the printed lines say which one fired.
 *
 *   node demo/check.mjs      # from the repository root
 *   node check.mjs           # or from this directory
 *
 * A criterion that cannot fail is not a criterion. Two of the checks below are
 * one-sided by nature — a replay check (any deterministic function passes it) and a
 * source scan (a heuristic) — so each of those ships with its own negative control,
 * run in the same pass: [4-neg] and [5-neg] must fire, or the check above them proves
 * nothing. What each criterion does NOT prove is written down in README.md.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

const fold = (file, ...extra) =>
  execFileSync(process.execPath, [join(here, 'fold.mjs'), join(here, file), ...extra], { encoding: 'utf8' })

const shortSha = text => createHash('sha256').update(text).digest('hex').slice(0, 16)
const say = (label, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail === undefined ? '' : `   ${detail}`}`)
  return ok
}

const log = readFileSync(join(here, 'log.jsonl'), 'utf8')
  .split('\n')
  .filter(line => line.trim() !== '')
  .map(line => JSON.parse(line))

/**
 * Does this closing line point at a record that (a) exists in the log and (b) is not
 * the completion itself? A claim that cites nothing, or cites itself, is not evidence.
 */
const citesRealRecord = (endedBy) => {
  const m = /\bseq\s*(\d+)\b/.exec(String(endedBy ?? ''))
  if (m === null) return { ok: false, why: 'cites no seq' }
  const cited = log.find(event => event.seq === Number(m[1]))
  if (cited === undefined) return { ok: false, why: `cites seq ${m[1]}, not in log` }
  if (cited.type === 'goal/complete') return { ok: false, why: 'cites its own completion' }
  return { ok: true, why: `seq ${m[1]} = ${cited.type}` }
}

/** Inputs a fold must not have, if its state is to be a function of the log alone. */
const NON_LOG_INPUT = [
  /\bDate\b/,
  /\bMath\s*\.\s*random\b/,
  /\bprocess\s*\.\s*env\b/,
  /\bfetch\s*\(/,
  /\bperformance\s*\./,
  /\brandomUUID\b/,
]
const scan = src => NON_LOG_INPUT.filter(re => re.test(src)).map(re => re.source)

const cleanSrc = readFileSync(join(here, 'fold.mjs'), 'utf8')
const taintedSrc = `const _noise = Date.now()\n${cleanSrc}` // one line that must trip the scan
const cleanHits = scan(cleanSrc)
const taintedHits = scan(taintedSrc)

const first = fold('log.jsonl')
const second = fold('log.jsonl')
const asOfFive = JSON.parse(fold('log.jsonl', '--as-of', '5'))
const full = JSON.parse(fold('log.jsonl'))

const good = citesRealRecord(full.goal.endedBy)
const bad = citesRealRecord(JSON.parse(fold('log.no-evidence.jsonl')).goal.endedBy)

const results = [
  say('[1] same log replayed twice is byte-identical  (necessary, not sufficient — see [5])',
    first === second, `sha256=${shortSha(first)}`),
  say('[2] as of seq 5 there is no evidence yet', asOfFive.evidence.length === 0,
    `evidence=${asOfFive.evidence.length} goal=${asOfFive.goal.state}`),
  say('[3] the full replay does have it', full.evidence.length === 1,
    `evidence=${full.evidence.length} goal=${full.goal.state}`),
  say('[4] the closing line cites a record that exists and is not the completion itself',
    good.ok, `${good.why}`),
  say('[4-neg] the same check says NO on a log that cites nothing real',
    bad.ok === false, `log.no-evidence.jsonl: ${bad.why}`),
  say('[5] the fold reads nothing outside the log (no clock, randomness, env, network)',
    cleanHits.length === 0, `fold.mjs hits=${cleanHits.length}`),
  say('[5-neg] the same scan fires on a tainted copy of that source',
    taintedHits.length > 0, `tainted hits=${taintedHits.join(', ') || 'NONE — scan is dead'}`),
]

console.log(
  results.every(Boolean)
    ? '\nverdict: all criteria passed'
    : '\nverdict: at least one criterion failed',
)
process.exit(results.every(Boolean) ? 0 : 1)
