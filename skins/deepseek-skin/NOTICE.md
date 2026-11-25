# deepseek-skin · NOTICE

## Code

`package/plugin.json`, `package/draw/` and `tools/` are covered by the MIT licence in `LICENSE` (the same as the repository root `LICENSE`).

## Artwork (`package/art/`)

Every image under `package/art/` is derived from the **maid-atelier** skin of
[Small-tailqwq/dsh-deep-whale](https://github.com/Small-tailqwq/dsh-deep-whale) at commit
`a9e2884388122be47a7c737c18b98ac4896d7c27` (`maid-atelier/assets/`). The derivation only crops, scales and
re-encodes it (`tools/build_art.py`); the bottom-left sidebar corner is the top-right one turned 180°.

The artwork is licensed under **CC BY-NC-SA 4.0** (full text: `LICENSE-ARTWORK`,
<https://creativecommons.org/licenses/by-nc-sa/4.0/>). As the licence asks, the whole chain of authors is credited:

1. **一创 · 上善** — the original whale-girl (鲸鱼娘) character design.
   [Pixiv](https://www.pixiv.net/users/62155430) · [Bilibili（上善无形）](https://b23.tv/8h5L4xz)
2. **二创 · ZipZipPipe** — the maid whale-girl redesign that adds DeepSeek elements.
   [Pixiv](https://www.pixiv.net/users/18604994) · [Bilibili（ZipZipPipe）](https://b23.tv/Pnw6nG8)
3. **三创 · Small-tailqwq** — the maid-atelier skin artwork (backgrounds, maids, ornaments, chibi faces).
   <https://github.com/Small-tailqwq/dsh-deep-whale>
4. **This skin · nemori-ai** — crops and re-encodings of the above for the OMNE desktop client. No new artwork.

Terms that follow from the licence:

- **Attribution**: keep this chain whenever the artwork, or a skin carrying it, is shared.
  `package/credits.json` carries the same chain inside the package, because a package may not carry Markdown.
- **NonCommercial**: the artwork may not be used for commercial purposes. Shipping it in a paid product, or in a
  build distributed commercially, needs separate permission from the rights holders above.
- **ShareAlike**: changed versions of the artwork are shared under CC BY-NC-SA 4.0 as well.

Copyright in the artwork remains with its authors. Issues with the skin belong in this repository, not with them.
