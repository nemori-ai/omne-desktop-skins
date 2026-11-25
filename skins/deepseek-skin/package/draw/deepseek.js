// The drawings of deepseek-skin.
//
// Each export is called once by the OMNE client with { React, ui, shell, files } and gives back a drawing. Nothing is
// imported: React and the file addresses are what the host hands in. The page's CSP allows no <style> element, so
// every look here is an inline style, and state (light or dark, the size of the page) lives in small components of
// their own, never in the drawing itself.

const MOOD = {
  idle: 'delighted',
  thinking: 'determined',
  looking: 'determined',
  writing: 'determined',
  background: 'sleepy',
}

const moodArt = doing => `art/chibi-${MOOD[doing] ?? 'delighted'}.webp`

// Light or dark as the app resolved it: <html data-theme="light|dark">, else the system.
const root = () => (typeof document === 'undefined' ? undefined : document.documentElement)
const systemDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
const isDark = () => {
  const theme = root()?.dataset.theme
  return theme === undefined || theme === '' ? systemDark() : theme === 'dark'
}
function onTheme(change) {
  const element = root()
  if (element === undefined) return () => {}
  const watch = new MutationObserver(change)
  watch.observe(element, { attributes: true, attributeFilter: ['data-theme'] })
  const system = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : undefined
  system?.addEventListener('change', change)
  return () => {
    watch.disconnect()
    system?.removeEventListener('change', change)
  }
}

const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

// The two maids as the art is cut: width over height of maid-left.webp and maid-right.webp.
const LEFT_RATIO = 829 / 1500
const RIGHT_RATIO = 785 / 1500
// The reading column of the conversation (session-ui: max-width 185 steps of --spacing, 4px at the standard size).
const COLUMN = 740
// The clear space the maids leave between themselves and the reading column.
const GAP = 24

const layer = { position: 'absolute', inset: 0 }
const fade = 'opacity 600ms cubic-bezier(0.2, 0.8, 0.2, 1)'
const glide = 'transform 480ms cubic-bezier(0.16, 1, 0.3, 1), opacity 480ms cubic-bezier(0.16, 1, 0.3, 1)'

// Parts of the page the hall reads to know where the words are: the composer is as wide as the reading column, the
// transcript holds it, and a docked side area takes the right of the page. All three are OMNE parts (data-omne-part).
const PART = name => `[data-omne-part="${name}"]`
const SIDE_OPEN = `${PART('session.side')}[data-presentation="docked"][data-open="true"]`

/** Where the reading column and a docked side area sit, in the hall's own coordinates; null where there is none. */
function layoutOf(hall) {
  const page = hall.parentElement?.parentElement ?? hall.ownerDocument
  const at = hall.getBoundingClientRect()
  const composer = page.querySelector(PART('session.composer'))?.getBoundingClientRect()
  const transcript = page.querySelector(PART('session.transcript'))?.getBoundingClientRect()
  const side = page.querySelector(SIDE_OPEN)?.getBoundingClientRect()
  let column = null
  if (composer !== undefined && composer.width > 0) column = { left: composer.left - at.left, right: composer.right - at.left }
  else if (transcript !== undefined && transcript.width > 0) {
    const wide = Math.min(COLUMN, transcript.width)
    const left = transcript.left - at.left + (transcript.width - wide) / 2
    column = { left, right: left + wide }
  }
  const docked =
    side !== undefined && side.width > 1
      ? { left: side.left - at.left, top: side.top - at.top, width: side.width, height: side.height }
      : null
  const round = box => (box === null ? null : Object.fromEntries(Object.entries(box).map(([k, v]) => [k, Math.round(v)])))
  return { width: Math.round(at.width), height: Math.round(at.height), column: round(column), side: round(docked) }
}

const sameLayout = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/** One maid in a room of the given width beside the column: never taller than the room lets her be. */
function standIn(room, height, ratio) {
  const tall = Math.round(Math.min(height * 0.74, room / 0.7 / ratio))
  const width = Math.round(tall * ratio)
  return { shown: room > 0 && tall >= height * 0.42, height: tall, width, x: Math.round(Math.min(0, room - width)) }
}

/**
 * Where the maids stand: full height either side when nothing is open; in a session, each in the room between the
 * reading column and the edge on her side (the side area's edge when one is docked), a gap clear of the words, partly
 * stepped out of that room when it is narrow, and gone when it is too narrow for her.
 */
function maidsOf({ width, height, column, side }, empty) {
  if (empty) {
    const tall = Math.round(height * 0.9)
    const shown = width >= 760
    const inset = Math.round(width * 0.03)
    return {
      left: { shown, height: tall, width: Math.round(tall * LEFT_RATIO), x: inset },
      right: { shown, height: tall, width: Math.round(tall * RIGHT_RATIO), x: inset },
      opacity: 1,
    }
  }
  const edge = side === null ? width : side.left
  const words = column ?? { left: (edge - COLUMN) / 2, right: (edge + COLUMN) / 2 }
  const left = standIn(words.left - GAP, height, LEFT_RATIO)
  const right = standIn(edge - words.right - GAP, height, RIGHT_RATIO)
  return { left, right: { ...right, x: right.x + (width - edge) }, opacity: 0.86 }
}

/** The veil between the hall and the words: light on an empty page, strongest over the reading column in a session. */
function veilOf(dark, empty, { width, column }) {
  const tint = alpha => (dark ? `rgb(8 14 38 / ${alpha}%)` : `rgb(243 245 252 / ${alpha}%)`)
  if (empty) return `linear-gradient(180deg, ${tint(dark ? 18 : 8)} 0%, ${tint(dark ? 30 : 22)} 100%)`
  const strong = tint(dark ? 78 : 82)
  if (column === null || width === 0)
    return `linear-gradient(90deg, ${tint(28)} 0%, ${strong} 30%, ${strong} 70%, ${tint(28)} 100%)`
  const soft = 64
  return `linear-gradient(90deg, ${tint(28)} 0px, ${strong} ${Math.max(0, column.left - soft)}px, ${strong} ${column.right + soft}px, ${tint(28)} ${width}px)`
}

/** The ground under a docked side area, so what it shows reads over the hall and a maid can stand behind it. */
const sideGround = (dark, side) => ({
  position: 'absolute',
  left: side.left,
  top: side.top,
  width: side.width,
  height: side.height,
  background: dark ? 'rgb(9 16 40 / 90%)' : 'rgb(247 248 253 / 92%)',
  boxShadow: dark ? 'inset 1px 0 0 rgb(216 187 128 / 30%)' : 'inset 1px 0 0 rgb(168 132 63 / 35%)',
  transition: fade,
})

/** The palace hall by day or night, with the two maids at its sides. */
export const backdrop = ({ React, files }) => {
  const h = React.createElement
  const url = path => files?.url(path)
  const art = {
    day: url('art/palace-day.webp'),
    night: url('art/palace-night.webp'),
    left: url('art/maid-left.webp'),
    right: url('art/maid-right.webp'),
    crest: url('art/crest.webp'),
  }

  function Hall({ part, empty }) {
    const dark = React.useSyncExternalStore(onTheme, isDark, () => false)
    const place = React.useRef(null)
    const [box, setBox] = React.useState({ width: 0, height: 0, column: null, side: null })
    React.useLayoutEffect(() => {
      const hall = place.current
      if (hall === null || typeof ResizeObserver === 'undefined') return undefined
      const sized = new ResizeObserver(() => schedule())
      let frame = 0
      const measure = () => {
        frame = 0
        const next = layoutOf(hall)
        setBox(now => (sameLayout(now, next) ? now : next))
        // Follow the parts it read as they resize (the side area slides open, the window narrows).
        const page = hall.parentElement?.parentElement
        for (const name of [PART('session.composer'), PART('session.transcript'), SIDE_OPEN]) {
          const found = page?.querySelector(name)
          if (found) sized.observe(found)
        }
      }
      const schedule = () => {
        if (frame === 0) frame = requestAnimationFrame(measure)
      }
      measure()
      sized.observe(hall)
      // A session opened or closed, or the side area opened: the parts come and go under the page.
      const page = hall.parentElement?.parentElement
      const changed = typeof MutationObserver === 'undefined' || page == null ? undefined : new MutationObserver(schedule)
      changed?.observe(page, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-open'] })
      return () => {
        if (frame !== 0) cancelAnimationFrame(frame)
        sized.disconnect()
        changed?.disconnect()
      }
    }, [])
    const maids = maidsOf(box, empty)
    const scene = src => ({ ...layer, backgroundImage: `url("${src}")`, backgroundSize: 'cover', backgroundPosition: 'center' })
    const maid = (side, src, at) =>
      h('img', {
        key: side,
        src,
        alt: '',
        draggable: false,
        style: {
          position: 'absolute',
          bottom: 0,
          [side]: at.x,
          width: at.width,
          height: at.height,
          opacity: at.shown && box.width > 0 ? maids.opacity : 0,
          transform: at.shown ? 'none' : `translateX(${side === 'left' ? -12 : 12}%)`,
          transition: glide,
          filter: dark ? 'brightness(0.9) saturate(0.95)' : 'none',
          userSelect: 'none',
        },
      })
    return h(
      'div',
      { ...part, ref: place, style: { ...layer, overflow: 'hidden' } },
      h('div', { key: 'day', style: { ...scene(art.day), opacity: dark ? 0 : 1, transition: fade } }),
      h('div', { key: 'night', style: { ...scene(art.night), opacity: dark ? 1 : 0, transition: fade } }),
      h('div', { key: 'veil', style: { ...layer, backgroundImage: veilOf(dark, empty, box), transition: fade } }),
      maid('left', art.left, maids.left),
      maid('right', art.right, maids.right),
      !empty && box.side !== null ? h('div', { key: 'side', style: sideGround(dark, box.side) }) : null,
      empty
        ? h('img', {
            key: 'crest',
            src: art.crest,
            alt: '',
            draggable: false,
            style: { position: 'absolute', left: '50%', bottom: 24, width: 160, transform: 'translateX(-50%)', opacity: 0.85 },
          })
        : null,
    )
  }

  return ({ part, props, builtIn }) =>
    art.day === undefined ? builtIn() : h(Hall, { part, empty: props?.empty === true })
}

/** A chibi face that bobs while the agent works, unless the person asked for less motion. */
function chibiOf(React) {
  const h = React.createElement
  return function Chibi({ src, size, busy, lifted, part }) {
    const face = React.useRef(null)
    React.useEffect(() => {
      const element = face.current
      if (!busy || element === null || typeof element.animate !== 'function' || reducedMotion()) return undefined
      const bob = element.animate(
        [{ transform: 'translateY(0)' }, { transform: 'translateY(-6%)' }, { transform: 'translateY(0)' }],
        { duration: 1400, iterations: Infinity, easing: 'ease-in-out' },
      )
      return () => bob.cancel()
    }, [busy])
    return h(
      'span',
      {
        ...part,
        style: {
          display: 'inline-flex',
          width: size,
          height: size,
          transform: lifted ? 'scale(1.08) rotate(-4deg)' : 'none',
          transition: 'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          pointerEvents: 'none',
        },
      },
      h('img', {
        ref: face,
        src,
        alt: '',
        draggable: false,
        width: size,
        height: size,
        style: {
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          filter: 'drop-shadow(0 3px 6px rgb(12 22 64 / 30%))',
          userSelect: 'none',
        },
      }),
    )
  }
}

/** shell.piece figure: the agent's figure, seated in the sidebar's home or flying, as the whale maid's face. */
export const figure = ({ React, files }) => {
  const Chibi = chibiOf(React)
  return ({ subject, generic }) => {
    const src = files?.url(moodArt(subject?.doing))
    if (src === undefined) return generic()
    const busy = subject.doing !== 'idle' && subject.doing !== 'background'
    return React.createElement(Chibi, { src, size: subject.size ?? 48, busy, lifted: subject.hover === true })
  }
}

/** session.companion.figure: the floating companion, the same face, a little larger and lifted while carried. */
export const companion = ({ React, files }) => {
  const Chibi = chibiOf(React)
  return ({ part, props, builtIn }) => {
    const src = files?.url(moodArt(props?.doing))
    if (src === undefined) return builtIn()
    const busy = props.doing !== 'idle' && props.doing !== 'background'
    return React.createElement(Chibi, { part, src, size: 56, busy, lifted: props.dragging || props.unfolded })
  }
}
