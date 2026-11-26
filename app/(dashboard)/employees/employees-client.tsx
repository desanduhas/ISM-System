"use client";

import ModuleMetrics from "@/app/(dashboard)/_components/module-metrics";

import OperationDialog from "@/app/(dashboard)/_components/operation-dialog";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  UserPlus,
  Search,
  Building2,
  Briefcase,
  Phone,
  Mail,
  Edit2,
  Trash2,
  CheckCircle,
  Loader2,
  X,
  Activity,
  KeyRound,
} from "lucide-react";
import { ROLE_LABELS, formatSriLankanPhone } from "@/lib/utils";
import type { UserRole, Department, Profile } from "@/lib/types";
import { toast } from "sonner";
import ResetPasswordDialog from "@/components/account/reset-password-dialog";

export interface EmployeeWithStats extends Profile {
  active_jobs_count: number;
  department?: Department | null;
}

interface EmployeesClientProps {
  initialEmployees: EmployeeWithStats[];
  departments: Department[];
  currentEmployeeId: string;
}

const ROLES: UserRole[] = [
  "MANAGEMENT",
  "MARKETING_CUSTOMER_CARE",
  "GRAPHIC_DESIGNER",
  "CAPTURING",
  "FINANCE",
];


export default function EmployeesClient({
  initialEmployees,
  departments,
  currentEmployeeId,
}: EmployeesClientProps) {
  const router = useRouter();
  const [employees, setEmployees] = useState<EmployeeWithStats[]>(initialEmployees);
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("ALL");
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithStats | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<EmployeeWithStats | null>(null);
  const [resettingPassword, setResettingPassword] = useState<EmployeeWithStats | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [loading, setLoading] = useState(false);

  // Filtered employees
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.full_name.toLowerCase().includes(search.toLowerCase()) ||
      emp.email.toLowerCase().includes(search.toLowerCase()) ||
      (emp.whatsapp_number && emp.whatsapp_number.includes(search));
    const matchesRole = selectedRole === "ALL" || emp.role === selectedRole;
    const matchesDept = selectedDept === "ALL" || emp.department_id === selectedDept;
    return matchesSearch && matchesRole && matchesDept;
  });

  // Stats
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e) => e.is_active).length;
  const totalActiveJobs = employees.reduce((sum, e) => sum + (e.active_jobs_count || 0), 0);

  // Toggle active status
  async function toggleActive(employee: EmployeeWithStats) {
    const newStatus = !employee.is_active;
    try {
      const res = await fetch("/api/employees", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: employee.id,
          is_active: newStatus,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update status");
      }

      setEmployees((prev) =>
        prev.map((e) => (e.id === employee.id ? { ...e, is_active: newStatus } : e))
      );
      toast.success(
        `${employee.full_name} is now ${newStatus ? "Active" : "Deactivated"}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle status");
    }
  }

  async function deleteEmployee() {
    if (!employeeToDelete || employeeToDelete.id === currentEmployeeId || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/employees", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: employeeToDelete.id }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || body?.success !== true) {
        throw new Error(body?.error || (res.redirected ? "Your session has expired. Sign in again." : "Could not confirm the deletion."));
      }
      setEmployees((current) => current.filter((employee) => employee.id !== employeeToDelete.id));
      setEmployeeToDelete(null);
      if (body.warning) {
        toast.warning(body.warning);
      } else {
        toast.success(`${employeeToDelete.full_name} was deleted.`);
      }
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete this employee.");
    } finally {
      setDeleting(false);
    }
  }

  // Create Employee
  async function handleAddEmployee(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);

    const payload = {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      full_name: formData.get("full_name") as string,
      role: formData.get("role") as UserRole,
      department_id: (formData.get("department_id") as string) || null,
      whatsapp_number: (formData.get("whatsapp_number") as string) || null,
    };

    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to add employee");
      }

      toast.success("Employee invited successfully!");
      setIsAddOpen(false);
      // Refresh list
      router.refresh();
      setEmployees((prev) => [{ ...resData.data, active_jobs_count: 0 }, ...prev]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add employee");
    } finally {
      setLoading(false);
    }
  }

  // Edit Employee
  async function handleEditEmployee(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingEmployee) return;
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);

    const payload = {
      id: editingEmployee.id,
      full_name: formData.get("full_name") as string,
      role: formData.get("role") as UserRole,
      department_id: (formData.get("department_id") as string) || null,
      whatsapp_number: (formData.get("whatsapp_number") as string) || null,
    };

    try {
      const res = await fetch("/api/employees", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to update employee");
      }

      toast.success("Employee updated successfully!");
      setEditingEmployee(null);
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === editingEmployee.id
            ? {
                ...emp,
                ...resData.data,
                department: departments.find((d) => d.id === payload.department_id) || null,
              }
            : emp
        )
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update employee");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="operations-module module-employees">
      {/* Top Header */}
      <div className="module-heading flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Employees</h1>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
        >
          <UserPlus size={16} />
          Add Employee
        </button>
      </div>

      {/* Summary KPI Cards */}
      <ModuleMetrics items={[
        { label: "Team members", value: totalEmployees, icon: Users },
        { label: "Active members", value: activeEmployees, icon: CheckCircle },
        { label: "Departments", value: departments.length, icon: Building2 },
        { label: "Assigned jobs", value: totalActiveJobs, icon: Activity },
      ]} />

      {/* Filters & Search */}
      <div className="module-toolbar bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search by name, email, or WhatsApp"
            placeholder="Search by name, email, or WhatsApp..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Employee role"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="ALL">All Roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>

          <select

            aria-label="Department"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="module-table-scroll overflow-x-auto">
          <table className="module-table w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th scope="col" className="px-6 py-3.5">Employee</th>
                <th scope="col" className="px-6 py-3.5">Role</th>
                <th scope="col" className="px-6 py-3.5">Department</th>
                <th scope="col" className="px-6 py-3.5">Workload</th>
                <th scope="col" className="px-6 py-3.5">Status</th>
                <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No employees found matching the filters.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  // Workload badge styling
                  let workloadBadge = "bg-emerald-50 text-emerald-700 border-emerald-200";
                  if (emp.active_jobs_count >= 5) {
                    workloadBadge = "bg-rose-50 text-rose-700 border-rose-200 font-semibold";
                  } else if (emp.active_jobs_count >= 3) {
                    workloadBadge = "bg-amber-50 text-amber-700 border-amber-200";
                  }

                  return (
                    <tr
                      key={emp.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !emp.is_active ? "opacity-60 bg-slate-50/50" : ""
                      }`}
                    >
                      <td data-label="Employee" className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="employee-monogram">
                            {emp.full_name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{emp.full_name}</p>
                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                              <span className="flex items-center gap-1">
                                <Mail size={12} />
                                {emp.email}
                              </span>
                              {emp.whatsapp_number && (
                                <a
                                  href={`https://wa.me/${emp.whatsapp_number.replace(/\D/g, "")}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-emerald-600 hover:underline"
                                >
                                  <Phone size={12} />
                                  {formatSriLankanPhone(emp.whatsapp_number)}
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td data-label="Role" className="px-6 py-4">
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-slate-100 text-slate-800 border-slate-200"
                        >
                          {ROLE_LABELS[emp.role] || emp.role}
                        </span>
                      </td>

                      <td data-label="Department" className="px-6 py-4 text-slate-700">
                        {emp.department?.name || "—"}
                      </td>

                      <td data-label="Workload" className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs border ${workloadBadge}`}
                          >
                            <Briefcase size={12} />
                            {emp.active_jobs_count} active{" "}
                            {emp.active_jobs_count === 1 ? "job" : "jobs"}
                          </span>
                        </div>
                      </td>

                      <td data-label="Status" className="px-6 py-4">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={emp.is_active}
                            onChange={() => toggleActive(emp)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                          <span className="ml-2 text-xs font-medium text-slate-700">
                            {emp.is_active ? "Active" : "Inactive"}
                          </span>
                        </label>
                      </td>

                      <td data-label="Actions" className="px-6 py-4 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            onClick={() => setEditingEmployee(emp)}
                            aria-label={`Edit ${emp.full_name}`}
                            className="inline-flex min-h-10 items-center gap-1 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg border border-slate-200"
                          >
                            <Edit2 size={13} /> Edit
                          </button>
                          <button
                            onClick={() => setResettingPassword(emp)}
                            aria-label={`Reset password for ${emp.full_name}`}
                            className="inline-flex min-h-10 items-center gap-1 px-3 text-xs font-medium text-amber-700 hover:bg-amber-50 rounded-lg border border-amber-200"
                          >
                            <KeyRound size={13} /> Reset PW
                          </button>
                          {emp.id !== currentEmployeeId && (
                            <button
                              aria-label={`Delete ${emp.full_name}`}
                              onClick={() => {
                                setDeleteError("");
                                setEmployeeToDelete(emp);
                              }}
                              className="inline-flex min-h-10 items-center gap-1 px-3 text-xs font-medium text-red-700 hover:bg-red-50 rounded-lg border border-red-200"
                            >
                              <Trash2 size={13} /> Delete
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

      {resettingPassword && (
        <ResetPasswordDialog
          employeeId={resettingPassword.id}
          employeeName={resettingPassword.full_name}
          onDismiss={() => setResettingPassword(null)}
        />
      )}

      {employeeToDelete && (
        <OperationDialog
          titleId="delete-employee-dialog"
          onDismiss={() => { if (!deleting) setEmployeeToDelete(null); }}
          className="max-w-md p-6 space-y-4"
        >
          <h2 id="delete-employee-dialog">Delete employee?</h2>
          <p className="text-sm text-slate-700">
            This will permanently delete <strong>{employeeToDelete.full_name}</strong> ({employeeToDelete.email}), their sign-in access, and their personal notifications.
          </p>
          {deleteError && <p role="alert" className="text-sm text-red-700">{deleteError}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              onClick={() => setEmployeeToDelete(null)}
              disabled={deleting}
              className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={deleteEmployee}
              disabled={deleting}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-red-700 px-4 text-sm font-medium text-white hover:bg-red-800"
            >
              {deleting && <Loader2 size={15} className="animate-spin" />}
              {deleting ? "Deleting…" : "Delete employee"}
            </button>
          </div>
        </OperationDialog>
      )}

      {/* Add Employee Dialog Modal */}
      {isAddOpen && (
        <OperationDialog titleId="new-employee-dialog" onDismiss={() => setIsAddOpen(false)} className="w-full max-w-lg">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h2 id="new-employee-dialog" className="font-semibold text-slate-900">Add Team Member</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Create an account and assign operational role
              </p>
            </div>
            <button
              type="button"
              aria-label="Close dialog"
              onClick={() => setIsAddOpen(false)}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleAddEmployee} className="p-6 space-y-4">
            <div>
              <label htmlFor="employees-full-name-1" className="block text-sm font-medium text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                id="employees-full-name-1"
                name="full_name"
                required
                placeholder="e.g. Kasun Perera"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label htmlFor="employees-work-email-2" className="block text-sm font-medium text-slate-700 mb-1">
                Work Email *
              </label>
              <input
                id="employees-work-email-2"
                name="email"
                type="email"
                required
                placeholder="kasun@ismflow.lk"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label htmlFor="employees-initial-password-3" className="block text-sm font-medium text-slate-700 mb-1">
                Initial Password *
              </label>
              <input
                id="employees-initial-password-3"
                name="password"
                type="password"
                required
                minLength={6}
                placeholder="At least 6 characters"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="employees-role-4" className="block text-sm font-medium text-slate-700 mb-1">
                  Role *
                </label>
                <select
                  id="employees-role-4"
                  name="role"
                  required
                  defaultValue="GRAPHIC_DESIGNER"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="employees-department-5" className="block text-sm font-medium text-slate-700 mb-1">
                  Department
                </label>
                <select
                  id="employees-department-5"
                  name="department_id"
                  defaultValue=""
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">No Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="employees-whatsapp-number-with-sri-lanka-prefix-94-6" className="block text-sm font-medium text-slate-700 mb-1">
                WhatsApp Number (with Sri Lanka prefix +94)
              </label>
              <input
                id="employees-whatsapp-number-with-sri-lanka-prefix-94-6"
                name="whatsapp_number"
                placeholder="+94 77 123 4567"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Account"
                )}
              </button>
            </div>
          </form>
        </OperationDialog>
      )}

      {/* Edit Employee Modal */}
      {editingEmployee && (
        <OperationDialog titleId="edit-employee-dialog" onDismiss={() => setEditingEmployee(null)} className="w-full max-w-lg">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h2 id="edit-employee-dialog" className="font-semibold text-slate-900">Edit Team Member</h2>
              <p className="text-xs text-slate-500 mt-0.5">{editingEmployee.email}</p>
            </div>
            <button
              type="button"
              aria-label="Close dialog"
              onClick={() => setEditingEmployee(null)}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleEditEmployee} className="p-6 space-y-4">
            <div>
              <label htmlFor="employees-full-name-7" className="block text-sm font-medium text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                id="employees-full-name-7"
                name="full_name"
                required
                defaultValue={editingEmployee.full_name}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="employees-role-8" className="block text-sm font-medium text-slate-700 mb-1">
                  Role *
                </label>
                <select
                  id="employees-role-8"
                  name="role"
                  required
                  defaultValue={editingEmployee.role}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="employees-department-9" className="block text-sm font-medium text-slate-700 mb-1">
                  Department
                </label>
                <select
                  id="employees-department-9"
                  name="department_id"
                  defaultValue={editingEmployee.department_id || ""}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">No Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="employees-whatsapp-number-10" className="block text-sm font-medium text-slate-700 mb-1">
                WhatsApp Number
              </label>
              <input
                id="employees-whatsapp-number-10"
                name="whatsapp_number"
                defaultValue={editingEmployee.whatsapp_number || ""}
                placeholder="+94 77 123 4567"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={() => setEditingEmployee(null)}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </form>
        </OperationDialog>
      )}
    </div>
  );
}
