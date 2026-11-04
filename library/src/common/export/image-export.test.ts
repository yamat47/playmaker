import { describe, expect, it } from "vitest";
import { fieldWindowAspect } from "../geometry/field.js";
import { FIELD_ZONE_VALUES } from "../model/play-data.js";
import {
  DEFAULT_EXPORT_WIDTH,
  type ImageExportOptions,
  MAX_EXPORT_WIDTH,
  resolveImageExportSize,
  resolveImageExportWidth,
} from "./image-export.js";

const IOS_SAFARI_MAX_CANVAS_AREA = 16_777_216;

describe("resolveImageExportWidth", () => {
  it("returns a positive integer unchanged", () => {
    expect(resolveImageExportWidth(1280)).toBe(1280);
  });

  it("rounds a fraction to the nearest integer", () => {
    expect(resolveImageExportWidth(1280.4)).toBe(1280);
    expect(resolveImageExportWidth(1280.6)).toBe(1281);
  });

  it("accepts the boundary value 1", () => {
    expect(resolveImageExportWidth(1)).toBe(1);
  });

  it("falls back to the default width when the width is omitted", () => {
    expect(resolveImageExportWidth(undefined)).toBe(DEFAULT_EXPORT_WIDTH);
  });

  it("falls back to the default width for values below 1 (zero and negative)", () => {
    expect(resolveImageExportWidth(0)).toBe(DEFAULT_EXPORT_WIDTH);
    expect(resolveImageExportWidth(-100)).toBe(DEFAULT_EXPORT_WIDTH);
  });

  it("falls back to the default width for non-finite values (NaN and Infinity)", () => {
    expect(resolveImageExportWidth(Number.NaN)).toBe(DEFAULT_EXPORT_WIDTH);
    expect(resolveImageExportWidth(Number.POSITIVE_INFINITY)).toBe(DEFAULT_EXPORT_WIDTH);
  });

  it("clamps a width above the limit to the limit", () => {
    expect(resolveImageExportWidth(MAX_EXPORT_WIDTH + 1)).toBe(MAX_EXPORT_WIDTH);
    expect(resolveImageExportWidth(100_000)).toBe(MAX_EXPORT_WIDTH);
  });

  it("returns a width exactly at the limit unchanged", () => {
    expect(resolveImageExportWidth(MAX_EXPORT_WIDTH)).toBe(MAX_EXPORT_WIDTH);
  });
});

describe("resolveImageExportSize", () => {
  it("derives the default size from the zone window aspect when no width is given", () => {
    const size = resolveImageExportSize("middle");

    expect(size.width).toBe(DEFAULT_EXPORT_WIDTH);
    expect(size.height).toBe(Math.round(DEFAULT_EXPORT_WIDTH / fieldWindowAspect("middle")));
  });

  it("derives the height from the given width and the zone window aspect", () => {
    const size = resolveImageExportSize("middle", { width: 1777 });

    expect(size.width).toBe(1777);
    expect(size.height).toBe(Math.round(1777 / fieldWindowAspect("middle")));
  });

  it("gives the taller redzone window a greater height at the same width", () => {
    const middle = resolveImageExportSize("middle", { width: 1600 });
    const redzone = resolveImageExportSize("redzone", { width: 1600 });

    expect(redzone.height).toBeGreaterThan(middle.height);
  });

  it("derives the height from the default width when the given width is invalid", () => {
    const options: ImageExportOptions = { width: -1 };

    const size = resolveImageExportSize("redzone", options);

    expect(size.width).toBe(DEFAULT_EXPORT_WIDTH);
    expect(size.height).toBe(Math.round(DEFAULT_EXPORT_WIDTH / fieldWindowAspect("redzone")));
  });

  it("fits every zone's image in the iOS Safari canvas area at the width limit", () => {
    for (const zone of FIELD_ZONE_VALUES) {
      const { width, height } = resolveImageExportSize(zone, { width: MAX_EXPORT_WIDTH });

      expect(width * height).toBeLessThanOrEqual(IOS_SAFARI_MAX_CANVAS_AREA);
    }
  });

  it("keeps the height at 1 or more for the minimum width 1", () => {
    const size = resolveImageExportSize("middle", { width: 1 });

    expect(size.width).toBe(1);
    expect(size.height).toBeGreaterThanOrEqual(1);
  });
});
