export type NodeKind = "note" | "text" | "shape" | "image" | "cube";
export type ImageMimeType =
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "image/gif";
export const IMAGE_MIME_TYPES: readonly ImageMimeType[] = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];
export interface ImageAsset {
  id: string;
  kind: "image";
  name: string;
  mimeType: ImageMimeType;
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
}
export interface CubeAnimation {
  speed: number;
  direction: "clockwise" | "counterclockwise";
  axis: "x" | "y" | "z" | "xy";
  paused: boolean;
  perspective: number;
}
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
  assetId?: string;
  animation?: CubeAnimation;
}
export interface CanvasDocument {
  schemaVersion: 2;
  id: string;
  title: string;
  nodes: CanvasNode[];
  assets: ImageAsset[];
}
export const MAX_NODES = 2000;
export const MAX_ASSETS = 100;
export const MAX_FILE_BYTES = 12_000_000;
export const MAX_IMAGE_BYTES = 2_000_000;

const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const string = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length <= max;
const number = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const integer = (v: unknown, min: number, max: number): v is number =>
  number(v, min, max) && Number.isInteger(v);
const keys = (v: Record<string, unknown>, allowed: string[]) =>
  Object.keys(v).every((k) => allowed.includes(k));

function migrateLegacyDocument(value: unknown): unknown {
  if (!object(value) || value.schemaVersion !== 1) return value;
  if (
    !keys(value, ["schemaVersion", "id", "title", "nodes"]) ||
    !Array.isArray(value.nodes)
  )
    throw new Error("Invalid legacy document.");
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
      !["note", "text", "shape"].includes(String(node.kind))
    )
      throw new Error("Invalid legacy object.");
  }
  return {
    ...structuredClone(value),
    schemaVersion: 2,
    assets: [],
  };
}

function validateImageAsset(value: unknown): value is ImageAsset {
  if (
    !object(value) ||
    !keys(value, [
      "id",
      "kind",
      "name",
      "mimeType",
      "dataUrl",
      "width",
      "height",
      "bytes",
    ]) ||
    !string(value.id, 100) ||
    !value.id ||
    value.kind !== "image" ||
    !string(value.name, 200) ||
    !IMAGE_MIME_TYPES.includes(value.mimeType as ImageMimeType) ||
    !string(value.dataUrl, 2_700_000) ||
    !integer(value.width, 1, 20_000) ||
    !integer(value.height, 1, 20_000) ||
    !integer(value.bytes, 1, MAX_IMAGE_BYTES)
  )
    return false;

  const prefix = `data:${value.mimeType};base64,`;
  if (!value.dataUrl.startsWith(prefix)) return false;
  const encoded = value.dataUrl.slice(prefix.length);
  if (!encoded || /[^A-Za-z0-9+/=]/.test(encoded)) return false;
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  const decodedBytes = Math.floor((encoded.length * 3) / 4) - padding;
  return decodedBytes === value.bytes;
}

function validateAnimation(value: unknown): value is CubeAnimation {
  return (
    object(value) &&
    keys(value, ["speed", "direction", "axis", "paused", "perspective"]) &&
    number(value.speed, 5, 360) &&
    ["clockwise", "counterclockwise"].includes(String(value.direction)) &&
    ["x", "y", "z", "xy"].includes(String(value.axis)) &&
    typeof value.paused === "boolean" &&
    number(value.perspective, 300, 1400)
  );
}

export function validateDocument(input: unknown): CanvasDocument {
  const value = migrateLegacyDocument(input);
  if (!object(value) || value.schemaVersion !== 2)
    throw new Error(
      "Unsupported document version. The original file has not been changed.",
    );
  if (
    !keys(value, ["schemaVersion", "id", "title", "nodes", "assets"]) ||
    !string(value.id, 100) ||
    !value.id ||
    !string(value.title, 200) ||
    !Array.isArray(value.nodes) ||
    value.nodes.length > MAX_NODES ||
    !Array.isArray(value.assets) ||
    value.assets.length > MAX_ASSETS
  )
    throw new Error("Invalid document, node limit, or asset limit exceeded.");

  const assetIds = new Set<string>();
  for (const asset of value.assets) {
    if (!validateImageAsset(asset) || assetIds.has(asset.id))
      throw new Error(
        "Invalid image asset. Import canceled without replacing your work.",
      );
    assetIds.add(asset.id);
  }

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
        "assetId",
        "animation",
      ]) ||
      !string(node.id, 100) ||
      !node.id ||
      ids.has(node.id) ||
      !["note", "text", "shape", "image", "cube"].includes(String(node.kind)) ||
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

    if (node.kind === "image") {
      if (
        !string(node.assetId, 100) ||
        !node.assetId ||
        !assetIds.has(node.assetId) ||
        node.animation !== undefined
      )
        throw new Error("Image object references a missing or invalid asset.");
    } else if (node.kind === "cube") {
      if (node.assetId !== undefined || !validateAnimation(node.animation))
        throw new Error("Cube object has invalid animation settings.");
    } else if (node.assetId !== undefined || node.animation !== undefined)
      throw new Error("Object contains fields that do not apply to its type.");

    ids.add(node.id);
  }

  return structuredClone(value) as unknown as CanvasDocument;
}

export function parseDocument(text: string): CanvasDocument {
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES)
    throw new Error("Document exceeds the 12 MB import limit.");
  return validateDocument(JSON.parse(text));
}

export const emptyDocument = (): CanvasDocument => ({
  schemaVersion: 2,
  id: crypto.randomUUID(),
  title: "Untitled workspace",
  nodes: [],
  assets: [],
});
