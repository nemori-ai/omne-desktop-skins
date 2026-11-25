#!/usr/bin/env node
// Turns Codex Dream Skin themes into OMNE skins with one mapping (scripts/lib/dream-palette.mjs) and one shared
// backdrop drawing (templates/dream/draw/dream.js). No theme is written by hand.
//
//   npm run dream -- --upstream <Codex-Dream-Skin checkout>   rebuild every skin sources/codex-dream-skin.json lists
//   npm run dream -- ver_xxxxxxxx                              one DreamSkin community theme, for your own use
//   npm run dream -- 'dreamskin://apply?version=ver_xxxxxxxx'  the same, from a one-click link
//   npm run dream -- ./some-theme-dir | ./theme.zip            a theme package you have on disk, for your own use
//   npm run dream -- --find <wishes…>                          find community themes by words, light/dark, colour,
//                                                              licence (see scripts/lib/catalogue.mjs)
//   npm run dream -- --sheet ver_a ver_b …                     a numbered contact sheet of their pictures
//   npm run dream -- ver_a ver_b … | links | paths              convert a batch; local-skins/batch.json lists them
//   npm run dream -- --sync-catalogue                          rewrite sources/dreamskin-community.json: every
//                                                              community theme under an open licence (metadata only)
//   npm run dream -- --all [--licence <SPDX>]                  download and convert every theme of that index
//   npm run dream -- --check-catalogue                         map every community theme's palette and check it
//
// Community and local themes go to local-skins/<name>/ (ignored by git): their art is the publisher's, under the
// licence they declared, and is not redistributed from this repository. Publish one into your own OMNE with
// OmneExtensions publish (category skin, dir = the absolute path of local-skins/<name>/package).
// Options: --name <skin>  --out <dir>  --width <px> (largest background width, 2048 by default).

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkSkin } from './lib/check-skin.mjs'
import { membersOf, sceneOf, skinName } from './lib/dream-palette.mjs'
import { find, lineOf, wishesOf } from './lib/catalogue.mjs'
import { licenceOf } from './lib/licences.mjs'
import { dataFault, manifestFaults } from './lib/rules.mjs'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const API = 'https://api.dreamskin.cc/v1/themes'
const PAGE = 48
const contract = JSON.parse(readFileSync(join(ROOT, 'contract', 'omne-contract.json'), 'utf8'))
const registry = JSON.parse(readFileSync(join(ROOT, 'sources', 'codex-dream-skin.json'), 'utf8'))
const TEMPLATE = readFileSync(join(ROOT, 'templates', 'dream', 'draw', 'dream.js'), 'utf8')

const INDEX = join(ROOT, 'sources', 'dreamskin-community.json')
// The revision of the mapping and drawings a skin was converted with; a skin of an older one is converted again.
const REVISION = 2
const CONVERTER = { by: 'scripts/import-dream-skin.mjs', revision: REVISION }

/** A theme that cannot be turned into a skin: the batch reports it and goes on, a single run stops on it. */
class Refused extends Error {}
const fail = words => {
  throw new Refused(words)
}
const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex')
const json = value => `${JSON.stringify(value, null, 2)}\n`
const write = (path, text) => {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, text)
}

function art(...args) {
  const ran = spawnSync('python3', [join(ROOT, 'scripts', 'lib', 'dream_art.py'), ...args], { encoding: 'utf8' })
  if (ran.error !== undefined) fail(`python3 could not be run (${ran.error.message}); it needs Pillow: pip install Pillow`)
  if (ran.status !== 0) fail(`${args[0]}: ${(ran.stderr || ran.stdout).trim()}`)
  return JSON.parse(ran.stdout.trim().split('\n').at(-1))
}

/** Writes one skin: package (manifest, credits, drawing, background) and the documents beside it, then checks it. */
async function writeSkin({ dir, name, theme, picture, summary, credits, notice, readme, artworkLicence, width }) {
  rmSync(join(dir, 'package'), { recursive: true, force: true })
  const shown = art('image', picture, join(dir, 'package', 'art', 'background.webp'), String(width))
  const scene = sceneOf(theme, 'art/background.webp', shown.vivid)
  art('extras', picture, join(dir, 'package', 'art'), String(scene.focusX), String(scene.focusY))
  const members = membersOf(theme, { fallbackAccent: shown.vivid })
  const manifest = { schema: 1, name, summary, kind: 'skin', client: { members } }
  write(join(dir, 'package', 'plugin.json'), json(manifest))
  write(join(dir, 'package', 'credits.json'), json({ skin: name, code: { licence: 'MIT', by: 'nemori-ai' }, converter: CONVERTER, ...credits }))
  write(join(dir, 'package', 'draw', 'dream.js'), TEMPLATE.replace('/*SCENE*/ {}', JSON.stringify(scene, null, 2)))
  write(join(dir, 'README.md'), readme(scene, shown))
  write(join(dir, 'NOTICE.md'), notice)
  copyFileSync(join(ROOT, 'LICENSE'), join(dir, 'LICENSE'))
  if (artworkLicence !== undefined) write(join(dir, 'LICENSE-ARTWORK'), artworkLicence)
  const { faults } = await checkSkin(join(dir, 'package'), contract)
  const where = dir.startsWith(ROOT) ? dir.slice(ROOT.length + 1) : dir
  if (faults.length > 0) fail(`${where} does not pass the host's checks:\n  ${faults.join('\n  ')}`)
  console.log(`${where}: ok — ${members.length} members, background ${shown.width}×${shown.height} ${(shown.bytes / 1024).toFixed(0)} KiB, ${scene.mode} art`)
}

const readmeOf = (title, lines) => (scene, shown) =>
  `# ${title}\n\n${lines.join('\n')}\n\n` +
  '| 位置 | 层 | 效果 |\n| --- | --- | --- |\n' +
  `| 整个应用 \`shell.app\` | \`shell.tokens\` | 主题十色映射成 \`--omne-*\` 令牌；画面为${scene.mode === 'dark' ? '暗' : '亮'}色而作，另一模式由强调色推导，写成 \`light-dark()\` |\n` +
  '| 侧栏 `shell.sidebar` | `shell.tokens` + `shell.part-style` | 侧栏是主题色的一条带，底部淡入一条主题画面（`art/sidebar.webp`）；选中的导航与会话行是强调色浅底加左侧色条；「新建会话」是强调色胶囊 |\n' +
  '| 对话头、输入区、发送钮、登录门 | `shell.part-style` | 强调色细线、半透明玻璃底、圆角 |\n' +
  '| Agent 的形象 `shell.piece figure`、随身入口 `session.companion.figure` | 画法 | 从主题画面焦点处裁出的圆形徽章（`art/figure.webp`），强调色描边，干活时轻轻起伏 |\n' +
  `| 对话页背景 \`session.backdrop\` | \`shell.part-render\` | 主题背景图（${shown.width}×${shown.height} WebP，焦点 ${scene.focusX} / ${scene.focusY}）；纱在阅读栏最浓，停靠的右侧栏垫底；空页右下角是主题口号 |\n\n` +
  '生成：`scripts/import-dream-skin.mjs`（映射 `scripts/lib/dream-palette.mjs`，画法模板 `templates/dream/draw/dream.js`）。不要手改生成的文件，改映射或模板后重新生成。\n\n' +
  '素材来源与许可见 [NOTICE.md](NOTICE.md)。\n'

/** --upstream: every theme sources/codex-dream-skin.json lists, from a checkout at its pinned commit. */
async function fromUpstream(checkout, width) {
  const licence = join(checkout, 'LICENSE')
  if (!existsSync(licence)) fail(`${checkout} is not a Codex Dream Skin checkout: it has no LICENSE`)
  for (const entry of registry.themes) {
    const at = join(checkout, entry.theme)
    for (const [file, expected] of Object.entries(entry.sha256)) {
      if (!existsSync(join(at, file))) fail(`${entry.theme}/${file} is missing: check out ${registry.commit}`)
      if (sha256(join(at, file)) !== expected) fail(`${entry.theme}/${file} is not the file at ${registry.commit.slice(0, 12)}`)
    }
    const theme = JSON.parse(readFileSync(join(at, 'theme.json'), 'utf8'))
    for (const field of entry.leaveOut ?? []) delete theme[field]
    const a = entry.artwork
    const source = `${registry.repository}/tree/${registry.commit}/${entry.theme}`
    await writeSkin({
      dir: join(ROOT, 'skins', entry.skin),
      name: entry.skin,
      theme,
      picture: join(at, basename(theme.image)),
      summary: entry.summary,
      width,
      artworkLicence: readFileSync(licence, 'utf8'),
      credits: {
        artwork: {
          licence: a.licence,
          files: 'art/',
          by: a.by,
          profile: a.profile,
          ...(a.via === undefined ? {} : { via: a.via }),
          derivedFrom: { repository: registry.repository, commit: registry.commit, path: `${entry.theme}/${theme.image}`, changes: 'scaled and re-encoded to WebP by scripts/import-dream-skin.mjs' },
          grant: a.grant,
          notice: registry.copyright,
        },
        theme: { from: source, licence: registry.licence, notice: registry.copyright },
        disclaimer: registry.disclaimer,
      },
      notice:
        `# ${entry.skin} · NOTICE\n\n## Code\n\n\`package/plugin.json\` and \`package/draw/\` are generated by \`scripts/import-dream-skin.mjs\` and covered by the MIT licence in \`LICENSE\` (the same as the repository root \`LICENSE\`).\n\n` +
        `## Theme and artwork\n\nThe palette, art settings and quote come from \`${entry.theme}/theme.json\`, and \`package/art/background.webp\` is \`${entry.theme}/${theme.image}\` scaled and re-encoded, both from\n[Codex Dream Skin](${registry.repository}) at commit \`${registry.commit}\` (${source}).\n\n` +
        `- **Artwork by**: [${a.by}](${a.profile})${a.via === undefined ? '' : `, contributed through ${a.via}`}\n- **Licence**: ${a.licence}. ${a.grant}\n` +
        `- **Upstream licence**: ${registry.licence}, ${registry.copyright}. Its full text is in \`LICENSE-ARTWORK\`; keep it with the artwork.\n\n` +
        `${registry.disclaimer}\n\nIssues with this skin belong in this repository, not with the upstream authors.\n`,
      readme: readmeOf(`${entry.skin} · ${theme.name}`, [entry.summary, '', `移植自 [Codex Dream Skin](${registry.repository}) 的主题 \`${entry.theme}\`（提交 \`${registry.commit.slice(0, 7)}\`）。`]),
    })
  }
  for (const left of registry.excluded) console.log(`not imported: ${left.theme} — ${left.why}`)
}

async function getJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } })
  if (!response.ok) fail(`${url} answered ${response.status}`)
  return response.json()
}

async function catalogue() {
  const all = []
  for (let offset = 0; ; offset += PAGE) {
    const page = await getJson(`${API}?limit=${PAGE}&offset=${offset}`)
    all.push(...page.items)
    if (page.items.length === 0 || all.length >= page.total) return all
  }
}

/** A community package or one on disk, unpacked and checked against its own manifest. */
function unpackTheme(where, packageFile) {
  let dir = where
  if (packageFile !== undefined) {
    dir = mkdtempSync(join(tmpdir(), 'dream-'))
    art('unpack', packageFile, dir)
  }
  const manifestPath = join(dir, 'manifest.json')
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : undefined
  for (const file of manifest?.files ?? []) {
    const path = join(dir, file.path)
    if (!existsSync(path) || sha256(path) !== file.sha256) fail(`${file.path} is not the file the package's manifest names`)
  }
  if (!existsSync(join(dir, 'theme.json'))) fail(`${where} holds no theme.json`)
  const theme = JSON.parse(readFileSync(join(dir, 'theme.json'), 'utf8'))
  const picture = join(dir, basename(String(theme.image ?? '')))
  if (typeof theme.image !== 'string' || !existsSync(picture)) fail(`${where}: theme.json names no image the package holds`)
  return { dir, manifest, theme, picture, temporary: packageFile !== undefined }
}

const openUse = open =>
  `The publisher declared ${open.spdx} (${open.url}). Its terms: ${open.attribution}${open.nonCommercial ? '; non-commercial use only' : ''}${open.shareAlike ? '; changed versions under the same licence' : ''}. The declaration is the publisher's and nobody here has checked the rights in the picture.`

const ownUse =
  'This skin was converted for your own use. Its artwork belongs to its publisher, under the licence they declared, which nobody here has checked. Do not commit it to this repository or share it unless that licence and the rights in the picture allow it.'

/** One community theme by its version id: metadata, package (checked against both hashes), skin. */
async function fromCommunity(version, options) {
  const meta = await getJson(`${API}/${version}`)
  if (meta.id !== version) fail(`the API answered for ${meta.id}, not ${version}`)
  if (options.expect !== undefined && licenceOf(meta.license).spdx !== options.expect.licence)
    fail(`its licence is now ${meta.license}, not the ${options.expect.licence} it was indexed under: npm run dream -- --sync-catalogue`)
  if (meta.applyCompatible !== true) fail(`${version} (${meta.name}) is in DreamSkin's old package format, which the site only previews`)
  const response = await fetch(`${API}/${version}/download`)
  if (!response.ok) fail(`the download of ${version} answered ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length !== meta.packageBytes || createHash('sha256').update(bytes).digest('hex') !== meta.packageSha256)
    fail(`the package of ${version} is not the one its metadata names`)
  const zip = join(mkdtempSync(join(tmpdir(), 'dream-zip-')), 'package.zip')
  writeFileSync(zip, bytes)
  const unpacked = unpackTheme(version, zip)
  let name = options.name ?? skinName(meta.slug, meta.id)
  // A name another theme of this batch took, or a converted skin of another theme holds, goes to this one's id.
  const holder = join(options.out, name, 'package', 'credits.json')
  const heldBy = existsSync(holder) ? JSON.parse(readFileSync(holder, 'utf8')).artwork?.derivedFrom?.version : undefined
  if (options.name === undefined && (options.avoid?.has(name) || (heldBy !== undefined && heldBy !== meta.id))) name = skinName(meta.id, meta.id)
  const open = licenceOf(meta.license)
  const page = `https://dreamskin.cc/gallery`
  try {
    await writeSkin({
      dir: join(options.out, name),
      name,
      theme: unpacked.theme,
      picture: unpacked.picture,
      width: options.width,
      summary: `${meta.name}（DreamSkin 社区主题，作者 ${meta.authorDisplayName}，许可 ${meta.license}）`.slice(0, 200),
      credits: {
        artwork: {
          licence: meta.license,
          ...(open.spdx === undefined ? {} : { spdx: open.spdx, licenceUrl: open.url, terms: open.attribution, nonCommercial: open.nonCommercial, shareAlike: open.shareAlike }),
          declaredBy: 'the publisher, on DreamSkin; not checked',
          files: 'art/',
          by: meta.authorDisplayName,
          ...(unpacked.manifest?.provenance === undefined ? {} : { provenance: unpacked.manifest.provenance }),
          derivedFrom: { catalogue: page, version: meta.id, package: `${API}/${meta.id}/download`, sha256: meta.packageSha256, changes: 'scaled and re-encoded to WebP; theme.css is not used' },
        },
        use: ownUse,
      },
      notice:
        `# ${name} · NOTICE\n\n${open.spdx === undefined ? ownUse : openUse(open)}\n\n- **Theme**: ${meta.name} (${meta.themeId} ${meta.version}, ${meta.id})\n- **Publisher**: ${meta.authorDisplayName}\n- **Declared licence**: ${meta.license}\n` +
        `- **AI generated**: ${unpacked.manifest?.provenance?.aiGenerated ?? 'not stated'}\n- **Package**: ${API}/${meta.id}/download (sha256 ${meta.packageSha256})\n\n` +
        `DreamSkin hosts community themes without claiming their copyright and takes down a version found to infringe; a version taken down there should be removed here too.\n\n${registry.disclaimer}\n`,
      readme: readmeOf(`${name} · ${meta.name}`, [`DreamSkin 社区主题「${meta.name}」，作者 ${meta.authorDisplayName}，声明的许可：${meta.license}。仅供自用。`]),
    })
    return { skin: name, id: meta.id, name: meta.name, author: meta.authorDisplayName, licence: meta.license, package: join(options.out, name, 'package') }
  } finally {
    rmSync(unpacked.dir, { recursive: true, force: true })
    rmSync(join(zip, '..'), { recursive: true, force: true })
  }
}

async function fromDisk(path, options) {
  const zipped = statSync(path).isFile()
  const unpacked = unpackTheme(path, zipped ? path : undefined)
  const name = options.name ?? skinName(unpacked.theme.id, basename(path))
  const licence = unpacked.manifest?.license ?? 'unknown: supplied by you'
  try {
    await writeSkin({
      dir: join(options.out, name),
      name,
      theme: unpacked.theme,
      picture: unpacked.picture,
      width: options.width,
      summary: `${unpacked.theme.name ?? name}（Codex Dream Skin 主题，本地转换，仅供自用）`,
      credits: { artwork: { licence, declaredBy: 'the package, not checked', files: 'art/', derivedFrom: { path: resolve(path) } }, use: ownUse },
      notice: `# ${name} · NOTICE\n\n${ownUse}\n\n- **From**: ${resolve(path)}\n- **Declared licence**: ${licence}\n`,
      readme: readmeOf(`${name} · ${unpacked.theme.name ?? name}`, ['本地转换的 Codex Dream Skin 主题，仅供自用。']),
    })
    return { skin: name, id: null, name: unpacked.theme.name ?? name, author: null, licence, package: join(options.out, name, 'package') }
  } finally {
    if (unpacked.temporary) rmSync(unpacked.dir, { recursive: true, force: true })
  }
}

/** --find: the themes that meet the wishes (words, light/dark, colour families, licence), most downloaded first. */
async function findThemes(args) {
  const wishes = wishesOf(args)
  const { total, shown } = find(await catalogue(), wishes)
  for (const item of shown) console.log(lineOf(item))
  console.log(`${total} found${total > shown.length ? `, ${shown.length} shown (--limit <n> for more)` : ''}. Look at them: npm run dream -- --sheet <ver_…> …; convert: npm run dream -- <ver_…> …`)
}

const SHEET_MAX = 24

/** --sheet: the pictures of the themes named, downloaded once into .cache/previews/, as one numbered contact sheet. */
async function sheetOf(ids) {
  if (ids.length === 0 || ids.length > SHEET_MAX) fail(`--sheet takes 1 to ${SHEET_MAX} version ids`)
  const cache = join(ROOT, '.cache', 'previews')
  mkdirSync(cache, { recursive: true })
  for (const id of ids) if (!/^ver_[a-z0-9]{8,64}$/u.test(id)) fail(`${id} is not a DreamSkin version id (ver_…)`)
  const one = async id => {
    const path = join(cache, `${id}.img`)
    const preview = await getJson(`${API}/${id}/preview`)
    if (!existsSync(path)) {
      const response = await fetch(preview.background?.url ?? `${API}/${id}/preview/background`)
      if (!response.ok) fail(`the preview of ${id} answered ${response.status}`)
      writeFileSync(path, Buffer.from(await response.arrayBuffer()))
    }
    return { path, name: preview.theme?.name ?? '' }
  }
  // Eight at a time: the previews are whole pictures, and one after another a sheet takes minutes.
  const got = []
  for (let at = 0; at < ids.length; at += 8) got.push(...(await Promise.all(ids.slice(at, at + 8).map(one))))
  const pictures = got.map(g => g.path)
  const names = got.map(g => g.name)
  const out = join(ROOT, 'local-skins', 'sheet.jpg')
  const made = art('sheet', out, ...pictures)
  ids.forEach((id, i) => console.log(`${String(i + 1).padStart(2)}  ${id}  ${names[i]}`))
  for (const { index, why } of made.unread) console.log(`  tile ${index} is empty: ${why}`)
  console.log(`sheet: ${out}`)
}

/** Several themes at once: each is converted or reported, and local-skins/batch.json lists what to publish. */
async function convertBatch(targets, options) {
  if (options.name !== undefined) fail('--name names one skin; give it with one theme only')
  const done = []
  const failed = []
  const avoid = new Set()
  for (const target of targets) {
    const version = /(ver_[a-z0-9]{8,64})/u.exec(target)?.[1]
    try {
      let made
      if (existsSync(target)) made = await fromDisk(target, options)
      else if (version !== undefined) made = await fromCommunity(version, { ...options, avoid })
      else fail(`${target} is neither a path nor a DreamSkin version (ver_…)`)
      avoid.add(made.skin)
      done.push(made)
    } catch (error) {
      if (!(error instanceof Refused)) throw error
      failed.push({ target, why: error.message })
      console.log(`  ✗ ${target}: ${error.message}`)
    }
  }
  const list = join(options.out, 'batch.json')
  write(list, json({ $comment: 'Written by npm run dream for the last batch: publish each package with OmneExtensions (category skin).', skins: done, failed }))
  console.log(`${targets.length} themes: ${done.length} converted, ${failed.length} not. To publish: ${list}`)
  if (failed.length > 0) process.exitCode = 1
}

/** Every community theme's palette through the mapping and the host's rules, without downloading a picture. */
async function checkCatalogue() {
  const all = await catalogue()
  const faulty = []
  for (const t of all) {
    const theme = { name: t.name, appearance: t.displayMeta?.appearance, colors: t.displayMeta?.colors, art: t.displayMeta?.art }
    try {
      const members = membersOf(theme)
      const manifest = { schema: 1, name: skinName(t.slug, t.id), summary: t.name, kind: 'skin', client: { members } }
      const faults = [...manifestFaults(manifest).faults]
      for (const m of members) if (m.data !== undefined) faults.push(...[dataFault(m.point, m.key, m.data, contract)].flat().filter(Boolean))
      if (faults.length > 0) faulty.push(`${t.id} ${t.name}: ${faults.join('; ')}`)
    } catch (error) {
      faulty.push(`${t.id} ${t.name}: ${error.message}`)
    }
  }
  for (const line of faulty) console.log(`  ✗ ${line}`)
  const old = all.filter(t => !t.applyCompatible).length
  console.log(`${all.length} community themes: ${all.length - faulty.length} map to skins that pass the host's rules, ${faulty.length} do not; ${old} are in the old package format and cannot be downloaded as packages.`)
  if (faulty.length > 0) process.exitCode = 1
}

/** --sync-catalogue: the index of every community theme this repository may take, by its licence. No picture. */
async function syncCatalogue() {
  const all = await catalogue()
  const left = {}
  const themes = []
  for (const t of all) {
    const open = licenceOf(t.license)
    const why = !t.applyCompatible ? 'is in the old package format, which the site only previews' : open.refused
    if (why !== undefined) {
      left[why] = (left[why] ?? 0) + 1
      continue
    }
    themes.push({
      id: t.id,
      skin: skinName(t.slug, t.id),
      name: t.name,
      author: t.authorDisplayName,
      licence: open.spdx,
      declared: t.license,
      appearance: t.displayMeta?.appearance ?? null,
      version: t.version,
      packageSha256: t.packageSha256,
      packageBytes: t.packageBytes,
    })
  }
  // Two themes may want one skin name: the later id gets its id as the name, so every skin name is its own.
  const seen = new Set()
  for (const t of themes.sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (seen.has(t.skin)) t.skin = skinName(t.id, t.id)
    seen.add(t.skin)
  }
  const index = {
    $comment:
      'Generated by npm run dream -- --sync-catalogue. Every DreamSkin community theme whose declared licence reads as an open licence that allows redistribution and changes (scripts/lib/licences.mjs). Metadata only: the pictures stay on DreamSkin and are downloaded, checked against packageSha256 and converted by npm run dream -- --all or -- <id>. A licence is what its publisher declared; nobody here has checked the rights in the picture.',
    api: API,
    total: all.length,
    taken: themes.length,
    left: Object.fromEntries(Object.entries(left).sort((a, b) => b[1] - a[1])),
    themes,
  }
  writeFileSync(INDEX, json(index))
  const by = themes.reduce((count, t) => ({ ...count, [t.licence]: (count[t.licence] ?? 0) + 1 }), {})
  console.log(`sources/dreamskin-community.json: ${themes.length} of ${all.length} themes taken (${Object.entries(by).map(([k, v]) => `${v} ${k}`).join(', ')})`)
  for (const [why, count] of Object.entries(index.left)) console.log(`  left out ${count}: ${why}`)
}

/** --all: every theme of the index into the output directory; one that fails is reported and the rest go on. */
async function convertAll(options, only) {
  if (!existsSync(INDEX)) fail('there is no sources/dreamskin-community.json yet: npm run dream -- --sync-catalogue')
  const { themes } = JSON.parse(readFileSync(INDEX, 'utf8'))
  const chosen = themes.filter(t => only === undefined || t.licence === only)
  const failed = []
  let kept = 0
  for (const t of chosen) {
    const credits = join(options.out, t.skin, 'package', 'credits.json')
    const held = existsSync(credits) ? JSON.parse(readFileSync(credits, 'utf8')) : undefined
    if (held?.artwork?.derivedFrom?.sha256 === t.packageSha256 && held?.converter?.revision === REVISION) {
      kept += 1
      continue
    }
    try {
      await fromCommunity(t.id, { ...options, name: t.skin, expect: t })
    } catch (error) {
      if (!(error instanceof Refused)) throw error
      failed.push(`${t.id} ${t.name}: ${error.message}`)
      console.log(`  ✗ ${t.id} ${t.name}: ${error.message}`)
    }
  }
  console.log(`${chosen.length} themes: ${chosen.length - kept - failed.length} converted, ${kept} already there, ${failed.length} not converted.`)
  if (failed.length > 0) process.exitCode = 1
}

const args = process.argv.slice(2)
const take = flag => {
  const at = args.indexOf(flag)
  if (at < 0) return undefined
  const [, value] = args.splice(at, 2)
  if (value === undefined) fail(`${flag} needs a value`)
  return value
}
const options = {
  name: take('--name'),
  out: resolve(take('--out') ?? join(ROOT, 'local-skins')),
  width: Number(take('--width') ?? 2048),
}
if (options.name !== undefined && !/^[a-z][a-z0-9-]{0,63}$/u.test(options.name)) fail('--name: lower-case letters, digits and hyphens, starting with a letter')
const upstream = take('--upstream')
const only = take('--licence')
try {
  if (upstream !== undefined) await fromUpstream(resolve(upstream), options.width)
  else if (args[0] === '--find' || args[0] === '--search') await findThemes(args.slice(1))
  else if (args[0] === '--sheet') await sheetOf(args.slice(1))
  else if (args[0] === '--check-catalogue') await checkCatalogue()
  else if (args[0] === '--sync-catalogue') await syncCatalogue()
  else if (args[0] === '--all') await convertAll(options, only)
  else if (args.length === 1) {
    const version = /(ver_[a-z0-9]{8,64})/u.exec(args[0])?.[1]
    if (existsSync(args[0])) await fromDisk(args[0], options)
    else if (version !== undefined) await fromCommunity(version, options)
    else fail(`${args[0]} is neither a path nor a DreamSkin version (ver_…)`)
  } else if (args.length > 1 && !args[0].startsWith('--')) await convertBatch(args, options)
  else fail('usage: see the head of scripts/import-dream-skin.mjs')
} catch (error) {
  if (!(error instanceof Refused)) throw error
  console.error(`dream: ${error.message}`)
  process.exitCode = 1
}
