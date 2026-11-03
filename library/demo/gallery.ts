// 同梱するプリセットを全部 view モードで並べる。1 枚ずつ読み込んで見比べる手間を省き、
// 配置や線の崩れをまとめて見つけるためのページ。ライブラリの機能ではなく、demo だけが持つ。
import {
  FORMATION_PRESETS,
  type Formation,
  PLAY_PRESETS,
  Playmaker,
  type PlayPreset,
  type TeamSide,
} from "playmaker";
import "playmaker/styles.css";
import {
  type Chip,
  categoryChip,
  chipElement,
  forEachSide,
  groupTitle,
  need,
  sideChip,
  subTitle,
} from "./presets-ui.js";

interface Tile {
  readonly name: string;
  readonly chip: Chip;
  readonly note: string;
  readonly mount: (stage: HTMLElement) => Playmaker;
}

function formationTile(formation: Formation): Tile {
  return {
    name: formation.name,
    chip: sideChip(formation.side),
    note: "Formation",
    mount: (stage) => {
      const playmaker = new Playmaker(stage, { mode: "view" });
      playmaker.loadFormation(formation);
      return playmaker;
    },
  };
}

function playTile(preset: PlayPreset): Tile {
  return {
    name: preset.name,
    chip: categoryChip(preset.category),
    note: preset.personnel,
    mount: (stage) => new Playmaker(stage, { mode: "view", initialData: preset.data }),
  };
}

const gallery = need("gallery", HTMLElement);
const instances: Playmaker[] = [];

function addGrid(tiles: readonly Tile[]): void {
  const grid = document.createElement("div");
  grid.className = "grid";
  for (const tile of tiles) {
    const card = document.createElement("article");
    card.className = "tile";
    const head = document.createElement("div");
    head.className = "tile__head";
    const name = document.createElement("span");
    name.className = "tile__name";
    name.textContent = tile.name;
    const note = document.createElement("span");
    note.className = "tile__note";
    note.textContent = tile.note;
    head.append(chipElement(tile.chip), name, note);
    const stage = document.createElement("div");
    stage.className = "tile__stage";
    card.append(head, stage);
    grid.append(card);
    instances.push(tile.mount(stage));
  }
  gallery.append(grid);
}

function addSection<T extends { readonly side: TeamSide }>(
  title: string,
  items: readonly T[],
  toTile: (item: T) => Tile,
): void {
  gallery.append(groupTitle(title));
  forEachSide(items, (side, matching) => {
    gallery.append(subTitle(side));
    addGrid(matching.map(toTile));
  });
}

// playground とは逆にプレーを先に置く。見つけたいのは線と配置のずれで、線はプレーにしか無い。
addSection("Plays", PLAY_PRESETS, playTile);
addSection("Formations", FORMATION_PRESETS, formationTile);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    for (const instance of instances) {
      instance.dispose();
    }
    gallery.replaceChildren();
  });
}
