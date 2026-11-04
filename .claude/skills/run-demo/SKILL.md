---
name: run-demo
description: Start Playmaker's demo playground in the Docker container and check a change by looking at it and operating it in a browser. Use when a change under src/browser or demo/ should be verified on the real screen, when the demo should be started or screenshotted, or when asked to "run it and check".
---

# Start the demo and check it by eye

The dev server runs in the Docker `dev` service. `pnpm dev` cannot be run on the host.

## Steps

1. Start it. The command waits until the dev server responds (healthcheck) and then returns. It is fine if it is already running
   ```sh
   make up
   ```
2. If `make up` fails, look at the cause with `docker compose -f docker/compose.yaml logs --tail 50 dev`
   (run `make install` if `node_modules` is empty, `make setup` if the image is old)
3. Open http://localhost:5173/ in a browser (the chrome-devtools MCP or similar), operate the changed part, and check it.
   Also check for console errors. `http://localhost:5173/?locale=ja` shows the editing UI in Japanese
4. Editing a source file reloads the page automatically (edits on the host are picked up by polling).
   After changing `library/vite.config.ts` or the dependencies, run `make down && make up`
5. When the check is done, stop it with `make down` unless the user said they will keep using it

## Notes

- Starting fails if port 5173 is in use (`--strictPort`). Check that no other `pnpm dev` is running
  inside Dev Containers
- A visual check is not a substitute for tests. Behavior is covered by `make test` (`.claude/rules/testing.md`)
