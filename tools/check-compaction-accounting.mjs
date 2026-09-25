#!/usr/bin/env node
/**
 * check-compaction-accounting.mjs — 「压缩记账」判据（可移植、零模型）
 *
 * ## 它问什么（两问，逐字来自外部那份 survey 的自认空档）
 * 「no suite measures compaction the way the formalism requires … **whether a scheme knows what it
 * dropped, whether it can get it back**」（RUC-NLPIR / Awesome-Long-Horizon-Agents）
 * ⇒ 本判据把这两问落成可跑的三态：
 *   1. 压了，有没有**账**（说不说得出丢了什么、丢了多少）；
 *   2. 账里有没有**可取回的落点**（原件路径 / 引用），而不是只报个数。
 *
 * ## 输入契约（和 pointer 判据同一份，换生产者只换适配器）
 *   JSONL，每行 `{"time": <ISO 或 epoch ms>, "who": "<生产者>", "text": "<正文>"}`
 *   —— 记录流里**同时**要有「压缩边界」和「边界附近的账」两类记录。
 *
 * ## 口径（先写死，再看结果；改口径要在这里留一行更正，不做事后重写）
 * - **边界**：`who === "compact"` **或**正文匹配「automatically generated checkpoint / 自动生成的检查点」。
 *   ⚠️ 刻意**不**用裸词「压缩」匹配边界 —— 账那条自己就含「压缩 <id>」，用它当边界会把账读成边界。
 * - **账**：边界**之后**的**第一条**同形记录（**不限时** —— v2 更正：滞后是被量出来的量，不是过滤条件；
 *   实测 dsh 的滞后从 19s 到 2244s，用固定窗会把「账来晚了」误判成「没账」）。边界之前的同形文字**不算**。
 *     「压缩遗留」·「逐字丢掉了?\s*\d+\s*项」·「(dropped|lost)\s+\d+\s+items?」
 *   ⚠️ 账必须在**边界之后**：边界之前出现的同形文字**不算**（那是有人在聊天里说这句话，不是这次压缩的账）。
 * - **可取回的落点**：账那一条里出现 ①文件路径（`X:\…` / `~/…` / `notes/…` / `*.md` / `*.jsonl`）
 *   或 ②引用（`seq=` / `session-<hex>` / `checkpoint-<hex>` / 带扩展名的文件名）。
 *
 * ## 三态与退出码
 *   ✅ 0  有账 + 有落点（知道丢了什么，且**取得回**）
 *   ⚠️ 3  有账、无落点（知道丢了，但取不回）
 *   ❌ 1  压了但**没有任何账**（净损失）
 *   ⚪ 4  记录里没有压缩边界 ⇒ 这条判据**不适用**（不是通过）
 *
 * ## 取哪一条（与 pointer 判据**相反**，这是有意的）
 *   pointer 判据「取最好的一条」（问：缝上有没有东西）；本判据**取最差的一条**
 *   （问：有没有**任何一次**压缩是没账的）。同一批边界里只要有一次 ❌，整体就是 ❌。
 *
 * ## 盲区（必须连着读）
 * - 只读**记录流**：如果生产者把账写在记录之外（如磁盘上的 another file），这里会报 ❌ 而其实有账。
 * - 「有落点」只证明**指向了**可取的东西，**不证明取回来是对的**（那是第二把尺的事）。
 * - 窗口 `600s` 是**拍的**（dsh 实测：边界后 31s 与 165s 各一例 ⇒ 600 够，但没跨生产者校准）。
 * - 「边界」的识别靠**词形**：换一个不认识这个词形的生产者 ⇒ 会判成 ⚪（不适用），不是失败。
 *
 * exit: 0 ✅ / 1 ❌ / 3 ⚠️ / 4 ⚪ / 2 用法错误
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const HEAD = '压缩记账判据'

// ⚠️ **词形是契约，不是常量**（2026-09-25 改）：换一个生产者，边界 / 账 / 落点的措辞都会不同
// ⇒ 全部收进这个对象，并可由 `--patterns <file.json>` 覆盖。**默认值 = dsh 的措辞**，不是通用真理。
export const PAT = {
  boundaryWho: 'compact',
  boundaryRe: /automatically generated checkpoint|自动生成的检查点/i,
  accountRe: /压缩遗留|逐字丢掉了?\s*\d+\s*项|(dropped|lost)\s+\d+\s+items?/i,
  pointerRe:
    /[A-Za-z]:\\[^\s，。；]+|~\/[^\s，。；]+|[\w./-]+\.(md|jsonl|txt|json)\b|seq[=\s]?\d+|session[- ][0-9a-f]{6,}|checkpoint[- ][0-9a-f]{6,}/i,
}

/** 覆盖词形（只认字符串形式的正则；`boundaryWho` 是产者名，不是正则）。返回生效后的表。 */
export function applyPatterns(p) {
  if (typeof p.boundaryWho === 'string') PAT.boundaryWho = p.boundaryWho
  for (const k of ['boundaryRe', 'accountRe', 'pointerRe']) {
    if (typeof p[k] === 'string') PAT[k] = new RegExp(p[k], 'i')
  }
  return PAT
}

export const isBoundary = (r) => r.who === PAT.boundaryWho || PAT.boundaryRe.test(String(r.text ?? ''))
export const isAccount = (r) => PAT.accountRe.test(String(r.text ?? ''))
export const hasPointer = (r) => PAT.pointerRe.test(String(r.text ?? ''))

/** 判**一个**压缩边界：找它后面的账。`window` = 边界后同窗内的记录（已按时间排序）。 */
export function judgeBoundary(boundary, window) {
  const t = toMs(boundary.time)
  if (Number.isNaN(t)) {
    return { state: '⚪', code: 4, why: '边界没有可解析的时间戳 ⇒ 判不了', account: null }
  }
  const account = (window ?? []).find((r) => isAccount(r))
  if (account === undefined) {
    return { state: '❌', code: 1, why: '压了但没有任何账（净损失）', account: null }
  }
  if (hasPointer(account)) {
    return { state: '✅', code: 0, why: '有账，且账里给了可取回的落点', account }
  }
  return { state: '⚠️', code: 3, why: '有账但只报数、没有可取回的落点', account }
}

/** 一个边界的观察窗：边界之后 `sec` 秒内的记录（**边界之前的不算** —— 那是这次压缩之外的文字）。 */
export function windowFor(records, boundary, sec) {
  const t = toMs(boundary.time)
  return records.filter((r) => toMs(r.time) > t && toMs(r.time) <= t + sec * 1000)
}

const FIXTURES = [
  {
    name: '✅ 有账 + 有落点（该亮）',
    expect: '✅',
    boundary: { time: '2026-09-25T10:00:00+08:00', who: 'compact', text: 'automatically generated checkpoint condensing an earlier span' },
    window: [
      {
        time: '2026-09-25T10:00:31+08:00',
        who: 'notifier',
        text: '[压缩遗留] 这一代摘要逐字丢掉了 15 项：… · 逐字原件：archive/run-42/context.md',
      },
    ],
  },
  {
    name: '⚠️ 有账、无落点（该半亮）',
    expect: '⚠️',
    boundary: { time: '2026-09-25T10:00:00+08:00', who: 'compact', text: 'automatically generated checkpoint condensing an earlier span' },
    window: [{ time: '2026-09-25T10:01:00+08:00', who: 'notifier', text: '[压缩遗留] 这一代摘要逐字丢掉了 15 项。' }],
  },
  {
    name: '❌ 压了但没有任何账（该灭）',
    expect: '❌',
    boundary: { time: '2026-09-25T10:00:00+08:00', who: 'compact', text: 'automatically generated checkpoint condensing an earlier span' },
    window: [{ time: '2026-09-25T10:02:00+08:00', who: 'model', text: '继续做下一步。' }],
  },
  {
    name: '⚪ 没有边界（这条判据不适用，不算通过）',
    expect: '⚪',
    boundary: null,
    window: [],
  },
  {
    name: '选择层对照：同形文字在**边界之前** ⇒ 不算这次的账（该灭）',
    expect: '❌',
    records: [
      {
        time: '2026-09-25T09:59:00+08:00',
        who: 'notifier',
        text: '[压缩遗留] 逐字丢掉了 15 项 · 逐字原件：archive/run-42/context.md',
      },
      {
        time: '2026-09-25T10:00:00+08:00',
        who: 'compact',
        text: 'automatically generated checkpoint condensing an earlier span',
      },
    ],
    windowSec: 600,
  },
  {
    // ⚠️ 这条是**真物打脸之后补的**（2026-09-25）：dsh 的记录里 time 是 **epoch 毫秒数**，
    // 而前面几条 fixture 全写 ISO ⇒ 对照没抓到「尺子不认自己的数据格式」这个 bug（9 个边界误判 ⚪）。
    name: '✅ 时间戳是 epoch 数字（不是 ISO）⇒ 仍该亮',
    expect: '✅',
    boundary: { time: 1790265499650, who: 'compact', text: 'automatically generated checkpoint condensing' },
    window: [
      {
        time: 1790265529650,
        who: 'notifier',
        text: '[压缩遗留] 逐字丢掉了 15 项 · 逐字原件：archive/run-42/context.md',
      },
    ],
  },
]

function selftest(asJson) {
  let failed = 0
  const rows = []
  for (const f of FIXTURES) {
    let got
    if (f.records !== undefined) {
      const b = f.records.filter(isBoundary)[0]
      got = judgeBoundary(b, windowFor(f.records, b, f.windowSec ?? 600))
    } else if (f.boundary === null) {
      got = { state: '⚪', why: '记录里没有压缩边界 ⇒ 不适用' }
    } else {
      got = judgeBoundary(f.boundary, f.window)
    }
    const pass = got.state === f.expect
    if (!pass) failed += 1
    rows.push({ fixture: f.name, expect: f.expect, got: got.state, pass, why: got.why })
  }
  if (asJson) console.log(JSON.stringify({ gate: HEAD, mode: 'selftest', rows, failed }, null, 2))
  else {
    for (const r of rows) console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.expect} → ${r.got}  ${r.fixture}`)
    console.log(
      `${HEAD} selftest: ${rows.length - failed}/${rows.length} 通过（两侧对照：该亮 ${rows.filter((r) => r.expect === '✅').length} 条 / 半 ${rows.filter((r) => r.expect === '⚠️').length} 条 / 该灭 ${rows.filter((r) => r.expect === '❌').length} 条 / 不适用 ${rows.filter((r) => r.expect === '⚪').length} 条）`,
    )
    console.log(failed === 0 ? `${HEAD}: 自带两侧对照全过 ✓` : `${HEAD}: 有 ${failed} 条对照没过 ✗`)
  }
  process.exit(failed === 0 ? 0 : 1)
}

const toMs = (t) =>
  typeof t === 'number' ? t : Number.isFinite(Date.parse(String(t))) ? Date.parse(String(t)) : Number.NaN

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const argv = process.argv.slice(2)
  const has = (f) => argv.includes(f)
  const opt = (f, d) => {
    const i = argv.indexOf(f)
    return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
  }
  if (has('--selftest')) selftest(has('--json'))

  const logPath = opt('--log')
  if (!logPath) {
    console.error(`${HEAD}: 用法 --log <records.jsonl> [--after <时间戳>] [--window-sec N] [--all] | --selftest`)
    process.exit(2)
  }
  const windowSec = Number(opt('--window-sec', '600'))
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
  const afterMs = opt('--after') === undefined ? undefined : toMs(opt('--after'))
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
    .sort((a, b) => toMs(a.time) - toMs(b.time))

  const boundaries = records.filter(
    (r) => isBoundary(r) && (afterMs === undefined || Number.isNaN(afterMs) || toMs(r.time) > afterMs),
  )
  if (boundaries.length === 0) {
    console.log(
      `${HEAD}: ⚪ 判不了 —— 这份记录里没有可识别的压缩边界（记 ${records.length} 条，窗 ${windowSec}s）⇒ 这条判据不适用，**不算通过**`,
    )
    process.exit(4)
  }
  const rank = { '✅': 3, '⚠️': 2, '❌': 1, '⚪': 0 }
  // v2 更正（2026-09-25，**真物打脸之后改的**）：窗口不该当过滤器。
  // 实测 dsh：11 条账相对其边界的滞后分布 = 19s / 31s / 50s / 57s / 104s / 133s / 149s / 181s / 218s / 725s / 2244s
  // —— 那条 725s 的账就落**下一次重启**那一刻（声呐在会话启动时才播报）。用 600s 窗 ⇒ 把「账来晚了」误判成「没账」。
  // ⇒ 现口径：**取边界之后的第一条账**（不限时），并把**滞后当读数报出来**；
  //    一条边界后面确实没有账时，还要看**记录是否在边界之后又延续了 windowSec** —— 没延续就是「未定」（⚪），不是「没账」。
  const rows = boundaries.map((b) => {
    const after = records.filter((r) => toMs(r.time) > toMs(b.time))
    const acc = after.find((r) => isAccount(r))
    const lagSec = acc === undefined ? null : Math.round((toMs(acc.time) - toMs(b.time)) / 1000)
    const lastMs = toMs(records[records.length - 1].time)
    const settled = lastMs - toMs(b.time) > windowSec * 1000
    let v
    if (acc !== undefined) {
      v = hasPointer(acc)
        ? { state: '✅', code: 0, why: `有账，且账里给了可取回的落点（滞后 ${lagSec}s）`, account: acc }
        : { state: '⚠️', code: 3, why: `有账但只报数、没有落点（滞后 ${lagSec}s）`, account: acc }
    } else if (settled) {
      v = {
        state: '❌',
        code: 1,
        why: `压了之后 ${Math.round((lastMs - toMs(b.time)) / 1000)}s 内没有任何账（记录到此为止）`,
        account: null,
      }
    } else {
      v = { state: '⚪', code: 4, why: '记录在边界之后不久就结束了 ⇒ 账可能还没送到（未定）', account: null }
    }
    return { b, v, lagSec }
  })
  const worst = rows.reduce((a, b) => (rank[b.v.state] < rank[a.v.state] ? b : a))
  console.log(
    `${HEAD}: ${worst.v.state}  ${rows.length} 个压缩边界，**取最差的一条** → 边界 time=${worst.b.time}  who=${worst.b.who}（账的滞后 ${worst.lagSec === null ? '无' : worst.lagSec + 's'}）`,
  )
  if (has('--all')) for (const r of rows) console.log(`  ${r.v.state}  ${r.b.time}  ${r.v.why}`)
  console.log(`  ${worst.v.why}`)
  if (worst.v.account !== null)
    console.log(`  账（who=${worst.v.account.who}）：${String(worst.v.account.text).replace(/\s+/g, ' ').slice(0, 160)}`)
  const cut = (s) => (s.length > 48 ? s.slice(0, 48) + '…' : s)
  console.log(
    `  口径（**生效值**，不是默认值）：边界=who=${PAT.boundaryWho} 或 /${cut(PAT.boundaryRe.source)}/ · 账=/${cut(PAT.accountRe.source)}/ · 落点=/${cut(PAT.pointerRe.source)}/`,
  )
  process.exit(worst.v.code)
}
