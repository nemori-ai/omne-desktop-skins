#!/usr/bin/env node
// Checks every skin under skins/ (or the ones named) against the rules of the OMNE host and the contract snapshot.
//
//   npm run validate                 every skin
//   npm run validate -- deepseek-skin  one skin

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkSkin } from './lib/check-skin.mjs'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
export const SKINS = join(ROOT, 'skins')
const contract = JSON.parse(readFileSync(join(ROOT, 'contract', 'omne-contract.json'), 'utf8'))

const named = process.argv.slice(2).filter(arg => !arg.startsWith('-'))
const skins = named.length > 0 ? named : readdirSync(SKINS).filter(name => existsSync(join(SKINS, name, 'package')))

const kib = bytes => `${(bytes / 1024).toFixed(0)} KiB`
let failed = 0
console.log(`contract: omne-harness-lite ${contract.source.commit.slice(0, 12)} (${contract.source.committed})`)
for (const skin of skins) {
  const dir = join(SKINS, skin, 'package')
  const { faults, notes, bytes, members } = await checkSkin(dir, contract)
  const manifest = existsSync(join(dir, 'plugin.json')) ? JSON.parse(readFileSync(join(dir, 'plugin.json'), 'utf8')) : {}
  if (manifest.name !== undefined && manifest.name !== skin)
    faults.push(`plugin.json names the skin ${manifest.name}; the directory is skins/${skin}: keep them the same`)
  const state = faults.length === 0 ? 'ok' : 'FAILED'
  console.log(`\n${skin}: ${state} — ${members} members, ${kib(bytes)}`)
  for (const fault of faults) console.log(`  ✗ ${fault}`)
  if (faults.length > 0 && !existsSync(join(dir, 'art'))) console.log('  · package/art/ is not fetched: run npm run art first')
  for (const note of notes) console.log(`  · ${note}`)
  if (faults.length > 0) failed += 1
}
if (skins.length === 0) console.log('no skins found under skins/')
process.exitCode = failed === 0 ? 0 : 1
