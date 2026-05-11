export const MAX_MODEL_CHARS = 6500;

export const LANGUAGE_MODEL_OPTIONS: LanguageModelCreateCoreOptions = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
};

export const MULTIMODAL_SYSTEM_PROMPT =
  "You are Draftside, a private on-device writing partner inside a minimal editor. Be concise, concrete, and useful. Never claim network access. Prefer the writer's voice over generic advice.";

export const TRANSLATION_LANGUAGES = [
  { code: "ar", label: "Arabic" },
  { code: "bg", label: "Bulgarian" },
  { code: "bn", label: "Bengali" },
  { code: "cs", label: "Czech" },
  { code: "da", label: "Danish" },
  { code: "de", label: "German" },
  { code: "el", label: "Greek" },
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fi", label: "Finnish" },
  { code: "fr", label: "French" },
  { code: "hi", label: "Hindi" },
  { code: "hr", label: "Croatian" },
  { code: "hu", label: "Hungarian" },
  { code: "id", label: "Indonesian" },
  { code: "it", label: "Italian" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "nl", label: "Dutch" },
  { code: "no", label: "Norwegian" },
  { code: "pl", label: "Polish" },
  { code: "pt", label: "Portuguese" },
  { code: "ro", label: "Romanian" },
  { code: "ru", label: "Russian" },
  { code: "sv", label: "Swedish" },
  { code: "th", label: "Thai" },
  { code: "tr", label: "Turkish" },
  { code: "uk", label: "Ukrainian" },
  { code: "vi", label: "Vietnamese" },
  { code: "zh", label: "Chinese" },
  { code: "zh-Hant", label: "Chinese Traditional" },
];

export const CHAT_RESPONSE_CONSTRAINT: Record<string, unknown> = {
  type: "object",
  properties: {
    reply: { type: "string" },
    draftUpdate: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          properties: {
            summary: { type: "string" },
            text: { type: "string" },
          },
          required: ["summary", "text"],
          additionalProperties: false,
        },
      ],
    },
  },
  required: ["reply", "draftUpdate"],
  additionalProperties: false,
};
