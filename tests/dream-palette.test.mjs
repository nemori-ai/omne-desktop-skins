// The Codex Dream Skin mapping: colours read, modes chosen, the derived mode readable, every member one the host takes.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { contrast, membersOf, modeOf, palettesOf, parseColour, sceneOf, skinName } from '../scripts/lib/dream-palette.mjs'
import { dataFault, manifestFaults } from '../scripts/lib/rules.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const contract = JSON.parse(readFileSync(join(ROOT, 'contract', 'omne-contract.json'), 'utf8'))

// The palettes of the two upstream themes this repository ships, and the shapes the community catalogue uses.
const GOTHIC = {
  appearance: 'dark',
  colors: { background: '#0d0d0e', panel: '#171513', panelAlt: '#211d18', accent: '#c8a55a', accentAlt: '#e3c27a', secondary: '#74352e', highlight: '#8a2f27', text: '#f3ead7', muted: '#b5a386', line: 'rgba(200, 165, 90, .28)' },
  art: { focusX: 0.76, focusY: 0.45, safeArea: 'left' },
  quote: 'MAKE SOMETHING WONDERFUL',
}
const RED_WHITE = {
  colors: { background: '#F7F4F5', panel: '#FFFFFF', panelAlt: '#FFF7F8', accent: '#E25563', accentAlt: '#F07A86', secondary: '#F3A8AF', highlight: '#C93D4C', text: '#2B2224', muted: '#8A7A7D', line: 'rgba(196,120,128,0.22)' },
}
const NO_COLOURS = { appearance: 'auto', name: 'only a picture' }

describe('dream palette', () => {
  it('reads the colour forms the catalogue uses', () => {
    assert.deepEqual(parseColour('#abc'), { r: 170, g: 187, b: 204, a: 1 })
    assert.deepEqual(parseColour('rgba(200, 165, 90, .28)'), { r: 200, g: 165, b: 90, a: 0.28 })
    assert.deepEqual(parseColour('rgba(1,2,3,1)'), { r: 1, g: 2, b: 3, a: 1 })
    assert.throws(() => parseColour('tomato'))
  })
  it('takes the mode the picture is made for, else the one its background says', () => {
    assert.equal(modeOf(GOTHIC), 'dark')
    assert.equal(modeOf(RED_WHITE), 'light')
    assert.equal(modeOf({ appearance: 'auto', colors: { background: '#101418' } }), 'dark')
    assert.equal(modeOf(NO_COLOURS), 'light')
  })
  it('keeps the derived accent readable on the derived panel', () => {
    for (const theme of [GOTHIC, RED_WHITE, NO_COLOURS]) {
      const { mode, light, dark } = palettesOf(theme, '#ffe066')
      const derived = mode === 'dark' ? light : dark
      assert.ok(contrast(derived.accent, derived.panel) >= 4.5, JSON.stringify(theme.colors))
    }
  })
  it('makes only members the host takes, for every kind of theme', () => {
    for (const theme of [GOTHIC, RED_WHITE, NO_COLOURS]) {
      const members = membersOf(theme)
      assert.deepEqual(manifestFaults({ schema: 1, name: 'dream-x', summary: 'x', kind: 'skin', client: { members } }).faults, [])
      for (const m of members) if (m.data !== undefined) assert.equal(dataFault(m.point, m.key, m.data, contract), null, `${m.point} ${m.key}`)
    }
  })
  it('covers every place deepseek-skin, the most complete skin, changes', () => {
    const deepseek = JSON.parse(readFileSync(join(ROOT, 'skins', 'deepseek-skin', 'package', 'plugin.json'), 'utf8')).client.members
    const placed = new Set(membersOf(GOTHIC).map(m => `${m.point} ${m.key}`))
    // deepseek-skin clears the selected tokens of the nav and the list under its ribbon art; dream styles the rows.
    const ribbonOnly = new Set(['shell.tokens shell.sidebar.nav', 'shell.tokens session.list'])
    for (const m of deepseek) {
      const place = `${m.point} ${m.key}`
      if (!ribbonOnly.has(place)) assert.ok(placed.has(place), place)
    }
    const app = new Set(Object.keys(deepseek.find(m => m.key === 'shell.app').data))
    for (const name of app) assert.ok(name in membersOf(GOTHIC)[0].data, name)
  })
  it('picks the ink that reads best on an accent fill', () => {
    const tokens = membersOf(GOTHIC)[0].data
    assert.equal(tokens['--omne-accent-ink'], 'light-dark(#ffffff, #0d0d0e)')
  })
  it('hands the drawing a scene with the focus and the grounds of both modes', () => {
    const scene = sceneOf(GOTHIC, 'art/background.webp')
    assert.equal(scene.mode, 'dark')
    assert.equal(scene.focusX, 0.76)
    assert.match(scene.ground.light, /^#[0-9a-f]{6}$/u)
    assert.equal(sceneOf({ art: { focusX: 7 } }, 'a.webp').focusX, 0.5)
  })
  it('names a skin dream-<slug> in the letters the host allows', () => {
    assert.equal(skinName('Erebor Ever-Rising!', 'ver_1'), 'dream-erebor-ever-rising')
    assert.equal(skinName('宅', 'ver_33a59fbe'), 'dream-ver-33a59fbe')
    assert.ok(skinName('x'.repeat(90), 'v').length <= 64)
  })
})
