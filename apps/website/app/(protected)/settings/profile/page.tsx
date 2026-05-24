"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUser, updateUserProfile, deleteOwnAccount } from "@/services/user.service";
import type { UserProfile } from "@/types/user";
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
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);

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
    if (!window.confirm("Bạn có chắc chắn muốn xóa tài khoản? Hành động này không thể hoàn tác.")) return;
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
        <span className="text-sm" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
          Đang tải hồ sơ...
        </span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-sm" style={{ color: "var(--color-text-secondary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
          Không có dữ liệu người dùng.
        </p>
        <button
          onClick={() => router.push("/auth/login")}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: "var(--color-brand)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
        >
          Đi đến đăng nhập
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-10 space-y-6" style={{ background: "var(--color-surface-app)" }}>
      <h1
        style={{
          fontFamily: "Oswald, sans-serif",
          fontWeight: 700,
          fontSize: 28,
          color: "var(--color-text-primary)",
        }}
      >
        Cài đặt hồ sơ
      </h1>

      {/* Profile card */}
      <div
        className="overflow-hidden"
        style={{
          background: "var(--color-surface-card)",
          border: "1.5px solid var(--color-border-default)",
          borderRadius: 16,
        }}
      >
        {/* Card header */}
        <div
          className="px-6 py-4"
          style={{
            background: "var(--color-surface-subtle)",
            borderBottom: "1.5px solid var(--color-border-default)",
          }}
        >
          <h2
            style={{
              fontFamily: "Oswald, sans-serif",
              fontWeight: 600,
              fontSize: 17,
              color: "var(--color-text-primary)",
            }}
          >
            Hồ sơ
          </h2>
        </div>

        <div className="p-6 space-y-6">
          {/* Avatar section */}
          <div
            className="flex items-center gap-6 pb-6"
            style={{ borderBottom: "1.5px solid var(--color-border-default)" }}
          >
            <div
              className="h-[72px] w-[72px] rounded-full overflow-hidden flex items-center justify-center text-2xl font-bold flex-shrink-0"
              style={{
                background: "var(--color-surface-subtle)",
                border: "2.5px solid var(--color-border-default)",
              }}
            >
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt={user.fullName || user.email} className="h-full w-full object-cover" />
              ) : (
                <span style={{ fontFamily: "Oswald, sans-serif", color: "var(--color-brand)" }}>
                  {((user.fullName && user.fullName.length > 0 ? user.fullName : user.email && user.email.length > 0 ? user.email : "U").charAt(0) || "U").toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ fontFamily: "Oswald, sans-serif", fontWeight: 600, fontSize: 18, color: "var(--color-text-primary)" }}>
                {user.fullName || user.email}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                {user.role} · {user.isActive ? "Hoạt động" : "Không hoạt động"}
              </p>
            </div>
            <div>
              <label
                htmlFor="avatar"
                className="cursor-pointer px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{
                  background: "var(--color-surface-card)",
                  border: "1.5px solid var(--color-border-default)",
                  color: "var(--color-text-primary)",
                  fontFamily: "Plus Jakarta Sans, sans-serif",
                  opacity: (!isEditingProfile) ? 0.5 : 1,
                  pointerEvents: (!isEditingProfile) ? "none" : "auto",
                }}
              >
                Đổi ảnh
              </label>
              <input
                id="avatar"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                disabled={isUploading || !isEditingProfile}
                className="sr-only"
              />
            </div>
          </div>

          {/* Form fields */}
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { id: "name", label: "Họ và tên", value: name, disabled: !isEditingProfile, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value), placeholder: "Tên của bạn" },
              { id: "email", label: "Thư điện tử", value: user.email, disabled: true, onChange: undefined, placeholder: "" },
              { id: "role", label: "Vai trò", value: user.role, disabled: true, onChange: undefined, placeholder: "" },
              { id: "status", label: "Trạng thái", value: user.isActive ? "Hoạt động" : "Không hoạt động", disabled: true, onChange: undefined, placeholder: "" },
            ].map(({ id, label, value, disabled, onChange, placeholder }) => (
              <div key={id} className="space-y-1.5">
                <label
                  htmlFor={id}
                  className="block text-xs uppercase tracking-widest"
                  style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif", letterSpacing: "0.06em" }}
                >
                  {label}
                </label>
                <input
                  id={id}
                  value={value}
                  disabled={disabled}
                  onChange={onChange}
                  placeholder={placeholder}
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                  style={{
                    background: disabled ? "var(--color-surface-muted)" : "var(--color-surface-card)",
                    border: "1.5px solid var(--color-border-default)",
                    color: disabled ? "var(--color-text-muted)" : "var(--color-text-primary)",
                    fontFamily: "Plus Jakarta Sans, sans-serif",
                  }}
                  onFocus={(e) => {
                    if (!disabled) {
                      e.currentTarget.style.borderColor = "var(--color-brand)";
                      e.currentTarget.style.boxShadow = "0 0 0 3px #FF6B3520";
                    }
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--color-border-default)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            {isEditingProfile ? (
              <>
                <button
                  type="button"
                  onClick={() => { setIsEditingProfile(false); if (user) setName(user.fullName || ""); }}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{
                    background: "var(--color-surface-card)",
                    border: "1.5px solid var(--color-border-default)",
                    color: "var(--color-text-primary)",
                    fontFamily: "Plus Jakarta Sans, sans-serif",
                  }}
                >
                  Hủy
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: "var(--color-brand)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
                >
                  {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingProfile(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{
                  background: "var(--color-surface-card)",
                  border: "1.5px solid var(--color-border-default)",
                  color: "var(--color-text-primary)",
                  fontFamily: "Plus Jakarta Sans, sans-serif",
                }}
              >
                Chỉnh sửa hồ sơ
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div
        className="overflow-hidden"
        style={{
          background: "#fff5f5",
          border: "1.5px solid #fecaca",
          borderRadius: 16,
        }}
      >
        <div
          className="px-6 py-4"
          style={{ background: "#fee2e2", borderBottom: "1.5px solid #fecaca" }}
        >
          <h2
            style={{
              fontFamily: "Oswald, sans-serif",
              fontWeight: 600,
              fontSize: 17,
              color: "var(--color-error)",
            }}
          >
            Khu vực nguy hiểm
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
            Xóa tài khoản của bạn sẽ đăng xuất và vô hiệu hóa hồ sơ của bạn. Hành động này không thể hoàn tác.
          </p>
          <button
            onClick={handleDeleteAccount}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--color-error)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
          >
            {isDeleting ? "Đang xóa..." : "Xóa tài khoản của tôi"}
          </button>
        </div>
      </div>
    </div>
  );
}
