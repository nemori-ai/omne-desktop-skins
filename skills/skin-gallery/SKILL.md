---
name: skin-gallery
description: Install OMNE desktop skins in batches by what the person likes, from the DreamSkin community gallery (about a thousand Codex Dream Skin themes) and from the omne-desktop-skins repository, and remove them. Use when the person wants a new look or several, describes a style, colour, mood or subject ("暗色蓝调的", "猫", "赛博朋克", "装五套清爽的"), gives dreamskin:// links or ver_ ids, gives the omne-desktop-skins repository address, or wants skins removed.
---

# Skin gallery

You are the gallery: you find the themes that fit what the person asked for, convert them into OMNE skins with the
omne-desktop-skins repository, and publish them all to this tenant, where they appear under 资产 → 皮肤. Wearing one is
the person's choice on that page; you cannot switch the worn skin.

Every converted skin changes the same places the repository's most complete skin (`deepseek-skin`) does: the app's
colours, the sidebar as a band of the theme with its picture at the foot, the selected rows, the new-session button,
the header, the composer, the login gate, the conversation backdrop, and the figure of the agent and the floating
companion as a medallion cut from the picture.

## 1. Get the repository ready

You need a checkout of omne-desktop-skins (Node 20 or later, Python 3 with Pillow, git). If the person gave its
address, clone it; else find `scripts/import-dream-skin.mjs` under the home directory with Files `find`; else ask.
Run every command below with Shell, `cwd` the checkout. Check once:

```sh
node --version && python3 -c 'import PIL; print(PIL.__version__)'
```

If Pillow is missing, say so and offer `python3 -m pip install --user Pillow`; do not install it unasked.

## 2. Turn the wish into a search

```sh
npm run --silent dream -- --find <wishes…> [--limit 30]
```

Wishes combine; each kind narrows, and several words of one kind mean any of them:

| Wish | Write | Meaning |
| --- | --- | --- |
| light or dark | `light` `dark` `亮` `暗` `浅` `深` | the theme's ground |
| colour | `blue` `蓝` `red` `红` `pink` `粉` `purple` `紫` `green` `绿` `cyan` `青` `yellow` `金` `orange` `橙` `neutral` `黑白` `灰` | the family of its accent |
| words | anything else, e.g. `猫 cat` `雪` `赛博 cyber` | in the name, author or slug (any of them) |
| licence | `--open`, or `--licence CC-BY-4.0` | only themes under an open licence |

Each line: version id, ground, colour, licence, downloads, name — author. Most downloaded first. A licence written
`own-use:…` is not an open one: such a skin is for the person's own use, and you must say so.

A style that is not a word in names (清爽, 治愈, 高级感) is a ground and colours plus your eyes: search wide, then look.
Try Chinese and English words; most names are Chinese.

## 3. Look before you choose

```sh
npm run --silent dream -- --sheet <ver_…> <ver_…> …      # 1 to 24 ids
```

It writes `local-skins/sheet.jpg`, a numbered contact sheet of the themes' pictures, and prints number, id and name.
Open it with Files `open` and judge the pictures against the wish (subject, mood, how busy they are behind text).
Show it to the person when the wish is a matter of taste.

Who chooses:
- The person named a count and clear wishes ("装 5 套暗色蓝调的") — choose yourself from the sheet and install.
- Otherwise — propose a short list (number, name, licence) and install what the person picks.

## 4. Convert the batch

```sh
npm run --silent dream -- <ver_…> <ver_…> …
```

It downloads each package from the official API, checks it against the sha256 its metadata names, converts it, and
checks the skin against the host's rules. One that fails is reported (`✗ …`) and the rest go on. The last line counts
them; `local-skins/batch.json` lists each skin converted (`skin`, `id`, `name`, `author`, `licence`, `package` — the
absolute directory to publish) and each failure with its reason. A theme in the old package format cannot be
converted: say so.

Skins of the repository itself (`skins/<name>/package`: `deepseek-skin`, `dream-gothic-void-crusade`,
`dream-red-white`) need no conversion; run `npm run art` once if their `package/art/` is missing.

## 5. Publish the batch

1. `OmneExtensions list` with category `skin`: what the tenant holds. A skin you are about to publish whose name is
   held already and is the same theme (its summary names it) is an update; one that is another theme must not
   replace it — convert it alone with `--name <other-name>`.
2. For each `package` in `batch.json`: `OmneExtensions impact` (category `skin`, dir that path), then
   `OmneExtensions publish` with the same dir, name the `skin`, and an id of your own (for example
   `skins-<date>-<skin>`). After an unknown answer, send the same id again; never a new one for the same skin.
3. `OmneExtensions show` each: every member `[in effect]` and the client `loaded`. A member that is not in effect
   while the skin is not worn is normal; one the client could not load is a failure to report as it is.

## 6. Tell the person

The skins installed (name, theme, author, licence), any that failed and why, and that they wear one on
资产 → 皮肤. Say once that a community licence is what its publisher typed and nobody has checked the rights in the
picture, and that a non-commercial licence (`NC`) or an `own-use:` one means personal use only.

## Remove

`OmneExtensions disable` keeps a skin and stops it; `OmneExtensions remove` drops it. Both take an id of your own.
Remove only what the person named.

## Rules

- Never commit anything under `local-skins/`: community art is converted for the person's own use.
- Do not edit converted skins by hand; the mapping lives in `scripts/lib/dream-palette.mjs` and
  `templates/dream/draw/dream.js` (see the repository's AGENTS.md).
- To add community themes to the repository's index (metadata only), `npm run dream -- --sync-catalogue`; it takes
  only themes under a licence that allows redistribution (`scripts/lib/licences.mjs`).
