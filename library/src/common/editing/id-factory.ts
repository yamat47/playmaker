// 新規選手/線の安定 id を採番する（編集の追加操作で使う）。DOM 非依存の純ロジック。
// 既存 id 集合を渡して衝突を避ける。prefix ごとにカウンタを保持し、削除済み id を
// 再利用しない（Undo/Redo を跨いでも id が安定し、コマンドの参照が壊れない）。

/**
 * id 採番の IF。EditorController は具象でなくこれに依存し、テストで決定的な
 * フェイクへ差し替えられる（インターフェース抽出）。
 */
export interface IIdFactory {
  /** `${prefix}-${n}` 形式で、taken に無い未使用 id を返す。 */
  next(prefix: string, taken: ReadonlySet<string>): string;
}

/**
 * prefix ごとに単調増加するカウンタで id を払い出す。
 * カウンタは消費後も戻さない＝一度使った番号は（その id が後で消えても）再利用しない。
 * これにより同一セッション内で id が安定し、Undo で復活した要素とも衝突しない。
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
