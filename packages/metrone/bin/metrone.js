#!/usr/bin/env node
/**
 * `metrone` — placeholder for the Metrone CLI.
 *
 * Exists to claim the unscoped npm name so `npx metrone` resolves to Metrone
 * once the real CLI (`init`, `login`, `doctor`, `whoami`, `regions`, `projects`,
 * `claim`) ships. Until then every command answers **exit 2** ("not available
 * yet") — never 0, so an agent running `npx metrone init --yes --json` cannot
 * mistake this for a successful install. `--json` gets a machine-readable
 * envelope; `--version` / `--help` behave like any CLI.
 *
 * No prices, limits or product claims live here: they belong to the URLs below.
 */
import { createRequire } from 'node:module'

const { version } = createRequire(import.meta.url)('../package.json')

const INSTALL = 'https://metrone.io/install.md'
const LLMS = 'https://metrone.io/llms.txt'

const args = process.argv.slice(2)
const has = (...flags) => flags.some(f => args.includes(f))

if (has('--version', '-v', 'version')) {
  process.stdout.write(`${version}\n`)
  process.exit(0)
}

const message =
  `The Metrone CLI is not released yet. For the current install path read ${INSTALL}` +
  ` (agents: ${LLMS}). This placeholder does nothing else.`

if (has('--json')) {
  process.stdout.write(
    JSON.stringify({
      ok: false,
      error: { code: 'CLI_NOT_RELEASED', message, install: INSTALL, llms: LLMS },
      version,
    }) + '\n',
  )
  process.exit(2)
}

if (has('--help', '-h', 'help')) {
  process.stdout.write(`metrone ${version} — placeholder\n\n${message}\n`)
  process.exit(0)
}

process.stderr.write(`metrone: ${message}\n`)
process.exit(2)
