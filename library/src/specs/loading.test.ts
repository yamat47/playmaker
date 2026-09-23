import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { mountPlaymaker } from "../test-support/dom/mount-playmaker.js";
import { playData, player, twoPlayersWithRoute } from "../test-support/fixtures.js";
import { must } from "../test-support/must.js";
import { yd } from "../test-support/play-driver.js";

describe("図の読み込み", () => {
  it("setPlayData で読み直すと、元に戻すボタンは無効に戻る", async () => {
    const { playmaker } = mountPlaymaker({ initialData: twoPlayersWithRoute() });
    playmaker.setFieldZone("redzone");

    playmaker.setPlayData(twoPlayersWithRoute());

    await expect
      .element(page.getByRole("button", { name: "元に戻す" }))
      .toHaveAttribute("aria-disabled", "true");
  });

  it("setPlayData で読み直したあとも、読み込んだ図の選手をドラッグで動かせる", async () => {
    const { playmaker, drag } = mountPlaymaker({ initialData: twoPlayersWithRoute() });
    playmaker.setPlayData(playData([player("c", 30, 5)]));

    await drag(yd(30, 5), yd(34, 9));

    expect(must(playmaker.getPlayData().players[0]).position.lateralYard).toBeCloseTo(34, 1);
  });
});

describe("PNG の書き出し", () => {
  it("今の図を PNG の Blob にして返す", async () => {
    const { playmaker } = mountPlaymaker({ initialData: twoPlayersWithRoute() });

    const blob = await playmaker.exportToPng();

    expect(blob.type).toBe("image/png");
  });
});
