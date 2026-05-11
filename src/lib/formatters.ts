import type { AiStatus } from "./types";
import { TRANSLATION_LANGUAGES } from "../ai/constants";

export function formatUpdatedAt(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export function statusLabel(status: AiStatus | undefined) {
  switch (status) {
    case "available":
      return "ready";
    case "downloadable":
      return "download";
    case "downloading":
      return "downloading";
    case "unavailable":
      return "unavailable";
    case "unsupported":
      return "unsupported";
    case "checking":
      return "checking";
    case "creating":
      return "starting";
    case "error":
      return "error";
    default:
      return "idle";
  }
}

export function formatNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? new Intl.NumberFormat().format(value) : "unknown";
}

export function formatPercent(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value * 100)}%` : "unknown";
}

export function formatBytes(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "unknown";
  if (value < 1024) return `${value} B`;

  const units = ["KB", "MB", "GB"];
  let amount = value / 1024;
  let unitIndex = 0;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }

  return `${amount >= 10 ? Math.round(amount) : amount.toFixed(1)} ${units[unitIndex]}`;
}

export function formatModelInfoTime(value: number | undefined) {
  if (!value) return "not checked";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

export function formatSaveTime(value: number | null | undefined) {
  if (!value) return "not saved yet";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

export function translationLabel(code: string) {
  return TRANSLATION_LANGUAGES.find((language) => language.code === code)?.label ?? code;
}
