import { useEffect, useMemo, useRef, useState, Fragment } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  Check,
  CheckCircle2,
  Cloud,
  Download,
  FileText,
  Globe,
  Loader2,
  Lock,
  Sparkles,
  WifiOff,
} from "lucide-react";
import type { AiStatus, ModelRuntimeInfo } from "../../../lib/types";
import { formatPercent } from "../../../lib/formatters";
import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { overlay } from "../tailwind";
import { detectInstallPlatform, INSTALL_INSTRUCTIONS } from "../installInstructions";

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

type StepId = "welcome" | "ai" | "install" | "ready";

const STEPS: ReadonlyArray<{ id: StepId; label: string }> = [
  { id: "welcome", label: "Welcome" },
  { id: "ai", label: "Local AI" },
  { id: "install", label: "Install" },
  { id: "ready", label: "Ready" },
];

type AiStage =
  | "checking"
  | "chrome-setup"
  | "non-chrome"
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "ready"
  | "error";

function resolveAiStage({
  hasApi,
  isChromeFamily,
  aiStatus,
  modelInfo,
}: Pick<OnboardingDialogProps, "hasApi" | "isChromeFamily" | "aiStatus" | "modelInfo">): AiStage {
  if (hasApi === null) return "checking";
  if (!hasApi) return isChromeFamily ? "chrome-setup" : "non-chrome";

  if (aiStatus === "creating" || aiStatus === "downloading") return "downloading";
  if (aiStatus === "checking" || aiStatus === "idle") return "checking";

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

const headingClass = "m-0 text-lg font-semibold leading-snug text-foreground";
const copyClass = "m-0 text-sm leading-6 text-muted-foreground";
const iconClass = "inline-flex size-10 items-center justify-center rounded-lg";
const actionsClass = "flex flex-wrap items-center justify-end gap-2 pt-1 max-[540px]:flex-col-reverse max-[540px]:items-stretch";

function useDialogFocus(stepId: StepId) {
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
  }, [stepId]);

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

  const [stepId, setStepId] = useState<StepId>("welcome");
  const [downloadStarting, setDownloadStarting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [installing, setInstalling] = useState(false);

  const dialogRef = useDialogFocus(stepId);
  const stepIndex = STEPS.findIndex((step) => step.id === stepId);
  const aiStage = resolveAiStage({ hasApi, isChromeFamily, aiStatus, modelInfo });
  const platform = useMemo(detectInstallPlatform, []);

  const goTo = (id: StepId) => setStepId(id);
  const goNext = () => {
    const next = STEPS[Math.min(stepIndex + 1, STEPS.length - 1)];
    setStepId(next.id);
  };
  const goBack = () => {
    const prev = STEPS[Math.max(stepIndex - 1, 0)];
    setStepId(prev.id);
  };

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
      goTo("ready");
    }
  }

  const canGoBack = stepIndex > 0;

  return (
    <div
      className={cn(overlay, "z-[90]")}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <div
        className="grid w-[min(34rem,100%)] max-h-[min(44rem,calc(100svh-2rem))] gap-4 overflow-y-auto rounded-2xl bg-popover px-6 py-5 text-popover-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)),0_30px_80px_hsl(var(--shadow-color)/0.18)] max-[540px]:px-4 max-[540px]:pb-5 max-[540px]:pt-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        ref={dialogRef}
      >
        <header className="flex items-center justify-between gap-3">
          {canGoBack ? (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1 rounded-md border-0 bg-transparent px-1.5 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={goBack}
              aria-label="Go back to previous step"
            >
              <ArrowLeft size={14} />
              Back
            </button>
          ) : (
            <span aria-hidden="true" className="h-8 w-8" />
          )}
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            <Sparkles size={14} aria-hidden="true" />
            <span>Welcome to Draftside</span>
          </div>
          <button
            type="button"
            className="rounded-md border-0 bg-transparent px-2.5 py-1.5 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={onDismiss}
            aria-label="Skip onboarding and continue to editor"
          >
            Skip
          </button>
        </header>

        <Stepper currentStepId={stepId} />

        {stepId === "welcome" ? (
          <WelcomePanel onNext={goNext} />
        ) : stepId === "ai" ? (
          <AiPanel
            stage={aiStage}
            aiProgress={aiProgress}
            modelInfo={modelInfo}
            refreshing={refreshing}
            downloadStarting={downloadStarting}
            onStartDownload={handleStartDownload}
            onRefresh={handleRefresh}
            onNext={goNext}
          />
        ) : stepId === "install" ? (
          <InstallPanel
            platform={platform}
            pwaInstalled={pwaInstalled}
            pwaInstallAvailable={pwaInstallAvailable}
            installing={installing}
            onInstall={handleInstall}
            onNext={goNext}
          />
        ) : (
          <ReadyPanel onFinish={onDismiss} />
        )}
      </div>
    </div>
  );
}

function Stepper({ currentStepId }: { currentStepId: StepId }) {
  const currentIndex = STEPS.findIndex((step) => step.id === currentStepId);
  return (
    <ol className="m-0 flex items-center gap-1.5 p-0" aria-label="Onboarding progress">
      {STEPS.map((step, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <Fragment key={step.id}>
            <li
              className="inline-flex shrink-0 items-center gap-2"
              aria-current={isCurrent ? "step" : undefined}
            >
              <span
                className={cn(
                  "inline-flex size-6 items-center justify-center rounded-full text-[0.6875rem] font-semibold leading-none transition-colors",
                  isComplete && "bg-primary text-primary-foreground",
                  isCurrent && "bg-primary text-primary-foreground shadow-[inset_0_0_0_2px_hsl(var(--background))]",
                  !isComplete && !isCurrent && "bg-muted text-muted-foreground",
                )}
                aria-hidden="true"
              >
                {isComplete ? <Check size={12} /> : index + 1}
              </span>
              <span
                className={cn(
                  "text-xs font-medium leading-4 max-[540px]:hidden",
                  isCurrent ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
              <span className="sr-only max-[540px]:not-sr-only max-[540px]:hidden">{step.label}</span>
            </li>
            {index < STEPS.length - 1 ? (
              <li
                aria-hidden="true"
                className={cn(
                  "h-px flex-1 min-w-4 transition-colors",
                  index < currentIndex ? "bg-primary" : "bg-border",
                )}
              />
            ) : null}
          </Fragment>
        );
      })}
    </ol>
  );
}

function WelcomePanel({ onNext }: { onNext: () => void }) {
  return (
    <div className="grid gap-4">
      <div className={cn(iconClass, "bg-primary/15 text-primary")} aria-hidden="true">
        <Sparkles size={22} />
      </div>
      <h2 id="onboarding-title" className={headingClass}>
        A private writing editor that runs on your device.
      </h2>
      <p className={copyClass}>
        Draftside is an open-source writing editor powered by Chrome's built-in Gemini Nano. AI assistance, drafts, and
        offline access all live on this device — nothing leaves your browser.
      </p>
      <ul className="m-0 grid gap-2.5 p-0">
        <FeatureRow
          icon={<Cloud size={16} />}
          title="Local AI"
          body="Inline completions, rewrites, and chat — all on-device."
        />
        <FeatureRow
          icon={<Lock size={16} />}
          title="Private vault"
          body="Optional passkey-encrypted drafts that never sync anywhere."
        />
        <FeatureRow
          icon={<WifiOff size={16} />}
          title="Offline-ready"
          body="Install once and keep writing without a connection."
        />
        <FeatureRow
          icon={<FileText size={16} />}
          title="Yours to export"
          body="Download as HTML or Markdown anytime."
        />
      </ul>
      <div className={actionsClass}>
        <Button type="button" className="max-[540px]:w-full" onClick={onNext}>
          Get started
        </Button>
      </div>
    </div>
  );
}

function FeatureRow({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-2.5 text-[0.8125rem] leading-snug text-muted-foreground">
      <span className="mt-0.5 inline-flex size-7 items-center justify-center rounded-md bg-muted text-foreground" aria-hidden="true">
        {icon}
      </span>
      <span className="grid gap-0.5">
        <strong className="font-semibold text-foreground">{title}</strong>
        <span>{body}</span>
      </span>
    </li>
  );
}

interface AiPanelProps {
  stage: AiStage;
  aiProgress: number | null;
  modelInfo: ModelRuntimeInfo;
  refreshing: boolean;
  downloadStarting: boolean;
  onStartDownload: () => void;
  onRefresh: () => void;
  onNext: () => void;
}

function AiPanel({ stage, aiProgress, refreshing, downloadStarting, onStartDownload, onRefresh, onNext }: AiPanelProps) {
  if (stage === "checking") {
    return (
      <div className="grid gap-3">
        <div className={cn(iconClass, "bg-muted text-foreground")} aria-hidden="true">
          <Loader2 className="animate-spin" size={20} />
        </div>
        <h2 id="onboarding-title" className={headingClass}>Checking your browser…</h2>
        <p className={copyClass}>Looking for Chrome's built-in AI. This takes a second.</p>
        <div className={actionsClass}>
          <Button type="button" variant="secondary" className="max-[540px]:w-full" onClick={onNext}>
            Continue
          </Button>
        </div>
      </div>
    );
  }

  if (stage === "chrome-setup") {
    return (
      <div className="grid gap-3">
        <div className={cn(iconClass, "bg-primary/15 text-primary")} aria-hidden="true">
          <Sparkles size={20} />
        </div>
        <h2 id="onboarding-title" className={headingClass}>Almost there — Chrome needs to expose the AI API</h2>
        <p className={copyClass}>
          You're on a Chromium-based browser, but the on-device <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.78rem] text-foreground">LanguageModel</code> API isn't visible here yet. Updating Chrome and enabling one flag usually fixes it.
        </p>
        <ol className="m-0 grid gap-2 pl-4 text-[0.8125rem] leading-6 text-muted-foreground [&_code]:break-all [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.78rem] [&_code]:text-foreground [&_strong]:font-semibold [&_strong]:text-foreground">
          <li>Open <code>chrome://settings/help</code> and update to the latest Chrome (138+ recommended). Relaunch when prompted.</li>
          <li>Open <code>chrome://flags/#prompt-api-for-gemini-nano</code> and set it to <strong>Enabled</strong>.</li>
          <li>Click <strong>Relaunch</strong> at the bottom of the flags page.</li>
          <li>Come back to this tab and click <em>Re-check</em>.</li>
        </ol>
        <div className={actionsClass}>
          <Button type="button" variant="secondary" className="max-[540px]:w-full" onClick={onNext}>
            Continue without AI
          </Button>
          <Button type="button" className="max-[540px]:w-full" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? <Loader2 className="animate-spin" size={14} /> : null}
            {refreshing ? "Checking" : "Re-check"}
          </Button>
        </div>
      </div>
    );
  }

  if (stage === "non-chrome") {
    return (
      <div className="grid gap-3">
        <div className={cn(iconClass, "bg-muted text-foreground")} aria-hidden="true">
          <Globe size={20} />
        </div>
        <h2 id="onboarding-title" className={headingClass}>You can write here. AI features need Chrome.</h2>
        <p className={copyClass}>
          Draftside runs AI locally via Chrome's built-in Gemini Nano. The editor, drafts, and offline cache still work in your current browser — the AI features are the part that needs Chrome.
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
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-secondary px-4 text-sm font-semibold leading-5 text-secondary-foreground no-underline transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background max-[540px]:w-full"
            href="https://www.google.com/chrome/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Get Chrome
          </a>
          <Button type="button" className="max-[540px]:w-full" onClick={onNext}>
            Continue
          </Button>
        </div>
      </div>
    );
  }

  if (stage === "unavailable") {
    return (
      <div className="grid gap-3">
        <div className={cn(iconClass, "bg-destructive/10 text-destructive")} aria-hidden="true">
          <AlertTriangle size={20} />
        </div>
        <h2 id="onboarding-title" className={headingClass}>Gemini Nano isn't ready in this Chrome profile yet</h2>
        <p className={copyClass}>
          Chrome exposes the LanguageModel API here, but the on-device model isn't available. This is usually fixed by enabling two flags and restarting Chrome.
        </p>
        <ol className="m-0 grid gap-2 pl-4 text-[0.8125rem] leading-6 text-muted-foreground [&_code]:break-all [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.78rem] [&_code]:text-foreground [&_strong]:font-semibold [&_strong]:text-foreground">
          <li>Open <code>chrome://flags/#optimization-guide-on-device-model</code> and set it to <strong>Enabled BypassPerfRequirement</strong>.</li>
          <li>Open <code>chrome://flags/#prompt-api-for-gemini-nano</code> and set it to <strong>Enabled</strong>.</li>
          <li>Click <strong>Relaunch</strong> at the bottom of the flags page.</li>
          <li>Come back to this tab and click <em>Re-check</em>.</li>
        </ol>
        <div className={actionsClass}>
          <Button type="button" variant="secondary" className="max-[540px]:w-full" onClick={onNext}>
            Continue without AI
          </Button>
          <Button type="button" className="max-[540px]:w-full" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? <Loader2 className="animate-spin" size={14} /> : null}
            {refreshing ? "Checking" : "Re-check"}
          </Button>
        </div>
      </div>
    );
  }

  if (stage === "downloadable") {
    return (
      <div className="grid gap-3">
        <div className={cn(iconClass, "bg-primary/15 text-primary")} aria-hidden="true">
          <ArrowDownToLine size={20} />
        </div>
        <h2 id="onboarding-title" className={headingClass}>Ready to download Gemini Nano</h2>
        <p className={copyClass}>
          Chrome will download the on-device model (~1–2 GB) once. After that, every AI feature in Draftside runs locally with no network round-trip.
        </p>
        <div className="mt-1 rounded-lg bg-muted/60 px-3.5 py-3 text-[0.8125rem] leading-6 text-foreground">
          <strong className="mb-1 block font-semibold">What happens next:</strong>
          <ul className="m-0 pl-4 text-muted-foreground [&_li+li]:mt-0.5">
            <li>Chrome downloads the model in the background</li>
            <li>You can keep moving through onboarding while it finishes</li>
            <li>The model status pill in the editor shows live progress</li>
          </ul>
        </div>
        <div className={actionsClass}>
          <Button type="button" variant="secondary" className="max-[540px]:w-full" onClick={onNext}>
            Not now
          </Button>
          <Button type="button" className="max-[540px]:w-full" onClick={onStartDownload} disabled={downloadStarting}>
            {downloadStarting ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
            {downloadStarting ? "Starting…" : "Start download"}
          </Button>
        </div>
      </div>
    );
  }

  if (stage === "downloading") {
    const percent = aiProgress === null ? null : Math.max(0, Math.min(1, aiProgress));
    return (
      <div className="grid gap-3">
        <div className={cn(iconClass, "bg-primary/15 text-primary")} aria-hidden="true">
          <Loader2 className="animate-spin" size={20} />
        </div>
        <h2 id="onboarding-title" className={headingClass}>Downloading the local model…</h2>
        <p className={copyClass}>
          Chrome is downloading Gemini Nano in the background. You can continue through onboarding — the download keeps running.
        </p>
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
          <Button type="button" className="max-[540px]:w-full" onClick={onNext}>
            Continue while it finishes
          </Button>
        </div>
      </div>
    );
  }

  if (stage === "ready") {
    return (
      <div className="grid gap-3">
        <div className={cn(iconClass, "bg-green-500/15 text-green-700 dark:text-green-300")} aria-hidden="true">
          <CheckCircle2 size={20} />
        </div>
        <h2 id="onboarding-title" className={headingClass}>Local AI is ready</h2>
        <p className={copyClass}>
          Gemini Nano is loaded in your browser. Every AI suggestion from here runs on this device.
        </p>
        <div className={actionsClass}>
          <Button type="button" className="max-[540px]:w-full" onClick={onNext}>
            Continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className={cn(iconClass, "bg-destructive/10 text-destructive")} aria-hidden="true">
        <AlertTriangle size={20} />
      </div>
      <h2 id="onboarding-title" className={headingClass}>Couldn't reach the local model</h2>
      <p className={copyClass}>Chrome reported an error while checking on-device AI. You can keep writing — AI tools will retry on first use.</p>
      <div className={actionsClass}>
        <Button type="button" variant="secondary" className="max-[540px]:w-full" onClick={onNext}>
          Continue
        </Button>
        <Button type="button" className="max-[540px]:w-full" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? <Loader2 className="animate-spin" size={14} /> : null}
          {refreshing ? "Retrying" : "Retry"}
        </Button>
      </div>
    </div>
  );
}

interface InstallPanelProps {
  platform: ReturnType<typeof detectInstallPlatform>;
  pwaInstalled: boolean;
  pwaInstallAvailable: boolean;
  installing: boolean;
  onInstall: () => void;
  onNext: () => void;
}

function InstallPanel({ platform, pwaInstalled, pwaInstallAvailable, installing, onInstall, onNext }: InstallPanelProps) {
  if (pwaInstalled) {
    return (
      <div className="grid gap-3">
        <div className={cn(iconClass, "bg-green-500/15 text-green-700 dark:text-green-300")} aria-hidden="true">
          <CheckCircle2 size={20} />
        </div>
        <h2 id="onboarding-title" className={headingClass}>Draftside is installed</h2>
        <p className={copyClass}>
          The app is already installed on this device. Launch it from your home screen, Dock, or app launcher for the fastest start.
        </p>
        <div className={actionsClass}>
          <Button type="button" className="max-[540px]:w-full" onClick={onNext}>
            Continue
          </Button>
        </div>
      </div>
    );
  }

  const { title, steps } = INSTALL_INSTRUCTIONS[platform];

  return (
    <div className="grid gap-3">
      <div className={cn(iconClass, "bg-primary/15 text-primary")} aria-hidden="true">
        <Download size={20} />
      </div>
      <h2 id="onboarding-title" className={headingClass}>Install Draftside as an app</h2>
      <p className={copyClass}>
        Install once and keep writing offline, with a dedicated window and faster launch. Optional — Draftside works in any tab.
      </p>
      {pwaInstallAvailable ? (
        <div className="mt-1 rounded-lg bg-muted/60 px-3.5 py-3 text-[0.8125rem] leading-6 text-foreground">
          <strong className="mb-1 block font-semibold">One-click install</strong>
          <span className="text-muted-foreground">Your browser is ready to install Draftside as an app.</span>
        </div>
      ) : (
        <div className="mt-1 grid gap-2 rounded-lg bg-muted/60 px-3.5 py-3 text-[0.8125rem] leading-6 text-foreground">
          <strong className="font-semibold">{title}</strong>
          <ol className="m-0 grid list-decimal gap-1 pl-4 text-muted-foreground">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}
      <div className={actionsClass}>
        <Button type="button" variant="secondary" className="max-[540px]:w-full" onClick={onNext}>
          Skip
        </Button>
        {pwaInstallAvailable ? (
          <Button type="button" className="max-[540px]:w-full" onClick={onInstall} disabled={installing}>
            {installing ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
            {installing ? "Installing…" : "Install Draftside"}
          </Button>
        ) : (
          <Button type="button" className="max-[540px]:w-full" onClick={onNext}>
            I'll install it
          </Button>
        )}
      </div>
    </div>
  );
}

function ReadyPanel({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="grid gap-3">
      <div className={cn(iconClass, "bg-green-500/15 text-green-700 dark:text-green-300")} aria-hidden="true">
        <CheckCircle2 size={20} />
      </div>
      <h2 id="onboarding-title" className={headingClass}>You're all set</h2>
      <p className={copyClass}>
        Open a draft from the rail, or start typing. Everything stays on this device.
      </p>
      <div className={actionsClass}>
        <Button type="button" className="max-[540px]:w-full" onClick={onFinish}>
          Start writing
        </Button>
      </div>
    </div>
  );
}
