import { describe, expect, it } from "vitest";
import {
  createEmptyPlayData,
  DEFAULT_FIELD_ZONE,
  isFieldZone,
  type PlayData,
  resolvePlayData,
} from "./play-data.js";

describe("createEmptyPlayData", () => {
  it("version 1 と既定ゾーンの新規データを返す", () => {
    const data = createEmptyPlayData();

    expect(data).toEqual({ version: 1, field: { zone: DEFAULT_FIELD_ZONE } });
  });

  it("呼ぶたびに独立したオブジェクトを返す（共有しない）", () => {
    const a = createEmptyPlayData();
    const b = createEmptyPlayData();

    expect(a).not.toBe(b);
    expect(a.field).not.toBe(b.field);
  });
});

describe("isFieldZone", () => {
  it("3 つの正規ゾーンを true と判定する", () => {
    expect(isFieldZone("middle")).toBe(true);
    expect(isFieldZone("redzone")).toBe(true);
    expect(isFieldZone("own-redzone")).toBe(true);
  });

  it("未知の文字列や非文字列を false と判定する", () => {
    expect(isFieldZone("center")).toBe(false);
    expect(isFieldZone("")).toBe(false);
    expect(isFieldZone(undefined)).toBe(false);
    expect(isFieldZone(0)).toBe(false);
    expect(isFieldZone({ zone: "middle" })).toBe(false);
  });
});

describe("resolvePlayData", () => {
  it("undefined には既定ゾーンの空データを返す", () => {
    expect(resolvePlayData(undefined)).toEqual({
      version: 1,
      field: { zone: DEFAULT_FIELD_ZONE },
    });
  });

  it("正当なゾーンはそのまま保持する", () => {
    const input: PlayData = { version: 1, field: { zone: "redzone" } };

    expect(resolvePlayData(input).field.zone).toBe("redzone");
  });

  it("入力を共有せず新規オブジェクトを返す（Model 専有）", () => {
    const input: PlayData = { version: 1, field: { zone: "own-redzone" } };

    const resolved = resolvePlayData(input);

    expect(resolved).not.toBe(input);
    expect(resolved.field).not.toBe(input.field);
    expect(resolved.field.zone).toBe("own-redzone");
  });

  it("不正・欠落したゾーンは既定へフォールバックする（古い永続データ耐性）", () => {
    const broken = { version: 1, field: { zone: "bogus" } } as unknown as PlayData;
    const missingField = { version: 1 } as unknown as PlayData;

    expect(resolvePlayData(broken).field.zone).toBe(DEFAULT_FIELD_ZONE);
    expect(resolvePlayData(missingField).field.zone).toBe(DEFAULT_FIELD_ZONE);
  });
});
