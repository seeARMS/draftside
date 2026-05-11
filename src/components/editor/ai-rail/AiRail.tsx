import { MessageSquare, Sparkles } from "lucide-react";
import type { AiTab } from "../../../lib/types";
import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";
import { Progress } from "../../ui/progress";
import { panelShell } from "../tailwind";

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
    <aside
      id="draftside-ai-rail"
      className={cn(
        panelShell,
        "flex flex-col gap-3.5 p-4 opacity-100 transition-[opacity,transform,padding,outline-color,visibility] duration-200 ease-out",
        !aiSidebarOpen && "pointer-events-none invisible translate-x-4 px-0 opacity-0 outline-transparent",
        focusMode && "pointer-events-none invisible translate-x-4 p-0 opacity-0 outline-transparent",
        "max-[520px]:gap-3 max-[520px]:p-3",
      )}
      aria-label="Local AI"
      aria-hidden={focusMode || !aiSidebarOpen}
    >
      <div className="grid shrink-0 gap-3.5 max-[520px]:gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="mb-1.5 inline-flex min-h-6 items-center rounded-md bg-muted/70 px-2 text-xs font-medium leading-4 text-muted-foreground">Gemini Nano</p>
            <h2 className="m-0 text-xl font-medium leading-7 tracking-normal text-foreground max-[520px]:text-base max-[520px]:leading-6">Local ML</h2>
          </div>
        </div>

        {aiProgress !== null && (
          <Progress value={aiProgress} aria-label="Model download progress" />
        )}

        <div className="flex gap-1 rounded-lg bg-muted/70 p-1" role="tablist" aria-label="Local AI modes">
          <button
            type="button"
            id="ai-tab-tools"
            className={cn(
              "inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-md border-0 bg-transparent text-sm font-medium leading-5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground",
              aiTab === "tools" && "bg-background text-foreground",
            )}
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
            className={cn(
              "inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-md border-0 bg-transparent text-sm font-medium leading-5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground",
              aiTab === "chat" && "bg-background text-foreground",
            )}
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
