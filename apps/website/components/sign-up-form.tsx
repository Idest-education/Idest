"use client";

import { cn } from "@/lib/utils";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"student" | "teacher" | "">("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (password !== repeatPassword) {
      setError("Mật khẩu không khớp");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("http://localhost:8000/user/serverside-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName, role }),
      });

      if (!res.ok) {
        const msg = await res.json();
        const errordata = msg.message;
        throw new Error(errordata || `Đăng ký thất bại (${res.status})`);
      }
      router.push("/auth/sign-up-success");
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
            🎓
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
          Bắt đầu hành trình học tiếng Anh! 🚀
        </p>
      </div>

      {/* Sign Up Card */}
      <Card className="w-full max-w-md bg-white/80 backdrop-blur-sm border-indigo-100 shadow-2xl relative z-10">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Đăng ký tài khoản
          </CardTitle>
          <CardDescription className="text-gray-600">
            Tạo tài khoản mới để khám phá thế giới tiếng Anh
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp}>
            <div className="flex flex-col gap-4">
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
                  className="h-11 text-gray-700 border-indigo-200 focus:border-indigo-500 focus:ring-indigo-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
                />
              </div>

              <div className="grid gap-3">
                <Label htmlFor="fullName" className="text-gray-700 font-medium">
                  👤 Họ và tên
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Nguyễn Văn A"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-11 text-gray-700 border-indigo-200 focus:border-indigo-500 focus:ring-indigo-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
                />
              </div>

              <div className="grid gap-3">
                <Label htmlFor="role" className="text-gray-700 font-medium">
                  🎯 Vai trò
                </Label>
                <Select onValueChange={(val) => setRole(val as "student" | "teacher")}>
                  <SelectTrigger id="role" className="h-11 border-indigo-200 focus:border-indigo-500 focus:ring-indigo-500 bg-white/50 backdrop-blur-sm">
                    <SelectValue placeholder="Chọn vai trò của bạn" />
                  </SelectTrigger>
                  <SelectContent className="bg-white/95 backdrop-blur-sm border-indigo-100">
                    <SelectItem value="STUDENT" className="hover:bg-indigo-50">
                      <div className="flex text-gray-700 items-center gap-2">
                        <span>👨‍🎓</span>
                        <span>Học viên</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="TEACHER" className="hover:bg-purple-50">
                      <div className="flex text-gray-700 items-center gap-2">
                        <span>👨‍🏫</span>
                        <span>Giáo viên</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3">
                <Label htmlFor="password" className="text-gray-700 font-medium">
                  🔒 Mật khẩu
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 text-gray-700 border-indigo-200 focus:border-indigo-500 focus:ring-indigo-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
                />
              </div>

              <div className="grid gap-3">
                <Label htmlFor="repeat-password" className="text-gray-700 font-medium">
                  🔐 Xác nhận mật khẩu
                </Label>
                <Input
                  id="repeat-password"
                  type="password"
                  placeholder="••••••••"
                  required
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                  className="h-11 text-gray-700 border-indigo-200 focus:border-indigo-500 focus:ring-indigo-500 bg-white/50 backdrop-blur-sm transition-all duration-200"
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
                className="w-full h-11 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Đang tạo tài khoản...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>🎉</span>
                    <span>Tạo tài khoản</span>
                  </div>
                )}
              </Button>
            </div>

            {/* Sign in link */}
            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Đã có tài khoản?{" "}
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
      </Card>

      {/* Floating elements */}
      <div className="absolute top-10 right-10 opacity-30 animate-bounce" style={{animationDelay: '0.5s'}}>
        <div className="text-4xl">🎓</div>
      </div>
      <div className="absolute bottom-10 left-10 opacity-30 animate-bounce" style={{animationDelay: '1.5s'}}>
        <div className="text-4xl">📝</div>
      </div>
    </div>
  );
}