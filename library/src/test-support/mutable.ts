type DeepMutable<T> = T extends readonly (infer U)[]
  ? DeepMutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
    : T;

/**
 * 読み取り専用の型を外す。型では書き換えられない値でも、JavaScript の利用者は書き換えられるので、
 * 防御的なコピーを確かめるテストで入力や戻り値を書き換えるのに使う。
 */
export function mutable<T>(value: T): DeepMutable<T> {
  return value as DeepMutable<T>;
}
