import type { AIVisionResult } from "./wardrobe";

/** [ymin, xmin, ymax, xmax], integers 0–1000 relative to the whole image. */
export type Box2D = [number, number, number, number];

export interface DetectedItem {
  box: Box2D;
  result: AIVisionResult;
}

export interface DetectedPerson {
  box: Box2D;
  items: DetectedItem[];
}
