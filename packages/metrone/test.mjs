// Placeholder contract: never exit 0 for a command, JSON envelope under --json,
// --version prints the package version. Run with `npm test -w packages/metrone`.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const here = dirname(fileURLToPath(import.meta.url))
const bin = join(here, 'bin', 'metrone.js')
const { version } = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'))

const run = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' })

// A command never looks like success.
for (const cmd of [['init', '--yes'], ['doctor'], ['login'], []]) {
  const r = run(...cmd)
  assert.equal(r.status, 2, `${cmd.join(' ') || '(no args)'} must exit 2`)
  assert.match(r.stderr, /not released yet/)
  assert.match(r.stderr, /metrone\.io\/install\.md/)
  assert.equal(r.stdout, '')
}

// --json: one JSON object on stdout, exit 2, no prose on stdout.
{
  const r = run('init', '--yes', '--json')
  assert.equal(r.status, 2)
  const body = JSON.parse(r.stdout)
  assert.equal(body.ok, false)
  assert.equal(body.error.code, 'CLI_NOT_RELEASED')
  assert.equal(body.error.install, 'https://metrone.io/install.md')
  assert.equal(body.error.llms, 'https://metrone.io/llms.txt')
  assert.equal(body.version, version)
}

// --version / --help are the only exit-0 paths.
assert.equal(run('--version').stdout.trim(), version)
assert.equal(run('--version').status, 0)
assert.equal(run('--help').status, 0)

// No number that could be read as a price or a limit anywhere in the package.
const src = readFileSync(bin, 'utf8') + readFileSync(join(here, 'README.md'), 'utf8')
assert.doesNotMatch(src, /\$\d|\d+\s*(MCU|events|\/mo)/i, 'placeholder must not carry prices or limits')

console.log('metrone placeholder: 4 commands exit 2, --json envelope ok, --version', version)
