import { useEffect, useRef, useState } from "react";
import { Globe, Download, Loader2, Sparkles, CheckCircle2, AlertTriangle, ArrowDownToLine } from "lucide-react";
import type { AiStatus, ModelRuntimeInfo } from "../../../lib/types";
import { formatPercent } from "../../../lib/formatters";
import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { overlay } from "../tailwind";

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

const bodyClass = "grid gap-3";
const headingClass = "m-0 text-lg font-semibold leading-snug text-foreground";
const copyClass = "m-0 text-sm leading-6 text-muted-foreground";
const iconClass = "inline-flex size-9 items-center justify-center rounded-lg";
const actionsClass = "flex justify-end gap-2 pt-1 max-[540px]:flex-col-reverse";
const secondaryLinkClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-secondary px-4 text-sm font-semibold leading-5 text-secondary-foreground no-underline transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background max-[540px]:w-full";

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
      className={cn(overlay, "z-[90]")}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <div
        className="grid w-[min(32rem,100%)] max-h-[min(44rem,calc(100svh-2rem))] gap-4 overflow-y-auto rounded-2xl bg-popover px-6 py-5 text-popover-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)),0_30px_80px_hsl(var(--foreground)/0.18)] max-[540px]:px-4 max-[540px]:pb-5 max-[540px]:pt-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        ref={dialogRef}
      >
        <header className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            <Sparkles size={14} aria-hidden="true" />
            <span>Welcome to Draftside</span>
          </div>
          <button type="button" className="rounded-md border-0 bg-transparent px-2.5 py-1.5 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" onClick={onDismiss} aria-label="Skip and continue to editor">
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
    <div className={bodyClass}>
      <h2 id="onboarding-title" className={headingClass}>Checking your browser…</h2>
      <p className={copyClass}>Looking for Chrome's built-in AI. This takes a second.</p>
      <div className="inline-flex size-9 items-center justify-center text-muted-foreground" aria-hidden="true">
        <Loader2 className="animate-spin" size={18} />
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
    <div className={bodyClass}>
      <div className={cn(iconClass, "bg-primary/15 text-primary")} aria-hidden="true">
        <Sparkles size={20} />
      </div>
      <h2 id="onboarding-title" className={headingClass}>Almost there — Chrome needs to expose the AI API</h2>
      <p className={copyClass}>
        You're on a Chromium-based browser, but the on-device <code>LanguageModel</code> API isn't visible to this page
        yet. Updating Chrome and enabling one flag usually fixes it.
      </p>
      <ol className="m-0 grid gap-2 pl-4 text-[0.8125rem] leading-6 text-muted-foreground [&_code]:break-all [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.78rem] [&_code]:text-foreground [&_strong]:font-semibold [&_strong]:text-foreground">
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
      <p className="m-0 text-xs leading-5 text-muted-foreground opacity-85">
        If you're on a non-Google Chromium variant (Brave, Arc, Vivaldi, …), the API may not ship in your build yet. The
        editor still works without AI.
      </p>
      <div className={actionsClass}>
        <Button type="button" variant="secondary" className="max-[540px]:w-full" onClick={onContinue}>
          Continue to editor
        </Button>
        <Button type="button" className="max-[540px]:w-full" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? <Loader2 className="animate-spin" size={14} /> : null}
          {refreshing ? "Checking" : "Re-check"}
        </Button>
      </div>
    </div>
  );
}

function NonChromePanel({ onContinue }: { onContinue: () => void }) {
  return (
    <div className={bodyClass}>
      <div className={cn(iconClass, "bg-muted text-foreground")} aria-hidden="true">
        <Globe size={20} />
      </div>
      <h2 id="onboarding-title" className={headingClass}>You can write here. AI features need Chrome.</h2>
      <p className={copyClass}>
        Draftside runs AI locally via Chrome's built-in Gemini Nano. The editor, drafts, and offline cache still work in
        your current browser — the AI features are the part that needs Chrome.
      </p>
      <div className="mt-1 rounded-lg bg-muted/60 px-3.5 py-3 text-[0.8125rem] leading-6 text-foreground">
        <strong className="mb-1 block font-semibold">What still works here:</strong>
        <ul className="m-0 pl-4 text-muted-foreground [&_li+li]:mt-0.5">
          <li>Writing, formatting, and saving drafts</li>
          <li>Private Vault with passkey encryption</li>
          <li>Offline access once the app loads</li>
        </ul>
      </div>
      <div className={actionsClass}>
        <a
          className={secondaryLinkClass}
          href="https://www.google.com/chrome/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Get Chrome
        </a>
        <Button type="button" className="max-[540px]:w-full" onClick={onContinue}>
          Continue to editor
        </Button>
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
    <div className={bodyClass}>
      <div className={cn(iconClass, "bg-destructive/10 text-destructive")} aria-hidden="true">
        <AlertTriangle size={20} />
      </div>
      <h2 id="onboarding-title" className={headingClass}>Gemini Nano isn't ready in this Chrome profile yet</h2>
      <p className={copyClass}>
        Chrome exposes the LanguageModel API here, but the on-device model isn't available. This is usually fixed by
        enabling two flags and restarting Chrome.
      </p>
      <ol className="m-0 grid gap-2 pl-4 text-[0.8125rem] leading-6 text-muted-foreground [&_code]:break-all [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.78rem] [&_code]:text-foreground [&_strong]:font-semibold [&_strong]:text-foreground">
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
      <p className="m-0 text-xs leading-5 text-muted-foreground opacity-85">
        On stable Chrome 138+, these flags may already be on by default. If you've enabled them and still see this
        screen, the device or profile may not meet the hardware requirements for on-device inference.
      </p>
      <div className={actionsClass}>
        <Button type="button" variant="secondary" className="max-[540px]:w-full" onClick={onContinue}>
          Continue to editor
        </Button>
        <Button type="button" className="max-[540px]:w-full" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? <Loader2 className="animate-spin" size={14} /> : null}
          {refreshing ? "Checking" : "Re-check"}
        </Button>
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
    <div className={bodyClass}>
      <div className={cn(iconClass, "bg-primary/15 text-primary")} aria-hidden="true">
        <ArrowDownToLine size={20} />
      </div>
      <h2 id="onboarding-title" className={headingClass}>Ready to download Gemini Nano</h2>
      <p className={copyClass}>
        Chrome will download the on-device model (~1–2 GB) once. After that, every AI feature in Draftside runs locally
        with no network round-trip.
      </p>
      <div className="mt-1 rounded-lg bg-muted/60 px-3.5 py-3 text-[0.8125rem] leading-6 text-foreground">
        <strong className="mb-1 block font-semibold">What happens next:</strong>
        <ul className="m-0 pl-4 text-muted-foreground [&_li+li]:mt-0.5">
          <li>Chrome downloads the model in the background</li>
          <li>This page shows live progress</li>
          <li>You can keep writing while it finishes</li>
        </ul>
      </div>
      <div className={actionsClass}>
        <Button type="button" variant="secondary" className="max-[540px]:w-full" onClick={onContinue}>
          Not now
        </Button>
        <Button type="button" className="max-[540px]:w-full" onClick={onStartDownload} disabled={starting}>
          {starting ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
          {starting ? "Starting…" : "Start download"}
        </Button>
      </div>
    </div>
  );
}

function DownloadingPanel({ progress, onContinue }: { progress: number | null; onContinue: () => void }) {
  const percent = progress === null ? null : Math.max(0, Math.min(1, progress));
  return (
    <div className={bodyClass}>
      <div className={cn(iconClass, "bg-primary/15 text-primary")} aria-hidden="true">
        <Loader2 className="animate-spin" size={20} />
      </div>
      <h2 id="onboarding-title" className={headingClass}>Downloading the local model…</h2>
      <p className={copyClass}>Keep this tab open while Chrome finishes the download. It only happens once.</p>
      <div
        className="relative mt-1 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent === null ? undefined : Math.round(percent * 100)}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
          style={{ width: percent === null ? "12%" : `${Math.round(percent * 100)}%` }}
        />
      </div>
      <div className="text-[0.8125rem] font-medium text-muted-foreground">
        {percent === null ? "Preparing…" : `${formatPercent(percent)} downloaded`}
      </div>
      <div className={actionsClass}>
        <Button type="button" className="max-[540px]:w-full" onClick={onContinue}>
          Continue in the background
        </Button>
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
    <div className={bodyClass}>
      <div className={cn(iconClass, "bg-green-500/15 text-green-700 dark:text-green-300")} aria-hidden="true">
        <CheckCircle2 size={20} />
      </div>
      <h2 id="onboarding-title" className={headingClass}>{showInstall ? "Local AI is ready. One more thing." : "You're all set."}</h2>
      <p className={copyClass}>
        {showInstall
          ? "Install Draftside as an app for a faster launch, dedicated window, and full offline access."
          : "Gemini Nano is ready in your browser. Every AI call from here runs on this device."}
      </p>
      <div className={actionsClass}>
        <Button type="button" variant="secondary" className="max-[540px]:w-full" onClick={onContinue}>
          {showInstall ? "Skip" : "Start writing"}
        </Button>
        {showInstall ? (
          <Button type="button" className="max-[540px]:w-full" onClick={onInstall} disabled={installing}>
            {installing ? <Loader2 className="animate-spin" size={14} /> : null}
            {installing ? "Installing…" : "Install Draftside"}
          </Button>
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
    <div className={bodyClass}>
      <div className={cn(iconClass, "bg-destructive/10 text-destructive")} aria-hidden="true">
        <AlertTriangle size={20} />
      </div>
      <h2 id="onboarding-title" className={headingClass}>Couldn't reach the local model</h2>
      <p className={copyClass}>Chrome reported an error while checking on-device AI. You can keep writing — AI tools will retry on first use.</p>
      <div className={actionsClass}>
        <Button type="button" variant="secondary" className="max-[540px]:w-full" onClick={onContinue}>
          Continue to editor
        </Button>
        <Button type="button" className="max-[540px]:w-full" onClick={onRetry} disabled={refreshing}>
          {refreshing ? <Loader2 className="animate-spin" size={14} /> : null}
          {refreshing ? "Retrying" : "Retry"}
        </Button>
      </div>
    </div>
  );
}
