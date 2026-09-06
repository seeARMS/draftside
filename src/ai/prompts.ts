import type { ChatMessage, CompletionLength } from "../lib/types";
import { COMPLETION_LENGTH_CONFIG } from "./completion";
import { getCompletionPrefix } from "./text";

function formatChatHistory(history: ChatMessage[]) {
  return history
    .filter((message) => !message.pending && message.content.trim())
    .slice(-8)
    .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content.trim()}`)
    .join("\n\n");
}

export function buildChatPrompt(userPrompt: string, draftText: string, history: ChatMessage[]) {
  const conversation = formatChatHistory(history);

  return `You are Draftside's private local chat model inside an offline writing editor.
You control two surfaces:
1. The chat reply.
2. The main editor draft through draftUpdate.

Use the recent conversation as state, not as disposable context. If the user previously asked for draft work and you asked for missing details, the user's next answer should normally complete that request and update the main editor draft. Do not merely acknowledge a usable brief.

Set draftUpdate to a non-null object when the latest message, interpreted in conversation context, asks you to create or modify the editor text. If the message gives enough information, write the draft instead of asking for another confirmation.
Set draftUpdate to null when the user is only chatting, asking a general question, or exploring ideas without asking the editor text to change.
If a requested editor change is genuinely underspecified, ask exactly one concise clarifying question and keep draftUpdate null.
Interpret typos and casual shorthand normally. A short answer can be enough if it supplies the missing detail you just asked for.

When draftUpdate is non-null, you MUST choose a mode based on the kind of change:
- "append" — draftUpdate.text contains ONLY the new content to add at the end of the current draft. Use this whenever the user is asking to add to the draft without altering what is already there. Examples: "add a conclusion", "add another paragraph", "continue", "write more", "extend this", "add a section about X". Do not include any of the existing draft in draftUpdate.text.
- "prepend" — draftUpdate.text contains ONLY the new content to add at the start of the current draft. Use this for "add an intro", "add a title at the top", "open with X". Do not include any of the existing draft in draftUpdate.text.
- "replace" — draftUpdate.text is the COMPLETE replacement draft. Use this only when the user asks to rewrite, restructure, shorten, lengthen, change tone, translate, or otherwise transform the whole draft.

If you are unsure, prefer append over replace. Never copy the existing draft into draftUpdate.text in append or prepend mode.

draftUpdate.summary is a short phrase describing the editor change. reply is a brief confirmation or orientation, not a copy of the new content. Format draftUpdate.text as Markdown when useful.

Before returning, privately check the result. If draftUpdate is null, the reply must either answer a non-editor question or ask for one truly missing detail; it must not be a simple acknowledgement of an actionable writing brief.

Return exactly one valid compact JSON object and nothing else. Do not use markdown fences.
Use one of these shapes:
{"reply":"short conversational response","draftUpdate":null}
{"reply":"short conversational response","draftUpdate":{"summary":"what changed","text":"new content to add","mode":"append"}}
{"reply":"short conversational response","draftUpdate":{"summary":"what changed","text":"new content to add","mode":"prepend"}}
{"reply":"short conversational response","draftUpdate":{"summary":"what changed","text":"full replacement draft text","mode":"replace"}}

Current draft:
"""${draftText || "(empty)"}"""

Recent conversation:
${conversation || "(none)"}

Latest user message:
"""${userPrompt}"""`;
}

export function buildAmbientPrompt(text: string) {
  return `You are an ambient reader for a writing editor. Read this draft and return one compact JSON object describing it. Be concise and concrete. Avoid generic words like "draft" or "unclear" when you can name something specific. Return exactly one valid JSON object and nothing else. Do not use markdown fences. Use this exact shape: {"form":"","intent":"","stance":"","friction":"","nextMove":"","confidence":0.0,"tags":[""],"observation":""}.

- form: short noun phrase for what kind of writing this is (e.g. "field notes", "argument", "blog post").
- intent: what the writer seems to want from this draft.
- stance: the writer's current posture (e.g. "tentative", "advocating", "questioning").
- friction: the specific thing slowing this draft down right now, in 6 words or fewer.
- nextMove: a concrete next sentence or move the writer could try.
- confidence: 0.0 to 1.0, how sure you are.
- tags: 0 to 4 short topical tags.
- observation: one terse line describing what you notice in the writing right now (under 30 words). No preamble. No "I notice".

Draft:
"""${text}"""`;
}

export function buildCompletionPrompt(before: string, completionLength: CompletionLength = "short") {
  return `You are an inline autocomplete engine for a private writing editor. ${COMPLETION_LENGTH_CONFIG[completionLength].instruction} Return the continuation, starting with the exact unchanged prefix below. The requested length counts only new words after that prefix. The cursor can be inside a word: finish that word without inserting a space. If the last word is already complete, separate the next word with a space. Preserve all existing spaces. No surrounding quotes, markdown, JSON, labels, or commentary.

Examples:
Prefix: "The quick brow"
Response: The quick brown fox jumps over the lazy dog.
Prefix: "The quick brown"
Response: The quick brown fox jumps over the lazy dog.

Required prefix: copy the text between the markers exactly, including spaces, then continue it. Do not include the markers or add quotation marks around the prefix.
<prefix>${getCompletionPrefix(before)}</prefix>

Text before cursor:
"""${before}"""`;
}

export function buildExpressionPrompt(target: string, context: string) {
  return `Suggest alternate wording for the target word or phrase inside its surrounding sentence. Preserve meaning, fit the context, and prefer natural writerly options over thesaurus noise. Return only valid compact JSON with this exact shape: [{"text":"","note":""}]. Include 4 to 6 options. Never include the original target unchanged. If there are no useful replacements, return []. Keep each note under 4 words. Target: ${JSON.stringify(target)}. Context: ${JSON.stringify(context)}.`;
}

export const TRANSCRIBE_PROMPT =
  "Transcribe the attached speech to plain text. Return only the spoken words. Do not summarize, explain, add punctuation beyond natural sentence punctuation, or wrap the result in quotes.";

export function buildTightenPrompt(text: string) {
  return `Tighten this passage without changing meaning or voice. Return only the rewritten passage.\n\n"""${text}"""`;
}
