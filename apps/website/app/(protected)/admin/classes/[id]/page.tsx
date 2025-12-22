"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getClassById,
  getClassMembers,
  getClassTeachers,
  regenerateInviteCode,
  addStudentToClass,
  removeStudentFromClass,
  type UserSummary,
} from "@/services/class.service";
import { ClassDetail } from "@/types/class";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, RefreshCw, UserPlus, UserMinus, Search } from "lucide-react";
import LoadingScreen from "@/components/loading-screen";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { searchUsers } from "@/services/user.service";

export default function ClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.id as string;
  const [classData, setClassData] = useState<ClassDetail | null>(null);
  const [members, setMembers] = useState<UserSummary[]>([]);
  const [teachers, setTeachers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSummary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [classRes, membersRes, teachersRes] = (await Promise.all([
          getClassById(classId),
          getClassMembers(classId),
          getClassTeachers(classId),
        ])) as [ClassDetail, UserSummary[], UserSummary[]];
        // Response is already unwrapped
        setClassData(classRes);
        setMembers(membersRes);
        setTeachers(teachersRes);
      } catch (error) {
        console.error("Error fetching class data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [classId]);

  useEffect(() => {
    const debounce = setTimeout(async () => {
      if (searchQuery.trim()) {
        try {
          const results = await searchUsers(searchQuery);
          setSearchResults(results);
        } catch (error) {
          console.error("Error searching users:", error);
        }
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleRegenerateCode = async () => {
    if (!confirm("Are you sure you want to regenerate the invite code?")) return;
    try {
      const newCode = await regenerateInviteCode(classId);
      if (classData) {
        setClassData({ ...classData, invite_code: newCode });
      }
      alert("Invite code regenerated successfully");
    } catch (error) {
      console.error("Error regenerating code:", error);
      alert("Failed to regenerate invite code");
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    try {
      await addStudentToClass(classId, selectedUserId);
      const updatedMembers = await getClassMembers(classId);
      setMembers(updatedMembers);
      setShowAddMemberDialog(false);
      setSelectedUserId("");
      setSearchQuery("");
      setSearchResults([]);
    } catch (error) {
      console.error("Error adding member:", error);
      alert("Failed to add member");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;
    try {
      await removeStudentFromClass(classId, memberId);
      const updatedMembers = await getClassMembers(classId);
      setMembers(updatedMembers);
    } catch (error) {
      console.error("Error removing member:", error);
      alert("Failed to remove member");
    }
  };

  if (loading) return <LoadingScreen />;
  if (!classData) return <div>Class not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{classData.name}</h1>
          <p className="text-gray-600 mt-2">{classData.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Class Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Invite Code</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm bg-gray-100 px-3 py-2 rounded font-mono">
                  {classData.invite_code}
                </code>
                <Button variant="outline" size="sm" onClick={handleRegenerateCode}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label>Creator</Label>
              <div>
                <div className="font-medium">{classData.creator.full_name}</div>
                <div className="text-sm text-gray-500">{classData.creator.email}</div>
              </div>
            </div>
            <div>
              <Label>Statistics</Label>
              <div className="flex gap-4">
                <Badge>Members: {classData._count.members}</Badge>
                <Badge>Teachers: {classData._count.teachers}</Badge>
                <Badge>Sessions: {classData._count.sessions}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Teachers</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {teachers.length > 0 ? (
              <div className="space-y-2">
                {teachers.map((teacher) => (
                  <div key={teacher.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <div className="font-medium">{teacher.full_name}</div>
                      <div className="text-sm text-gray-500">{teacher.email}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">No teachers</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Members ({members.length})</CardTitle>
            <Button onClick={() => setShowAddMemberDialog(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Add Member
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {members.length > 0 ? (
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 border rounded hover:bg-gray-50">
                  <div>
                    <div className="font-medium">{member.full_name}</div>
                    <div className="text-sm text-gray-500">{member.email}</div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemoveMember(member.id)}
                  >
                    <UserMinus className="w-4 h-4 mr-2" />
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">No members</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
            <DialogDescription>
              Search for a user to add to this class.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Search Users</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              {searchResults.length > 0 && (
                <div className="mt-2 border rounded max-h-48 overflow-y-auto">
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      className={`p-2 cursor-pointer hover:bg-gray-100 ${
                        selectedUserId === user.id ? "bg-blue-50" : ""
                      }`}
                      onClick={() => setSelectedUserId(user.id)}
                    >
                      <div className="font-medium">{user.full_name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMemberDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddMember} disabled={!selectedUserId}>
              Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

