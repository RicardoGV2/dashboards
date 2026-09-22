import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#status")).toContainText("Ready");
});
test("edit, undo, reload, export, import validation, and safe text", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.locator("#start").click();
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
  const initialX = Number(await page.locator("#x").inputValue());
  let box = (await page.locator(".canvas-node").boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 110, box.y + 70, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator("#x")).toHaveValue(String(initialX + 70));
  await page.locator("#undo").click();
  await expect(page.locator("#x")).toHaveValue(String(initialX));
  box = (await page.locator(".canvas-node").boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 90, box.y + 70);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.locator("#object-list button").click();
  await expect(page.locator("#x")).toHaveValue(String(initialX));
  await page.locator("#zoom-in").click();
  await expect(page.locator("#zoom")).toHaveText("120%");
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
  await expect(page.locator("#status")).toHaveText("Saved on this device");
  const other = await context.newPage();
  await other.goto("/");
  await expect(other.locator("#status")).toContainText("Another tab");
  await other.locator("[data-add=text]").click();
  await expect(other.locator("#status")).toContainText("Autosave unavailable");
  await page.reload();
  await expect(page.locator("#count")).toHaveText("1 object");
});
test("keyboard object editing and responsive controls", async ({ page }) => {
  await page.locator("[data-add=text]").click();
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
    indexedDB.open = () => {
      throw new DOMException("Test quota failure", "QuotaExceededError");
    };
  });
  await page.locator("#start").click();
  await expect(page.locator("#status")).toContainText("Save failed");
  await expect(page.locator(".canvas-node")).toHaveCount(1);
  await expect(page.locator("#export")).toBeEnabled();
});
