#!/usr/bin/env node
// Starts a new skin under skins/<name> from templates/skin.
//
//   npm run new -- ocean-skin "One sentence on how it looks."

import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const NAME = /^[a-z][a-z0-9-]{0,63}$/u
const [name, summary = 'One sentence on how it looks.'] = process.argv.slice(2)

if (name === undefined || !NAME.test(name)) {
  console.error('usage: npm run new -- <name> [summary]\n  name: lower-case letters, digits and hyphens, starting with a letter')
  process.exit(2)
}
const target = join(ROOT, 'skins', name)
if (existsSync(target)) {
  console.error(`skins/${name} is there already`)
  process.exit(1)
}

cpSync(join(ROOT, 'templates', 'skin'), target, { recursive: true })
const fill = dir => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) fill(path)
    else writeFileSync(path, readFileSync(path, 'utf8').replaceAll('__NAME__', name).replaceAll('__SUMMARY__', summary.replaceAll('"', '\\"')))
  }
}
fill(target)
console.log(`made skins/${name}. Next: edit skins/${name}/package/plugin.json, then npm run validate -- ${name}`)
