# deepseek-skin · 深海女仆工坊

DeepSeek 鲸鱼娘女仆主题。素材来自 [dsh-deep-whale](https://github.com/Small-tailqwq/dsh-deep-whale) 的
`maid-atelier`，按 OMNE 桌面端的皮肤层重新实现（不是 DSH 插件的移植）。

| 位置 | 层 | 效果 |
| --- | --- | --- |
| 整个应用 `shell.app` | `shell.tokens` | 深海蓝 + 金的调色板（亮 / 暗两套，`light-dark()`）、金色焦点环、更圆的圆角 |
| 侧栏 `shell.sidebar` | `shell.tokens` + `shell.part-style` | 亮暗都是深海蓝底、金色分割线与两角金饰，侧栏内文字转浅色 |
| 导航行 / 会话行（选中） | `shell.part-style` | 蓝色缎带 |
| 新建会话 | `shell.part-style` | 瓷白胶囊钮 + 金边 |
| 输入区 `session.composer` | `shell.part-style` | 蓝宝石蝴蝶结 + 蕾丝边 + 金框，半透明底 |
| 对话头 `session.header` | `shell.part-style` | 半透明玻璃底 + 金线 |
| 对话页背景 `session.backdrop` | `shell.part-render` | 宫殿大厅（亮=白昼、暗=夜晚，淡入淡出），两位鲸鱼娘女仆站在两侧；打开会话时女仆退到页边、阅读栏加一层纱 |
| Agent 的形 `shell.piece` `figure` | 画法 | Q 版鲸鱼娘：闲着开心、干活认真（轻轻上下浮动）、后台犯困 |
| 随身入口 `session.companion.figure` | `shell.part-render` | 同一张 Q 版脸，拖动 / 展开时微微抬起 |

尊重「减少动态效果」：系统打开它时不浮动。

## 目录

```
deepseek-skin/
├── package/            ← 发布的就是这个目录（只能放 .js .css .json 和图片）
│   ├── plugin.json     清单：令牌、样式与画法成员
│   ├── credits.json    署名链（随包走）
│   ├── draw/deepseek.js
│   └── art/*.webp      由 tools/build_art.py 生成
├── tools/build_art.py  从上游仓库裁切、缩放、转 WebP
├── NOTICE.md           署名与许可范围
└── LICENSE-ARTWORK     CC BY-NC-SA 4.0 全文
```

## 重新生成素材

`package/art/` 不进 git。在仓库根目录：

```sh
npm run art -- deepseek-skin       # 取 dsh-deep-whale@a9e2884 的 maid-atelier/，跑 tools/build_art.py（需要 Pillow）
npm run validate -- deepseek-skin
```

## 许可

代码 MIT；`package/art/` 下的美术素材是 **CC BY-NC-SA 4.0**（署名 · 非商业 · 相同方式共享），署名链见
[NOTICE.md](NOTICE.md)。商业分发前需要另行取得素材作者的许可，或换成自己绘制的素材。
