import { expect, test, type Page } from "@playwright/test";

// Only the model response is controlled: the real editor, debounce, cleanup,
// ghost decoration, Tab handler, and IndexedDB persistence run in Chromium.
async function openEditor(page: Page, response: string) {
  await page.addInitScript((text) => {
    localStorage.setItem("draftside.onboarded", JSON.stringify({ at: Date.now(), hadApi: true }));
    localStorage.setItem("draftside.uiPrefs", JSON.stringify({ liveAnalysis: false }));
    class TestLanguageModel {
      static async availability() { return "available"; }
      static async params() { return {}; }
      static async create() { return new TestLanguageModel(); }
      async clone() { return new TestLanguageModel(); }
      async prompt() { return text; }
      destroy() {}
    }
    Object.defineProperty(globalThis, "LanguageModel", { configurable: true, value: TestLanguageModel });
  }, response);
  await page.goto("/write");
  const editor = page.getByLabel("Draftside editor", { exact: true });
  await expect(editor).toBeVisible();
  return editor;
}

const cases = [
  { name: "partial word", before: "The quick brow", response: "The quick brown fox jumps over the lazy dog.", after: "The quick brown fox jumps over the lazy dog." },
  { name: "complete word", before: "The quick brown", response: "The quick brown fox jumps over the lazy dog.", after: "The quick brown fox jumps over the lazy dog." },
  { name: "existing space", before: "The quick brown ", response: "The quick brown fox jumps over the lazy dog.", after: "The quick brown fox jumps over the lazy dog." },
  { name: "consecutive existing spaces", before: "The quick brown  ", response: "The quick brown fox jumps.", after: "The quick brown  fox jumps." },
  { name: "apostrophe suffix", before: "I think it isn", response: "I think it isn't finished yet.", after: "I think it isn't finished yet." },
  { name: "punctuation", before: "Here is the clause", response: "Here is the clause, with more detail.", after: "Here is the clause, with more detail." },
  { name: "sentence-ending punctuation", before: "Here is the clause", response: "Here is the clause. Another sentence.", after: "Here is the clause." },
  { name: "word-limited suggestion", before: "For this exercise we need", response: "For this exercise we need one two three four five six seven eight nine ten eleven twelve thirteen fourteen", after: "For this exercise we need one two three four five six seven eight nine ten eleven twelve" },
  { name: "multiple sentences in context", before: "It was sunny. The quick brow", response: "The quick brown fox jumps.", after: "It was sunny. The quick brown fox jumps." },
];

for (const { name, before, response, after } of cases) {
  test(`Tab accepts ${name} without corrupting the cursor boundary`, async ({ page }, testInfo) => {
    const editor = await openEditor(page, response);
    await editor.fill(before);
    const ghost = editor.locator(".ProseMirror-widget");
    await expect(ghost).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("ghost.png") });
    await editor.press("Tab");
    // Read textContent exactly: toHaveText's whitespace normalization would
    // conceal the duplicate-space regression.
    await expect.poll(() => editor.textContent()).toBe(after);
    await expect(ghost).toHaveCount(0);
    const savedTitle = after.slice(0, 72).replace(/\s+/g, " ");
    await expect(page.getByLabel("Writing sessions").getByRole("button", { name: new RegExp(`^${savedTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) })).toBeVisible();
    await page.reload();
    await expect.poll(() => editor.textContent()).toBe(after);
    await page.screenshot({ path: testInfo.outputPath("accepted.png") });
  });
}

test("a rewritten cursor prefix is not inserted into the draft", async ({ page }) => {
  const editor = await openEditor(page, "A quick brown fox jumps.");
  await editor.fill("The quick brow");
  await page.waitForTimeout(1800);
  await expect(editor.locator(".ProseMirror-widget")).toHaveCount(0);
  expect(await editor.textContent()).toBe("The quick brow");
});

test("Escape dismisses a suggestion without changing the partial word", async ({ page }) => {
  const editor = await openEditor(page, "The quick brown fox jumps.");
  await editor.fill("The quick brow");
  await expect(editor.locator(".ProseMirror-widget")).toBeVisible();
  await editor.press("Escape");
  await expect(editor.locator(".ProseMirror-widget")).toHaveCount(0);
  expect(await editor.textContent()).toBe("The quick brow");
});
