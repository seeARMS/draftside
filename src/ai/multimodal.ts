import type { ChatImageAttachment, MultimodalInputType } from "../lib/types";
import { CHAT_RESPONSE_CONSTRAINT } from "./constants";

export function multimodalKey(inputTypes: MultimodalInputType[]) {
  return [...new Set(inputTypes)].sort().join("+");
}

export function buildMultimodalOptions(inputTypes: MultimodalInputType[]): LanguageModelCreateCoreOptions {
  return {
    expectedInputs: [
      { type: "text", languages: ["en"] },
      ...[...new Set(inputTypes)].sort().map((type) => ({ type }) as LanguageModelExpected),
    ],
    expectedOutputs: [{ type: "text", languages: ["en"] }],
  };
}

export function asModelContentValue(value: Blob): LanguageModelMessageValue {
  return value as unknown as LanguageModelMessageValue;
}

export async function promptChatModel(model: LanguageModel, prompt: string, images: ChatImageAttachment[] = []) {
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
