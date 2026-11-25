#!/usr/bin/env node
// Fetches the artwork of every skin from its pinned upstream and derives package/art/ from it. The repository keeps no
// artwork: package/art/ is ignored by git, and this is how a checkout gets it.
//
//   npm run art              every skin
//   npm run art -- <skin>    the skins named
//
// Upstream checkouts are kept under .cache/upstream/ (ignored by git) and reused. Needs git, Python 3 and Pillow.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const CACHE = join(ROOT, '.cache', 'upstream')
const dream = JSON.parse(readFileSync(join(ROOT, 'sources', 'codex-dream-skin.json'), 'utf8'))

/** Where each skin's art comes from, and how it is derived. `paths` limits the checkout to what the build reads. */
const UPSTREAMS = [
  {
    name: 'dsh-deep-whale',
    repository: 'https://github.com/Small-tailqwq/dsh-deep-whale',
    commit: 'a9e2884388122be47a7c737c18b98ac4896d7c27',
    paths: ['maid-atelier'],
    skins: ['deepseek-skin'],
    build: dir => ['python3', [join(ROOT, 'skins', 'deepseek-skin', 'tools', 'build_art.py'), '--upstream', dir]],
  },
  {
    name: 'codex-dream-skin',
    repository: dream.repository,
    commit: dream.commit,
    paths: ['LICENSE', ...dream.themes.map(t => t.theme)],
    skins: dream.themes.map(t => t.skin),
    build: dir => [process.execPath, [join(ROOT, 'scripts', 'import-dream-skin.mjs'), '--upstream', dir]],
  },
]

function run(command, args, cwd) {
  const ran = spawnSync(command, args, { cwd, stdio: 'inherit' })
  if (ran.error !== undefined) throw new Error(`${command} could not be run: ${ran.error.message}`)
  if (ran.status !== 0) throw new Error(`${command} ${args.join(' ')} exited ${ran.status}`)
}

/** A checkout of one commit with only the paths named, made once and reused. */
function checkout({ name, repository, commit, paths }) {
  const dir = join(CACHE, `${name}-${commit.slice(0, 12)}`)
  if (existsSync(join(dir, '.done'))) return dir
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  run('git', ['init', '-q'], dir)
  run('git', ['sparse-checkout', 'set', '--no-cone', ...paths.map(path => `/${path}`)], dir)
  run('git', ['fetch', '-q', '--depth', '1', '--filter=blob:none', repository, commit], dir)
  run('git', ['-c', 'advice.detachedHead=false', 'checkout', '-q', 'FETCH_HEAD'], dir)
  spawnSync('touch', [join(dir, '.done')])
  return dir
}

const named = process.argv.slice(2)
let failed = 0
for (const upstream of UPSTREAMS) {
  if (named.length > 0 && !upstream.skins.some(skin => named.includes(skin))) continue
  try {
    const dir = checkout(upstream)
    const [command, args] = upstream.build(dir)
    run(command, args, ROOT)
  } catch (error) {
    failed += 1
    console.error(`art: ${upstream.skins.join(', ')}: ${error.message}`)
  }
}
process.exitCode = failed === 0 ? 0 : 1
