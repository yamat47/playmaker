import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { type PlayData, Playmaker, type PlaymakerOptions } from "./playmaker.js";
import { must } from "./test-support/must.js";

// Big enough to leave room for players on the canvas beside the 200px panel and the toolbar.
const CONTAINER_WIDTH = 800;
const CONTAINER_HEIGHT = 600;

// Positions from the top-left corner of the canvas. Both fall inside the zone's window.
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

/** Clicks SPOT on the canvas with the Add player tool, placing one player. */
async function addPlayerAtSpot(container: HTMLElement): Promise<void> {
  await button("Add player").click();
  await userEvent.click(canvasIn(container), { position: SPOT });
}

describe("Placed elements", () => {
  it("places the canvas, the toolbar, and the panel in the container in edit mode", () => {
    const { container } = mount();

    expect(container.querySelector("canvas")).not.toBeNull();
    expect(container.querySelector(".playmaker-toolbar")).not.toBeNull();
    expect(container.querySelector(".playmaker-panel")).not.toBeNull();
    expect(container.querySelector(".playmaker-root")).toHaveAttribute("lang", "en");
  });

  it("places only the canvas in view mode, without the toolbar or the panel", () => {
    const { container } = mount({ mode: "view" });

    expect(container.querySelector("canvas")).not.toBeNull();
    expect(container.querySelector(".playmaker-toolbar")).toBeNull();
    expect(container.querySelector(".playmaker-panel")).toBeNull();
  });

  it("sizes the canvas drawing buffer to the displayed size times the DPR", async () => {
    const { container } = mount();
    const canvas = canvasIn(container);

    await expect
      .poll(() => canvas.width)
      .toBe(Math.round(canvas.clientWidth * window.devicePixelRatio));
    expect(canvas.height).toBe(Math.round(canvas.clientHeight * window.devicePixelRatio));
  });

  it("removes every element placed in the container on dispose", () => {
    const { container, playmaker } = mount();

    playmaker.dispose();

    expect(container.childElementCount).toBe(0);
  });
});

describe("Pointer editing", () => {
  it("adds one player and calls onChange once when the canvas is clicked with Add player", async () => {
    const onChange = vi.fn<(data: PlayData) => void>();
    const { container } = mount({ onChange });

    await addPlayerAtSpot(container);

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.lastCall?.[0].players).toHaveLength(1);
  });

  it("moves the player downfield when it is dragged up the canvas and released", async () => {
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

  it("adds one line when Draw line starts at a player and ends with a double-click", async () => {
    const { container, playmaker } = mount();
    await addPlayerAtSpot(container);
    const canvas = canvasIn(container);

    await button("Draw line").click();
    await userEvent.click(canvas, { position: SPOT });
    await userEvent.dblClick(canvas, { position: OTHER_SPOT });

    expect(playmaker.getPlayData().lines).toHaveLength(1);
  });

  it("adds no player on a canvas click after switching to view mode", async () => {
    const { container, playmaker } = mount();
    await button("Add player").click();

    playmaker.setMode("view");
    await userEvent.click(canvasIn(container), { position: SPOT });

    expect(playmaker.getPlayData().players).toEqual([]);
  });
});

describe("Keyboard", () => {
  it("undoes the last edit when Ctrl+Z is pressed after a click on the canvas", async () => {
    const { container, playmaker } = mount();
    await addPlayerAtSpot(container);

    await userEvent.keyboard("{Control>}z{/Control}");

    expect(playmaker.getPlayData().players).toEqual([]);
  });

  it("deletes the selected player when Delete is pressed after a click on the canvas", async () => {
    const { container, playmaker } = mount();
    await addPlayerAtSpot(container);

    await userEvent.keyboard("{Delete}");

    expect(playmaker.getPlayData().players).toEqual([]);
  });

  it("finishes the line with Enter after Undo is clicked mid-drawing", async () => {
    const { container, playmaker } = mount();
    await addPlayerAtSpot(container);
    const canvas = canvasIn(container);
    await button("Draw line").click();
    await userEvent.click(canvas, { position: SPOT });
    await userEvent.click(canvas, { position: { x: 360, y: 200 } });
    await userEvent.click(canvas, { position: OTHER_SPOT });

    await button("Undo").click();
    await userEvent.keyboard("{Enter}");

    expect(playmaker.getPlayData().lines).toHaveLength(1);
    expect(must(playmaker.getPlayData().lines[0]).waypoints).toEqual([]);
  });

  it("undoes the last edit with Ctrl+Z right after a toolbar button is pressed", async () => {
    const { container, playmaker } = mount();
    await addPlayerAtSpot(container);

    await button("Select").click();
    await userEvent.keyboard("{Control>}z{/Control}");

    expect(playmaker.getPlayData().players).toEqual([]);
  });
});

describe("Toolbar", () => {
  it("undoes the last edit when the Undo button is pressed", async () => {
    const { container, playmaker } = mount();
    await addPlayerAtSpot(container);

    await button("Undo").click();

    expect(playmaker.getPlayData().players).toEqual([]);
  });

  it("switches the field zone when a zone button is pressed", async () => {
    const { playmaker } = mount();

    await button("Own red zone").click();

    expect(playmaker.fieldZone).toBe("own-redzone");
  });
});

describe("Property panel", () => {
  it("changes the label of the selected player when the label is rewritten", async () => {
    const { container, playmaker } = mount();
    await addPlayerAtSpot(container);

    await page.getByRole("textbox", { name: "Label" }).fill("QB");
    await userEvent.tab();

    expect(must(playmaker.getPlayData().players[0]).label).toBe("QB");
  });

  it("keeps focus on the next input when the label is committed with Tab", async () => {
    const { container } = mount();
    await addPlayerAtSpot(container);

    await page.getByRole("textbox", { name: "Label" }).fill("QB");
    await userEvent.tab();

    expect(document.activeElement).toBe(page.getByRole("combobox", { name: "Shape" }).element());
  });

  it("gives the selected player the theme color and fill when a swatch is pressed", async () => {
    const { container, playmaker } = mount();
    await addPlayerAtSpot(container);

    await page.getByRole("button", { name: "Red solid" }).click();

    expect(playmaker.getPlayData().players[0]).toMatchObject({ color: "#d32f2f", fill: "solid" });
  });

  it("marks the outline swatch of the player color set on an ancestor as pressed after refresh", async () => {
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

describe("Locale", () => {
  it("shows the toolbar in Japanese and marks the root as Japanese when the locale is ja", () => {
    const { container } = mount({ locale: "ja" });

    expect(container.querySelector(".playmaker-root")).toHaveAttribute("lang", "ja");
    expect(button("選手を追加").element()).toBeInTheDocument();
  });
});

describe("Reload", () => {
  it("still edits with the toolbar and pointer after a reload with setPlayData", async () => {
    const { container, playmaker } = mount();

    playmaker.setPlayData(playmaker.getPlayData());
    await addPlayerAtSpot(container);

    expect(playmaker.getPlayData().players).toHaveLength(1);
  });

  it("moves focus to the canvas when a reload happens while the toolbar has focus", () => {
    const { container, playmaker } = mount();
    button("Select").element().focus();

    playmaker.setPlayData(playmaker.getPlayData());

    expect(document.activeElement).toBe(canvasIn(container));
  });
});

describe("PNG export", () => {
  it("returns a PNG Blob from exportToPng", async () => {
    const { playmaker } = mount();

    const blob = await playmaker.exportToPng();

    expect(blob.type).toBe("image/png");
  });
});
