"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import Image from "next/image";

import Carousel1 from "@/assets/carousel/1.png";
import Carousel2 from "@/assets/carousel/2.png";
import Carousel3 from "@/assets/carousel/3.png";
import Carousel4 from "@/assets/carousel/4.png";
import Carousel5 from "@/assets/carousel/5.png";
import Carousel6 from "@/assets/carousel/6.png";

const carouselImages = [Carousel1, Carousel2, Carousel3, Carousel4, Carousel5, Carousel6];

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const router = useRouter();

  const selectedImage = useMemo(() => {
    return carouselImages[Math.floor(Math.random() * carouselImages.length)];
  }, []);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    if (password !== repeatPassword) {
      setError("Mật khẩu xác nhận không khớp");
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/user/serverside-create`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, fullName }),
        },
      );
      if (!res.ok) {
        const msg = await res.json();
        throw new Error(msg.message || `Đăng ký thất bại (${res.status})`);
      }
      router.push("/auth/sign-up-success");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Đã xảy ra lỗi");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const supabase = createClient();
    setIsGoogleLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Đã xảy ra lỗi khi đăng nhập với Google");
      setIsGoogleLoading(false);
    }
  };

  const inputStyle = {
    backgroundColor: "#1a0f05",
    color: "#fffaf5",
    borderRadius: "10px",
    outline: "1px solid #3d2610",
  };

  return (
    <div
      className={cn("flex min-h-screen", className)}
      style={{ backgroundColor: "#0b0b0b" }}
      {...props}
    >
      <div className="flex w-full min-h-screen lg:grid lg:grid-cols-2">

        {/* Left — carousel image */}
        <div className="relative hidden lg:flex flex-col p-10 text-white">
          <div className="absolute inset-0" style={{ backgroundColor: "#0b0b0b" }}>
            <Image
              src={selectedImage}
              alt="Đăng ký"
              fill
              className="object-cover opacity-50"
              priority
            />
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(135deg, rgba(11,8,4,0.6) 0%, transparent 60%)" }}
            />
          </div>
          <div className="relative z-20 flex items-center">
            <Link href="/">
              <span
                className="text-2xl font-bold tracking-tight"
                style={{ fontFamily: "var(--font-display)", color: "#FF6B35" }}
              >
                Idest
              </span>
            </Link>
          </div>
          <div className="relative z-20 mt-auto">
            <blockquote>
              <p className="text-base leading-relaxed" style={{ color: "rgba(255,250,245,0.85)" }}>
                &ldquo;Tham gia cùng hàng ngàn người học đang cải thiện tiếng Anh với công cụ AI và lộ trình học tập cá nhân hóa.&rdquo;
              </p>
            </blockquote>
          </div>
        </div>

        {/* Right — form */}
        <div className="flex items-center justify-center p-8" style={{ backgroundColor: "#0b0b0b" }}>
          <div className="w-full max-w-sm space-y-7">

            {/* Heading */}
            <div className="text-center space-y-1">
              <h1
                className="text-2xl font-bold"
                style={{ fontFamily: "var(--font-display)", color: "#fffaf5" }}
              >
                Tạo tài khoản
              </h1>
              <p className="text-sm" style={{ color: "#6b5040" }}>
                Nhập thông tin của bạn để bắt đầu
              </p>
            </div>

            {/* Form card */}
            <div
              className="rounded-2xl p-6 space-y-5"
              style={{ backgroundColor: "#151515", border: "1px solid #2a1f14" }}
            >
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" style={{ color: "#9a7060", fontSize: "13px" }}>Họ và tên</Label>
                  <Input
                    id="fullName"
                    placeholder="Nguyễn Văn A"
                    type="text"
                    autoCapitalize="words"
                    autoComplete="name"
                    disabled={isLoading}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="border-0 focus-visible:ring-1"
                    style={inputStyle}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" style={{ color: "#9a7060", fontSize: "13px" }}>Email</Label>
                  <Input
                    id="email"
                    placeholder="name@example.com"
                    type="email"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect="off"
                    disabled={isLoading}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="border-0 focus-visible:ring-1"
                    style={inputStyle}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" style={{ color: "#9a7060", fontSize: "13px" }}>Mật khẩu</Label>
                  <Input
                    id="password"
                    type="password"
                    disabled={isLoading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="border-0 focus-visible:ring-1"
                    style={inputStyle}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="repeat-password" style={{ color: "#9a7060", fontSize: "13px" }}>Xác nhận mật khẩu</Label>
                  <Input
                    id="repeat-password"
                    type="password"
                    disabled={isLoading}
                    value={repeatPassword}
                    onChange={(e) => setRepeatPassword(e.target.value)}
                    required
                    className="border-0 focus-visible:ring-1"
                    style={inputStyle}
                  />
                </div>

                {error && (
                  <div
                    className="rounded-xl p-3 text-sm"
                    style={{ backgroundColor: "#2d0a0a", color: "#fca5a5", border: "1px solid #7f1d1d" }}
                  >
                    {error}
                  </div>
                )}

                <Button
                  disabled={isLoading}
                  type="submit"
                  className="w-full font-bold rounded-xl transition-all hover:-translate-y-0.5"
                  style={{ backgroundColor: "#FF6B35", color: "#ffffff", border: "none", height: "42px" }}
                >
                  {isLoading && (
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  )}
                  Tạo tài khoản
                </Button>
              </form>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full" style={{ borderTop: "1px solid #2a1f14" }} />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="px-2 text-xs" style={{ backgroundColor: "#151515", color: "#4a3020" }}>
                    Hoặc tiếp tục với
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                type="button"
                disabled={isLoading || isGoogleLoading}
                onClick={handleGoogleSignIn}
                className="w-full rounded-xl transition-all"
                style={{
                  backgroundColor: "transparent",
                  border: "1px solid #2a1f14",
                  color: "#c4a882",
                  height: "42px",
                }}
              >
                {isGoogleLoading ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Đăng ký với Google
                  </>
                )}
              </Button>
            </div>

            <p className="text-center text-sm" style={{ color: "#4a3020" }}>
              Đã có tài khoản?{" "}
              <Link href="/auth/login" className="transition-colors hover:underline" style={{ color: "#FF6B35" }}>
                Đăng nhập
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
