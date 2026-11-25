# dream-red-white · Dream Skin

Dream Skin 红白：玫瑰红光穹与白色未来城的抽象晨景，红白配色（Codex Dream Skin 默认主题移植）。

移植自 [Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin) 的主题 `macos/assets`（提交 `6fc42df`）。

| 位置 | 层 | 效果 |
| --- | --- | --- |
| 整个应用 `shell.app` | `shell.tokens` | 主题十色映射成 `--omne-*` 令牌；画面为亮色而作，另一模式由强调色推导，写成 `light-dark()` |
| 侧栏 `shell.sidebar` | `shell.tokens` + `shell.part-style` | 侧栏是主题色的一条带，底部淡入一条主题画面（`art/sidebar.webp`）；选中的导航与会话行是强调色浅底加左侧色条；「新建会话」是强调色胶囊 |
| 对话头、输入区、发送钮、登录门 | `shell.part-style` | 强调色细线、半透明玻璃底、圆角 |
| Agent 的形象 `shell.piece figure`、随身入口 `session.companion.figure` | 画法 | 从主题画面焦点处裁出的圆形徽章（`art/figure.webp`），强调色描边，干活时轻轻起伏 |
| 对话页背景 `session.backdrop` | `shell.part-render` | 主题背景图（2048×685 WebP，焦点 0.5 / 0.5）；纱在阅读栏最浓，停靠的右侧栏垫底；空页右下角是主题口号 |

生成：`scripts/import-dream-skin.mjs`（映射 `scripts/lib/dream-palette.mjs`，画法模板 `templates/dream/draw/dream.js`）。不要手改生成的文件，改映射或模板后重新生成。

素材来源与许可见 [NOTICE.md](NOTICE.md)。
