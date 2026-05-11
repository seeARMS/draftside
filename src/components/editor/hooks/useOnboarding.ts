import { useCallback, useEffect, useState } from "react";
import type { AiStatus, ModelRuntimeInfo } from "../../../lib/types";

const ONBOARDED_KEY = "draftside.onboarded";

interface OnboardedRecord {
  at: number;
  hadApi: boolean;
  availability?: string;
}

interface UseOnboardingParams {
  aiStatus: AiStatus;
  modelInfo: ModelRuntimeInfo;
}

function readRecord(): OnboardedRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ONBOARDED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardedRecord;
    if (typeof parsed?.at !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeRecord(record: OnboardedRecord) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ONBOARDED_KEY, JSON.stringify(record));
  } catch {
    // Storage may be unavailable in private mode; ignore.
  }
}

function detectChromeFamily(): boolean {
  if (typeof navigator === "undefined") return false;
  const uaData = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData;
  if (uaData?.brands?.length) {
    return uaData.brands.some((brand) => /chromium|google chrome|microsoft edge|brave/i.test(brand.brand));
  }
  const ua = navigator.userAgent || "";
  if (/Edg\/|Chrome\/|Chromium\//.test(ua) && !/Firefox|FxiOS/.test(ua)) return true;
  return false;
}

export function useOnboarding({ aiStatus, modelInfo }: UseOnboardingParams) {
  const [hasApi, setHasApi] = useState<boolean | null>(null);
  const [isChromeFamily, setIsChromeFamily] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const apiPresent = typeof globalThis !== "undefined" && "LanguageModel" in globalThis;
    setHasApi(apiPresent);
    setIsChromeFamily(detectChromeFamily());

    const record = readRecord();
    if (!record) {
      setShouldShow(true);
      return;
    }
    // Re-show if the user previously dismissed without the API and now has it.
    if (!record.hadApi && apiPresent) {
      setShouldShow(true);
      return;
    }
    setShouldShow(false);
  }, []);

  const dismiss = useCallback(() => {
    writeRecord({
      at: Date.now(),
      hadApi: hasApi ?? false,
      availability: modelInfo.availability,
    });
    setShouldShow(false);
  }, [hasApi, modelInfo.availability]);

  const reopen = useCallback(() => {
    setShouldShow(true);
  }, []);

  return {
    shouldShow,
    hasApi,
    isChromeFamily,
    aiStatus,
    modelInfo,
    dismiss,
    reopen,
  };
}
