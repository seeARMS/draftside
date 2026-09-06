import { expect, test, type Page } from "@playwright/test";

const PREFIX = "On weekends our neighborhood meets";
const RESPONSES = {
  short: "to share a meal.",
  medium: "to share a meal in the community garden, where everyone brings something fresh. The children help set the tables while their parents finish cooking together.",
  long: "to share a meal in the community garden, where everyone brings something fresh and the tables fill with dishes from around the world. The children help carry plates while their parents exchange stories about the week and make plans for the next gathering. By the time the sun sets, even the newest neighbors feel like old friends who belong here.",
};

interface CompletionTestState {
  completionPrompts: string[];
  resolveCompletion: Partial<Record<keyof typeof RESPONSES, () => void>>;
  destroyedCompletions: number;
}

async function prepareEditor(page: Page, storedLength?: string, deferResponses = false, completionStart = " ") {
  await page.addInitScript(({ responses, storedLength, deferResponses, completionStart }) => {
    const browser = window as typeof window & CompletionTestState;
    browser.completionPrompts = [];
    browser.resolveCompletion = {};
    browser.destroyedCompletions = 0;
    localStorage.setItem("draftside.onboarded", JSON.stringify({ at: Date.now(), hadApi: true }));
    if (!localStorage.getItem("draftside.uiPrefs")) {
      localStorage.setItem("draftside.uiPrefs", JSON.stringify({ liveAnalysis: false, completionLength: storedLength }));
    }

    // Deterministic Prompt API boundary: the real editor, hooks, cleanup, and storage still run.
    class TestLanguageModel {
      static async availability() { return "available"; }
      static async params() { return {}; }
      static async create() { return new TestLanguageModel(); }
      async clone() { return new TestLanguageModel(); }
      destroy() { browser.destroyedCompletions += 1; }
      async prompt(messages: Array<{ content: string }>) {
        const prompt = messages.map((message) => message.content).join("\n");
        browser.completionPrompts.push(prompt);
        const length = prompt.includes("40 to 80 words") ? "long" : prompt.includes("15 to 30 words") ? "medium" : "short";
        if (deferResponses) {
          await new Promise<void>((resolve) => { browser.resolveCompletion[length] = resolve; });
        }
        const prefix = prompt.split("<prefix>")[1].split("</prefix>")[0];
        return `${prefix}${completionStart}${responses[length]}`;
      }
    }
    Object.defineProperty(window, "LanguageModel", { configurable: true, value: TestLanguageModel });
  }, { responses: RESPONSES, storedLength, deferResponses, completionStart });

  await page.goto("/write");
  await expect(page.locator(".tiptap[contenteditable=true]")).toBeVisible();
}

async function openLengths(page: Page) {
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Completion length/ }).click();
  await expect(page.getByRole("menu", { name: "Completion length", exact: true })).toHaveCSS("opacity", "1");
}

async function acceptCompletion(page: Page, response: string, instruction: string) {
  const editor = page.locator(".tiptap[contenteditable=true]");
  await editor.fill(PREFIX);
  await editor.press("End");
  const ghost = editor.locator(".ProseMirror-widget");
  await expect(ghost).toHaveText(` ${response}`);
  const prompts = await page.evaluate(() => (window as typeof window & { completionPrompts: string[] }).completionPrompts);
  expect(prompts.at(-1)).toContain(instruction);
  await editor.press("Tab");
  await expect(ghost).toHaveCount(0);
  await expect.poll(() => editor.textContent()).toBe(`${PREFIX} ${response}`);
}

test("short remains the default and accepts its suggestion", async ({ page }) => {
  await prepareEditor(page);
  await openLengths(page);
  await expect(page.getByRole("menuitemradio", { name: "Short 3–10 words" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await acceptCompletion(page, RESPONSES.short, "3 to 10 words");
});

for (const length of ["medium", "long"] as const) {
  test(`${length} persists after reload and accepts the full continuation`, async ({ page }, testInfo) => {
    await prepareEditor(page);
    await openLengths(page);
    const label = length === "medium" ? "Medium 15–30 words" : "Long 40–80 words";
    await page.getByRole("menuitemradio", { name: label }).click();
    await expect(page.getByRole("menu", { name: "More actions", exact: true })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("draftside.uiPrefs")!).completionLength)).toBe(length);

    await page.reload();
    await expect(page.locator(".tiptap[contenteditable=true]")).toBeVisible();
    await openLengths(page);
    await expect(page.getByRole("menuitemradio", { name: label })).toHaveAttribute("aria-checked", "true");
    await page.screenshot({ path: testInfo.outputPath(`${length}-setting.png`) });
    await page.getByRole("button", { name: "More actions", exact: true }).click();

    await acceptCompletion(page, RESPONSES[length], length === "medium" ? "15 to 30 words" : "40 to 80 words");
    await page.screenshot({ path: testInfo.outputPath(`${length}-accepted.png`) });
  });
}

test("invalid stored completion length falls back to short", async ({ page }) => {
  await prepareEditor(page, "unrecognized");
  await openLengths(page);
  await expect(page.getByRole("menuitemradio", { name: "Short 3–10 words" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await acceptCompletion(page, RESPONSES.short, "3 to 10 words");
});

test("long completion finishes a partial word and preserves the full paragraph", async ({ page }) => {
  await prepareEditor(page, "long", false, "ts ");
  const editor = page.locator(".tiptap[contenteditable=true]");
  await editor.fill("On weekends our neighborhood mee");
  await editor.press("End");
  await expect(editor.locator(".ProseMirror-widget")).toHaveText(`ts ${RESPONSES.long}`);
  await editor.press("Tab");
  await expect.poll(() => editor.textContent()).toBe(`${PREFIX} ${RESPONSES.long}`);
});

test("changing length discards a completion still being generated", async ({ page }) => {
  await prepareEditor(page, undefined, true);
  const editor = page.locator(".tiptap[contenteditable=true]");
  await editor.fill(PREFIX);
  await editor.press("End");
  await expect.poll(() => page.evaluate(() => Boolean((window as typeof window & CompletionTestState).resolveCompletion.short))).toBe(true);

  await openLengths(page);
  await page.getByRole("menuitemradio", { name: "Long 40–80 words" }).click();
  await expect.poll(() => page.evaluate(() => Boolean((window as typeof window & CompletionTestState).resolveCompletion.long))).toBe(true);
  await page.evaluate(() => (window as typeof window & CompletionTestState).resolveCompletion.long!());
  const ghost = editor.locator(".ProseMirror-widget");
  await expect(ghost).toHaveText(` ${RESPONSES.long}`);

  await page.evaluate(() => (window as typeof window & CompletionTestState).resolveCompletion.short!());
  await expect.poll(() => page.evaluate(() => (window as typeof window & CompletionTestState).destroyedCompletions)).toBe(2);
  await expect(ghost).toHaveText(` ${RESPONSES.long}`);
  await editor.press("Tab");
  await expect(editor).toHaveText(`${PREFIX} ${RESPONSES.long}`);
});

test.describe("narrow touch screen", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("completion length can be changed by touch", async ({ page }) => {
    await prepareEditor(page);
    await page.getByRole("button", { name: "More actions", exact: true }).tap();
    await page.getByRole("menuitem", { name: /^Completion length/ }).tap();
    await page.getByRole("menuitemradio", { name: "Long 40–80 words" }).tap();
    await acceptCompletion(page, RESPONSES.long, "40 to 80 words");
  });
});
