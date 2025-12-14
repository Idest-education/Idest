"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
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

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Randomly select an image on component mount
  const selectedImage = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * carouselImages.length);
    return carouselImages[randomIndex];
  }, []);

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
    <div className={cn("flex min-h-screen flex-col", className)} {...props}>
      <div className="container relative grid min-h-screen flex-col items-center justify-center lg:max-w-none lg:grid-cols-2 lg:px-0">
        <div className="relative hidden h-full flex-col bg-muted p-10 text-white lg:flex dark:border-r">
          <div className="absolute inset-0 bg-gray-900">
            <Image
              src={selectedImage}
              alt="Quên mật khẩu"
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
                &ldquo;Đặt lại mật khẩu một cách an toàn. Chúng tôi sẽ giúp bạn quay lại học tập ngay lập tức.&rdquo;
              </p>
            </blockquote>
          </div>
        </div>
        <div className="lg:p-8">
          <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
            {success ? (
              <>
                <div className="flex flex-col space-y-2 text-center">
                  <h1 className="text-2xl font-semibold tracking-tight">
                    Kiểm tra email của bạn
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Chúng tôi đã gửi hướng dẫn đặt lại mật khẩu đến email của bạn
                  </p>
                </div>
                <div className="rounded-md bg-green-50 border border-green-200 p-4">
                  <p className="text-sm text-green-700">
                    Nếu tài khoản tồn tại với email đó, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.
                  </p>
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Các bước tiếp theo:</h4>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <span className="font-medium">1.</span>
                      <span>Mở email từ Idest</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-medium">2.</span>
                      <span>Nhấp vào liên kết trong email</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-medium">3.</span>
                      <span>Tạo mật khẩu mới của bạn</span>
                    </div>
                  </div>
                </div>
                <Link
                  href="/auth/login"
                  className="text-center text-sm text-muted-foreground underline underline-offset-4 hover:text-primary"
                >
                  Quay lại đăng nhập
                </Link>
              </>
            ) : (
              <>
                <div className="flex flex-col space-y-2 text-center">
                  <h1 className="text-2xl font-semibold tracking-tight">
                    Quên mật khẩu
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Nhập email của bạn và chúng tôi sẽ gửi liên kết đặt lại mật khẩu
                  </p>
                </div>
                <div className="grid gap-6">
                  <form onSubmit={handleForgotPassword}>
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
                      {error && (
                        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                          {error}
                        </div>
                      )}
                      <Button disabled={isLoading} type="submit" className="w-full">
                        {isLoading && (
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                        )}
                        Gửi liên kết đặt lại
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
                  Nhớ mật khẩu?{" "}
                  <Link
                    href="/auth/login"
                    className="underline underline-offset-4 hover:text-primary"
                  >
                    Đăng nhập
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}