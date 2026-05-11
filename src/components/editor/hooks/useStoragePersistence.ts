import { useEffect, useState } from "react";

export function useStoragePersistence() {
  const [storagePersisted, setStoragePersisted] = useState<boolean | null>(null);

  useEffect(() => {
    if ("storage" in navigator && "persist" in navigator.storage) {
      navigator.storage
        .persist()
        .then(setStoragePersisted)
        .catch(() => setStoragePersisted(false));
    } else {
      setStoragePersisted(false);
    }
  }, []);

  return storagePersisted;
}
