import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { AiStatus, ModelRuntimeInfo, MultimodalInputType } from "../../../lib/types";
import { LANGUAGE_MODEL_OPTIONS, MULTIMODAL_SYSTEM_PROMPT } from "../../../ai/constants";
import { buildMultimodalOptions, multimodalKey } from "../../../ai/multimodal";

interface AiSessionDeps {
  setAiStatus: (next: AiStatus | ((current: AiStatus) => AiStatus)) => void;
  setModelInfo: Dispatch<SetStateAction<ModelRuntimeInfo>>;
  setAiError: (next: string) => void;
  setAiProgress: (next: number | null) => void;
}

export function useAiSession({ setAiStatus, setModelInfo, setAiError, setAiProgress }: AiSessionDeps) {
  const languageModelRef = useRef<LanguageModel | null>(null);
  const creatingModelRef = useRef<Promise<LanguageModel> | null>(null);
  const multimodalModelsRef = useRef(new Map<string, LanguageModel>());
  const creatingMultimodalRef = useRef(new Map<string, Promise<LanguageModel>>());
  const autoPrepareStartedRef = useRef(false);

  const ensureLanguageModel = useCallback(async () => {
    if (languageModelRef.current) return languageModelRef.current;
    if (creatingModelRef.current) return creatingModelRef.current;

    if (!("LanguageModel" in globalThis)) {
      setAiStatus("unsupported");
      throw new Error("Chrome built-in AI is not available in this browser.");
    }

    creatingModelRef.current = (async () => {
      setAiError("");
      setAiProgress(null);
      setModelInfo((current) => ({ ...current, loading: true, checkedAt: Date.now() }));

      let availability: Availability | "error" = "error";

      try {
        availability = await LanguageModel.availability(LANGUAGE_MODEL_OPTIONS);
        setAiStatus(availability);
        if (availability === "unavailable") {
          throw new Error("Gemini Nano is unavailable on this device or Chrome profile.");
        }

        setAiStatus("creating");
        const session = await LanguageModel.create({
          ...LANGUAGE_MODEL_OPTIONS,
          initialPrompts: [{ role: "system", content: MULTIMODAL_SYSTEM_PROMPT }],
          monitor(monitor) {
            monitor.addEventListener("downloadprogress", (event) => {
              const progress =
                event.lengthComputable && event.total > 0
                  ? event.loaded / event.total
                  : event.loaded <= 1
                    ? event.loaded
                    : 0;
              setAiStatus("downloading");
              setAiProgress(Math.max(0, Math.min(1, progress)));
            });
          },
        });

        languageModelRef.current = session;
        setAiStatus("available");
        setAiProgress(null);
        setModelInfo((current) => ({
          ...current,
          loading: false,
          availability: "available",
          contextUsage: session.contextUsage,
          contextWindow: session.contextWindow,
          temperature: session.temperature,
          topK: session.topK,
          checkedAt: Date.now(),
        }));
        return session;
      } catch (error) {
        const failedStatus: AiStatus = availability === "unavailable" ? "unavailable" : "error";
        setAiStatus(failedStatus);
        setAiProgress(null);
        setModelInfo((current) => ({
          ...current,
          loading: false,
          availability: failedStatus,
          checkedAt: Date.now(),
        }));
        throw error;
      }
    })();

    try {
      return await creatingModelRef.current;
    } finally {
      creatingModelRef.current = null;
    }
  }, [setAiError, setAiProgress, setAiStatus, setModelInfo]);

  const createLanguageModelTask = useCallback(async (signal?: AbortSignal) => {
    const baseSession = await ensureLanguageModel();

    try {
      return await baseSession.clone({ signal });
    } catch (error) {
      if (signal?.aborted) throw error;

      return LanguageModel.create({
        ...LANGUAGE_MODEL_OPTIONS,
        initialPrompts: [{ role: "system", content: MULTIMODAL_SYSTEM_PROMPT }],
        signal,
      });
    }
  }, [ensureLanguageModel]);

  const ensureMultimodalLanguageModel = useCallback(async (inputTypes: MultimodalInputType[]) => {
    const key = multimodalKey(inputTypes);
    const existing = multimodalModelsRef.current.get(key);
    if (existing) return existing;

    const pending = creatingMultimodalRef.current.get(key);
    if (pending) return pending;

    if (!("LanguageModel" in globalThis)) {
      throw new Error("Chrome built-in AI is not available in this browser.");
    }

    const options = buildMultimodalOptions(inputTypes);
    const promise = (async () => {
      setAiProgress(null);

      const availability = await LanguageModel.availability(options);
      if (availability === "unavailable") {
        throw new Error("Gemini Nano multimodal input is unavailable on this device or Chrome profile.");
      }

      const session = await LanguageModel.create({
        ...options,
        initialPrompts: [{ role: "system", content: MULTIMODAL_SYSTEM_PROMPT }],
        monitor(monitor) {
          monitor.addEventListener("downloadprogress", (event) => {
            const progress =
              event.lengthComputable && event.total > 0
                ? event.loaded / event.total
                : event.loaded <= 1
                  ? event.loaded
                  : 0;
            setAiProgress(Math.max(0, Math.min(1, progress)));
          });
        },
      });

      multimodalModelsRef.current.set(key, session);
      setAiProgress(null);
      return session;
    })();

    creatingMultimodalRef.current.set(key, promise);

    try {
      return await promise;
    } finally {
      creatingMultimodalRef.current.delete(key);
      setAiProgress(null);
    }
  }, [setAiProgress]);

  const createMultimodalLanguageModelTask = useCallback(
    async (inputTypes: MultimodalInputType[], signal?: AbortSignal) => {
      const baseSession = await ensureMultimodalLanguageModel(inputTypes);

      try {
        return await baseSession.clone({ signal });
      } catch (error) {
        if (signal?.aborted) throw error;

        return LanguageModel.create({
          ...buildMultimodalOptions(inputTypes),
          initialPrompts: [{ role: "system", content: MULTIMODAL_SYSTEM_PROMPT }],
          signal,
        });
      }
    },
    [ensureMultimodalLanguageModel],
  );

  const destroyAllModels = useCallback(() => {
    languageModelRef.current?.destroy();
    languageModelRef.current = null;
    multimodalModelsRef.current.forEach((session) => session.destroy());
    multimodalModelsRef.current.clear();
  }, []);

  const refreshModelInfo = useCallback(async () => {
    if (!("LanguageModel" in globalThis)) {
      setAiStatus((current) => (current === "creating" || current === "downloading" ? current : "unsupported"));
      setModelInfo({
        loading: false,
        availability: "unsupported",
        checkedAt: Date.now(),
      });
      return;
    }

    setModelInfo((current) => ({ ...current, loading: true }));

    let availability: Availability | "error" = "error";
    let params: Partial<LanguageModelParams> | undefined;
    let paramsError = "";

    try {
      availability = await LanguageModel.availability(LANGUAGE_MODEL_OPTIONS);
    } catch {
      availability = "error";
    }

    try {
      params = await LanguageModel.params();
    } catch (error) {
      paramsError = error instanceof Error ? error.message : "Chrome did not expose sampling params.";
    }

    setAiStatus((current) => (current === "creating" || current === "downloading" ? current : availability));

    const session = languageModelRef.current;
    setModelInfo({
      loading: false,
      availability,
      params,
      paramsError,
      contextUsage: session?.contextUsage,
      contextWindow: session?.contextWindow,
      temperature: session?.temperature,
      topK: session?.topK,
      checkedAt: Date.now(),
    });
  }, [setAiStatus, setModelInfo]);

  useEffect(() => {
    if (autoPrepareStartedRef.current || !("LanguageModel" in globalThis)) return;
    autoPrepareStartedRef.current = true;
    void (async () => {
      try {
        const availability = await LanguageModel.availability(LANGUAGE_MODEL_OPTIONS);
        if (availability !== "available") return;
        await ensureLanguageModel();
      } catch (error) {
        setAiError(error instanceof Error ? error.message : "Could not start the local model.");
      }
    })();
  }, [ensureLanguageModel, setAiError]);

  return {
    languageModelRef,
    creatingModelRef,
    ensureLanguageModel,
    ensureMultimodalLanguageModel,
    createLanguageModelTask,
    createMultimodalLanguageModelTask,
    destroyAllModels,
    refreshModelInfo,
  };
}
