import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { Label } from "@/components/primitives";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · Smart Business Assistant" },
      {
        name: "description",
        content:
          "Sign in to your team's operations desk for client emails, meeting summaries and task planning.",
      },
      { property: "og:title", content: "Sign in · Smart Business Assistant" },
      {
        property: "og:description",
        content:
          "Sign in to your team's operations desk for client emails, meeting summaries and task planning.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/" });
  }, [loading, user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.includes("@")) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (mode === "signup" && fullName.trim().length < 2)
      return setError("Enter your full name so your team can recognise you.");

    setBusy(true);
    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim() },
          },
        });
        if (signUpError) throw signUpError;
        toast.success("Account created", {
          description: "Check your inbox to confirm your email, then sign in.",
        });
        setMode("signin");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError("Google sign-in didn't complete. Try again or use your email and password.");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center bg-brand text-brand-foreground">
            <span className="font-head text-[15px] font-bold">S</span>
          </div>
          <div>
            <p className="font-head text-[15px] leading-none font-semibold tracking-tight">
              Smart Business Assistant
            </p>
            <Label className="mt-1">Ops desk</Label>
          </div>
        </div>

        <div className="mt-5 rounded-[14px] bg-card p-6 ring-1 ring-border">
          <h1 className="font-head text-[20px] font-semibold tracking-tight">
            {mode === "signin" ? "Sign in to your desk" : "Create your account"}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {mode === "signin"
              ? "Your tasks, meeting summaries and client email drafts, in one place."
              : "The first account created becomes the workspace admin."}
          </p>

          <form onSubmit={submit} className="mt-5 space-y-3">
            {mode === "signup" ? (
              <div>
                <Label className="mb-1.5">Full name</Label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  className="w-full rounded-lg bg-background px-3 py-2 text-[13.5px] ring-1 ring-border outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Kara Osei"
                />
              </div>
            ) : null}
            <div>
              <Label className="mb-1.5">Work email</Label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                className="w-full rounded-lg bg-background px-3 py-2 text-[13.5px] ring-1 ring-border outline-none focus:ring-2 focus:ring-ring"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <Label className="mb-1.5">Password</Label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                className="w-full rounded-lg bg-background px-3 py-2 text-[13.5px] ring-1 ring-border outline-none focus:ring-2 focus:ring-ring"
                placeholder="At least 8 characters"
              />
            </div>

            {error ? (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-brand px-3 py-2.5 text-[13.5px] font-medium text-brand-foreground ring-1 ring-brand/30 hover:bg-brand/90 disabled:opacity-60"
            >
              {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <Label>or</Label>
            <span className="h-px flex-1 bg-border" />
          </div>

          <button
            onClick={() => void google()}
            className="w-full rounded-lg px-3 py-2.5 text-[13.5px] font-medium ring-1 ring-border hover:bg-accent"
          >
            Continue with Google
          </button>

          <p className="mt-5 text-[12.5px] text-muted-foreground">
            {mode === "signin" ? "New here? " : "Already have an account? "}
            <button
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
              }}
              className="font-medium text-brand hover:underline"
            >
              {mode === "signin" ? "Create an account" : "Sign in instead"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
