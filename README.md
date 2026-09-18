# Smart Business Assistant

A responsive, AI-powered operations desk for busy teams — generate professional client emails, turn meeting notes into structured summaries, and plan tasks with intelligent prioritisation. Built with the Lovable AI Gateway so nothing is invented and nothing is sent until you approve it.

> **Drafts by default.** Every AI-generated email, summary, and task plan stays a draft until a user explicitly approves it. No email is ever sent automatically.

## Features

### Smart Email Generator
- Context-based professional emails for **clients**, **managers**, or **teams**
- Three tones: **formal**, **informal**, **persuasive**
- Structured output: subject line, greeting, message, call to action, closing
- Edit, copy, save, and regenerate drafts
- Approve to lock a draft — it never auto-sends

### Meeting Notes Summarizer
- Concise summaries from raw notes
- Extracts key discussion points, decisions, action items, deadlines, and responsible people
- **Never invents missing details** — gaps are marked "Not specified"
- Push action items directly into the task planner
- Generate follow-up emails from a summary

### AI Task Planner
- Structured **daily** and **weekly** plans
- Prioritises by urgency and importance (urgent / high / medium / low)
- Tracks deadlines, responsibilities, status, estimated time, and project or client
- Flags **overdue tasks** and **scheduling conflicts**
- Suggests time blocks, delegation opportunities, breaks, and productivity improvements

### Central Dashboard
- Today's tasks, upcoming deadlines, and overdue work at a glance
- Recent meetings, pending follow-ups, and saved emails
- Weekly progress overview

### Platform
- **Secure authentication** — email/password and Google sign-in via Supabase Auth
- **Roles** — admin, manager, and team-member, enforced with database-level Row-Level Security and a `has_role` security-definer function (no client-side role checks)
- **Clients & projects** management
- **Search** across everything + **filtering** by status, priority, and client
- **Notifications & reminders** — overdue tasks, draft emails, unsummarised meetings
- **Activity history** — a running log of approvals, drafts, summaries, and task changes
- **Mobile-responsive** with a drawer nav on small screens
- **Light and dark modes** with a persisted preference
- Colour-coded task priorities throughout (urgent / high / medium / low)

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | TanStack Start v1 (React 19, SSR/SSG) |
| Build tool | Vite 8 |
| Styling | Tailwind CSS v4 (oklch design tokens) |
| UI components | shadcn/ui + Radix primitives |
| Data fetching | TanStack Query + TanStack Router |
| Backend / Auth | Supabase (Postgres, RLS, Auth) |
| AI | Vercel AI SDK → Lovable AI Gateway (`openai/gpt-6-astra`) |
| Language | TypeScript |

## Project structure

```
src/
├── components/         # AppShell, EmailComposer, primitives, ui/ (shadcn)
├── hooks/              # useAuth, useTheme, use-mobile
├── integrations/
│   ├── lovable/        # Lovable platform client
│   └── supabase/       # generated Supabase client, auth attacher, types (do not edit)
├── lib/
│   ├── ai-gateway.server.ts   # Lovable AI Gateway provider
│   ├── ai.functions.ts        # generateEmailDraft, summarizeMeetingNotes, buildTaskPlan
│   ├── data.ts                # row types, queries, helpers (overdue, weekly progress)
│   └── utils.ts
├── routes/             # TanStack file-based routes
│   ├── __root.tsx     # app shell, providers, fonts, error/404 boundaries
│   ├── index.tsx      # dashboard
│   ├── auth.tsx       # sign in / sign up
│   ├── emails.tsx     # email generator + saved drafts
│   ├── meetings.tsx   # (meeting notes summarizer)
│   ├── tasks.tsx      # (task planner)
│   ├── clients.tsx    # (clients & projects)
│   └── activity.tsx   # activity history
└── styles.css         # design system: light/dark themes, oklch tokens, utilities
```

## Database

All tables live in the `public` schema with Row-Level Security enabled:

- **profiles** — full name, job title, avatar (auto-created on signup via trigger)
- **user_roles** — `admin`, `manager`, or `member` (separate table; never on profiles)
- **clients** & **projects** — manager-only writes; all authenticated users read
- **meetings** — raw notes + JSONB summary + `summary_status` (draft/approved)
- **tasks** — priority, status, due date, estimated time, assignee, client/project links, `approval_status`
- **emails** — tone, audience, context, recipient, `status`, follow-up flag
- **notifications** — per-user, with `read_at`
- **activity_log** — append-only history across the workspace

A `has_role(user_id, role)` security-definer function backs every RLS policy, so roles are verified server-side — never trusted from the client.

## Getting started

### Prerequisites
- Node.js (install with [nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- A Lovable Cloud project (Supabase) for the backend

### Install & run locally

```sh
git clone <this-repository-url>
cd <repository-name>
npm install
npm run dev
```

### Environment variables

The app reads these from the server runtime (set in Lovable project settings or `.env`):

```
VITE_SUPABASE_URL=        # Supabase project URL
VITE_SUPABASE_PUBLISHABLE_KEY=  # Supabase publishable (anon) key
LOVABLE_API_KEY=          # Lovable project token — used for AI Gateway auth
```

> Never expose `LOVABLE_API_KEY` in client code. AI calls go through server functions (`src/lib/ai.functions.ts`) which read the key inside the handler.

## Development

```sh
npm run dev      # start the dev server
npm run build    # production build
npm run lint     # eslint
npm run format   # prettier
```

## AI behaviour guarantees

1. **Drafts by default** — every generated email, summary, and plan is saved with a `draft` status. A user must explicitly approve it.
2. **No invented facts** — the summarizer marks any missing detail as the exact string `"Not specified"` rather than guessing.
3. **No auto-send** — emails are generated and saved only. Sending is never automated.
4. **Server-side auth** — all AI endpoints require an authenticated Supabase session via `requireSupabaseAuth` middleware.

## Built with Lovable

This project was built with [Lovable](https://lovable.dev). Open it in the [Lovable editor](https://lovable.dev) to keep building — every change syncs automatically to your connected GitHub repository.

## License

This project is yours to own. See the Lovable terms for details.
