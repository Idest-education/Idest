"use client";

import { useEffect, useState } from "react";
import { getAllUsers, banUser, unbanUser, type AllUsersResponse } from "@/services/user.service";
import { Search, Ban, CheckCircle, Eye } from "lucide-react";
import Link from "next/link";
import LoadingScreen from "@/components/loading-screen";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AllUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const filters: string[] = [];
      if (roleFilter !== "all") filters.push(`role:${roleFilter}`);
      if (activeFilter !== "all") filters.push(`active:${activeFilter === "active"}`);
      if (searchQuery.trim()) filters.push(`search:${searchQuery.trim()}`);

      const data = await getAllUsers({
        page,
        limit,
        sortBy: "created",
        sortOrder: "desc",
        filter: filters.length > 0 ? filters : undefined,
      });
      setUsers(data);
    } catch (error: unknown) {
      console.error("Error fetching users:", error);
      setUsers({ users: [], total: 0, page: 1, limit: 20, totalPages: 0, hasMore: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, roleFilter, activeFilter]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (page === 1) {
        fetchUsers();
      } else {
        setPage(1);
      }
    }, 500);
    return () => clearTimeout(debounce);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const handleBan = async (id: string) => {
    if (!confirm("Are you sure you want to ban this user?")) return;
    try {
      await banUser(id);
      fetchUsers();
    } catch (error) {
      console.error("Error banning user:", error);
      alert("Failed to ban user");
    }
  };

  const handleUnban = async (id: string) => {
    if (!confirm("Are you sure you want to unban this user?")) return;
    try {
      await unbanUser(id);
      fetchUsers();
    } catch (error) {
      console.error("Error unbanning user:", error);
      alert("Failed to unban user");
    }
  };

  if (loading && !users) return <LoadingScreen />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            style={{
              fontFamily: "Oswald, sans-serif",
              fontWeight: 700,
              fontSize: 26,
              color: "var(--color-text-primary)",
            }}
          >
            Users Management
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
            Manage users, roles, and permissions
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "var(--color-text-muted)" }}
          />
          <input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none"
            style={{
              background: "var(--color-surface-card)",
              border: "1.5px solid var(--color-border-default)",
              color: "var(--color-text-primary)",
              fontFamily: "Plus Jakarta Sans, sans-serif",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--color-brand)";
              e.currentTarget.style.boxShadow = "0 0 0 3px #FF6B3520";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border-default)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg px-3 py-2.5 text-sm outline-none"
          style={{
            background: "var(--color-surface-card)",
            border: "1.5px solid var(--color-border-default)",
            color: "var(--color-text-primary)",
            fontFamily: "Plus Jakarta Sans, sans-serif",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-brand)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border-default)"; }}
        >
          <option value="all">All Roles</option>
          <option value="ADMIN">Admin</option>
          <option value="TEACHER">Teacher</option>
          <option value="STUDENT">Student</option>
        </select>
        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
          className="rounded-lg px-3 py-2.5 text-sm outline-none"
          style={{
            background: "var(--color-surface-card)",
            border: "1.5px solid var(--color-border-default)",
            color: "var(--color-text-primary)",
            fontFamily: "Plus Jakarta Sans, sans-serif",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-brand)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border-default)"; }}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div
        className="overflow-hidden"
        style={{
          background: "var(--color-surface-card)",
          border: "1.5px solid var(--color-border-default)",
          borderRadius: 12,
        }}
      >
        {/* Table head bar */}
        <div
          className="px-5 py-3"
          style={{
            background: "var(--color-surface-muted)",
            borderBottom: "1.5px solid var(--color-border-default)",
          }}
        >
          <h3
            style={{
              fontFamily: "Oswald, sans-serif",
              fontWeight: 600,
              fontSize: 15,
              color: "var(--color-text-primary)",
            }}
          >
            Users ({users?.total || 0})
          </h3>
        </div>

        {users && users.users.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1.5px solid var(--color-border-default)" }}>
                  {["Name", "Email", "Role", "Status", "Created", "Actions"].map((h) => (
                    <th
                      key={h}
                      className={`p-3 text-left text-xs uppercase tracking-widest ${h === "Actions" ? "text-right" : ""}`}
                      style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif", letterSpacing: "0.06em", fontWeight: 500 }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.users.map((user) => (
                  <tr
                    key={user.id}
                    style={{ borderBottom: "1px solid var(--color-border-default)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--color-surface-subtle)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                  >
                    <td className="p-3 text-sm" style={{ color: "var(--color-text-primary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                      {user.fullName || "N/A"}
                    </td>
                    <td className="p-3 text-sm" style={{ color: "var(--color-text-secondary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                      {user.email}
                    </td>
                    <td className="p-3">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={
                          user.role === "ADMIN"
                            ? { background: "#1a0a00", color: "#fffaf5" }
                            : { background: "var(--color-surface-subtle)", color: "var(--color-text-secondary)" }
                        }
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={
                          user.isActive
                            ? { background: "#dcfce7", color: "#166534" }
                            : { background: "#fee2e2", color: "#7f1d1d" }
                        }
                      >
                        {user.isActive ? "Active" : "Banned"}
                      </span>
                    </td>
                    <td className="p-3 text-sm" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                      {user.createdAt ? (() => {
                        try {
                          const date = new Date(user.createdAt);
                          return isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString();
                        } catch { return "N/A"; }
                      })() : "N/A"}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/admin/users/${user.id}`}>
                          <button
                            className="p-1.5 rounded-lg text-xs font-medium"
                            style={{
                              background: "var(--color-surface-muted)",
                              border: "1px solid var(--color-border-default)",
                              color: "var(--color-text-secondary)",
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </Link>
                        {user.isActive ? (
                          <button
                            onClick={() => handleBan(user.id)}
                            className="p-1.5 rounded-lg text-xs font-medium"
                            style={{
                              background: "#fee2e2",
                              border: "1px solid #fecaca",
                              color: "var(--color-error)",
                            }}
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUnban(user.id)}
                            className="p-1.5 rounded-lg text-xs font-medium"
                            style={{
                              background: "var(--color-surface-muted)",
                              border: "1px solid var(--color-border-default)",
                              color: "var(--color-text-secondary)",
                            }}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-sm" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
            No users found
          </div>
        )}

        {users && users.totalPages > 1 && (
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ borderTop: "1.5px solid var(--color-border-default)" }}
          >
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
              style={{
                background: "var(--color-surface-card)",
                border: "1.5px solid var(--color-border-default)",
                color: "var(--color-text-primary)",
                fontFamily: "Plus Jakarta Sans, sans-serif",
              }}
            >
              Previous
            </button>
            <span className="text-sm" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Page {page} of {users.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(users.totalPages, p + 1))}
              disabled={page >= users.totalPages}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
              style={{
                background: "var(--color-surface-card)",
                border: "1.5px solid var(--color-border-default)",
                color: "var(--color-text-primary)",
                fontFamily: "Plus Jakarta Sans, sans-serif",
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
