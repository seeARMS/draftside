import { VAULT_META_KEY } from "./constants";
import type { EncryptedPayload, VaultMeta } from "./types";
import { base64UrlToBytes, bytesToBase64Url, randomBytes, textBytes } from "./encoding";

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function importAesKey(raw: BufferSource) {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function deriveWrappingKey(secret: BufferSource, purpose: string) {
  const material = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: textBytes("draftside-private-vault-v1"),
      info: textBytes(purpose),
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptBytes(key: CryptoKey, bytes: Uint8Array): Promise<EncryptedPayload> {
  const iv = randomBytes(12);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, toArrayBuffer(bytes));
  return {
    alg: "AES-GCM",
    data: bytesToBase64Url(new Uint8Array(encrypted)),
    iv: bytesToBase64Url(iv),
  };
}

async function decryptBytes(key: CryptoKey, payload: EncryptedPayload) {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(base64UrlToBytes(payload.iv)) },
    key,
    toArrayBuffer(base64UrlToBytes(payload.data)),
  );
  return new Uint8Array(decrypted);
}

function readVaultMeta(): VaultMeta | null {
  try {
    const stored = localStorage.getItem(VAULT_META_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as Partial<VaultMeta>;
    if (
      parsed.version !== 1 ||
      typeof parsed.id !== "string" ||
      typeof parsed.credentialId !== "string" ||
      typeof parsed.salt !== "string" ||
      !parsed.wrappedKey ||
      typeof parsed.wrappedKey.data !== "string" ||
      typeof parsed.wrappedKey.iv !== "string"
    ) {
      return null;
    }

    return parsed as VaultMeta;
  } catch {
    return null;
  }
}

function writeVaultMeta(meta: VaultMeta) {
  localStorage.setItem(VAULT_META_KEY, JSON.stringify(meta));
}

function clearVaultMeta() {
  localStorage.removeItem(VAULT_META_KEY);
}

function ensureVaultRuntime() {
  if (!window.isSecureContext) {
    throw new Error("Private Vault requires a secure browser context. Use HTTPS or localhost.");
  }
  if (!("PublicKeyCredential" in window) || !navigator.credentials?.create || !navigator.credentials?.get) {
    throw new Error("This browser does not support passkeys.");
  }
  if (!crypto.subtle) {
    throw new Error("This browser does not support Web Crypto.");
  }
}

function getPrfResult(credential: PublicKeyCredential) {
  const extensions = credential.getClientExtensionResults() as { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } };
  const first = extensions.prf?.results?.first;
  return first ? new Uint8Array(first) : null;
}

async function createVaultCredential(salt: Uint8Array) {
  ensureVaultRuntime();

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: "Draftside" },
      user: {
        id: randomBytes(32),
        name: "draftside-local-vault",
        displayName: "Draftside Local Vault",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
      attestation: "none",
      timeout: 120000,
      extensions: {
        prf: {
          eval: {
            first: salt,
          },
        },
      } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;

  if (!credential) throw new Error("Passkey creation was cancelled.");

  const credentialId = bytesToBase64Url(new Uint8Array(credential.rawId));
  return {
    credentialId,
    prf: getPrfResult(credential),
  };
}

async function evaluateCredentialPrf(credentialId: string, salt: Uint8Array) {
  ensureVaultRuntime();

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [
        {
          type: "public-key",
          id: base64UrlToBytes(credentialId),
        },
      ],
      userVerification: "required",
      timeout: 120000,
      extensions: {
        prf: {
          eval: {
            first: salt,
          },
        },
      } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;

  if (!assertion) throw new Error("Passkey unlock was cancelled.");
  const prf = getPrfResult(assertion);
  if (!prf) {
    throw new Error("This passkey did not expose the PRF output Draftside needs for local encryption.");
  }
  return prf;
}

async function unwrapVaultKey(meta: VaultMeta, wrappingKey: CryptoKey) {
  const raw = await decryptBytes(wrappingKey, meta.wrappedKey);
  return importAesKey(raw);
}

export {
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
};
