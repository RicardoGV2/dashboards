import type { CanvasNode, NodeKind } from "../document/index.ts";
export interface WidgetDefinition {
  label: string;
  color: string;
  width: number;
  height: number;
}
export const widgets: Record<NodeKind, WidgetDefinition> = {
  note: { label: "Note", color: "#fcf0bc", width: 260, height: 210 },
  text: { label: "Text", color: "#ffffff", width: 320, height: 160 },
  shape: { label: "Shape", color: "#dfece8", width: 240, height: 180 },
};
export function createNode(kind: NodeKind, x: number, y: number): CanvasNode {
  const w = widgets[kind];
  return {
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
}
