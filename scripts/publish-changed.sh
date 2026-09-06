#!/usr/bin/env bash
# Publish each public workspace package whose local version is not on npm.
set -euo pipefail

packages=(sdk react server mcp)

for name in "${packages[@]}"; do
  dir="packages/${name}"
  pkg="$(node -p "require('./${dir}/package.json').name")"
  local_ver="$(node -p "require('./${dir}/package.json').version")"
  published_ver="$(npm view "${pkg}" version 2>/dev/null || true)"

  if [[ "${published_ver}" == "${local_ver}" ]]; then
    echo "skip ${pkg}@${local_ver} (already on npm)"
    continue
  fi

  echo "publish ${pkg}@${local_ver} (npm has ${published_ver:-none})"
  npm publish -w "${dir}" --access public
done
