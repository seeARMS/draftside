import { LoaderCircle, Lock, LockOpen } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { VaultMeta, VaultModalView, VaultStatus } from "../../../lib/types";
import { writeClipboardText } from "../../../lib/markdown";
import { Button } from "../../ui/button";
import { dialogShell, overlay } from "../tailwind";

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
      className={overlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy && !recoveryKey) setModalOpen(false);
      }}
    >
      <div className={dialogShell} role="dialog" aria-modal="true" aria-labelledby="vault-title">
        <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-3.5">
          <div className="inline-flex size-11 items-center justify-center rounded-lg bg-muted text-foreground" aria-hidden="true">
            {status === "unlocked" ? <LockOpen size={19} /> : <Lock size={19} />}
          </div>
          <div>
            <h2 id="vault-title" className="m-0 text-base font-semibold leading-6 text-foreground">{modalView === "unlock" ? "Unlock Private Vault" : modalView === "disable" ? "Remove encryption?" : "Private Vault"}</h2>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">
              {modalView === "unlock"
                ? "Use your passkey to decrypt drafts stored on this device."
                : modalView === "disable"
                  ? "Draftside will rewrite encrypted drafts as regular local drafts."
                  : "Encrypt every local draft before it is saved to this browser."}
            </p>
          </div>
        </div>

        {error ? <p className="m-0 rounded-lg bg-destructive/10 p-3 text-sm leading-snug text-destructive">{error}</p> : null}

        {modalView === "intro" ? (
          <div className="grid gap-3.5">
            <div className="grid grid-cols-2 gap-2 max-[820px]:grid-cols-1">
              <span className="grid min-w-0 gap-1 rounded-lg bg-muted/55 p-3">
                <strong className="text-[0.8125rem] font-semibold leading-5 text-foreground">Passkey unlock</strong>
                <em className="text-xs not-italic leading-tight text-muted-foreground">Touch ID, device PIN, or another passkey method.</em>
              </span>
              <span className="grid min-w-0 gap-1 rounded-lg bg-muted/55 p-3">
                <strong className="text-[0.8125rem] font-semibold leading-5 text-foreground">Local encryption</strong>
                <em className="text-xs not-italic leading-tight text-muted-foreground">Drafts are encrypted in IndexedDB with AES-GCM.</em>
              </span>
              <span className="grid min-w-0 gap-1 rounded-lg bg-muted/55 p-3">
                <strong className="text-[0.8125rem] font-semibold leading-5 text-foreground">Offline first</strong>
                <em className="text-xs not-italic leading-tight text-muted-foreground">No account or server is required to unlock drafts.</em>
              </span>
              <span className="grid min-w-0 gap-1 rounded-lg bg-muted/55 p-3">
                <strong className="text-[0.8125rem] font-semibold leading-5 text-foreground">Recovery key</strong>
                <em className="text-xs not-italic leading-tight text-muted-foreground">Generated once in case the passkey is unavailable.</em>
              </span>
            </div>
            <p className="m-0 text-sm leading-snug text-muted-foreground">
              Private Vault requires passkey PRF support. If this browser or authenticator cannot provide PRF output, Draftside will leave drafts unencrypted.
            </p>
            <div className="flex justify-end gap-2 max-[820px]:flex-col-reverse">
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void enableVault()} disabled={busy}>
                {busy ? <LoaderCircle className="animate-spin" size={15} /> : <Lock size={15} />}
                Enable Private Vault
              </Button>
            </div>
          </div>
        ) : null}

        {modalView === "unlock" ? (
          <div className="grid gap-3.5">
            <Button type="button" className="w-full" onClick={() => void unlockWithPasskey()} disabled={busy}>
              {busy ? <LoaderCircle className="animate-spin" size={15} /> : <LockOpen size={15} />}
              Unlock with passkey
            </Button>

            {vaultMeta?.recoveryWrappedKey ? (
              <div className="grid min-w-0 gap-1 rounded-lg bg-muted/55 p-3">
                <label htmlFor="vault-recovery-input" className="text-[0.8125rem] font-semibold leading-5 text-foreground">Recovery key</label>
                <textarea
                  id="vault-recovery-input"
                  className="min-h-20 resize-y rounded-md border border-border bg-background p-2.5 font-mono text-[0.8125rem] leading-snug text-foreground outline-none focus:border-ring"
                  value={recoveryInput}
                  onChange={(event) => setRecoveryInput(event.target.value)}
                  placeholder="xxxx-xxxx-xxxx..."
                  rows={3}
                  disabled={busy}
                />
                <Button type="button" variant="secondary" onClick={() => void unlockWithRecoveryKey()} disabled={busy || !recoveryInput.trim()}>
                  Unlock with recovery key
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {modalView === "manage" ? (
          <div className="grid gap-3.5">
            {recoveryKey ? (
              <div className="grid min-w-0 gap-1 rounded-lg bg-muted/55 p-3">
                <strong className="text-[0.8125rem] font-semibold leading-5 text-foreground">Save this recovery key now</strong>
                <code className="block rounded-md bg-background p-2.5 font-mono text-[0.8125rem] leading-snug text-foreground [overflow-wrap:anywhere]">{recoveryKey}</code>
                <p className="mt-1 text-sm leading-snug text-muted-foreground">Draftside will not show this key again. Store it somewhere private before closing this dialog.</p>
                <div className="flex justify-end gap-2 max-[820px]:flex-col-reverse">
                  <Button type="button" variant="secondary" onClick={() => void writeClipboardText(recoveryKey)} disabled={busy}>
                    Copy key
                  </Button>
                  <Button type="button" onClick={() => setRecoveryKey("")} disabled={busy}>
                    I saved it
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 max-[820px]:grid-cols-1">
                  <span className="grid min-w-0 gap-1 rounded-lg bg-muted/55 p-3">
                    <strong className="text-[0.8125rem] font-semibold leading-5 text-foreground">Status</strong>
                    <em className="text-xs not-italic leading-tight text-muted-foreground">{status === "unlocked" ? "unlocked on this tab" : status}</em>
                  </span>
                  <span className="grid min-w-0 gap-1 rounded-lg bg-muted/55 p-3">
                    <strong className="text-[0.8125rem] font-semibold leading-5 text-foreground">Protected drafts</strong>
                    <em className="text-xs not-italic leading-tight text-muted-foreground">{protectedDraftCount}</em>
                  </span>
                  <span className="grid min-w-0 gap-1 rounded-lg bg-muted/55 p-3">
                    <strong className="text-[0.8125rem] font-semibold leading-5 text-foreground">Saved as</strong>
                    <em className="text-xs not-italic leading-tight text-muted-foreground">encrypted records</em>
                  </span>
                  <span className="grid min-w-0 gap-1 rounded-lg bg-muted/55 p-3">
                    <strong className="text-[0.8125rem] font-semibold leading-5 text-foreground">Recovery</strong>
                    <em className="text-xs not-italic leading-tight text-muted-foreground">{vaultMeta?.recoveryWrappedKey ? "enabled" : "not set"}</em>
                  </span>
                </div>
                <div className="flex justify-end gap-2 max-[820px]:flex-col-reverse">
                  <Button type="button" variant="secondary" onClick={() => void lockVault()} disabled={busy}>
                    Lock now
                  </Button>
                  <Button type="button" variant="destructive" onClick={() => setModalView("disable")} disabled={busy}>
                    Remove encryption
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : null}

        {modalView === "disable" ? (
          <div className="grid gap-3.5">
            <p className="m-0 text-sm leading-snug text-muted-foreground">This keeps your drafts on this device, but rewrites them as plaintext local records. You can enable Private Vault again later.</p>
            <div className="flex justify-end gap-2 max-[820px]:flex-col-reverse">
              <Button type="button" variant="secondary" onClick={() => setModalView("manage")} disabled={busy}>
                Back
              </Button>
              <Button type="button" variant="destructive" onClick={() => void disableVault()} disabled={busy}>
                {busy ? <LoaderCircle className="animate-spin" size={15} /> : <LockOpen size={15} />}
                Remove encryption
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
