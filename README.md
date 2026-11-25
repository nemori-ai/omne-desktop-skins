# omne-desktop-skins

OMNE 桌面端的主题皮肤合集。每套皮肤是一个 OMNE **skin** 扩展（`"kind":"skin"` 的 plugin，只有 client 一侧的成员），
一个租户可以同时持有几套，界面同一时刻只穿一套，在「资产」页切换。

| 皮肤 | 说明 | 素材许可 |
| --- | --- | --- |
| [deepseek-skin](skins/deepseek-skin) | 深海女仆工坊：DeepSeek 鲸鱼娘女仆、宫殿大厅昼夜、深海蓝与金 | CC BY-NC-SA 4.0 |
| [dream-gothic-void-crusade](skins/dream-gothic-void-crusade) | Codex Dream Skin「Gothic Void Crusade」：虚空中的哥特大教堂，烛金与深红（生成） | MIT（seansong-ideogram） |
| [dream-red-white](skins/dream-red-white) | Codex Dream Skin 默认主题：玫瑰红光穹与白色未来城（生成） | MIT（Codex Dream Skin Studio contributors） |

## 目录

```
omne-desktop-skins/
├── skins/
│   └── <skin>/
│       ├── package/          ← 发布的目录，只放 .js .css .json 与图片
│       │   ├── plugin.json   清单：name 与目录同名
│       │   ├── credits.json  素材署名与许可（随包走）
│       │   ├── draw/*.js     画法模块（按需）
│       │   └── art/*         图片（按需；不进 git，由 npm run art 从钉住的上游生成）
│       ├── tools/            生成素材的脚本（按需，不进包）
│       ├── README.md
│       └── NOTICE.md         素材来源与许可
├── sources/codex-dream-skin.json    上游仓库主题的登记表：提交、每个文件的 sha256 与权利来源、没收录的及原因
├── sources/dreamskin-community.json 社区主题索引（生成，只有元数据）：许可允许再分发的全部收录
├── skills/skin-gallery/      给 agent 的 Skill：按偏好找主题、看图、批量转换并装进「资产 → 皮肤」
├── templates/skin/           npm run new 的模板
├── templates/dream/          Dream 主题共用的背景画法（导入器把主题常量注入）
├── contract/omne-contract.json  OMNE 界面契约快照（令牌、部件、图标、共享件）
├── scripts/                  validate / new-skin / sync-contract / import-dream-skin / fetch-art
└── tests/                    node --test
```

`package/` 之外的文件（README、NOTICE、工具脚本）不进包：OMNE 的包只接受 `.js .css .json .png .jpg .webp .avif .svg`，
多一个 `README.md` 或 `.DS_Store` 整个发布就会被拒。

## 常用命令

```sh
npm run art                           # 从钉住的上游生成各皮肤的 package/art/（新 checkout 先跑）
npm run check                         # validate + test
npm run validate -- deepseek-skin     # 只查一套
npm run new -- ocean-skin "一句话说它长什么样"
npm run sync-contract -- --source ../omne-harness-lite   # OMNE 升级后刷新契约快照
npm run dream -- --upstream /tmp/Codex-Dream-Skin        # 按登记表重新生成 dream-* 皮肤
npm run dream -- ver_xxxxxxxx                            # 把一个 DreamSkin 社区主题转成本地皮肤（local-skins/）
npm run dream -- --find 暗 蓝 猫                         # 按偏好找社区主题
npm run dream -- --sheet ver_a ver_b …                   # 它们的画面拼成一张带编号的预览图
npm run dream -- ver_a ver_b …                          # 一批转换；local-skins/batch.json 列出要发布的目录
```

不需要 `npm install`：脚本只用 Node 自带模块（Node ≥ 20）。生成素材需要 git、Python 3 与 Pillow。

**仓库里没有素材**：`skins/*/package/art/` 不进 git。新 checkout 先跑 `npm run art`，它把每套皮肤的上游按钉住的提交
取到 `.cache/upstream/`（只取用到的路径），再生成 `package/art/`；结果与发布的版本逐字节一致。没取素材时 `npm run check` 会失败并提示这一步。

## Codex Dream Skin 主题：一份映射，全部兼容

[Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin) 的主题包都是同一个格式：`theme.json`（十个调色键、
`appearance`、`art.focusX/focusY/safeArea`、口号）加一张背景图。所以这里不逐个手写皮肤，而是一份映射加一份画法：

- `scripts/lib/dream-palette.mjs`：十色 → `--omne-*` 令牌与几处 `shell.part-style`。主题只为它的画面画了一种模式；
  另一种模式由强调色推导（强调色在面板上保持 ≥ 4.5 的对比度），统一写成 `light-dark()`。
- `templates/dream/draw/dream.js`：`session.backdrop` 的画法。背景按焦点 cover；纱在阅读栏最浓（读 `session.composer`
  的实际位置），停靠的右侧栏垫底；画面与当前模式不符时纱更重，变成淡印；空页右下角是主题口号。
- `scripts/import-dream-skin.mjs`：生成整套皮肤（清单、credits、画法、WebP 背景、README、NOTICE、LICENSE），生成后
  用宿主规则校验。生成的文件不要手改：改映射或模板，再重新生成。

仓库里**只收录权利清楚可再分发的主题**，登记在 `sources/codex-dream-skin.json`（含每个文件的 sha256）。上游仓库里
的「桥本有菜」预设（真人肖像，上游 NOTICE 明确排除在 MIT 之外）和 `docs/images` 里的同人图不收录。

DreamSkin 社区（`api.dreamskin.cc`）有约一千个主题，许可由发布者自填、未经核实，侵权会被平台下架，合计约 2.3 GiB，
所以**图片不拷进仓库**。声明的许可允许再分发与修改的（MIT、CC BY 4.0、CC BY-NC 4.0、CC BY-NC-SA 4.0 及其组合，
归一规则在 `scripts/lib/licences.mjs`）全部收录进 `sources/dreamskin-community.json`：只有元数据（名字、作者、许可、包的
sha256），素材在用的时候从官方接口下载、校验、转换。当前收录 605 / 999；其余的（版权所有、仅限个人使用、
Pixabay、NoDerivatives、读不出是哪个许可的）按类计数写在索引的 `left` 里。

```sh
npm run dream -- --sync-catalogue                  # 重新生成索引（社区主题增减、改许可后）
npm run dream -- --all [--licence CC-BY-4.0]        # 把索引里的全部（或某一种许可的）转成皮肤，已转过且未变的跳过
```

单个主题、任意许可，给自己用：

```sh
npm run dream -- --search 赛博                     # 按名字、作者、许可找
npm run dream -- 'dreamskin://apply?version=ver_…' # 或直接给 ver_…；从官方接口下载，按元数据的 sha256 校验
npm run dream -- ./my-theme.zip                    # 手上的主题包或解压目录
npm run dream -- --check-catalogue                 # 把全部社区主题的调色过一遍映射与宿主规则（不下载图片）
```

转换结果写到 `local-skins/<name>/`（git 忽略），NOTICE 与 credits 里写着发布者、声明的许可和来源包的 sha256，
仅供自用；在 OMNE 里用 `OmneExtensions publish`（dir = `local-skins/<name>/package` 的绝对路径）穿上。需要 Python 3 与 Pillow。

## 给 agent 用：按偏好批量安装

把这个仓库的地址交给 OMNE 里的 agent，说出想要什么（「装 5 套暗色蓝调的」「有猫的」「这几个 dreamskin 链接」），它按
[`skills/skin-gallery/SKILL.md`](skills/skin-gallery/SKILL.md) 做完整套流程，装好的皮肤出现在「资产 → 皮肤」，穿哪套由人自己选：

1. `npm run dream -- --find <偏好…>`：按亮 / 暗、强调色色系、名字里的词、许可筛选线上目录（约一千个），下载多的在前；
   中英文都认（规则在 `scripts/lib/catalogue.mjs`）。
2. `npm run dream -- --sheet <ver_…> …`：把候选的画面拼成 `local-skins/sheet.jpg`，agent 用眼睛挑，也可以拿给人看。
3. `npm run dream -- <ver_…> …`：一批下载、按 sha256 校验、转换、用宿主规则自查；一个失败不影响其余，
   `local-skins/batch.json` 列出每套的包目录与许可。
4. 对每个包：`OmneExtensions impact` → `publish` → `show`。

每套转换出来的皮肤改的地方与 `deepseek-skin`（仓库里最完整的一套）一一对应，测试里有这一条：

| 位置 | deepseek-skin | 转换出来的 dream-* |
| --- | --- | --- |
| 整个应用的令牌 | 深海蓝与金 | 主题十色，另一模式由强调色推导；圆角与阴影同 deepseek |
| 侧栏 | 深蓝带 + 角花 | 主题色的一条带，底部淡入一条主题画面 |
| 选中的导航与会话行 | 缎带 | 强调色浅底加左侧色条 |
| 「新建会话」 | 奶白胶囊 | 强调色胶囊 |
| 对话头、输入区、发送钮、登录门 | 金边、蕾丝、蝴蝶结 | 强调色细线、半透明玻璃底 |
| 对话页背景 | 宫殿昼夜 + 两位女仆 | 主题背景图，纱在阅读栏最浓，空页右下角是口号 |
| Agent 的形象、随身入口 | Q 版鲸鱼娘（按忙闲换表情） | 从画面里最有内容的地方裁出的圆形徽章，干活时起伏 |

### 为什么不是一个可视化的皮肤库页面

以当前客户端实测（每个点发一个探针插件，看 `OmneExtensions show` 里客户端的回答）：

- 「资产」页的 `assets.category-page`（一类资产自己的页）、`assets.category`（列表上方）、`assets.holding`（详情），以及
  `notification.inbox-sections`、`usage.widget`、`session.dock`、`session.side`、`session.status`、`shell.actions` 都答
  `the point takes no drawing`：不收插件代码。`impact` 对它们报 in effect，要到客户端加载时才被拒。
- 收插件代码的有 `shell.part-render`（开放 render 的部件）、`shell.icon`、`shell.piece`、`session.tool-call`。插件画法拿到
  `{ React, ui, shell: { navigate, toast, scope }, files }`；同源 `fetch` 可用，外网（`api.dreamskin.cc`）被 CSP 挡住。
- 插件不能发布资产：客户端画法没有这个能力，借给服务端插件的口（`plugin.ports`）只有 `notifications`。

所以挑选和安装由 agent 做。宿主哪天让类别页收插件画法、给插件一个发布皮肤的口，这套命令就是那个页面的后端。

## validate 查什么

OMNE 客户端装皮肤时是「全有或全无」：任何一个成员被拒，整套皮肤都不生效。而发布时服务端只看清单与文件，
令牌名、部件名、样式值要等客户端连上才查。`scripts/validate.mjs` 把客户端的规则（抄自 omne-harness-lite，
见 `scripts/lib/rules.mjs` 里标注的源文件）和契约快照放在本地先跑一遍：

- 清单：schema、name、summary、`kind: skin`、没有 server 侧、成员不写 id/rank、同一位置不重复；
- 包：文件类型、图片文件头与扩展名一致、`file(...)` 和模块指向的文件都在；
- 令牌：只能是界面已有的 `--omne-*`，部件要开放 tokens 层；
- 样式：状态只有 base / hover / focus-visible / active / selected / open / disabled；值只能含 `A-Za-z0-9 #%.,()+*/_-`，
  函数只能是 `var calc min max clamp` 与颜色函数（含 `light-dark`、`color-mix`）——**没有** `url()`、`linear-gradient()`、
  `blur()`，图片用 `file(art/x.webp)`；
- 画法：用一个最小的假 React 把每个画法按典型 props 画一遍，查导出是否存在、是否抛错、最外层是否带 part、
  用到的图片是否在包里。

它不能代替人眼：发布后仍要在桌面端穿上皮肤，亮色、暗色各看一遍。

## 发布到 OMNE

在 OMNE 里让 agent 用 `OmneExtensions` 做，或者自己在「资产 → 皮肤」里操作：

1. `npm run check` 全绿。
2. `OmneExtensions impact`：category `skin`，dir 为 `skins/<skin>/package` 的**绝对路径**。
3. `OmneExtensions publish`（同一个 dir，name = 皮肤名），然后 `OmneExtensions show` 看每个成员是否生效。
4. 在「资产」页穿上它，切换亮 / 暗检查；不要了就 `disable`（保留）或 `remove`。

## 许可

沿用参考项目 [dsh-deep-whale](https://github.com/Small-tailqwq/dsh-deep-whale) 的协议组合：

- **代码**：MIT。根目录与每个皮肤目录各有一份 `LICENSE`，开头的「Licensing scope」写明 MIT 只覆盖代码（脚本、清单、画法模块、测试），美术素材不在其内。
- **美术素材**：按各皮肤自己的 `LICENSE-ARTWORK` 与 `NOTICE.md`。`deepseek-skin` 的素材是 **CC BY-NC-SA 4.0**：保留完整署名链、**不可商用**、改动后的素材以相同协议共享。`package/credits.json` 在包里带着同一条署名链。

## 致谢

`deepseek-skin` 的全部美术素材来自 [Small-tailqwq/dsh-deep-whale](https://github.com/Small-tailqwq/dsh-deep-whale)
的 `maid-atelier`（深海女仆工坊）皮肤，提交 `a9e2884`。我们只做了裁切、缩放与转 WebP，没有新增美术。署名链：

| 创作 | 作者 | 主页 |
| --- | --- | --- |
| 一创：鲸鱼娘角色形象原作 | 上善 | [Pixiv](https://www.pixiv.net/users/62155430) · [Bilibili（上善无形）](https://b23.tv/8h5L4xz) |
| 二创：加入 DeepSeek 元素的女仆鲸鱼娘 | ZipZipPipe | [Pixiv](https://www.pixiv.net/users/18604994) · [Bilibili（ZipZipPipe）](https://b23.tv/Pnw6nG8) |
| 三创：maid-atelier 皮肤素材 | Small-tailqwq | [GitHub](https://github.com/Small-tailqwq/dsh-deep-whale) |

素材协议：[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)。感谢以上作者。
本仓库皮肤的问题请在本仓库反馈，不要去打扰原作者。

`dream-*` 皮肤的主题与素材来自 [Fei-Away/Codex-Dream-Skin](https://github.com/Fei-Away/Codex-Dream-Skin)（MIT，
Copyright (c) 2026 Codex Dream Skin Studio contributors），提交 `6fc42df`；每套皮肤带着上游 MIT 全文（`LICENSE-ARTWORK`）
与署名（`NOTICE.md`、`package/credits.json`）：

| 皮肤 | 素材作者 | 依据 |
| --- | --- | --- |
| dream-gothic-void-crusade | [seansong-ideogram](https://github.com/seansong-ideogram) | 经 [PR #134](https://github.com/Fei-Away/Codex-Dream-Skin/pull/134) 贡献给该 MIT 项目，是其安装包的可再分发默认素材 |
| dream-red-white | Codex Dream Skin Studio contributors | 为该仓库生成的原创抽象图（无角色），在其 MIT 许可内 |

Codex Dream Skin 与 DreamSkin 是独立的第三方项目，与 OpenAI 无隶属、授权或背书关系；这些皮肤及其名字同样不代表任何
OpenAI / Codex 关系。感谢上游作者与社区创作者。
