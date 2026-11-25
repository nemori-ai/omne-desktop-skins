// What the free-typed licence of a DreamSkin community theme lets this repository do with it. Only licences that read
// unambiguously as one of the open ones below are taken; anything else (personal use, all rights reserved, a name, a
// number, a licence that forbids redistributing the content as such) is left out, with the reason.

const OPEN = {
  MIT: { attribution: 'keep the copyright and licence notice', nonCommercial: false, shareAlike: false },
  'CC-BY-4.0': { attribution: 'credit the author, link the licence, say what was changed', nonCommercial: false, shareAlike: false },
  'MIT AND CC-BY-4.0': { attribution: 'both: keep the MIT notice, credit the author under CC BY 4.0', nonCommercial: false, shareAlike: false },
  'CC-BY-NC-4.0': { attribution: 'credit the author, link the licence, say what was changed', nonCommercial: true, shareAlike: false },
  'CC-BY-NC-SA-4.0': { attribution: 'credit the author, link the licence, say what was changed', nonCommercial: true, shareAlike: true },
}

export const LICENCE_URL = {
  MIT: 'https://opensource.org/license/mit',
  'CC-BY-4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'MIT AND CC-BY-4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'CC-BY-NC-4.0': 'https://creativecommons.org/licenses/by-nc/4.0/',
  'CC-BY-NC-SA-4.0': 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
}

// The forms seen in the catalogue, after lower-casing and turning runs of spaces, hyphens and underscores into one space.
const FORMS = new Map([
  ['mit', 'MIT'],
  ['cc by 4.0', 'CC-BY-4.0'],
  ['cc by 4.', 'CC-BY-4.0'],
  ['ccby4.0', 'CC-BY-4.0'],
  ['cc by 4.0 and mit', 'MIT AND CC-BY-4.0'],
  ['mit and cc by 4.0', 'MIT AND CC-BY-4.0'],
  ['cc by nc 4.0', 'CC-BY-NC-4.0'],
  ['cc by nc sa 4.0', 'CC-BY-NC-SA-4.0'],
])

const REFUSED = [
  [/^cc by nc nd/u, 'NoDerivatives: a skin scales and re-encodes the picture'],
  [/pixabay/u, 'the Pixabay licence forbids distributing the content as is'],
  [/^cc$/u, 'names no Creative Commons licence in particular'],
  [/^gpl$/u, 'names no GPL version, and the GPL is not written for pictures'],
  [/personal|private|proprietary|all rights|rights reserved|unlicensed|noncommercial fan|fan art|thirdparty|user provided|userprovided|custom/u, 'does not license redistribution'],
]

/** { spdx, ...terms } for a licence this repository can take, or { refused: why }. */
export function licenceOf(declared) {
  const words = String(declared ?? '').trim().toLowerCase().replace(/[\s_-]+/gu, ' ')
  const plain = FORMS.get(words) ?? (/^mit by \S+/u.test(words) ? 'MIT' : undefined)
  if (plain !== undefined) return { spdx: plain, url: LICENCE_URL[plain], ...OPEN[plain] }
  const known = REFUSED.find(([pattern]) => pattern.test(words.replace(/^licenseref /u, '')))
  return { refused: known === undefined ? 'is not a licence this repository can read' : known[1] }
}
