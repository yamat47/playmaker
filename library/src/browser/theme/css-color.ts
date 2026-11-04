/** A 2D context just to read colors. Failing to get one is remembered too, so it is not retried. */
type ColorContext =
  | { readonly status: "unresolved" }
  | { readonly status: "unavailable" }
  | { readonly status: "ready"; readonly ctx: CanvasRenderingContext2D };

let context: ColorContext = { status: "unresolved" };

function resolveContext(): ColorContext {
  if (context.status === "unresolved") {
    const ctx = document.createElement("canvas").getContext("2d");
    context = ctx === null ? { status: "unavailable" } : { status: "ready", ctx };
  }
  return context;
}

/**
 * Normalizes a CSS color to the format that canvas fillStyle returns.
 * The same color in any notation gives the same string. Opaque colors become lowercase `#rrggbb`.
 * A value that is not a color gives undefined. Without a 2D context, the value is returned as is.
 */
export function normalizeCssColor(value: string): string | undefined {
  const resolved = resolveContext();
  if (resolved.status !== "ready") {
    return value;
  }
  const { ctx } = resolved;
  // Assigning an unreadable value leaves fillStyle at its previous value.
  // Assign twice from different colors; if the results agree, the value was read as a color.
  ctx.fillStyle = "#000000";
  ctx.fillStyle = value;
  const fromBlack = ctx.fillStyle;
  ctx.fillStyle = "#ffffff";
  ctx.fillStyle = value;
  return typeof fromBlack === "string" && ctx.fillStyle === fromBlack ? fromBlack : undefined;
}
