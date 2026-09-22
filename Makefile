# 開発コマンドの入口。Node / pnpm はコンテナ（docker/compose.yaml）の中にしかない前提で、
# ホストからは docker compose 経由、Dev Containers のターミナルからは直接 pnpm を呼ぶ。
# pnpm はどちらも library/ で動く。

.DEFAULT_GOAL := help

COMPOSE := docker compose -f docker/compose.yaml

ifdef IN_CONTAINER
PNPM := pnpm --dir $(CURDIR)/library
else
PNPM := $(COMPOSE) run --rm workspace pnpm
endif

# FILE はリポジトリのルートからでも library/ からでも書けるようにする
TEST_FILE := $(patsubst library/%,%,$(FILE))

# docker を操作するターゲットはホスト専用（コンテナ内には docker がない）
define host_only
	@if [ -n "$$IN_CONTAINER" ]; then echo "make $@ はホストで実行してください" >&2; exit 1; fi
endef

.PHONY: help
help: ## ターゲット一覧を表示する
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "} {printf "  make %-12s %s\n", $$1, $$2}'

.PHONY: setup
setup: ## イメージをビルドして依存を入れる（初回・Dockerfile 変更時）
	$(host_only)
	@# workspace と dev は同じイメージなので片方だけビルドする（両方だと並行ビルドがタグを取り合う）
	$(COMPOSE) build workspace
	$(MAKE) install

.PHONY: install
install: ## pnpm install（package.json / lockfile 変更時）
	$(PNPM) install

.PHONY: up
up: ## demo の dev サーバーをバックグラウンドで起動する（http://localhost:5173）
	$(host_only)
	$(COMPOSE) up -d --wait dev

.PHONY: down
down: ## コンテナを止める
	$(host_only)
	$(COMPOSE) down

.PHONY: logs
logs: ## dev サーバーのログを追う
	$(host_only)
	$(COMPOSE) logs -f dev

.PHONY: build
build: ## ライブラリをビルドする（library/dist/）
	$(PNPM) run build

.PHONY: test
test: ## テストを実行する（カバレッジゲート込み）。FILE= で 1 ファイルだけ（ゲートなし）
ifdef FILE
	$(PNPM) exec vitest run $(TEST_FILE)
else
	$(PNPM) run test
endif

.PHONY: test-watch
test-watch: ## テストを watch モードで実行する
	$(PNPM) run test:watch

.PHONY: typecheck
typecheck: ## 型検査
	$(PNPM) run typecheck

.PHONY: lint
lint: ## Biome で検査する
	$(PNPM) run lint

.PHONY: fix
fix: ## Biome で自動修正する
	$(PNPM) run lint:fix

.PHONY: check
check: ## CI と同じ検証（typecheck / lint / test / build）
	$(PNPM) run check

.PHONY: font
font: ## フィールド描画用フォントのサブセットを作り直す（library/src/assets/）
	$(PNPM) run font

.PHONY: pnpm
pnpm: ## 任意の pnpm コマンド（例: make pnpm ARGS="add -D foo"）
	$(PNPM) $(ARGS)

.PHONY: sh
sh: ## コンテナのシェルに入る
	$(host_only)
	$(COMPOSE) run --rm workspace bash

.PHONY: clean
clean: ## コンテナと volume（node_modules・pnpm store）を消す
	$(host_only)
	$(COMPOSE) down -v
