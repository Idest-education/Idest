"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import Image from "next/image";

// Import all carousel images
import Carousel1 from "@/assets/carousel/1.png";
import Carousel2 from "@/assets/carousel/2.png";
import Carousel3 from "@/assets/carousel/3.png";
import Carousel4 from "@/assets/carousel/4.png";
import Carousel5 from "@/assets/carousel/5.png";
import Carousel6 from "@/assets/carousel/6.png";

const carouselImages = [Carousel1, Carousel2, Carousel3, Carousel4, Carousel5, Carousel6];
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
  
  // Randomly select an image on component mount
  const selectedImage = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * carouselImages.length);
    return carouselImages[randomIndex];
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
      const res = await fetch("https://ie-backend.fly.dev/user/serverside-create", {
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
    <div className={cn("flex min-h-screen flex-col", className)} {...props}>
      <div className="container relative grid min-h-screen flex-col items-center justify-center lg:max-w-none lg:grid-cols-2 lg:px-0">
        <div className="relative hidden h-full flex-col bg-muted p-10 text-white lg:flex dark:border-r">
          <div className="absolute inset-0 bg-gray-900">
            <Image
              src={selectedImage}
              alt="Đăng ký"
              fill
              className="object-cover opacity-60"
              priority
            />
          </div>
          <div className="relative z-20 flex items-center text-lg font-medium">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl font-semibold">Idest</span>
            </Link>
          </div>
          <div className="relative z-20 mt-auto">
            <blockquote className="space-y-2">
              <p className="text-lg">
                &ldquo;Tham gia cùng hàng ngàn người học đang cải thiện tiếng Anh với công cụ AI và lộ trình học tập cá nhân hóa.&rdquo;
              </p>
            </blockquote>
          </div>
        </div>
        <div className="lg:p-8">
          <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
            <div className="flex flex-col space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                Tạo tài khoản
              </h1>
              <p className="text-sm text-muted-foreground">
                Nhập thông tin của bạn để bắt đầu
              </p>
            </div>
            <div className="grid gap-6">
              <form onSubmit={handleSignUp}>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="fullName">Họ và tên</Label>
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
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
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
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="role">Vai trò</Label>
                    <Select onValueChange={(val) => setRole(val as "student" | "teacher")} disabled={isLoading}>
                      <SelectTrigger id="role">
                        <SelectValue placeholder="Chọn vai trò của bạn" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STUDENT">Học sinh</SelectItem>
                        <SelectItem value="TEACHER">Giáo viên</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Mật khẩu</Label>
                    <Input
                      id="password"
                      type="password"
                      disabled={isLoading}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="repeat-password">Xác nhận mật khẩu</Label>
                    <Input
                      id="repeat-password"
                      type="password"
                      disabled={isLoading}
                      value={repeatPassword}
                      onChange={(e) => setRepeatPassword(e.target.value)}
                      required
                    />
                  </div>
                  {error && (
                    <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                      {error}
                    </div>
                  )}
                  <Button disabled={isLoading} type="submit" className="w-full">
                    {isLoading && (
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                    )}
                    Tạo tài khoản
                  </Button>
                </div>
              </form>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Hoặc tiếp tục với
                  </span>
                </div>
              </div>
              <Button variant="outline" type="button" disabled={isLoading}>
                Google (Sắp ra mắt)
              </Button>
            </div>
            <p className="px-8 text-center text-sm text-muted-foreground">
              Đã có tài khoản?{" "}
              <Link
                href="/auth/login"
                className="underline underline-offset-4 hover:text-primary"
              >
                Đăng nhập
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
