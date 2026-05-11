import { useCallback, useReducer, useRef } from "react";
import type { Editor } from "@tiptap/core";
import type { VaultMeta, VaultModalView, WriteSession } from "../../../lib/types";
import {
  clearVaultMeta,
  createVaultCredential,
  decryptBytes,
  deriveWrappingKey,
  encryptBytes,
  ensureVaultRuntime,
  evaluateCredentialPrf,
  importAesKey,
  readVaultMeta,
  unwrapVaultKey,
  writeVaultMeta,
} from "../../../vault/crypto";
import { base64UrlToBytes, bytesToBase64Url, formatRecoveryKey, hexToBytes, randomBytes } from "../../../lib/encoding";
import { getLockedSessionSummaries } from "../../../storage/sessions";
import { initialVaultState, vaultReducer } from "../state/vaultReducer";
import { clearEditorGhostCompletion } from "../../../tiptap/ghostCompletion";

interface UseVaultOptions {
  saveTimerRef: React.MutableRefObject<number | null>;
  loadUnlockedSessions: (vaultKey: CryptoKey) => Promise<void>;
  hydrateLocked: () => Promise<void>;
  getCurrentSnapshot: (editor: Editor | null) => WriteSession[];
  replaceAll: (sessions: WriteSession[], vaultKey: CryptoKey | null) => Promise<void>;
  setSessions: React.Dispatch<React.SetStateAction<WriteSession[]>>;
  setLockedSessions: React.Dispatch<React.SetStateAction<import("../../../lib/types").LockedSessionSummary[]>>;
  setActiveSession: React.Dispatch<React.SetStateAction<WriteSession | null>>;
  activeSessionRef: React.MutableRefObject<WriteSession | null>;
  setLastSavedAt: React.Dispatch<React.SetStateAction<number | null>>;
  setSaveState: React.Dispatch<React.SetStateAction<import("../../../lib/types").SaveState>>;
  destroyAllModels: () => void;
  editor: Editor | null;
  resetUiOnLock: () => void;
}

export function useVault(options: UseVaultOptions) {
  const initialMeta = readVaultMeta();
  const [state, dispatch] = useReducer(vaultReducer, initialMeta, initialVaultState);
  const vaultKeyRef = useRef<CryptoKey | null>(null);

  const {
    saveTimerRef,
    loadUnlockedSessions,
    hydrateLocked,
    getCurrentSnapshot,
    replaceAll,
    setSessions,
    setLockedSessions,
    setActiveSession,
    activeSessionRef,
    setLastSavedAt,
    setSaveState,
    destroyAllModels,
    editor,
    resetUiOnLock,
  } = options;

  const openVaultModal = useCallback(
    (view?: VaultModalView) => {
      const fallback: VaultModalView = state.status === "unlocked" ? "manage" : state.status === "locked" ? "unlock" : "intro";
      dispatch({ type: "openModal", view: view ?? fallback });
    },
    [state.status],
  );

  const setModalOpen = useCallback((open: boolean) => {
    if (open) dispatch({ type: "openModal", view: state.modalView });
    else dispatch({ type: "closeModal" });
  }, [state.modalView]);

  const setModalView = useCallback((view: VaultModalView) => {
    dispatch({ type: "setView", view });
  }, []);

  const setRecoveryInput = useCallback((value: string) => {
    dispatch({ type: "setRecoveryInput", value });
  }, []);

  const setRecoveryKey = useCallback((value: string) => {
    dispatch({ type: "setRecoveryKey", value });
  }, []);

  const unlockVaultWithKey = useCallback(
    async (vaultKey: CryptoKey, meta: VaultMeta) => {
      vaultKeyRef.current = vaultKey;
      await loadUnlockedSessions(vaultKey);
      dispatch({ type: "unlocked", meta });
    },
    [loadUnlockedSessions],
  );

  const unlockWithPasskey = useCallback(async () => {
    const meta = state.meta ?? readVaultMeta();
    if (!meta) return;

    dispatch({ type: "busy" });

    try {
      const prf = await evaluateCredentialPrf(meta.credentialId, base64UrlToBytes(meta.salt));
      const wrappingKey = await deriveWrappingKey(prf, `passkey:${meta.id}`);
      const vaultKey = await unwrapVaultKey(meta, wrappingKey);
      await unlockVaultWithKey(vaultKey, meta);
    } catch (error) {
      dispatch({ type: "setError", value: error instanceof Error ? error.message : "Could not unlock Private Vault." });
    } finally {
      dispatch({ type: "idle" });
    }
  }, [state.meta, unlockVaultWithKey]);

  const unlockWithRecoveryKey = useCallback(async () => {
    const meta = state.meta ?? readVaultMeta();
    if (!meta?.recoveryWrappedKey) {
      dispatch({ type: "setError", value: "This vault does not have a recovery key." });
      return;
    }

    dispatch({ type: "busy" });

    try {
      const recoveryBytes = hexToBytes(state.recoveryInput);
      const wrappingKey = await deriveWrappingKey(recoveryBytes, `recovery:${meta.id}`);
      const rawVaultKey = await decryptBytes(wrappingKey, meta.recoveryWrappedKey);
      const vaultKey = await importAesKey(rawVaultKey);
      await unlockVaultWithKey(vaultKey, meta);
    } catch (error) {
      dispatch({ type: "setError", value: error instanceof Error ? error.message : "Recovery key could not unlock this vault." });
    } finally {
      dispatch({ type: "idle" });
    }
  }, [state.meta, state.recoveryInput, unlockVaultWithKey]);

  const enableVault = useCallback(async () => {
    dispatch({ type: "busy" });

    try {
      ensureVaultRuntime();

      const sessionsToEncrypt = getCurrentSnapshot(editor);
      const vaultKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
      const rawVaultKey = new Uint8Array(await crypto.subtle.exportKey("raw", vaultKey));
      const salt = randomBytes(32);
      const vaultId = crypto.randomUUID();
      const credential = await createVaultCredential(salt);
      const prf = credential.prf ?? (await evaluateCredentialPrf(credential.credentialId, salt));
      const passkeyWrappingKey = await deriveWrappingKey(prf, `passkey:${vaultId}`);
      const wrappedKey = await encryptBytes(passkeyWrappingKey, rawVaultKey);
      const recoveryBytes = randomBytes(32);
      const recoveryWrappingKey = await deriveWrappingKey(recoveryBytes, `recovery:${vaultId}`);
      const recoveryWrappedKey = await encryptBytes(recoveryWrappingKey, rawVaultKey);
      const now = Date.now();
      const nextMeta: VaultMeta = {
        id: vaultId,
        version: 1,
        credentialId: credential.credentialId,
        salt: bytesToBase64Url(salt),
        wrappedKey,
        recoveryWrappedKey,
        createdAt: now,
        updatedAt: now,
      };

      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      writeVaultMeta(nextMeta);
      vaultKeyRef.current = vaultKey;

      try {
        await replaceAll(sessionsToEncrypt, vaultKey);
      } catch (error) {
        clearVaultMeta();
        vaultKeyRef.current = null;
        throw error;
      }

      setSessions(sessionsToEncrypt);
      setLockedSessions([]);
      setActiveSession((current) => sessionsToEncrypt.find((session) => session.id === current?.id) ?? sessionsToEncrypt[0] ?? null);
      activeSessionRef.current =
        sessionsToEncrypt.find((session) => session.id === activeSessionRef.current?.id) ?? sessionsToEncrypt[0] ?? null;
      setSaveState("saved");
      setLastSavedAt(Date.now());
      dispatch({ type: "enabled", meta: nextMeta, recoveryKey: formatRecoveryKey(recoveryBytes) });
    } catch (error) {
      if (!state.meta) vaultKeyRef.current = null;
      dispatch({ type: "setError", value: error instanceof Error ? error.message : "Could not enable Private Vault." });
      dispatch({ type: "lockUpdated", meta: state.meta, status: state.meta ? "locked" : "disabled" });
    } finally {
      dispatch({ type: "idle" });
    }
  }, [
    activeSessionRef,
    editor,
    getCurrentSnapshot,
    replaceAll,
    saveTimerRef,
    setActiveSession,
    setLastSavedAt,
    setLockedSessions,
    setSaveState,
    setSessions,
    state.meta,
  ]);

  const lockVault = useCallback(async () => {
    const summaries = await getLockedSessionSummaries().catch(() => []);
    vaultKeyRef.current = null;
    activeSessionRef.current = null;
    setSessions([]);
    setLockedSessions(summaries);
    setActiveSession(null);
    setLastSavedAt(summaries[0]?.updatedAt ?? null);
    setSaveState("idle");
    resetUiOnLock();

    if (editor) {
      clearEditorGhostCompletion(editor);
      editor.commands.clearContent();
    }
    destroyAllModels();
    dispatch({ type: "locked" });
  }, [
    activeSessionRef,
    destroyAllModels,
    editor,
    resetUiOnLock,
    setActiveSession,
    setLastSavedAt,
    setLockedSessions,
    setSaveState,
    setSessions,
  ]);

  const disableVault = useCallback(async () => {
    if (!vaultKeyRef.current || state.status !== "unlocked") {
      dispatch({ type: "setError", value: "Unlock Private Vault before removing encryption." });
      dispatch({ type: "setView", view: "unlock" });
      return;
    }

    dispatch({ type: "busy" });

    try {
      const sessionsToWrite = getCurrentSnapshot(editor);
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      await replaceAll(sessionsToWrite, null);
      clearVaultMeta();
      vaultKeyRef.current = null;
      setSessions(sessionsToWrite);
      setLockedSessions([]);
      setSaveState("saved");
      setLastSavedAt(Date.now());
      dispatch({ type: "disabled" });
    } catch (error) {
      dispatch({ type: "setError", value: error instanceof Error ? error.message : "Could not remove encryption." });
    } finally {
      dispatch({ type: "idle" });
    }
  }, [
    editor,
    getCurrentSnapshot,
    replaceAll,
    saveTimerRef,
    setLastSavedAt,
    setLockedSessions,
    setSaveState,
    setSessions,
    state.status,
  ]);

  return {
    state,
    dispatch,
    vaultKeyRef,
    openVaultModal,
    setModalOpen,
    setModalView,
    setRecoveryInput,
    setRecoveryKey,
    unlockWithPasskey,
    unlockWithRecoveryKey,
    enableVault,
    lockVault,
    disableVault,
  };
}
