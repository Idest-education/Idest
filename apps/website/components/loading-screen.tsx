"use client";

import { BookOpen } from "lucide-react";

export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-100 to-gray-200 flex items-center justify-center">
      <div className="text-center">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-300 border-t-orange-600 mx-auto mb-4"></div>
          <BookOpen className="w-6 h-6 text-orange-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
        </div>
        <p className="text-black font-semibold text-lg">Đang tải ...</p>
        <p className="text-gray-600 text-sm mt-1">Vui lòng đợi một chút</p>
      </div>
    </div>
  );
}
