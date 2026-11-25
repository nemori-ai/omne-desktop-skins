// The licences a DreamSkin community theme may be taken under, read from what its publisher typed.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { licenceOf } from '../scripts/lib/licences.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

describe('licences', () => {
  it('reads the open licences in the forms publishers type them', () => {
    for (const [typed, spdx] of [
      ['MIT', 'MIT'], ['mit', 'MIT'], ['MiT', 'MIT'], ['MIT BY SuperKaka', 'MIT'],
      ['CC BY 4.0', 'CC-BY-4.0'], ['cc by 4.0', 'CC-BY-4.0'], ['CCBY4.0', 'CC-BY-4.0'], ['CC-BY-4.0', 'CC-BY-4.0'],
      ['CC-BY-4.0 AND MIT', 'MIT AND CC-BY-4.0'], ['MIT AND CC-BY-4.0', 'MIT AND CC-BY-4.0'],
      ['CC BY-NC 4.0', 'CC-BY-NC-4.0'], ['CC-BY-NC-4.0', 'CC-BY-NC-4.0'], ['CC BY-NC-SA 4.0', 'CC-BY-NC-SA-4.0'],
    ])
      assert.equal(licenceOf(typed).spdx, spdx, typed)
  })
  it('carries the terms that follow', () => {
    assert.equal(licenceOf('CC BY-NC-SA 4.0').nonCommercial, true)
    assert.equal(licenceOf('CC BY-NC-SA 4.0').shareAlike, true)
    assert.equal(licenceOf('MIT').nonCommercial, false)
  })
  it('leaves out what does not license redistribution, or cannot be read as a licence', () => {
    for (const typed of ['All Rights Reserved', 'Personal Use Only', 'LicenseRef-Personal-Use', 'UNLICENSED', 'Proprietary',
      'LicenseRef-Fan-Art-Noncommercial', 'Pixabay License', 'CC BY-NC-ND 4.0', 'cc', 'GPL', '1.0', 'DGON', 'MIT0d000722',
      'LicenseRef-LocalTheme-MIT-Code-UserProvided-Artwork', 'All rights reserved by Hypergryph', ''])
      assert.equal(typeof licenceOf(typed).refused, 'string', typed)
  })
  it('indexes only themes under a licence it reads, each with a skin name of its own', () => {
    const index = JSON.parse(readFileSync(join(ROOT, 'sources', 'dreamskin-community.json'), 'utf8'))
    for (const theme of index.themes) assert.equal(licenceOf(theme.declared).spdx, theme.licence, theme.id)
    assert.equal(new Set(index.themes.map(t => t.skin)).size, index.themes.length)
    assert.ok(index.themes.every(t => /^[a-z][a-z0-9-]{0,63}$/u.test(t.skin) && /^[a-f0-9]{64}$/u.test(t.packageSha256)))
  })
})
