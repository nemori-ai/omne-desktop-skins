// Finding community themes by what a person asks for: words, light or dark, colour families, licence.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { facetsOf, familyOf, find, lineOf, wishesOf } from '../scripts/lib/catalogue.mjs'

const theme = (id, name, background, accent, extra = {}) => ({
  id,
  name,
  authorDisplayName: 'someone',
  slug: name.toLowerCase(),
  license: 'MIT',
  applyCompatible: true,
  downloadCount: 1,
  displayMeta: { appearance: 'auto', colors: { background, accent } },
  ...extra,
})

const CATALOGUE = [
  theme('ver_aaaaaaaa', 'Ocean', '#0b1630', '#3a7bff', { downloadCount: 50 }),
  theme('ver_bbbbbbbb', '樱花', '#fff5f8', '#e8609a', { downloadCount: 90 }),
  theme('ver_cccccccc', 'Forest', '#f4f7f0', '#2e9a4b', { license: 'All Rights Reserved' }),
  theme('ver_dddddddd', 'Old', '#000000', '#ff0000', { applyCompatible: false }),
  theme('ver_eeeeeeee', 'Ink', '#121212', '#9a9a9a', { downloadCount: 5 }),
]

describe('catalogue', () => {
  it('puts a colour in the family its hue says, and grey ones in neutral', () => {
    for (const [colour, family] of [['#e25563', 'red'], ['#ff9a2e', 'orange'], ['#c8a55a', 'yellow'], ['#2e9a4b', 'green'],
      ['#20b2aa', 'cyan'], ['#3a7bff', 'blue'], ['#8a4bd6', 'purple'], ['#e8609a', 'pink'], ['#9a9a9a', 'neutral'], ['#101010', 'neutral']])
      assert.equal(familyOf(colour), family, colour)
    assert.equal(familyOf('not a colour'), null)
  })
  it('reads a ground from the background colour before the appearance word', () => {
    assert.equal(facetsOf(CATALOGUE[0]).ground, 'dark')
    assert.equal(facetsOf(CATALOGUE[1]).ground, 'light')
    assert.equal(facetsOf({ displayMeta: { appearance: 'dark' } }).ground, 'dark')
  })
  it('reads wishes in English and Chinese, flags or words', () => {
    const w = wishesOf(['暗', 'blue', '--colour', '粉,green', 'ocean', '--open', '--limit', '5'])
    assert.deepEqual([...w.grounds], ['dark'])
    assert.deepEqual([...w.families].sort(), ['blue', 'green', 'pink'])
    assert.deepEqual(w.words, ['ocean'])
    assert.equal(w.open, true)
    assert.equal(w.limit, 5)
    assert.throws(() => wishesOf(['--colour', 'plaid']))
    assert.throws(() => wishesOf(['--limit', '0']))
  })
  it('keeps what meets every wish, most downloaded first, and never a theme that cannot be converted', () => {
    const ids = wishes => find(CATALOGUE, wishesOf(wishes)).shown.map(t => t.id)
    assert.deepEqual(ids([]), ['ver_bbbbbbbb', 'ver_aaaaaaaa', 'ver_eeeeeeee', 'ver_cccccccc'])
    assert.deepEqual(ids(['dark']), ['ver_aaaaaaaa', 'ver_eeeeeeee'])
    assert.deepEqual(ids(['dark', 'blue']), ['ver_aaaaaaaa'])
    assert.deepEqual(ids(['樱花', 'forest']), ['ver_bbbbbbbb', 'ver_cccccccc'])
    assert.deepEqual(ids(['green', '--open']), [])
    assert.deepEqual(ids(['--limit', '1']), ['ver_bbbbbbbb'])
    assert.equal(find(CATALOGUE, wishesOf(['--limit', '1'])).total, 4)
  })
  it('writes one line per theme with what the choice turns on', () => {
    const line = lineOf(CATALOGUE[2])
    assert.match(line, /^ver_cccccccc {2}light {2}green/u)
    assert.match(line, /own-use:All Rights/u)
  })
})
