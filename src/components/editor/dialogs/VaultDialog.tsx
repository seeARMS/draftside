import { LoaderCircle, Lock, LockOpen } from "lucide-react";
import type { Dispatch, SetStateAction, ReactNode } from "react";
import type { VaultMeta, VaultModalView, VaultStatus } from "../../../lib/types";
import { writeClipboardText } from "../../../lib/markdown";
import { Button } from "../../ui/button";
import { overlay } from "../tailwind";
import { PanelLayout } from "../dialogPrimitives";

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
      <div
        className="grid w-[min(34rem,100%)] max-h-[min(46rem,calc(100svh-2rem))] overflow-y-auto rounded-3xl bg-popover px-7 py-6 text-popover-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)),0_30px_80px_hsl(var(--shadow-color)/0.18)] max-[540px]:px-5 max-[540px]:py-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vault-title"
      >
        {modalView === "intro" ? (
          <PanelLayout
            titleId="vault-title"
            title="Enable Private Vault"
            body="Encrypt every local draft with a passkey before it's saved to this browser."
            primary={
              <Button type="button" size="lg" className="max-[540px]:w-full" onClick={() => void enableVault()} disabled={busy}>
                {busy ? <LoaderCircle className="animate-spin" size={15} /> : <Lock size={15} />}
                Enable Private Vault
              </Button>
            }
            secondary={
              <Button type="button" size="lg" variant="ghost" className="max-[540px]:w-full" onClick={() => setModalOpen(false)} disabled={busy}>
                Cancel
              </Button>
            }
          >
            <ErrorNotice error={error} />
            <FeatureGrid
              items={[
                { title: "Passkey unlock", body: "Touch ID, device PIN, or another passkey method." },
                { title: "Local encryption", body: "Drafts are encrypted in IndexedDB with AES-GCM." },
                { title: "Offline first", body: "No account or server is required to unlock drafts." },
                { title: "Recovery key", body: "Generated once in case the passkey is unavailable." },
              ]}
            />
            <p className="m-0 text-[0.8125rem] leading-6 text-muted-foreground">
              Private Vault requires passkey PRF support. If this browser or authenticator cannot provide PRF output, Draftside will leave drafts unencrypted.
            </p>
          </PanelLayout>
        ) : null}

        {modalView === "unlock" ? (
          <PanelLayout
            titleId="vault-title"
            title="Unlock Private Vault"
            body="Use your passkey to decrypt drafts stored on this device."
            primary={
              <Button type="button" size="lg" className="max-[540px]:w-full" onClick={() => void unlockWithPasskey()} disabled={busy}>
                {busy ? <LoaderCircle className="animate-spin" size={15} /> : <LockOpen size={15} />}
                Unlock with passkey
              </Button>
            }
            secondary={
              <Button type="button" size="lg" variant="ghost" className="max-[540px]:w-full" onClick={() => setModalOpen(false)} disabled={busy}>
                Cancel
              </Button>
            }
          >
            <ErrorNotice error={error} />
            {vaultMeta?.recoveryWrappedKey ? (
              <div className="grid gap-2 rounded-xl bg-muted/50 px-4 py-3.5">
                <label htmlFor="vault-recovery-input" className="text-[0.8125rem] font-semibold leading-5 text-foreground">
                  Recovery key
                </label>
                <textarea
                  id="vault-recovery-input"
                  className="min-h-20 resize-y rounded-lg border border-border bg-background p-2.5 font-mono text-[0.8125rem] leading-6 text-foreground outline-none focus:border-ring"
                  value={recoveryInput}
                  onChange={(event) => setRecoveryInput(event.target.value)}
                  placeholder="xxxx-xxxx-xxxx..."
                  rows={3}
                  disabled={busy}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void unlockWithRecoveryKey()}
                  disabled={busy || !recoveryInput.trim()}
                >
                  Unlock with recovery key
                </Button>
              </div>
            ) : null}
          </PanelLayout>
        ) : null}

        {modalView === "manage" && recoveryKey ? (
          <PanelLayout
            titleId="vault-title"
            title="Save your recovery key"
            body="Draftside will not show this key again. Store it somewhere private before closing this dialog."
            primary={
              <Button type="button" size="lg" className="max-[540px]:w-full" onClick={() => setRecoveryKey("")} disabled={busy}>
                I saved it
              </Button>
            }
            secondary={
              <Button type="button" size="lg" variant="ghost" className="max-[540px]:w-full" onClick={() => void writeClipboardText(recoveryKey)} disabled={busy}>
                Copy key
              </Button>
            }
          >
            <ErrorNotice error={error} />
            <code className="block rounded-xl bg-muted/50 p-3.5 font-mono text-[0.8125rem] leading-6 text-foreground [overflow-wrap:anywhere]">
              {recoveryKey}
            </code>
          </PanelLayout>
        ) : null}

        {modalView === "manage" && !recoveryKey ? (
          <PanelLayout
            titleId="vault-title"
            title="Private Vault"
            body="Encrypted drafts unlock with your passkey on this device."
            primary={
              <Button type="button" size="lg" variant="destructive" className="max-[540px]:w-full" onClick={() => setModalView("disable")} disabled={busy}>
                Remove encryption
              </Button>
            }
            secondary={
              <Button type="button" size="lg" variant="ghost" className="max-[540px]:w-full" onClick={() => void lockVault()} disabled={busy}>
                Lock now
              </Button>
            }
          >
            <ErrorNotice error={error} />
            <FeatureGrid
              items={[
                { title: "Status", body: status === "unlocked" ? "unlocked on this tab" : status },
                { title: "Protected drafts", body: String(protectedDraftCount) },
                { title: "Saved as", body: "encrypted records" },
                { title: "Recovery", body: vaultMeta?.recoveryWrappedKey ? "enabled" : "not set" },
              ]}
            />
          </PanelLayout>
        ) : null}

        {modalView === "disable" ? (
          <PanelLayout
            titleId="vault-title"
            title="Remove encryption?"
            body="This keeps your drafts on this device, but rewrites them as plaintext local records. You can enable Private Vault again later."
            primary={
              <Button type="button" size="lg" variant="destructive" className="max-[540px]:w-full" onClick={() => void disableVault()} disabled={busy}>
                {busy ? <LoaderCircle className="animate-spin" size={15} /> : <LockOpen size={15} />}
                Remove encryption
              </Button>
            }
            secondary={
              <Button type="button" size="lg" variant="ghost" className="max-[540px]:w-full" onClick={() => setModalView("manage")} disabled={busy}>
                Back
              </Button>
            }
          >
            <ErrorNotice error={error} />
          </PanelLayout>
        ) : null}
      </div>
    </div>
  );
}

function ErrorNotice({ error }: { error: string }) {
  if (!error) return null;
  return (
    <p className="m-0 rounded-xl bg-destructive/10 px-4 py-3 text-[0.875rem] leading-6 text-destructive">{error}</p>
  );
}

interface FeatureGridItem {
  title: ReactNode;
  body: ReactNode;
}

function FeatureGrid({ items }: { items: FeatureGridItem[] }) {
  return (
    <dl className="m-0 grid grid-cols-2 gap-x-5 gap-y-3 max-[540px]:grid-cols-1">
      {items.map((item, i) => (
        <div key={i} className="grid min-w-0 gap-0.5">
          <dt className="text-[0.875rem] font-semibold leading-5 text-foreground">{item.title}</dt>
          <dd className="m-0 text-[0.8125rem] leading-5 text-muted-foreground">{item.body}</dd>
        </div>
      ))}
    </dl>
  );
}
