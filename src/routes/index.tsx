import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/AppShell";
import { EmailComposer } from "@/components/EmailComposer";
import {
  DraftChip,
  EmptyState,
  ErrorState,
  Label,
  LoadingRows,
  Panel,
  PanelHeader,
  PriorityChip,
  PriorityRail,
} from "@/components/primitives";
import {
  emailsQuery,
  formatDay,
  formatTime,
  isOverdue,
  isToday,
  isWithinDays,
  meetingsQuery,
  relativeLate,
  sortByPriority,
  tasksQuery,
  weeklyProgress,
  type Priority,
} from "@/lib/data";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Smart Business Assistant" },
      {
        name: "description",
        content:
          "Today's tasks, upcoming deadlines, overdue work, recent meetings and email drafts on one operations desk.",
      },
      { property: "og:title", content: "Dashboard · Smart Business Assistant" },
      {
        property: "og:description",
        content:
          "Today's tasks, upcoming deadlines, overdue work, recent meetings and email drafts on one operations desk.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { fullName } = useAuth();
  const tasks = useQuery(tasksQuery());
  const meetings = useQuery(meetingsQuery());
  const emails = useQuery(emailsQuery());

  const allTasks = tasks.data ?? [];
  const open = allTasks.filter((t) => t.status !== "done");
  const todays = sortByPriority(open.filter((t) => isToday(t.due_date) || isOverdue(t)));
  const overdue = sortByPriority(open.filter(isOverdue));
  const upcoming = open
    .filter((t) => isWithinDays(t.due_date, 5) && !isToday(t.due_date))
    .slice(0, 5);
  const drafts = (emails.data ?? []).filter((e) => e.status === "draft");
  const followUps = (emails.data ?? []).filter((e) => e.is_follow_up && e.status === "draft");
  const progress = weeklyProgress(allTasks);

  const firstName = (fullName || "there").split(" ")[0];
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <AppShell
      title={`Good day, ${firstName} — your desk is squared and ready`}
      subtitle={`${today} · ${open.length} open tasks · ${overdue.length} overdue`}
      action={
        <Link
          to="/tasks"
          className="rounded-lg bg-brand px-3.5 py-2 text-[13px] font-medium text-brand-foreground ring-1 ring-brand/30 hover:bg-brand/90"
        >
          New task
        </Link>
      }
    >
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Today" value={todays.length} note="tasks scheduled" />
        <Stat label="Overdue" value={overdue.length} note="need attention" tone="urgent" />
        <Stat label="Follow-ups" value={followUps.length} note="pending replies" />
        <div className="rounded-[14px] bg-card p-4 ring-1 ring-border">
          <Label>Weekly</Label>
          <p className="mt-2 font-head text-[30px] leading-none font-semibold tracking-tight">
            {progress}
            <span className="text-[16px] text-muted-foreground">%</span>
          </p>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      <div className="mt-5">
        <EmailComposer />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Today's tasks"
            action={
              <div className="flex gap-4 font-mono text-[10px] text-muted-foreground">
                <LegendDot className="bg-urgent" label="Urgent" />
                <LegendDot className="bg-high" label="High" />
                <LegendDot className="bg-mid" label="Medium" />
                <LegendDot className="bg-low" label="Low" />
              </div>
            }
          />
          {tasks.isLoading ? (
            <LoadingRows rows={4} />
          ) : tasks.isError ? (
            <ErrorState message={(tasks.error as Error).message} onRetry={() => tasks.refetch()} />
          ) : todays.length === 0 ? (
            <EmptyState
              title="Nothing due today"
              hint="Add a task or ask the planner to lay out your day."
            />
          ) : (
            <ul className="divide-y divide-border/70">
              {todays.slice(0, 6).map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                  <PriorityRail priority={t.priority as Priority} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium">{t.title}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {isOverdue(t) ? relativeLate(t.due_date) : formatTime(t.due_date)}
                      {t.assignee_name ? ` · ${t.assignee_name}` : ""}
                    </p>
                  </div>
                  <PriorityChip priority={t.priority as Priority} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Upcoming deadlines"
            action={<span className="font-mono text-[11px] text-muted-foreground">Next 5 days</span>}
          />
          {tasks.isLoading ? (
            <LoadingRows />
          ) : upcoming.length === 0 ? (
            <EmptyState title="No deadlines in the next five days" />
          ) : (
            <ul className="divide-y divide-border/70">
              {upcoming.map((t) => {
                const d = new Date(t.due_date!);
                return (
                  <li key={t.id} className="flex items-start gap-3 px-5 py-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-background ring-1 ring-border">
                      <span className="font-head text-[15px] leading-none font-semibold">
                        {d.getDate()}
                      </span>
                      <span className="font-mono text-[9px] uppercase text-muted-foreground">
                        {d.toLocaleDateString(undefined, { month: "short" })}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{t.title}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        Due {formatTime(t.due_date)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Overdue"
            action={
              <span className="rounded-full bg-urgent/12 px-2 py-0.5 font-mono text-[10px] text-urgent">
                {overdue.length}
              </span>
            }
          />
          {tasks.isLoading ? (
            <LoadingRows rows={2} />
          ) : overdue.length === 0 ? (
            <EmptyState title="Nothing overdue" hint="The desk is clear." />
          ) : (
            <ul className="divide-y divide-border/70">
              {overdue.slice(0, 4).map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                  <PriorityRail priority={t.priority as Priority} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{t.title}</p>
                    <p className="font-mono text-[11px] text-urgent/80">
                      {relativeLate(t.due_date)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Recent meetings"
            action={
              <Link to="/meetings" className="font-mono text-[11px] text-brand hover:underline">
                Summarise
              </Link>
            }
          />
          {meetings.isLoading ? (
            <LoadingRows rows={2} />
          ) : (meetings.data ?? []).length === 0 ? (
            <EmptyState title="No meetings logged yet" hint="Paste notes to get a summary." />
          ) : (
            <ul className="divide-y divide-border/70">
              {(meetings.data ?? []).slice(0, 3).map((m) => (
                <li key={m.id} className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {formatDay(m.meeting_date)}
                    </span>
                    <span className="ml-auto">
                      <DraftChip approved={m.summary_status === "approved"} />
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[13px] font-medium">{m.title}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Pending follow-ups"
            action={
              <span className="rounded-full bg-warm/15 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                {followUps.length}
              </span>
            }
          />
          {emails.isLoading ? (
            <LoadingRows rows={2} />
          ) : followUps.length === 0 ? (
            <EmptyState title="No follow-ups waiting" hint="Generate one from a meeting summary." />
          ) : (
            <ul className="divide-y divide-border/70">
              {followUps.slice(0, 4).map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand/15 font-head text-[11px] font-semibold text-brand">
                    {(e.recipient_name ?? "?")[0]?.toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{e.subject}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {e.recipient_name ?? "No recipient yet"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Saved drafts"
            action={
              <Link to="/emails" className="font-mono text-[11px] text-brand hover:underline">
                {drafts.length} pending
              </Link>
            }
          />
          {emails.isLoading ? (
            <LoadingRows rows={3} />
          ) : drafts.length === 0 ? (
            <EmptyState title="No saved drafts" hint="Generated emails land here first." />
          ) : (
            <ul className="divide-y divide-border/70">
              {drafts.slice(0, 4).map((e) => (
                <li key={e.id} className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <DraftChip approved={false} />
                    <span className="ml-auto font-mono text-[11px] text-muted-foreground capitalize">
                      {e.audience}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[13px] font-medium">
                    {e.subject || "Untitled draft"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: number;
  note: string;
  tone?: "urgent";
}) {
  return (
    <div className="rounded-[14px] bg-card p-4 ring-1 ring-border">
      <Label className={tone === "urgent" ? "text-urgent/80" : undefined}>{label}</Label>
      <p
        className={cn(
          "mt-2 font-head text-[30px] leading-none font-semibold tracking-tight",
          tone === "urgent" && "text-urgent",
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[12px] text-muted-foreground">{note}</p>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", className)} />
      {label}
    </span>
  );
}
