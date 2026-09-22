export type NodeKind = "note" | "text" | "shape" | "image" | "cube" | "finance";

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

export type FinanceRole = "person" | "bank" | "source" | "destination";

export interface FinanceNodeData {
  role: FinanceRole;
  sceneId: string;
  icon: string;
  ownerId?: string;
  brand?: string;
  category?: string;
  amountCents?: number;
  currency?: "EUR";
  cadence?: "monthly" | "weekly" | "one-off";
  expanded?: boolean;
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
  finance?: FinanceNodeData;
}

export type ConnectionKind =
  | "structure"
  | "incoming"
  | "outgoing"
  | "transfer"
  | "shared";

export interface CanvasConnection {
  id: string;
  from: string;
  to: string;
  kind: ConnectionKind;
  label: string;
  animated: boolean;
  amountCents?: number;
  currency?: "EUR";
}

export interface CanvasDocument {
  schemaVersion: 3;
  id: string;
  title: string;
  nodes: CanvasNode[];
  assets: ImageAsset[];
  connections: CanvasConnection[];
}

export const MAX_NODES = 2000;
export const MAX_CONNECTIONS = 5000;
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

function migrateLegacyDocument(input: unknown): unknown {
  if (!object(input)) return input;

  if (input.schemaVersion === 1) {
    if (
      !keys(input, ["schemaVersion", "id", "title", "nodes"]) ||
      !Array.isArray(input.nodes)
    )
      throw new Error("Invalid legacy document.");
    for (const node of input.nodes) {
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
      ...structuredClone(input),
      schemaVersion: 3,
      assets: [],
      connections: [],
    };
  }

  if (input.schemaVersion === 2) {
    if (
      !keys(input, ["schemaVersion", "id", "title", "nodes", "assets"]) ||
      !Array.isArray(input.nodes) ||
      !Array.isArray(input.assets)
    )
      throw new Error("Invalid version 2 document.");
    return {
      ...structuredClone(input),
      schemaVersion: 3,
      connections: [],
    };
  }

  return input;
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

function validateFinance(value: unknown): value is FinanceNodeData {
  if (
    !object(value) ||
    !keys(value, [
      "role",
      "sceneId",
      "icon",
      "ownerId",
      "brand",
      "category",
      "amountCents",
      "currency",
      "cadence",
      "expanded",
    ]) ||
    !["person", "bank", "source", "destination"].includes(String(value.role)) ||
    !string(value.sceneId, 100) ||
    !value.sceneId ||
    !string(value.icon, 24) ||
    !value.icon
  )
    return false;

  if (
    value.ownerId !== undefined &&
    (!string(value.ownerId, 100) || !value.ownerId)
  )
    return false;
  if (value.brand !== undefined && !string(value.brand, 100)) return false;
  if (value.category !== undefined && !string(value.category, 100))
    return false;
  if (
    value.amountCents !== undefined &&
    !integer(value.amountCents, -100_000_000_000, 100_000_000_000)
  )
    return false;
  if (value.currency !== undefined && value.currency !== "EUR") return false;
  if (
    value.cadence !== undefined &&
    !["monthly", "weekly", "one-off"].includes(String(value.cadence))
  )
    return false;
  if (value.expanded !== undefined && typeof value.expanded !== "boolean")
    return false;
  if (value.role === "person" && value.ownerId !== undefined) return false;
  if (value.role !== "person" && value.expanded !== undefined) return false;
  return true;
}

function validateConnection(
  value: unknown,
  nodeIds: Set<string>,
): value is CanvasConnection {
  if (
    !object(value) ||
    !keys(value, [
      "id",
      "from",
      "to",
      "kind",
      "label",
      "animated",
      "amountCents",
      "currency",
    ]) ||
    !string(value.id, 100) ||
    !value.id ||
    !string(value.from, 100) ||
    !string(value.to, 100) ||
    !nodeIds.has(value.from) ||
    !nodeIds.has(value.to) ||
    value.from === value.to ||
    !["structure", "incoming", "outgoing", "transfer", "shared"].includes(
      String(value.kind),
    ) ||
    !string(value.label, 120) ||
    typeof value.animated !== "boolean"
  )
    return false;

  if (
    value.amountCents !== undefined &&
    !integer(value.amountCents, -100_000_000_000, 100_000_000_000)
  )
    return false;
  if (value.currency !== undefined && value.currency !== "EUR") return false;
  return true;
}

export function validateDocument(input: unknown): CanvasDocument {
  const value = migrateLegacyDocument(input);
  if (!object(value) || value.schemaVersion !== 3)
    throw new Error(
      "Unsupported document version. The original file has not been changed.",
    );

  if (
    !keys(value, [
      "schemaVersion",
      "id",
      "title",
      "nodes",
      "assets",
      "connections",
    ]) ||
    !string(value.id, 100) ||
    !value.id ||
    !string(value.title, 200) ||
    !Array.isArray(value.nodes) ||
    value.nodes.length > MAX_NODES ||
    !Array.isArray(value.assets) ||
    value.assets.length > MAX_ASSETS ||
    !Array.isArray(value.connections) ||
    value.connections.length > MAX_CONNECTIONS
  )
    throw new Error(
      "Invalid document, node limit, connection limit, or asset limit exceeded.",
    );

  const assetIds = new Set<string>();
  for (const asset of value.assets) {
    if (!validateImageAsset(asset) || assetIds.has(asset.id))
      throw new Error(
        "Invalid image asset. Import canceled without replacing your work.",
      );
    assetIds.add(asset.id);
  }

  const ids = new Set<string>();
  const financeOwnerRefs: Array<{ id: string; ownerId: string }> = [];
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
        "finance",
      ]) ||
      !string(node.id, 100) ||
      !node.id ||
      ids.has(node.id) ||
      !["note", "text", "shape", "image", "cube", "finance"].includes(
        String(node.kind),
      ) ||
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
        node.animation !== undefined ||
        node.finance !== undefined
      )
        throw new Error("Image object references a missing or invalid asset.");
    } else if (node.kind === "cube") {
      if (
        node.assetId !== undefined ||
        !validateAnimation(node.animation) ||
        node.finance !== undefined
      )
        throw new Error("Cube object has invalid animation settings.");
    } else if (node.kind === "finance") {
      if (
        node.assetId !== undefined ||
        node.animation !== undefined ||
        !validateFinance(node.finance)
      )
        throw new Error("Finance object has invalid visual metadata.");
      if (node.finance.ownerId)
        financeOwnerRefs.push({ id: node.id, ownerId: node.finance.ownerId });
    } else if (
      node.assetId !== undefined ||
      node.animation !== undefined ||
      node.finance !== undefined
    )
      throw new Error("Object contains fields that do not apply to its type.");

    ids.add(node.id);
  }

  const personIds = new Set(
    value.nodes
      .filter(
        (node): node is CanvasNode =>
          object(node) &&
          node.kind === "finance" &&
          object(node.finance) &&
          node.finance.role === "person",
      )
      .map((node) => node.id),
  );
  for (const ref of financeOwnerRefs)
    if (!personIds.has(ref.ownerId))
      throw new Error(
        `Finance object ${ref.id} references a missing person owner.`,
      );

  const connectionIds = new Set<string>();
  for (const connection of value.connections) {
    if (
      !validateConnection(connection, ids) ||
      connectionIds.has(connection.id)
    )
      throw new Error(
        "Invalid connection. Import canceled without replacing your work.",
      );
    connectionIds.add(connection.id);
  }

  return structuredClone(value) as unknown as CanvasDocument;
}

export function parseDocument(text: string): CanvasDocument {
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES)
    throw new Error("Document exceeds the 12 MB import limit.");
  return validateDocument(JSON.parse(text));
}

export const emptyDocument = (): CanvasDocument => ({
  schemaVersion: 3,
  id: crypto.randomUUID(),
  title: "Untitled workspace",
  nodes: [],
  assets: [],
  connections: [],
});
