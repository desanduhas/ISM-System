import { NextRequest } from "next/server";
import { DELETE } from "@/app/api/employees/route";
import { requireAuth } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";

jest.mock("@/lib/auth/get-user", () => ({ requireAuth: jest.fn() }));
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));

const manager: Profile = {
  id: "01234567-abcd-4ef0-8567-0123456789ab",
  email: "manager@example.test",
  full_name: "Test Manager",
  role: "MANAGEMENT",
  is_active: true,
  department_id: null,
  whatsapp_number: null,
  avatar_url: null,
  notification_preferences: {},
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};
const employee = {
  id: "55555555-bbbb-4ddd-8666-123456789abc",
  full_name: "Test Employee",
  role: "GRAPHIC_DESIGNER",
};

const relatedEmployees: Record<string, string> = {
  jobs: "assigned_to",
  job_assignments: "assigned_to",
  job_comments: "author_id",
  job_approvals: "reviewed_by",
  payments: "reported_by",
};

const findProfile = jest.fn();
const findReferences = jest.fn();
const deleteUser = jest.fn();
const audit = jest.fn();

function mockTable(table: string) {
  if (table === "profiles") {
    return {
      select: () => ({
        eq: (column: string, id: string) => ({
          maybeSingle: () => findProfile(column, id),
        }),
      }),
    };
  }
  if (table === "audit_logs") return { insert: audit };
  if (!(table in relatedEmployees)) throw Error("Unexpected table: " + table);
  return {
    select: () => ({
      eq(column: string, id: string) {
        if (table === "jobs") {
          return {
            not: (field: string, operator: string, stages: string) =>
              findReferences(table, column, id, field, operator, stages),
          };
        }
        return findReferences(table, column, id);
      },
    }),
  };
}

function request(body: string) {
  return new NextRequest("http://localhost/api/employees", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

async function remove(id: string) {
  return DELETE(request(JSON.stringify({ id })));
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(requireAuth).mockResolvedValue(manager);
  jest.mocked(createAdminClient).mockReturnValue({
    from: mockTable,
    auth: { admin: { deleteUser } },
  } as unknown as ReturnType<typeof createAdminClient>);
  findProfile.mockResolvedValue({ data: employee, error: null });
  findReferences.mockResolvedValue({ count: 0, error: null });
  deleteUser.mockResolvedValue({ error: null });
  audit.mockResolvedValue({ error: null });
});

describe("DELETE /api/employees", () => {
  test.each(["UNAUTHORIZED", "ACCOUNT_DISABLED"])("rejects %s before accessing employee records", async message => {
    jest.mocked(requireAuth).mockRejectedValue(new Error(message));
    expect((await remove(employee.id)).status).toBe(401);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  test("requires a management account", async () => {
    jest.mocked(requireAuth).mockResolvedValue({ ...manager, role: "FINANCE" });
    expect((await remove(employee.id)).status).toBe(403);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  test.each([manager.id, manager.id.toUpperCase()])("rejects deletion of the caller (%s)", async id => {
    expect((await remove(id)).status).toBe(409);
    expect(deleteUser).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  test.each(["{", JSON.stringify({}), JSON.stringify({ id: "invalid" })])("rejects invalid input %s", async body => {
    expect((await DELETE(request(body))).status).toBe(400);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  test("returns 404 when the requested profile is absent", async () => {
    findProfile.mockResolvedValue({ data: null, error: null });
    expect((await remove(employee.id)).status).toBe(404);
    expect(findProfile).toHaveBeenCalledWith("id", employee.id);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  test.each(Object.entries(relatedEmployees))("preserves an employee referenced by %s.%s", async (relation, field) => {
    findReferences.mockImplementation((table: string, column: string, id: string) => Promise.resolve({
      count: table === relation && column === field && id === employee.id ? 1 : 0,
      error: null,
    }));
    expect((await remove(employee.id)).status).toBe(409);
    expect(deleteUser).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  test("does not delete when reference checks fail", async () => {
    findReferences.mockResolvedValue({ count: null, error: new Error("Database unavailable") });
    expect((await remove(employee.id)).status).toBe(500);
    expect(deleteUser).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  test("returns an error without logging a successful deletion when auth deletion fails", async () => {
    deleteUser.mockResolvedValue({ error: new Error("Auth service unavailable") });
    expect((await remove(employee.id)).status).toBe(500);
    expect(audit).not.toHaveBeenCalled();
  });

  test("returns 404 if the account disappears after the profile check", async () => {
    deleteUser.mockResolvedValue({ error: { code: "user_not_found", status: 404 } });
    expect((await remove(employee.id)).status).toBe(404);
    expect(audit).not.toHaveBeenCalled();
  });

  test("deletes an unreferenced employee and audits the caller and target", async () => {
    const response = await remove(employee.id);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(findReferences).toHaveBeenCalledWith(
      "jobs", "assigned_to", employee.id, "current_stage", "in", expect.stringMatching(/COMPLETED.*CANCELLED|CANCELLED.*COMPLETED/),
    );
    expect(deleteUser).toHaveBeenCalledTimes(1);
    expect(deleteUser).toHaveBeenCalledWith(employee.id);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({
      actor_id: manager.id,
      action: "EMPLOYEE_DELETED",
      entity_id: employee.id,
      old_values: employee,
    }));
  });

  test("reports the committed deletion with a warning if the audit log is unavailable", async () => {
    const logged = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      audit.mockResolvedValue({ error: new Error("Audit unavailable") });
      const response = await remove(employee.id);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true, warning: expect.any(String) });
      expect(deleteUser).toHaveBeenCalledTimes(1);
      expect(logged).toHaveBeenCalled();
    } finally {
      logged.mockRestore();
    }
  });
});
