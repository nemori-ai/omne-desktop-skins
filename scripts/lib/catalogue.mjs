// What a person can ask of the DreamSkin community catalogue, read from the metadata the API lists for every theme: words
// in its name, whether its ground is light or dark, the colour family of its accent, its licence, how often it was
// downloaded. Nothing here downloads a picture; npm run dream -- --sheet shows the pictures of the ones found.

import { luminance, parseColour } from './dream-palette.mjs'
import { licenceOf } from './licences.mjs'

/** Colour families and the words a person may use for them, in English and Chinese. */
export const FAMILIES = {
  red: ['red', 'crimson', 'scarlet', '红', '赤'],
  orange: ['orange', 'amber', '橙', '橘'],
  yellow: ['yellow', 'gold', 'golden', '黄', '金'],
  green: ['green', 'emerald', '绿'],
  cyan: ['cyan', 'teal', 'aqua', '青'],
  blue: ['blue', 'navy', 'azure', '蓝'],
  purple: ['purple', 'violet', 'lavender', '紫'],
  pink: ['pink', 'rose', 'magenta', '粉'],
  neutral: ['neutral', 'gray', 'grey', 'mono', 'monochrome', 'black', 'white', '灰', '黑', '白', '黑白'],
}

const GROUNDS = { light: ['light', '亮', '浅', '白天'], dark: ['dark', '暗', '深', '夜'] }

const lookup = table => word => Object.keys(table).find(key => table[key].includes(String(word).trim().toLowerCase()))
export const familyNamed = lookup(FAMILIES)
export const groundNamed = lookup(GROUNDS)

/** The family of one colour by its hue; grey-ish colours (little saturation) are neutral. */
export function familyOf(text) {
  let colour
  try {
    colour = parseColour(text)
  } catch {
    return null
  }
  const [r, g, b] = [colour.r / 255, colour.g / 255, colour.b / 255]
  const high = Math.max(r, g, b)
  const low = Math.min(r, g, b)
  const lightness = (high + low) / 2
  const chroma = high - low
  const saturation = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * lightness - 1))
  if (saturation < 0.18 || chroma < 0.08) return 'neutral'
  let hue = high === r ? ((g - b) / chroma) % 6 : high === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4
  hue = (hue * 60 + 360) % 360
  if (hue < 15 || hue >= 345) return 'red'
  if (hue < 38) return 'orange'
  if (hue < 70) return 'yellow'
  if (hue < 165) return 'green'
  if (hue < 195) return 'cyan'
  if (hue < 255) return 'blue'
  if (hue < 290) return 'purple'
  return 'pink'
}

/** What a catalogue item offers to a search. */
export function facetsOf(item) {
  const colours = item.displayMeta?.colors ?? {}
  let ground = null
  try {
    if (colours.background !== undefined) ground = luminance(parseColour(colours.background)) < 0.2 ? 'dark' : 'light'
  } catch {
    ground = null
  }
  if (ground === null && ['light', 'dark'].includes(item.displayMeta?.appearance)) ground = item.displayMeta.appearance
  const open = licenceOf(item.license)
  return {
    ground,
    family: colours.accent === undefined ? null : familyOf(colours.accent),
    licence: open.spdx ?? null,
    convertible: item.applyCompatible === true,
    words: `${item.name ?? ''} ${item.authorDisplayName ?? ''} ${item.slug ?? ''} ${item.themeId ?? ''}`.toLowerCase(),
  }
}

/**
 * The wishes of a --find command line. A word that names a ground or a colour family counts as one; any other word must
 * appear in the name, author or slug (any one of several words is enough). --open keeps themes under an open licence.
 */
export function wishesOf(args) {
  const wishes = { words: [], grounds: new Set(), families: new Set(), open: false, licence: undefined, limit: 30 }
  for (let i = 0; i < args.length; i += 1) {
    const word = args[i]
    if (word === '--open') wishes.open = true
    else if (word === '--licence') wishes.licence = args[++i]
    else if (word === '--limit') wishes.limit = Number(args[++i])
    else if (word === '--light' || word === '--dark') wishes.grounds.add(word.slice(2))
    else if (word === '--colour' || word === '--color') for (const c of String(args[++i]).split(',')) {
      const family = familyNamed(c)
      if (family === undefined) throw new Error(`${c} is not a colour family: ${Object.keys(FAMILIES).join(', ')}`)
      wishes.families.add(family)
    }
    else if (groundNamed(word) !== undefined) wishes.grounds.add(groundNamed(word))
    else if (familyNamed(word) !== undefined) wishes.families.add(familyNamed(word))
    else wishes.words.push(word.toLowerCase())
  }
  if (!Number.isInteger(wishes.limit) || wishes.limit < 1) throw new Error('--limit takes a whole number above 0')
  return wishes
}

export function matches(item, wishes) {
  const f = facetsOf(item)
  if (!f.convertible) return false
  if (wishes.grounds.size > 0 && !wishes.grounds.has(f.ground)) return false
  if (wishes.families.size > 0 && !wishes.families.has(f.family)) return false
  if (wishes.open && f.licence === null) return false
  if (wishes.licence !== undefined && f.licence !== wishes.licence) return false
  return wishes.words.length === 0 || wishes.words.some(word => f.words.includes(word))
}

/** The items a search keeps, most downloaded (then most liked) first, at most the limit. */
export function find(items, wishes) {
  const kept = items.filter(item => matches(item, wishes))
  kept.sort((a, b) => (b.downloadCount ?? 0) - (a.downloadCount ?? 0) || (b.favoriteCount ?? 0) - (a.favoriteCount ?? 0))
  return { total: kept.length, shown: kept.slice(0, wishes.limit) }
}

/** One line of a search's answer: id, ground, colour family, licence, downloads, name and author. */
export function lineOf(item) {
  const f = facetsOf(item)
  // A licence that is not an open one is marked own-use: such a skin is for the person who installs it, nothing more.
  const licence = String(f.licence ?? `own-use:${item.license}`).slice(0, 22)
  return `${item.id}  ${(f.ground ?? '?').padEnd(5)}  ${(f.family ?? '?').padEnd(7)}  ${licence.padEnd(22)}  ↓${String(item.downloadCount ?? 0).padEnd(5)}  ${item.name} — ${item.authorDisplayName}`
}
