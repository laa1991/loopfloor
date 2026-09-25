#!/usr/bin/env node
/**
 * check-pointer-continuity.mjs —— 「接续指针」的可移植判据 v0
 *
 * 一句话：**在一处接续点之后的第一条记录里，能不能指认出 ①上次做到哪 ②在等什么
 * ③为什么是这个下一步，且至少一件引用盘上的具体物件？**
 *
 * ## 输入契约（可移植的那一半：不认生产者，只认字段）
 *   JSONL，每行一个记录对象：
 *   {
 *     "time": "2026-09-25T11:31:41+08:00" | 1790…,   // 必填，判断「接续点之后」用
 *     "who":  "workbench-card" | "agent" | "...",      // 必填（写在输出里，便于人核）
 *     "text": "……",                                   // 必填
 *     "ref":  ["docs/06-x.md:12", "node demo/check.mjs"]  // 可选：记录自己声明的引用
 *   }
 *
 * ## 判决（三态 + 判不了）
 *   ✅ ok        ① ② ③ 至少两件可见，**且**至少一件引用具体物件
 *   ⚠️ 半        至少两件可见，但全是自然语言回忆（不指物）
 *   ❌ 灭        可见件数 < 2
 *   ⚪ 判不了    记录为空或缺 time ⇒ **单独计数，不许折进「通过」**
 *                （注意：**短不构成判不了**——一句「hi」是「确定没有」，判 ❌ 不是 ⚪）
 *
 * ## 用法
 *   node check-pointer-continuity.mjs --log records.jsonl --after 2026-09-25T11:31:04+08:00
 *   node check-pointer-continuity.mjs --selftest          # 自带两侧对照，不依赖任何外部样本
 *   node check-pointer-continuity.mjs --selftest --json
 *
 * exit: 0 ✅ / 1 ❌ / 3 ⚠️ / 4 ⚪ / 2 用法错误
 *
 * ## 盲区（必须一起读）
 *   - 它抓的是**形状**（词与物件的形状），抓不到「换一种说法讲同一件事」⇒ 漏报方向的风险
 *     大于误报方向；对照样本就是为了把这个方向的错照出来。
 *   - 「物件」默认只看**形状**（像不像路径/行号/命令）；加 `--check-paths` 才要求文件**真的存在**
 *     —— 那样它会依赖本机的盘，不再是纯形状判据（两种模式的读数不许混着报）。
 *   - 它判的是「这条记录里**有没有**这些」，不判「这些**对不对**」（内容真伪不在本判据的射程内）。
 */
import { readFileSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const args = process.argv.slice(2)
const opt = (name, dflt) => {
  const i = args.indexOf(name)
  return i === -1 ? dflt : args[i + 1]
}
const has = (name) => args.includes(name)

const HEAD = '接续指针判据'

/** ① 上次做到哪 */
let POSITION = /(做到|已完成|上次|进度|现状|当前|走到|停在|where we|last (step|time)|progress|status)/i
/** ② 在等什么 */
let WAITING = /(在等|等待|等[^，。；、\n]{1,12}?(回|答复)|未回|pending|waiting|blocked|挂着|搁置)/i
/** ③ 为什么是这个下一步 */
let WHY = /(因为|所以|为了|目的是|否则|because|so that|reason)/i
/** 物件：路径 / 文件:行 / 反引号里的命令 */
let PATH_CHARS = `A-Za-z0-9_./\\-${String.fromCharCode(0x4e00)}-${String.fromCharCode(0x9fa5)}`
const buildShape = (chars) =>
  new RegExp(
    `([A-Za-z0-9_][${chars}]*\\.(md|mjs|js|ts|json|jsonl|ps1|py|csv|yml|yaml|txt|sh))|([${chars}]+\\.[A-Za-z0-9]+:\\d+)`,
    'g',
  )
let ARTIFACT_SHAPE = buildShape(PATH_CHARS)
/** 只把「像命令或像路径」的反引号串当物件。实测教训：任何反引号词都算 ⇒ 14 条并起来报 164 处命中，
 *  绝大多数是 `edit` / `expected` 这种噪声 ⇒ 判别力被松口毁掉，「半」那一档永远不会出现。 */
let COMMAND = /`(?:[\w./\\-]*[/.][\w./\\-]*|(?:node|npm|pnpm|git|python|pwsh|curl|rg|grep|read|Select-String)\b[^`]{0,60})`/g

// ⚠️ **词形是契约，不是常量**（2026-09-25 改）：默认值 = **我们这把**（中文 + 少量英文），
// **不是通用真理**。换一个生产者，这些措辞全会不同 ⇒ 拿它去量别人的日志之前，先用
// `--patterns <file.json>` 换掉。字段名见下面 applyPatterns 的参数。
export function applyPatterns(p) {
  if (typeof p.position === 'string') POSITION = new RegExp(p.position, 'i')
  if (typeof p.waiting === 'string') WAITING = new RegExp(p.waiting, 'i')
  if (typeof p.why === 'string') WHY = new RegExp(p.why, 'i')
  if (typeof p.command === 'string') COMMAND = new RegExp(p.command, 'g')
  if (typeof p.artifactShape === 'string') ARTIFACT_SHAPE = new RegExp(p.artifactShape, 'g')
  if (typeof p.pathChars === 'string') {
    PATH_CHARS = p.pathChars
    ARTIFACT_SHAPE = buildShape(PATH_CHARS)
  }
  return { POSITION, WAITING, WHY, ARTIFACT_SHAPE, COMMAND }
}

const textOf = (r) => String(r?.text ?? '')
const artifactHits = (r, checkPaths) => {
  const text = `${textOf(r)}\n${(r?.ref ?? []).join('\n')}`
  const hits = []
  for (const m of text.matchAll(ARTIFACT_SHAPE)) hits.push({ kind: 'path', token: m[0] })
  for (const m of text.matchAll(COMMAND)) hits.push({ kind: 'command', token: m[0] })
  if (!checkPaths) return hits
  const real = hits.filter((h) => {
    if (h.kind === 'command') return true
    const p = h.token.replace(/:\d+$/, '')
    return existsSync(p)
  })
  return real
}

export function judge(record, { checkPaths = false } = {}) {
  const text = textOf(record)
  if (!record || !record.time || text.trim() === '') {
    return { state: '⚪', ok: false, code: 4, why: '记录为空或缺 time ⇒ 判不了（单独计数）', seen: {} }
  }
  const seen = {
    position: POSITION.test(text),
    waiting: WAITING.test(text),
    why: WHY.test(text),
  }
  const count = Object.values(seen).filter(Boolean).length
  const artifacts = artifactHits(record, checkPaths)
  if (count >= 2 && artifacts.length > 0) {
    return { state: '✅', ok: true, code: 0, why: `${count}/3 件可见 + 引用 ${artifacts.length} 处物件`, seen, artifacts }
  }
  if (count >= 2) {
    return { state: '⚠️', ok: false, code: 3, why: `${count}/3 件可见，但全是自然语言回忆、不指物`, seen, artifacts }
  }
  return { state: '❌', ok: false, code: 1, why: `只可见 ${count}/3 件`, seen, artifacts }
}

/** 自带两侧对照：该亮的必须亮，该灭的必须灭。判据不带这个就只是装饰。 */
const FIXTURES = [
  {
    name: '该亮 · 卡片形态（进度 + 下一步 + 文件）',
    expect: '✅',
    record: {
      time: '2026-09-25T11:31:41+08:00',
      who: 'workbench-card',
      text: '[workbench L0] task state — re-orient after a context refresh\nProgress: 3/3\nNext: 把修正写进 docs/06-最简实现公式.md 的边界一节，因为那一行现在还是旧的。',
    },
  },
  {
    name: '该亮 · 指针形态（上次做到哪 + 在等什么）',
    expect: '✅',
    record: {
      time: '2026-09-25T11:31:41+08:00',
      who: 'next-pointer',
      text: 'Doing: 已经做到 5/6；Next: 等 agent 回三处对账点，再动 docs/05；依据见 notes/台账.md:59。',
    },
  },
  {
    name: '该灭 · 只有一句招呼',
    expect: '❌',
    record: { time: '2026-09-25T12:00:00+08:00', who: 'agent', text: 'hi' },
  },
  {
    name: '该灭 · 讲了内容但既不指物也只有一件',
    expect: '❌',
    record: {
      time: '2026-09-25T12:00:00+08:00',
      who: 'model',
      text: '我们接着刚才那个话题继续聊吧，我觉得还有不少可以展开的地方，你先说说你的想法。',
    },
  },
  {
    name: '⚠️ 半 · 两件都说了，但一个物件都不指',
    expect: '⚠️',
    record: {
      time: '2026-09-25T12:00:00+08:00',
      who: 'model',
      text: '上次我们已经把那件事做到一半了，现在在等对方回话，所以我建议先把旁边的部分整理一下再说。',
    },
  },
  {
    name: '⚪ 判不了 · 没有时间戳',
    expect: '⚪',
    record: { who: 'model', text: '上次做到一半，现在在等回复，因为要先确认口径。' },
  },
]

// 归一化时间 + 选窗（**必须在模块顶层**：selftest 也要用它们；写在 `if (isMain)` 块里时
// selftest 看不见，实测报 `ReferenceError: toMs is not defined` —— 块作用域，不是我记错了 hoisting）。
const toMs = (t) =>
  typeof t === 'number' ? t : Number.isFinite(Date.parse(String(t))) ? Date.parse(String(t)) : Number.NaN

function selectWindow(sorted, afterMs, o) {
  const rest = sorted.filter((r) =>
    afterMs === undefined || Number.isNaN(afterMs) ? true : toMs(r.time) > afterMs,
  )
  if (o.mode === 'round') {
    if (rest.length === 0) return { group: [], how: `缝后第一轮（链 ≤${o.burstSec}s，空）` }
    const out = [rest[0]]
    for (let i = 1; i < rest.length; i += 1) {
      if (toMs(rest[i].time) - toMs(out[out.length - 1].time) <= o.burstSec * 1000) out.push(rest[i])
      else break
    }
    return { group: out, how: `缝后第一轮（链 ≤${o.burstSec}s）` }
  }
  if (o.windowSec > 0 && afterMs !== undefined && !Number.isNaN(afterMs)) {
    return {
      group: sorted.filter((r) => toMs(r.time) > afterMs && toMs(r.time) <= afterMs + o.windowSec * 1000),
      how: `窗 ${o.windowSec}s`,
    }
  }
  return { group: [], how: '只得一条' }
}

function selftest(asJson) {
  let failed = 0
  const rows = []
  for (const f of FIXTURES) {
    const v = judge(f.record)
    const pass = v.state === f.expect
    if (!pass) failed += 1
    rows.push({ fixture: f.name, expect: f.expect, got: v.state, pass, why: v.why })
  }
  // ── 选择层的两侧对照（2026-09-25 加）───────────────────────────────────────
  // 为什么必须加在这一层：v3 那一刀的**刀口在选择上**，不在判分上 —— 逐条判分早就是对的，
  // 错的是「把哪几条算作一轮」。判分器开火证明不了选择没错，所以要在选择层开一次火。
  const rankOf = (s) => ({ '✅': 3, '⚠️': 2, '❌': 1, '⚪': 0 })[s]
  const b = (time, who, text) => ({ time, who, text })
  const SELECT_FIXTURES = [
    {
      name: '缝后第一轮里就有载体（正对照，该亮）',
      expect: '✅',
      mode: 'round',
      windowSec: 0,
      records: [
        b('2026-09-25T10:00:00+08:00', 'pre', '上次做到了 3/5，在等对方回话，因为要先确认口径。'),
        b('2026-09-25T12:00:00+08:00', 'next-pointer', '[next pointer] Doing: 3/5 已落地。Next: 改 docs/a.md，因为在等的那件事还没回。'),
      ],
      after: '2026-09-25T10:00:00+08:00',
    },
    {
      name: '缝后第一轮干净、载体在第二轮（负对照，该灭）',
      expect: '❌',
      mode: 'round',
      windowSec: 0,
      records: [
        b('2026-09-25T10:00:00+08:00', 'pre', '上次做到了 3/5，在等对方回话，因为要先确认口径。'),
        b('2026-09-25T12:00:00+08:00', 'noise', '无关的一条。'),
        b('2026-09-25T12:10:00+08:00', 'workbench', '[workbench L0] Progress: 3/5。Next: 改 docs/a.md，因为在等的那件事还没回。'),
      ],
      after: '2026-09-25T10:00:00+08:00',
    },
    // 真实形状（B 撞点复刻，2026-09-25 实测）：**锚点与第一轮隔了 113 秒** ——
    // 旧刀从「我手选的那个时间戳」起数 60s ⇒ 一条都没吃到 ⇒ 走回退、判在那条不带载体的记录上（❌）；
    // 新刀从「缝后**第一条**」起吃整簇 ⇒ 吃到载体（✅）。**旧刀的病根是锚点，不是窗宽。**
    {
      name: '真实形状 · 新刀（从缝后第一条起吃整簇）⇒ 该亮',
      expect: '✅',
      mode: 'round',
      windowSec: 0,
      records: [
        b('2026-09-25T12:00:00+08:00', 'pre', '上次做到了 3/5，在等对方回话，因为要先确认口径。'),
        b('2026-09-25T12:01:53+08:00', 'human', '（人开口的一句话，本身不带载体）'),
        b('2026-09-25T12:01:53.200+08:00', 'workbench', '[workbench L0] Doing: 3/5 已落地。Next: 改 docs/a.md，因为在等的那件事还没回。'),
      ],
      after: '2026-09-25T12:00:00+08:00',
    },
    {
      name: '真实形状 · 旧刀（锚点起 60s，够不着第一轮）⇒ 该灭',
      expect: '❌',
      mode: 'window',
      windowSec: 60,
      records: [
        b('2026-09-25T12:00:00+08:00', 'pre', '上次做到了 3/5，在等对方回话，因为要先确认口径。'),
        b('2026-09-25T12:01:53+08:00', 'human', '（人开口的一句话，本身不带载体）'),
        b('2026-09-25T12:01:53.200+08:00', 'workbench', '[workbench L0] Doing: 3/5 已落地。Next: 改 docs/a.md，因为在等的那件事还没回。'),
      ],
      after: '2026-09-25T12:00:00+08:00',
    },
  ]
  for (const f of SELECT_FIXTURES) {
    const sf = [...f.records].sort((x, y) => toMs(x.time) - toMs(y.time))
    const sel = selectWindow(sf, toMs(f.after), { mode: f.mode, windowSec: f.windowSec, burstSec: 5 })
    // ⚠️ 必须复刻 CLI 的**回退**：窗内为空时判「缝后第一条」，不是判空（我第一版漏了这行 ⇒ 假 FAIL）
    const judgeSet =
      sel.group.length > 0
        ? sel.group
        : sf.filter((r) => toMs(r.time) > toMs(f.after)).slice(0, 1)
    let bestRow = null
    for (const r of judgeSet) {
      const v = judge(r)
      if (bestRow === null || rankOf(v.state) > rankOf(bestRow.state)) bestRow = v
    }
    const got = bestRow === null ? '⚪' : bestRow.state
    const pass = got === f.expect
    if (!pass) failed += 1
    rows.push({ fixture: f.name, expect: f.expect, got, pass, why: `${sel.how} · ${sel.group.length} 条` })
  }
  if (asJson) console.log(JSON.stringify({ gate: HEAD, mode: 'selftest', rows, failed }, null, 2))
  else {
    for (const r of rows) console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.expect} → ${r.got}  ${r.fixture}`)
    console.log(`${HEAD} selftest: ${rows.length - failed}/${rows.length} 通过（两侧对照：该亮 ${rows.filter(r => r.expect !== '❌' && r.expect !== '⚪' && r.expect !== '⚠️').length} 条 / 该灭 ${rows.filter(r => r.expect === '❌').length} 条 / 半与判不了 ${rows.filter(r => r.expect === '⚠️' || r.expect === '⚪').length} 条）`)
    console.log(failed === 0 ? `${HEAD}: 自带两侧对照全过 ✓` : `${HEAD}: 有 ${failed} 条对照没过 ✗`)
  }
  process.exit(failed === 0 ? 0 : 1)
}

// 被判据当「库」import 时，下面整段**不跑**：顶层直接跑 CLI 会让 import 当场 process.exit
// （这个坑我自己记过，25 日又踩了一次 ⇒ 判据要能被别人 import 才算真的可移植）。
const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  if (has('--selftest')) selftest(has('--json'))

const logPath = opt('--log')
const after = opt('--after')
if (!logPath) {
  console.error(`${HEAD}: 用法 --log <records.jsonl> --after <时间戳> | --selftest`)
  process.exit(2)
}
const records = readFileSync(logPath, 'utf8')
  .split('\n')
  .filter((l) => l.trim() !== '')
  .flatMap((l) => {
    try {
      return [JSON.parse(l)]
    } catch {
      return []
    }
  })
const sorted = [...records].sort((a, b) => {
  const x = toMs(a.time)
  const y = toMs(b.time)
  if (Number.isNaN(x)) return 1
  if (Number.isNaN(y)) return -1
  return x - y
})
const afterMs = after === undefined ? undefined : toMs(after)
const first = afterMs === undefined || Number.isNaN(afterMs) ? sorted[0] : sorted.find((r) => toMs(r.time) > afterMs)
if (first === undefined) {
  console.log(`${HEAD}: ⚪ 判不了 —— ${after} 之后没有记录（in=⚪）`)
  process.exit(4)
}
// v1 更正（2026-09-25，真物撞出来的）：接续点**不是一个「第一条记录」，是同一轮的**一批**——
// dsh 实测：11:31:41 那一刻 `next-pointer` 注入与工作台卡片挨着落地，只看排在前面的那条会误判 ❌。
// 口径：`--window-sec N`（>0）把接续点后 N 秒内的记录**并成一条**再判（模型当时看到的是并集）。
// v3（2026-09-25，**外部尺换来的那一刀**）：窗口的单位从「秒」换成「**轮**」。
// 依据：AMAP `tests/test_resume.py` 逐字判据 ——「停之前发出去的话，必须落到**紧接着的那一轮**」
// （`a_message_sent_before_a_stop_reaches_the_very_next_round`），单位是 round、不是 sec。
// 实测（your-logs.jsonl 的 A 撞点）：一轮 = 一簇**同时**的注入（+37s 十连发；下一轮 +46s 三条；
// 再 +53s 一条）⇒ 「缝后的第一轮」= 从缝后第一条起沿 `--burst-sec`（默认 5s）的间隔链往前吃，链断即止。
// 旧口径 `--window-sec` 保留（用来对照）：它会把**后面几轮**的东西算进来 —— A 的 ✅ 归给 `the-reporter`
// 正是这个病（那一簇里工作台卡片和指针都在，却让别的记录拿了最好那条）。
const windowSec = Number(opt('--window-sec', '0'))
  const patternsPath = opt('--patterns')
  if (patternsPath !== undefined) {
    try {
      applyPatterns(JSON.parse(readFileSync(patternsPath, 'utf8')))
      console.log(`${HEAD}: 已按 ${patternsPath} 覆盖词形`)
    } catch (e) {
      console.error(`${HEAD}: --patterns 读取/解析失败：${e.message}`)
      process.exit(2)
    }
  }
const burstSec = Number(opt('--burst-sec', '5'))
const useRound = has('--first-round')
const picked = selectWindow(sorted, afterMs, {
  mode: useRound ? 'round' : 'window',
  windowSec,
  burstSec,
})
const group = picked.group
// 窗内为空 ⇒ 回退到「那一条」（v2 第一版漏了这个回退，实测在撞点 B 上直接崩）
const judged = (group.length > 0 ? group : [first]).map((r) => ({
  record: r,
  verdict: judge(r, { checkPaths: has('--check-paths') }),
}))
const rank = { '✅': 3, '⚠️': 2, '❌': 1, '⚪': 0 }
const best = judged.reduce((a, b) => (rank[b.verdict.state] > rank[a.verdict.state] ? b : a))
const v = best.verdict
console.log(
  `${HEAD}: ${v.state}  ${picked.how} ${judged.length} 条，取最好的一条 → who=${best.record.who} time=${best.record.time}`,
)
for (const j of judged) console.log(`  ${j.verdict.state}  ${j.record.who}`)
console.log(`  ${v.why}`)
console.log(`  可见：上次做到哪=${v.seen.position ? 'y' : 'n'} 在等什么=${v.seen.waiting ? 'y' : 'n'} 为什么=${v.seen.why ? 'y' : 'n'}`)
for (const a of v.artifacts ?? []) console.log(`  物件(${a.kind})：${a.token}`)
process.exit(v.code)
}
