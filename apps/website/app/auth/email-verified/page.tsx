import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 relative">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-20 h-20 bg-green-200 rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute top-40 right-20 w-16 h-16 bg-emerald-200 rounded-full opacity-20 animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute bottom-40 left-20 w-24 h-24 bg-teal-200 rounded-full opacity-20 animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute bottom-20 right-40 w-18 h-18 bg-green-200 rounded-full opacity-20 animate-pulse" style={{animationDelay: '3s'}}></div>
      </div>

      {/* Floating elements */}
      <div className="absolute top-10 right-10 opacity-40 animate-bounce" style={{animationDelay: '0.5s'}}>
        <div className="text-4xl">✨</div>
      </div>
      <div className="absolute bottom-10 left-10 opacity-40 animate-bounce" style={{animationDelay: '1.5s'}}>
        <div className="text-4xl">🌟</div>
      </div>
      
      {/* Celebration particles */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-yellow-400 rounded-full animate-ping" style={{animationDelay: '0.2s'}}></div>
        <div className="absolute top-1/3 right-1/4 w-2 h-2 bg-green-400 rounded-full animate-ping" style={{animationDelay: '0.5s'}}></div>
        <div className="absolute bottom-1/3 left-1/3 w-2 h-2 bg-emerald-400 rounded-full animate-ping" style={{animationDelay: '0.8s'}}></div>
        <div className="absolute bottom-1/4 right-1/3 w-2 h-2 bg-teal-400 rounded-full animate-ping" style={{animationDelay: '1.1s'}}></div>
      </div>

      <div className="flex flex-col gap-6 w-full max-w-md relative z-10">
        {/* Header Logo */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-2xl animate-bounce">
              ✉️
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
        </div>

        {/* Success Card */}
        <Card className="bg-white/80 backdrop-blur-sm border-green-100 shadow-2xl">
          <CardHeader className="text-center pb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg mx-auto mb-4 animate-pulse">
              ✓
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              Email đã được xác nhận!
            </CardTitle>
            <CardDescription className="text-gray-600 text-lg">
              Tài khoản của bạn đã được kích hoạt thành công
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
              <p className="text-green-700 text-center flex items-center justify-center gap-2">
                <span className="text-xl">🎉</span>
                <span className="font-medium">
                  Chúc mừng! Email của bạn đã được xác nhận thành công. Bây giờ bạn có thể đăng nhập và sử dụng tất cả các tính năng của Idest.
                </span>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-4">
              <Link href="/auth/login" className="block">
                <Button className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <span>🚀</span>
                    <span>Đi tới trang đăng nhập</span>
                  </div>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}






