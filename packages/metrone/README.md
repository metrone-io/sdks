# metrone

Placeholder for the **Metrone CLI**. It claims the `metrone` npm name so that `npx metrone` resolves to [Metrone](https://metrone.io) when the CLI ships.

Until then every command exits with code `2` and points here:

- Install guide: <https://metrone.io/install.md>
- For AI agents: <https://metrone.io/llms.txt>

```sh
npx metrone init --yes --json
# {"ok":false,"error":{"code":"CLI_NOT_RELEASED",...},"version":"0.0.1"}   exit 2
npx metrone --version
# 0.0.1
```

The released CLI (`init`, `login`, `doctor`, `whoami`, `regions`, `projects`, `claim`) replaces this package under the same name; `@metrone-io/cli` is the scoped implementation it wraps.

Other Metrone packages: [`@metrone-io/sdk`](https://npmjs.com/package/@metrone-io/sdk), [`@metrone-io/react`](https://npmjs.com/package/@metrone-io/react), [`@metrone-io/server`](https://npmjs.com/package/@metrone-io/server), [`@metrone-io/mcp`](https://npmjs.com/package/@metrone-io/mcp).
