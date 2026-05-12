export type InstallPlatform =
  | "chrome-desktop"
  | "edge-desktop"
  | "firefox-desktop"
  | "safari-desktop"
  | "ios"
  | "android"
  | "other";

export function detectInstallPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1);
  if (isIOS) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Edg\//.test(ua)) return "edge-desktop";
  if (/Firefox\//.test(ua)) return "firefox-desktop";
  if (/Chrome\//.test(ua)) return "chrome-desktop";
  if (/Safari\//.test(ua)) return "safari-desktop";
  return "other";
}

export interface InstallInstructions {
  title: string;
  steps: string[];
}

export const INSTALL_INSTRUCTIONS: Record<InstallPlatform, InstallInstructions> = {
  "chrome-desktop": {
    title: "Install via Chrome",
    steps: [
      "Click the install icon at the right end of the address bar (monitor with a down arrow).",
      "Or open the ⋮ menu → Cast, save, share → Install page as app…",
      "Confirm with Install.",
    ],
  },
  "edge-desktop": {
    title: "Install via Edge",
    steps: [
      "Click the install icon at the right end of the address bar.",
      "Or open the ⋯ menu → Apps → Install Draftside.",
      "Confirm with Install.",
    ],
  },
  "firefox-desktop": {
    title: "Firefox doesn't install PWAs",
    steps: [
      "Firefox on desktop doesn't support installing web apps.",
      "Try Chrome, Edge, or Brave to install Draftside.",
      "Draftside still works fully in this tab.",
    ],
  },
  "safari-desktop": {
    title: "Install via Safari",
    steps: [
      "Open the File menu and choose Add to Dock…",
      "Confirm the name and click Add.",
      "Draftside opens like a native app from the Dock.",
    ],
  },
  ios: {
    title: "Add to Home Screen",
    steps: [
      "Tap the Share button (the square with the arrow) in Safari.",
      "Scroll down and tap Add to Home Screen.",
      "Tap Add in the top-right corner.",
    ],
  },
  android: {
    title: "Install via Chrome",
    steps: [
      "Tap the ⋮ menu at the top right.",
      "Tap Install app, or Add to Home screen.",
      "Confirm with Install.",
    ],
  },
  other: {
    title: "Install instructions",
    steps: [
      "Open your browser's main menu.",
      "Look for Install Draftside, Install app, or Add to Home screen.",
      "Confirm to install.",
    ],
  },
};
