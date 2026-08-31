export type UserRole = "ADMIN" | "EMPLOYEE" | "SALESPERSON";

export type SessionUser = {
  fullName: string;
  email: string;
  role: UserRole;
  loggedInAt: string;
};

export const DEFAULT_USER_ROLE: UserRole = "EMPLOYEE";

const navAccessByRole: Record<UserRole, string[]> = {
  EMPLOYEE: ["configure"],
  SALESPERSON: ["configure", "admin-history"],
  ADMIN: ["configure", "admin", "admin-history", "admin-roles"],
};

export const isUserRole = (value: unknown): value is UserRole =>
  value === "ADMIN" || value === "EMPLOYEE" || value === "SALESPERSON";

export const canAccessNav = (role: UserRole, navId: string) =>
  navAccessByRole[role]?.includes(navId) ?? false;

export const SESSION_USER_KEY = "trailer-configurator:user";
export const SESSION_USER_EVENT = "trailer-configurator:user-change";

const isBrowser = () => typeof window !== "undefined";

const notify = () => {
  window.dispatchEvent(new Event(SESSION_USER_EVENT));
};

export function readSessionUser(): SessionUser | null {
  if (!isBrowser()) {
    return null;
  }

  const raw = window.sessionStorage.getItem(SESSION_USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SessionUser>;
    if (!parsed?.email) {
      return null;
    }

    return {
      fullName: parsed.fullName ?? "",
      email: parsed.email,
      role: isUserRole(parsed.role) ? parsed.role : DEFAULT_USER_ROLE,
      loggedInAt: parsed.loggedInAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveSessionUser(user: SessionUser) {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
  notify();
}

export function clearSessionUser() {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.removeItem(SESSION_USER_KEY);
  notify();
}

export function getInitials(user: SessionUser) {
  const source = user.fullName.trim() || user.email;
  const parts = source.split(/[\s._@-]+/).filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
