import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bell,
  Building2,
  CalendarClock,
  History,
  LayoutGrid,
  ListChecks,
  Mail,
  Menu,
  Moon,
  Search,
  Sun,
  X,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { Label } from "@/components/primitives";
import {
  emailsQuery,
  formatDay,
  isOverdue,
  meetingsQuery,
  clientsQuery,
  tasksQuery,
} from "@/lib/data";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutGrid },
  { to: "/emails", label: "Emails", icon: Mail },
  { to: "/meetings", label: "Meetings", icon: CalendarClock },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/clients", label: "Clients / Projects", icon: Building2 },
  { to: "/activity", label: "Activity", icon: History },
] as const;

export function AppShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const { user, loading, fullName, role, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { theme, toggle } = useTheme();
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  const tasks = useQuery({ ...tasksQuery(), enabled: Boolean(user) });
  const emails = useQuery({ ...emailsQuery(), enabled: Boolean(user) });
  const meetings = useQuery({ ...meetingsQuery(), enabled: Boolean(user) });
  const clients = useQuery({ ...clientsQuery(), enabled: Boolean(user) });

  const overdue = (tasks.data ?? []).filter(isOverdue);
  const draftEmails = (emails.data ?? []).filter((e) => e.status === "draft");
  const reminders = useMemo(
    () => [
      ...overdue.slice(0, 5).map((t) => ({
        id: t.id,
        title: t.title,
        detail: `Overdue · was due ${formatDay(t.due_date)}`,
        to: "/tasks" as const,
      })),
      ...draftEmails.slice(0, 4).map((e) => ({
        id: e.id,
        title: e.subject || "Untitled draft",
        detail: "Email draft awaiting your approval",
        to: "/emails" as const,
      })),
      ...(meetings.data ?? [])
        .filter((m) => m.summary_status === "draft")
        .slice(0, 3)
        .map((m) => ({
          id: m.id,
          title: m.title,
          detail: "Meeting notes not summarised yet",
          to: "/meetings" as const,
        })),
    ],
    [overdue, draftEmails, meetings.data],
  );

  const initials = (fullName || user?.email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Loading your desk…
        </p>
      </div>
    );
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-card">
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <div className="grid size-8 place-items-center bg-brand text-brand-foreground">
          <span className="font-head text-[15px] font-bold">S</span>
        </div>
        <div>
          <p className="font-head text-[15px] leading-none font-semibold tracking-tight">
            Smart Assistant
          </p>
          <Label className="mt-1">Ops desk</Label>
        </div>
        <button
          onClick={() => setNavOpen(false)}
          className="ml-auto md:hidden"
          aria-label="Close menu"
        >
          <X className="size-4 text-muted-foreground" />
        </button>
      </div>

      <div className="px-4 pb-2">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex w-full items-center gap-2 rounded-lg bg-background px-2.5 py-2 ring-1 ring-border hover:bg-accent"
        >
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-[13px] text-muted-foreground">Search…</span>
        </button>
      </div>

      <nav className="mt-2 flex-1 px-3">
        <Label className="px-2 pb-1.5">Workspace</Label>
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          const count =
            to === "/emails" ? draftEmails.length : to === "/tasks" ? overdue.length : 0;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "mt-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px]",
                active
                  ? "bg-brand/10 font-medium text-brand ring-1 ring-brand/15"
                  : "text-foreground/70 hover:bg-accent",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
              {count > 0 ? (
                <span
                  className={cn(
                    "ml-auto font-mono text-[11px]",
                    to === "/tasks" ? "text-urgent" : "text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-brand/15 font-head text-[12px] font-semibold text-brand">
            {initials || "?"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-medium">{fullName || user.email}</p>
            <Label className="truncate">{role === "member" ? "Team member" : role}</Label>
          </div>
        </div>
        <button
          onClick={() => void signOut()}
          className="mt-1 w-full rounded-lg px-2.5 py-1.5 text-left text-[12.5px] text-muted-foreground hover:bg-accent"
        >
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 border-r border-border md:block">
          {sidebar}
        </aside>

        {navOpen ? (
          <div className="fixed inset-0 z-40 md:hidden">
            <button
              className="absolute inset-0 bg-ink/40"
              onClick={() => setNavOpen(false)}
              aria-label="Close menu"
            />
            <div className="absolute top-0 left-0 h-full w-64 border-r border-border">{sidebar}</div>
          </div>
        ) : null}

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:px-7">
            <button
              className="md:hidden"
              onClick={() => setNavOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-head text-[19px] leading-tight font-semibold tracking-tight text-balance md:text-[22px]">
                {title}
              </h1>
              {subtitle ? <Label className="mt-1.5">{subtitle}</Label> : null}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setSearchOpen(true)}
                className="rounded-lg p-2 text-muted-foreground ring-1 ring-border hover:bg-accent md:hidden"
                aria-label="Search"
              >
                <Search className="size-4" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="relative rounded-lg p-2 text-muted-foreground ring-1 ring-border hover:bg-accent"
                    aria-label="Reminders"
                  >
                    <Bell className="size-4" />
                    {reminders.length > 0 ? (
                      <span className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-urgent font-mono text-[9px] text-primary-foreground">
                        {reminders.length}
                      </span>
                    ) : null}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 p-0">
                  <div className="border-b border-border px-3 py-2">
                    <Label>Reminders</Label>
                  </div>
                  {reminders.length === 0 ? (
                    <p className="px-3 py-4 text-[12.5px] text-muted-foreground">
                      Nothing needs chasing right now.
                    </p>
                  ) : (
                    <ul className="max-h-80 divide-y divide-border/70 overflow-y-auto">
                      {reminders.map((r) => (
                        <li key={`${r.to}-${r.id}`}>
                          <Link to={r.to} className="block px-3 py-2.5 hover:bg-accent">
                            <p className="truncate text-[13px] font-medium">{r.title}</p>
                            <p className="font-mono text-[11px] text-muted-foreground">
                              {r.detail}
                            </p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                onClick={toggle}
                className="rounded-lg p-2 text-muted-foreground ring-1 ring-border hover:bg-accent"
                aria-label="Switch light or dark mode"
              >
                {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
              {action}
            </div>
          </header>

          <div className="px-4 py-5 md:px-7 md:py-6">{children}</div>
        </main>
      </div>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="overflow-hidden p-0">
          <DialogTitle className="sr-only">Search the workspace</DialogTitle>
          <Command>
            <CommandInput placeholder="Search tasks, emails, meetings, clients…" />
            <CommandList>
              <CommandEmpty>No matches found.</CommandEmpty>
              <CommandGroup heading="Tasks">
                {(tasks.data ?? []).slice(0, 30).map((t) => (
                  <CommandItem
                    key={t.id}
                    value={`task ${t.title}`}
                    onSelect={() => {
                      setSearchOpen(false);
                      void navigate({ to: "/tasks", search: { q: t.title } });
                    }}
                  >
                    {t.title}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="Emails">
                {(emails.data ?? []).slice(0, 20).map((e) => (
                  <CommandItem
                    key={e.id}
                    value={`email ${e.subject}`}
                    onSelect={() => {
                      setSearchOpen(false);
                      void navigate({ to: "/emails" });
                    }}
                  >
                    {e.subject || "Untitled draft"}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="Meetings">
                {(meetings.data ?? []).slice(0, 20).map((m) => (
                  <CommandItem
                    key={m.id}
                    value={`meeting ${m.title}`}
                    onSelect={() => {
                      setSearchOpen(false);
                      void navigate({ to: "/meetings" });
                    }}
                  >
                    {m.title}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="Clients">
                {(clients.data ?? []).map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`client ${c.name}`}
                    onSelect={() => {
                      setSearchOpen(false);
                      void navigate({ to: "/clients" });
                    }}
                  >
                    {c.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  );
}
