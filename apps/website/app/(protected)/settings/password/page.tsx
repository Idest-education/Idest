"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
      toast.error("Vui lòng điền tất cả các trường bắt buộc");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Mật khẩu mới không khớp");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    try {
      setIsSubmitting(true);

      if (currentPassword) {
        const { data: { user }, error: sessionError } = await supabase.auth.getUser();
        if (sessionError || !user) throw sessionError || new Error("Chưa được xác thực");

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email ?? "",
          password: currentPassword,
        });
        if (signInError) throw signInError;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast.success("Mật khẩu đã được cập nhật thành công");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      router.push("/settings/profile");
    } catch (error) {
      console.error(error);
      toast.error("Không thể cập nhật mật khẩu");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-10" style={{ background: "var(--color-surface-app)" }}>
      <h1
        className="mb-6"
        style={{
          fontFamily: "Oswald, sans-serif",
          fontWeight: 700,
          fontSize: 28,
          color: "var(--color-text-primary)",
        }}
      >
        Đổi mật khẩu
      </h1>

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
            Mật khẩu
          </h2>
        </div>

        <form className="p-6 space-y-5" onSubmit={handleSubmit}>
          {[
            { id: "currentPassword", label: "Mật khẩu hiện tại", value: currentPassword, setter: setCurrentPassword, autoComplete: "current-password", placeholder: "Nhập mật khẩu hiện tại" },
            { id: "newPassword", label: "Mật khẩu mới", value: newPassword, setter: setNewPassword, autoComplete: "new-password", placeholder: "Nhập mật khẩu mạnh" },
            { id: "confirmPassword", label: "Xác nhận mật khẩu mới", value: confirmPassword, setter: setConfirmPassword, autoComplete: "new-password", placeholder: "Nhập lại mật khẩu mới" },
          ].map(({ id, label, value, setter, autoComplete, placeholder }) => (
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
                type="password"
                autoComplete={autoComplete}
                value={value}
                onChange={(e) => setter(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={{
                  background: "var(--color-surface-card)",
                  border: "1.5px solid var(--color-border-default)",
                  color: "var(--color-text-primary)",
                  fontFamily: "Plus Jakarta Sans, sans-serif",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-brand)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px #FF6B3520";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-border-default)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>
          ))}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--color-brand)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
            >
              {isSubmitting ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
