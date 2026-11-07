import {
  FieldGeometry,
  type ImageExportOptions,
  resolveImageExportSize,
  type SceneData,
} from "../../common/index.js";
import { loadFieldFont } from "../theme/field-font-face.js";
import type { ThemeReader } from "../theme/tokens.js";
import { paintLayers, renderFrameFor, type SurfaceLayers } from "./layer.js";

/**
 * Draws the diagram on a canvas of its own and returns it as a PNG (Blob). Only the diagram layers
 * are drawn, so the grid, selection highlight, and handles stay out. The colors are those of theme,
 * which the caller reads before this call, so a variable the host changes while the font loads does
 * not reach the image. Drawing waits for the bundled font, so numbers and labels use it even right
 * after construction. Rejects when a canvas cannot be obtained or the PNG conversion fails.
 */
export async function renderSceneToPng(
  scene: SceneData,
  theme: ThemeReader,
  layers: SurfaceLayers,
  options?: ImageExportOptions,
): Promise<Blob> {
  const { width, height } = resolveImageExportSize(scene.field.zone, options);
  await loadFieldFont();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Playmaker: could not get a 2D canvas context for the export.");
  }
  const geometry = new FieldGeometry(width, height, scene.field);
  paintLayers(ctx, layers, renderFrameFor(geometry, scene, theme));
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Playmaker: could not convert the canvas to a PNG."));
      }
    }, "image/png");
  });
}
