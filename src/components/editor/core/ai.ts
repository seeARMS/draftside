import type { ChatImageAttachment, ChatMessage, Classification, DraftUpdate, MultimodalInputType } from "./types";
import { CHAT_RESPONSE_CONSTRAINT, MAX_MODEL_CHARS, MULTIMODAL_SYSTEM_PROMPT } from "./constants";
import { extractJsonObject, stripJsonFences } from "./json";

function truncateForModel(text: string, limit = MAX_MODEL_CHARS) {
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.floor(limit * 0.55))}\n\n[...]\n\n${text.slice(-Math.floor(limit * 0.4))}`;
}

function normalizeDraftUpdate(raw: unknown): DraftUpdate | null {
  const data = raw && typeof raw === "object" ? (raw as { text?: unknown; markdown?: unknown; summary?: unknown }) : null;
  if (!data) return null;

  const text = typeof data.text === "string" ? data.text.trim() : typeof data.markdown === "string" ? data.markdown.trim() : "";
  if (!text) return null;

  const summary = typeof data.summary === "string" && data.summary.trim() ? data.summary.trim().slice(0, 120) : "Updated the draft";
  return { text, summary };
}

function parseChatResponse(input: string): { reply: string; draftUpdate: DraftUpdate | null } {
  const json = extractJsonObject(input);

  if (json) {
    try {
      const data = JSON.parse(json) as { reply?: unknown; draftUpdate?: unknown; update?: unknown };
      const reply = typeof data.reply === "string" ? data.reply.trim() : "";
      return {
        reply: reply || "Done.",
        draftUpdate: normalizeDraftUpdate(data.draftUpdate ?? data.update ?? null),
      };
    } catch {
      // Fall through to plain text so the chat never exposes JSON parser errors.
    }
  }

  return {
    reply: stripJsonFences(input).trim() || "I could not produce a local response.",
    draftUpdate: null,
  };
}

function formatChatHistory(history: ChatMessage[]) {
  return history
    .filter((message) => !message.pending && message.content.trim())
    .slice(-8)
    .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content.trim()}`)
    .join("\n\n");
}

function buildChatPrompt(userPrompt: string, draftText: string, history: ChatMessage[]) {
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

When draftUpdate is non-null:
- draftUpdate.text is the complete replacement draft, formatted as Markdown when useful.
- draftUpdate.summary is a short phrase describing the editor change.
- reply is a brief confirmation or orientation, not a copy of the full draft.

Before returning, privately check the result. If draftUpdate is null, the reply must either answer a non-editor question or ask for one truly missing detail; it must not be a simple acknowledgement of an actionable writing brief.

Return exactly one valid compact JSON object and nothing else. Do not use markdown fences.
Use one of these shapes:
{"reply":"short conversational response","draftUpdate":null}
{"reply":"short conversational response","draftUpdate":{"summary":"what changed","text":"full replacement draft text"}}

Current draft:
"""${draftText || "(empty)"}"""

Recent conversation:
${conversation || "(none)"}

Latest user message:
"""${userPrompt}"""`;
}

async function promptChatModel(model: LanguageModel, prompt: string, images: ChatImageAttachment[] = []) {
  const content: LanguageModelMessageContent[] | string = images.length
    ? [
        { type: "text", value: prompt },
        ...images.map((image) => ({
          type: "image" as const,
          value: asModelContentValue(image.file),
        })),
      ]
    : prompt;
  const messages: LanguageModelPrompt = [{ role: "user", content }];

  try {
    return await model.prompt(messages, {
      responseConstraint: CHAT_RESPONSE_CONSTRAINT,
      omitResponseConstraintInput: false,
    });
  } catch (errorWithConstraint) {
    try {
      return await model.prompt(messages);
    } catch {
      throw errorWithConstraint;
    }
  }
}

function looseClassificationField(input: string, field: keyof Classification) {
  const match = input.match(new RegExp(`["']?${field}["']?\\s*[:=]\\s*["']?([^"',}\\]\\n]+)`, "i"));
  return match?.[1]?.trim();
}

function looseClassificationTags(input: string) {
  const tags = input.match(/["']?tags["']?\s*[:=]\s*\[([^\]]*)\]/i)?.[1];
  if (!tags) return [];

  return tags
    .split(",")
    .map((tag) => tag.replace(/^["'\s]+|["'\s]+$/g, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

function looseClassification(input: string): Classification {
  const confidence = Number(looseClassificationField(input, "confidence"));

  return normalizeClassification({
    form: looseClassificationField(input, "form"),
    intent: looseClassificationField(input, "intent"),
    stance: looseClassificationField(input, "stance"),
    friction: looseClassificationField(input, "friction"),
    nextMove: looseClassificationField(input, "nextMove"),
    confidence: Number.isFinite(confidence) ? confidence : undefined,
    tags: looseClassificationTags(input),
  });
}

function parseClassification(input: string) {
  const json = extractJsonObject(input);
  if (json) {
    try {
      return normalizeClassification(JSON.parse(json));
    } catch {
      // Fall through to a loose parse so local model formatting errors do not surface to the UI.
    }
  }

  return looseClassification(input);
}

function normalizeClassification(raw: unknown): Classification {
  const data = raw && typeof raw === "object" ? (raw as Partial<Classification>) : {};

  return {
    form: typeof data.form === "string" ? data.form : "draft",
    intent: typeof data.intent === "string" ? data.intent : "unclear",
    stance: typeof data.stance === "string" ? data.stance : "developing",
    friction: typeof data.friction === "string" ? data.friction : "needs more context",
    nextMove: typeof data.nextMove === "string" ? data.nextMove : "write the next concrete sentence",
    confidence: typeof data.confidence === "number" ? Math.max(0, Math.min(1, data.confidence)) : 0.5,
    tags: Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 5) : [],
    observation: typeof data.observation === "string" ? data.observation.trim().slice(0, 220) : undefined,
  };
}

function buildAmbientPrompt(text: string) {
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

function parseAmbientResponse(input: string): Classification {
  const json = extractJsonObject(input);

  if (json) {
    try {
      return normalizeClassification(JSON.parse(json));
    } catch {
      // Fall through to loose parse so a bad JSON does not kill the ambient pass.
    }
  }

  const loose = looseClassification(input);
  const observationMatch = input.match(/["']?observation["']?\s*[:=]\s*["']([^"']+)["']/i);
  if (observationMatch?.[1]) {
    loose.observation = observationMatch[1].trim().slice(0, 220);
  }
  return loose;
}

function fingerprintText(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return `${text.length}:${hash}`;
}

function mergeStreamChunk(previous: string, chunk: string) {
  if (!chunk) return previous;
  if (chunk.startsWith(previous)) return chunk;
  return `${previous}${chunk}`;
}

async function readTextStream(stream: ReadableStream<string>, onText: (text: string) => void) {
  const reader = stream.getReader();
  let result = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    result = mergeStreamChunk(result, value ?? "");
    onText(result);
  }

  return result;
}

function multimodalKey(inputTypes: MultimodalInputType[]) {
  return [...new Set(inputTypes)].sort().join("+");
}

function buildMultimodalOptions(inputTypes: MultimodalInputType[]): LanguageModelCreateCoreOptions {
  return {
    expectedInputs: [
      { type: "text", languages: ["en"] },
      ...[...new Set(inputTypes)].sort().map((type) => ({ type }) as LanguageModelExpected),
    ],
    expectedOutputs: [{ type: "text", languages: ["en"] }],
  };
}

function asModelContentValue(value: Blob): LanguageModelMessageValue {
  return value as unknown as LanguageModelMessageValue;
}

export {
  asModelContentValue,
  buildAmbientPrompt,
  buildChatPrompt,
  buildMultimodalOptions,
  fingerprintText,
  looseClassification,
  mergeStreamChunk,
  multimodalKey,
  normalizeClassification,
  parseAmbientResponse,
  parseChatResponse,
  parseClassification,
  promptChatModel,
  readTextStream,
  truncateForModel,
};
