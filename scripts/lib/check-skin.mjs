// Checks one skin package the way the OMNE host would, and smoke-runs its drawings.

import { existsSync, openSync, readFileSync, readSync, closeSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BUILT_IN, elementsOf, expand, fakeReact } from './fake-react.mjs'
import {
  DATA_POINTS,
  DRAWING_POINTS,
  IMAGE_HEAD_BYTES,
  MANIFEST_FILE,
  carriedFault,
  dataFault,
  drawingKeyFault,
  fileRefs,
  imageFault,
  isImage,
  manifestFaults,
} from './rules.mjs'

/** What each drawing is called with: the props of the part or the subject of the piece, in the cases worth trying. */
export const SAMPLES = {
  'shell.part-render': {
    'session.backdrop': [{ empty: true }, { empty: false }],
    'session.companion.figure': ['idle', 'thinking', 'looking', 'writing', 'background'].map(doing => ({
      doing,
      unfolded: doing === 'looking',
      dragging: doing === 'writing',
    })),
    'session.composer': [{ running: false, empty: true }, { running: true, empty: false }],
    'session.header': [{ title: 'A session' }],
    'session.list.item': [{ title: 'A session', selected: true }, { title: 'Another', selected: false }],
  },
  'shell.piece': {
    figure: ['idle', 'thinking', 'looking', 'writing', 'background'].map(doing => ({
      size: 48,
      phase: 'seated',
      hover: doing === 'idle',
      doing,
      waiting: 0,
    })),
    loading: [{ size: 'md', active: true, counted: false }],
    'empty-state': [{ title: 'Nothing yet', hint: 'A hint' }],
    'inline-notice': [{ tone: 'info', title: 'A notice' }],
  },
  'shell.icon': { '*': [{ name: 'icon', size: 16, className: undefined }] },
}

const FILES_AT = '/plugin-files/'

function filesIn(dir, root = dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? filesIn(path, root) : [relative(root, path).split(sep).join('/')]
  })
}

function head(path) {
  const handle = openSync(path, 'r')
  try {
    const bytes = new Uint8Array(IMAGE_HEAD_BYTES)
    const read = readSync(handle, bytes, 0, IMAGE_HEAD_BYTES, 0)
    return bytes.subarray(0, read)
  } finally {
    closeSync(handle)
  }
}

/** The package paths that the tree of a drawing points at through files.url. */
function pointedIn(tree) {
  const found = new Set()
  const visit = value => {
    if (typeof value === 'string')
      for (const match of value.matchAll(/\/plugin-files\/([A-Za-z0-9._/-]+)/gu)) found.add(match[1])
    else if (typeof value === 'object' && value !== null && value !== BUILT_IN)
      for (const [key, each] of Object.entries(value)) if (key !== 'children') visit(each)
  }
  for (const element of elementsOf(tree)) visit(element.props)
  return found
}

/**
 * Checks the package in `dir`. Gives the faults (the host would refuse or fail the skin) and the notes (worth a look,
 * not refused).
 */
export async function checkSkin(dir, contract) {
  const faults = []
  const notes = []
  const manifestPath = join(dir, MANIFEST_FILE)
  if (!existsSync(manifestPath)) return { faults: [`there is no ${MANIFEST_FILE}`], notes, bytes: 0, members: 0 }
  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    return { faults: [`${MANIFEST_FILE} is not JSON: ${error.message}`], notes, bytes: 0, members: 0 }
  }
  const read = manifestFaults(manifest)
  faults.push(...read.faults)
  if (read.unread.length > 0) notes.push(`${MANIFEST_FILE} writes fields the host does not read: ${read.unread.join(', ')}`)

  const files = filesIn(dir)
  let bytes = 0
  for (const path of files) {
    const fault = carriedFault(path)
    if (fault !== null) faults.push(fault)
    bytes += statSync(join(dir, path)).size
    if (isImage(path)) {
      const image = imageFault(path, head(join(dir, path)))
      if (image !== null) faults.push(image)
    }
  }

  const members = Array.isArray(manifest?.client?.members) ? manifest.client.members : []
  const places = members.map(member => `${member.point}\n${member.key}`)
  // credits.json is read by people, not by the host: it carries the attribution chain inside the package.
  const used = new Set([MANIFEST_FILE, 'credits.json'])
  for (const [index, member] of members.entries()) {
    const label = `client.members[${index}] (${member.point} ${member.key})`
    if (places.indexOf(places[index]) !== index) faults.push(`${label}: another member of this skin is at the same place`)
    if ('data' in member) {
      if (!DATA_POINTS.includes(member.point)) {
        faults.push(`${label}: the point takes no data from a plugin`)
        continue
      }
      const fault = dataFault(member.point, member.key, member.data, contract)
      if (fault !== null) faults.push(`${label}: ${fault}`)
      for (const path of fileRefs(member.data)) {
        used.add(path)
        if (!files.includes(path)) faults.push(`${label}: the file ${path} it points at is not in the package`)
      }
    }
    if ('module' in member) {
      if (!DRAWING_POINTS.includes(member.point)) {
        faults.push(`${label}: the point takes no drawing`)
        continue
      }
      const keyFault = drawingKeyFault(member.point, member.key, contract)
      if (keyFault !== null) faults.push(`${label}: ${keyFault}`)
      used.add(member.module)
      if (!files.includes(member.module)) {
        faults.push(`${label}: the file ${member.module} is not in the package`)
        continue
      }
      for (const path of await smoke(dir, manifest.name, member, label, faults, notes)) {
        used.add(path)
        if (!files.includes(path)) faults.push(`${label}: the drawing asks for ${path}, which is not in the package`)
      }
    }
  }
  for (const path of files) if (!used.has(path)) notes.push(`${path} is carried but nothing points at it`)
  return { faults, notes, bytes, members: members.length }
}

/** Loads a module member, calls its export as the host does, and draws it with each sample. */
async function smoke(dir, name, member, label, faults, notes) {
  const pointed = new Set()
  let file
  try {
    file = await import(`${pathToFileURL(join(dir, member.module)).href}?check=${Date.now()}`)
  } catch (error) {
    faults.push(`${label}: ${member.module} could not be loaded: ${error.message}`)
    return pointed
  }
  const made = file[member.export]
  if (typeof made !== 'function') {
    faults.push(`${label}: ${member.module} exports no function named ${member.export}`)
    return pointed
  }
  const React = fakeReact()
  const handed = Object.freeze({
    React,
    ui: Object.freeze({}),
    shell: Object.freeze({ navigate: () => {}, toast: () => {}, scope: { get: () => undefined, subscribe: () => () => {} } }),
    files: Object.freeze({ url: path => `${FILES_AT}${path}` }),
  })
  let drawing
  try {
    drawing = made(handed)
  } catch (error) {
    faults.push(`${label}: ${member.export} threw: ${error.message}`)
    return pointed
  }
  if (typeof drawing !== 'function') {
    faults.push(`${label}: ${member.export} gave no drawing`)
    return pointed
  }
  const byPoint = SAMPLES[member.point] ?? {}
  const samples = byPoint[member.key] ?? byPoint['*']
  if (samples === undefined) notes.push(`${label}: no sample props are known for this key, so it is drawn with {}`)
  const part = { 'data-omne-part': member.key }
  for (const sample of samples ?? [{}]) {
    const given =
      member.point === 'shell.part-render'
        ? { props: sample, part, builtIn: () => BUILT_IN }
        : { subject: sample, generic: () => BUILT_IN }
    try {
      const tree = expand(drawing(Object.freeze(given)))
      if (member.point === 'shell.part-render' && tree !== BUILT_IN) {
        const outer = Array.isArray(tree) ? undefined : tree
        if (outer?.props?.['data-omne-part'] !== member.key)
          faults.push(`${label}: with ${JSON.stringify(sample)} the outermost element does not carry part, so the part cannot be found`)
      }
      for (const path of pointedIn(tree)) pointed.add(path)
    } catch (error) {
      faults.push(`${label}: drawn with ${JSON.stringify(sample)} it threw: ${error.message}`)
    }
  }
  return pointed
}
