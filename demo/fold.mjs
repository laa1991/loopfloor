#!/usr/bin/env node
/**
 * Fold an append-only event log into task state.
 *
 * The point of this file is that it is a *pure function* of the log: same log in,
 * byte-identical state out, for anyone, on any machine, at any later date.
 *
 *   node fold.mjs log.jsonl              # state after all events
 *   node fold.mjs log.jsonl --as-of 5    # state as of seq 5 (wind the world back)
 *
 * Unknown event types are skipped rather than guessed: the log is meant to be
 * extendable, and a reader that invents meaning is worse than one that stops.
 */
import { readFileSync } from 'node:fs'

const argv = process.argv.slice(2)
const file = argv.find(a => !a.startsWith('--')) ?? 'log.jsonl'
const asOfIndex = argv.indexOf('--as-of')
const asOf = asOfIndex >= 0 ? Number(argv[asOfIndex + 1]) : Number.POSITIVE_INFINITY

const events = readFileSync(file, 'utf8')
  .split('\n')
  .filter(line => line.trim() !== '')
  .map(line => JSON.parse(line))

const state = {
  goal: null,
  next: null,
  plan: null,
  decisions: [],
  evidence: [],
  compactions: 0,
  events_folded: 0,
}

for (const event of events) {
  if (event.seq > asOf) break
  state.events_folded += 1
  switch (event.type) {
    case 'goal/set':
      state.goal = { what: event.what, state: 'active' }
      break
    case 'goal/complete':
      if (state.goal !== null) {
        state.goal.state = 'completed'
        state.goal.endedBy = event.how
      }
      break
    case 'next/write':
      state.next = { doing: event.doing, next: event.next, waiting: event.waiting === true }
      break
    case 'next/clear':
      state.next = null
      break
    case 'plan/write':
      state.plan = {
        done: event.items.filter(item => item.status === 'done').length,
        total: event.items.length,
        open: event.items.filter(item => item.status !== 'done').map(item => item.content),
      }
      break
    case 'decision/log':
      state.decisions.push({ seq: event.seq, chose: event.chose, because: event.because })
      break
    case 'job/settled':
      state.evidence.push({ seq: event.seq, id: event.id, status: event.status, evidence: event.evidence })
      break
    case 'compaction/summary':
      state.compactions += 1
      break
    default:
      break
  }
}

/** Recursively sort object keys so that two runs are comparable byte for byte. */
const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
  }
  return value
}

process.stdout.write(`${JSON.stringify(stable(state), null, 2)}\n`)
