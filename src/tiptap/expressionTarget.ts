import type { Editor } from "@tiptap/core";
import type { ExpressionPosition, ExpressionTarget } from "../lib/types";
import { countWords } from "../lib/session";

function expressionPopoverPosition(rect: Pick<DOMRect, "bottom" | "height" | "left" | "top" | "width">): ExpressionPosition {
  const width = Math.min(320, Math.max(240, window.innerWidth - 24));
  const halfWidth = width / 2;
  const left = Math.round(Math.min(Math.max(rect.left + rect.width / 2, halfWidth + 12), window.innerWidth - halfWidth - 12));
  const below = rect.bottom + 10;
  const top = below + 236 > window.innerHeight ? Math.max(12, rect.top - 246) : below;

  return { left, top: Math.round(top) };
}

export function expressionTargetFromSelection(editor: Editor): ExpressionTarget | null {
  const { from, to, empty } = editor.state.selection;
  if (empty) return null;

  const targetText = editor.state.doc.textBetween(from, to, " ").replace(/\s+/g, " ").trim();
  if (!targetText || targetText.length > 160 || countWords(targetText) > 12) return null;

  const selection = window.getSelection();
  let rect: Pick<DOMRect, "bottom" | "height" | "left" | "top" | "width"> | null = null;

  if (selection?.rangeCount) {
    const selectedRect = selection.getRangeAt(0).getBoundingClientRect();
    if (selectedRect.width || selectedRect.height) rect = selectedRect;
  }

  if (!rect) {
    const start = editor.view.coordsAtPos(from);
    const end = editor.view.coordsAtPos(to);
    const left = Math.min(start.left, end.left);
    const right = Math.max(start.right, end.right);
    const top = Math.min(start.top, end.top);
    const bottom = Math.max(start.bottom, end.bottom);
    rect = { bottom, height: bottom - top, left, top, width: right - left };
  }

  return {
    from,
    to,
    text: targetText,
    position: expressionPopoverPosition(rect),
  };
}
