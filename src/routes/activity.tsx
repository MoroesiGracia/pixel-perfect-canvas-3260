import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  Panel,
  PanelHeader,
  StatusChip,
} from "@/components/primitives";
import { activityQuery, formatDateTime } from "@/lib/data";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity history · Smart Business Assistant" },
      {
        name: "description",
        content:
          "A running history of approvals, drafts, summaries and task changes across your workspace.",
      },
      { property: "og:title", content: "Activity history · Smart Business Assistant" },
      {
        property: "og:description",
        content:
          "A running history of approvals, drafts, summaries and task changes across your workspace.",
      },
    ],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const activity = useQuery(activityQuery());
  const [q, setQ] = useState("");

  const list = (activity.data ?? []).filter((a) => {
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return (
      a.action.toLowerCase().includes(needle) ||
      (a.detail ?? "").toLowerCase().includes(needle) ||
      (a.actor_name ?? "").toLowerCase().includes(needle) ||
      a.entity_type.toLowerCase().includes(needle)
    );
  });

  return (
    <AppShell title="Activity history" subtitle="Every approval, edit and summary, newest first">
      <Panel>
        <PanelHeader
          title="Workspace activity"
          action={
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search activity"
              className="w-[220px] rounded-lg bg-background px-3 py-1.5 text-[12.5px] ring-1 ring-border outline-none focus:ring-2 focus:ring-ring"
            />
          }
        />
        {activity.isLoading ? (
          <LoadingRows rows={6} />
        ) : activity.isError ? (
          <ErrorState
            message={(activity.error as Error).message}
            onRetry={() => activity.refetch()}
          />
        ) : list.length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            hint="Saving a draft, approving a summary or updating a task will show up here."
          />
        ) : (
          <ul className="divide-y divide-border/70">
            {list.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-5 py-3.5">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-brand/12 font-head text-[11px] font-semibold text-brand">
                  {(a.actor_name ?? "?")[0]?.toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px]">
                    <span className="font-medium">{a.actor_name ?? "Someone"}</span>{" "}
                    <span className="text-muted-foreground">
                      {a.action.replace(/_/g, " ")}
                    </span>
                  </p>
                  {a.detail ? (
                    <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
                      {a.detail}
                    </p>
                  ) : null}
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {formatDateTime(a.created_at)}
                  </p>
                </div>
                <StatusChip>{a.entity_type}</StatusChip>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AppShell>
  );
}
