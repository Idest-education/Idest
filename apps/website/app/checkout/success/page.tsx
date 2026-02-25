"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { verifyAndCompleteEnrollment } from "@/services/stripe.service";
import { getUserClasses } from "@/services/class.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";

function formatVnd(price?: number | null, currency?: string) {
  if (price == null) return "Miễn phí";
  const formatter = new Intl.NumberFormat("vi-VN");
  const cur = (currency || "VND").toUpperCase();
  return `${formatter.format(price)} ${cur}`;
}

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState(false);

  const classId = searchParams.get("classId");
  const className = searchParams.get("className");
  const sessionId = searchParams.get("session_id");
  const price = searchParams.get("price");
  const currency = searchParams.get("currency");

  useEffect(() => {
    const verifyEnrollment = async () => {
      if (!classId || !sessionId) {
        setError("Thiếu các tham số bắt buộc");
        setLoading(false);
        return;
      }

      try {
        console.log("Verifying enrollment for session:", sessionId);
        const result = await verifyAndCompleteEnrollment(classId, sessionId);
        console.log("Enrollment verification result:", result);

        if (result.success) {
          setEnrolled(true);
          // Refresh user classes
          await getUserClasses();
        } else {
          throw new Error("Enrollment verification failed");
        }
        } catch (err: unknown) {
          console.error("Failed to verify enrollment:", err);
          let errorMessage = "Thanh toán thành công nhưng ghi danh thất bại. Vui lòng liên hệ hỗ trợ.";
          
          if (err && typeof err === 'object' && 'response' in err) {
            const axiosError = err as { response?: { data?: { message?: string }; status?: number } };
            console.error("Error details:", {
              message: axiosError.response?.data?.message,
              status: axiosError.response?.status,
            });
            errorMessage = axiosError.response?.data?.message || errorMessage;
          } else if (err instanceof Error) {
            errorMessage = err.message;
          }
          
          setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    verifyEnrollment();
  }, [classId, sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-gray-600" />
              <p className="text-gray-600">Đang xử lý ghi danh của bạn...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Ghi danh thất bại</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700">{error}</p>
            {sessionId && (
              <p className="text-sm text-gray-500">
                Mã phiên: {sessionId}
              </p>
            )}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => router.push("/")}
                className="flex-1"
              >
                Về trang chủ
              </Button>
              <Button
                onClick={() => router.push(`/classes/${classId}`)}
                className="flex-1"
              >
                Thử lại
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-emerald-100 p-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-600" />
            </div>
          </div>
          <CardTitle className="text-2xl text-gray-900">
            Thanh toán thành công!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {enrolled && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-emerald-800 font-medium text-center">
                Bạn đã được ghi danh thành công vào lớp học!
              </p>
            </div>
          )}

          {className && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Tên lớp học</p>
              <p className="font-semibold text-gray-900">{className}</p>
            </div>
          )}

          {price && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Số tiền đã thanh toán</p>
              <p className="font-semibold text-gray-900">
                {formatVnd(Number(price), currency || undefined)}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => router.push("/")}
              className="flex-1"
            >
              Duyệt lớp học
            </Button>
            {classId && (
              <Link href={`/classes/${classId}`} className="flex-1">
                <Button className="w-full">
                  Đi đến lớp
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-gray-600" />
                <p className="text-gray-600">Đang tải...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  );
}

