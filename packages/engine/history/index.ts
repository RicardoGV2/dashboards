import { validateDocument } from "../../document/index.ts";
import type { CanvasDocument, CanvasNode } from "../../document/index.ts";
export type Command =
  | { type: "create"; node: CanvasNode }
  | {
      type: "update";
      id: string;
      patch: Partial<Omit<CanvasNode, "id" | "kind">>;
    }
  | { type: "delete"; id: string };
export function applyCommands(
  document: CanvasDocument,
  commands: readonly Command[],
): CanvasDocument {
  const next = structuredClone(document);
  for (const command of commands) {
    if (command.type === "create")
      next.nodes.push(structuredClone(command.node));
    else {
      const index = next.nodes.findIndex((n) => n.id === command.id);
      if (index < 0) throw new Error("Object no longer exists.");
      if (command.type === "delete") next.nodes.splice(index, 1);
      else if (command.type === "update") {
        if (
          Object.keys(command.patch).some(
            (k) =>
              !["x", "y", "width", "height", "title", "text", "color"].includes(
                k,
              ),
          )
        )
          throw new Error("Unsupported update field.");
        next.nodes[index] = { ...next.nodes[index], ...command.patch };
      } else throw new Error("Unsupported command.");
    }
  }
  return validateDocument(next);
}
/** Small bounded snapshot history; replace with inverse patches after profiling. */
export class History {
  #document: CanvasDocument;
  #past: CanvasDocument[] = [];
  #future: CanvasDocument[] = [];
  constructor(document: CanvasDocument) {
    this.#document = validateDocument(document);
  }
  get document(): CanvasDocument {
    return structuredClone(this.#document);
  }
  get canUndo() {
    return this.#past.length > 0;
  }
  get canRedo() {
    return this.#future.length > 0;
  }
  execute(commands: readonly Command[]) {
    this.replace(applyCommands(this.#document, commands));
  }
  replace(document: CanvasDocument) {
    const next = validateDocument(document);
    if (JSON.stringify(next) === JSON.stringify(this.#document)) return;
    this.#past.push(this.#document);
    while (
      this.#past.length > 50 ||
      (this.#past.length > 1 && JSON.stringify(this.#past).length > 10_000_000)
    )
      this.#past.shift();
    this.#document = next;
    this.#future = [];
  }
  undo() {
    const previous = this.#past.pop();
    if (previous) {
      this.#future.push(this.#document);
      this.#document = previous;
    }
  }
  redo() {
    const next = this.#future.pop();
    if (next) {
      this.#past.push(this.#document);
      this.#document = next;
    }
  }
}
