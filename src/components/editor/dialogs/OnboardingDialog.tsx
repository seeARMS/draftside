import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  CheckCircle2,
  Cloud,
  Download,
  FileText,
  Globe,
  Loader2,
  Lock,
  WifiOff,
} from "lucide-react";
import type { AiStatus, ModelRuntimeInfo } from "../../../lib/types";
import { formatPercent } from "../../../lib/formatters";
import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { overlay } from "../tailwind";
import { detectInstallPlatform, INSTALL_INSTRUCTIONS } from "../installInstructions";
import {
  Code,
  dialogActionsClass,
  dialogCopyClass,
  dialogHeadlineClass,
  eyebrowClass,
  InfoCard,
  NumberedList,
  PanelLayout,
  Strong,
} from "../dialogPrimitives";

interface OnboardingDialogProps {
  hasApi: boolean | null;
  isChromeFamily: boolean;
  isMobile: boolean;
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

const STEPS: ReadonlyArray<{ id: StepId }> = [
  { id: "welcome" },
  { id: "ai" },
  { id: "install" },
  { id: "ready" },
];

type AiStage =
  | "checking"
  | "mobile-unsupported"
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
  isMobile,
  aiStatus,
  modelInfo,
}: Pick<OnboardingDialogProps, "hasApi" | "isChromeFamily" | "isMobile" | "aiStatus" | "modelInfo">): AiStage {
  if (hasApi === null) return "checking";
  if (!hasApi) {
    if (isMobile) return "mobile-unsupported";
    return isChromeFamily ? "chrome-setup" : "non-chrome";
  }

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
    isMobile,
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
  const aiStage = resolveAiStage({ hasApi, isChromeFamily, isMobile, aiStatus, modelInfo });
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
        className="grid w-[min(34rem,100%)] max-h-[min(46rem,calc(100svh-2rem))] overflow-hidden rounded-3xl bg-popover text-popover-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)),0_30px_80px_hsl(var(--shadow-color)/0.18)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        ref={dialogRef}
      >
        <ProgressBar currentIndex={stepIndex} total={STEPS.length} />

        <div className="grid gap-7 overflow-y-auto px-8 pb-8 pt-6 max-[540px]:gap-6 max-[540px]:px-5 max-[540px]:pb-6 max-[540px]:pt-5">
          <header className="flex items-center justify-between gap-3">
            {canGoBack ? (
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1 rounded-md border-0 bg-transparent px-1.5 -ml-1.5 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={goBack}
                aria-label="Go back to previous step"
              >
                <ArrowLeft size={14} />
                Back
              </button>
            ) : (
              <span aria-hidden="true" className="h-8" />
            )}
            <span className={eyebrowClass} aria-live="polite">
              Step {stepIndex + 1} of {STEPS.length}
            </span>
            <button
              type="button"
              className="rounded-md border-0 bg-transparent px-2 py-1 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground -mr-1.5"
              onClick={onDismiss}
              aria-label="Skip onboarding and continue to editor"
            >
              Skip
            </button>
          </header>

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
    </div>
  );
}

function ProgressBar({ currentIndex, total }: { currentIndex: number; total: number }) {
  return (
    <div className="flex h-1 w-full bg-muted/60" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-full flex-1 transition-colors duration-300",
            i <= currentIndex ? "bg-foreground" : "bg-transparent",
            i > 0 ? "border-l border-popover" : "",
          )}
        />
      ))}
    </div>
  );
}

function WelcomePanel({ onNext }: { onNext: () => void }) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-3">
        <h2 id="onboarding-title" className={dialogHeadlineClass}>
          A private writing editor that runs on your device.
        </h2>
        <p className={dialogCopyClass}>
          Draftside is open-source, AI-assisted, and 100% local. Drafts and AI suggestions never leave this browser.
        </p>
      </div>
      <ul className="m-0 grid gap-3.5 border-t border-border/70 p-0 pt-5">
        <FeatureRow icon={<Cloud size={15} />} title="Local AI" body="Inline completions, rewrites, and chat — on-device." />
        <FeatureRow icon={<Lock size={15} />} title="Private vault" body="Optional passkey-encrypted drafts." />
        <FeatureRow icon={<WifiOff size={15} />} title="Offline-ready" body="Install once and keep writing offline." />
        <FeatureRow icon={<FileText size={15} />} title="Yours to export" body="Download as HTML or Markdown anytime." />
      </ul>
      <div className={dialogActionsClass}>
        <Button type="button" size="lg" className="max-[540px]:w-full" onClick={onNext}>
          Get started
        </Button>
      </div>
    </div>
  );
}

function FeatureRow({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <li className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-baseline gap-3 text-[0.9375rem] leading-6">
      <span className="translate-y-[0.1875rem] text-muted-foreground" aria-hidden="true">
        {icon}
      </span>
      <span className="grid gap-0.5">
        <strong className="font-semibold text-foreground">{title}</strong>
        <span className="text-muted-foreground">{body}</span>
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
      <PanelLayout
        titleId="onboarding-title"
        title="Checking your browser"
        body="Looking for Chrome's built-in AI. This takes a second."
        accent={<Loader2 className="animate-spin text-muted-foreground" size={18} />}
        primary={
          <Button type="button" size="lg" variant="secondary" className="max-[540px]:w-full" onClick={onNext}>
            Continue
          </Button>
        }
      />
    );
  }

  if (stage === "mobile-unsupported") {
    return (
      <PanelLayout
        titleId="onboarding-title"
        title="On-device AI needs desktop Chrome"
        body="Chrome's built-in Gemini Nano isn't exposed in mobile browsers yet — including Chrome on iOS and Android. The editor, drafts, and offline cache still work here. Open Draftside on desktop Chrome 138+ to turn on AI features."
        primary={
          <Button type="button" size="lg" className="max-[540px]:w-full" onClick={onNext}>
            Continue
          </Button>
        }
      >
        <InfoCard title="What still works here">
          <ul className="m-0 grid gap-1 pl-4 text-muted-foreground">
            <li>Writing, formatting, and saving drafts</li>
            <li>Private Vault with passkey encryption</li>
            <li>Offline access once the app loads</li>
          </ul>
        </InfoCard>
      </PanelLayout>
    );
  }

  if (stage === "chrome-setup") {
    return (
      <PanelLayout
        titleId="onboarding-title"
        title="Chrome needs to expose the AI API"
        body={
          <>
            You're on a Chromium-based browser, but the on-device <Code>LanguageModel</Code> API isn't visible here yet. Updating Chrome and enabling one flag usually fixes it.
          </>
        }
        primary={
          <Button type="button" size="lg" className="max-[540px]:w-full" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? <Loader2 className="animate-spin" size={14} /> : null}
            {refreshing ? "Checking" : "Re-check"}
          </Button>
        }
        secondary={
          <Button type="button" size="lg" variant="ghost" className="max-[540px]:w-full" onClick={onNext}>
            Continue without AI
          </Button>
        }
      >
        <NumberedList
          items={[
            <>Open <Code>chrome://settings/help</Code> and update to Chrome 138+. Relaunch when prompted.</>,
            <>Open <Code>chrome://flags/#prompt-api-for-gemini-nano</Code> and set to <Strong>Enabled</Strong>.</>,
            <>Click <Strong>Relaunch</Strong> at the bottom of the flags page.</>,
            <>Come back to this tab and click <em>Re-check</em>.</>,
          ]}
        />
      </PanelLayout>
    );
  }

  if (stage === "non-chrome") {
    return (
      <PanelLayout
        titleId="onboarding-title"
        title="You can write here. AI features need Chrome."
        body="Draftside runs AI locally via Chrome's built-in Gemini Nano. The editor, drafts, and offline cache still work in your current browser — the AI is what needs Chrome."
        primary={
          <a
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-[0.9375rem] font-semibold leading-5 text-primary-foreground no-underline transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background max-[540px]:w-full"
            href="https://www.google.com/chrome/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Globe size={15} />
            Get Chrome
          </a>
        }
        secondary={
          <Button type="button" size="lg" variant="ghost" className="max-[540px]:w-full" onClick={onNext}>
            Continue
          </Button>
        }
      >
        <InfoCard title="What still works here">
          <ul className="m-0 grid gap-1 pl-4 text-muted-foreground">
            <li>Writing, formatting, and saving drafts</li>
            <li>Private Vault with passkey encryption</li>
            <li>Offline access once the app loads</li>
          </ul>
        </InfoCard>
      </PanelLayout>
    );
  }

  if (stage === "unavailable") {
    return (
      <PanelLayout
        titleId="onboarding-title"
        title="Gemini Nano isn't ready in this Chrome profile yet"
        body="Chrome exposes the LanguageModel API here, but the on-device model isn't available. Enable two flags and restart Chrome."
        primary={
          <Button type="button" size="lg" className="max-[540px]:w-full" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? <Loader2 className="animate-spin" size={14} /> : null}
            {refreshing ? "Checking" : "Re-check"}
          </Button>
        }
        secondary={
          <Button type="button" size="lg" variant="ghost" className="max-[540px]:w-full" onClick={onNext}>
            Continue without AI
          </Button>
        }
      >
        <NumberedList
          items={[
            <>Open <Code>chrome://flags/#optimization-guide-on-device-model</Code> and set to <Strong>Enabled BypassPerfRequirement</Strong>.</>,
            <>Open <Code>chrome://flags/#prompt-api-for-gemini-nano</Code> and set to <Strong>Enabled</Strong>.</>,
            <>Click <Strong>Relaunch</Strong> at the bottom of the flags page.</>,
            <>Come back to this tab and click <em>Re-check</em>.</>,
          ]}
        />
      </PanelLayout>
    );
  }

  if (stage === "downloadable") {
    return (
      <PanelLayout
        titleId="onboarding-title"
        title="Download the local model"
        body="Chrome downloads Gemini Nano (~1–2 GB) once. After that, every AI feature in Draftside runs locally — no network round-trips."
        primary={
          <Button type="button" size="lg" className="max-[540px]:w-full" onClick={onStartDownload} disabled={downloadStarting}>
            {downloadStarting ? <Loader2 className="animate-spin" size={14} /> : <ArrowDownToLine size={15} />}
            {downloadStarting ? "Starting" : "Start download"}
          </Button>
        }
        secondary={
          <Button type="button" size="lg" variant="ghost" className="max-[540px]:w-full" onClick={onNext}>
            Not now
          </Button>
        }
      >
        <InfoCard title="What happens next">
          <ul className="m-0 grid gap-1 pl-4 text-muted-foreground">
            <li>Chrome downloads the model in the background</li>
            <li>You can keep moving through onboarding while it finishes</li>
            <li>The model status pill in the editor shows live progress</li>
          </ul>
        </InfoCard>
      </PanelLayout>
    );
  }

  if (stage === "downloading") {
    const percent = aiProgress === null ? null : Math.max(0, Math.min(1, aiProgress));
    return (
      <PanelLayout
        titleId="onboarding-title"
        title="Downloading the local model"
        body="Chrome is downloading Gemini Nano in the background. Continue through onboarding — the download keeps running."
        primary={
          <Button type="button" size="lg" className="max-[540px]:w-full" onClick={onNext}>
            Continue while it finishes
          </Button>
        }
      >
        <div className="grid gap-2">
          <div
            className="relative h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent === null ? undefined : Math.round(percent * 100)}
          >
            <div
              className="h-full rounded-full bg-foreground transition-[width] duration-200 ease-out"
              style={{ width: percent === null ? "12%" : `${Math.round(percent * 100)}%` }}
            />
          </div>
          <div className="text-[0.8125rem] font-medium text-muted-foreground">
            {percent === null ? "Preparing" : `${formatPercent(percent)} downloaded`}
          </div>
        </div>
      </PanelLayout>
    );
  }

  if (stage === "ready") {
    return (
      <PanelLayout
        titleId="onboarding-title"
        accent={<CheckCircle2 className="text-foreground" size={20} />}
        title="Local AI is ready"
        body="Gemini Nano is loaded in your browser. Every AI suggestion from here runs on this device."
        primary={
          <Button type="button" size="lg" className="max-[540px]:w-full" onClick={onNext}>
            Continue
          </Button>
        }
      />
    );
  }

  return (
    <PanelLayout
      titleId="onboarding-title"
      accent={<AlertTriangle className="text-foreground" size={18} />}
      title="Couldn't reach the local model"
      body="Chrome reported an error while checking on-device AI. You can keep writing — AI tools will retry on first use."
      primary={
        <Button type="button" size="lg" className="max-[540px]:w-full" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? <Loader2 className="animate-spin" size={14} /> : null}
          {refreshing ? "Retrying" : "Retry"}
        </Button>
      }
      secondary={
        <Button type="button" size="lg" variant="ghost" className="max-[540px]:w-full" onClick={onNext}>
          Continue
        </Button>
      }
    />
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
      <PanelLayout
        titleId="onboarding-title"
        accent={<CheckCircle2 className="text-foreground" size={20} />}
        title="Draftside is installed"
        body="The app is already installed on this device. Launch it from your home screen, Dock, or app launcher for the fastest start."
        primary={
          <Button type="button" size="lg" className="max-[540px]:w-full" onClick={onNext}>
            Continue
          </Button>
        }
      />
    );
  }

  const { title, steps } = INSTALL_INSTRUCTIONS[platform];

  return (
    <PanelLayout
      titleId="onboarding-title"
      title="Install Draftside as an app"
      body="Install once and keep writing offline, with a dedicated window and faster launch. Optional — Draftside works in any tab."
      primary={
        pwaInstallAvailable ? (
          <Button type="button" size="lg" className="max-[540px]:w-full" onClick={onInstall} disabled={installing}>
            {installing ? <Loader2 className="animate-spin" size={14} /> : <Download size={15} />}
            {installing ? "Installing" : "Install Draftside"}
          </Button>
        ) : (
          <Button type="button" size="lg" className="max-[540px]:w-full" onClick={onNext}>
            I'll install it
          </Button>
        )
      }
      secondary={
        <Button type="button" size="lg" variant="ghost" className="max-[540px]:w-full" onClick={onNext}>
          Skip
        </Button>
      }
    >
      {pwaInstallAvailable ? (
        <InfoCard title="One-click install">
          <span className="text-muted-foreground">Your browser is ready to install Draftside as an app.</span>
        </InfoCard>
      ) : (
        <InfoCard title={title}>
          <ol className="m-0 grid list-decimal gap-1 pl-4 text-muted-foreground">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </InfoCard>
      )}
    </PanelLayout>
  );
}

function ReadyPanel({ onFinish }: { onFinish: () => void }) {
  return (
    <PanelLayout
      titleId="onboarding-title"
      accent={<CheckCircle2 className="text-foreground" size={20} />}
      title="You're all set"
      body="Open a draft from the rail, or just start typing. Everything stays on this device."
      primary={
        <Button type="button" size="lg" className="max-[540px]:w-full" onClick={onFinish}>
          Start writing
        </Button>
      }
    />
  );
}

