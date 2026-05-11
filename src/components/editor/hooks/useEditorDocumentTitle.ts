import { useCallback, useEffect, useState } from "react";
import { deriveTitle } from "../../../lib/session";
import type { WriteSession } from "../../../lib/types";

const DEFAULT_DOCUMENT_TITLE = "Draftside";

export function useEditorDocumentTitle(activeSession: WriteSession | null) {
  const [documentTitle, setDocumentTitle] = useState(DEFAULT_DOCUMENT_TITLE);

  const updateDocumentTitle = useCallback((text: string) => {
    setDocumentTitle(deriveTitle(text));
  }, []);

  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  useEffect(() => {
    return () => {
      document.title = DEFAULT_DOCUMENT_TITLE;
    };
  }, []);

  useEffect(() => {
    if (!activeSession) {
      setDocumentTitle(DEFAULT_DOCUMENT_TITLE);
      return;
    }

    updateDocumentTitle(activeSession.plainText);
  }, [activeSession, updateDocumentTitle]);

  return { updateDocumentTitle };
}
