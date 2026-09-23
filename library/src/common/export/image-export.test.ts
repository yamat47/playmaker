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
  it("正の整数はそのまま返す", () => {
    expect(resolveImageExportWidth(1280)).toBe(1280);
  });

  it("小数は整数へ丸める", () => {
    expect(resolveImageExportWidth(1280.4)).toBe(1280);
    expect(resolveImageExportWidth(1280.6)).toBe(1281);
  });

  it("境界値 1 は許容する", () => {
    expect(resolveImageExportWidth(1)).toBe(1);
  });

  it("未指定なら既定幅に丸める", () => {
    expect(resolveImageExportWidth(undefined)).toBe(DEFAULT_EXPORT_WIDTH);
  });

  it("1 未満（0・負）は既定幅に丸める", () => {
    expect(resolveImageExportWidth(0)).toBe(DEFAULT_EXPORT_WIDTH);
    expect(resolveImageExportWidth(-100)).toBe(DEFAULT_EXPORT_WIDTH);
  });

  it("非有限値（NaN・Infinity）は既定幅に丸める", () => {
    expect(resolveImageExportWidth(Number.NaN)).toBe(DEFAULT_EXPORT_WIDTH);
    expect(resolveImageExportWidth(Number.POSITIVE_INFINITY)).toBe(DEFAULT_EXPORT_WIDTH);
  });

  it("上限を超える幅は上限に切り詰める", () => {
    expect(resolveImageExportWidth(MAX_EXPORT_WIDTH + 1)).toBe(MAX_EXPORT_WIDTH);
    expect(resolveImageExportWidth(100_000)).toBe(MAX_EXPORT_WIDTH);
  });

  it("上限ちょうどの幅はそのまま返す", () => {
    expect(resolveImageExportWidth(MAX_EXPORT_WIDTH)).toBe(MAX_EXPORT_WIDTH);
  });
});

describe("resolveImageExportSize", () => {
  it("幅指定なし（省略）なら既定幅とゾーン窓のアスペクト比由来の高さを返す", () => {
    const size = resolveImageExportSize("middle");

    expect(size.width).toBe(DEFAULT_EXPORT_WIDTH);
    expect(size.height).toBe(Math.round(DEFAULT_EXPORT_WIDTH / fieldWindowAspect("middle")));
  });

  it("指定幅からゾーン窓のアスペクト比で高さを導く", () => {
    const size = resolveImageExportSize("middle", { width: 1777 });

    expect(size.width).toBe(1777);
    expect(size.height).toBe(Math.round(1777 / fieldWindowAspect("middle")));
  });

  it("縦長なレッドゾーン窓は同じ幅でも高さが大きくなる", () => {
    const middle = resolveImageExportSize("middle", { width: 1600 });
    const redzone = resolveImageExportSize("redzone", { width: 1600 });

    expect(redzone.height).toBeGreaterThan(middle.height);
  });

  it("不正な幅は既定へ丸めたうえで高さを導く", () => {
    const options: ImageExportOptions = { width: -1 };

    const size = resolveImageExportSize("redzone", options);

    expect(size.width).toBe(DEFAULT_EXPORT_WIDTH);
    expect(size.height).toBe(Math.round(DEFAULT_EXPORT_WIDTH / fieldWindowAspect("redzone")));
  });

  it("上限の幅で書き出しても、どのゾーンの画像も iOS の Safari が描ける面積に収まる", () => {
    for (const zone of FIELD_ZONE_VALUES) {
      const { width, height } = resolveImageExportSize(zone, { width: MAX_EXPORT_WIDTH });

      expect(width * height).toBeLessThanOrEqual(IOS_SAFARI_MAX_CANVAS_AREA);
    }
  });

  it("最小幅 1 でも高さは 1 以上になる", () => {
    const size = resolveImageExportSize("middle", { width: 1 });

    expect(size.width).toBe(1);
    expect(size.height).toBeGreaterThanOrEqual(1);
  });
});
