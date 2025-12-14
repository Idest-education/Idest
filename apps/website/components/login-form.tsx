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

// Import all carousel images
import Carousel1 from "@/assets/carousel/1.png";
import Carousel2 from "@/assets/carousel/2.png";
import Carousel3 from "@/assets/carousel/3.png";
import Carousel4 from "@/assets/carousel/4.png";
import Carousel5 from "@/assets/carousel/5.png";
import Carousel6 from "@/assets/carousel/6.png";

const carouselImages = [Carousel1, Carousel2, Carousel3, Carousel4, Carousel5, Carousel6];

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  
  // Randomly select an image on component mount
  const selectedImage = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * carouselImages.length);
    return carouselImages[randomIndex];
  }, []);

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
              alt="Đăng nhập"
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
                &ldquo;Làm chủ tiếng Anh với học tập được hỗ trợ bởi AI. Thực hành nói, viết và hiểu theo tốc độ của bạn.&rdquo;
              </p>
            </blockquote>
          </div>
        </div>
        <div className="lg:p-8">
          <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
            <div className="flex flex-col space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                Chào mừng trở lại
              </h1>
              <p className="text-sm text-muted-foreground">
                Nhập email của bạn để đăng nhập vào tài khoản
              </p>
            </div>
            <div className="grid gap-6">
              <form onSubmit={handleLogin}>
                <div className="grid gap-4">
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
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <Link
                        href="/auth/forgot-password"
                        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                      >
                        Quên mật khẩu?
                      </Link>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      disabled={isLoading}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
                    Đăng nhập
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
              Chưa có tài khoản?{" "}
              <Link
                href="/auth/sign-up"
                className="underline underline-offset-4 hover:text-primary"
              >
                Đăng ký
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
