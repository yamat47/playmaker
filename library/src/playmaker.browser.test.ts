import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { FORMATION_PRESETS, type PlayData, Playmaker, type PlaymakerOptions } from "./playmaker.js";
import { must } from "./test-support/must.js";

// 右に 200px のパネル、上にツールバーを置いても、canvas に選手を置ける広さが残る大きさ。
const CONTAINER_WIDTH = 800;
const CONTAINER_HEIGHT = 600;

// canvas の左上からの位置。どちらもゾーンの窓の中に収まる。
const SPOT = { x: 300, y: 250 };
const OTHER_SPOT = { x: 300, y: 120 };

const mounted: { container: HTMLElement; playmaker: Playmaker }[] = [];

afterEach(() => {
  for (const { container, playmaker } of mounted.splice(0)) {
    playmaker.dispose();
    container.remove();
  }
});

function mount(options?: PlaymakerOptions): { container: HTMLElement; playmaker: Playmaker } {
  const container = document.createElement("div");
  container.style.width = `${CONTAINER_WIDTH}px`;
  container.style.height = `${CONTAINER_HEIGHT}px`;
  document.body.appendChild(container);
  const playmaker = new Playmaker(container, options);
  const entry = { container, playmaker };
  mounted.push(entry);
  return entry;
}

function canvasIn(container: HTMLElement): HTMLCanvasElement {
  return must(container.querySelector("canvas"));
}

function button(name: string) {
  return page.getByRole("button", { name, exact: true });
}

/** 選手の追加ツールで canvas の SPOT をクリックし、選手を 1 人置く。 */
async function addPlayerAtSpot(container: HTMLElement): Promise<void> {
  await button("Add player").click();
  await userEvent.click(canvasIn(container), { position: SPOT });
}

describe("置く要素", () => {
  it("edit モードでは、canvas とツールバーとパネルを container に置く", () => {
    const { container } = mount();

    expect(container.querySelector("canvas")).not.toBeNull();
    expect(container.querySelector(".playmaker-toolbar")).not.toBeNull();
    expect(container.querySelector(".playmaker-panel")).not.toBeNull();
    expect(container.querySelector(".playmaker-root")).toHaveAttribute("lang", "en");
  });

  it("view モードでは、canvas だけを置き、ツールバーとパネルは置かない", () => {
    const { container } = mount({ mode: "view" });

    expect(container.querySelector("canvas")).not.toBeNull();
    expect(container.querySelector(".playmaker-toolbar")).toBeNull();
    expect(container.querySelector(".playmaker-panel")).toBeNull();
  });

  it("canvas の描画バッファを、表示される大きさと DPR に合わせて確保する", async () => {
    const { container } = mount();
    const canvas = canvasIn(container);

    await expect
      .poll(() => canvas.width)
      .toBe(Math.round(canvas.clientWidth * window.devicePixelRatio));
    expect(canvas.height).toBe(Math.round(canvas.clientHeight * window.devicePixelRatio));
  });

  it("dispose すると、container に置いた要素をすべて取り除く", () => {
    const { container, playmaker } = mount();

    playmaker.dispose();

    expect(container.childElementCount).toBe(0);
  });
});

describe("ポインタでの編集", () => {
  it("選手の追加ツールで canvas をクリックすると、選手を 1 人足して onChange を 1 回呼ぶ", async () => {
    const onChange = vi.fn<(data: PlayData) => void>();
    const { container } = mount({ onChange });

    await addPlayerAtSpot(container);

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.lastCall?.[0].players).toHaveLength(1);
  });

  it("選手を canvas の上の方へドラッグして離すと、選手をダウンフィールドへ動かす", async () => {
    const { container, playmaker } = mount();
    await addPlayerAtSpot(container);
    await button("Select").click();
    const before = must(playmaker.getPlayData().players[0]).position.downfieldYard;

    const canvas = canvasIn(container);
    await userEvent.dragAndDrop(canvas, canvas, {
      sourcePosition: SPOT,
      targetPosition: OTHER_SPOT,
    });

    expect(must(playmaker.getPlayData().players[0]).position.downfieldYard).toBeGreaterThan(before);
  });

  it("線を描くツールで選手から描き始め、ダブルクリックすると線を 1 本足す", async () => {
    const { container, playmaker } = mount();
    await addPlayerAtSpot(container);
    const canvas = canvasIn(container);

    await button("Draw line").click();
    await userEvent.click(canvas, { position: SPOT });
    await userEvent.dblClick(canvas, { position: OTHER_SPOT });

    expect(playmaker.getPlayData().lines).toHaveLength(1);
  });

  it("view モードに切り替えると、canvas をクリックしても選手を足さない", async () => {
    const { container, playmaker } = mount();
    await button("Add player").click();

    playmaker.setMode("view");
    await userEvent.click(canvasIn(container), { position: SPOT });

    expect(playmaker.getPlayData().players).toEqual([]);
  });
});

describe("キー操作", () => {
  it("canvas を押したあとで Ctrl+Z を押すと、直前の編集を取り消す", async () => {
    const { container, playmaker } = mount();
    await addPlayerAtSpot(container);

    await userEvent.keyboard("{Control>}z{/Control}");

    expect(playmaker.getPlayData().players).toEqual([]);
  });

  it("ツールバーのボタンを押した直後でも、Ctrl+Z で直前の編集を取り消す", async () => {
    const { container, playmaker } = mount();
    await addPlayerAtSpot(container);

    await button("Select").click();
    await userEvent.keyboard("{Control>}z{/Control}");

    expect(playmaker.getPlayData().players).toEqual([]);
  });
});

describe("ツールバー", () => {
  it("元に戻すボタンを押すと、直前の編集を取り消す", async () => {
    const { container, playmaker } = mount();
    await addPlayerAtSpot(container);

    await button("Undo").click();

    expect(playmaker.getPlayData().players).toEqual([]);
  });

  it("ゾーンのボタンを押すと、フィールドゾーンを切り替える", async () => {
    const { playmaker } = mount();

    await button("Own red zone").click();

    expect(playmaker.fieldZone).toBe("own-redzone");
  });

  it("フォーメーションを選ぶと、その隊形の選手を置く", async () => {
    const { playmaker } = mount();
    const formation = must(FORMATION_PRESETS[0]);

    await userEvent.selectOptions(page.getByRole("combobox", { name: "Formation" }), formation.id);

    expect(playmaker.getPlayData().players).toHaveLength(formation.players.length);
  });
});

describe("プロパティパネル", () => {
  it("選手を選んでラベルを書き換えると、その選手のラベルを変える", async () => {
    const { container, playmaker } = mount();
    await addPlayerAtSpot(container);

    await page.getByRole("textbox", { name: "Label" }).fill("QB");
    await userEvent.tab();

    expect(must(playmaker.getPlayData().players[0]).label).toBe("QB");
  });

  it("ラベルを確定して Tab で次の入力へ移ると、フォーカスは移った先に残る", async () => {
    const { container } = mount();
    await addPlayerAtSpot(container);

    await page.getByRole("textbox", { name: "Label" }).fill("QB");
    await userEvent.tab();

    expect(document.activeElement).toBe(page.getByRole("combobox", { name: "Shape" }).element());
  });

  it("色のスウォッチを押すと、選んでいる選手にテーマの色と塗りを入れる", async () => {
    const { container, playmaker } = mount();
    await addPlayerAtSpot(container);

    await page.getByRole("button", { name: "Red solid" }).click();

    expect(playmaker.getPlayData().players[0]).toMatchObject({ color: "#d32f2f", fill: "solid" });
  });

  it("祖先の要素で選手の既定色を変えて refresh すると、その色の枠線のスウォッチが押された状態になる", async () => {
    const { container, playmaker } = mount();
    await addPlayerAtSpot(container);

    container.style.setProperty("--playmaker-player-color", "#d32f2f");
    playmaker.refresh();

    expect(page.getByRole("button", { name: "Red outline" }).element()).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(page.getByRole("button", { name: "Black outline" }).element()).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});

describe("locale", () => {
  it("shows the toolbar in Japanese and marks the root as Japanese when the locale is ja", () => {
    const { container } = mount({ locale: "ja" });

    expect(container.querySelector(".playmaker-root")).toHaveAttribute("lang", "ja");
    expect(button("選手を追加").element()).toBeInTheDocument();
  });
});

describe("読み直し", () => {
  it("setPlayData で読み直したあとも、ツールバーとポインタで編集できる", async () => {
    const { container, playmaker } = mount();

    playmaker.setPlayData(playmaker.getPlayData());
    await addPlayerAtSpot(container);

    expect(playmaker.getPlayData().players).toHaveLength(1);
  });

  it("ツールバーにフォーカスがあるときに読み直すと、フォーカスを canvas へ移す", async () => {
    const { container, playmaker } = mount();
    await button("Select").click();

    playmaker.setPlayData(playmaker.getPlayData());

    expect(document.activeElement).toBe(canvasIn(container));
  });
});

describe("PNG の書き出し", () => {
  it("exportToPng を呼ぶと、PNG の Blob を返す", async () => {
    const { playmaker } = mount();

    const blob = await playmaker.exportToPng();

    expect(blob.type).toBe("image/png");
  });
});
