#!/usr/bin/env node
/**
 * check-readme-pairing.mjs — keep the two READMEs from drifting apart, mechanically.
 *
 * RULE (owner's rule, 2026-09-25): **`README.zh.md` is the source.** Change it first, then sync
 * `README.md` (the English front page). Fixed terminology comes from `docs/GLOSSARY.zh-en.md`.
 *
 * They are NOT mirrors, and this script does not pretend they are: the English file is a front
 * page, the Chinese file is the full version. What is checked:
 *
 *   1. both files carry the same `# ` title;
 *   2. each file's headings are exactly its declared order (EN_ORDER / ZH_ORDER) — so adding,
 *      removing or renaming a section without updating this file is red;
 *   3. every heading on either side appears in MAP (an undeclared heading = drift);
 *   4. every declared pair exists on both sides it claims.
 *
 * ⚠️ The two orders are checked **separately, not against each other**: measured 2026-09-25, the
 * front page leads with the four failure modes and then the scope, while the body leads with the
 * scope (§0) and then the failure modes (§1). That crossing is deliberate — the front page opens
 * with the hook, the body opens with the boundary — so the check must not force them to agree.
 *
 * A heading with no counterpart on the other side is declared `null` **on purpose** — that is how
 * "the front page has a section the body does not" stays visible instead of quietly becoming a lie.
 *
 * Usage:  node check-readme-pairing.mjs [--repo <dir>]
 * Exit:   0 paired · 1 drift (each offence printed) · 2 bad usage / unreadable file
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const argv = process.argv.slice(2)
if (argv.includes('--help') || argv.includes('-h')) {
  process.stdout.write('usage: node check-readme-pairing.mjs [--repo <dir>]\n')
  process.exit(0)
}
const i = argv.indexOf('--repo')
const repo = i >= 0 && argv[i + 1] ? argv[i + 1] : process.cwd()

/** Declared order of the English front page (sections only, title excluded). */
const EN_ORDER = [
  'What this is',
  'The four ways it breaks quietly',
  'What is in this repository, and what is deliberately not',
  'Layout',
  'The demo, and what it does not show',
  'Status',
  'License and attribution',
]

/** Declared order of the Chinese full version (sections only, title excluded). */
const ZH_ORDER = [
  '0. 本仓放什么 / 不放什么',
  '1. 四处坏法',
  '2. 与相邻工作的关系',
  '2.1 空档在哪',
  '3. 四格 × 归宿 × 形态',
  '4. 读数（每条带口径、复现方式与盲区）',
  '5. 我们最弱的一格（连终点一起摆出来）',
  '6. 边界（明写不做的事）',
  '7. 怎么读这份材料 / 出处',
  '8. 已定（2026-09-25 拍板）',
]

/** Pairing table: `[enHeading | null, zhHeading | null]`. null = deliberately no counterpart. */
const MAP = [
  ['What this is', null],
  ['The four ways it breaks quietly', '1. 四处坏法'],
  ['What is in this repository, and what is deliberately not', '0. 本仓放什么 / 不放什么'],
  ['Layout', '7. 怎么读这份材料 / 出处'],
  ['The demo, and what it does not show', null],
  ['Status', '8. 已定（2026-09-25 拍板）'],
  ['License and attribution', null],
  [null, '2. 与相邻工作的关系'],
  [null, '2.1 空档在哪'],
  [null, '3. 四格 × 归宿 × 形态'],
  [null, '4. 读数（每条带口径、复现方式与盲区）'],
  [null, '5. 我们最弱的一格（连终点一起摆出来）'],
  [null, '6. 边界（明写不做的事）'],
]

const norm = (s) => s.replace(/\s+/g, ' ').trim()

function read(path) {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    console.error(`cannot read ${path}`)
    process.exit(2)
  }
}

function headings(text) {
  const out = []
  text.split('\n').forEach((line, n) => {
    const m = /^(#{2,6})\s+(.*\S)\s*$/.exec(line)
    if (m) out.push({ level: m[1].length, text: norm(m[2]), line: n + 1 })
  })
  const title = /^#\s+(.*\S)\s*$/m.exec(text)
  return { out, title: title ? norm(title[1]) : null }
}

const EN = headings(read(join(repo, 'README.md')))
const ZH = headings(read(join(repo, 'README.zh.md')))
const offences = []

if (EN.title !== ZH.title) offences.push(`title differs: en="${EN.title}" zh="${ZH.title}"`)

const compareOrder = (label, found, declared) => {
  const got = found.map((h) => h.text)
  for (let k = 0; k < Math.max(got.length, declared.length); k += 1) {
    if (got[k] === declared[k]) continue
    const line = found[k] ? `README:${found[k].line}` : 'end of file'
    offences.push(
      `${label} order diverges at #${k + 1}: found ${got[k] ? `"${got[k]}"` : '(nothing)'} (${line}) ` +
        `but declared "${declared[k] ?? '(nothing)'}"`,
    )
    break
  }
}
compareOrder('README.md', EN.out, EN_ORDER)
compareOrder('README.zh.md', ZH.out, ZH_ORDER)

const enSet = new Set(EN.out.map((h) => h.text))
const zhSet = new Set(ZH.out.map((h) => h.text))

for (const [en, zh] of MAP) {
  if (en !== null && !enSet.has(en)) offences.push(`declared en heading not found in README.md: "${en}"`)
  if (zh !== null && !zhSet.has(zh)) offences.push(`declared zh heading not found in README.zh.md: "${zh}"`)
}
for (const h of EN.out) {
  if (!MAP.some(([en]) => en === h.text)) offences.push(`README.md:${h.line} undeclared heading: "${h.text}"`)
}
for (const h of ZH.out) {
  if (!MAP.some(([, zh]) => zh === h.text)) offences.push(`README.zh.md:${h.line} undeclared heading: "${h.text}"`)
}

const paired = MAP.filter(([en, zh]) => en && zh).length
console.log(
  `headings: README.md ${EN.out.length} (declared ${EN_ORDER.length}) · README.zh.md ${ZH.out.length} ` +
    `(declared ${ZH_ORDER.length}) · paired ${paired} · en-only ${MAP.filter(([en, zh]) => en && !zh).length} ` +
    `· zh-only ${MAP.filter(([en, zh]) => !en && zh).length}`,
)
console.log(`syntax: \`${EN.title}\` \`${ZH.title}\``)
if (offences.length === 0) {
  console.log('verdict: the two READMEs are paired — no undeclared heading on either side')
  process.exit(0)
}
console.log(`verdict: ${offences.length} offence(s) — the two have drifted apart`)
for (const o of offences) console.log(`  ✗ ${o}`)
console.log('\nfix: change README.zh.md first, then sync README.md, then update EN_ORDER/ZH_ORDER/MAP above.')
process.exit(1)
