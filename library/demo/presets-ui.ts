// demo の 2 ページ（playground と一覧）で共有する部品。静的 HTML の要素の取得、プリセットの種類を
// 示すチップの文言と色、一覧の見出し。ライブラリはプリセットに色を持たせないので、見せ方はここで決める。
import type { PlayCategory, TeamSide } from "playmaker";

export function need<T extends HTMLElement>(id: string, type: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof type)) {
    throw new Error(`#${id} の ${type.name} が見つかりません`);
  }
  return el;
}

/** 種類を示すチップ。色はページの CSS 変数で持つ。 */
export interface Chip {
  readonly label: string;
  readonly color: string;
}

const CATEGORY_CHIPS: Record<PlayCategory, Chip> = {
  "run-zone": { label: "RUN", color: "var(--cat-run)" },
  "run-gap": { label: "RUN", color: "var(--cat-run)" },
  "pass-quick": { label: "PASS", color: "var(--cat-pass)" },
  "pass-dropback": { label: "PASS", color: "var(--cat-pass)" },
  "pass-deep": { label: "PASS", color: "var(--cat-pass)" },
  pa: { label: "PA", color: "var(--cat-pass)" },
  rpo: { label: "RPO", color: "var(--cat-rpo)" },
  coverage: { label: "COV", color: "var(--cat-cov)" },
  pressure: { label: "PRES", color: "var(--cat-pres)" },
};

const SIDE_CHIPS: Record<TeamSide, Chip> = {
  offense: { label: "OFF", color: "var(--off)" },
  defense: { label: "DEF", color: "var(--def)" },
};

export function categoryChip(category: PlayCategory): Chip {
  return CATEGORY_CHIPS[category];
}

export function sideChip(side: TeamSide): Chip {
  return SIDE_CHIPS[side];
}

export function chipElement(chip: Chip, className = ""): HTMLSpanElement {
  const el = document.createElement("span");
  el.className = `chip ${className}`.trim();
  el.textContent = chip.label;
  el.style.background = chip.color;
  return el;
}

export function groupTitle(text: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "group__title";
  el.textContent = text;
  return el;
}

export function subTitle(side: TeamSide): HTMLElement {
  const el = document.createElement("div");
  el.className = side === "offense" ? "group__sub group__sub--off" : "group__sub";
  el.textContent = side === "offense" ? "Offense" : "Defense";
  return el;
}

/** 攻守の順に、その側の項目だけを渡す。どちらかが空なら、その側は呼ばない。 */
export function forEachSide<T extends { readonly side: TeamSide }>(
  items: readonly T[],
  fn: (side: TeamSide, matching: readonly T[]) => void,
): void {
  for (const side of ["offense", "defense"] as const) {
    const matching = items.filter((item) => item.side === side);
    if (matching.length > 0) {
      fn(side, matching);
    }
  }
}
