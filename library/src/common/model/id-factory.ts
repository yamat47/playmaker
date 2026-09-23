export interface IIdFactory {
  /** `${prefix}-${n}` 形式で、taken に無い未使用 id を返す。 */
  next(prefix: string, taken: ReadonlySet<string>): string;
}

/**
 * prefix ごとのカウンタで id を払い出す。一度使った番号は、その id の要素が消えても使い直さない。
 * 消した要素を Undo で戻したとき、あとから足した要素と id がぶつからないようにするため。
 */
export class IdFactory implements IIdFactory {
  private readonly counters = new Map<string, number>();

  next(prefix: string, taken: ReadonlySet<string>): string {
    let n = this.counters.get(prefix) ?? 0;
    let id: string;
    do {
      n += 1;
      id = `${prefix}-${n}`;
    } while (taken.has(id));
    this.counters.set(prefix, n);
    return id;
  }
}
