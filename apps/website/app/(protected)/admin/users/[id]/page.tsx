"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getUserById, updateUserProfile, banUser, unbanUser } from "@/services/user.service";
import { UserProfile, UpdateUserProfileRequest } from "@/types/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Ban, CheckCircle, Calendar } from "lucide-react";
import LoadingScreen from "@/components/loading-screen";
import Image from "next/image";
import DefaultAvatar from "@/assets/default-avatar.png";
import Link from "next/link";

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<UpdateUserProfileRequest>({
    fullName: "",
    role: "STUDENT",
    isActive: true,
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await getUserById(userId);
        setUser(data);
        setFormData({
          fullName: data.fullName || "",
          role: data.role,
          isActive: data.isActive,
        });
      } catch (error) {
        console.error("Error fetching user:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [userId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUserProfile(userId, formData);
      const updated = await getUserById(userId);
      setUser(updated);
      alert("User updated successfully");
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const handleBan = async () => {
    if (!confirm("Are you sure you want to ban this user?")) return;
    try {
      await banUser(userId);
      const updated = await getUserById(userId);
      setUser(updated);
      setFormData({ ...formData, isActive: false });
    } catch (error) {
      console.error("Error banning user:", error);
      alert("Failed to ban user");
    }
  };

  const handleUnban = async () => {
    if (!confirm("Are you sure you want to unban this user?")) return;
    try {
      await unbanUser(userId);
      const updated = await getUserById(userId);
      setUser(updated);
      setFormData({ ...formData, isActive: true });
    } catch (error) {
      console.error("Error unbanning user:", error);
      alert("Failed to unban user");
    }
  };

  if (loading) return <LoadingScreen />;
  if (!user) return <div>User not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Details</h1>
          <p className="text-gray-600 mt-2">Edit user information and permissions</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-100 shrink-0">
              <Image
                src={user.avatarUrl || DefaultAvatar}
                alt="User avatar"
                width={56}
                height={56}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">
                {user.fullName || user.email}
              </div>
              <div className="text-sm text-gray-500">{user.email}</div>
            </div>
          </div>

          <div>
            <Label>Email</Label>
            <Input value={user.email} disabled />
            <p className="text-sm text-gray-500 mt-1">Email cannot be changed</p>
          </div>

          <div>
            <Label>Full Name</Label>
            <Input
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            />
          </div>

          <div>
            <Label>Role</Label>
            <Select
              value={formData.role}
              onValueChange={(value: "ADMIN" | "STUDENT" | "TEACHER") =>
                setFormData({ ...formData, role: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="TEACHER">Teacher</SelectItem>
                <SelectItem value="STUDENT">Student</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Status</Label>
            <div className="flex items-center gap-4">
              <Badge variant={user.isActive ? "default" : "destructive"}>
                {user.isActive ? "Active" : "Banned"}
              </Badge>
              {user.isActive ? (
                <Button variant="destructive" onClick={handleBan}>
                  <Ban className="w-4 h-4 mr-2" />
                  Ban User
                </Button>
              ) : (
                <Button variant="default" onClick={handleUnban}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Unban User
                </Button>
              )}
            </div>
          </div>

          <div>
            <Label>Date joined</Label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={new Date(user.createdAt).toLocaleString()}
                disabled
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Classes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded p-3">
              <div className="font-medium text-gray-900">
                Created ({user.classes?.created?.length || 0})
              </div>
              <div className="mt-2 space-y-1">
                {(user.classes?.created || []).slice(0, 10).map((c) => (
                  <Link
                    key={c.id}
                    href={`/admin/classes/${c.id}`}
                    className="block text-sm text-blue-600 hover:underline"
                  >
                    {c.name}
                  </Link>
                ))}
                {(user.classes?.created?.length || 0) === 0 && (
                  <div className="text-sm text-gray-500">—</div>
                )}
              </div>
            </div>

            <div className="border rounded p-3">
              <div className="font-medium text-gray-900">
                Teaching ({user.classes?.teaching?.length || 0})
              </div>
              <div className="mt-2 space-y-1">
                {(user.classes?.teaching || []).slice(0, 10).map((c) => (
                  <Link
                    key={c.id}
                    href={`/admin/classes/${c.id}`}
                    className="block text-sm text-blue-600 hover:underline"
                  >
                    {c.name}
                  </Link>
                ))}
                {(user.classes?.teaching?.length || 0) === 0 && (
                  <div className="text-sm text-gray-500">—</div>
                )}
              </div>
            </div>

            <div className="border rounded p-3">
              <div className="font-medium text-gray-900">
                Enrolled ({user.classes?.enrolled?.length || 0})
              </div>
              <div className="mt-2 space-y-1">
                {(user.classes?.enrolled || []).slice(0, 10).map((c) => (
                  <Link
                    key={c.id}
                    href={`/admin/classes/${c.id}`}
                    className="block text-sm text-blue-600 hover:underline"
                  >
                    {c.name}
                  </Link>
                ))}
                {(user.classes?.enrolled?.length || 0) === 0 && (
                  <div className="text-sm text-gray-500">—</div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

