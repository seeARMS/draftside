import { LoaderCircle, Lock, LockOpen } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { VaultMeta, VaultModalView, VaultStatus } from "../../../lib/types";
import { writeClipboardText } from "../../../lib/markdown";

interface VaultDialogProps {
  busy: boolean;
  disableVault: () => Promise<void>;
  enableVault: () => Promise<void>;
  error: string;
  lockVault: () => Promise<void>;
  modalView: VaultModalView;
  protectedDraftCount: number;
  recoveryInput: string;
  recoveryKey: string;
  setModalOpen: Dispatch<SetStateAction<boolean>>;
  setModalView: Dispatch<SetStateAction<VaultModalView>>;
  setRecoveryInput: Dispatch<SetStateAction<string>>;
  setRecoveryKey: Dispatch<SetStateAction<string>>;
  status: VaultStatus;
  unlockWithPasskey: () => Promise<void>;
  unlockWithRecoveryKey: () => Promise<void>;
  vaultMeta: VaultMeta | null;
}

export function VaultDialog({
  busy,
  disableVault,
  enableVault,
  error,
  lockVault,
  modalView,
  protectedDraftCount,
  recoveryInput,
  recoveryKey,
  setModalOpen,
  setModalView,
  setRecoveryInput,
  setRecoveryKey,
  status,
  unlockWithPasskey,
  unlockWithRecoveryKey,
  vaultMeta,
}: VaultDialogProps) {
  return (
    <div
      className="vault-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy && !recoveryKey) setModalOpen(false);
      }}
    >
      <div className="vault-dialog" role="dialog" aria-modal="true" aria-labelledby="vault-title">
        <div className="vault-dialog-header">
          <div className="vault-dialog-icon" aria-hidden="true">
            {status === "unlocked" ? <LockOpen size={19} /> : <Lock size={19} />}
          </div>
          <div>
            <h2 id="vault-title">{modalView === "unlock" ? "Unlock Private Vault" : modalView === "disable" ? "Remove encryption?" : "Private Vault"}</h2>
            <p>
              {modalView === "unlock"
                ? "Use your passkey to decrypt drafts stored on this device."
                : modalView === "disable"
                  ? "Draftside will rewrite encrypted drafts as regular local drafts."
                  : "Encrypt every local draft before it is saved to this browser."}
            </p>
          </div>
        </div>

        {error ? <p className="vault-error">{error}</p> : null}

        {modalView === "intro" ? (
          <div className="vault-stack">
            <div className="vault-feature-grid">
              <span>
                <strong>Passkey unlock</strong>
                <em>Touch ID, device PIN, or another passkey method.</em>
              </span>
              <span>
                <strong>Local encryption</strong>
                <em>Drafts are encrypted in IndexedDB with AES-GCM.</em>
              </span>
              <span>
                <strong>Offline first</strong>
                <em>No account or server is required to unlock drafts.</em>
              </span>
              <span>
                <strong>Recovery key</strong>
                <em>Generated once in case the passkey is unavailable.</em>
              </span>
            </div>
            <p className="vault-note">
              Private Vault requires passkey PRF support. If this browser or authenticator cannot provide PRF output, Draftside will leave drafts unencrypted.
            </p>
            <div className="vault-actions">
              <button type="button" className="vault-secondary" onClick={() => setModalOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="vault-primary" onClick={() => void enableVault()} disabled={busy}>
                {busy ? <LoaderCircle className="spin" size={15} /> : <Lock size={15} />}
                Enable Private Vault
              </button>
            </div>
          </div>
        ) : null}

        {modalView === "unlock" ? (
          <div className="vault-stack">
            <button type="button" className="vault-primary vault-full-button" onClick={() => void unlockWithPasskey()} disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={15} /> : <LockOpen size={15} />}
              Unlock with passkey
            </button>

            {vaultMeta?.recoveryWrappedKey ? (
              <div className="vault-recovery-unlock">
                <label htmlFor="vault-recovery-input">Recovery key</label>
                <textarea
                  id="vault-recovery-input"
                  value={recoveryInput}
                  onChange={(event) => setRecoveryInput(event.target.value)}
                  placeholder="xxxx-xxxx-xxxx..."
                  rows={3}
                  disabled={busy}
                />
                <button type="button" className="vault-secondary" onClick={() => void unlockWithRecoveryKey()} disabled={busy || !recoveryInput.trim()}>
                  Unlock with recovery key
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {modalView === "manage" ? (
          <div className="vault-stack">
            {recoveryKey ? (
              <div className="vault-recovery-card">
                <strong>Save this recovery key now</strong>
                <code>{recoveryKey}</code>
                <p>Draftside will not show this key again. Store it somewhere private before closing this dialog.</p>
                <div className="vault-actions">
                  <button type="button" className="vault-secondary" onClick={() => void writeClipboardText(recoveryKey)} disabled={busy}>
                    Copy key
                  </button>
                  <button type="button" className="vault-primary" onClick={() => setRecoveryKey("")} disabled={busy}>
                    I saved it
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="vault-feature-grid">
                  <span>
                    <strong>Status</strong>
                    <em>{status === "unlocked" ? "unlocked on this tab" : status}</em>
                  </span>
                  <span>
                    <strong>Protected drafts</strong>
                    <em>{protectedDraftCount}</em>
                  </span>
                  <span>
                    <strong>Saved as</strong>
                    <em>encrypted records</em>
                  </span>
                  <span>
                    <strong>Recovery</strong>
                    <em>{vaultMeta?.recoveryWrappedKey ? "enabled" : "not set"}</em>
                  </span>
                </div>
                <div className="vault-actions">
                  <button type="button" className="vault-secondary" onClick={() => void lockVault()} disabled={busy}>
                    Lock now
                  </button>
                  <button type="button" className="vault-danger" onClick={() => setModalView("disable")} disabled={busy}>
                    Remove encryption
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}

        {modalView === "disable" ? (
          <div className="vault-stack">
            <p className="vault-note">This keeps your drafts on this device, but rewrites them as plaintext local records. You can enable Private Vault again later.</p>
            <div className="vault-actions">
              <button type="button" className="vault-secondary" onClick={() => setModalView("manage")} disabled={busy}>
                Back
              </button>
              <button type="button" className="vault-danger" onClick={() => void disableVault()} disabled={busy}>
                {busy ? <LoaderCircle className="spin" size={15} /> : <LockOpen size={15} />}
                Remove encryption
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
