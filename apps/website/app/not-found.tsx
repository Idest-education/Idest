"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";
import notFoundImage from "@/assets/404.png";

export default function NotFound() {
  const router = useRouter();
  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-orange-50 px-6 overflow-hidden">
      <div className="max-w-2xl w-full text-center space-y-3 md:space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* 404 Image */}
        <div className="relative w-full max-w-[200px] md:max-w-[280px] mx-auto aspect-square">
          <Image
            src={notFoundImage}
            alt="404 - Mèo đang nhìn từ sau cánh cửa"
            fill
            className="object-contain animate-in zoom-in-95 duration-700"
            priority
            sizes="(max-width: 768px) 200px, 280px"
          />
        </div>

        {/* Playful Message */}
        <div className="space-y-2 md:space-y-3">
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 bg-clip-text text-transparent animate-in fade-in slide-in-from-top-4 duration-700">
            404
          </h1>
          <h2 className="text-xl md:text-2xl font-semibold text-orange-700 animate-in fade-in slide-in-from-top-4 duration-700" style={{ animationDelay: "100ms" }}>
            Ồ không :( Trang bạn đang tìm không có ở đây!
          </h2>
          <p className="text-sm md:text-base text-orange-600 max-w-md mx-auto px-4 animate-in fade-in slide-in-from-top-4 duration-700" style={{ animationDelay: "200ms" }}>
            Có vẻ như chú mèo tò mò của chúng tôi đã tìm thấy một cánh cửa, nhưng trang lại ở nơi khác. Đừng lo, chúng tôi sẽ giúp bạn trở về trang chủ!
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: "300ms" }}>
          <Button
            asChild
            size="lg"
            className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 px-6 py-5 md:px-8 md:py-6 text-base md:text-lg font-semibold"
          >
            <Link href="/" className="flex items-center gap-2">
              <Home className="w-4 h-4 md:w-5 md:h-5" />
              Về trang chủ
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.back()}
            className="border-2 border-orange-400 text-orange-600 hover:border-orange-500 hover:bg-orange-50 transition-all duration-300 hover:scale-105 px-6 py-5 md:px-8 md:py-6 text-base md:text-lg font-semibold"
          >
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
            Quay lại
          </Button>
        </div>
      </div>
    </div>
  );
}

