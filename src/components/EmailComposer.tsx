import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, RefreshCw, Save, Sparkles } from "lucide-react";

import { generateEmailDraft } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { clientsQuery, logActivity } from "@/lib/data";
import { useAuth } from "@/hooks/useAuth";
import { DraftChip, Label, Panel, PanelHeader } from "@/components/primitives";
import { cn } from "@/lib/utils";

type Tone = "formal" | "informal" | "persuasive";
type Audience = "client" | "manager" | "team";

const TONES: Tone[] = ["formal", "informal", "persuasive"];
const AUDIENCES: Audience[] = ["client", "manager", "team"];

export type ComposerPreset = {
  context?: string;
  subject?: string;
  body?: string;
  recipientName?: string;
  recipientEmail?: string;
  clientId?: string | null;
  meetingId?: string | null;
  isFollowUp?: boolean;
  tone?: Tone;
  audience?: Audience;
};

export function EmailComposer({
  preset,
  title = "AI Email Generator",
}: {
  preset?: ComposerPreset;
  title?: string;
}) {
  const { fullName } = useAuth();
  const queryClient = useQueryClient();
  const clients = useQuery(clientsQuery());
  const generate = useServerFn(generateEmailDraft);

  const [context, setContext] = useState(preset?.context ?? "");
  const [tone, setTone] = useState<Tone>(preset?.tone ?? "formal");
  const [audience, setAudience] = useState<Audience>(preset?.audience ?? "client");
  const [recipientName, setRecipientName] = useState(preset?.recipientName ?? "");
  const [recipientEmail, setRecipientEmail] = useState(preset?.recipientEmail ?? "");
  const [clientId, setClientId] = useState(preset?.clientId ?? "");
  const [subject, setSubject] = useState(preset?.subject ?? "");
  const [body, setBody] = useState(preset?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const clientName = clients.data?.find((c) => c.id === clientId)?.name ?? null;

  const generation = useMutation({
    mutationFn: async () => {
      const result = await generate({
        data: {
          context: context.trim(),
          tone,
          audience,
          recipientName: recipientName.trim() || null,
          clientName,
          senderName: fullName || null,
        },
      });
      return result;
    },
    onSuccess: (draft) => {
      if (!draft) {
        setError("The assistant returned an empty draft. Try adding more detail and regenerate.");
        return;
      }
      setSubject(draft.subject);
      setBody(
        [draft.greeting, "", draft.message, "", draft.call_to_action, "", draft.closing]
          .join("\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim(),
      );
      setError(null);
    },
    onError: (err) => {
      setError(
        err instanceof Error
          ? err.message
          : "The assistant couldn't write this draft. Please try again.",
      );
    },
  });

  const save = useMutation({
    mutationFn: async (status: "draft" | "approved") => {
      const { data: userData } = await supabase.auth.getUser();
      const { error: insertError } = await supabase.from("emails").insert({
        subject,
        body,
        recipient_name: recipientName.trim() || null,
        recipient_email: recipientEmail.trim() || null,
        tone,
        audience,
        context: context.trim() || null,
        status,
        is_follow_up: preset?.isFollowUp ?? false,
        client_id: clientId || null,
        meeting_id: preset?.meetingId ?? null,
        created_by: userData.user?.id ?? null,
      });
      if (insertError) throw new Error(insertError.message);
      await logActivity({
        actorName: fullName,
        action: status === "approved" ? "approved_email" : "saved_email_draft",
        entityType: "email",
        detail: `${status === "approved" ? "Approved" : "Saved"} "${subject || "Untitled draft"}"`,
      });
    },
    onSuccess: (_data, status) => {
      void queryClient.invalidateQueries({ queryKey: ["emails"] });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      toast.success(status === "approved" ? "Email approved" : "Draft saved", {
        description: "Nothing is sent automatically — you stay in control.",
      });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save this draft."),
  });

  const canGenerate = context.trim().length >= 10 && !generation.isPending;
  const hasDraft = subject.length > 0 || body.length > 0;

  const copy = async () => {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    toast.success("Copied to your clipboard");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Panel>
      <PanelHeader
        title={title}
        meta={<DraftChip approved={false} />}
        action={
          <span className="font-mono text-[11px] text-muted-foreground">
            Drafts only — never sent automatically
          </span>
        }
      />
      <div className="grid md:grid-cols-[280px_1fr]">
        <div className="space-y-4 border-b border-border p-5 md:border-b-0 md:border-r">
          <div>
            <Label className="mb-1.5">What is this email about?</Label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={4}
              placeholder="Chase the overdue invoice with Halcyon, keep it friendly but firm."
              className="w-full resize-y rounded-lg bg-background px-3 py-2 text-[13px] ring-1 ring-border outline-none focus:ring-2 focus:ring-ring"
            />
            {context.length > 0 && context.trim().length < 10 ? (
              <p className="mt-1 text-[12px] text-destructive">
                Add a little more detail (at least 10 characters).
              </p>
            ) : null}
          </div>

          <div>
            <Label className="mb-2">Tone</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {TONES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-[12px] capitalize",
                    tone === t
                      ? "bg-brand font-medium text-brand-foreground"
                      : "bg-background text-muted-foreground ring-1 ring-border hover:bg-accent",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2">Audience</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {AUDIENCES.map((a) => (
                <button
                  key={a}
                  onClick={() => setAudience(a)}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-[12px] capitalize",
                    audience === a
                      ? "bg-brand font-medium text-brand-foreground"
                      : "bg-background text-muted-foreground ring-1 ring-border hover:bg-accent",
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
            <div>
              <Label className="mb-1.5">Recipient name</Label>
              <input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Dana Whitmore"
                className="w-full rounded-lg bg-background px-2.5 py-1.5 text-[12.5px] ring-1 ring-border outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <Label className="mb-1.5">Recipient email</Label>
              <input
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="dana@larkfield.co"
                className="w-full rounded-lg bg-background px-2.5 py-1.5 text-[12.5px] ring-1 ring-border outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <Label className="mb-1.5">Client</Label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full rounded-lg bg-background px-2.5 py-1.5 text-[12.5px] ring-1 ring-border outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">No client</option>
                {(clients.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={() => generation.mutate()}
            disabled={!canGenerate}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-3 py-2 text-[13px] font-medium text-background disabled:opacity-50"
          >
            {generation.isPending ? (
              <RefreshCw className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {generation.isPending ? "Writing…" : hasDraft ? "Regenerate" : "Generate draft"}
          </button>
        </div>

        <div className="p-5">
          {error ? (
            <p className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
              {error}
            </p>
          ) : null}

          {generation.isPending && !hasDraft ? (
            <div className="space-y-3">
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
            </div>
          ) : !hasDraft ? (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center">
              <p className="text-[13.5px] font-medium">No draft yet</p>
              <p className="mt-1 max-w-[280px] text-[12.5px] text-muted-foreground">
                Describe the situation on the left, pick a tone and audience, then generate a draft
                you can edit before saving.
              </p>
            </div>
          ) : (
            <>
              <Label className="mb-1.5">Subject</Label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg bg-background px-3 py-2 text-[13.5px] font-medium ring-1 ring-border outline-none focus:ring-2 focus:ring-ring"
              />
              <Label className="mt-3 mb-1.5">Message</Label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="w-full resize-y rounded-lg bg-background px-3 py-3 text-[13px] leading-relaxed ring-1 ring-border outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => save.mutate("draft")}
                  disabled={save.isPending || !subject.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[13px] font-medium text-brand-foreground ring-1 ring-brand/30 disabled:opacity-50"
                >
                  <Save className="size-3.5" /> Save draft
                </button>
                <button
                  onClick={() => save.mutate("approved")}
                  disabled={save.isPending || !subject.trim()}
                  className="rounded-lg px-3 py-1.5 text-[13px] ring-1 ring-border hover:bg-accent disabled:opacity-50"
                >
                  Save as approved
                </button>
                <button
                  onClick={() => void copy()}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] ring-1 ring-border hover:bg-accent"
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} Copy
                </button>
                <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                  {body.trim() ? body.trim().split(/\s+/).length : 0} words
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}
