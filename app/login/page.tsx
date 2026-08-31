"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CircleAlert,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { APP_NAME } from "@/app/constant";
import { useSessionUser } from "@/app/hooks/use-session-user";
import {
  DEFAULT_USER_ROLE,
  isUserRole,
  saveSessionUser,
  type UserRole,
} from "@/lib/session-user";

type DirectoryUser = {
  email: string;
  fullName: string;
  role: UserRole;
  active: boolean;
};

const resolveRole = async (email: string) => {
  const response = await fetch("/api/admin/users?page=0&size=100");

  if (!response.ok) {
    throw new Error("Unable to verify your access. Try again.");
  }

  const payload = (await response.json().catch(() => null)) as {
    content?: DirectoryUser[];
  } | null;

  const match = (payload?.content ?? []).find(
    (entry) => entry.email?.trim().toLowerCase() === email
  );

  if (match && match.active === false) {
    throw new Error("This account is deactivated. Contact an administrator.");
  }

  return match && isUserRole(match.role) ? match.role : DEFAULT_USER_ROLE;
};

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading } = useSessionUser();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/");
    }
  }, [isLoading, user, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setError("Enter the customer name.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setIsSubmitting(true);

    try {
      const role = await resolveRole(trimmedEmail);

      saveSessionUser({
        fullName: trimmedName,
        email: trimmedEmail,
        role,
        loggedInAt: new Date().toISOString(),
      });

      router.replace("/");
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Unable to sign in. Try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative h-screen overflow-hidden bg-[#f3f6fc]">
      {/* Background decoration */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-blue-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 h-[500px] w-[500px] rounded-full bg-indigo-200/40 blur-3xl" />

      <div className="relative flex h-full items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid max-h-full w-full max-w-6xl overflow-hidden rounded-[32px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.14)] lg:grid-cols-[0.95fr_1.05fr]">

          {/* ================= LEFT PANEL ================= */}
          <section className="relative hidden h-full overflow-hidden bg-gradient-to-br from-[#101f46] via-[#173a75] to-[#2457b8] p-10 text-white lg:flex lg:flex-col">
            
            {/* Decorative glows */}
            <div className="absolute -right-24 top-24 h-80 w-80 rounded-full bg-blue-400/20 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl" />

            {/* Decorative grid */}
            <div
              className="absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />

            {/* Brand */}
            <div className="relative z-10 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 shadow-lg backdrop-blur">
                <BadgeCheck className="h-6 w-6 text-blue-200" />
              </div>

              <div>
                <h2 className="text-xl font-bold tracking-tight">
                  {APP_NAME}
                </h2>
                <p className="text-xs text-blue-100/70">
                  Build. Configure. Perfect.
                </p>
              </div>
            </div>

            {/* Main content */}
            <div className="relative z-10 my-auto max-w-md">
              <span className="mb-5 mt-4 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-medium text-blue-100 backdrop-blur">
                CONFIGURATION PLATFORM
              </span>

              <h1 className="text-4xl font-bold leading-[1.08] tracking-tight xl:text-5xl">
                Welcome
                <br />
                back.
              </h1>

              <p className="mt-5 max-w-sm text-base leading-7 text-blue-100/75">
                Sign in to continue and bring your configurations to life.
              </p>

              {/* Visual card */}
              <div className="mt-8 max-w-sm rounded-3xl border border-white/15 bg-white/[0.08] p-5 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-400/20">
                    <BarChart3 className="h-6 w-6 text-blue-200" />
                  </div>

                  <div>
                    <p className="font-semibold">Configure with confidence</p>
                    <p className="mt-1 text-sm leading-5 text-blue-100/65">
                      Create and manage configurations from one workspace.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Security */}
            <div className="relative z-10 flex items-center gap-3 text-sm text-blue-100/70 mt-6">
              <ShieldCheck className="h-5 w-5" />

              <span>Your data is secure with us</span>
            </div>
          </section>

          {/* ================= RIGHT PANEL ================= */}
          <section className="flex max-h-full items-center justify-center overflow-y-auto px-6 py-10 sm:px-12 lg:px-16">
            <div className="w-full max-w-md">

              {/* Mobile logo */}
              <div className="mb-8 flex items-center gap-3 lg:hidden">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <BadgeCheck className="h-5 w-5" />
                </div>

                <span className="font-bold text-slate-900">{APP_NAME}</span>
              </div>

              {/* Heading */}
              <div className="mb-7">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <UserRound className="h-6 w-6" />
                </div>

                <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                  Sign in
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Enter your details to access your account.
                </p>
              </div>

              <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>

                {/* Customer Name */}
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Customer name
                  </span>

                  <div className="group relative">
                    <UserRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jane Doe"
                      autoComplete="name"
                      required
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                    />
                  </div>
                </label>

                {/* Email */}
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Email
                  </span>

                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jane@company.com"
                      autoComplete="email"
                      required
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                    />
                  </div>
                </label>

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />

                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-600/25 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span>{isSubmitting ? "Signing in..." : "Sign in"}</span>

                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </form>

              {/* Footer */}
              <div className="mt-7 flex items-center justify-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="h-4 w-4" />

                Secure access to your configuration workspace
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

