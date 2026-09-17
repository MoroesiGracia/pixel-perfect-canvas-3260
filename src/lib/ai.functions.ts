import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { Output, streamText } from "ai";
import { z } from "zod";

import {
  AI_MODEL,
  RESPONSES_PROVIDER_OPTIONS,
  createLovableResponsesProvider,
} from "./ai-gateway.server";

/* ---------------------------------- email --------------------------------- */

const EmailInput = z.object({
  context: z.string().min(3).max(4000),
  tone: z.enum(["formal", "informal", "persuasive"]),
  audience: z.enum(["client", "manager", "team"]),
  recipientName: z.string().max(120).nullable(),
  clientName: z.string().max(160).nullable(),
  senderName: z.string().max(120).nullable(),
});

const EmailSchema = z.object({
  subject: z.string(),
  greeting: z.string(),
  message: z.string(),
  call_to_action: z.string(),
  closing: z.string(),
});

export const generateEmailDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => EmailInput.parse(input))
  .handler(async ({ data }) => {
    const { provider } = createLovableResponsesProvider();

    const result = streamText({
      model: provider.responses(AI_MODEL),
      system: [
        "You write professional business emails for a busy operations team.",
        "Return five parts: subject line, greeting, the message body, a clear call to action, and a closing.",
        "The message body must be 2-3 short paragraphs, concrete and free of filler.",
        "Never invent facts, figures, dates or names that are not given. If a detail is missing, write it as 'Not specified'.",
        "Do not include placeholders like [Name] unless no name was provided.",
      ].join(" "),
      prompt: [
        `Tone: ${data.tone}.`,
        `Audience: ${data.audience}.`,
        data.recipientName ? `Recipient: ${data.recipientName}.` : "",
        data.clientName ? `Client/company: ${data.clientName}.` : "",
        data.senderName ? `Sign off as: ${data.senderName}.` : "",
        `Situation and purpose: ${data.context}`,
      ]
        .filter(Boolean)
        .join("\n"),
      output: Output.object({ schema: EmailSchema }),
      providerOptions: RESPONSES_PROVIDER_OPTIONS,
    });

    return await result.output;
  });

/* --------------------------------- summary -------------------------------- */

const SummaryInput = z.object({
  notes: z.string().min(20).max(20000),
  title: z.string().max(200).nullable(),
});

const SummarySchema = z.object({
  overview: z.string(),
  key_points: z.array(z.string()),
  decisions: z.array(z.string()),
  action_items: z.array(
    z.object({
      task: z.string(),
      owner: z.string(),
      deadline: z.string(),
      priority: z.enum(["urgent", "high", "medium", "low"]),
    }),
  ),
  deadlines: z.array(z.string()),
  risks: z.array(z.string()),
  not_specified: z.array(z.string()),
});

export const summarizeMeetingNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SummaryInput.parse(input))
  .handler(async ({ data }) => {
    const { provider } = createLovableResponsesProvider();

    const result = streamText({
      model: provider.responses(AI_MODEL),
      system: [
        "You summarise meeting notes with strict fidelity.",
        "Never invent details. Any missing owner, deadline or decision must be the exact string 'Not specified'.",
        "List anything important that the notes leave unresolved in not_specified.",
        "Keep the overview to two sentences at most; keep every list item to one short line.",
      ].join(" "),
      prompt: [data.title ? `Meeting: ${data.title}` : "", "Notes:", data.notes]
        .filter(Boolean)
        .join("\n"),
      output: Output.object({ schema: SummarySchema }),
      providerOptions: RESPONSES_PROVIDER_OPTIONS,
    });

    return await result.output;
  });

/* ----------------------------------- plan --------------------------------- */

const PlanInput = z.object({
  horizon: z.enum(["day", "week"]),
  workingHours: z.string().max(120),
  tasks: z
    .array(
      z.object({
        title: z.string(),
        priority: z.string(),
        status: z.string(),
        dueDate: z.string().nullable(),
        estimatedMinutes: z.number().nullable(),
        assignee: z.string().nullable(),
        project: z.string().nullable(),
      }),
    )
    .max(80),
});

const PlanSchema = z.object({
  headline: z.string(),
  time_blocks: z.array(
    z.object({
      slot: z.string(),
      focus: z.string(),
      why: z.string(),
    }),
  ),
  priority_order: z.array(z.string()),
  overdue: z.array(z.string()),
  conflicts: z.array(z.string()),
  delegation: z.array(z.string()),
  breaks: z.array(z.string()),
  improvements: z.array(z.string()),
});

export const buildTaskPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PlanInput.parse(input))
  .handler(async ({ data }) => {
    const { provider } = createLovableResponsesProvider();

    const result = streamText({
      model: provider.responses(AI_MODEL),
      system: [
        "You are a pragmatic planning assistant for a busy operations team.",
        `Build a ${data.horizon === "day" ? "daily" : "weekly"} plan from the task list provided.`,
        "Order work by urgency and importance, respect deadlines and estimated durations, and flag overdue work and scheduling conflicts explicitly.",
        "Suggest realistic time blocks, delegation opportunities, breaks, and short productivity improvements.",
        "Only reference tasks that appear in the list. Never invent tasks, people or dates.",
      ].join(" "),
      prompt: [
        `Today is ${new Date().toISOString()}.`,
        `Working hours: ${data.workingHours}.`,
        `Tasks (JSON): ${JSON.stringify(data.tasks)}`,
      ].join("\n"),
      output: Output.object({ schema: PlanSchema }),
      providerOptions: RESPONSES_PROVIDER_OPTIONS,
    });

    return await result.output;
  });

export type GeneratedEmail = z.infer<typeof EmailSchema>;
export type MeetingSummary = z.infer<typeof SummarySchema>;
export type TaskPlan = z.infer<typeof PlanSchema>;
