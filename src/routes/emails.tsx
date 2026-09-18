import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Trash2 } from "lucide-react";

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
} from "@/components/primitives";
import { emailsQuery, formatDateTime, logActivity, type EmailRow } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/emails")({
  head: () => ({
    meta: [
      { title: "Email drafts · Smart Business Assistant" },
      {
        name: "description",
        content:
          "Generate, edit and approve professional client, manager and team emails. Nothing is sent automatically.",
      },
      { property: "og:title", content: "Email drafts · Smart Business Assistant" },
      {
        property: "og:description",
        content:
          "Generate, edit and approve professional client, manager and team emails. Nothing is sent automatically.",
      },
    ],
  }),
  component: EmailsPage,
});

const STATUS_FILTERS = ["all", "draft", "approved"] as const;
const AUDIENCE_FILTERS = ["all", "client", "manager", "team"] as const;

function EmailsPage() {
  const emails = useQuery(emailsQuery());
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [audience, setAudience] = useState<(typeof AUDIENCE_FILTERS)[number]>("all");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = (emails.data ?? []).filter((e) => {
    if (status !== "all" && e.status !== status) return false;
    if (audience !== "all" && e.audience !== audience) return false;
    if (q.trim()) {
      const needle = q.toLowerCase();
      return (
        e.subject.toLowerCase().includes(needle) ||
        (e.body ?? "").toLowerCase().includes(needle) ||
        (e.recipient_name ?? "").toLowerCase().includes(needle)
      );
    }
    return true;
  });

  const selected = list.find((e) => e.id === selectedId) ?? null;
  const draftCount = (emails.data ?? []).filter((e) => e.status === "draft").length;

  return (
    <AppShell
      title="Email drafts"
      subtitle={`${draftCount} awaiting your approval · nothing is ever sent automatically`}
    >
      <EmailComposer />

      <div className="mt-5 grid gap-4 lg:grid-cols-[380px_1fr]">
        <Panel>
          <PanelHeader title="Saved emails" meta={<span className="font-mono text-[11px] text-muted-foreground">{list.length}</span>} />
          <div className="space-y-2.5 border-b border-border px-5 py-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search subject, body or recipient"
              className="w-full rounded-lg bg-background px-3 py-1.5 text-[12.5px] ring-1 ring-border outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((s) => (
                <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
                  {s}
                </Chip>
              ))}
              <span className="mx-1 h-5 w-px bg-border" />
              {AUDIENCE_FILTERS.map((a) => (
                <Chip key={a} active={audience === a} onClick={() => setAudience(a)}>
                  {a}
                </Chip>
              ))}
            </div>
          </div>

          {emails.isLoading ? (
            <LoadingRows rows={5} />
          ) : emails.isError ? (
            <ErrorState
              message={(emails.error as Error).message}
              onRetry={() => emails.refetch()}
            />
          ) : list.length === 0 ? (
            <EmptyState
              title="No emails match"
              hint="Clear the filters or generate a new draft above."
            />
          ) : (
            <ul className="max-h-[560px] divide-y divide-border/70 overflow-y-auto">
              {list.map((e) => (
                <li key={e.id}>
                  <button
                    onClick={() => setSelectedId(e.id)}
                    className={cn(
                      "w-full px-5 py-3 text-left hover:bg-accent/60",
                      selectedId === e.id && "bg-accent/70",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <DraftChip approved={e.status === "approved"} />
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {e.tone} · {e.audience}
                      </span>
                    </div>
                    <p className="mt-1.5 truncate text-[13.5px] font-medium">
                      {e.subject || "Untitled draft"}
                    </p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {e.recipient_name ?? "No recipient"} · {formatDateTime(e.created_at)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {selected ? (
          <EmailDetail key={selected.id} email={selected} onDeleted={() => setSelectedId(null)} />
        ) : (
          <Panel>
            <PanelHeader title="Nothing selected" />
            <EmptyState
              title="Pick an email from the list"
              hint="You can edit the wording, copy it, approve it or delete it."
            />
          </Panel>
        )}
      </div>
    </AppShell>
  );
}

function EmailDetail({ email, onDeleted }: { email: EmailRow; onDeleted: () => void }) {
  const { fullName } = useAuth();
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState(email.subject);
  const [body, setBody] = useState(email.body ?? "");
  const [recipientName, setRecipientName] = useState(email.recipient_name ?? "");
  const [recipientEmail, setRecipientEmail] = useState(email.recipient_email ?? "");
  const [copied, setCopied] = useState(false);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["emails"] });
    void queryClient.invalidateQueries({ queryKey: ["activity"] });
  };

  const save = useMutation({
    mutationFn: async (nextStatus?: "draft" | "approved") => {
      if (!subject.trim()) throw new Error("Give the email a subject line before saving.");
      const { error } = await supabase
        .from("emails")
        .update({
          subject,
          body,
          recipient_name: recipientName.trim() || null,
          recipient_email: recipientEmail.trim() || null,
          ...(nextStatus ? { status: nextStatus } : {}),
        })
        .eq("id", email.id);
      if (error) throw new Error(error.message);
      await logActivity({
        actorName: fullName,
        action: nextStatus === "approved" ? "approved_email" : "updated_email",
        entityType: "email",
        entityId: email.id,
        detail: `${nextStatus === "approved" ? "Approved" : "Updated"} "${subject}"`,
      });
    },
    onSuccess: (_d, nextStatus) => {
      invalidate();
      toast.success(nextStatus === "approved" ? "Email approved" : "Changes saved");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save."),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("emails").delete().eq("id", email.id);
      if (error) throw new Error(error.message);
      await logActivity({
        actorName: fullName,
        action: "deleted_email",
        entityType: "email",
        detail: `Deleted "${email.subject}"`,
      });
    },
    onSuccess: () => {
      invalidate();
      onDeleted();
      toast.success("Email deleted");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't delete."),
  });

  const copy = async () => {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    toast.success("Copied to your clipboard");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Panel>
      <PanelHeader
        title="Edit email"
        meta={<DraftChip approved={email.status === "approved"} />}
        action={
          <span className="font-mono text-[11px] text-muted-foreground capitalize">
            {email.tone} · {email.audience}
          </span>
        }
      />
      <div className="space-y-3 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5">Recipient name</Label>
            <input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="w-full rounded-lg bg-background px-3 py-1.5 text-[12.5px] ring-1 ring-border outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <Label className="mb-1.5">Recipient email</Label>
            <input
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="w-full rounded-lg bg-background px-3 py-1.5 text-[12.5px] ring-1 ring-border outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <div>
          <Label className="mb-1.5">Subject</Label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-lg bg-background px-3 py-2 text-[13.5px] font-medium ring-1 ring-border outline-none focus:ring-2 focus:ring-ring"
          />
          {!subject.trim() ? (
            <p className="mt-1 text-[12px] text-destructive">A subject line is required.</p>
          ) : null}
        </div>
        <div>
          <Label className="mb-1.5">Message</Label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={16}
            className="w-full resize-y rounded-lg bg-background px-3 py-3 text-[13px] leading-relaxed ring-1 ring-border outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => save.mutate(undefined)}
            disabled={save.isPending}
            className="rounded-lg bg-brand px-3 py-1.5 text-[13px] font-medium text-brand-foreground ring-1 ring-brand/30 disabled:opacity-50"
          >
            Save changes
          </button>
          {email.status === "draft" ? (
            <button
              onClick={() => save.mutate("approved")}
              disabled={save.isPending}
              className="rounded-lg px-3 py-1.5 text-[13px] ring-1 ring-border hover:bg-accent disabled:opacity-50"
            >
              Approve
            </button>
          ) : (
            <button
              onClick={() => save.mutate("draft")}
              disabled={save.isPending}
              className="rounded-lg px-3 py-1.5 text-[13px] ring-1 ring-border hover:bg-accent disabled:opacity-50"
            >
              Move back to draft
            </button>
          )}
          <button
            onClick={() => void copy()}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] ring-1 ring-border hover:bg-accent"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} Copy
          </button>
          <button
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
            className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] text-destructive ring-1 ring-destructive/25 hover:bg-destructive/10 disabled:opacity-50"
          >
            <Trash2 className="size-3.5" /> Delete
          </button>
        </div>
      </div>
    </Panel>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground ring-1 ring-border hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}
