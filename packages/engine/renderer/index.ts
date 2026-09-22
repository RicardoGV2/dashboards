import { worldToScreen } from "../camera/index.ts";
import type { Camera, Point } from "../camera/index.ts";
import type { CanvasNode } from "../../document/index.ts";
/** DOM adapter: the model does not contain browser objects or styling. */
export function renderNodes(
  host: HTMLElement,
  nodes: CanvasNode[],
  camera: Camera,
  viewport: Point,
  selected: string | null,
) {
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
    const title = document.createElement("h2");
    title.textContent = node.title;
    const text = document.createElement("p");
    text.textContent =
      node.text || (node.kind === "shape" ? "" : "Select to start writing…");
    el.append(title, text);
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
