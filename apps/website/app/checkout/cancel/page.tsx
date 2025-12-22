"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

function CheckoutCancelContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const classId = searchParams.get("classId");
  const className = searchParams.get("className");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-orange-100 p-3">
              <XCircle className="w-12 h-12 text-orange-600" />
            </div>
          </div>
          <CardTitle className="text-2xl text-gray-900">
            Thanh toán đã hủy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-orange-800 text-center">
              Thanh toán của bạn đã bị hủy. Không có khoản phí nào được tính.
            </p>
          </div>

          {className && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Tên lớp học</p>
              <p className="font-semibold text-gray-900">{className}</p>
            </div>
          )}

          <p className="text-gray-600 text-center text-sm">
            Bạn có thể hoàn tất việc mua bất cứ lúc nào bằng cách quay lại trang lớp học.
          </p>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => router.push("/")}
              className="flex-1"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Về trang chủ
            </Button>
            {classId && (
              <Link href={`/classes/${classId}`} className="flex-1">
                <Button className="w-full">Thử lại</Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CheckoutCancelPage() {
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
      <CheckoutCancelContent />
    </Suspense>
  );
}








