export type NodeKind = "note" | "text" | "shape";
export interface CanvasNode {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  text: string;
  color: string;
}
export interface CanvasDocument {
  schemaVersion: 1;
  id: string;
  title: string;
  nodes: CanvasNode[];
}
export const MAX_NODES = 2000;
export const MAX_FILE_BYTES = 5_000_000;
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const string = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length <= max;
const number = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const keys = (v: Record<string, unknown>, allowed: string[]) =>
  Object.keys(v).every((k) => allowed.includes(k));
export function validateDocument(value: unknown): CanvasDocument {
  if (!object(value) || value.schemaVersion !== 1)
    throw new Error(
      "Unsupported document version. The original file has not been changed.",
    );
  if (
    !keys(value, ["schemaVersion", "id", "title", "nodes"]) ||
    !string(value.id, 100) ||
    !value.id ||
    !string(value.title, 200) ||
    !Array.isArray(value.nodes) ||
    value.nodes.length > MAX_NODES
  )
    throw new Error("Invalid document or node limit exceeded.");
  const ids = new Set<string>();
  for (const node of value.nodes) {
    if (
      !object(node) ||
      !keys(node, [
        "id",
        "kind",
        "x",
        "y",
        "width",
        "height",
        "title",
        "text",
        "color",
      ]) ||
      !string(node.id, 100) ||
      !node.id ||
      ids.has(node.id) ||
      !["note", "text", "shape"].includes(String(node.kind)) ||
      !number(node.x, -1e6, 1e6) ||
      !number(node.y, -1e6, 1e6) ||
      !number(node.width, 80, 4000) ||
      !number(node.height, 60, 4000) ||
      !string(node.title, 200) ||
      !string(node.text, 20000) ||
      !string(node.color, 7) ||
      !/^#[0-9a-f]{6}$/i.test(node.color)
    )
      throw new Error(
        "Invalid or unsupported object. Import canceled without replacing your work.",
      );
    ids.add(node.id);
  }
  return structuredClone(value) as unknown as CanvasDocument;
}
export function parseDocument(text: string): CanvasDocument {
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES)
    throw new Error("Document exceeds the 5 MB import limit.");
  return validateDocument(JSON.parse(text));
}
export const emptyDocument = (): CanvasDocument => ({
  schemaVersion: 1,
  id: crypto.randomUUID(),
  title: "Untitled workspace",
  nodes: [],
});
