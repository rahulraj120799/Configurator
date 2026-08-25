"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { APP_NAME } from "@/app/constant";
import { useSessionUser } from "@/app/hooks/use-session-user";
import { clearSessionUser, getInitials } from "@/lib/session-user";

type ShellNavItem = {
  id: string;
  label: string;
  href: string;
  icon: string;
  adminOnly?: boolean;
};

const navItems: ShellNavItem[] = [
  { id: "configure", label: "Configure", href: "/", icon: "⚙️" },
  { id: "admin", label: "Admin", href: "/admin", icon: "🛠️", adminOnly: true },
];

type ConfiguratorShellProps = {
  activeNav: ShellNavItem["id"];
  sidebarContent?: ReactNode;
  children: ReactNode;
};

export function ConfiguratorShell({
  activeNav,
  sidebarContent,
  children,
}: ConfiguratorShellProps) {
  const router = useRouter();
  const { user, isLoading } = useSessionUser();
  const isAdminRoute = navItems.some(
    (item) => item.id === activeNav && item.adminOnly
  );

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    if (isAdminRoute && !user.isAdmin) {
      router.replace("/");
    }
  }, [isLoading, user, isAdminRoute, router]);

  const handleLogout = () => {
    clearSessionUser();
    router.replace("/login");
  };

  if (isLoading || !user || (isAdminRoute && !user.isAdmin)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#060b14] text-sm text-blue-100/70">
        Checking your session…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="sticky top-0 h-screen w-72 shrink-0 overflow-hidden border-r border-blue-950/10 bg-[linear-gradient(180deg,#0b2344_0%,#123c72_42%,#1f5fa8_100%)] text-white shadow-[18px_0_50px_rgba(15,23,42,0.12)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(251,146,60,0.16),transparent_28%)]" />
        <div className="relative flex h-full flex-col p-6">
          <div className="mb-8 flex shrink-0 items-center gap-3">
            <div className="rounded-2xl border border-white/20 bg-white/12 p-2.5 shadow-lg backdrop-blur-xl">
              <svg
                className="h-6 w-6 text-orange-200"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold leading-tight tracking-tight">
                {APP_NAME}
              </h1>
              <p className="text-xs text-blue-100/80">Configurator</p>
            </div>
          </div>

          <nav className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
            <p className="mb-4 px-1 text-xs font-semibold uppercase tracking-[0.3em] text-blue-100/70">
              Navigation
            </p>
            {navItems.map((item) => {
              if (item.adminOnly && !user.isAdmin) {
                return null;
              }

              const isActive = activeNav === item.id;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300 ${
                    isActive
                      ? "border border-white/20 bg-white text-slate-900 shadow-[0_16px_40px_rgba(15,23,42,0.22)]"
                      : "text-blue-50/90 hover:bg-white/12 hover:text-white"
                  }`}
                >
                  <span className={`text-lg ${isActive ? "" : "opacity-95"}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  {isActive ? (
                    <span className="ml-auto h-2.5 w-2.5 rounded-full bg-orange-500" />
                  ) : null}
                </Link>
              );
            })}

            {sidebarContent ? <div className="mt-8">{sidebarContent}</div> : null}
          </nav>

          <div className="shrink-0 pt-6">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white">
                  {getInitials(user)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {user.fullName || user.email}
                  </p>
                  <p className="truncate text-xs text-blue-100/80">
                    {user.email}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500/80"
              >
                <span>⎋</span>
                <span>Log out</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}