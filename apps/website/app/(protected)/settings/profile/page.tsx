"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUser, updateUserProfile, deleteOwnAccount } from "@/services/user.service";
import type {
  UserProfile,
} from "@/types/user";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function ProfileSettingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      try {
        const profile = await getCurrentUser();
        setUser(profile);
        setName(profile.fullName || "");
      } catch (error) {
        console.error(error);
        toast.error("Không thể tải hồ sơ");
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
      toast.success("Hồ sơ đã được cập nhật");
    } catch (error) {
      console.error(error);
      toast.error("Không thể cập nhật hồ sơ");
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
      toast.success("Ảnh đại diện đã được cập nhật");
    } catch (error) {
      console.error(error);
      toast.error("Không thể tải ảnh đại diện");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa tài khoản? Hành động này không thể hoàn tác.")) {
      return;
    }
    try {
      setIsDeleting(true);
      await deleteOwnAccount();
      await supabase.auth.signOut();
      toast.success("Tài khoản đã được xóa");
      router.push("/auth/login");
    } catch (error) {
      console.error(error);
      toast.error("Không thể xóa tài khoản");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-sm text-gray-500">Đang tải hồ sơ...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-gray-700 text-sm">Không có dữ liệu người dùng.</p>
        <Button onClick={() => router.push("/auth/login")}>Đi đến đăng nhập</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-10 space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Cài đặt hồ sơ</h1>

      <Card>
        <CardHeader>
          <CardTitle>Hồ sơ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6 border-b border-gray-200 pb-6">
            <div className="h-20 w-20 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-2xl font-semibold text-gray-700">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt={user.fullName || user.email}
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
              <Label htmlFor="avatar">Ảnh đại diện</Label>
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
              <Label htmlFor="name">Họ và tên</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tên của bạn"
                disabled={!isEditingProfile}
              />
            </div>
            <div className="space-y-2">
              <Label>Thư điện tử</Label>
              <Input value={user.email} disabled />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Vai trò</Label>
              <Input value={user.role} disabled />
            </div>
            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <Input value={user.isActive ? "Hoạt động" : "Không hoạt động"} disabled />
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
                  Hủy
                </Button>
                <Button onClick={handleSaveProfile} disabled={isSaving}>
                  {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                type="button"
                onClick={() => setIsEditingProfile(true)}
              >
                Chỉnh sửa hồ sơ
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Khu vực nguy hiểm</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Xóa tài khoản của bạn sẽ đăng xuất và vô hiệu hóa hồ sơ của bạn. Hành động này
            không thể hoàn tác.
          </p>
          <Button
            variant="destructive"
            onClick={handleDeleteAccount}
            disabled={isDeleting}
          >
            {isDeleting ? "Đang xóa..." : "Xóa tài khoản của tôi"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}


