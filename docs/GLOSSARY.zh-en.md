# Glossary · 术语对照表（中 → 英，固定译法）

**规矩**：译法一经定下就写在这里，**此后一律沿用**，不要在别的文件里另起一个词。
要加新词，先在这里加一行，再拿它去写正文。

> **Why fix them at all**: the first English version decides the words. If the same Chinese term is
> rendered two ways in two files, a reader assumes two concepts — and no check will ever catch it.

## 2026-09-25 换词：为了可读性替换的四组词

**理由**：读者反馈（同一个词在两种语言里都要一次读懂）——隐喻词先要读者先学一套比喻，才看得见里面的东西。
这四组换成**直说**的写法；**旧词在旧提交与旧引文里照此表读**，正文一律用新词。

| 旧词 | 新词 | English（固定） | 为什么换 |
|---|---|---|---|
| 旧词（**本表内保留作对照，别处一律不用**） | 新词（正文一律用） | English（固定） | 为什么换 |
|---|---|---|---|
| 尺 · 一把尺 · 放尺留手 | **量具** · **给测量方法，不给实现** | **measuring tool** · **ship the measurement, not the implementation** | 「尺」要先学一套比喻；「测量」是这件事本身。⚠️ 旧英译里的 `hand` 会被读成「人手」，一并换掉 |
| 缝 · 缝上 · 缝后第一轮 | **切换点** · 在切换点上 · **切换之后的第一轮** | **switch point** · first round after a switch | 「缝」同时指三件事（换窗口 / 压缩 / 重启）；直说「切换点」不用先解释 |
| 件（三样：机制 / 载体 / 装置） | **机制** | **mechanism** | 与「载体」「装置」并列时，「机制」是读者已经有的词 |
| 开火 · 它不该开火 | **触发**（判据真的失败 / 报红） | **fires** · triggers | 「开火」在正文里出现时总得配一句解释 |
| 票数（几个独立生产者撞过） | **独立来源数** | **independent sources** | 「票」像投票；这里量的是「拿去跑过几份**不相关的**日志」 |

⚠️ **不换的词（它们已经是直说的）**：判据 · 口径 · 读数 · 盲区 · 负对照 · 预注册 · 未验 · 收口条件。

⚠️ **换词扫描必须排除本表的「旧词」那一列**——这张表是**唯一**该保留旧词的地方。2026-09-25 第一遍扫描
把本表左列也一起换了，表当场自毁：左列变成新词、理由句变成「量具要先学比喻」这种废话。
另：`docs/01-四格.md` 与 `docs/05-尺自己也会安静地错.md` 这两个**文件名**不换（改名会断链），
正文提到它们时**按文件名逐字写**，别顺手换词。

| 中文 | English (fixed) | 注 |
|---|---|---|
| 长程任务 | **long-horizon work** | 不译 "long task"：单位是「活得比一个窗口/一次压缩/一代进程更久」 |
| 静默失败 · 静默地坏 | **silent failure** · **fails quietly** | 不用 "silent bug"——它不是 bug，是没有信号 |
| 判据 | **criterion**（复 criteria） | 能触发的那个东西：一条检查、一个阈值、一次观察 |
| 口径 | **measurement convention** | 决定「这个数在数什么」；**没有口径的读数按不可用处理** |
| 复算 | **recompute** | 与 reproduce 分开：reproduce 要同样输入，recompute 只要同一份记录 |
| 可回放 | **replayable** | |
| 承重 | **load-bearing** | 「这一块有没有承重」= 没有它会不会做错某件事 |
| 四种坏法（旧：四格） | **the four failure modes** | 失效地图上的四类；文件仍叫 `docs/01-四格.md`（改名会断链） |
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
| 给测量方法，不给实现 | **ship the measurement, not the implementation** | 交口径与判据，不交依赖本部署的实现。（旧说法「给测量方法，不给实现 / ship the measurement, not the implementation」已换 —— 英文里 `hand` 会被读成「人手」） |
| 盲区 | **blind spot** | 每个读数都要带它写不出来什么 |
| 账本 | **ledger** | 正文统一用「账本」（「台账」同义，不另立条目） |
| 预注册 | **pre-registration** | 先写下预期，再去跑 |
| 会话 · 窗口 · 换代 | **session** · **window** · **generation change** | 换代 = 进程重启/恢复，任务态要活过它 |
| 人格核心 | **persona core** | 只在边界声明里出现（本仓不搬它，见 README §0，那里说了可以私下聊） |
| 读数 | **reading** | 一个数 **+ 它的口径 + 它的盲区**；只有数不算读数 |
| 未验 | **not measured** | 没量过的照写「未验」，不补一个听起来合理的推断 |
| 两侧判据 | **two-sided criterion** | 正对照**必须触发**且负对照**必须沉默**；只跑过一侧的判据还不算立住（见 `docs/05`） |
| 正对照 | **positive control** | 拿一份**确知有病**的材料喂量具：它不该沉默 |
| 负对照 | **negative control** | 拿一份**确知没病**的材料喂量具：它不该触发（不误报） |
| 判不了 | **cannot adjudicate** | 既不敢下「是」也不敢下「否」；它占比高 ⇒ 口径没落到可执行的动作上 |
| 换棒 | **baton hand-off** | 目标被**显式**换成另一条、并写明承接——与「偷偷改掉目标」相对 |
| 开卷 / 闭卷 | **open-book / closed-book** | 判读时那把「答案（钥）」在不在读者的上下文里；**开卷的读数不能当独立判据** |

## 两处刻意不直译

- **口径** 不译 "caliber"。它的意思是「这个数在数什么、按什么切、分母是谁」，所以用
  **measurement convention**；正文里第一次出现时给一句括号解释即可，不要每次解释。
- **承重** 保留建筑隐喻（load-bearing）。它是这套材料里最要紧的一个判据形状：
  一块状态要么能回答「没有它我会做错哪件事」，要么它只是好看。

## 一处**不要**出现的词

- **"best practice"** —— 本仓给的是判据与形状，不是规范；写成 best practice 会把可检验的东西
  变成不可反驳的东西。
