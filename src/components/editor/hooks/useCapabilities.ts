import { useEffect, useState } from "react";
import type { AiStatus, Capabilities, ModelRuntimeInfo } from "../../../lib/types";
import { LANGUAGE_MODEL_OPTIONS } from "../../../ai/constants";

interface CapabilitiesState {
  capabilities: Capabilities;
  aiStatus: AiStatus;
  modelInfo: ModelRuntimeInfo;
}

const INITIAL_CAPABILITIES: Capabilities = {
  prompt: false,
  rewriter: false,
  detector: false,
  translator: false,
};

export function useCapabilities() {
  const [state, setState] = useState<CapabilitiesState>({
    capabilities: INITIAL_CAPABILITIES,
    aiStatus: "idle",
    modelInfo: { loading: false },
  });

  useEffect(() => {
    let mounted = true;

    async function detectCapabilities() {
      const capabilities: Capabilities = {
        prompt: "LanguageModel" in globalThis,
        rewriter: "Rewriter" in globalThis,
        detector: "LanguageDetector" in globalThis,
        translator: "Translator" in globalThis,
      };

      if (!mounted) return;

      if (!capabilities.prompt) {
        setState({
          capabilities,
          aiStatus: "unsupported",
          modelInfo: {
            loading: false,
            availability: "unsupported",
            checkedAt: Date.now(),
          },
        });
        return;
      }

      setState((current) => ({ ...current, capabilities, aiStatus: "checking" }));

      try {
        const availability = await LanguageModel.availability(LANGUAGE_MODEL_OPTIONS);
        let params: Partial<LanguageModelParams> | undefined;
        let paramsError = "";

        try {
          params = await LanguageModel.params();
        } catch (error) {
          paramsError = error instanceof Error ? error.message : "Chrome did not expose sampling params.";
        }

        if (!mounted) return;
        setState({
          capabilities,
          aiStatus: availability,
          modelInfo: {
            loading: false,
            availability,
            params,
            paramsError,
            checkedAt: Date.now(),
          },
        });
      } catch {
        if (!mounted) return;
        setState({
          capabilities,
          aiStatus: "error",
          modelInfo: {
            loading: false,
            availability: "error",
            checkedAt: Date.now(),
          },
        });
      }
    }

    void detectCapabilities();
    return () => {
      mounted = false;
    };
  }, []);

  return [state, setState] as const;
}
