# Entry point for development commands. Node / pnpm exist only inside the container (docker/compose.yaml):
# the host goes through docker compose, and a Dev Containers terminal calls pnpm directly.
# In both cases pnpm runs in library/.

.DEFAULT_GOAL := help

COMPOSE := docker compose -f docker/compose.yaml

ifdef IN_CONTAINER
PNPM := pnpm --dir $(CURDIR)/library
else
PNPM := $(COMPOSE) run --rm workspace pnpm
endif

# Allow FILE to be written from the repository root or from library/
TEST_FILE := $(patsubst library/%,%,$(FILE))

# Targets that operate docker are host only (there is no docker inside the container)
define host_only
	@if [ -n "$$IN_CONTAINER" ]; then echo "run make $@ on the host" >&2; exit 1; fi
endef

.PHONY: help
help: ## Show the list of targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "} {printf "  make %-12s %s\n", $$1, $$2}'

.PHONY: setup
setup: ## Build the image and install dependencies (first time, and when the Dockerfile changes)
	$(host_only)
	@# workspace and dev share the same image, so build only one (building both makes the parallel builds fight over the tag)
	$(COMPOSE) build workspace
	$(MAKE) install

.PHONY: install
install: ## pnpm install (when package.json / lockfile change)
	$(PNPM) install

.PHONY: up
up: ## Start the demo dev server in the background (http://localhost:5173)
	$(host_only)
	$(COMPOSE) up -d --wait dev

.PHONY: down
down: ## Stop the containers
	$(host_only)
	$(COMPOSE) down

.PHONY: logs
logs: ## Follow the dev server logs
	$(host_only)
	$(COMPOSE) logs -f dev

.PHONY: build
build: ## Build the library (library/dist/)
	$(PNPM) run build

.PHONY: test
test: ## Run the tests (with the coverage gate). FILE= runs a single file (no gate)
ifdef FILE
	$(PNPM) exec vitest run $(TEST_FILE)
else
	$(PNPM) run test
endif

.PHONY: test-browser
test-browser: ## Check Playmaker's wiring in Chromium
	$(PNPM) run test:browser

.PHONY: test-watch
test-watch: ## Run the tests in watch mode
	$(PNPM) run test:watch

.PHONY: typecheck
typecheck: ## Typecheck
	$(PNPM) run typecheck

.PHONY: lint
lint: ## Check with Biome
	$(PNPM) run lint

.PHONY: fix
fix: ## Auto-fix with Biome
	$(PNPM) run lint:fix

.PHONY: check
check: ## The same verification as CI (typecheck / lint / test / test-browser / build)
	$(PNPM) run check

.PHONY: font
font: ## Regenerate the font subset for drawing the field (library/src/assets/)
	$(PNPM) run font

.PHONY: pnpm
pnpm: ## Any pnpm command (example: make pnpm ARGS="add -D foo")
	$(PNPM) $(ARGS)

.PHONY: sh
sh: ## Open a shell in the container
	$(host_only)
	$(COMPOSE) run --rm workspace bash

.PHONY: clean
clean: ## Remove the containers and volumes (node_modules and pnpm store)
	$(host_only)
	$(COMPOSE) down -v
