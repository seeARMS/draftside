import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { CompletionContext, GhostCompletionState } from "../lib/types";
import { countWords } from "../lib/session";
import { stripJsonFences } from "../lib/json";
import { truncateForModel } from "../ai/text";

export const ghostCompletionKey = new PluginKey<GhostCompletionState>("draftsideGhostCompletion");

export const GhostCompletion = Extension.create({
  name: "ghostCompletion",

  addProseMirrorPlugins() {
    return [
      new Plugin<GhostCompletionState>({
        key: ghostCompletionKey,
        state: {
          init: () => ({ pos: null, text: "" }),
          apply(transaction, previous) {
            const meta = transaction.getMeta(ghostCompletionKey) as Partial<GhostCompletionState> & { clear?: boolean } | undefined;

            if (meta?.clear) return { pos: null, text: "" };
            if (typeof meta?.text === "string" && typeof meta.pos === "number") {
              return { pos: meta.pos, text: meta.text };
            }

            if (!previous.text || previous.pos === null) return previous;
            if (!transaction.docChanged && !transaction.selectionSet) return previous;

            const mappedPos = transaction.mapping.map(previous.pos, -1);
            if (!transaction.selection.empty || transaction.selection.from !== mappedPos) {
              return { pos: null, text: "" };
            }

            return { pos: mappedPos, text: previous.text };
          },
        },
        props: {
          decorations(state) {
            const completion = ghostCompletionKey.getState(state);
            if (!completion?.text || completion.pos === null) return DecorationSet.empty;

            return DecorationSet.create(state.doc, [
              Decoration.widget(
                completion.pos,
                () => {
                  const ghost = document.createElement("span");
                  ghost.className = "ghost-completion";
                  ghost.textContent = completion.text;
                  ghost.setAttribute("aria-hidden", "true");
                  return ghost;
                },
                {
                  key: `${completion.pos}:${completion.text}`,
                  side: 1,
                },
              ),
            ]);
          },
        },
      }),
    ];
  },
});

export function getEditorGhostCompletion(editor: Editor) {
  return ghostCompletionKey.getState(editor.state) ?? { pos: null, text: "" };
}

export function setEditorGhostCompletion(editor: Editor, text: string, pos: number) {
  editor.view.dispatch(editor.state.tr.setMeta(ghostCompletionKey, { text, pos }));
}

export function clearEditorGhostCompletion(editor: Editor) {
  const completion = getEditorGhostCompletion(editor);
  if (!completion.text) return;
  editor.view.dispatch(editor.state.tr.setMeta(ghostCompletionKey, { clear: true }));
}

function completionFingerprint(editor: Editor, pos: number) {
  return editor.state.doc.textBetween(Math.max(0, pos - 180), pos, "\n", "\n");
}

export function getCompletionContext(editor: Editor): CompletionContext | null {
  const { selection } = editor.state;
  if (!selection.empty) return null;
  if (editor.isActive("codeBlock")) return null;

  const pos = selection.from;
  const before = editor.state.doc.textBetween(Math.max(0, pos - 1200), pos, "\n", "\n");
  const compactBefore = before.replace(/\s+/g, " ");
  const trimmed = compactBefore.trimEnd();

  if (trimmed.length < 12 || countWords(trimmed) < 3) return null;
  if (/[.!?]$/.test(trimmed)) return null;

  const fragment = trimmed.split(/(?<=[.!?])\s+/u).pop()?.trim() ?? trimmed;
  if (fragment.length < 8 || countWords(fragment) < 2) return null;
  if (/^[\W_]+$/u.test(fragment)) return null;

  return {
    before: truncateForModel(compactBefore, 1800),
    fingerprint: completionFingerprint(editor, pos),
    fragment,
    pos,
  };
}

export function cleanGhostCompletion(input: string, context: CompletionContext) {
  let completion = stripJsonFences(input)
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!completion) return "";

  const fragment = context.fragment.trim();
  if (completion.toLocaleLowerCase().startsWith(fragment.toLocaleLowerCase())) {
    completion = completion.slice(fragment.length).trimStart();
  }

  completion = completion.replace(/^[….\s]+/, "").trim();
  const sentenceEnd = completion.search(/[.!?](?:\s|$)/);
  if (sentenceEnd > 0) completion = completion.slice(0, sentenceEnd + 1).trim();

  const words = completion.split(/\s+/).filter(Boolean);
  if (words.length > 12) completion = words.slice(0, 12).join(" ");
  if (!completion || completion === fragment) return "";

  const previousCharacter = context.fingerprint.trimEnd().slice(-1);
  if (completion && !/^[,.;:!?)]/.test(completion) && previousCharacter && !/[\s([{/"'“‘-]/.test(previousCharacter)) {
    completion = ` ${completion}`;
  }

  return completion.length > 96 ? completion.slice(0, 96).replace(/\s+\S*$/, "") : completion;
}
