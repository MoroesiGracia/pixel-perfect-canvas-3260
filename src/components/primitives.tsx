import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PRIORITY_LABEL, type Priority } from "@/lib/data";

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("overflow-hidden rounded-[14px] bg-card ring-1 ring-border", className)}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
      <h2 className="font-head text-[15px] font-semibold tracking-tight">{title}</h2>
      {meta ? <div className="ml-1">{meta}</div> : null}
      {action ? <div className="ml-auto">{action}</div> : null}
    </div>
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

const priorityRing: Record<Priority, string> = {
  urgent: "bg-urgent/12 text-urgent ring-urgent/25",
  high: "bg-high/12 text-high ring-high/25",
  medium: "bg-mid/15 text-mid ring-mid/25",
  low: "bg-low/15 text-low ring-low/25",
};

export function PriorityChip({ priority }: { priority: Priority }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ring-1",
        priorityRing[priority],
      )}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

const priorityRail: Record<Priority, string> = {
  urgent: "bg-urgent",
  high: "bg-high",
  medium: "bg-mid",
  low: "bg-low",
};

export function PriorityRail({ priority }: { priority: Priority }) {
  return (
    <span className={cn("h-8 w-1 shrink-0 rounded-full", priorityRail[priority])} aria-hidden />
  );
}

export function StatusChip({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  );
}

export function DraftChip({ approved }: { approved: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ring-1",
        approved ? "bg-brand/10 text-brand ring-brand/25" : "bg-mid/15 text-mid ring-mid/25",
      )}
    >
      {approved ? "Approved" : "Draft"}
    </span>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="text-[13.5px] font-medium">{title}</p>
      {hint ? <p className="mt-1 text-[12.5px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function LoadingRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border/70">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3.5">
          <div className="h-8 w-1 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="px-5 py-8 text-center">
      <p className="text-[13.5px] font-medium text-destructive">Couldn't load this</p>
      <p className="mt-1 text-[12.5px] text-muted-foreground">{message}</p>
      {onRetry ? (
        <button
          onClick={onRetry}
          className="mt-3 rounded-lg px-3 py-1.5 text-[13px] ring-1 ring-border hover:bg-accent"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
