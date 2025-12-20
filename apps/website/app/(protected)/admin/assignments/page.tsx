"use client";

import { useEffect, useState } from "react";
import { getAssignmentsBySkill, deleteAssignment, updateAssignment } from "@/services/assignment.service";
import type { PaginatedAssignmentResponse, AssignmentOverview } from "@/types/assignment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Trash2, Search, Plus, Edit } from "lucide-react";
import Link from "next/link";
import LoadingScreen from "@/components/loading-screen";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type Skill = "reading" | "listening" | "writing" | "speaking";

export default function AdminAssignmentsPage() {
  const [activeSkill, setActiveSkill] = useState<Skill>("reading");
  const [assignments, setAssignments] = useState<PaginatedAssignmentResponse | AssignmentOverview[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(8);
  const [searchQuery, setSearchQuery] = useState("");

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editing, setEditing] = useState<AssignmentOverview | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const data = await getAssignmentsBySkill(activeSkill, { page, limit });
      setAssignments(data);
    } catch (error) {
      console.error("Error fetching assignments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSkill, page]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (page === 1) {
        fetchAssignments();
      } else {
        setPage(1);
      }
    }, 500);
    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this assignment?")) return;
    try {
      await deleteAssignment(activeSkill, id);
      fetchAssignments();
    } catch (error) {
      console.error("Error deleting assignment:", error);
      alert("Failed to delete assignment");
    }
  };

  const openEdit = (assignment: AssignmentOverview) => {
    setEditing(assignment);
    setEditTitle(assignment.title || "");
    setEditDescription(assignment.description || "");
    setShowEditDialog(true);
  };

  const handleUpdate = async () => {
    if (!editing) return;
    setUpdating(true);
    try {
      const payload: Record<string, unknown> = { title: editTitle };
      // speaking assignments don't have description in the DTO; avoid sending it
      if (activeSkill !== "speaking") payload.description = editDescription;
      await updateAssignment(activeSkill, editing.id, payload);
      setShowEditDialog(false);
      setEditing(null);
      fetchAssignments();
    } catch (error) {
      console.error("Error updating assignment:", error);
      alert("Failed to update assignment");
    } finally {
      setUpdating(false);
    }
  };

  if (loading && !assignments) return <LoadingScreen />;

  const assignmentsList = Array.isArray(assignments) ? assignments : assignments?.data || [];
  const pagination = Array.isArray(assignments) ? null : assignments?.pagination;
  
  // Filter assignments by search query
  const filteredAssignments = searchQuery.trim()
    ? assignmentsList.filter((a: AssignmentOverview) =>
        a.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : assignmentsList;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Assignments Management</h1>
          <p className="text-gray-600 mt-2">View and manage assignments across all skills</p>
        </div>
        <Link href="/assignment/create">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create Assignment
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search assignments by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeSkill} onValueChange={(v) => {
        setActiveSkill(v as Skill);
        setPage(1);
        setSearchQuery("");
      }}>
        <TabsList>
          <TabsTrigger value="reading">Reading</TabsTrigger>
          <TabsTrigger value="listening">Listening</TabsTrigger>
          <TabsTrigger value="writing">Writing</TabsTrigger>
          <TabsTrigger value="speaking">Speaking</TabsTrigger>
        </TabsList>

        <TabsContent value={activeSkill}>
          <Card>
            <CardHeader>
              <CardTitle>
                {activeSkill.charAt(0).toUpperCase() + activeSkill.slice(1)} Assignments
                {pagination && ` (${pagination.total})`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredAssignments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3">Name</th>
                        <th className="text-left p-3">Created</th>
                        <th className="text-right p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAssignments.map((assignment: AssignmentOverview) => (
                        <tr key={assignment.id} className="border-b hover:bg-gray-50">
                          <td className="p-3">
                            <div className="font-medium">{assignment.title || "Untitled"}</div>
                            {assignment.description && (
                              <div className="text-sm text-gray-500">{assignment.description}</div>
                            )}
                          </td>
                          <td className="p-3">
                            {assignment.created_at ? (
                              new Date(assignment.created_at).toLocaleDateString()
                            ) : (
                              "N/A"
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-end gap-2">
                              <Link href={`/assignment/${activeSkill}/${assignment.id}`}>
                                <Button variant="outline" size="sm">
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </Link>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEdit(assignment)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(assignment.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">No assignments found</div>
              )}

              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={page >= pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Assignment</DialogTitle>
            <DialogDescription>
              Update basic fields for this assignment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>

            {activeSkill !== "speaking" && (
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={updating}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updating || !editTitle.trim()}>
              {updating ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

