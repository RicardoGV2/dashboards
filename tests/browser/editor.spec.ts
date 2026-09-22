import { test, expect, type Page } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#status")).toContainText("Ready");
});

async function placePreview(page: Page) {
  await expect(page.locator("#placement-hint")).toBeVisible();
  const box = (await page.locator("#viewport").boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator("#placement-hint")).toBeHidden();
}
test("edit, undo, reload, export, import validation, and safe text", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.locator("#start").click();
  await placePreview(page);
  await page.locator("#title").fill("First idea");
  await page.locator("#title").press("Tab");
  await page.locator("#text").fill("<img src=x onerror=alert(1)>");
  await page.locator("#text").press("Tab");
  await expect(page.locator(".canvas-node p")).toHaveText(
    "<img src=x onerror=alert(1)>",
  );
  await expect(page.locator(".canvas-node img")).toHaveCount(0);
  await page.locator("#x").fill("90");
  await page.locator("#x").press("Tab");
  await page.locator("#undo").click();
  await expect(page.locator("#x")).not.toHaveValue("90");
  await page.locator("#redo").click();
  await expect(page.locator("#x")).toHaveValue("90");
  await expect(page.locator("#status")).toHaveText("Saved on this device");
  await page.reload();
  await expect(page.locator(".canvas-node h2")).toHaveText("First idea");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("field-workspace.json");
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const exported = Buffer.concat(chunks);
  expect(JSON.parse(exported.toString()).nodes[0].x).toBe(90);
  await page.locator("#file").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":99}'),
  });
  await expect(page.locator("#status")).toContainText("Open failed");
  await expect(page.locator(".canvas-node")).toHaveCount(1);
  await page.locator("#object-list button").click();
  await page.locator("#delete").click();
  await page.locator("#file").setInputFiles({
    name: "roundtrip.json",
    mimeType: "application/json",
    buffer: exported,
  });
  await expect(page.locator(".canvas-node h2")).toHaveText("First idea");
  expect(errors).toEqual([]);
});
test("drag is one undo transaction, cancel does not mutate, zoom and culling", async ({
  page,
}) => {
  await page.locator("[data-add=shape]").click();
  await placePreview(page);
  await page.locator("#fit").click();
  await expect(page.locator(".canvas-node")).toBeVisible();
  const initialX = Number(await page.locator("#x").inputValue());
  const zoom =
    Number((await page.locator("#zoom").textContent())!.replace("%", "")) / 100;
  let box = (await page.locator(".canvas-node").boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 110, box.y + 70, { steps: 8 });
  await page.mouse.up();
  const movedX = Number(await page.locator("#x").inputValue());
  expect(Math.abs(movedX - (initialX + 70 / zoom))).toBeLessThan(0.5);
  await page.locator("#undo").click();
  await expect(page.locator("#x")).toHaveValue(String(initialX));
  await expect(page.locator(".canvas-node")).toBeVisible();
  box = (await page.locator(".canvas-node").boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 90, box.y + 70);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.locator("#object-list button").click();
  await expect(page.locator("#x")).toHaveValue(String(initialX));
  const zoomBeforeButton = Number(
    (await page.locator("#zoom").textContent())!.replace("%", ""),
  );
  await page.locator("#zoom-in").click();
  await expect(page.locator("#zoom")).toHaveText(
    `${Math.round(zoomBeforeButton * 1.2)}%`,
  );
  await page.locator("#x").fill("90000");
  await page.locator("#x").press("Tab");
  await expect(page.locator(".canvas-node")).toHaveCount(0);
  await page.locator("#fit").click();
  await expect(page.locator(".canvas-node")).toHaveCount(1);
});
test("second tab cannot overwrite the writer tab", async ({
  page,
  context,
}) => {
  await page.locator("#start").click();
  await placePreview(page);
  await expect(page.locator("#status")).toHaveText("Saved on this device");
  const other = await context.newPage();
  await other.goto("/");
  await expect(other.locator("#status")).toContainText("Another tab");
  await other.locator("[data-add=text]").click();
  const otherBox = (await other.locator("#viewport").boundingBox())!;
  await other.mouse.click(
    otherBox.x + otherBox.width / 2,
    otherBox.y + otherBox.height / 2,
  );
  await expect(other.locator("#status")).toContainText("Autosave unavailable");
  await page.reload();
  await expect(page.locator("#count")).toHaveText("1 object");
});
test("keyboard object editing and responsive controls", async ({ page }) => {
  await page.locator("[data-add=text]").click();
  await placePreview(page);
  await page.locator("#viewport").focus();
  const x = Number(await page.locator("#x").inputValue());
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#x")).toHaveValue(String(x + 1));
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await expect(page.locator("#export")).toBeInViewport();
  await expect(page.locator("#zoom-in")).toBeInViewport();
});
test("two-finger pinch zooms the canvas", async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile",
    "Chromium touch emulation check",
  );
  const session = await context.newCDPSession(page);
  const box = (await page.locator("#viewport").boundingBox())!;
  const y = box.y + box.height / 2,
    x = box.x + box.width / 2;
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: x - 35, y, id: 1 },
      { x: x + 35, y, id: 2 },
    ],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: x - 70, y, id: 1 },
      { x: x + 70, y, id: 2 },
    ],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.locator("#zoom")).toHaveText("200%");
  await expect(page.locator("#count")).toHaveText("0 objects");
});
test("a storage failure remains visible without discarding work", async ({
  page,
}) => {
  await page.evaluate(() => {
    IDBDatabase.prototype.transaction = () => {
      throw new DOMException("Test quota failure", "QuotaExceededError");
    };
  });
  await page.locator("#start").click();
  await placePreview(page);
  await expect(page.locator("#status")).toContainText("Save failed");
  await expect(page.locator(".canvas-node")).toHaveCount(1);
  await expect(page.locator("#export")).toBeEnabled();
});

test("image upload and animated cube controls persist", async ({ page }) => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlYvqsAAAAASUVORK5CYII=",
    "base64",
  );
  await page.locator("#image-file").setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(page.locator(".canvas-node.image img")).toHaveCount(1);
  await placePreview(page);
  await expect(page.locator(".canvas-node.image img")).toHaveCount(1);
  await expect(page.locator("#image-info")).toContainText("pixel.png");
  await expect(page.locator("#count")).toHaveText("1 object");

  await page.locator("[data-add=cube]").click();
  await placePreview(page);
  await expect(page.locator(".canvas-node.cube .cube")).toHaveCount(1);
  await expect(page.locator("#animation-controls")).toBeVisible();

  await page.locator("#animation-speed").evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = "180";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.locator("#animation-direction").selectOption("counterclockwise");
  await page.locator("#animation-axis").selectOption("z");
  await page.locator("#animation-perspective").evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = "900";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.locator("#animation-paused").check();
  await page.locator("#color").fill("#ff3366");
  await page.locator("#color").press("Tab");

  const cube = page.locator(".canvas-node.cube .cube");
  await expect(cube).toHaveClass(/axis-z/);
  await expect(cube).toHaveCSS("animation-direction", "reverse");
  await expect(cube).toHaveCSS("animation-play-state", "paused");

  await expect(page.locator("#status")).toHaveText("Saved on this device");
  await page.reload();
  await expect(page.locator(".canvas-node.image img")).toHaveCount(1);
  await expect(page.locator(".canvas-node.cube .cube")).toHaveCount(1);
  await page.locator("#object-list button").filter({ hasText: "Cube" }).click();
  await expect(page.locator("#animation-speed")).toHaveValue("180");
  await expect(page.locator("#animation-direction")).toHaveValue(
    "counterclockwise",
  );
  await expect(page.locator("#animation-axis")).toHaveValue("z");
  await expect(page.locator("#animation-perspective")).toHaveValue("900");
  await expect(page.locator("#animation-paused")).toBeChecked();

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export").click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.schemaVersion).toBe(3);
  expect(exported.assets).toHaveLength(1);
  expect(exported.nodes.map((node: { kind: string }) => node.kind)).toEqual([
    "image",
    "cube",
  ]);
});

test("finance visualization adds animated flows without removing existing widgets", async ({
  page,
}) => {
  await page.locator("#start").click();
  await placePreview(page);
  await page.locator("#title").fill("Keep this note");
  await page.locator("#title").press("Tab");

  await page.locator("#add-finance").click();
  await placePreview(page);

  await expect(page.locator("body")).toHaveClass(/finance-mode/);
  await expect(page.locator(".canvas-node.finance-person")).toHaveCount(2);
  await expect(page.locator(".canvas-node.finance-bank")).toHaveCount(4);
  await expect(page.locator(".canvas-node.note")).toHaveCount(1);
  await expect(page.locator("#flow-banner")).toBeVisible();
  await expect(page.locator("#flow-legend")).toBeVisible();
  await expect(page.locator("#connections .flow-connection")).toHaveCount(16);
  await expect(
    page.locator("#connections .flow-connection.incoming .flow-particle"),
  ).toHaveCount(4);
  await expect(
    page.locator("#connections .flow-connection.outgoing"),
  ).toHaveCount(7);

  const ricardo = page.locator(".canvas-node.finance-person").filter({
    hasText: "Ricardo",
  });
  await expect(ricardo).toBeVisible();
  await ricardo.locator("[data-finance-toggle]").click();
  await expect(page.locator(".canvas-node.finance-bank")).toHaveCount(2);
  await expect(page.locator("#connections .flow-connection")).toHaveCount(8);

  await ricardo.locator("[data-finance-toggle]").click();
  await expect(page.locator(".canvas-node.finance-bank")).toHaveCount(4);

  await page
    .locator("#object-list button")
    .filter({ hasText: "Ricardo" })
    .click();
  await expect(page.locator("#finance-details")).toBeVisible();
  await expect(page.locator("#finance-details")).toContainText("Banks (2)");
  await expect(page.locator("#finance-details")).toContainText("Total balance");

  await expect(page.locator("#status")).toHaveText("Saved on this device");
  await page.reload();
  await expect(page.locator(".canvas-node.finance-person")).toHaveCount(2);
  await expect(page.locator(".canvas-node.note")).toHaveCount(1);
  await expect(page.locator("#connections .flow-connection")).toHaveCount(16);
});

test("dark visual theme is active before finance is added", async ({
  page,
}) => {
  await expect(page.locator("body")).toHaveClass(/app-theme-dark/);
  await expect(page.locator("body")).not.toHaveClass(/finance-mode/);
  await expect(page.locator("#flow-banner")).toBeHidden();

  await page.locator("#start").click();
  await placePreview(page);
  await expect(page.locator("body")).toHaveClass(/app-theme-dark/);
  await expect(page.locator(".canvas-node.note")).toHaveCount(1);

  await page.locator("#add-finance").click();
  await placePreview(page);
  await expect(page.locator("body")).toHaveClass(/app-theme-dark/);
  await expect(page.locator("body")).toHaveClass(/finance-mode/);
  await expect(page.locator("#flow-banner")).toBeVisible();
});

test("placement preview prevents accidental duplicate finance scenes and supports one-step undo", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile",
    "Desktop hover placement check",
  );

  await page.locator("#add-finance").click();
  await expect(page.locator("#placement-hint")).toBeVisible();
  await expect(page.locator(".canvas-node.finance-person")).toHaveCount(2);
  await expect(page.locator("#count")).toContainText("placing Finance map");

  const before = (await page
    .locator(".canvas-node.finance-person")
    .first()
    .boundingBox())!;

  const viewport = (await page.locator("#viewport").boundingBox())!;
  await page.mouse.move(
    viewport.x + viewport.width * 0.72,
    viewport.y + viewport.height * 0.4,
  );
  const after = (await page
    .locator(".canvas-node.finance-person")
    .first()
    .boundingBox())!;
  expect(Math.abs(after.x - before.x)).toBeGreaterThan(20);

  await page.locator("#add-finance").click();
  await expect(page.locator(".canvas-node.finance-person")).toHaveCount(2);

  await page.mouse.click(
    viewport.x + viewport.width * 0.72,
    viewport.y + viewport.height * 0.4,
  );
  await expect(page.locator("#placement-hint")).toBeHidden();
  await expect(page.locator(".canvas-node.finance-person")).toHaveCount(2);
  await expect(page.locator("#action-toast")).toBeVisible();

  await page.locator("#action-undo").click();
  await expect(page.locator(".canvas-node.finance-person")).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveClass(/finance-mode/);
});

test("placement can be canceled before it changes the document", async ({
  page,
}) => {
  await page.locator("[data-add=note]").click();
  await expect(page.locator(".canvas-node.note")).toHaveCount(1);
  await expect(page.locator("#count")).toContainText("placing Note");
  await page.keyboard.press("Escape");
  await expect(page.locator(".canvas-node.note")).toHaveCount(0);
  await expect(page.locator("#count")).toHaveText("0 objects");
});

test("erase all requires confirmation and restores the workspace with one undo", async ({
  page,
}) => {
  await expect(page.locator("#erase-all")).toBeDisabled();

  await page.locator("#add-finance").click();
  await placePreview(page);
  await expect(page.locator("#erase-all")).toBeEnabled();
  await expect(page.locator(".canvas-node.finance-person")).toHaveCount(2);
  await expect(page.locator("#connections .flow-connection")).toHaveCount(16);

  await page.locator("#erase-all").click();
  await expect(page.locator("#erase-confirm")).toBeVisible();
  await expect(page.locator("#erase-confirm-copy")).toContainText("objects");
  await page.locator("#erase-cancel").click();
  await expect(page.locator("#erase-confirm")).toBeHidden();
  await expect(page.locator(".canvas-node.finance-person")).toHaveCount(2);

  await page.locator("#erase-all").click();
  await page.locator("#erase-confirm-button").click();

  await expect(page.locator("#erase-confirm")).toBeHidden();
  await expect(page.locator("#count")).toHaveText("0 objects");
  await expect(page.locator(".canvas-node")).toHaveCount(0);
  await expect(page.locator("#connections .flow-connection")).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveClass(/finance-mode/);
  await expect(page.locator("#erase-all")).toBeDisabled();
  await expect(page.locator("#action-toast")).toContainText(
    "Workspace cleared",
  );

  await page.locator("#action-undo").click();
  await expect(page.locator(".canvas-node.finance-person")).toHaveCount(2);
  await expect(page.locator("#connections .flow-connection")).toHaveCount(16);
  await expect(page.locator("body")).toHaveClass(/finance-mode/);
  await expect(page.locator("#erase-all")).toBeEnabled();
});
