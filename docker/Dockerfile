# 開発用イメージ。ホストに Node / pnpm を入れず、ツールチェーンはすべてこの中で動かす。
# Node のメジャーはリポジトリのルートの .node-version（CI が読む）と揃える。
# Dependabot はここだけを上げるので、その PR では .node-version も同じ版に直す。
# ビルドコンテキストはリポジトリのルート（docker/compose.yaml）。
FROM node:26-trixie-slim

# git: Dev Containers 内の VS Code から commit / diff するため
# make: Dev Containers のターミナルからも Makefile の同じターゲットを使うため
RUN apt-get update \
  && apt-get install -y --no-install-recommends git make ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# named volume は初回マウント時にイメージ側のディレクトリの所有者を引き継ぐ。
# 先に node 所有で作っておかないと root 所有になり、node ユーザーで install できない
RUN mkdir -p /workspace/library/node_modules /home/node/.local/share/pnpm/store \
  && chown -R node:node /workspace /home/node/.local

# Dev Containers のターミナルは library/ で開くので、ルートの Makefile を使えるようにする
RUN echo "alias make='make -C /workspace'" >> /home/node/.bashrc

# store の場所を明示する。既定のままだと node_modules の volume と別ファイルシステムに
# なるのを嫌って、pnpm がバインドマウント（リポジトリ）の直下に .pnpm-store を作る
ENV pnpm_config_store_dir=/home/node/.local/share/pnpm/store

# Makefile はこれを見て、docker compose を経由せず pnpm を直接呼ぶ
ENV IN_CONTAINER=1

# pnpm は packageManager と同じ版を焼き込む。ずれていると pnpm が起動のたびに
# 指定版をダウンロードし直し、docker compose run --rm では毎回それが起きる。
# package.json は依存更新のたびに変わるので、それを読む層は最後にまとめる
COPY library/package.json /tmp/package.json
RUN npm install -g "$(node -p "require('/tmp/package.json').packageManager")"

# ブラウザテストの Chromium は、lockfile の playwright が想定する版を、動かすのに要る OS のライブラリと
# 一緒に入れる。テストは headless でしか動かさないので headless shell だけにする。
# node_modules はまだ無いので、npx で lockfile と同じ版の playwright を使う。
# 置き場所を固定しておかないと root のホームに入り、node ユーザーから見えない。
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY library/pnpm-lock.yaml /tmp/pnpm-lock.yaml
RUN version="$(sed -n 's/^  playwright@\([0-9.]*\):$/\1/p' /tmp/pnpm-lock.yaml | head -n 1)" \
  && test -n "$version" \
  && npx -y "playwright@$version" install --with-deps --only-shell chromium \
  && rm -rf /tmp/package.json /tmp/pnpm-lock.yaml /var/lib/apt/lists/*

USER node
WORKDIR /workspace/library
