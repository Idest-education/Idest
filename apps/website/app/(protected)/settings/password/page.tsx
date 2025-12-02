"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function PasswordSettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast.error("Please fill all required fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password should be at least 6 characters");
      return;
    }

    try {
      setIsSubmitting(true);

      if (currentPassword) {
        const {
          data: { user },
          error: sessionError,
        } = await supabase.auth.getUser();
        if (sessionError || !user) {
          throw sessionError || new Error("Not authenticated");
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email ?? "",
          password: currentPassword,
        });
        if (signInError) {
          throw signInError;
        }
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      router.push("/settings/profile");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Change password</h1>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter a strong password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Updating..." : "Update password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


