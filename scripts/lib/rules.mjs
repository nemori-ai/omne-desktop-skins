// The rules the OMNE host applies to a skin, written again here so a skin can be checked without a client.
//
// Each rule names the file of omne-harness-lite it mirrors. When the app changes one of them, change it here too and
// run `npm test`: tests/rules.test.mjs pins the behaviour.

// ── packages/plugin/plugin-protocol/src/manifest.ts ───────────────────────────────────────────────────────────────

export const MANIFEST_FILE = 'plugin.json'
export const MANIFEST_SCHEMA = 1
export const MANIFEST_FIELDS = ['schema', 'name', 'summary', 'kind', 'client', 'server']
const NAME = /^[a-z][a-z0-9-]{0,63}$/u
const SEGMENT = /^[A-Za-z0-9._-]+$/u
const WAYS = ['data', 'directory', 'module']

/** A path that stays inside the package: its segments are plain names, none of them a step up or in place. */
export function insidePackage(path) {
  return path.split('/').every(each => SEGMENT.test(each) && each !== '.' && each !== '..')
}

const isFields = value => typeof value === 'object' && value !== null && !Array.isArray(value)

/** The faults of a manifest as the host reads it, and the fields it would not read. */
export function manifestFaults(value) {
  const faults = []
  if (!isFields(value)) return { faults: ['the manifest is not an object'], unread: [] }
  if (value.schema !== MANIFEST_SCHEMA) faults.push(`schema is ${String(value.schema)}; the host reads schema ${MANIFEST_SCHEMA}`)
  if (typeof value.name !== 'string' || !NAME.test(value.name))
    faults.push(`the name ${JSON.stringify(value.name)} is not lower-case letters, digits and hyphens`)
  if (typeof value.summary !== 'string' || value.summary.trim() === '') faults.push('the summary is empty')
  if (value.kind !== 'skin') faults.push('a skin writes "kind":"skin"')
  const server = value.server
  if (server !== undefined && isFields(server) && (server.members?.length ?? 0) + (server.needs?.length ?? 0) > 0)
    faults.push('a skin has members of the interface only: leave server out')
  if (!isFields(value.client) || !Array.isArray(value.client.members)) faults.push('client.members is not a list')
  else
    value.client.members.forEach((member, index) => {
      const at = `client.members[${index}]`
      if (!isFields(member)) return faults.push(`${at} is not an object`)
      if (typeof member.point !== 'string' || member.point.trim() === '') faults.push(`${at} names no point`)
      if (typeof member.key !== 'string') faults.push(`${at} has no key`)
      if (member.id !== undefined || member.rank !== undefined)
        faults.push(`${at}: the points of a skin hold one item for a key, so a member writes no id and no rank`)
      const written = WAYS.filter(way => way in member)
      if (written.length !== 1) faults.push(`${at} writes ${written.length === 0 ? 'none' : written.join(' and ')} of data, directory and module; a member writes one`)
      if ('directory' in member) faults.push(`${at}: the client side takes no directory`)
      if ('module' in member) {
        if (typeof member.module !== 'string' || !insidePackage(member.module)) faults.push(`${at}: ${member.module} is not a path inside the package`)
        else if (!member.module.endsWith('.js')) faults.push(`${at}: the module ${member.module} is not a .js file`)
        if (typeof member.export !== 'string' || member.export === '') faults.push(`${at} writes a module without the name of its export`)
      }
    })
  const unread = Object.keys(value).filter(field => !MANIFEST_FIELDS.includes(field)).sort()
  return { faults, unread }
}

// ── packages/plugin/plugin-protocol/src/package.ts ────────────────────────────────────────────────────────────────

export const FILE_SUFFIXES = ['.js', '.css', '.json']
export const IMAGE_SUFFIXES = ['.png', '.jpg', '.webp', '.avif', '.svg']
const CARRIED = [...FILE_SUFFIXES, ...IMAGE_SUFFIXES]
export const IMAGE_HEAD_BYTES = 1024

const at = (head, from, ...bytes) => bytes.every((byte, index) => head[from + index] === byte)

function vector(head) {
  const words = new TextDecoder().decode(head)
  const root = words.replace(/^\uFEFF?(?:\s|<\?[^>]*\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>)*/u, '')
  return /^<svg[\s>/]/u.test(root)
}

function avif(head) {
  if (!at(head, 4, 0x66, 0x74, 0x79, 0x70)) return false
  const box = Math.min(new DataView(head.buffer, head.byteOffset, head.byteLength).getUint32(0), head.length)
  const brands = [8, ...Array.from({ length: Math.max(0, (box - 16) / 4) }, (_, index) => 16 + index * 4)]
  const words = new TextDecoder().decode(head)
  return brands.some(from => ['avif', 'avis'].includes(words.slice(from, from + 4)))
}

const BEGINS = {
  '.png': head => at(head, 0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
  '.jpg': head => at(head, 0, 0xff, 0xd8, 0xff),
  '.webp': head => at(head, 0, 0x52, 0x49, 0x46, 0x46) && at(head, 8, 0x57, 0x45, 0x42, 0x50),
  '.avif': avif,
  '.svg': vector,
}

export const isImage = path => IMAGE_SUFFIXES.some(suffix => path.endsWith(suffix))

/** Why a file of the package is not the image its name says, or null. */
export function imageFault(path, head) {
  const suffix = IMAGE_SUFFIXES.find(each => path.endsWith(each))
  if (suffix === undefined || BEGINS[suffix](head)) return null
  return `the file ${path} is not the image its name says`
}

/** Why the package may not carry this file, or null. */
export function carriedFault(path) {
  if (!insidePackage(path)) return `the file ${path} is not a path inside the package`
  return CARRIED.some(suffix => path.endsWith(suffix)) ? null : `the file ${path} is not one of ${CARRIED.join(', ')}`
}

const FILE_REF = /(?<![A-Za-z0-9_-])file\(([^()]*)\)/gu

/** The paths that the data of a member points at with file(path). */
export function fileRefs(data) {
  if (typeof data === 'string') return [...new Set(Array.from(data.matchAll(FILE_REF), match => (match[1] ?? '').trim()))]
  if (typeof data !== 'object' || data === null) return []
  return [...new Set(Object.values(data).flatMap(fileRefs))]
}

// ── packages/frontend/shell-contract/src/change.ts ────────────────────────────────────────────────────────────────

export const TOKENS_POINT = 'shell.tokens'
export const STYLE_POINT = 'shell.part-style'
export const RENDER_POINT = 'shell.part-render'
export const LAYOUT_POINT = 'shell.layout'
export const ICON_POINT = 'shell.icon'
export const PIECE_POINT = 'shell.piece'
export const DATA_POINTS = [TOKENS_POINT, STYLE_POINT, LAYOUT_POINT]
export const DRAWING_POINTS = [RENDER_POINT, ICON_POINT, PIECE_POINT]

export const STATES = ['hover', 'focus-visible', 'active', 'selected', 'open', 'disabled']
const ORDER = ['base', ...STATES]
const PLAIN = /^[A-Za-z0-9 #%.,()+*/_-]$/u
const CALL = /([A-Za-z-][A-Za-z0-9-]*)\(/gu
export const CALLS = new Set(['var', 'calc', 'min', 'max', 'clamp', 'rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color', 'color-mix', 'light-dark'])
const FILE_PATH = /^[A-Za-z0-9_-][A-Za-z0-9._-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/u
const IMAGE = /\.(?:png|jpg|webp|avif|svg)$/u
const PROPERTY = /^[a-z][a-z-]*$/u

function filePathFault(path) {
  if (!FILE_PATH.test(path)) return `file(${path}) is not a path inside the package`
  if (!IMAGE.test(path)) return `file(${path}) does not name an image`
  return null
}

/** Why this text may not be the value of a token or of a declaration, or null when it may. A skin always has files. */
export function valueFault(value) {
  if (value.trim() === '') return 'the value is empty'
  const odd = Array.from(value).find(char => !PLAIN.test(char))
  if (odd !== undefined) return `the value has ${JSON.stringify(odd)}, which a value may not have`
  const lost = Array.from(value.matchAll(FILE_REF), match => filePathFault((match[1] ?? '').trim())).find(found => found !== null)
  if (lost !== undefined) return lost
  const called = Array.from(value.replace(FILE_REF, '').matchAll(CALL), match => match[1] ?? '').find(name => !CALLS.has(name.toLowerCase()))
  return called === undefined ? null : `the value calls ${called}(, which a value may not call`
}

/** Why a key is not a part that opens this layer, or null. */
export function partFault(key, depth, parts) {
  const part = parts.find(found => found.name === key)
  if (part === undefined) return `no part is declared as ${key}`
  return part.depths.includes(depth) ? null : `the part ${key} does not open ${depth}`
}

export function tokensFault(key, data, contract) {
  const fault = partFault(key, 'tokens', contract.parts)
  if (fault !== null) return fault
  if (!isFields(data)) return 'the data is not a record of names and values'
  for (const name of Object.keys(data).sort()) {
    if (!contract.tokens.includes(name)) return `${name} is not a token of the interface`
    if (typeof data[name] !== 'string') return `the token ${name} has no text for a value`
    const value = valueFault(data[name])
    if (value !== null) return `the token ${name}: ${value}`
  }
  return null
}

function declarationFault(property, value) {
  if (property.startsWith('--')) return `${property} is a token: tokens are put on ${TOKENS_POINT}`
  if (!PROPERTY.test(property)) return `${property} is not the name of a property`
  if (typeof value !== 'string') return `the property ${property} has no text for a value`
  const fault = valueFault(value)
  return fault === null ? null : `the property ${property}: ${fault}`
}

export function styleFault(key, data, contract) {
  const fault = partFault(key, 'style', contract.parts)
  if (fault !== null) return fault
  if (!isFields(data)) return 'the data is not a record of states and declarations'
  for (const state of Object.keys(data).sort()) {
    if (!ORDER.includes(state)) return `the state ${state} is not one of base, ${STATES.join(', ')}`
    const declared = data[state]
    if (!isFields(declared)) return `the state ${state} has no declarations`
    for (const property of Object.keys(declared).sort()) {
      const found = declarationFault(property, declared[property])
      if (found !== null) return state === 'base' ? found : `in ${state}, ${found}`
    }
  }
  return null
}

export function layoutFault(key, data) {
  if (key !== 'shell.pages') return `there is nothing to lay out under ${key}`
  if (!Array.isArray(data)) return 'the data is not a list of ids'
  const odd = data.find(id => typeof id !== 'string' || id === '')
  if (odd !== undefined) return `the order names ${JSON.stringify(odd)}, which is not the id of a page`
  const twice = data.find((id, index) => data.indexOf(id) !== index)
  return twice === undefined ? null : `the order names ${String(twice)} twice`
}

/** Why a drawing may not stand on this point and key, or null. */
export function drawingKeyFault(point, key, contract) {
  if (point === RENDER_POINT) return partFault(key, 'render', contract.parts)
  if (point === ICON_POINT) return contract.icons.includes(key) ? null : `${key} is not the name of an icon`
  if (point === PIECE_POINT) return contract.pieces.includes(key) ? null : `${key} is not one of the pieces ${contract.pieces.join(', ')}`
  return `${point} takes no drawing`
}

/** Why a data member may not stand where it is put, or null. */
export function dataFault(point, key, data, contract) {
  if (point === TOKENS_POINT) return tokensFault(key, data, contract)
  if (point === STYLE_POINT) return styleFault(key, data, contract)
  if (point === LAYOUT_POINT) return layoutFault(key, data)
  return `${point} takes no data from a plugin`
}
