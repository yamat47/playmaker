import { describe, expect, it } from "vitest";
import { FIELD_WIDTH_YARDS, ZONE_WINDOW_LENGTH_YARDS } from "../geometry/field.js";
import {
  DEFAULT_EXPORT_WIDTH,
  FIELD_WINDOW_ASPECT,
  type ImageExportOptions,
  resolveImageExportSize,
  resolveImageExportWidth,
} from "./image-export.js";

describe("FIELD_WINDOW_ASPECT", () => {
  it("フィールド窓（幅 / 縦 30yd）の比に一致する", () => {
    expect(FIELD_WINDOW_ASPECT).toBe(FIELD_WIDTH_YARDS / ZONE_WINDOW_LENGTH_YARDS);
  });
});

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
});

describe("resolveImageExportSize", () => {
  it("幅指定なし（引数省略）なら既定幅とアスペクト比由来の高さを返す", () => {
    const size = resolveImageExportSize();

    expect(size.width).toBe(DEFAULT_EXPORT_WIDTH);
    expect(size.height).toBe(Math.round(DEFAULT_EXPORT_WIDTH / FIELD_WINDOW_ASPECT));
  });

  it("指定幅からフィールド窓のアスペクト比で高さを導く", () => {
    const size = resolveImageExportSize({ width: 1777 });

    expect(size.width).toBe(1777);
    expect(size.height).toBe(Math.round(1777 / FIELD_WINDOW_ASPECT));
  });

  it("不正な幅は既定へ丸めたうえで高さを導く", () => {
    const options: ImageExportOptions = { width: -1 };

    const size = resolveImageExportSize(options);

    expect(size.width).toBe(DEFAULT_EXPORT_WIDTH);
    expect(size.height).toBe(Math.round(DEFAULT_EXPORT_WIDTH / FIELD_WINDOW_ASPECT));
  });

  it("最小幅 1 でも高さは 1 以上になる", () => {
    const size = resolveImageExportSize({ width: 1 });

    expect(size.width).toBe(1);
    expect(size.height).toBeGreaterThanOrEqual(1);
  });
});
