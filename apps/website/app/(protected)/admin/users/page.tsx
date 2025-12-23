"use client";

import { useEffect, useState } from "react";
import { getAllUsers, banUser, unbanUser, type AllUsersResponse } from "@/services/user.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
      if (roleFilter !== "all") {
        filters.push(`role:${roleFilter}`);
      }
      if (activeFilter !== "all") {
        filters.push(`active:${activeFilter === "active"}`);
      }
      if (searchQuery.trim()) {
        filters.push(`search:${searchQuery.trim()}`);
      }

      const data = await getAllUsers({
        page,
        limit,
        sortBy: "created",
        sortOrder: "desc",
        filter: filters.length > 0 ? filters : undefined,
      });
      setUsers(data);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      // Set empty state on error
      setUsers({
        users: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasMore: false,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
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
          <h1 className="text-3xl font-bold text-gray-900">Users Management</h1>
          <p className="text-gray-600 mt-2">Manage users, roles, and permissions</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="TEACHER">Teacher</SelectItem>
                <SelectItem value="STUDENT">Student</SelectItem>
              </SelectContent>
            </Select>
            <Select value={activeFilter} onValueChange={setActiveFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Users ({users?.total || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users && users.users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Name</th>
                    <th className="text-left p-3">Email</th>
                    <th className="text-left p-3">Role</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Created</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.users.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">{user.fullName || "N/A"}</td>
                      <td className="p-3">{user.email}</td>
                      <td className="p-3">
                        <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                          {user.role}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant={user.isActive ? "default" : "destructive"}>
                          {user.isActive ? "Active" : "Banned"}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm text-gray-600">
                        {user.createdAt ? (() => {
                          try {
                            const date = new Date(user.createdAt);
                            return isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString();
                          } catch {
                            return "N/A";
                          }
                        })() : "N/A"}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/admin/users/${user.id}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          {user.isActive ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleBan(user.id)}
                            >
                              <Ban className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleUnban(user.id)}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">No users found</div>
          )}

          {users && users.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {page} of {users.totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.min(users.totalPages, p + 1))}
                disabled={page >= users.totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

