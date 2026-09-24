# Glossary · 术语对照表（中 → 英，固定译法）

**规矩**：译法一经定下就写在这里，**此后一律沿用**，不要在别的文件里另起一个词。
要加新词，先在这里加一行，再拿它去写正文。

> **Why fix them at all**: the first English version decides the words. If the same Chinese term is
> rendered two ways in two files, a reader assumes two concepts — and no check will ever catch it.

| 中文 | English (fixed) | 注 |
|---|---|---|
| 长程任务 | **long-horizon work** | 不译 "long task"：单位是「活得比一个窗口/一次压缩/一代进程更久」 |
| 静默失败 · 静默地坏 | **silent failure** · **fails quietly** | 不用 "silent bug"——它不是 bug，是没有信号 |
| 判据 | **criterion**（复 criteria） | 能开火的那个东西：一条检查、一个阈值、一次观察 |
| 口径 | **measurement convention** | 决定「这个数在数什么」；**没有口径的读数按不可用处理** |
| 复算 | **recompute** | 与 reproduce 分开：reproduce 要同样输入，recompute 只要同一份记录 |
| 可回放 | **replayable** | |
| 承重 | **load-bearing** | 「这一块有没有承重」= 没有它会不会做错某件事 |
| 四格 · 四处坏法 | **the four failure modes** | 失效地图上的四格 |
| 上下文爆 | **context overflow** | |
| 丢状态 | **lost state** | |
| 偏目标 | **goal drift** | |
| 假完成 | **false completion** | |
| 压缩 | **compaction** | 行业既有词，不另造 |
| 接续指针 | **continuation pointer** | 单数、覆盖式、标 source |
| 任务态外置 | **externalized task state** | |
| 工作台 | **workbench** | |
| 零角色 | **zero-role** | 加角色 = 把状态分裂当机制 |
| 投影 | **projection** | 台面是折出来的，不是手写的 |
| 注入 | **injection** | 每轮自动出现在视野里的那种 |
| 常驻层 · 按需层 | **always-on layer** · **on-demand layer** | |
| 索引 · 摘要 | **index** · **summary** | 常驻层是索引，不是摘要 |
| 收口条件 | **closing condition** | 「什么时候算完成」的那个条件 |
| 外部物 | **external object** | 收口条件必须点名的那类东西（一条退出码、一份别人能打开的文件） |
| 触发 | **trigger** | 触发可自产，判据不能自产 |
| 只追加 | **append-only** | |
| 名字常驻、schema 按需 | **names resident, schemas on demand** | |
| 工具面 | **tool surface** | |
| 分层门控 | **tiered gating** | |
| 懒装载 | **lazy loading** | |
| 瘦身 | **trimming** | 工具面的瘦身必须带前后读数 |
| 破前缀 / 不破前缀 | **breaks / preserves the prompt prefix** | 改一个字节，代价是其后的全部历史 |
| 放尺留手 | **ship the ruler, not the hand** | 交口径与判据，不交依赖本部署的实现。⚠️ 英文里 `hand` 会被读成「人手」⇒ 英文正文中**必须紧跟一句** `a criterion, not an implementation` |
| 盲区 | **blind spot** | 每个读数都要带它写不出来什么 |
| 账本 | **ledger** | 正文统一用「账本」（「台账」同义，不另立条目） |
| 预注册 | **pre-registration** | 先写下预期，再去跑 |
| 会话 · 窗口 · 换代 | **session** · **window** · **generation change** | 换代 = 进程重启/恢复，任务态要活过它 |
| 责任面 | **where the weight lands** | 见下 |

## 两处刻意不直译

- **口径** 不译 "caliber"。它的意思是「这个数在数什么、按什么切、分母是谁」，所以用
  **measurement convention**；正文里第一次出现时给一句括号解释即可，不要每次解释。
- **承重** 保留建筑隐喻（load-bearing）。它是这套材料里最要紧的一个判据形状：
  一块状态要么能回答「没有它我会做错哪件事」，要么它只是好看。

## 一处**不要**出现的词

- **"best practice"** —— 本仓给的是判据与形状，不是规范；写成 best practice 会把可检验的东西
  变成不可反驳的东西。
