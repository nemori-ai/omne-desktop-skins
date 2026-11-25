import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'
import { checkSkin } from '../scripts/lib/check-skin.mjs'
import { carriedFault, fileRefs, imageFault, manifestFaults, styleFault, tokensFault, valueFault } from '../scripts/lib/rules.mjs'

const contract = {
  tokens: ['--omne-accent', '--omne-surface-page'],
  parts: [
    { name: 'shell.app', depths: ['tokens', 'style'] },
    { name: 'session.composer', depths: ['tokens', 'style', 'render'] },
    { name: 'session.backdrop', depths: ['render'] },
  ],
  icons: ['send'],
  pieces: ['empty-state', 'figure', 'inline-notice', 'loading'],
}

describe('valueFault (shell-contract change.ts)', () => {
  it('takes colours, light-dark, calc and file()', () => {
    assert.equal(valueFault('light-dark(#fff, #000)'), null)
    assert.equal(valueFault('calc(var(--omne-size) * 12px)'), null)
    assert.equal(valueFault('file(art/a.webp) center top / 10px 10px no-repeat, rgb(0 0 0 / 10%)'), null)
  })
  it('refuses quotes, colons, semicolons and calls outside the list', () => {
    assert.match(valueFault('"Noto Serif", serif'), /may not have/u)
    assert.match(valueFault('red; color: blue'), /may not have/u)
    assert.match(valueFault('linear-gradient(#fff, #000)'), /may not call/u)
    assert.match(valueFault('url(art/a.webp)'), /may not call/u)
    assert.match(valueFault('blur(4px)'), /may not call/u)
    assert.match(valueFault('   '), /empty/u)
  })
  it('refuses file() that leaves the package or is no image', () => {
    assert.match(valueFault('file(../x.webp)'), /not a path inside/u)
    assert.match(valueFault('file(draw/a.js)'), /does not name an image/u)
  })
})

describe('tokens and style', () => {
  it('knows only the tokens of the interface, on parts that open tokens', () => {
    assert.equal(tokensFault('shell.app', { '--omne-accent': '#123456' }, contract), null)
    assert.match(tokensFault('shell.app', { '--kami-accent': '#123456' }, contract), /not a token/u)
    assert.match(tokensFault('session.backdrop', {}, contract), /does not open tokens/u)
    assert.match(tokensFault('shell.nowhere', {}, contract), /no part is declared/u)
  })
  it('takes only base and the six states, and no tokens as properties', () => {
    assert.equal(styleFault('session.composer', { base: { border: '1px solid #fff' }, hover: { opacity: '0.9' } }, contract), null)
    assert.match(styleFault('session.composer', { pressed: {} }, contract), /not one of/u)
    assert.match(styleFault('session.composer', { base: { '--omne-accent': '#fff' } }, contract), /is a token/u)
    assert.match(styleFault('session.composer', { base: { Color: 'red' } }, contract), /not the name of a property/u)
  })
})

describe('manifest and package (plugin-protocol)', () => {
  it('wants a skin with client members only and no id or rank', () => {
    const good = { schema: 1, name: 'sea', summary: 's', kind: 'skin', client: { members: [{ point: 'shell.tokens', key: 'shell.app', data: {} }] } }
    assert.deepEqual(manifestFaults(good), { faults: [], unread: [] })
    const bad = { ...good, name: 'Sea', kind: undefined, version: '1', server: { members: [{}] }, client: { members: [{ point: 'p', key: 'k', id: 'x', data: 1, module: 'a.js' }] } }
    const { faults, unread } = manifestFaults(bad)
    assert.deepEqual(unread, ['version'])
    for (const expected of [/name/u, /kind/u, /server/u, /no id and no rank/u, /writes data and module/u])
      assert.ok(faults.some(fault => expected.test(fault)), `expected a fault like ${expected}`)
  })
  it('carries only scripts, sheets, JSON and images that begin as their kind', () => {
    assert.equal(carriedFault('art/a.webp'), null)
    assert.match(carriedFault('README.md'), /is not one of/u)
    assert.match(carriedFault('.DS_Store'), /is not one of/u)
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
    assert.equal(imageFault('a.webp', webp), null)
    assert.match(imageFault('a.png', webp), /not the image/u)
    assert.deepEqual(fileRefs({ base: { a: 'file(art/a.webp), file( art/b.png )' } }), ['art/a.webp', 'art/b.png'])
  })
})

describe('checkSkin', () => {
  const dir = mkdtempSync(join(tmpdir(), 'omne-skin-'))
  after(() => rmSync(dir, { recursive: true, force: true }))
  const write = (path, text) => {
    mkdirSync(join(dir, path, '..'), { recursive: true })
    writeFileSync(join(dir, path), text)
  }

  it('finds what the host would refuse, and smoke-runs the drawings', async () => {
    write('plugin.json', JSON.stringify({
      schema: 1, name: 'sea', summary: 'A test sea.', kind: 'skin',
      client: { members: [
        { point: 'shell.tokens', key: 'shell.app', data: { '--omne-accent': 'file(art/missing.webp)' } },
        { point: 'shell.part-render', key: 'session.backdrop', module: 'draw.js', export: 'lost' },
        { point: 'shell.part-render', key: 'session.composer', module: 'draw.js', export: 'unmarked' },
        { point: 'shell.piece', key: 'figure', module: 'draw.js', export: 'throws' },
        { point: 'shell.icon', key: 'no-such-icon', module: 'draw.js', export: 'icon' },
      ] },
    }))
    write('notes.md', 'not carried')
    write('art/fake.png', 'not a png')
    write('draw.js', [
      "export const unmarked = ({ React }) => () => React.createElement('div', null, 'no part')",
      "export const throws = () => () => { throw new Error('boom') }",
      "export const icon = ({ React, files }) => () => React.createElement('img', { src: files.url('art/gone.webp') })",
    ].join('\n'))
    const { faults } = await checkSkin(dir, contract)
    for (const expected of [
      /the file art\/missing\.webp it points at is not in the package/u,
      /exports no function named lost/u,
      /outermost element does not carry part/u,
      /threw: boom/u,
      /no-such-icon is not the name of an icon/u,
      /asks for art\/gone\.webp/u,
      /notes\.md is not one of/u,
      /art\/fake\.png is not the image/u,
    ])
      assert.ok(faults.some(fault => expected.test(fault)), `expected a fault like ${expected}\n${faults.join('\n')}`)
  })
})
