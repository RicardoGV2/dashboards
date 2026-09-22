import { validateDocument } from "../../document/index.ts";
import type {
  CanvasConnection,
  CanvasDocument,
  CanvasNode,
  ImageAsset,
} from "../../document/index.ts";

export type Command =
  | { type: "create"; node: CanvasNode }
  | {
      type: "update";
      id: string;
      patch: Partial<Omit<CanvasNode, "id" | "kind">>;
    }
  | { type: "delete"; id: string }
  | { type: "createAsset"; asset: ImageAsset }
  | { type: "deleteAsset"; id: string }
  | { type: "createConnection"; connection: CanvasConnection }
  | {
      type: "updateConnection";
      id: string;
      patch: Partial<Omit<CanvasConnection, "id" | "from" | "to">>;
    }
  | { type: "deleteConnection"; id: string };

export function applyCommands(
  document: CanvasDocument,
  commands: readonly Command[],
): CanvasDocument {
  const next = structuredClone(document);

  for (const command of commands) {
    if (command.type === "create") {
      next.nodes.push(structuredClone(command.node));
      continue;
    }
    if (command.type === "createAsset") {
      next.assets.push(structuredClone(command.asset));
      continue;
    }
    if (command.type === "deleteAsset") {
      const assetIndex = next.assets.findIndex(
        (asset) => asset.id === command.id,
      );
      if (assetIndex < 0) throw new Error("Asset no longer exists.");
      next.assets.splice(assetIndex, 1);
      continue;
    }
    if (command.type === "createConnection") {
      next.connections.push(structuredClone(command.connection));
      continue;
    }
    if (command.type === "deleteConnection") {
      const index = next.connections.findIndex(
        (connection) => connection.id === command.id,
      );
      if (index < 0) throw new Error("Connection no longer exists.");
      next.connections.splice(index, 1);
      continue;
    }
    if (command.type === "updateConnection") {
      const index = next.connections.findIndex(
        (connection) => connection.id === command.id,
      );
      if (index < 0) throw new Error("Connection no longer exists.");
      if (
        Object.keys(command.patch).some(
          (key) =>
            !["kind", "label", "animated", "amountCents", "currency"].includes(
              key,
            ),
        )
      )
        throw new Error("Unsupported connection update field.");
      next.connections[index] = {
        ...next.connections[index],
        ...command.patch,
      };
      continue;
    }

    const index = next.nodes.findIndex((node) => node.id === command.id);
    if (index < 0) throw new Error("Object no longer exists.");

    if (command.type === "delete") {
      next.nodes.splice(index, 1);
      next.connections = next.connections.filter(
        (connection) =>
          connection.from !== command.id && connection.to !== command.id,
      );
      continue;
    }

    if (command.type === "update") {
      if (
        Object.keys(command.patch).some(
          (key) =>
            ![
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
            ].includes(key),
        )
      )
        throw new Error("Unsupported update field.");
      next.nodes[index] = { ...next.nodes[index], ...command.patch };
      continue;
    }

    throw new Error("Unsupported command.");
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
