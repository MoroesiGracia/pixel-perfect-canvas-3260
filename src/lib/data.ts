import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type Meeting = Database["public"]["Tables"]["meetings"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type EmailRow = Database["public"]["Tables"]["emails"]["Row"];
export type Activity = Database["public"]["Tables"]["activity_log"]["Row"];

export type Priority = "urgent" | "high" | "medium" | "low";
export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

export const PRIORITY_ORDER: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as T;
}

export const clientsQuery = () => ({
  queryKey: ["clients"],
  queryFn: async () => unwrap<Client[]>(await supabase.from("clients").select("*").order("name")),
});

export const projectsQuery = () => ({
  queryKey: ["projects"],
  queryFn: async () => unwrap<Project[]>(await supabase.from("projects").select("*").order("name")),
});

export const tasksQuery = () => ({
  queryKey: ["tasks"],
  queryFn: async () =>
    unwrap<Task[]>(
      await supabase
        .from("tasks")
        .select("*")
        .order("due_date", { ascending: true, nullsFirst: false }),
    ),
});

export const meetingsQuery = () => ({
  queryKey: ["meetings"],
  queryFn: async () =>
    unwrap<Meeting[]>(
      await supabase.from("meetings").select("*").order("meeting_date", { ascending: false }),
    ),
});

export const emailsQuery = () => ({
  queryKey: ["emails"],
  queryFn: async () =>
    unwrap<EmailRow[]>(
      await supabase.from("emails").select("*").order("created_at", { ascending: false }),
    ),
});

export const activityQuery = () => ({
  queryKey: ["activity"],
  queryFn: async () =>
    unwrap<Activity[]>(
      await supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(80),
    ),
});

export async function logActivity(entry: {
  actorName: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  detail?: string;
}) {
  const { data } = await supabase.auth.getUser();
  await supabase.from("activity_log").insert({
    actor_id: data.user?.id ?? null,
    actor_name: entry.actorName || data.user?.email || "Someone",
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    detail: entry.detail ?? null,
  });
}

/* ------------------------------- derivations ------------------------------ */

export function isOverdue(task: Task) {
  return Boolean(task.due_date) && task.status !== "done" && new Date(task.due_date!) < new Date();
}

export function isToday(date: string | null) {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

export function isWithinDays(date: string | null, days: number) {
  if (!date) return false;
  const d = new Date(date).getTime();
  const now = Date.now();
  return d >= now && d <= now + days * 86400000;
}

export function sortByPriority(tasks: Task[]) {
  return [...tasks].sort(
    (a, b) =>
      PRIORITY_ORDER[a.priority as Priority] - PRIORITY_ORDER[b.priority as Priority] ||
      new Date(a.due_date ?? "2999-01-01").getTime() -
        new Date(b.due_date ?? "2999-01-01").getTime(),
  );
}

export function weeklyProgress(tasks: Task[]) {
  const since = Date.now() - 7 * 86400000;
  const recent = tasks.filter((t) => new Date(t.created_at).getTime() >= since || t.due_date);
  if (recent.length === 0) return 0;
  const done = recent.filter((t) => t.status === "done").length;
  return Math.round((done / recent.length) * 100);
}

export function formatDateTime(value: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function formatDay(value: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export function relativeLate(value: string | null) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const days = Math.floor(diff / 86400000);
  if (days >= 1) return `${days} day${days > 1 ? "s" : ""} late`;
  const hours = Math.max(1, Math.floor(diff / 3600000));
  return `${hours} hour${hours > 1 ? "s" : ""} late`;
}
