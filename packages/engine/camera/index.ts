export interface Point {
  x: number;
  y: number;
}
export interface Camera extends Point {
  zoom: number;
}
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
export const WORLD_LIMIT = 1_000_000;
export const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
export const screenToWorld = (p: Point, c: Camera): Point => ({
  x: p.x / c.zoom + c.x,
  y: p.y / c.zoom + c.y,
});
export const worldToScreen = (p: Point, c: Camera): Point => ({
  x: (p.x - c.x) * c.zoom,
  y: (p.y - c.y) * c.zoom,
});
export function zoomAt(c: Camera, anchor: Point, requested: number): Camera {
  const world = screenToWorld(anchor, c);
  const zoom = clamp(requested, MIN_ZOOM, MAX_ZOOM);
  return { x: world.x - anchor.x / zoom, y: world.y - anchor.y / zoom, zoom };
}
export function pan(c: Camera, delta: Point): Camera {
  return {
    ...c,
    x: clamp(c.x - delta.x / c.zoom, -WORLD_LIMIT, WORLD_LIMIT),
    y: clamp(c.y - delta.y / c.zoom, -WORLD_LIMIT, WORLD_LIMIT),
  };
}
