import "./style.css";
import {
  clamp,
  pan,
  screenToWorld,
  zoomAt,
} from "../../packages/engine/camera/index.ts";
import type { Camera, Point } from "../../packages/engine/camera/index.ts";
import {
  emptyDocument,
  parseDocument,
  MAX_FILE_BYTES,
  MAX_IMAGE_BYTES,
  IMAGE_MIME_TYPES,
} from "../../packages/document/index.ts";
import type {
  CanvasConnection,
  CanvasDocument,
  CanvasNode,
  CubeAnimation,
  ImageAsset,
  ImageMimeType,
} from "../../packages/document/index.ts";
import { History } from "../../packages/engine/history/index.ts";
import type { Command } from "../../packages/engine/history/index.ts";
import {
  renderConnections,
  renderNodes,
} from "../../packages/engine/renderer/index.ts";
import { createImageNode, createNode } from "../../packages/widgets/index.ts";
import type { CreateableNodeKind } from "../../packages/widgets/index.ts";
import { createFinanceDemo } from "../../packages/finance/index.ts";
import * as storage from "../../packages/storage/index.ts";
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const viewport = $("viewport");
let history = new History(emptyDocument());
let camera: Camera = { x: 0, y: 0, zoom: 1 };
let selected: string | null = null;
let tool: "select" | "pan" = "select";
let ready = false,
  canSave = false,
  frame = 0,
  space = false;
let preview: CanvasNode | null = null;

interface PlacementDraft {
  label: string;
  nodes: CanvasNode[];
  connections: CanvasConnection[];
  assets: ImageAsset[];
  selectId: string;
}

let placement: PlacementDraft | null = null;
let placementPointer: number | null = null;
let undoToastTimer = 0;
let saveQueue: Promise<void> = Promise.resolve();
let saveRevision = 0;
const pointers = new Map<number, Point>();
type Gesture =
  | {
      type: "pan" | "move" | "resize";
      start: Point;
      camera: Camera;
      node?: CanvasNode;
    }
  | { type: "pinch"; distance: number; anchor: Point; camera: Camera };
let gesture: Gesture | null = null;
const size = (): Point => ({
  x: viewport.clientWidth,
  y: viewport.clientHeight,
});
const point = (e: PointerEvent | WheelEvent): Point => {
  const r = viewport.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function visibleNodes(document: CanvasDocument): CanvasNode[] {
  const expanded = new Map(
    document.nodes
      .filter(
        (node) => node.kind === "finance" && node.finance?.role === "person",
      )
      .map((node) => [node.id, node.finance?.expanded !== false]),
  );
  return document.nodes.filter((node) => {
    if (node.kind !== "finance" || node.finance?.role === "person") return true;
    if (!node.finance?.ownerId) return true;
    return expanded.get(node.finance.ownerId) !== false;
  });
}

function visibleConnections(document: CanvasDocument, nodes: CanvasNode[]) {
  const visible = new Set(nodes.map((node) => node.id));
  return document.connections.filter(
    (connection) => visible.has(connection.from) && visible.has(connection.to),
  );
}

function placementBounds(nodes: CanvasNode[]) {
  return {
    minX: Math.min(...nodes.map((node) => node.x)),
    minY: Math.min(...nodes.map((node) => node.y)),
    maxX: Math.max(...nodes.map((node) => node.x + node.width)),
    maxY: Math.max(...nodes.map((node) => node.y + node.height)),
  };
}

function movePlacementTo(target: Point) {
  if (!placement?.nodes.length) return;
  const bounds = placementBounds(placement.nodes);
  const center = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
  const dx = clamp(
    target.x - center.x,
    -1e6 - bounds.minX,
    1e6 - bounds.maxX,
  );
  const dy = clamp(
    target.y - center.y,
    -1e6 - bounds.minY,
    1e6 - bounds.maxY,
  );
  placement = {
    ...placement,
    nodes: placement.nodes.map((node) => ({
      ...node,
      x: node.x + dx,
      y: node.y + dy,
    })),
  };
  scheduleRender();
}

function clearPlacementUi() {
  document.body.classList.remove("placement-mode");
  document
    .querySelectorAll<HTMLElement>(".is-placing")
    .forEach((element) => element.classList.remove("is-placing"));
  $("placement-hint").hidden = true;
}

function cancelPlacement(message = "Placement canceled") {
  if (!placement) return;
  placement = null;
  placementPointer = null;
  clearPlacementUi();
  status(message);
  scheduleRender();
}

function startPlacement(draft: PlacementDraft, sourceSelector: string) {
  if (!ready) return;
  cancelGesture();
  if (
    placement &&
    placement.label === draft.label &&
    document.querySelector(sourceSelector)?.classList.contains("is-placing")
  ) {
    status("Already placing this item. Move it and click to confirm.");
    return;
  }
  placement = draft;
  placementPointer = null;
  selected = null;
  document.body.classList.add("placement-mode");
  document
    .querySelectorAll<HTMLElement>(".is-placing")
    .forEach((element) => element.classList.remove("is-placing"));
  document.querySelector<HTMLElement>(sourceSelector)?.classList.add("is-placing");
  $("placement-title").textContent = `Place ${draft.label}`;
  $("placement-copy").textContent =
    "Move the preview, then click or drag-and-release to place";
  $("placement-hint").hidden = false;
  status("Preview only · move it, then click to place · Esc cancels");
  scheduleRender();
}

function hideUndoToast() {
  window.clearTimeout(undoToastTimer);
  $("action-toast").hidden = true;
}

function showUndoToast(label: string) {
  window.clearTimeout(undoToastTimer);
  $("action-toast-copy").textContent = `${label} placed`;
  $("action-toast").hidden = false;
  undoToastTimer = window.setTimeout(hideUndoToast, 7000);
}

function commitPlacement() {
  if (!placement) return;
  const draft = placement;
  try {
    history.execute([
      ...draft.assets.map(
        (asset): Command => ({ type: "createAsset", asset }),
      ),
      ...draft.nodes.map((node): Command => ({ type: "create", node })),
      ...draft.connections.map(
        (connection): Command => ({ type: "createConnection", connection }),
      ),
    ]);
    placement = null;
    placementPointer = null;
    clearPlacementUi();
    selected = draft.selectId;
    changed();
    showUndoToast(draft.label);
  } catch (error) {
    status((error as Error).message, true);
    scheduleRender();
  }
}
function status(message: string, error = false) {
  $("status").textContent = message;
  $("status").classList.toggle("error", error);
}
function scheduleRender() {
  if (!frame)
    frame = requestAnimationFrame(() => {
      frame = 0;
      render();
    });
}
function render() {
  const doc = history.document;
  const committedNodes = preview
    ? doc.nodes.map((node) => (node.id === preview!.id ? preview! : node))
    : doc.nodes;
  const draftNodes = placement?.nodes ?? [];
  const draftConnections = placement?.connections ?? [];
  const draftAssets = placement?.assets ?? [];
  const projectedDoc: CanvasDocument = {
    ...doc,
    nodes: [...committedNodes, ...draftNodes],
    connections: [...doc.connections, ...draftConnections],
    assets: [...doc.assets, ...draftAssets],
  };
  const nodes = visibleNodes(projectedDoc);
  const previewIds = new Set(draftNodes.map((node) => node.id));
  const financeMode = projectedDoc.nodes.some((node) => node.kind === "finance");

  renderConnections(
    $("connections") as unknown as SVGSVGElement,
    visibleConnections(projectedDoc, nodes),
    nodes,
    camera,
    previewIds,
  );
  renderNodes(
    $("nodes"),
    nodes,
    projectedDoc.assets,
    camera,
    size(),
    placement ? null : selected,
  );

  if (previewIds.size)
    for (const element of document.querySelectorAll<HTMLElement>("#nodes [data-id]"))
      if (previewIds.has(element.dataset.id ?? ""))
        element.classList.add("placement-preview");

  document.body.classList.toggle("finance-mode", financeMode);
  $("flow-banner").hidden = !financeMode;
  $("flow-legend").hidden = !financeMode;

  const step = 24 * camera.zoom * (camera.zoom < 0.3 ? 5 : 1);
  viewport.style.backgroundSize = `${step}px ${step}px`;
  viewport.style.backgroundPosition = `${-camera.x * camera.zoom}px ${-camera.y * camera.zoom}px`;
  $("zoom").textContent = `${Math.round(camera.zoom * 100)}%`;
  $("welcome").hidden = projectedDoc.nodes.length > 0;
  $("count").textContent = placement
    ? `${doc.nodes.length} object${doc.nodes.length === 1 ? "" : "s"} · placing ${placement.label}`
    : `${doc.nodes.length} object${doc.nodes.length === 1 ? "" : "s"}`;
  ($("undo") as HTMLButtonElement).disabled = !history.canUndo && !placement;
  ($("redo") as HTMLButtonElement).disabled = !history.canRedo;
}

function renderFinanceDetails(node: CanvasNode, doc: CanvasDocument) {
  const host = $("finance-details");
  host.replaceChildren();
  host.hidden = node.kind !== "finance";
  if (node.kind !== "finance" || !node.finance) return;

  const finance = node.finance;
  const heading = document.createElement("div");
  heading.className = "finance-inspector-heading";
  const role = document.createElement("span");
  role.className = "finance-role-pill";
  role.textContent = finance.role;
  const scene = document.createElement("span");
  scene.className = "finance-demo-pill";
  scene.textContent = "Visual demo";
  heading.append(role, scene);
  host.append(heading);

  const addRow = (label: string, value: string, tone = "") => {
    const row = document.createElement("div");
    row.className = `finance-inspector-row ${tone}`;
    const name = document.createElement("span");
    name.textContent = label;
    const amount = document.createElement("strong");
    amount.textContent = value;
    row.append(name, amount);
    host.append(row);
  };

  if (finance.role === "person") {
    const owned = doc.nodes.filter(
      (item) => item.kind === "finance" && item.finance?.ownerId === node.id,
    );
    const banks = owned.filter((item) => item.finance?.role === "bank");
    const income = owned
      .filter((item) => item.finance?.role === "source")
      .reduce((sum, item) => sum + (item.finance?.amountCents ?? 0), 0);
    const spending = owned
      .filter(
        (item) =>
          item.finance?.role === "destination" &&
          (item.finance?.amountCents ?? 0) < 0,
      )
      .reduce((sum, item) => sum + Math.abs(item.finance?.amountCents ?? 0), 0);
    const balance = banks.reduce(
      (sum, item) => sum + (item.finance?.amountCents ?? 0),
      0,
    );
    addRow("Total balance", formatMoney(balance), "positive");
    addRow("Monthly income", formatMoney(income), "positive");
    addRow("Mapped spending", formatMoney(spending), "negative");

    const section = document.createElement("div");
    section.className = "finance-inspector-section";
    const title = document.createElement("strong");
    title.textContent = `Banks (${banks.length})`;
    section.append(title);
    for (const bank of banks) {
      const item = document.createElement("div");
      item.className = "finance-bank-row";
      const badge = document.createElement("span");
      badge.className = "mini-bank-badge";
      badge.textContent = bank.finance?.icon ?? "B";
      const copy = document.createElement("span");
      copy.textContent = `${bank.title} · ${bank.text}`;
      const value = document.createElement("strong");
      value.textContent = formatMoney(bank.finance?.amountCents ?? 0);
      item.append(badge, copy, value);
      section.append(item);
    }
    host.append(section);

    const hint = document.createElement("p");
    hint.className = "finance-inspector-hint";
    hint.textContent =
      finance.expanded === false
        ? "Utilities are collapsed. Expand this person on the canvas to reveal banks and money flows."
        : "This reusable person module can later host banks, tasks, notes, calendars, goals and other utilities.";
    host.append(hint);
    return;
  }

  if (finance.amountCents !== undefined)
    addRow(
      finance.role === "bank" ? "Balance" : "Movement",
      formatMoney(finance.amountCents),
      finance.amountCents >= 0 ? "positive" : "negative",
    );
  if (finance.brand) addRow("Institution", finance.brand);
  if (finance.category) addRow("Category", finance.category);
  if (finance.cadence) addRow("Cadence", finance.cadence);
}
function refreshInspector() {
  const doc = history.document;
  const nodes = visibleNodes(doc);
  const node = nodes.find((n) => n.id === selected);
  if (!node) selected = null;
  $("inspector").hidden = !node;
  $("aside-empty").hidden = nodes.length > 0;

  const fragment = document.createDocumentFragment();
  const icons: Record<CanvasNode["kind"], string> = {
    note: "▤",
    text: "T",
    shape: "□",
    image: "▧",
    cube: "◇",
    finance: "◉",
  };
  for (const n of nodes) {
    const button = document.createElement("button");
    button.textContent = `${icons[n.kind]}  ${n.title || n.kind}`;
    button.setAttribute("aria-pressed", String(n.id === selected));
    button.onclick = () => {
      select(n.id);
      const s = size();
      camera = {
        ...camera,
        x: n.x + n.width / 2 - s.x / (2 * camera.zoom),
        y: n.y + n.height / 2 - s.y / (2 * camera.zoom),
      };
      scheduleRender();
      $("title").focus();
    };
    fragment.append(button);
  }
  $("object-list").replaceChildren(fragment);

  const contentField = $("content-field");
  contentField.hidden = !node || node.kind === "cube";
  $("content-label").textContent =
    node?.kind === "image" ? "Description / alt text" : "Content";
  const colorField = document.querySelector<HTMLElement>(".color-label");
  if (colorField) colorField.hidden = !node || node.kind === "image";

  renderFinanceDetails(node ?? ({} as CanvasNode), doc);

  const imageInfo = $("image-info");
  imageInfo.hidden = node?.kind !== "image";
  if (node?.kind === "image") {
    const asset = doc.assets.find((item) => item.id === node.assetId);
    imageInfo.textContent = asset
      ? `${asset.name} · ${asset.width}×${asset.height}px · ${Math.round(asset.bytes / 1024)} KB`
      : "Image asset unavailable";
  } else imageInfo.textContent = "";

  const animationControls = $("animation-controls");
  animationControls.hidden = node?.kind !== "cube";
  if (node?.kind === "cube" && node.animation) {
    const animation = node.animation;
    $<HTMLInputElement>("animation-speed").value = String(animation.speed);
    $("animation-speed-value").textContent = `${animation.speed}°/s`;
    $<HTMLSelectElement>("animation-direction").value = animation.direction;
    $<HTMLSelectElement>("animation-axis").value = animation.axis;
    $<HTMLInputElement>("animation-perspective").value = String(
      animation.perspective,
    );
    $("animation-perspective-value").textContent = `${animation.perspective}px`;
    $<HTMLInputElement>("animation-paused").checked = animation.paused;
    $("animation-state").textContent = animation.paused ? "Paused" : "Running";
  }

  if (node)
    for (const key of [
      "title",
      "text",
      "x",
      "y",
      "width",
      "height",
      "color",
    ] as const)
      $<HTMLInputElement>(key).value = String(node[key]);
  scheduleRender();
}
function select(id: string | null) {
  selected = id;
  refreshInspector();
}
function changed() {
  refreshInspector();
  if (!canSave) {
    status("Autosave unavailable. Export to keep your changes.", true);
    return;
  }
  const snapshot = history.document;
  const revision = ++saveRevision;
  status("Saving…");
  saveQueue = saveQueue
    .then(() => storage.save(snapshot))
    .then(() => {
      if (revision === saveRevision) status("Saved on this device");
    })
    .catch(() => {
      status("Save failed. Export now to keep your changes.", true);
    });
}
function execute(commands: Command[]) {
  if (!ready) return;
  try {
    history.execute(commands);
    changed();
  } catch (error) {
    status((error as Error).message, true);
    refreshInspector();
  }
}
function add(kind: CreateableNodeKind) {
  if (!ready) return;
  const viewportSize = size();
  const p = screenToWorld(
    { x: viewportSize.x / 2, y: viewportSize.y / 2 },
    camera,
  );
  const node = createNode(
    kind,
    clamp(p.x - 130, -1e6, 1e6),
    clamp(p.y - 100, -1e6, 1e6),
  );
  startPlacement(
    {
      label: node.title,
      nodes: [node],
      connections: [],
      assets: [],
      selectId: node.id,
    },
    `[data-add="${kind}"]`,
  );
}

function focusNodes(nodes: CanvasNode[]) {
  if (!nodes.length) return;
  const s = size();
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));
  const zoom = clamp(
    Math.min(
      (s.x - 90) / Math.max(maxX - minX, 1),
      (s.y - 90) / Math.max(maxY - minY, 1),
    ),
    0.1,
    1.1,
  );
  camera = {
    x: (minX + maxX) / 2 - s.x / (2 * zoom),
    y: (minY + maxY) / 2 - s.y / (2 * zoom),
    zoom,
  };
  scheduleRender();
}

function addFinanceDemo() {
  if (!ready) return;
  if (placement?.label === "Finance map") {
    status("Finance preview is already active. Move it and click to place.");
    return;
  }
  const viewportSize = size();
  const center = screenToWorld(
    { x: viewportSize.x / 2, y: viewportSize.y / 2 },
    camera,
  );
  const scene = createFinanceDemo(center.x, center.y);
  startPlacement(
    {
      label: "Finance map",
      nodes: scene.nodes,
      connections: scene.connections,
      assets: [],
      selectId: scene.personIds[0],
    },
    "#add-finance",
  );
  focusNodes(scene.nodes);
}

function readImageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Could not read image."));
    reader.onerror = () =>
      reject(reader.error ?? new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
}

function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The selected file is not a readable image."));
    };
    image.src = url;
  });
}

async function addImage(file: File) {
  if (!ready) return;
  if (!IMAGE_MIME_TYPES.includes(file.type as ImageMimeType))
    throw new Error("Use PNG, JPEG, WebP, or GIF images.");
  if (file.size < 1 || file.size > MAX_IMAGE_BYTES)
    throw new Error("Images must be 2 MB or smaller.");

  const [dataUrl, dimensions] = await Promise.all([
    readImageDataUrl(file),
    readImageSize(file),
  ]);
  const asset: ImageAsset = {
    id: crypto.randomUUID(),
    kind: "image",
    name: (file.name || "Image").slice(0, 200),
    mimeType: file.type as ImageMimeType,
    dataUrl,
    width: dimensions.width,
    height: dimensions.height,
    bytes: file.size,
  };

  const scale = Math.min(1, 520 / dimensions.width, 360 / dimensions.height);
  const width = Math.max(80, Math.round(dimensions.width * scale));
  const height = Math.max(60, Math.round(dimensions.height * scale));
  const viewportSize = size();
  const center = screenToWorld(
    { x: viewportSize.x / 2, y: viewportSize.y / 2 },
    camera,
  );
  const node = createImageNode(
    asset.id,
    asset.name,
    clamp(center.x - width / 2, -1e6, 1e6),
    clamp(center.y - height / 2, -1e6, 1e6),
    width,
    height,
  );
  startPlacement(
    {
      label: "Image",
      nodes: [node],
      connections: [],
      assets: [asset],
      selectId: node.id,
    },
    "#add-image",
  );
}

function deleteSelected() {
  if (!selected) return;
  const doc = history.document;
  const node = doc.nodes.find((item) => item.id === selected);
  if (!node) return;

  const commands: Command[] = [];
  if (node.kind === "finance" && node.finance?.role === "person") {
    for (const child of doc.nodes.filter(
      (item) => item.kind === "finance" && item.finance?.ownerId === node.id,
    ))
      commands.push({ type: "delete", id: child.id });
  }
  commands.push({ type: "delete", id: node.id });

  if (
    node.kind === "image" &&
    node.assetId &&
    !doc.nodes.some(
      (item) => item.id !== node.id && item.assetId === node.assetId,
    )
  )
    commands.push({ type: "deleteAsset", id: node.assetId });

  selected = null;
  execute(commands);
}

function updateCubeAnimation(patch: Partial<CubeAnimation>) {
  if (!selected) return;
  const node = history.document.nodes.find((item) => item.id === selected);
  if (node?.kind !== "cube" || !node.animation) return;
  execute([
    {
      type: "update",
      id: node.id,
      patch: { animation: { ...node.animation, ...patch } },
    },
  ]);
}

function setTool(value: typeof tool) {
  tool = value;
  $("select").setAttribute("aria-pressed", String(value === "select"));
  $("hand").setAttribute("aria-pressed", String(value === "pan"));
  viewport.classList.toggle("panning", value === "pan");
}
function fit() {
  focusNodes(visibleNodes(history.document));
}
function cancelGesture() {
  pointers.clear();
  gesture = null;
  preview = null;
  scheduleRender();
}
function startPinch() {
  const [a, b] = [...pointers.values()];
  preview = null;
  gesture = {
    type: "pinch",
    distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
    anchor: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    camera: { ...camera },
  };
}
viewport.addEventListener("pointerdown", (e) => {
  if (
    !ready ||
    (e.target as HTMLElement).closest("button") ||
    (e.button !== 0 && e.button !== 1)
  )
    return;
  e.preventDefault();
  viewport.focus({ preventScroll: true });
  viewport.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, point(e));
  if (pointers.size >= 2) {
    startPinch();
    return;
  }
  const target = (e.target as HTMLElement).closest<HTMLElement>("[data-id]");
  const node = history.document.nodes.find((n) => n.id === target?.dataset.id);
  if (node && tool === "select" && !space && e.button !== 1) {
    const resize = Boolean((e.target as HTMLElement).closest("[data-resize]"));
    select(node.id);
    gesture = {
      type: resize ? "resize" : "move",
      start: point(e),
      camera: { ...camera },
      node,
    };
  } else {
    if (tool === "select" && !space) select(null);
    gesture = { type: "pan", start: point(e), camera: { ...camera } };
  }
});
viewport.addEventListener("pointermove", (e) => {
  if (!pointers.has(e.pointerId) || !gesture) return;
  pointers.set(e.pointerId, point(e));
  if (gesture.type === "pinch") {
    if (pointers.size < 2) return;
    const [a, b] = [...pointers.values()];
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    camera = zoomAt(
      gesture.camera,
      gesture.anchor,
      (gesture.camera.zoom * Math.hypot(a.x - b.x, a.y - b.y)) /
        gesture.distance,
    );
    camera = pan(camera, {
      x: center.x - gesture.anchor.x,
      y: center.y - gesture.anchor.y,
    });
  } else {
    const p = point(e);
    const dx = p.x - gesture.start.x,
      dy = p.y - gesture.start.y;
    if (gesture.type === "pan") camera = pan(gesture.camera, { x: dx, y: dy });
    else if (gesture.node) {
      const n = gesture.node;
      preview =
        gesture.type === "move"
          ? {
              ...n,
              x: clamp(n.x + dx / gesture.camera.zoom, -1e6, 1e6),
              y: clamp(n.y + dy / gesture.camera.zoom, -1e6, 1e6),
            }
          : {
              ...n,
              width: clamp(n.width + dx / gesture.camera.zoom, 80, 4000),
              height: clamp(n.height + dy / gesture.camera.zoom, 60, 4000),
            };
    }
  }
  scheduleRender();
});
viewport.addEventListener("pointerup", (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (preview) {
    const { x, y, width, height, id } = preview;
    preview = null;
    execute([{ type: "update", id, patch: { x, y, width, height } }]);
  }
  gesture = null;
  if (pointers.size >= 2) startPinch();
  else if (pointers.size === 1)
    gesture = {
      type: "pan",
      start: [...pointers.values()][0],
      camera: { ...camera },
    };
  scheduleRender();
});
viewport.addEventListener("pointercancel", cancelGesture);
viewport.addEventListener("lostpointercapture", (e) => {
  if (pointers.has(e.pointerId)) cancelGesture();
});
viewport.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    if (gesture) return;
    const unit =
      e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? viewport.clientHeight : 1;
    camera =
      e.ctrlKey || e.metaKey
        ? zoomAt(
            camera,
            point(e),
            camera.zoom * Math.exp(-clamp(e.deltaY * unit, -400, 400) * 0.003),
          )
        : pan(camera, { x: -e.deltaX * unit, y: -e.deltaY * unit });
    scheduleRender();
  },
  { passive: false },
);
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-add]"))
  button.onclick = () => add(button.dataset.add as CreateableNodeKind);
$("add-image").onclick = () => $<HTMLInputElement>("image-file").click();
$("add-finance").onclick = addFinanceDemo;
$("start").onclick = () => add("note");
$("select").onclick = () => setTool("select");
$("hand").onclick = () => setTool("pan");
$("nodes").addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
    "[data-finance-toggle]",
  );
  if (!button) return;
  const node = history.document.nodes.find(
    (item) => item.id === button.dataset.financeToggle,
  );
  if (node?.kind !== "finance" || node.finance?.role !== "person") return;
  selected = node.id;
  execute([
    {
      type: "update",
      id: node.id,
      patch: {
        finance: {
          ...node.finance,
          expanded: node.finance.expanded === false,
        },
      },
    },
  ]);
});
$("undo").onclick = () => {
  cancelGesture();
  history.undo();
  changed();
};
$("redo").onclick = () => {
  cancelGesture();
  history.redo();
  changed();
};
$("delete").onclick = deleteSelected;
$("fit").onclick = fit;
for (const [id, factor] of [
  ["zoom-in", 1.2],
  ["zoom-out", 1 / 1.2],
] as const)
  $(id).onclick = () => {
    const s = size();
    camera = zoomAt(camera, { x: s.x / 2, y: s.y / 2 }, camera.zoom * factor);
    scheduleRender();
  };
for (const key of [
  "title",
  "text",
  "x",
  "y",
  "width",
  "height",
  "color",
] as const)
  $(key).addEventListener("change", () => {
    if (!selected) return;
    const input = $<HTMLInputElement>(key);
    const value = ["x", "y", "width", "height"].includes(key)
      ? input.value === ""
        ? NaN
        : Number(input.value)
      : input.value;
    execute([{ type: "update", id: selected, patch: { [key]: value } }]);
  });
$<HTMLInputElement>("animation-speed").addEventListener("input", (event) => {
  $("animation-speed-value").textContent =
    `${(event.target as HTMLInputElement).value}°/s`;
});
$<HTMLInputElement>("animation-speed").addEventListener("change", (event) => {
  updateCubeAnimation({
    speed: Number((event.target as HTMLInputElement).value),
  });
});
$<HTMLSelectElement>("animation-direction").addEventListener(
  "change",
  (event) => {
    updateCubeAnimation({
      direction: (event.target as HTMLSelectElement)
        .value as CubeAnimation["direction"],
    });
  },
);
$<HTMLSelectElement>("animation-axis").addEventListener("change", (event) => {
  updateCubeAnimation({
    axis: (event.target as HTMLSelectElement).value as CubeAnimation["axis"],
  });
});
$<HTMLInputElement>("animation-perspective").addEventListener(
  "input",
  (event) => {
    $("animation-perspective-value").textContent =
      `${(event.target as HTMLInputElement).value}px`;
  },
);
$<HTMLInputElement>("animation-perspective").addEventListener(
  "change",
  (event) => {
    updateCubeAnimation({
      perspective: Number((event.target as HTMLInputElement).value),
    });
  },
);
$<HTMLInputElement>("animation-paused").addEventListener("change", (event) => {
  updateCubeAnimation({ paused: (event.target as HTMLInputElement).checked });
});
window.addEventListener("keydown", (e) => {
  if (
    (e.target as HTMLElement).closest(
      "input,textarea,[contenteditable=true]",
    ) ||
    !ready
  )
    return;
  const modifier = e.ctrlKey || e.metaKey;
  if (modifier && e.key.toLowerCase() === "z") {
    e.preventDefault();
    cancelGesture();
    e.shiftKey ? history.redo() : history.undo();
    changed();
  } else if (e.key === "Escape") {
    cancelGesture();
    select(null);
  } else if (e.code === "Space" && e.target === viewport) {
    e.preventDefault();
    space = true;
  } else if (e.target === viewport && !modifier) {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      deleteSelected();
    } else if (e.key.toLowerCase() === "v") setTool("select");
    else if (e.key.toLowerCase() === "h") setTool("pan");
    else if (e.key.toLowerCase() === "n") add("note");
    else if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const dx =
        e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0;
      const dy = e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0;
      const node = history.document.nodes.find((n) => n.id === selected);
      if (node)
        execute([
          {
            type: "update",
            id: node.id,
            patch: {
              x: clamp(node.x + dx, -1e6, 1e6),
              y: clamp(node.y + dy, -1e6, 1e6),
            },
          },
        ]);
      else {
        camera = pan(camera, { x: -dx * 40, y: -dy * 40 });
        scheduleRender();
      }
    }
  }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space") space = false;
});
window.addEventListener("blur", () => {
  space = false;
  cancelGesture();
});
$("export").onclick = () => {
  const blob = new Blob([JSON.stringify(history.document, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "field-workspace.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("import").onclick = () => $<HTMLInputElement>("file").click();
$("file").addEventListener("change", async () => {
  const input = $<HTMLInputElement>("file");
  const file = input.files?.[0];
  if (!file || !ready) return;
  try {
    if (file.size > MAX_FILE_BYTES)
      throw new Error("Document exceeds the 12 MB import limit.");
    const imported = parseDocument(await file.text());
    cancelGesture();
    history.replace(imported);
    selected = null;
    changed();
    fit();
  } catch (error) {
    status(`Open failed: ${(error as Error).message}`, true);
  }
  input.value = "";
});
$("image-file").addEventListener("change", async () => {
  const input = $<HTMLInputElement>("image-file");
  const image = input.files?.[0];
  if (!image || !ready) return;
  try {
    await addImage(image);
  } catch (error) {
    status(`Image failed: ${(error as Error).message}`, true);
  }
  input.value = "";
});

new ResizeObserver(scheduleRender).observe(viewport);
async function boot() {
  try {
    const saved = await storage.load();
    if (saved) history = new History(saved);
    canSave = true;
    status("Ready · local workspace");
  } catch {
    status(
      "Could not open saved work. Autosave paused; export any new work.",
      true,
    );
  }
  ready = true;
  refreshInspector();
  fit();
}
// Only the tab holding this origin lock writes autosaves. Other tabs can edit/export safely.
if (navigator.locks) {
  void navigator.locks.request(
    "field-workspace-writer",
    { ifAvailable: true },
    async (lock) => {
      await boot();
      if (!lock) {
        canSave = false;
        status(
          "Another tab owns autosave. Export changes from this tab.",
          true,
        );
        return;
      }
      return new Promise<void>(() => {});
    },
  );
} else {
  void boot().then(() => {
    canSave = false;
    status("This browser needs manual Export to save work.", true);
  });
}
