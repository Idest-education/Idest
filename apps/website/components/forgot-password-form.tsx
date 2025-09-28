"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState } from "react";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      // The url which will be included in the email. This URL needs to be configured in your redirect URLs in the Supabase dashboard at https://supabase.com/dashboard/project/_/auth/url-configuration
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      setSuccess(true);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Đã xảy ra lỗi");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-20 h-20 bg-purple-200 rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute top-40 right-20 w-16 h-16 bg-indigo-200 rounded-full opacity-20 animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute bottom-40 left-20 w-24 h-24 bg-blue-200 rounded-full opacity-20 animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute bottom-20 right-40 w-18 h-18 bg-purple-200 rounded-full opacity-20 animate-pulse" style={{animationDelay: '3s'}}></div>
      </div>

      {/* Header Logo */}
      <div className="mb-8 text-center relative z-10">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-16 h-16 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-2xl">
            🔑
          </div>
          <div className="flex flex-col">
            <span className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              EnglishMaster
            </span>
            <span className="text-sm text-gray-500 font-medium">
              Learn • Practice • Excel
            </span>
          </div>
        </div>
        <p className="text-gray-600 text-lg">
          {success ? "Kiểm tra email của bạn! 📧" : "Khôi phục mật khẩu 🔐"}
        </p>
      </div>

      {/* Form Card */}
      <Card className="w-full max-w-md bg-white/80 backdrop-blur-sm border-indigo-100 shadow-2xl relative z-10">
        {success ? (
          <>
            <CardHeader className="text-center pb-4">
              <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-2xl mx-auto mb-4">
                ✉️
              </div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                Kiểm tra email
              </CardTitle>
              <CardDescription className="text-gray-600">
                Hướng dẫn đặt lại mật khẩu đã được gửi
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700 flex items-center gap-2 justify-center">
                  <span>✅</span>
                  Nếu bạn đã đăng ký bằng email và mật khẩu, bạn sẽ nhận được email khôi phục mật khẩu.
                </p>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-800">Bước tiếp theo:</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold">1.</span>
                    <span>Mở email từ EnglishMaster</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold">2.</span>
                    <span>Nhấp vào liên kết trong email</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-indigo-600 font-bold">3.</span>
                    <span>Tạo mật khẩu mới</span>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Link
                  href="/auth/login"
                  className="inline-flex items-center gap-2 text-indigo-600 hover:text-purple-600 hover:underline underline-offset-4 transition-colors duration-200 font-medium"
                >
                  <span>🔙</span>
                  <span>Quay lại trang đăng nhập</span>
                </Link>
              </div>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Đặt lại mật khẩu
              </CardTitle>
              <CardDescription className="text-gray-600">
                Nhập email của bạn và chúng tôi sẽ gửi liên kết khôi phục mật khẩu
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgotPassword}>
                <div className="flex flex-col gap-6">
                  <div className="grid gap-3">
                    <Label htmlFor="email" className="text-gray-700 font-medium">
                      📧 Email đã đăng ký
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your-email@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 text-gray-700 border-indigo-200 focus:border-indigo-500 focus:ring-indigo-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
                    />
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <span>💡</span>
                      Nhập email bạn đã sử dụng để đăng ký tài khoản
                    </p>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-600 flex items-center gap-2">
                        <span>⚠️</span>
                        {error}
                      </p>
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Đang gửi...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>📤</span>
                        <span>Gửi email khôi phục</span>
                      </div>
                    )}
                  </Button>
                </div>

                <div className="mt-6 text-center">
                  <p className="text-gray-600">
                    Nhớ lại mật khẩu?{" "}
                    <Link
                      href="/auth/login"
                      className="font-semibold text-indigo-600 hover:text-purple-600 hover:underline underline-offset-4 transition-colors duration-200"
                    >
                      Đăng nhập ngay
                    </Link>
                  </p>
                </div>
              </form>
            </CardContent>
          </>
        )}
      </Card>

      {/* Floating elements */}
      <div className="absolute top-10 right-10 opacity-30 animate-bounce" style={{animationDelay: '0.5s'}}>
        <div className="text-4xl">🔐</div>
      </div>
      <div className="absolute bottom-10 left-10 opacity-30 animate-bounce" style={{animationDelay: '1.5s'}}>
        <div className="text-4xl">🔑</div>
      </div>
    </div>
  );
}