import type { VaultMeta, VaultModalView, VaultStatus } from "../../../lib/types";

export interface VaultState {
  status: VaultStatus;
  meta: VaultMeta | null;
  modalOpen: boolean;
  modalView: VaultModalView;
  busy: boolean;
  error: string;
  recoveryKey: string;
  recoveryInput: string;
}

export type VaultAction =
  | { type: "openModal"; view: VaultModalView }
  | { type: "closeModal" }
  | { type: "setView"; view: VaultModalView }
  | { type: "setRecoveryInput"; value: string }
  | { type: "setRecoveryKey"; value: string }
  | { type: "setError"; value: string }
  | { type: "busy" }
  | { type: "idle" }
  | { type: "lockUpdated"; meta: VaultMeta | null; status: VaultStatus }
  | { type: "unlocked"; meta: VaultMeta }
  | { type: "enabled"; meta: VaultMeta; recoveryKey: string }
  | { type: "disabled" }
  | { type: "locked" };

export function initialVaultState(meta: VaultMeta | null): VaultState {
  return {
    status: meta ? "locked" : "disabled",
    meta,
    modalOpen: false,
    modalView: meta ? "unlock" : "intro",
    busy: false,
    error: "",
    recoveryKey: "",
    recoveryInput: "",
  };
}

export function vaultReducer(state: VaultState, action: VaultAction): VaultState {
  switch (action.type) {
    case "openModal":
      return { ...state, modalOpen: true, modalView: action.view, error: "", recoveryInput: "" };
    case "closeModal":
      return { ...state, modalOpen: false };
    case "setView":
      return { ...state, modalView: action.view };
    case "setRecoveryInput":
      return { ...state, recoveryInput: action.value };
    case "setRecoveryKey":
      return { ...state, recoveryKey: action.value };
    case "setError":
      return { ...state, error: action.value };
    case "busy":
      return { ...state, busy: true, error: "" };
    case "idle":
      return { ...state, busy: false };
    case "lockUpdated":
      return { ...state, meta: action.meta, status: action.status };
    case "unlocked":
      return {
        ...state,
        meta: action.meta,
        status: "unlocked",
        modalView: "manage",
        modalOpen: false,
        error: "",
      };
    case "enabled":
      return {
        ...state,
        meta: action.meta,
        status: "unlocked",
        recoveryKey: action.recoveryKey,
        modalView: "manage",
      };
    case "disabled":
      return {
        ...state,
        meta: null,
        status: "disabled",
        recoveryKey: "",
        recoveryInput: "",
        modalView: "intro",
        modalOpen: false,
      };
    case "locked":
      return {
        ...state,
        status: "locked",
        modalView: "unlock",
        modalOpen: false,
      };
    default:
      return state;
  }
}
