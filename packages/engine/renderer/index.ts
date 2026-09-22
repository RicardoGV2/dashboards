import { worldToScreen } from "../camera/index.ts";
import type { Camera, Point } from "../camera/index.ts";
import type { CanvasNode, ImageAsset } from "../../document/index.ts";

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
    el.className = `canvas-node ${node.kind}${selected === node.id ? " selected" : ""}`;
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
