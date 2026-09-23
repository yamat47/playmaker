/**
 * update で container の中身を作り直す。作り直す前に container の中にあったフォーカスが
 * 取り除かれた要素と一緒に消えたら、fallback へ移す。消えたフォーカスは body へ落ち、
 * ショートカットを受けている要素にキーが届かなくなるため。
 */
export function replaceKeepingFocus(
  container: HTMLElement,
  fallback: HTMLElement,
  update: () => void,
): void {
  const doc = container.ownerDocument;
  const hadFocus = container.contains(doc.activeElement);
  update();
  if (hadFocus && !container.contains(doc.activeElement)) {
    fallback.focus({ preventScroll: true });
  }
}
