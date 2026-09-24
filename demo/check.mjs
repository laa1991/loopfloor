#!/usr/bin/env node
/**
 * Run the criteria. Exit code is the verdict; the printed lines say which one fired.
 *
 *   node check.mjs
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const run = (...extra) =>
  execFileSync(process.execPath, ['fold.mjs', 'log.jsonl', ...extra], { encoding: 'utf8' })

const shortSha = text => createHash('sha256').update(text).digest('hex').slice(0, 16)
const say = (label, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail === undefined ? '' : `   ${detail}`}`)
  return ok
}

const first = run()
const second = run()

const asOfFive = JSON.parse(run('--as-of', '5'))
const full = JSON.parse(run())

const results = [
  say('[1] same log replayed twice is byte-identical', first === second, `sha256=${shortSha(first)}`),
  say('[2] as of seq 5 there is no evidence yet', asOfFive.evidence.length === 0,
    `evidence=${asOfFive.evidence.length} goal=${asOfFive.goal.state}`),
  say('[3] the full replay does have it', full.evidence.length === 1,
    `evidence=${full.evidence.length} goal=${full.goal.state}`),
  say('[4] the goal names an external object as its closing evidence', typeof full.goal.endedBy === 'string',
    `endedBy=${JSON.stringify(full.goal.endedBy)}`),
]

console.log(
  results.every(Boolean)
    ? '\nverdict: all criteria passed'
    : '\nverdict: at least one criterion failed',
)
process.exit(results.every(Boolean) ? 0 : 1)
