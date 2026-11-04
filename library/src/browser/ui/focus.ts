/**
 * Rebuilds the contents of container with update. If the focus that was in container before the
 * rebuild vanished along with a removed element, it is moved to fallback. Lost focus falls to body,
 * and keys would no longer reach the element that receives the shortcuts.
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
