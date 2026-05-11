import type { EncryptedSessionRecord, LockedSessionSummary, StoredSessionRecord, WriteSession } from "../lib/types";
import { decryptBytes, encryptBytes } from "../vault/crypto";
import { textBytes } from "../lib/encoding";

const DB_NAME = "draftside";
const DB_VERSION = 1;
const SESSION_STORE = "sessions";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        const store = db.createObjectStore(SESSION_STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open Draftside storage."));
  });

  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionToPromise(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed."));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted."));
  });
}

function isEncryptedSessionRecord(record: unknown): record is EncryptedSessionRecord {
  if (!record || typeof record !== "object") return false;
  const data = record as Partial<EncryptedSessionRecord>;
  return data.encrypted === true && data.version === 1 && typeof data.id === "string" && typeof data.ciphertext?.data === "string";
}

async function encryptSessionRecord(session: WriteSession, vaultKey: CryptoKey): Promise<EncryptedSessionRecord> {
  const ciphertext = await encryptBytes(vaultKey, textBytes(JSON.stringify(session)));
  return {
    id: session.id,
    encrypted: true,
    version: 1,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    ciphertext,
  };
}

async function decryptSessionRecord(record: EncryptedSessionRecord, vaultKey: CryptoKey): Promise<WriteSession> {
  const bytes = await decryptBytes(vaultKey, record.ciphertext);
  const session = JSON.parse(new TextDecoder().decode(bytes)) as WriteSession;
  return {
    ...session,
    id: session.id || record.id,
    createdAt: session.createdAt || record.createdAt,
    updatedAt: session.updatedAt || record.updatedAt,
  };
}

async function getStoredSessionRecords() {
  const db = await openDb();
  const tx = db.transaction(SESSION_STORE, "readonly");
  return requestToPromise<StoredSessionRecord[]>(tx.objectStore(SESSION_STORE).getAll());
}

export async function getLockedSessionSummaries(): Promise<LockedSessionSummary[]> {
  const records = await getStoredSessionRecords();
  return records
    .map((record) => ({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getSessions(vaultKey?: CryptoKey | null) {
  const records = await getStoredSessionRecords();
  const sessions = await Promise.all(
    records.map((record) => {
      if (isEncryptedSessionRecord(record)) {
        if (!vaultKey) throw new Error("Private Vault is locked.");
        return decryptSessionRecord(record, vaultKey);
      }

      return Promise.resolve(record);
    }),
  );
  return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function putSession(session: WriteSession, vaultKey?: CryptoKey | null) {
  const record = vaultKey ? await encryptSessionRecord(session, vaultKey) : session;
  const db = await openDb();
  const tx = db.transaction(SESSION_STORE, "readwrite");
  await requestToPromise(tx.objectStore(SESSION_STORE).put(record));
}

export async function replaceAllSessions(sessions: WriteSession[], vaultKey?: CryptoKey | null) {
  const records = await Promise.all(sessions.map((session) => (vaultKey ? encryptSessionRecord(session, vaultKey) : Promise.resolve(session))));
  const db = await openDb();
  const tx = db.transaction(SESSION_STORE, "readwrite");
  const store = tx.objectStore(SESSION_STORE);
  store.clear();
  records.forEach((record) => store.put(record));
  await transactionToPromise(tx);
}

export async function removeSession(id: string) {
  const db = await openDb();
  const tx = db.transaction(SESSION_STORE, "readwrite");
  await requestToPromise(tx.objectStore(SESSION_STORE).delete(id));
}
