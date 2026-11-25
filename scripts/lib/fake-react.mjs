// A React stand-in just large enough to call a skin's drawings outside the app.
//
// It runs the drawing and every function component it returns, once, with hooks that keep their first value, and
// keeps the tree of host elements. It is a smoke test: it shows that a drawing does not throw and which images it
// asks for, not how it looks.

const FRAGMENT = Symbol('Fragment')

export function fakeReact() {
  const element = (type, props, ...children) => ({
    $element: true,
    type,
    props: { ...(props ?? {}), children: children.length <= 1 ? children[0] : children },
  })
  return Object.freeze({
    Fragment: FRAGMENT,
    createElement: element,
    cloneElement: (base, props) => ({ ...base, props: { ...base.props, ...props } }),
    isValidElement: value => typeof value === 'object' && value !== null && value.$element === true,
    useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
    useReducer: (_reduce, initial) => [initial, () => {}],
    useRef: initial => ({ current: initial ?? null }),
    useMemo: make => make(),
    useCallback: call => call,
    useEffect: () => {},
    useLayoutEffect: () => {},
    useId: () => 'fake-id',
    useContext: context => context?._value,
    createContext: value => ({ _value: value }),
    useSyncExternalStore: (_subscribe, snapshot, serverSnapshot) => (serverSnapshot ?? snapshot)(),
    memo: component => component,
    forwardRef: render => props => render(props, null),
  })
}

/** Expands function components until only host elements, text and nothing are left. */
export function expand(node, depth = 0) {
  if (depth > 50) throw new Error('the drawing nests more than 50 components deep')
  if (node === null || node === undefined || typeof node === 'boolean') return null
  if (typeof node === 'string' || typeof node === 'number') return node
  if (Array.isArray(node)) return node.map(each => expand(each, depth + 1))
  if (node.$builtIn === true) return node
  if (node.$element !== true) throw new Error(`the drawing gave ${typeof node}, which React cannot draw`)
  if (typeof node.type === 'function') return expand(node.type(node.props), depth + 1)
  return { ...node, props: { ...node.props, children: expand(node.props.children, depth + 1) } }
}

/** Every host element of an expanded tree. */
export function* elementsOf(node) {
  if (node === null || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const each of node) yield* elementsOf(each)
    return
  }
  if (node.$element !== true) return
  yield node
  yield* elementsOf(node.props.children)
}

export const BUILT_IN = Object.freeze({ $builtIn: true })
