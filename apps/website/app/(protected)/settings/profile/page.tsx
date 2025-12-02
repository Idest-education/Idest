"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getCurrentUser,
  updateUserProfile,
  deleteOwnAccount,
  createStudentProfile,
} from "@/services/user.service";
import type {
  UserProfile,
  StudentProfile,
  CreateStudentProfileRequest,
} from "@/types/user";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function ProfileSettingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [name, setName] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreatingStudent, setIsCreatingStudent] = useState(false);
  const [studentForm, setStudentForm] = useState<CreateStudentProfileRequest>({
    targetScore: 0,
    currentLevel: "",
  });

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      try {
        const profile = await getCurrentUser();
        setUser(profile);
        setName(profile.fullName || "");
        setStudentProfile(profile.studentProfile ?? null);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load profile");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      setIsSaving(true);
      const updated = await updateUserProfile(user.id, { fullName: name });
      setUser(updated);
      setIsEditingProfile(false);
      toast.success("Profile updated");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      const updated = await updateUserProfile(user.id, { avatar: publicUrl });
      setUser(updated);
      toast.success("Avatar updated");
    } catch (error) {
      console.error(error);
      toast.error("Failed to upload avatar");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      return;
    }
    try {
      setIsDeleting(true);
      await deleteOwnAccount();
      await supabase.auth.signOut();
      toast.success("Account deleted");
      router.push("/auth/login");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete account");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateStudentProfile = async () => {
    if (!studentForm.currentLevel || !studentForm.targetScore) {
      toast.error("Please fill in target score and current level");
      return;
    }

    try {
      setIsCreatingStudent(true);
      const profile = await createStudentProfile(studentForm);
      setStudentProfile(profile);
      toast.success("Student profile created");
    } catch (error) {
      console.error(error);
      toast.error("Failed to create student profile");
    } finally {
      setIsCreatingStudent(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-sm text-gray-500">Loading profile...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-gray-700 text-sm">No user data available.</p>
        <Button onClick={() => router.push("/auth/login")}>Go to login</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-10 space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Profile settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6 border-b border-gray-200 pb-6">
            <div className="h-20 w-20 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-2xl font-semibold text-gray-700">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt={user.name || user.email}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>
                  {(
                    (user.fullName && user.fullName.length > 0
                      ? user.fullName
                      : user.email && user.email.length > 0
                        ? user.email
                        : "U"
                    ).charAt(0) || "U"
                  ).toUpperCase()}
                </span>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatar">Avatar</Label>
              <Input
                id="avatar"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                disabled={isUploading || !isEditingProfile}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 pt-6">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                disabled={!isEditingProfile}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user.email} disabled />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Role</Label>
              <Input value={user.role} disabled />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Input value={user.isActive ? "Active" : "Inactive"} disabled />
            </div>
          </div>

          <div className="flex justify-end">
            {isEditingProfile ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setIsEditingProfile(false);
                    if (user) {
                      setName(user.fullName || "");
                    }
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveProfile} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save changes"}
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                type="button"
                onClick={() => setIsEditingProfile(true)}
              >
                Edit profile
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {user.role === "STUDENT" && (
        <Card>
          <CardHeader>
            <CardTitle>Student profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {studentProfile && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1 text-sm">
                  <p className="font-medium">Target score</p>
                  <p>{studentProfile.targetScore}</p>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="font-medium">Current level</p>
                  <p>{studentProfile.currentLevel}</p>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="targetScore">Target score</Label>
                <Input
                  id="targetScore"
                  type="number"
                  value={studentForm.targetScore || ""}
                  onChange={(e) =>
                    setStudentForm((prev) => ({
                      ...prev,
                      targetScore: Number(e.target.value),
                    }))
                  }
                  placeholder="e.g. 7.5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentLevel">Current level</Label>
                <Input
                  id="currentLevel"
                  value={studentForm.currentLevel}
                  onChange={(e) =>
                    setStudentForm((prev) => ({
                      ...prev,
                      currentLevel: e.target.value,
                    }))
                  }
                  placeholder="e.g. B2"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleCreateStudentProfile} disabled={isCreatingStudent}>
                {isCreatingStudent ? "Creating..." : "Create student profile"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Danger zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Deleting your account will log you out and deactivate your profile. This action
            cannot be undone.
          </p>
          <Button
            variant="destructive"
            onClick={handleDeleteAccount}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete my account"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}


