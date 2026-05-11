import { MessageSquare, Sparkles } from "lucide-react";
import type { AiTab } from "../../../lib/types";
import type { ReactNode } from "react";

interface AiRailProps {
  focusMode: boolean;
  aiSidebarOpen: boolean;
  aiProgress: number | null;
  aiTab: AiTab;
  setAiTab: (tab: AiTab) => void;
  children: ReactNode;
}

export function AiRail({ focusMode, aiSidebarOpen, aiProgress, aiTab, setAiTab, children }: AiRailProps) {
  return (
    <aside id="draftside-ai-rail" className="ai-rail" aria-label="Local AI" aria-hidden={focusMode || !aiSidebarOpen}>
      <div className="ai-top">
        <div className="ai-header">
          <div>
            <p className="eyebrow">Gemini Nano</p>
            <h2>Local ML</h2>
          </div>
        </div>

        {aiProgress !== null && (
          <div className="progress-wrap" aria-label="Model download progress">
            <span style={{ width: `${Math.round(aiProgress * 100)}%` }} />
          </div>
        )}

        <div className="ai-tabs" role="tablist" aria-label="Local AI modes">
          <button
            type="button"
            id="ai-tab-tools"
            className={aiTab === "tools" ? "ai-tab is-active" : "ai-tab"}
            role="tab"
            aria-selected={aiTab === "tools"}
            aria-controls="ai-panel-tools"
            onClick={() => setAiTab("tools")}
          >
            <Sparkles size={15} />
            Tools
          </button>
          <button
            type="button"
            id="ai-tab-chat"
            className={aiTab === "chat" ? "ai-tab is-active" : "ai-tab"}
            role="tab"
            aria-selected={aiTab === "chat"}
            aria-controls="ai-panel-chat"
            onClick={() => setAiTab("chat")}
          >
            <MessageSquare size={15} />
            Chat
          </button>
        </div>
      </div>

      {children}
    </aside>
  );
}
