# @yamat47/playmaker

A UI-framework-agnostic TypeScript library for creating and displaying American football play diagrams.
It draws the diagram in a container element, places the editing UI, and delivers `PlayData` on every edit. It does not persist or share anything.

- Demo: https://playmaker-demo.yamat47.me/
- Source and detailed usage: https://github.com/yamat47/playmaker

## Installation

```sh
npm install @yamat47/playmaker
```

```ts
import { Playmaker, type PlayData } from "@yamat47/playmaker";
import "@yamat47/playmaker/styles.css";

const playmaker = new Playmaker(document.getElementById("play")!, {
  mode: "edit", // "edit" (default, with editing UI) / "view" (read-only)
  locale: "en", // language of the editing UI: "en" (default) / "ja"
  initialData: saved, // a persisted PlayData (optional)
  onChange: (data: PlayData) => save(JSON.stringify(data)),
});
```

You can also load it from a CDN without a bundler. It has no dependencies, and the fonts are bundled into the JS.
Replace `0.1.0` in the URL with the version you use.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@yamat47/playmaker@0.1.0/dist/playmaker.css" />
<div id="play" style="width: 960px; height: 600px"></div>
<script type="module">
  import { Playmaker } from "https://cdn.jsdelivr.net/npm/@yamat47/playmaker@0.1.0/dist/playmaker.js";
  new Playmaker(document.getElementById("play"));
</script>
```

It assumes modern browsers and mouse input on a PC.

## What it does

- Place players (circles and squares) with labels, and route, block, and motion lines, and move them by dragging
- Positions snap to a 0.5-yard grid
- Load the bundled formation and play presets (`FORMATION_PRESETS`, `PLAY_PRESETS`)
- Export a PNG without the editing UI (`exportToPng`)
- Match the colors and fonts to the host with CSS variables (`--playmaker-*`)

The list of the public API, the shape of `PlayData`, and the theme variables are in the repository README.

## License

MIT
