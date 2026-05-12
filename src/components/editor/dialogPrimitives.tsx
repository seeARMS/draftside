import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export const dialogHeadlineClass =
  "m-0 text-balance text-[1.6rem] font-semibold leading-[1.15] tracking-[-0.01em] text-foreground max-[540px]:text-[1.375rem]";

export const dialogSubheadClass =
  "m-0 text-balance text-[1.0625rem] font-semibold leading-snug text-foreground";

export const dialogCopyClass =
  "m-0 text-[0.9375rem] leading-7 text-muted-foreground";

export const dialogSmallCopyClass =
  "m-0 text-sm leading-6 text-muted-foreground";

export const eyebrowClass =
  "text-[0.7rem] font-medium uppercase tracking-[0.14em] text-muted-foreground";

export const dialogActionsClass =
  "mt-2 flex flex-wrap items-center justify-end gap-2 max-[540px]:flex-col-reverse max-[540px]:items-stretch";

export const popoverHeadlineClass =
  "m-0 text-[0.9375rem] font-semibold leading-snug text-foreground";

export const popoverCopyClass =
  "m-0 text-[0.8125rem] leading-6 text-muted-foreground";

export const popoverMetaClass = "text-xs leading-5 text-muted-foreground";

export function PanelLayout({
  accent,
  title,
  titleId,
  body,
  children,
  primary,
  secondary,
}: {
  accent?: ReactNode;
  title: ReactNode;
  titleId?: string;
  body?: ReactNode;
  children?: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
}) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-3">
        {accent ? <div className="inline-flex" aria-hidden="true">{accent}</div> : null}
        <h2 id={titleId} className={dialogHeadlineClass}>{title}</h2>
        {body ? <p className={dialogCopyClass}>{body}</p> : null}
      </div>
      {children}
      <div className={dialogActionsClass}>
        {secondary}
        {primary}
      </div>
    </div>
  );
}

export function InfoCard({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-1.5 rounded-xl bg-muted/50 px-4 py-3.5 text-[0.875rem] leading-6 text-foreground">
      {title ? <strong className="font-semibold">{title}</strong> : null}
      {children}
    </div>
  );
}

export function NumberedList({ items }: { items: ReactNode[] }) {
  return (
    <ol className="m-0 grid gap-2.5 p-0 text-[0.875rem] leading-6 text-muted-foreground">
      {items.map((item, i) => (
        <li key={i} className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-baseline gap-3">
          <span
            className="inline-flex size-5 items-center justify-center rounded-full bg-muted text-[0.6875rem] font-semibold leading-none text-foreground"
            aria-hidden="true"
          >
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="break-all rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8125rem] text-foreground">
      {children}
    </code>
  );
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-foreground">{children}</strong>;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn(eyebrowClass, className)}>{children}</span>;
}

export function KeyValueGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <dl className={cn("m-0 grid grid-cols-2 gap-x-4 gap-y-3 max-[420px]:grid-cols-1", className)}>
      {children}
    </dl>
  );
}

export function KeyValueRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] leading-4 text-muted-foreground">{label}</dt>
      <dd className="m-0 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[0.8125rem] font-medium leading-5 text-foreground">
        {value}
      </dd>
    </div>
  );
}
