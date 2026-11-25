// Every skin in the repository passes the checks of the host as the contract snapshot knows it.

import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { checkSkin } from '../scripts/lib/check-skin.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const contract = JSON.parse(readFileSync(join(ROOT, 'contract', 'omne-contract.json'), 'utf8'))
const skins = readdirSync(join(ROOT, 'skins')).filter(name => existsSync(join(ROOT, 'skins', name, 'package')))

describe('skins', () => {
  it('there is at least one', () => assert.ok(skins.length > 0))
  for (const skin of skins)
    describe(skin, () => {
      const dir = join(ROOT, 'skins', skin, 'package')
      it('passes the checks of the host', async () => {
        const credits = JSON.parse(readFileSync(join(dir, 'credits.json'), 'utf8'))
        if (credits.artwork?.files === 'art/') assert.ok(existsSync(join(dir, 'art')), `skins/${skin}/package/art/ is not fetched: npm run art`)
        const { faults } = await checkSkin(dir, contract)
        assert.deepEqual(faults, [])
      })
      it('is named as its directory', () => {
        assert.equal(JSON.parse(readFileSync(join(dir, 'plugin.json'), 'utf8')).name, skin)
      })
      it('says where its artwork comes from and under what licence', () => {
        for (const file of ['README.md', 'NOTICE.md', 'LICENSE']) assert.ok(existsSync(join(ROOT, 'skins', skin, file)), `skins/${skin}/${file}`)
        const credits = JSON.parse(readFileSync(join(dir, 'credits.json'), 'utf8'))
        assert.equal(typeof credits.artwork?.licence, 'string')
      })
    })
})
