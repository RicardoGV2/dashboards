import test from "node:test";
import assert from "node:assert/strict";
import {
  screenToWorld,
  worldToScreen,
  zoomAt,
} from "../packages/engine/camera/index.ts";
import {
  emptyDocument,
  parseDocument,
  validateDocument,
} from "../packages/document/index.ts";
import { History, applyCommands } from "../packages/engine/history/index.ts";
import { createImageNode, createNode } from "../packages/widgets/index.ts";
import { createFinanceDemo } from "../packages/finance/index.ts";
test("world/screen inverse across supported coordinate and zoom bounds", () => {
  for (const zoom of [0.1, 0.25, 1, 4])
    for (const x of [-1e6, -10.7, 0, 17, 1e6]) {
      const camera = { x: 800000, y: -999999, zoom };
      const p = { x, y: x / 3 };
      const result = screenToWorld(worldToScreen(p, camera), camera);
      assert.ok(Math.abs(result.x - p.x) < 1e-8);
      assert.ok(Math.abs(result.y - p.y) < 1e-8);
    }
});
test("cursor zoom preserves anchor even when zoom is clamped", () => {
  const c = { x: -132, y: 754, zoom: 0.7 };
  const anchor = { x: 415, y: 297 };
  for (const requested of [0.001, 0.9, 1000]) {
    const before = screenToWorld(anchor, c),
      next = zoomAt(c, anchor, requested),
      after = screenToWorld(anchor, next);
    assert.ok(Math.abs(before.x - after.x) < 1e-9);
    assert.ok(Math.abs(before.y - after.y) < 1e-9);
    assert.ok(next.zoom >= 0.1 && next.zoom <= 4);
  }
});
test("transaction is atomic and rejects duplicate IDs or invalid geometry", () => {
  const doc = emptyDocument();
  const node = createNode("note", 20, 30);
  assert.throws(() =>
    applyCommands(doc, [
      { type: "create", node },
      { type: "create", node },
    ]),
  );
  assert.equal(doc.nodes.length, 0);
  assert.throws(() =>
    applyCommands(doc, [
      { type: "create", node },
      { type: "update", id: node.id, patch: { x: NaN } },
    ]),
  );
  assert.equal(doc.nodes.length, 0);
});
test("history preserves transactions, branches and immutable reads", () => {
  const h = new History(emptyDocument()),
    node = createNode("note", 0, 0);
  h.execute([{ type: "create", node }]);
  h.execute([{ type: "update", id: node.id, patch: { x: 100 } }]);
  h.undo();
  assert.equal(h.document.nodes[0].x, 0);
  h.redo();
  assert.equal(h.document.nodes[0].x, 100);
  const leaked = h.document;
  leaked.nodes[0].x = 99;
  assert.equal(h.document.nodes[0].x, 100);
  h.undo();
  h.execute([{ type: "update", id: node.id, patch: { text: "branch" } }]);
  assert.equal(h.canRedo, false);
  h.undo();
  h.undo();
  assert.equal(h.document.nodes.length, 0);
});
test("import roundtrip, future format and hostile fields", () => {
  const doc = emptyDocument();
  doc.nodes.push(createNode("text", -500, 300));
  assert.deepEqual(parseDocument(JSON.stringify(doc)), doc);
  assert.throws(() => validateDocument({ ...doc, schemaVersion: 4 }));
  assert.throws(() =>
    parseDocument(
      JSON.stringify({
        ...doc,
        extra: "future data must not be silently discarded",
      }),
    ),
  );
  assert.throws(() =>
    validateDocument({ ...doc, nodes: [{ ...doc.nodes[0], color: "url(x)" }] }),
  );
  assert.throws(() =>
    applyCommands(doc, [
      {
        type: "update",
        id: doc.nodes[0].id,
        patch: JSON.parse('{"__proto__":{}}'),
      },
    ]),
  );
  assert.throws(() => parseDocument("x".repeat(12_000_001)));
});
test("history retains bounded undo depth", () => {
  const h = new History(emptyDocument());
  const node = createNode("shape", 0, 0);
  h.execute([{ type: "create", node }]);
  for (let i = 1; i <= 80; i++)
    h.execute([{ type: "update", id: node.id, patch: { x: i } }]);
  let undoCount = 0;
  while (h.canUndo) {
    h.undo();
    undoCount++;
  }
  assert.equal(undoCount, 50);
  assert.equal(h.document.nodes[0].x, 30);
});

test("legacy schema migrates without changing existing nodes", () => {
  const node = createNode("note", 10, 20);
  const legacy = {
    schemaVersion: 1,
    id: "legacy",
    title: "Legacy workspace",
    nodes: [node],
  };
  const migrated = validateDocument(legacy);
  assert.equal(migrated.schemaVersion, 3);
  assert.deepEqual(migrated.assets, []);
  assert.equal(migrated.nodes[0].id, node.id);
});

test("image assets and cube animation survive validation and history", () => {
  const png =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlYvqsAAAAASUVORK5CYII=";
  const asset = {
    id: "asset-1",
    kind: "image" as const,
    name: "pixel.png",
    mimeType: "image/png" as const,
    dataUrl: `data:image/png;base64,${png}`,
    width: 1,
    height: 1,
    bytes: 68,
  };
  const image = createImageNode(asset.id, asset.name, 20, 30, 160, 120);
  const cube = createNode("cube", 400, 300);
  const doc = applyCommands(emptyDocument(), [
    { type: "createAsset", asset },
    { type: "create", node: image },
    { type: "create", node: cube },
  ]);
  assert.equal(doc.assets.length, 1);
  assert.equal(doc.nodes[0].kind, "image");
  assert.equal(doc.nodes[1].animation?.speed, 45);

  const updated = applyCommands(doc, [
    {
      type: "update",
      id: cube.id,
      patch: {
        color: "#ff3366",
        animation: {
          ...cube.animation!,
          speed: 180,
          direction: "counterclockwise",
          axis: "z",
          paused: true,
          perspective: 900,
        },
      },
    },
  ]);
  assert.equal(updated.nodes[1].color, "#ff3366");
  assert.equal(updated.nodes[1].animation?.speed, 180);
  assert.equal(updated.nodes[1].animation?.axis, "z");
  assert.equal(updated.nodes[1].animation?.paused, true);
  assert.deepEqual(parseDocument(JSON.stringify(updated)), updated);

  assert.throws(() =>
    validateDocument({
      ...doc,
      assets: [
        {
          ...asset,
          mimeType: "image/svg+xml",
          dataUrl: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
        },
      ],
    }),
  );
  assert.throws(() =>
    applyCommands(doc, [{ type: "deleteAsset", id: asset.id }]),
  );

  const cleaned = applyCommands(doc, [
    { type: "delete", id: image.id },
    { type: "deleteAsset", id: asset.id },
  ]);
  assert.equal(cleaned.assets.length, 0);
  assert.equal(
    cleaned.nodes.some((node) => node.kind === "image"),
    false,
  );
});


test("version 2 documents migrate with empty connections", () => {
  const current = emptyDocument();
  const legacyV2 = {
    schemaVersion: 2,
    id: current.id,
    title: current.title,
    nodes: [createNode("shape", 10, 20)],
    assets: [],
  };
  const migrated = validateDocument(legacyV2);
  assert.equal(migrated.schemaVersion, 3);
  assert.deepEqual(migrated.connections, []);
  assert.equal(migrated.nodes[0].kind, "shape");
});

test("finance demo creates reusable people, banks and valid animated connections", () => {
  const scene = createFinanceDemo(0, 0);
  assert.equal(scene.personIds.length, 2);
  assert.ok(scene.nodes.length >= 10);
  assert.ok(scene.connections.length >= 10);

  const people = scene.nodes.filter(
    (node) => node.kind === "finance" && node.finance?.role === "person",
  );
  const banks = scene.nodes.filter(
    (node) => node.kind === "finance" && node.finance?.role === "bank",
  );
  assert.equal(people.length, 2);
  assert.equal(banks.length, 4);
  assert.ok(
    scene.connections.some(
      (connection) => connection.kind === "incoming" && connection.animated,
    ),
  );
  assert.ok(
    scene.connections.some(
      (connection) => connection.kind === "outgoing" && connection.animated,
    ),
  );

  const doc = applyCommands(emptyDocument(), [
    ...scene.nodes.map((node) => ({ type: "create" as const, node })),
    ...scene.connections.map((connection) => ({
      type: "createConnection" as const,
      connection,
    })),
  ]);
  assert.equal(doc.schemaVersion, 3);
  assert.equal(doc.connections.length, scene.connections.length);

  const firstPerson = people[0];
  const childIds = new Set(
    doc.nodes
      .filter((node) => node.finance?.ownerId === firstPerson.id)
      .map((node) => node.id),
  );
  const deleteCommands = [
    ...[...childIds].map((id) => ({ type: "delete" as const, id })),
    { type: "delete" as const, id: firstPerson.id },
  ];
  const afterDelete = applyCommands(doc, deleteCommands);
  assert.equal(
    afterDelete.connections.some(
      (connection) =>
        connection.from === firstPerson.id ||
        connection.to === firstPerson.id ||
        childIds.has(connection.from) ||
        childIds.has(connection.to),
    ),
    false,
  );
  assert.equal(
    afterDelete.nodes.some((node) => node.finance?.ownerId === firstPerson.id),
    false,
  );
});
