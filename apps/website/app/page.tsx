import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  BookOpen,
  MessageSquare,
  Brain,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ClassShowcaseClient from "@/components/class/ClassShowcaseClient";
import AssignmentShowcaseClient from "@/components/assignment/AssignmentShowcaseClient";
import Navbar from "@/components/navbar-content";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const isAuthenticated = !!user;

  return (
    <main className="min-h-screen bg-white">
      {/* Navigation */}
      {isAuthenticated ? (
        <Navbar />
      ) : (
        <nav className="border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <Link href="/" className="text-2xl font-semibold text-gray-900">
              Idest
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/auth/login"
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 transition-colors"
              >
                Đăng nhập
              </Link>
              <Link
                href="/auth/sign-up"
                className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                Đăng ký
              </Link>
            </div>
          </div>
        </nav>
      )}
      {/* Mobile disclaimer */}
      <div className="md:hidden bg-red-50 border-b border-red-500 text-red-800 px-6 py-3 text-sm text-center">
        Chế độ xem di động không được hỗ trợ, vui lòng sử dụng máy tính để có trải nghiệm tối ưu!
      </div>

      {isAuthenticated ? (
        // Authenticated users see the class marketplace as the primary home experience
        <>
          <Suspense fallback={
            <div className="py-24 flex justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-gray-900 border-t-transparent animate-spin" />
                <p className="text-gray-600 text-sm">Đang tải lớp học cho bạn...</p>
              </div>
            </div>
          }>
            <ClassShowcaseClient />
          </Suspense>
          <Suspense fallback={
            <div className="py-24 flex justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-gray-900 border-t-transparent animate-spin" />
                <p className="text-gray-600 text-sm">Đang tải bài tập...</p>
              </div>
            </div>
          }>
            <AssignmentShowcaseClient />
          </Suspense>
          
          {/* Footer */}
          <footer className="border-t border-gray-200 mt-24">
            <div className="max-w-7xl mx-auto px-6 py-12">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Idest</h3>
                  <p className="text-sm text-gray-600">
                    Làm chủ tiếng Anh một cách tự tin thông qua học tập và thực hành được hỗ trợ bởi AI.
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-4">Học tập</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>
                      <Link href="/classes" className="hover:text-gray-900 transition-colors">
                        Lớp học
                      </Link>
                    </li>
                    <li>
                      <Link href="/assignment" className="hover:text-gray-900 transition-colors">
                        Bài tập
                      </Link>
                    </li>
                    <li>
                      <Link href="/sessions" className="hover:text-gray-900 transition-colors">
                        Buổi học
                      </Link>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-4">Tài khoản</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>
                      <Link href="/settings" className="hover:text-gray-900 transition-colors">
                        Cài đặt
                      </Link>
                    </li>
                    <li>
                      <Link href="/ai" className="hover:text-gray-900 transition-colors">
                        Công cụ AI
                      </Link>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-4">Hỗ trợ</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>
                      <Link href="/service-status" className="hover:text-gray-900 transition-colors">
                        Trạng thái dịch vụ
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="border-t border-gray-200 pt-8 text-center text-sm text-gray-600">
                <p>© {new Date().getFullYear()} Idest. Bảo lưu mọi quyền.</p>
              </div>
            </div>
          </footer>
        </>
      ) : (
        <>
          {/* Hero Section */}
          <section className="max-w-7xl mx-auto px-6 pt-20 pb-24">
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full text-sm text-gray-700 mb-8">
                <Sparkles className="w-4 h-4" />
                Học tiếng Anh được hỗ trợ bởi AI
              </div>
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Làm chủ tiếng Anh với
                <span className="block mt-2">sự tự tin và dễ dàng</span>
              </h1>
              <p className="text-xl text-gray-600 mb-10 leading-relaxed">
                Thực hành nói, viết và hiểu với các gia sư AI
                thích ứng với phong cách học tập của bạn.
              </p>
              <div className="flex items-center justify-center gap-4">
                <Link
                  href="/auth/sign-up"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-lg font-medium"
                >
                  Bắt đầu
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  href="/auth/login"
                  className="px-6 py-3 text-gray-700 hover:text-gray-900 transition-colors text-lg font-medium"
                >
                  Tìm hiểu thêm
                </Link>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section className="max-w-7xl mx-auto px-6 py-24 border-t border-gray-200">
            <div className="grid md:grid-cols-3 gap-12">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-lg mb-4">
                  <MessageSquare className="w-6 h-6 text-gray-900" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  Luyện nói
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Trò chuyện tự nhiên với gia sư AI và nhận phản hồi tức thì
                  về phát âm và độ trôi chảy.
                </p>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-lg mb-4">
                  <BookOpen className="w-6 h-6 text-gray-900" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  Hỗ trợ viết
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Cải thiện kỹ năng viết của bạn với các gợi ý được hỗ trợ bởi AI,
                  sửa lỗi ngữ pháp và đề xuất phong cách.
                </p>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-lg mb-4">
                  <Brain className="w-6 h-6 text-gray-900" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  Học tập cá nhân hóa
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Chương trình học thích ứng điều chỉnh theo trình độ và tốc độ
                  học tập của bạn để đạt tiến bộ tối ưu.
                </p>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="max-w-7xl mx-auto px-6 py-24 border-t border-gray-200">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                Sẵn sàng bắt đầu?
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Tham gia cùng hàng ngàn người học đang cải thiện tiếng Anh mỗi ngày.
              </p>
              <Link
                href="/auth/sign-up"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-lg font-medium"
              >
                Bắt đầu học miễn phí
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t border-gray-200 mt-24">
            <div className="max-w-7xl mx-auto px-6 py-8 text-center text-sm text-gray-600">
              <p>© {new Date().getFullYear()} Idest. Bảo lưu mọi quyền.</p>
            </div>
          </footer>
        </>
      )}
    </main>
  );
}

