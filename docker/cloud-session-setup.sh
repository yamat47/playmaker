#!/bin/bash
# cloud 版の Claude Code のセッションでは Docker が使えない。コンテナそのものを開発環境とみなし、
# .node-version の Node と packageManager の pnpm を入れて、make が pnpm を直接呼ぶようにする。
# セッションが終わるとコンテナの状態はキャッシュされるので、2 回目からは入っているものを飛ばす。
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

repo="$CLAUDE_PROJECT_DIR"
node_major="$(tr -d '[:space:]' < "$repo/.node-version")"
node_prefix="/opt/node-$node_major"

# コンテナに最初から入っている Node は版が古いので、同じメジャーの最新を別の場所に入れて PATH の先頭に置く。
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

# Makefile は IN_CONTAINER を見て、docker compose を経由せず pnpm を直接呼ぶ。
# コンテナに入っている Chromium は playwright の版と合わず、playwright からは見つからない。
# ブラウザテストは CHROMIUM_PATH で指した実行ファイルを使う。
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
