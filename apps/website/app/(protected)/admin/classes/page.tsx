"use client";

import { useEffect, useState } from "react";
import { getAllClasses, type PaginatedClassResponse, updateClassAdmin, deleteClassAdmin, createClass, getClassById } from "@/services/class.service";
import type { ClassData, ClassDetail } from "@/types/class";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Eye, Trash2, Plus, Edit } from "lucide-react";
import Link from "next/link";
import LoadingScreen from "@/components/loading-screen";
import { Badge } from "@/components/ui/badge";
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
  const [formData, setFormData] = useState({ name: "", description: "", is_group: false });
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
      await createClass({
        name: formData.name.trim(),
        description: formData.description.trim(),
        is_group: formData.is_group,
      });
      setShowCreateDialog(false);
      setFormData({ name: "", description: "", is_group: false });
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
      });
    } catch (error) {
      console.error("Error fetching class details:", error);
      // Fallback to basic data
      setFormData({
        name: classItem.name,
        description: classItem.description || "",
        is_group: false,
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
      setFormData({ name: "", description: "", is_group: false });
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
          <h1 className="text-3xl font-bold text-gray-900">Classes Management</h1>
          <p className="text-gray-600 mt-2">View and manage all classes</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Class
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search classes by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Classes ({classes?.pagination?.total || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {classes && classes.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Name</th>
                    <th className="text-left p-3">Creator</th>
                    <th className="text-left p-3">Members</th>
                    <th className="text-left p-3">Teachers</th>
                    <th className="text-left p-3">Sessions</th>
                    <th className="text-left p-3">Invite Code</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.data.map((classItem) => (
                    <tr key={classItem.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <div>
                          <div className="font-medium">{classItem.name}</div>
                          <div className="text-sm text-gray-500">{classItem.description}</div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div>
                          <div className="font-medium">{classItem.creator.full_name}</div>
                          <div className="text-sm text-gray-500">{classItem.creator.email}</div>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge>{classItem._count.members}</Badge>
                      </td>
                      <td className="p-3">
                        <Badge>{classItem._count.teachers}</Badge>
                      </td>
                      <td className="p-3">
                        <Badge>{classItem._count.sessions}</Badge>
                      </td>
                      <td className="p-3">
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">{classItem.invite_code}</code>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/admin/classes/${classItem.id}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="w-4 h-4 mr-2" />
                              View
                            </Button>
                          </Link>
                          <Button variant="outline" size="sm" onClick={() => handleEdit(classItem)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(classItem.id)}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">No classes found</div>
          )}

          {classes && classes.pagination && classes.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {page} of {classes.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.min(classes.pagination.totalPages, p + 1))}
                disabled={page >= classes.pagination.totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
              <Input
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
                }}
                placeholder="Class name"
                className={formErrors.name ? "border-red-500" : ""}
              />
              {formErrors.name && (
                <p className="text-sm text-red-500 mt-1">{formErrors.name}</p>
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
                <p className="text-sm text-red-500 mt-1">{formErrors.description}</p>
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
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create</Button>
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
              <Input
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
                }}
                placeholder="Class name"
                className={formErrors.name ? "border-red-500" : ""}
              />
              {formErrors.name && (
                <p className="text-sm text-red-500 mt-1">{formErrors.name}</p>
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
                <p className="text-sm text-red-500 mt-1">{formErrors.description}</p>
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
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdate}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
