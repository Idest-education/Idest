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
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Lấy access_token và user_id
      const accessToken = data.session?.access_token;
      const userId = data.user?.id;

      // Lưu vào localStorage
      if (accessToken && userId) {
        localStorage.setItem("access_token", accessToken);
        localStorage.setItem("user_id", userId);
      }

      // Chuyển hướng sau khi login thành công
      router.push("/classes");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-20 h-20 bg-purple-200 rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute top-40 right-20 w-16 h-16 bg-indigo-200 rounded-full opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-40 left-20 w-24 h-24 bg-blue-200 rounded-full opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute bottom-20 right-40 w-18 h-18 bg-purple-200 rounded-full opacity-20 animate-pulse" style={{ animationDelay: '3s' }}></div>
      </div>

      {/* Header Logo */}
      <div className="mb-8 text-center relative z-10">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-16 h-16 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-2xl">
            📚
          </div>
          <div className="flex flex-col">
            <span className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Idest
            </span>
            <span className="text-sm text-gray-500 font-medium">
              Learn • Practice • Excel
            </span>
          </div>
        </div>
        <p className="text-gray-600 text-lg">
          Chào mừng bạn trở lại! 👋
        </p>
      </div>

      {/* Login Card */}
      <Card className="w-full max-w-md bg-white/80 backdrop-blur-sm border-indigo-100 shadow-2xl relative z-10">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Đăng nhập
          </CardTitle>
          <CardDescription className="text-gray-600">
            Nhập thông tin tài khoản để tiếp tục học tập
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-3">
                <Label htmlFor="email" className="text-gray-700 font-medium">
                  📧 Email
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
              </div>

              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-gray-700 font-medium">
                    🔒 Mật khẩu
                  </Label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-sm text-indigo-600 hover:text-purple-600 hover:underline underline-offset-4 transition-colors duration-200"
                  >
                    Quên mật khẩu?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 text-gray-700 border-indigo-200 focus:border-indigo-500 focus:ring-indigo-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
                />
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
                    <span>Đang đăng nhập...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>🚀</span>
                    <span>Đăng nhập</span>
                  </div>
                )}
              </Button>
            </div>

            {/* Divider */}
            <div className="my-6 flex items-center">
              <div className="flex-1 border-t border-gray-200"></div>
              <div className="px-4 text-sm text-gray-500">hoặc</div>
              <div className="flex-1 border-t border-gray-200"></div>
            </div>

            {/* Social Login Options */}
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">🌐</span>
                  <span>Đăng nhập với Google</span>
                </div>
              </Button>
            </div>

            {/* Sign up link */}
            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Chưa có tài khoản?{" "}
                <Link
                  href="/auth/sign-up"
                  className="font-semibold text-indigo-600 hover:text-purple-600 hover:underline underline-offset-4 transition-colors duration-200"
                >
                  Đăng ký ngay
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>


      {/* Floating elements */}
      <div className="absolute top-10 right-10 opacity-30 animate-bounce" style={{ animationDelay: '0.5s' }}>
        <div className="text-4xl">🎯</div>
      </div>
      <div className="absolute bottom-10 left-10 opacity-30 animate-bounce" style={{ animationDelay: '1.5s' }}>
        <div className="text-4xl">✨</div>
      </div>
    </div>
  );
}
