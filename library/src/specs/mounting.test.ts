import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { mountPlaymaker } from "../test-support/dom/mount-playmaker.js";
import { twoPlayersWithRoute } from "../test-support/fixtures.js";
import { yd } from "../test-support/play-driver.js";

describe("構築", () => {
  it("構築すると、container の中に図を描く canvas を置く", () => {
    const { container } = mountPlaymaker();

    expect(container.querySelector(".playmaker-root canvas")).not.toBeNull();
  });

  it("edit モードでは、ツールバーとプロパティパネルを置く", () => {
    const { container } = mountPlaymaker();

    expect(container.querySelector(".playmaker-toolbar")).not.toBeNull();
    expect(container.querySelector(".playmaker-panel")).not.toBeNull();
  });

  it("view モードでは、ツールバーもプロパティパネルも置かない", () => {
    const { container } = mountPlaymaker({ mode: "view" });

    expect(container.querySelector(".playmaker-toolbar")).toBeNull();
    expect(container.querySelector(".playmaker-panel")).toBeNull();
  });
});

describe("モードの切替", () => {
  it("view モードでは、選手をドラッグしても図を変えない", async () => {
    const { playmaker, drag } = mountPlaymaker({
      mode: "view",
      initialData: twoPlayersWithRoute(),
    });

    await drag(yd(10, 0), yd(14, 4));

    expect(playmaker.getPlayData()).toEqual(twoPlayersWithRoute());
  });

  it("view に切り替えて edit に戻しても、切り替える前の編集を元に戻せる", async () => {
    const { playmaker } = mountPlaymaker({ initialData: twoPlayersWithRoute() });
    playmaker.setFieldZone("redzone");
    playmaker.setMode("view");
    playmaker.setMode("edit");

    await page.getByRole("button", { name: "元に戻す" }).click();

    expect(playmaker.fieldZone).toBe("middle");
  });
});

describe("破棄", () => {
  it("dispose すると、置いた要素を container からすべて取り除く", () => {
    const { playmaker, container } = mountPlaymaker();

    playmaker.dispose();

    expect(container.childElementCount).toBe(0);
  });

  it("dispose したあとに変更しても、例外を投げず図も変えない", () => {
    const { playmaker } = mountPlaymaker({ initialData: twoPlayersWithRoute() });
    playmaker.dispose();

    playmaker.setFieldZone("redzone");

    expect(playmaker.getPlayData()).toEqual(twoPlayersWithRoute());
  });
});
