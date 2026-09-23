import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { FIELD_ZONE_LABELS, FORMATION_PRESETS } from "../playmaker.js";
import { mountPlaymaker } from "../test-support/dom/mount-playmaker.js";
import { twoPlayersWithRoute } from "../test-support/fixtures.js";
import { must } from "../test-support/must.js";
import { yd } from "../test-support/play-driver.js";

describe("ポインタでの編集", () => {
  it("選手をドラッグして離すと、離した位置へ動かす", async () => {
    const { playmaker, drag } = mountPlaymaker({ initialData: twoPlayersWithRoute() });

    await drag(yd(10, 0), yd(14, 4));

    const moved = must(playmaker.getPlayData().players[0]).position;
    expect(moved.lateralYard).toBeCloseTo(14, 1);
    expect(moved.downfieldYard).toBeCloseTo(4, 1);
  });

  it("選手をドラッグして離すと、動かした図を渡して onChange を 1 回だけ呼ぶ", async () => {
    const { playmaker, onChange, drag } = mountPlaymaker({ initialData: twoPlayersWithRoute() });

    await drag(yd(10, 0), yd(14, 4));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(playmaker.getPlayData());
  });

  it("選手の追加ボタンを押してフィールドをクリックすると、そこに選手を足す", async () => {
    const { playmaker, click } = mountPlaymaker({ initialData: twoPlayersWithRoute() });

    await page.getByRole("button", { name: "選手を追加" }).click();
    await click(yd(30, -5));

    const added = must(playmaker.getPlayData().players.at(-1)).position;
    expect(added.lateralYard).toBeCloseTo(30, 1);
    expect(added.downfieldYard).toBeCloseTo(-5, 1);
  });

  it("線を描くボタンを押し、選手から点を打ってダブルクリックすると、線を足す", async () => {
    const { playmaker, canvas, at, click } = mountPlaymaker({ initialData: twoPlayersWithRoute() });

    await page.getByRole("button", { name: "線を描く" }).click();
    await click(yd(20, 0));
    await userEvent.dblClick(canvas, { position: at(yd(24, 8)) });

    expect(playmaker.getPlayData().lines.map((l) => l.startPlayerId)).toEqual(["a", "b"]);
  });
});

describe("ツールバーとキーでの編集", () => {
  it("選手を選んで削除ボタンを押すと、その選手を消す", async () => {
    const { playmaker, click } = mountPlaymaker({ initialData: twoPlayersWithRoute() });
    await click(yd(20, 0));

    await page.getByRole("button", { name: "削除" }).click();

    expect(playmaker.getPlayData().players.map((p) => p.id)).toEqual(["a"]);
  });

  it("ゾーンのボタンを押すと、図のゾーンを切り替える", async () => {
    const { playmaker } = mountPlaymaker({ initialData: twoPlayersWithRoute() });

    await page.getByRole("button", { name: FIELD_ZONE_LABELS.redzone }).click();

    expect(playmaker.fieldZone).toBe("redzone");
  });

  it("フォーメーションを選ぶと、その隊形の選手を図に足す", async () => {
    const { playmaker } = mountPlaymaker({ initialData: twoPlayersWithRoute() });
    const formation = must(FORMATION_PRESETS[0]);

    await page.getByRole("combobox", { name: "フォーメーション" }).selectOptions(formation.id);

    expect(playmaker.getPlayData().players).toHaveLength(2 + formation.players.length);
  });

  it("元に戻すボタンは、戻す編集が無いあいだは無効になる", async () => {
    mountPlaymaker({ initialData: twoPlayersWithRoute() });

    await expect
      .element(page.getByRole("button", { name: "元に戻す" }))
      .toHaveAttribute("aria-disabled", "true");
  });

  it("canvas で Ctrl+Z を押すと、直前の編集を元に戻す", async () => {
    const { playmaker, drag } = mountPlaymaker({ initialData: twoPlayersWithRoute() });
    await drag(yd(10, 0), yd(14, 4));

    await userEvent.keyboard("{Control>}z{/Control}");

    expect(playmaker.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("選手を選んでパネルのラベルを書き換えると、その選手のラベルが変わる", async () => {
    const { playmaker, click } = mountPlaymaker({ initialData: twoPlayersWithRoute() });
    await click(yd(20, 0));

    await userEvent.fill(page.getByLabelText("ラベル"), "QB");
    await userEvent.keyboard("{Enter}");

    expect(playmaker.getPlayData().players.map((p) => p.label)).toEqual(["a", "QB"]);
  });
});
