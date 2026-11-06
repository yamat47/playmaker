/**
 * A button that leaves the focus where it was when pressed with a pointer, usually on the canvas.
 * Focused, the button would take Enter and Space for itself, so Enter pressed to finish a line
 * would press the button again. Tab still reaches the button.
 */
export function createButton(
  className: string,
  text: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  button.addEventListener("mousedown", (e) => e.preventDefault());
  button.addEventListener("click", onClick);
  return button;
}

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
