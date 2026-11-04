#!/bin/bash
# Docker is not available in cloud Claude Code sessions. Treat the container itself as the development
# environment: install the Node from .node-version and the pnpm from packageManager, and have make call pnpm directly.
# The container state is cached when the session ends, so from the second time on, skip what is already installed.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

repo="$CLAUDE_PROJECT_DIR"
node_major="$(tr -d '[:space:]' < "$repo/.node-version")"
node_prefix="/opt/node-$node_major"

# The Node preinstalled in the container is an old version, so install the latest of the same major elsewhere and put it first in PATH.
if [ ! -x "$node_prefix/bin/node" ]; then
  dist="https://nodejs.org/dist/latest-v$node_major.x"
  work="$(mktemp -d)"
  curl -fsSL "$dist/SHASUMS256.txt" -o "$work/SHASUMS256.txt"
  tarball="$(grep -o "node-v$node_major\.[0-9.]*-linux-x64\.tar\.xz" "$work/SHASUMS256.txt")"
  curl -fsSL "$dist/$tarball" -o "$work/$tarball"
  (cd "$work" && grep " $tarball\$" SHASUMS256.txt | sha256sum -c --quiet -)
  mkdir -p "$node_prefix"
  tar -xJf "$work/$tarball" -C "$node_prefix" --strip-components=1
  rm -rf "$work"
fi
export PATH="$node_prefix/bin:$PATH"

package_manager="$(node -p "require('$repo/library/package.json').packageManager")"
if [ "pnpm@$(pnpm --version 2>/dev/null || true)" != "$package_manager" ]; then
  npm install -g "$package_manager"
fi

# The Makefile checks IN_CONTAINER and calls pnpm directly instead of going through docker compose.
# The Chromium in the container does not match the playwright version, and playwright cannot find it.
# The browser tests use the executable pointed to by CHROMIUM_PATH.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo "export PATH=\"$node_prefix/bin:\$PATH\""
    echo "export IN_CONTAINER=1"
    if [ -x /opt/pw-browsers/chromium ]; then
      echo "export CHROMIUM_PATH=/opt/pw-browsers/chromium"
    fi
  } >> "$CLAUDE_ENV_FILE"
fi

IN_CONTAINER=1 make -C "$repo" install
