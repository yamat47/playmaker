export interface IIdFactory {
  /** Returns an unused id of the form `${prefix}-${n}` that is not in taken. */
  next(prefix: string, taken: ReadonlySet<string>): string;
}

/**
 * Issues ids from a counter per prefix. A number once used is never reused, even after the
 * element with that id is gone, so that an element restored by Undo does not collide with an
 * element added later.
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
