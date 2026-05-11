import { cn } from "../../lib/utils";

export const iconButton = (active?: boolean, className?: string) =>
  cn(
    "inline-flex size-10 shrink-0 items-center justify-center rounded-lg border-0 bg-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-muted-foreground max-[520px]:size-9",
    active && "bg-muted text-foreground",
    className,
  );

export const smallIconButton = (active?: boolean, className?: string) =>
  cn(
    "inline-flex size-9 shrink-0 items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-muted-foreground max-[520px]:size-8",
    active && "bg-muted text-foreground",
    className,
  );

export const miniIconButton = (className?: string) =>
  cn(
    "inline-flex size-7 shrink-0 items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-muted-foreground",
    className,
  );

export const panelShell =
  "min-w-0 min-h-0 overflow-hidden rounded-2xl bg-card text-card-foreground outline outline-1 -outline-offset-1 outline-border/60";

export const pill =
  "inline-flex min-h-6 items-center gap-1.5 whitespace-nowrap rounded-md bg-muted/70 px-2 py-1 text-xs font-medium leading-4 text-muted-foreground";

export const statusPill = (state: "default" | "ok" | "danger" = "default", className?: string) =>
  cn(
    pill,
    state === "ok" && "text-foreground",
    state === "danger" && "bg-destructive/10 text-destructive",
    className,
  );

export const popoverShell =
  "pointer-events-none absolute bottom-[calc(100%+0.65rem)] left-0 z-50 grid w-[min(22rem,calc(100vw-1.5rem))] translate-y-1 gap-3 rounded-xl bg-popover p-3.5 text-popover-foreground opacity-0 shadow-[inset_0_0_0_1px_hsl(var(--border)),0_18px_46px_hsl(var(--foreground)/0.12)] transition duration-100 ease-out group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 after:absolute after:bottom-[-0.4rem] after:left-4 after:size-3 after:rotate-45 after:border-b after:border-r after:border-border after:bg-popover";

export const popoverTitle =
  "flex items-start justify-between gap-3 text-sm font-semibold leading-tight text-foreground [&>span:last-child]:min-h-6 [&>span:last-child]:rounded-md [&>span:last-child]:bg-muted/70 [&>span:last-child]:px-2 [&>span:last-child]:py-1 [&>span:last-child]:text-xs [&>span:last-child]:font-medium [&>span:last-child]:leading-4 [&>span:last-child]:text-muted-foreground";

export const popoverGrid =
  "grid grid-cols-2 gap-x-3 gap-y-2 [&>span]:grid [&>span]:min-w-0 [&>span]:gap-0.5 [&_strong]:text-[0.6875rem] [&_strong]:font-medium [&_strong]:leading-4 [&_strong]:text-muted-foreground [&_em]:overflow-hidden [&_em]:text-ellipsis [&_em]:whitespace-nowrap [&_em]:not-italic [&_em]:text-[0.8125rem] [&_em]:leading-5 [&_em]:text-foreground";

export const overlay =
  "fixed inset-0 z-[80] grid place-items-center bg-background/50 p-4 backdrop-blur-md";

export const dialogShell =
  "grid w-[min(32rem,100%)] max-h-[min(42rem,calc(100svh-2rem))] gap-4 overflow-y-auto rounded-2xl bg-popover p-4 text-popover-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)),0_24px_78px_hsl(var(--foreground)/0.16)] max-[520px]:max-h-[calc(100svh-1rem)] max-[520px]:rounded-xl max-[520px]:p-3";

export const proseMirrorClass = cn(
  "min-h-0 flex-1 outline-none caret-foreground text-foreground font-sans text-base leading-7 tracking-normal selection:bg-foreground/10",
  "[&>*+*]:mt-[0.75em] [&_p]:m-0",
  "[&_h1]:mt-[1.4em] [&_h1]:mb-[0.35em] [&_h1]:text-3xl [&_h1]:font-medium [&_h1]:leading-tight max-[820px]:[&_h1]:text-[1.75rem] max-[520px]:[&_h1]:text-[1.5rem]",
  "[&_h2]:mt-[1.4em] [&_h2]:mb-[0.35em] [&_h2]:text-2xl [&_h2]:font-medium [&_h2]:leading-tight",
  "[&_h3]:mt-[1.4em] [&_h3]:mb-[0.35em] [&_h3]:text-xl [&_h3]:font-medium [&_h3]:leading-tight",
  "[&_ul]:pl-[1.625em] [&_ol]:pl-[1.625em] [&_li]:pl-1",
  "[&_blockquote]:relative [&_blockquote]:ml-0 [&_blockquote]:border-l-0 [&_blockquote]:py-[0.5em] [&_blockquote]:pl-[1.5em] [&_blockquote]:font-medium [&_blockquote]:text-foreground",
  "[&_blockquote]:after:absolute [&_blockquote]:after:left-0 [&_blockquote]:after:top-[0.5em] [&_blockquote]:after:h-[1.75em] [&_blockquote]:after:w-[0.25em] [&_blockquote]:after:rounded-sm [&_blockquote]:after:bg-border [&_blockquote]:after:content-['']",
  "[&_code]:rounded [&_code]:bg-foreground/10 [&_code]:px-[0.3em] [&_code]:py-[0.15em] [&_code]:font-mono [&_code]:text-[0.875em] [&_code]:font-medium [&_code]:text-foreground",
  "[&_pre]:m-0 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:px-4 [&_pre]:py-3.5 [&_pre]:font-mono [&_pre]:text-[0.8125rem] [&_pre]:leading-6 [&_pre]:text-foreground [&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_mark]:rounded [&_mark]:bg-muted [&_mark]:text-inherit",
  "[&_a]:text-foreground [&_a]:underline [&_a]:decoration-muted-foreground/50 [&_a]:decoration-dotted [&_a]:underline-offset-2 [&_a]:transition-colors hover:[&_a]:decoration-foreground",
  "[&_ul[data-type='taskList']]:list-none [&_ul[data-type='taskList']]:pl-0 [&_li[data-type='taskItem']]:flex [&_li[data-type='taskItem']]:items-start [&_li[data-type='taskItem']]:gap-2",
  "[&_li[data-type='taskItem']>label]:mt-[0.35em] [&_li[data-type='taskItem']>div]:flex-1",
  "[&_p.is-editor-empty:first-child:before]:pointer-events-none [&_p.is-editor-empty:first-child:before]:float-left [&_p.is-editor-empty:first-child:before]:h-0 [&_p.is-editor-empty:first-child:before]:text-muted-foreground/80 [&_p.is-editor-empty:first-child:before]:content-[attr(data-placeholder)]",
  "[&_.is-empty:before]:pointer-events-none [&_.is-empty:before]:float-left [&_.is-empty:before]:h-0 [&_.is-empty:before]:text-muted-foreground/80 [&_.is-empty:before]:content-[attr(data-placeholder)]",
  "max-[820px]:text-base max-[820px]:leading-[1.7] max-[520px]:text-[0.9375rem] max-[520px]:leading-7",
);
