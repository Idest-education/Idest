"use client";

import { useEffect, useState } from "react";
import { getAllClasses, type PaginatedClassResponse, updateClassAdmin, deleteClassAdmin, createClass, getClassById } from "@/services/class.service";
import type { ClassData, ClassDetail } from "@/types/class";
import { Search, Eye, Trash2, Plus, Edit } from "lucide-react";
import Link from "next/link";
import LoadingScreen from "@/components/loading-screen";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export default function AdminClassesPage() {
  const [classes, setClasses] = useState<PaginatedClassResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(8);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassData | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "", is_group: false, price: "" });
  const [formErrors, setFormErrors] = useState<{ name?: string; description?: string }>({});

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const data = await getAllClasses({
        page,
        pageSize,
        q: searchQuery.trim() || undefined,
        sortBy: "updated_at",
        sortOrder: "desc",
      });
      setClasses(data);
    } catch (error: unknown) {
      console.error("Error fetching classes:", error);
      setClasses({
        data: [],
        pagination: {
          page: 1,
          pageSize: 8,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (page === 1) {
        fetchClasses();
      } else {
        setPage(1);
      }
    }, 500);
    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const handleCreate = async () => {
    // Validate required fields
    const errors: { name?: string; description?: string } = {};
    if (!formData.name.trim()) {
      errors.name = "Name is required";
    }
    if (!formData.description.trim()) {
      errors.description = "Description is required";
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    try {
      const parsedPrice =
        formData.price && formData.price.trim() !== ""
          ? Number(formData.price)
          : undefined;
      await createClass({
        name: formData.name.trim(),
        description: formData.description.trim(),
        is_group: formData.is_group,
        ...(parsedPrice !== undefined && !Number.isNaN(parsedPrice)
          ? { price: parsedPrice }
          : {}),
      });
      setShowCreateDialog(false);
      setFormData({ name: "", description: "", is_group: false, price: "" });
      fetchClasses();
    } catch (error) {
      console.error("Error creating class:", error);
      alert("Failed to create class");
    }
  };

  const handleEdit = async (classItem: ClassData) => {
    setEditingClass(classItem);
    try {
      // Fetch full class details to get is_group
      const classDetail = await getClassById(classItem.id) as ClassDetail;
      setFormData({
        name: classDetail.name || classItem.name,
        description: classDetail.description || classItem.description || "",
        is_group: classDetail.is_group ?? false,
        price: classDetail.price != null ? String(classDetail.price) : "",
      });
    } catch (error) {
      console.error("Error fetching class details:", error);
      // Fallback to basic data
      setFormData({
        name: classItem.name,
        description: classItem.description || "",
        is_group: false,
        price: "",
      });
    }
    setFormErrors({});
    setShowEditDialog(true);
  };

  const handleUpdate = async () => {
    if (!editingClass) return;

    // Validate required fields
    const errors: { name?: string; description?: string } = {};
    if (!formData.name.trim()) {
      errors.name = "Name is required";
    }
    if (!formData.description.trim()) {
      errors.description = "Description is required";
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    try {
      await updateClassAdmin(editingClass.id, {
        name: formData.name.trim(),
        description: formData.description.trim(),
        is_group: formData.is_group,
      });
      setShowEditDialog(false);
      setEditingClass(null);
      setFormData({ name: "", description: "", is_group: false, price: "" });
      fetchClasses();
    } catch (error) {
      console.error("Error updating class:", error);
      alert("Failed to update class");
    }
  };

  const handleDelete = async (classId: string) => {
    if (!confirm("Are you sure you want to delete this class? This action cannot be undone.")) return;
    try {
      await deleteClassAdmin(classId);
      fetchClasses();
    } catch (error) {
      console.error("Error deleting class:", error);
      alert("Failed to delete class");
    }
  };

  if (loading && !classes) return <LoadingScreen />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 26, color: "var(--color-text-primary)" }}>
            Classes Management
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
            View and manage all classes
          </p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: "var(--color-brand)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
        >
          <Plus className="w-4 h-4" />
          Create Class
        </button>
      </div>

      {/* Search */}
      <div
        className="rounded-xl p-4"
        style={{ background: "var(--color-surface-card)", border: "1.5px solid var(--color-border-default)" }}
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--color-text-muted)" }} />
          <input
            placeholder="Search classes by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none"
            style={{
              background: "var(--color-surface-subtle)",
              border: "1.5px solid var(--color-border-default)",
              color: "var(--color-text-primary)",
              fontFamily: "Plus Jakarta Sans, sans-serif",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-brand)"; e.currentTarget.style.boxShadow = "0 0 0 3px #FF6B3520"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border-default)"; e.currentTarget.style.boxShadow = "none"; }}
          />
        </div>
      </div>

      {/* Table card */}
      <div
        className="overflow-hidden"
        style={{ background: "var(--color-surface-card)", border: "1.5px solid var(--color-border-default)", borderRadius: 12 }}
      >
        <div
          className="px-5 py-3"
          style={{ background: "var(--color-surface-muted)", borderBottom: "1.5px solid var(--color-border-default)" }}
        >
          <h3 style={{ fontFamily: "Oswald, sans-serif", fontWeight: 600, fontSize: 15, color: "var(--color-text-primary)" }}>
            Classes ({classes?.pagination?.total || 0})
          </h3>
        </div>

        <div className="p-4">
          {classes && classes.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1.5px solid var(--color-border-default)", background: "var(--color-surface-muted)" }}>
                    <th className="text-left p-3 text-xs uppercase tracking-widest" style={{ color: "var(--color-text-muted)", fontWeight: 500, fontFamily: "Plus Jakarta Sans, sans-serif", letterSpacing: "0.06em" }}>Name</th>
                    <th className="text-left p-3 text-xs uppercase tracking-widest" style={{ color: "var(--color-text-muted)", fontWeight: 500, fontFamily: "Plus Jakarta Sans, sans-serif", letterSpacing: "0.06em" }}>Creator</th>
                    <th className="text-left p-3 text-xs uppercase tracking-widest" style={{ color: "var(--color-text-muted)", fontWeight: 500, fontFamily: "Plus Jakarta Sans, sans-serif", letterSpacing: "0.06em" }}>Members</th>
                    <th className="text-left p-3 text-xs uppercase tracking-widest" style={{ color: "var(--color-text-muted)", fontWeight: 500, fontFamily: "Plus Jakarta Sans, sans-serif", letterSpacing: "0.06em" }}>Teachers</th>
                    <th className="text-left p-3 text-xs uppercase tracking-widest" style={{ color: "var(--color-text-muted)", fontWeight: 500, fontFamily: "Plus Jakarta Sans, sans-serif", letterSpacing: "0.06em" }}>Sessions</th>
                    <th className="text-left p-3 text-xs uppercase tracking-widest" style={{ color: "var(--color-text-muted)", fontWeight: 500, fontFamily: "Plus Jakarta Sans, sans-serif", letterSpacing: "0.06em" }}>Invite Code</th>
                    <th className="text-right p-3 text-xs uppercase tracking-widest" style={{ color: "var(--color-text-muted)", fontWeight: 500, fontFamily: "Plus Jakarta Sans, sans-serif", letterSpacing: "0.06em" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.data.map((classItem) => (
                    <tr
                      key={classItem.id}
                      style={{ borderBottom: "1px solid var(--color-border-default)" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--color-surface-subtle)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                    >
                      <td className="p-3">
                        <div>
                          <div className="font-medium" style={{ color: "var(--color-text-primary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>{classItem.name}</div>
                          <div className="text-sm" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>{classItem.description}</div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div>
                          <div className="font-medium" style={{ color: "var(--color-text-primary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>{classItem.creator.full_name}</div>
                          <div className="text-sm" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>{classItem.creator.email}</div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: "var(--color-surface-subtle)", border: "1px solid var(--color-border-default)", color: "var(--color-text-secondary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
                        >
                          {classItem._count.members}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: "var(--color-surface-subtle)", border: "1px solid var(--color-border-default)", color: "var(--color-text-secondary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
                        >
                          {classItem._count.teachers}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: "var(--color-surface-subtle)", border: "1px solid var(--color-border-default)", color: "var(--color-text-secondary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
                        >
                          {classItem._count.sessions}
                        </span>
                      </td>
                      <td className="p-3">
                        <code
                          className="px-2 py-0.5 rounded text-xs"
                          style={{ background: "var(--color-surface-subtle)", border: "1px solid var(--color-border-default)", fontFamily: "JetBrains Mono, monospace", color: "var(--color-text-primary)" }}
                        >
                          {classItem.invite_code}
                        </code>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/admin/classes/${classItem.id}`}>
                            <button className="p-1.5 rounded-lg" style={{ background: "var(--color-surface-muted)", border: "1px solid var(--color-border-default)", color: "var(--color-text-secondary)" }}>
                              <Eye className="w-4 h-4" />
                            </button>
                          </Link>
                          <button onClick={() => handleEdit(classItem)} className="p-1.5 rounded-lg" style={{ background: "var(--color-surface-muted)", border: "1px solid var(--color-border-default)", color: "var(--color-text-secondary)" }}>
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(classItem.id)} className="p-1.5 rounded-lg" style={{ background: "#fee2e2", border: "1px solid #fecaca", color: "var(--color-error)" }}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-sm" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>No classes found</div>
          )}

          {classes && classes.pagination && classes.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                style={{ background: "var(--color-surface-card)", border: "1.5px solid var(--color-border-default)", color: "var(--color-text-primary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
              >
                Previous
              </button>
              <span className="text-sm" style={{ color: "var(--color-text-secondary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                Page {page} of {classes.pagination.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(classes.pagination.totalPages, p + 1))}
                disabled={page >= classes.pagination.totalPages}
                className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                style={{ background: "var(--color-surface-card)", border: "1.5px solid var(--color-border-default)", color: "var(--color-text-primary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Class</DialogTitle>
            <DialogDescription>Create a new class</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <input
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
                }}
                placeholder="Class name"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none mt-1"
                style={{
                  background: "var(--color-surface-card)",
                  border: formErrors.name ? "1.5px solid var(--color-error)" : "1.5px solid var(--color-border-default)",
                  color: "var(--color-text-primary)",
                  fontFamily: "Plus Jakarta Sans, sans-serif",
                }}
              />
              {formErrors.name && (
                <p className="text-sm mt-1" style={{ color: "var(--color-error)" }}>{formErrors.name}</p>
              )}
            </div>
            <div>
              <Label>Description *</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => {
                  setFormData({ ...formData, description: e.target.value });
                  if (formErrors.description) setFormErrors({ ...formErrors, description: undefined });
                }}
                placeholder="Class description"
                className={formErrors.description ? "border-red-500" : ""}
              />
              {formErrors.description && (
                <p className="text-sm mt-1" style={{ color: "var(--color-error)" }}>{formErrors.description}</p>
              )}
            </div>
            <div>
              <Label>Price (VND) (optional)</Label>
              <input
                value={formData.price}
                inputMode="numeric"
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="e.g. 500000"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none mt-1"
                style={{
                  background: "var(--color-surface-card)",
                  border: "1.5px solid var(--color-border-default)",
                  color: "var(--color-text-primary)",
                  fontFamily: "Plus Jakarta Sans, sans-serif",
                }}
              />
              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                Leave empty for free class
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.is_group}
                onCheckedChange={(checked) => setFormData({ ...formData, is_group: checked })}
              />
              <Label>Group Class</Label>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowCreateDialog(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: "var(--color-surface-card)", border: "1.5px solid var(--color-border-default)", color: "var(--color-text-primary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: "var(--color-brand)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
            >
              Create
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Class</DialogTitle>
            <DialogDescription>Update class information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <input
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
                }}
                placeholder="Class name"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none mt-1"
                style={{
                  background: "var(--color-surface-card)",
                  border: formErrors.name ? "1.5px solid var(--color-error)" : "1.5px solid var(--color-border-default)",
                  color: "var(--color-text-primary)",
                  fontFamily: "Plus Jakarta Sans, sans-serif",
                }}
              />
              {formErrors.name && (
                <p className="text-sm mt-1" style={{ color: "var(--color-error)" }}>{formErrors.name}</p>
              )}
            </div>
            <div>
              <Label>Description *</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => {
                  setFormData({ ...formData, description: e.target.value });
                  if (formErrors.description) setFormErrors({ ...formErrors, description: undefined });
                }}
                placeholder="Class description"
                className={formErrors.description ? "border-red-500" : ""}
              />
              {formErrors.description && (
                <p className="text-sm mt-1" style={{ color: "var(--color-error)" }}>{formErrors.description}</p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.is_group}
                onCheckedChange={(checked) => setFormData({ ...formData, is_group: checked })}
              />
              <Label>Group Class</Label>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowEditDialog(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: "var(--color-surface-card)", border: "1.5px solid var(--color-border-default)", color: "var(--color-text-primary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
            >
              Cancel
            </button>
            <button
              onClick={handleUpdate}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: "var(--color-brand)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
            >
              Update
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
