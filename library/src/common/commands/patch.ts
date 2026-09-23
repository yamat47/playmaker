type OptionalKeys<T> = {
  [K in keyof T]-?: Record<never, never> extends Pick<T, K> ? K : never;
}[keyof T];

/**
 * 指定したキーだけを差し替えるパッチ。指定しないキーは今の値を保つ。
 * 省略できるキーだけは null を指定でき、値を消して既定に戻す。
 */
export type Patch<T> = {
  readonly [K in keyof T]?: K extends OptionalKeys<T> ? T[K] | null : T[K];
};

// Line や Player はインターフェースなので添字シグネチャを持たず、そのままではキーを文字列で引けない。
// パッチの規則をキーの一覧に依らず 1 か所に書くため、この 2 関数の中だけ見方を変える。
function asRecord(value: object): Readonly<Record<string, unknown>> {
  return value as Record<string, unknown>;
}

/** current にパッチを当てた新しいオブジェクトを返す。current は書き換えない。 */
export function applyPatch<T extends object>(current: T, patch: Patch<T>): T {
  const next = { ...asRecord(current) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete next[key];
    } else {
      next[key] = value;
    }
  }
  // パッチの値は Patch<T> で T の各キーの型に揃っているので、当てた結果も T になる。
  return next as T;
}

/** パッチを当てると、current から何か 1 つでも値が変わるか。オブジェクトの値は参照で比べる。 */
export function patchChangesAnything<T extends object>(current: T, patch: Patch<T>): boolean {
  const values = asRecord(current);
  return Object.entries(patch).some(([key, value]) => (value ?? undefined) !== values[key]);
}
