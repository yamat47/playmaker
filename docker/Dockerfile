# Development image. Node / pnpm are not installed on the host; the whole toolchain runs in here.
# The Node major matches .node-version at the repository root (which CI reads).
# Dependabot bumps only this file, so in that PR, also update .node-version to the same version.
# The build context is the repository root (docker/compose.yaml).
FROM node:26-trixie-slim

# git: for commit / diff from VS Code inside Dev Containers
# make: so the same Makefile targets can be used from a Dev Containers terminal too
RUN apt-get update \
  && apt-get install -y --no-install-recommends git make ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# A named volume inherits the owner of the image-side directory on its first mount.
# Unless created as node-owned first, it becomes root-owned and the node user cannot install
RUN mkdir -p /workspace/library/node_modules /home/node/.local/share/pnpm/store \
  && chown -R node:node /workspace /home/node/.local

# A Dev Containers terminal opens in library/, so make the root Makefile usable from there
RUN echo "alias make='make -C /workspace'" >> /home/node/.bashrc

# State the store location explicitly. With the default, pnpm dislikes the store being on a different
# filesystem from the node_modules volume and creates .pnpm-store right under the bind mount (the repository)
ENV pnpm_config_store_dir=/home/node/.local/share/pnpm/store

# The Makefile checks this and calls pnpm directly instead of going through docker compose
ENV IN_CONTAINER=1

# Chromium for the browser tests is installed with the install of the same playwright version pinned in package.json.
# Debian's chromium version drifts from what playwright expects. The default install location is root's home,
# which the node user running the tests cannot read, so point at a shared location
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Bake the same pnpm version as packageManager into the image. If they differ, pnpm re-downloads
# the specified version on every start, and with docker compose run --rm that happens every time.
# package.json changes on every dependency update and invalidates this layer's cache, so keep it as the last layer
COPY library/package.json /tmp/package.json
RUN npm install -g "$(node -p "require('/tmp/package.json').packageManager")" \
  && npx -y "playwright@$(node -p "require('/tmp/package.json').devDependencies.playwright")" \
    install --with-deps chromium \
  && rm -rf /var/lib/apt/lists/* /root/.npm /tmp/package.json

USER node
WORKDIR /workspace/library
