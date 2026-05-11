import { useEffect, useRef, useState } from "react";
import { Globe, Download, Loader2, Sparkles, CheckCircle2, AlertTriangle, ArrowDownToLine } from "lucide-react";
import type { AiStatus, ModelRuntimeInfo } from "../../../lib/types";
import { formatPercent } from "../../../lib/formatters";

interface OnboardingDialogProps {
  hasApi: boolean | null;
  isChromeFamily: boolean;
  aiStatus: AiStatus;
  modelInfo: ModelRuntimeInfo;
  aiProgress: number | null;
  pwaInstallAvailable: boolean;
  pwaInstalled: boolean;
  onStartDownload: () => Promise<void>;
  onInstallPwa: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onDismiss: () => void;
}

type Step =
  | "checking"
  | "chrome-setup"
  | "non-chrome"
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "ready"
  | "error";

function resolveStep({
  hasApi,
  isChromeFamily,
  aiStatus,
  modelInfo,
}: Pick<OnboardingDialogProps, "hasApi" | "isChromeFamily" | "aiStatus" | "modelInfo">): Step {
  if (hasApi === null) return "checking";
  if (!hasApi) return isChromeFamily ? "chrome-setup" : "non-chrome";

  // In-flight session states take precedence over any cached availability value.
  if (aiStatus === "creating" || aiStatus === "downloading") return "downloading";
  if (aiStatus === "checking" || aiStatus === "idle") return "checking";

  // Trust the most recent availability check over any stale aiStatus (e.g. lingering "error").
  const availability = modelInfo.availability ?? aiStatus;
  if (availability === "available") return "ready";
  if (availability === "downloadable") return "downloadable";
  if (availability === "downloading") return "downloading";
  if (availability === "unavailable") return "unavailable";
  if (availability === "error" || aiStatus === "error") return "error";

  return "checking";
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled]), textarea:not([disabled])';

function useDialogFocus(step: Step) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = (document.activeElement as HTMLElement | null) ?? null;
    return () => {
      const target = previousFocusRef.current;
      if (target && typeof target.focus === "function" && document.contains(target)) {
        target.focus();
      }
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (dialog.contains(document.activeElement)) return;
    const focusables = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    focusables[0]?.focus();
  }, [step]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return dialogRef;
}

export function OnboardingDialog(props: OnboardingDialogProps) {
  const {
    hasApi,
    isChromeFamily,
    aiStatus,
    modelInfo,
    aiProgress,
    pwaInstallAvailable,
    pwaInstalled,
    onStartDownload,
    onInstallPwa,
    onRefresh,
    onDismiss,
  } = props;

  const [downloadStarting, setDownloadStarting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [installing, setInstalling] = useState(false);

  const step = resolveStep({ hasApi, isChromeFamily, aiStatus, modelInfo });
  const dialogRef = useDialogFocus(step);

  async function handleStartDownload() {
    setDownloadStarting(true);
    try {
      await onStartDownload();
    } finally {
      setDownloadStarting(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleInstall() {
    setInstalling(true);
    try {
      await onInstallPwa();
    } finally {
      setInstalling(false);
      onDismiss();
    }
  }

  return (
    <div
      className="onboarding-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <div
        className="onboarding-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        ref={dialogRef}
      >
        <header className="onboarding-header">
          <div className="onboarding-eyebrow">
            <Sparkles size={14} aria-hidden="true" />
            <span>Welcome to Draftside</span>
          </div>
          <button type="button" className="onboarding-skip" onClick={onDismiss} aria-label="Skip and continue to editor">
            Skip
          </button>
        </header>

        {step === "checking" ? (
          <CheckingPanel />
        ) : step === "chrome-setup" ? (
          <ChromeSetupPanel onRefresh={handleRefresh} onContinue={onDismiss} refreshing={refreshing} />
        ) : step === "non-chrome" ? (
          <NonChromePanel onContinue={onDismiss} />
        ) : step === "unavailable" ? (
          <UnavailablePanel onRefresh={handleRefresh} onContinue={onDismiss} refreshing={refreshing} />
        ) : step === "downloadable" ? (
          <DownloadablePanel
            onStartDownload={handleStartDownload}
            onContinue={onDismiss}
            starting={downloadStarting}
          />
        ) : step === "downloading" ? (
          <DownloadingPanel progress={aiProgress} onContinue={onDismiss} />
        ) : step === "ready" ? (
          <ReadyPanel
            pwaInstallAvailable={pwaInstallAvailable}
            pwaInstalled={pwaInstalled}
            installing={installing}
            onInstall={handleInstall}
            onContinue={onDismiss}
          />
        ) : (
          <ErrorPanel onRetry={handleRefresh} onContinue={onDismiss} refreshing={refreshing} />
        )}
      </div>
    </div>
  );
}

function CheckingPanel() {
  return (
    <div className="onboarding-body">
      <h2 id="onboarding-title">Checking your browser…</h2>
      <p>Looking for Chrome's built-in AI. This takes a second.</p>
      <div className="onboarding-spinner" aria-hidden="true">
        <Loader2 className="spin" size={18} />
      </div>
    </div>
  );
}

function ChromeSetupPanel({
  onRefresh,
  onContinue,
  refreshing,
}: {
  onRefresh: () => void;
  onContinue: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="onboarding-body">
      <div className="onboarding-icon onboarding-icon-accent" aria-hidden="true">
        <Sparkles size={20} />
      </div>
      <h2 id="onboarding-title">Almost there — Chrome needs to expose the AI API</h2>
      <p>
        You're on a Chromium-based browser, but the on-device <code>LanguageModel</code> API isn't visible to this page
        yet. Updating Chrome and enabling one flag usually fixes it.
      </p>
      <ol className="onboarding-steps">
        <li>
          Open <code>chrome://settings/help</code> and update to the latest Chrome (138+ recommended). Relaunch when
          prompted.
        </li>
        <li>
          Open <code>chrome://flags/#prompt-api-for-gemini-nano</code> and set it to <strong>Enabled</strong>.
        </li>
        <li>Click <strong>Relaunch</strong> at the bottom of the flags page.</li>
        <li>Come back to this tab and click <em>Re-check</em>.</li>
      </ol>
      <p className="onboarding-fineprint">
        If you're on a non-Google Chromium variant (Brave, Arc, Vivaldi, …), the API may not ship in your build yet. The
        editor still works without AI.
      </p>
      <div className="onboarding-actions">
        <button type="button" className="onboarding-secondary" onClick={onContinue}>
          Continue to editor
        </button>
        <button type="button" className="onboarding-primary" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? <Loader2 className="spin" size={14} /> : null}
          {refreshing ? "Checking" : "Re-check"}
        </button>
      </div>
    </div>
  );
}

function NonChromePanel({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="onboarding-body">
      <div className="onboarding-icon onboarding-icon-info" aria-hidden="true">
        <Globe size={20} />
      </div>
      <h2 id="onboarding-title">You can write here. AI features need Chrome.</h2>
      <p>
        Draftside runs AI locally via Chrome's built-in Gemini Nano. The editor, drafts, and offline cache still work in
        your current browser — the AI features are the part that needs Chrome.
      </p>
      <div className="onboarding-callout">
        <strong>What still works here:</strong>
        <ul>
          <li>Writing, formatting, and saving drafts</li>
          <li>Private Vault with passkey encryption</li>
          <li>Offline access once the app loads</li>
        </ul>
      </div>
      <div className="onboarding-actions">
        <a
          className="onboarding-secondary"
          href="https://www.google.com/chrome/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Get Chrome
        </a>
        <button type="button" className="onboarding-primary" onClick={onContinue}>
          Continue to editor
        </button>
      </div>
    </div>
  );
}

function UnavailablePanel({
  onRefresh,
  onContinue,
  refreshing,
}: {
  onRefresh: () => void;
  onContinue: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="onboarding-body">
      <div className="onboarding-icon onboarding-icon-warn" aria-hidden="true">
        <AlertTriangle size={20} />
      </div>
      <h2 id="onboarding-title">Gemini Nano isn't ready in this Chrome profile yet</h2>
      <p>
        Chrome exposes the LanguageModel API here, but the on-device model isn't available. This is usually fixed by
        enabling two flags and restarting Chrome.
      </p>
      <ol className="onboarding-steps">
        <li>
          Open <code>chrome://flags/#optimization-guide-on-device-model</code> and set it to{" "}
          <strong>Enabled BypassPerfRequirement</strong>.
        </li>
        <li>
          Open <code>chrome://flags/#prompt-api-for-gemini-nano</code> and set it to <strong>Enabled</strong>.
        </li>
        <li>Click <strong>Relaunch</strong> at the bottom of the flags page.</li>
        <li>Come back to this tab and click <em>Re-check</em>.</li>
      </ol>
      <p className="onboarding-fineprint">
        On stable Chrome 138+, these flags may already be on by default. If you've enabled them and still see this
        screen, the device or profile may not meet the hardware requirements for on-device inference.
      </p>
      <div className="onboarding-actions">
        <button type="button" className="onboarding-secondary" onClick={onContinue}>
          Continue to editor
        </button>
        <button type="button" className="onboarding-primary" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? <Loader2 className="spin" size={14} /> : null}
          {refreshing ? "Checking" : "Re-check"}
        </button>
      </div>
    </div>
  );
}

function DownloadablePanel({
  onStartDownload,
  onContinue,
  starting,
}: {
  onStartDownload: () => void;
  onContinue: () => void;
  starting: boolean;
}) {
  return (
    <div className="onboarding-body">
      <div className="onboarding-icon onboarding-icon-accent" aria-hidden="true">
        <ArrowDownToLine size={20} />
      </div>
      <h2 id="onboarding-title">Ready to download Gemini Nano</h2>
      <p>
        Chrome will download the on-device model (~1–2 GB) once. After that, every AI feature in Draftside runs locally
        with no network round-trip.
      </p>
      <div className="onboarding-callout">
        <strong>What happens next:</strong>
        <ul>
          <li>Chrome downloads the model in the background</li>
          <li>This page shows live progress</li>
          <li>You can keep writing while it finishes</li>
        </ul>
      </div>
      <div className="onboarding-actions">
        <button type="button" className="onboarding-secondary" onClick={onContinue}>
          Not now
        </button>
        <button type="button" className="onboarding-primary" onClick={onStartDownload} disabled={starting}>
          {starting ? <Loader2 className="spin" size={14} /> : <Download size={14} />}
          {starting ? "Starting…" : "Start download"}
        </button>
      </div>
    </div>
  );
}

function DownloadingPanel({ progress, onContinue }: { progress: number | null; onContinue: () => void }) {
  const percent = progress === null ? null : Math.max(0, Math.min(1, progress));
  return (
    <div className="onboarding-body">
      <div className="onboarding-icon onboarding-icon-accent" aria-hidden="true">
        <Loader2 className="spin" size={20} />
      </div>
      <h2 id="onboarding-title">Downloading the local model…</h2>
      <p>Keep this tab open while Chrome finishes the download. It only happens once.</p>
      <div
        className="onboarding-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent === null ? undefined : Math.round(percent * 100)}
      >
        <div
          className="onboarding-progress-fill"
          style={{ width: percent === null ? "12%" : `${Math.round(percent * 100)}%` }}
        />
      </div>
      <div className="onboarding-progress-label">
        {percent === null ? "Preparing…" : `${formatPercent(percent)} downloaded`}
      </div>
      <div className="onboarding-actions">
        <button type="button" className="onboarding-primary" onClick={onContinue}>
          Continue in the background
        </button>
      </div>
    </div>
  );
}

function ReadyPanel({
  pwaInstallAvailable,
  pwaInstalled,
  installing,
  onInstall,
  onContinue,
}: {
  pwaInstallAvailable: boolean;
  pwaInstalled: boolean;
  installing: boolean;
  onInstall: () => void;
  onContinue: () => void;
}) {
  const showInstall = pwaInstallAvailable && !pwaInstalled;
  return (
    <div className="onboarding-body">
      <div className="onboarding-icon onboarding-icon-success" aria-hidden="true">
        <CheckCircle2 size={20} />
      </div>
      <h2 id="onboarding-title">{showInstall ? "Local AI is ready. One more thing." : "You're all set."}</h2>
      <p>
        {showInstall
          ? "Install Draftside as an app for a faster launch, dedicated window, and full offline access."
          : "Gemini Nano is ready in your browser. Every AI call from here runs on this device."}
      </p>
      <div className="onboarding-actions">
        <button type="button" className="onboarding-secondary" onClick={onContinue}>
          {showInstall ? "Skip" : "Start writing"}
        </button>
        {showInstall ? (
          <button type="button" className="onboarding-primary" onClick={onInstall} disabled={installing}>
            {installing ? <Loader2 className="spin" size={14} /> : null}
            {installing ? "Installing…" : "Install Draftside"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ErrorPanel({
  onRetry,
  onContinue,
  refreshing,
}: {
  onRetry: () => void;
  onContinue: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="onboarding-body">
      <div className="onboarding-icon onboarding-icon-warn" aria-hidden="true">
        <AlertTriangle size={20} />
      </div>
      <h2 id="onboarding-title">Couldn't reach the local model</h2>
      <p>Chrome reported an error while checking on-device AI. You can keep writing — AI tools will retry on first use.</p>
      <div className="onboarding-actions">
        <button type="button" className="onboarding-secondary" onClick={onContinue}>
          Continue to editor
        </button>
        <button type="button" className="onboarding-primary" onClick={onRetry} disabled={refreshing}>
          {refreshing ? <Loader2 className="spin" size={14} /> : null}
          {refreshing ? "Retrying" : "Retry"}
        </button>
      </div>
    </div>
  );
}
