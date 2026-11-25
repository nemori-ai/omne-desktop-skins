// The mapping from a Codex Dream Skin theme (theme.json: ten colours, an appearance, where the art's subject sits) to
// the members of an OMNE skin. One mapping serves every theme, so a new theme is a line in sources/, not a new skin
// written by hand.
//
// A Dream theme carries one palette, for the mode its picture is made for. OMNE lets the person choose light or dark,
// so the other mode is derived here from the same accent, and every colour is written as light-dark(light, dark).

export const DREAM_KEYS = ['background', 'panel', 'panelAlt', 'accent', 'accentAlt', 'secondary', 'highlight', 'text', 'muted', 'line']

const clamp = (value, low, high) => Math.min(high, Math.max(low, value))

/** #rgb, #rrggbb, #rrggbbaa, rgb()/rgba() with commas or spaces: { r, g, b, a } in 0..255 and 0..1, or throws. */
export function parseColour(text) {
  const words = String(text).trim().toLowerCase()
  const hex = /^#([0-9a-f]{3,8})$/u.exec(words)
  if (hex !== null && [3, 6, 8].includes(hex[1].length)) {
    const digits = hex[1].length === 3 ? [...hex[1]].map(d => d + d).join('') : hex[1]
    const at = i => Number.parseInt(digits.slice(i, i + 2), 16)
    return { r: at(0), g: at(2), b: at(4), a: digits.length === 8 ? at(6) / 255 : 1 }
  }
  const call = /^rgba?\(([^)]*)\)$/u.exec(words)
  if (call !== null) {
    const parts = call[1].split(/[\s,/]+/u).filter(Boolean)
    if (parts.length === 3 || parts.length === 4) {
      const channel = p => (p.endsWith('%') ? (Number.parseFloat(p) * 255) / 100 : Number.parseFloat(p))
      const alpha = p => (p === undefined ? 1 : p.endsWith('%') ? Number.parseFloat(p) / 100 : Number.parseFloat(p))
      const colour = { r: channel(parts[0]), g: channel(parts[1]), b: channel(parts[2]), a: alpha(parts[3]) }
      if (Object.values(colour).every(Number.isFinite)) return colour
    }
  }
  throw new Error(`not a colour this mapping reads: ${text}`)
}

const byte = value => clamp(Math.round(value), 0, 255)
export const hexOf = ({ r, g, b }) => `#${[r, g, b].map(v => byte(v).toString(16).padStart(2, '0')).join('')}`
/** The colour with an alpha, in the one form the host's value rules let through: rgb(r g b / n%). */
export const alphaOf = ({ r, g, b }, alpha) => `rgb(${byte(r)} ${byte(g)} ${byte(b)} / ${Math.round(clamp(alpha, 0, 1) * 100)}%)`

/** a moved toward b by t (0 keeps a, 1 gives b), in sRGB: enough for tints and shades of one palette. */
export const mix = (a, b, t) => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t, a: 1 })
/** A colour with an alpha laid on a ground, as the eye sees it. */
export const over = (colour, ground) => mix(ground, { ...colour, a: 1 }, colour.a)

const linear = v => {
  const s = v / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
export const luminance = ({ r, g, b }) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
export function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

const WHITE = { r: 255, g: 255, b: 255, a: 1 }
const BLACK = { r: 0, g: 0, b: 0, a: 1 }

/** colour moved toward white (on dark) or black (on light) until it reads against ground at the ratio asked. */
export function readable(colour, ground, ratio) {
  const toward = luminance(ground) < 0.2 ? WHITE : BLACK
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const tried = mix(colour, toward, t)
    if (contrast(tried, ground) >= ratio) return tried
  }
  return toward
}

/** The mode a theme's picture is made for: its own word for it, else what its background colour says. */
export function modeOf(theme) {
  if (theme.appearance === 'dark' || theme.appearance === 'light') return theme.appearance
  const ground = theme.colors?.background
  if (ground !== undefined) return luminance(parseColour(ground)) < 0.2 ? 'dark' : 'light'
  return 'light'
}

const DARK_BASE = { background: '#0e0e12', panel: '#16161b', panelAlt: '#1e1e25', text: '#f1eee9', muted: '#aba6ad' }
const LIGHT_BASE = { background: '#f8f7f6', panel: '#ffffff', panelAlt: '#f6f3f2', text: '#221e22', muted: '#696368' }

/** The palette of a mode the theme did not draw, from its accent and neutral grounds. */
export function derivePalette(given, mode) {
  const base = Object.fromEntries(Object.entries(mode === 'dark' ? DARK_BASE : LIGHT_BASE).map(([k, v]) => [k, parseColour(v)]))
  const accent = given.accent
  const background = mix(base.background, accent, mode === 'dark' ? 0.06 : 0.04)
  const panel = mix(base.panel, accent, mode === 'dark' ? 0.08 : 0.02)
  const panelAlt = mix(base.panelAlt, accent, mode === 'dark' ? 0.1 : 0.06)
  const shownAccent = readable(accent, panel, 4.5)
  return {
    background,
    panel,
    panelAlt,
    accent: shownAccent,
    accentAlt: readable(given.accentAlt, panel, 3),
    secondary: given.secondary,
    highlight: given.highlight,
    text: base.text,
    muted: mix(base.muted, accent, 0.12),
    line: { ...shownAccent, a: mode === 'dark' ? 0.28 : 0.24 },
  }
}

/** The palette a theme gives, every key read; keys it leaves out come from its accent. */
export function givenPalette(theme, fallbackAccent = '#6b7cff') {
  const colours = theme.colors ?? {}
  const mode = modeOf(theme)
  const accent = parseColour(colours.accent ?? fallbackAccent)
  const base = derivePalette({ accent, accentAlt: accent, secondary: accent, highlight: accent }, mode)
  const read = Object.fromEntries(DREAM_KEYS.map(key => [key, colours[key] === undefined ? base[key] : parseColour(colours[key])]))
  return read
}

/** Both modes: the theme's own palette in its mode, the derived one in the other. */
export function palettesOf(theme, fallbackAccent) {
  const mode = modeOf(theme)
  const own = givenPalette(theme, fallbackAccent)
  const other = derivePalette(own, mode === 'dark' ? 'light' : 'dark')
  return mode === 'dark' ? { mode, light: other, dark: own } : { mode, light: own, dark: other }
}

/** One mode's tokens, before they are paired: every value a colour string. */
function modeTokens(p) {
  const solid = c => (c.a !== undefined && c.a < 1 ? over(c, p.background) : c)
  const panel = solid(p.panel)
  const ground = solid(p.background)
  const text = solid(p.text)
  const muted = solid(p.muted)
  const accent = solid(p.accent)
  const dark = luminance(ground) < 0.2
  // The ink on an accent fill: whichever of white, the page ground and the body text reads best on it.
  const ink = [WHITE, ground, text].reduce((best, c) => (contrast(c, accent) > contrast(best, accent) ? c : best))
  const tint = mix(panel, accent, dark ? 0.2 : 0.14)
  return {
    '--omne-surface-page': hexOf(ground),
    '--omne-surface-panel': hexOf(panel),
    '--omne-surface-panel-soft': hexOf(solid(p.panelAlt)),
    '--omne-surface-overlay': hexOf(dark ? mix(panel, text, 0.04) : panel),
    '--omne-surface-field': hexOf(dark ? mix(panel, text, 0.05) : panel),
    '--omne-hover': hexOf(mix(panel, text, 0.07)),
    '--omne-press': hexOf(mix(panel, text, 0.12)),
    '--omne-selected': hexOf(mix(panel, accent, dark ? 0.24 : 0.18)),
    '--omne-accent': hexOf(accent),
    '--omne-accent-hover': hexOf(mix(accent, text, 0.14)),
    '--omne-accent-press': hexOf(mix(accent, text, 0.26)),
    '--omne-accent-tint': hexOf(tint),
    '--omne-accent-ink': hexOf(ink),
    '--omne-ink-primary': hexOf(text),
    '--omne-ink-muted': hexOf(muted),
    '--omne-ink-faint': hexOf(readable(mix(muted, ground, 0.3), ground, 3)),
    '--omne-line-subtle': hexOf(solid(p.line)),
    '--omne-line': hexOf(mix(ground, muted, 0.45)),
    '--omne-line-focus': hexOf(accent),
    '--omne-info-ink': hexOf(accent),
    '--omne-info-fill': hexOf(tint),
    '--omne-info-line': hexOf(accent),
    '--omne-bubble-user': hexOf(mix(panel, accent, dark ? 0.22 : 0.12)),
    '--omne-bubble-assistant': alphaOf(panel, 0.88),
    '--omne-bubble-ink': hexOf(text),
    '--omne-tooltip': hexOf(text),
    '--omne-tooltip-ink': hexOf(ground),
    '--omne-selection': alphaOf(accent, 0.3),
  }
}

const pair = (light, dark) => (light === dark ? light : `light-dark(${light}, ${dark})`)

/**
 * The sidebar's palette in one mode: the panel leans further into the accent than the page does, so the sidebar reads as
 * the theme's own band (as deepseek-skin's navy one does), in both modes, and every token under it follows.
 */
function sidePalette(p) {
  const panel = over(p.panel, p.background)
  const dark = luminance(panel) < 0.2
  const band = mix(panel, p.accent, dark ? 0.16 : 0.09)
  return { ...p, background: band, panel: band, panelAlt: mix(band, p.accent, dark ? 0.1 : 0.07) }
}

// The tokens the sidebar sets for its own subtree: its surfaces, inks, lines and the accent on its ground.
const SIDE_TOKENS = [
  '--omne-surface-panel', '--omne-surface-panel-soft', '--omne-surface-field', '--omne-surface-overlay',
  '--omne-ink-primary', '--omne-ink-muted', '--omne-ink-faint', '--omne-hover', '--omne-press', '--omne-selected',
  '--omne-line-subtle', '--omne-line', '--omne-line-focus', '--omne-accent', '--omne-accent-hover', '--omne-accent-press',
  '--omne-accent-tint', '--omne-accent-ink',
]

const pairTokens = (l, d, names = Object.keys(l)) => Object.fromEntries(names.map(name => [name, pair(l[name], d[name])]))

/**
 * The members of the skin for a theme. They cover what deepseek-skin covers, the most complete skin here: the app's
 * tokens, the sidebar as a band of the theme with the picture at its foot, the selected rows and the new-session
 * button, the glass of the header and composer, the login gate, the backdrop, and the figure of the agent (in the
 * sidebar's home and as the floating companion) as a medallion cut from the picture.
 */
export function membersOf(theme, { fallbackAccent, module = 'draw/dream.js', sidebarArt = 'art/sidebar.webp' } = {}) {
  const { light, dark } = palettesOf(theme, fallbackAccent)
  const tokens = pairTokens(modeTokens(light), modeTokens(dark))
  tokens['--omne-elevation-raised'] = `0 0 0 1px ${tokens['--omne-line-subtle']}, 0 8px 24px rgb(0 0 0 / 16%)`
  tokens['--omne-elevation-overlay'] = `0 0 0 1px ${tokens['--omne-line-subtle']}, 0 12px 32px rgb(0 0 0 / 24%)`
  tokens['--omne-radius-control'] = 'calc(var(--omne-size) * 10px)'
  tokens['--omne-radius-card'] = 'calc(var(--omne-size) * 12px)'
  tokens['--omne-radius-window'] = 'calc(var(--omne-size) * 18px)'

  const [sideLight, sideDark] = [sidePalette(light), sidePalette(dark)]
  const side = pairTokens(modeTokens(sideLight), modeTokens(sideDark), SIDE_TOKENS)
  const band = pair(hexOf(sideLight.panel), hexOf(sideDark.panel))
  const glass = alpha => pair(alphaOf(over(light.panel, light.background), alpha), alphaOf(over(dark.panel, dark.background), alpha))
  const edge = alpha => pair(alphaOf(light.accent, alpha), alphaOf(dark.accent, alpha))
  const selectedRow = {
    background: side['--omne-accent-tint'],
    'box-shadow': `inset 3px 0 0 ${side['--omne-accent']}`,
    color: side['--omne-ink-primary'],
  }
  return [
    { point: 'shell.tokens', key: 'shell.app', data: tokens },
    { point: 'shell.tokens', key: 'shell.sidebar', data: side },
    {
      point: 'shell.part-style',
      key: 'shell.sidebar',
      data: {
        base: {
          background: `file(${sidebarArt}) center bottom / 100% auto no-repeat, ${band}`,
          'box-shadow': `inset -1px 0 0 ${edge(0.4)}`,
          color: side['--omne-ink-primary'],
        },
      },
    },
    { point: 'shell.part-style', key: 'shell.sidebar.nav.row', data: { selected: selectedRow } },
    { point: 'shell.part-style', key: 'session.list.item', data: { selected: selectedRow } },
    {
      point: 'shell.part-style',
      key: 'session.list.new',
      data: {
        base: {
          background: side['--omne-accent'],
          color: side['--omne-accent-ink'],
          'border-radius': '999px',
          'box-shadow': `0 2px 8px ${edge(0.3)}`,
        },
        hover: { background: side['--omne-accent-hover'] },
      },
    },
    {
      point: 'shell.part-style',
      key: 'session.header',
      data: {
        base: {
          background: glass(0.72),
          'box-shadow': `0 1px 0 ${edge(0.3)}`,
          'border-radius': '0 0 calc(var(--omne-size) * 14px) calc(var(--omne-size) * 14px)',
        },
      },
    },
    {
      point: 'shell.part-style',
      key: 'session.composer',
      data: {
        base: {
          background: glass(0.86),
          border: `1px solid ${edge(0.42)}`,
          'border-radius': 'calc(var(--omne-size) * 16px)',
          'box-shadow': `0 6px 20px ${edge(0.12)}`,
        },
      },
    },
    {
      point: 'shell.part-style',
      key: 'session.composer.send',
      data: { base: { 'border-radius': '999px', 'box-shadow': `0 0 0 2px ${edge(0.35)}` } },
    },
    {
      point: 'shell.part-style',
      key: 'shell.gate',
      data: { base: { border: `1px solid ${edge(0.5)}`, 'border-radius': 'calc(var(--omne-size) * 18px)' } },
    },
    { point: 'shell.part-render', key: 'session.backdrop', module, export: 'backdrop' },
    { point: 'shell.part-render', key: 'session.companion.figure', module, export: 'companion' },
    { point: 'shell.piece', key: 'figure', module, export: 'figure' },
  ]
}

/** What the backdrop drawing needs to know of the theme, put into its module as a constant. */
export function sceneOf(theme, image, fallbackAccent, figure = 'art/figure.webp') {
  const { mode, light, dark } = palettesOf(theme, fallbackAccent)
  const art = theme.art ?? {}
  const focus = value => (typeof value === 'number' && value >= 0 && value <= 1 ? value : 0.5)
  return {
    image,
    figure,
    mode,
    focusX: focus(art.focusX),
    focusY: focus(art.focusY),
    safeArea: ['left', 'right', 'center', 'none'].includes(art.safeArea) ? art.safeArea : 'auto',
    name: typeof theme.name === 'string' ? theme.name : '',
    quote: typeof theme.quote === 'string' ? theme.quote : '',
    ground: { light: hexOf(over(light.background, WHITE)), dark: hexOf(over(dark.background, BLACK)) },
    accent: { light: hexOf(light.accent), dark: hexOf(dark.accent) },
  }
}

/** The skin name a theme gets: dream-<its slug>, in the letters the host allows. */
export function skinName(slug, fallback) {
  const words = String(slug ?? '').toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '')
  const core = words === '' ? String(fallback).toLowerCase().replace(/[^a-z0-9]+/gu, '-') : words
  return `dream-${core}`.slice(0, 64).replace(/-+$/u, '')
}
