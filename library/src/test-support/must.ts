/** noUncheckedIndexedAccess や null を返す API の戻り値を、`!` を使わずに絞る。 */
export function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("expected a defined value");
  }
  return value;
}
