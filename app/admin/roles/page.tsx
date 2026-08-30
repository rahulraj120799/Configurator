"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Mail,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  UserRoundCheck,
  X,
} from "lucide-react";
import { ConfiguratorShell } from "@/app/components/configurator-shell";

type RoleName = "ADMIN" | "EMPLOYEE" | "SALESPERSON";

type RoleRecord = {
  id: number;
  email: string;
  role: RoleName;
  fullName: string;
  active: boolean;
};

type PagedRolesResponse = {
  content: RoleRecord[];
  totalElements: number;
};

const roleOptions: RoleName[] = ["ADMIN", "EMPLOYEE", "SALESPERSON"];

const rolePresentation = {
  ADMIN: {
    icon: ShieldCheck,
    className: "bg-violet-50 text-violet-700 ring-violet-600/15",
  },
  EMPLOYEE: {
    icon: BriefcaseBusiness,
    className: "bg-sky-50 text-sky-700 ring-sky-600/15",
  },
  SALESPERSON: {
    icon: UserRoundCheck,
    className: "bg-amber-50 text-amber-800 ring-amber-600/15",
  },
} satisfies Record<RoleName, { icon: typeof ShieldCheck; className: string }>;

const emptyDraft = {
  fullName: "",
  email: "",
  role: "SALESPERSON" as RoleName,
};

const DEFAULT_NEW_USER_PASSWORD = "ChangeMe123!";

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const getErrorMessage = async (response: Response) => {
  const payload = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;
  return payload?.message ?? "Unable to complete the request.";
};

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [totalRoles, setTotalRoles] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRecord | null>(null);
  const [deletingRole, setDeletingRole] = useState<RoleRecord | null>(null);
  const [activatingRole, setActivatingRole] = useState<RoleRecord | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const filteredRoles = useMemo(() => {
    const term = deferredSearchTerm.trim().toLowerCase();

    if (!term) {
      return roles;
    }

    return roles.filter((role) =>
      [role.fullName, role.email, role.role]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [roles, deferredSearchTerm]);

  useEffect(() => {
    const controller = new AbortController();

    const loadRoles = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch("/api/admin/users?page=0&size=100", {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(await getErrorMessage(response));
        }

        const payload = (await response.json()) as PagedRolesResponse;
        setRoles(payload.content);
        setTotalRoles(payload.totalElements);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load users."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void loadRoles();
    return () => controller.abort();
  }, []);

  const openAddModal = () => {
    setEditingRole(null);
    setDraft(emptyDraft);
    setErrorMessage(null);
    setIsRoleModalOpen(true);
  };

  const openEditModal = (role: RoleRecord) => {
    setEditingRole(role);
    setDraft({ fullName: role.fullName, email: role.email, role: role.role });
    setErrorMessage(null);
    setIsRoleModalOpen(true);
  };

  const closeRoleModal = () => {
    setIsRoleModalOpen(false);
    setEditingRole(null);
    setDraft(emptyDraft);
  };

  const handleSaveRole = async () => {
    const fullName = draft.fullName.trim();
    const email = draft.email.trim();

    if (!fullName || !draft.role) {
      return;
    }

    if (!isValidEmail(email)) {
      setErrorMessage("Enter a valid email address.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: editingRole ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingRole
            ? {
                id: editingRole.id,
                email,
                fullName,
                role: draft.role === editingRole.role ? undefined : draft.role,
              }
            : {
                email,
                fullName,
                password: DEFAULT_NEW_USER_PASSWORD,
                role: draft.role,
              }
        ),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const savedRole = (await response.json()) as RoleRecord;
      setRoles((current) =>
        editingRole
          ? current.map((role) => (role.id === savedRole.id ? savedRole : role))
          : [savedRole, ...current]
      );
      if (!editingRole) {
        setTotalRoles((current) => current + 1);
      }
      closeRoleModal();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to save user."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!deletingRole) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/admin/users?id=${deletingRole.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const deactivatedRole = (await response.json()) as RoleRecord;
      setRoles((current) =>
        current.map((role) =>
          role.id === deactivatedRole.id ? deactivatedRole : role
        )
      );
      setDeletingRole(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to deactivate user."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleActivateRole = async () => {
    if (!activatingRole) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/admin/users/${activatingRole.id}/activate`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const activatedRole = (await response.json().catch(() => null)) as RoleRecord | null;
      setRoles((current) =>
        current.map((role) =>
          role.id === activatingRole.id
            ? activatedRole ?? { ...role, active: true }
            : role
        )
      );
      setActivatingRole(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to activate user."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ConfiguratorShell activeNav="admin-roles">
      <div className="min-h-screen bg-[#f4f7fb]">
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-6 py-7 lg:flex-row lg:items-end lg:justify-between lg:px-10">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-blue-700">
                <span className="h-px w-6 bg-orange-500" />
                Admin workspace
              </div>
              <h1 className="text-3xl font-bold text-slate-950">Roles</h1>
              <p className="mt-2 max-w-xl text-sm text-slate-500">
                Manage employee, salesperson, and administrator accounts.
              </p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-slate-50 shadow-sm sm:grid-cols-3">
              <div className="px-5 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Users</p>
                <p className="mt-1 text-xl font-bold text-slate-950">{totalRoles}</p>
              </div>
              <div className="px-5 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Admins</p>
                <p className="mt-1 text-xl font-bold text-blue-700">
                  {roles.filter((role) => role.role === "ADMIN" && role.active).length}
                </p>
              </div>
              <div className="col-span-2 border-t border-slate-200 px-5 py-3 sm:col-span-1 sm:border-t-0">
                <p className="text-xs font-semibold uppercase text-slate-500">Showing</p>
                <p className="mt-1 text-xl font-bold text-slate-950">
                  {filteredRoles.length}
                  <span className="ml-1 text-sm font-medium text-slate-400">rows</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1500px] px-6 py-6 lg:px-10">
          <div className="rounded-lg border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                  <Search className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">Find a role</p>
                  <p className="text-xs text-slate-500">Search by name, email, or role.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                <Plus className="h-4 w-4" />
                Add Role
              </button>
            </div>
            <div className="p-5">
              <label className="text-xs font-semibold text-slate-600">
                Search roles
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Name, email, or role..."
                  className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-slate-50/60 px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100/70"
                />
              </label>
            </div>
          </div>

          {errorMessage ? (
            <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700" role="alert">
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-sm font-bold text-slate-900">Assigned roles</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {filteredRoles.length} {filteredRoles.length === 1 ? "record" : "records"}
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead className="bg-[#123c72] text-xs font-semibold uppercase text-blue-100">
                  <tr>
                    <th className="px-5 py-3.5">Full Name</th>
                    <th className="px-5 py-3.5">Email</th>
                    <th className="px-5 py-3.5">Role</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-16 text-center text-sm font-medium text-slate-500">
                        Loading users...
                      </td>
                    </tr>
                  ) : filteredRoles.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-16 text-center">
                        <p className="text-sm font-semibold text-slate-700">No roles found</p>
                        <p className="mt-1 text-xs text-slate-500">Adjust the search or add a new role.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredRoles.map((role) => {
                      const RoleIcon = rolePresentation[role.role].icon;

                      return (
                      <tr key={role.id} className="group transition-colors hover:bg-blue-50/50">
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-3 border-l-2 border-orange-400 pl-3 text-sm font-semibold text-slate-900">
                            <UserRound className="h-4 w-4 text-blue-700" />
                            {role.fullName}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-2 text-sm text-slate-600">
                            <Mail className="h-4 w-4 text-slate-400" />
                            {role.email}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-sm font-bold ring-1 ring-inset ${rolePresentation[role.role].className}`}>
                            <RoleIcon className="h-3.5 w-3.5" />
                            {role.role}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-bold ${role.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                            {role.active ? "Active" : "Deactivated"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(role)}
                              aria-label={`Edit user ${role.email}`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            {role.active ? (
                              <button
                                type="button"
                                onClick={() => setDeletingRole(role)}
                                aria-label={`Deactivate user ${role.email}`}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setActivatingRole(role)}
                                aria-label={`Activate user ${role.email}`}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {isRoleModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4"
          onClick={closeRoleModal}
        >
          <div
            className="w-full max-w-lg rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_24px_64px_rgba(15,23,42,0.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingRole ? "Edit Role" : "Add Role"}
                </h2>
                <p className="text-sm text-slate-500">
                  {editingRole ? "Update the name, email, or role." : "Create a new user account."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeRoleModal}
                aria-label="Close role modal"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                Full Name
                <input
                  value={draft.fullName}
                  onChange={(event) => setDraft((current) => ({ ...current, fullName: event.target.value }))}
                  placeholder="Jane Sales"
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                Email
                <input
                  type="email"
                  value={draft.email}
                  onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
                  placeholder="jane.sales@example.com"
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                Role
                <select
                  value={draft.role}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, role: event.target.value as RoleName }))
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeRoleModal}
                className="inline-flex h-10 items-center rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRole}
                disabled={isSaving || !draft.fullName.trim() || !draft.email.trim() || !draft.role}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ShieldCheck className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save User"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deletingRole ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4"
          onClick={() => setDeletingRole(null)}
        >
          <div
            className="w-full max-w-md rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_24px_64px_rgba(15,23,42,0.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/15">
                <Trash2 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Deactivate user?</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Do you want to deactivate {deletingRole.fullName} ({deletingRole.email})? Their credentials will stop working immediately.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingRole(null)}
                className="inline-flex h-10 items-center rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRole}
                disabled={isSaving}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-rose-600 px-5 text-sm font-semibold text-white transition hover:bg-rose-700"
              >
                <Trash2 className="h-4 w-4" />
                {isSaving ? "Deactivating..." : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {activatingRole ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4"
          onClick={() => setActivatingRole(null)}
        >
          <div
            className="w-full max-w-md rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_24px_64px_rgba(15,23,42,0.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
                <RotateCcw className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Activate user?</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Do you want to activate {activatingRole.fullName} ({activatingRole.email})? Their credentials will start working again.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setActivatingRole(null)}
                className="inline-flex h-10 items-center rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleActivateRole}
                disabled={isSaving}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RotateCcw className="h-4 w-4" />
                {isSaving ? "Activating..." : "Activate"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfiguratorShell>
  );
}