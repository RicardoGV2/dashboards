import { worldToScreen } from "../camera/index.ts";
import type { Camera, Point } from "../camera/index.ts";
import type {
  CanvasConnection,
  CanvasNode,
  ImageAsset,
} from "../../document/index.ts";

const SVG_NS = "http://www.w3.org/2000/svg";

function money(cents: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function financeAmount(node: CanvasNode) {
  const cents = node.finance?.amountCents;
  if (cents === undefined) return "";
  const prefix =
    node.finance?.role === "source" && cents > 0
      ? "+"
      : node.finance?.role === "destination" && cents > 0
        ? "+"
        : "";
  return `${prefix}${money(cents)}`;
}

function renderFinanceNode(el: HTMLElement, node: CanvasNode) {
  const finance = node.finance!;
  el.dataset.financeRole = finance.role;

  if (finance.role === "person") {
    const avatar = document.createElement("div");
    avatar.className = "finance-avatar";
    avatar.textContent = finance.icon;

    const title = document.createElement("h2");
    title.textContent = node.title;

    const subtitle = document.createElement("p");
    subtitle.textContent = node.text;

    const live = document.createElement("span");
    live.className = "finance-live";
    live.textContent = "● Active";

    const toggle = document.createElement("button");
    toggle.className = "finance-expand";
    toggle.dataset.financeToggle = node.id;
    toggle.textContent =
      finance.expanded === false ? "Expand utilities" : "Collapse utilities";
    toggle.setAttribute(
      "aria-label",
      `${finance.expanded === false ? "Expand" : "Collapse"} ${node.title} finance utilities`,
    );

    el.append(avatar, title, subtitle, live, toggle);
    return;
  }

  if (finance.role === "bank") {
    const city = document.createElement("div");
    city.className = "bank-city";
    const roof = document.createElement("span");
    roof.className = "bank-roof";
    const columns = document.createElement("span");
    columns.className = "bank-columns";
    const brand = document.createElement("span");
    brand.className = "bank-brand";
    brand.textContent = finance.icon;
    city.append(roof, columns, brand);

    const title = document.createElement("h2");
    title.textContent = node.title;
    const subtitle = document.createElement("p");
    subtitle.textContent = node.text;
    const amount = document.createElement("strong");
    amount.className = "finance-amount";
    amount.textContent = financeAmount(node);
    el.append(city, title, subtitle, amount);
    return;
  }

  const icon = document.createElement("div");
  icon.className = "finance-tile-icon";
  icon.textContent = finance.icon;
  const title = document.createElement("h2");
  title.textContent = node.title;
  const amount = document.createElement("strong");
  amount.className = "finance-amount";
  amount.textContent = financeAmount(node);
  const subtitle = document.createElement("p");
  subtitle.textContent = node.text;
  el.append(icon, title, amount, subtitle);
}

/** DOM adapter: the model does not contain browser objects or styling. */
export function renderNodes(
  host: HTMLElement,
  nodes: CanvasNode[],
  assets: ImageAsset[],
  camera: Camera,
  viewport: Point,
  selected: string | null,
) {
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
  const fragment = document.createDocumentFragment();

  for (const node of nodes) {
    const p = worldToScreen(node, camera);
    if (
      p.x + node.width * camera.zoom < -100 ||
      p.y + node.height * camera.zoom < -100 ||
      p.x > viewport.x + 100 ||
      p.y > viewport.y + 100
    )
      continue;

    const el = document.createElement("article");
    el.className = `canvas-node ${node.kind}${
      node.kind === "finance" ? ` finance-${node.finance!.role}` : ""
    }${selected === node.id ? " selected" : ""}`;
    el.dataset.id = node.id;
    el.style.cssText = `left:${p.x}px;top:${p.y}px;width:${node.width}px;height:${node.height}px;transform:scale(${camera.zoom});--node-color:${node.color}`;
    el.setAttribute("aria-label", `${node.kind}: ${node.title}`);

    if (node.kind === "image") {
      const asset = node.assetId ? assetMap.get(node.assetId) : undefined;
      if (asset) {
        const img = document.createElement("img");
        img.src = asset.dataUrl;
        img.alt = node.text || node.title;
        img.draggable = false;
        img.decoding = "async";
        el.append(img);
      } else {
        const missing = document.createElement("p");
        missing.textContent = "Image asset unavailable";
        el.append(missing);
      }
    } else if (node.kind === "cube") {
      const animation = node.animation!;
      const scene = document.createElement("div");
      scene.className = "cube-scene";
      scene.style.setProperty(
        "--cube-perspective",
        `${animation.perspective}px`,
      );
      scene.style.setProperty(
        "--cube-size",
        `${Math.max(72, Math.min(node.width, node.height) * 0.58)}px`,
      );
      const cube = document.createElement("div");
      cube.className = `cube axis-${animation.axis}`;
      cube.style.setProperty("--cube-color", node.color);
      cube.style.setProperty("--cube-duration", `${360 / animation.speed}s`);
      cube.style.animationDirection =
        animation.direction === "clockwise" ? "normal" : "reverse";
      cube.style.animationPlayState = animation.paused ? "paused" : "running";

      for (const faceName of [
        "front",
        "back",
        "right",
        "left",
        "top",
        "bottom",
      ]) {
        const face = document.createElement("span");
        face.className = `cube-face ${faceName}`;
        cube.append(face);
      }
      scene.append(cube);

      const badge = document.createElement("span");
      badge.className = "node-badge";
      badge.textContent = node.title;
      el.append(scene, badge);
    } else if (node.kind === "finance") {
      renderFinanceNode(el, node);
    } else {
      const title = document.createElement("h2");
      title.textContent = node.title;
      const text = document.createElement("p");
      text.textContent =
        node.text || (node.kind === "shape" ? "" : "Select to start writing…");
      el.append(title, text);
    }

    if (selected === node.id) {
      const handle = document.createElement("span");
      handle.className = "resize";
      handle.dataset.resize = "true";
      el.append(handle);
    }
    fragment.append(el);
  }

  host.replaceChildren(fragment);
}

function connectionPath(
  source: { x: number; y: number },
  target: { x: number; y: number },
) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  if (Math.abs(dy) >= Math.abs(dx)) {
    return `M ${source.x} ${source.y} C ${source.x} ${source.y + dy * 0.48}, ${target.x} ${target.y - dy * 0.48}, ${target.x} ${target.y}`;
  }
  return `M ${source.x} ${source.y} C ${source.x + dx * 0.48} ${source.y}, ${target.x - dx * 0.48} ${target.y}, ${target.x} ${target.y}`;
}

function connectionAnchor(
  node: CanvasNode,
  camera: Camera,
  toward: CanvasNode,
) {
  const p = worldToScreen(node, camera);
  const q = worldToScreen(toward, camera);
  const width = node.width * camera.zoom;
  const height = node.height * camera.zoom;
  const center = { x: p.x + width / 2, y: p.y + height / 2 };
  const target = {
    x: q.x + (toward.width * camera.zoom) / 2,
    y: q.y + (toward.height * camera.zoom) / 2,
  };
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  if (Math.abs(dx / Math.max(width, 1)) > Math.abs(dy / Math.max(height, 1)))
    return {
      x: center.x + Math.sign(dx || 1) * (width / 2),
      y: center.y + (dy / Math.max(Math.abs(dx), 1)) * (width / 2),
    };
  return {
    x: center.x + (dx / Math.max(Math.abs(dy), 1)) * (height / 2),
    y: center.y + Math.sign(dy || 1) * (height / 2),
  };
}

export function renderConnections(
  host: SVGSVGElement,
  connections: CanvasConnection[],
  nodes: CanvasNode[],
  camera: Camera,
) {
  const map = new Map(nodes.map((node) => [node.id, node]));
  const fragment = document.createDocumentFragment();
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  for (const connection of connections) {
    const from = map.get(connection.from);
    const to = map.get(connection.to);
    if (!from || !to) continue;

    const source = connectionAnchor(from, camera, to);
    const target = connectionAnchor(to, camera, from);
    const d = connectionPath(source, target);

    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("class", `flow-connection ${connection.kind}`);

    const glow = document.createElementNS(SVG_NS, "path");
    glow.setAttribute("d", d);
    glow.setAttribute("class", "flow-glow");

    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    path.setAttribute("class", "flow-line");

    group.append(glow, path);

    if (connection.label) {
      const label = document.createElementNS(SVG_NS, "text");
      label.setAttribute("x", String((source.x + target.x) / 2));
      label.setAttribute("y", String((source.y + target.y) / 2 - 8));
      label.setAttribute("class", "flow-label");
      label.setAttribute("text-anchor", "middle");
      label.textContent = connection.label;
      group.append(label);
    }

    if (connection.animated && !reducedMotion) {
      for (let index = 0; index < 2; index++) {
        const particle = document.createElementNS(SVG_NS, "circle");
        particle.setAttribute("r", "4");
        particle.setAttribute("class", "flow-particle");
        const motion = document.createElementNS(SVG_NS, "animateMotion");
        motion.setAttribute(
          "dur",
          connection.kind === "incoming" ? "2.5s" : "3.2s",
        );
        motion.setAttribute("repeatCount", "indefinite");
        motion.setAttribute("begin", `${index * 1.35}s`);
        motion.setAttribute("path", d);
        particle.append(motion);
        group.append(particle);
      }
    }

    fragment.append(group);
  }

  host.replaceChildren(fragment);
}
