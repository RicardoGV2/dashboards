import type {
  CanvasNode,
  CubeAnimation,
  NodeKind,
} from "../document/index.ts";

export type CreateableNodeKind = Exclude<NodeKind, "image">;

export interface WidgetDefinition {
  label: string;
  color: string;
  width: number;
  height: number;
}

export const widgets: Record<CreateableNodeKind, WidgetDefinition> = {
  note: { label: "Note", color: "#fcf0bc", width: 260, height: 210 },
  text: { label: "Text", color: "#ffffff", width: 320, height: 160 },
  shape: { label: "Shape", color: "#dfece8", width: 240, height: 180 },
  cube: { label: "Cube", color: "#7a73d8", width: 300, height: 260 },
};

export const defaultCubeAnimation = (): CubeAnimation => ({
  speed: 45,
  direction: "clockwise",
  axis: "xy",
  paused: false,
  perspective: 700,
});

export function createNode(
  kind: CreateableNodeKind,
  x: number,
  y: number,
): CanvasNode {
  const w = widgets[kind];
  const node: CanvasNode = {
    id: crypto.randomUUID(),
    kind,
    x,
    y,
    width: w.width,
    height: w.height,
    color: w.color,
    title: w.label,
    text: "",
  };
  if (kind === "cube") node.animation = defaultCubeAnimation();
  return node;
}

export function createImageNode(
  assetId: string,
  title: string,
  x: number,
  y: number,
  width: number,
  height: number,
): CanvasNode {
  return {
    id: crypto.randomUUID(),
    kind: "image",
    x,
    y,
    width,
    height,
    color: "#ffffff",
    title: title.slice(0, 200) || "Image",
    text: "",
    assetId,
  };
}
