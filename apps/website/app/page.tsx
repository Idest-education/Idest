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
import { AuthButton } from "@/components/auth-button";
import ClassShowcaseClient from "@/components/class/ClassShowcaseClient";
import AssignmentShowcaseClient from "@/components/assignment/AssignmentShowcaseClient";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const isAuthenticated = !!user;

  return (
    <main className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-semibold text-gray-900">
            Idest
          </Link>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <Link
                  href="/classes"
                  className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Dashboard
                </Link>
                <AuthButton />
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/auth/sign-up"
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
      {/* Mobile disclaimer */}
      <div className="md:hidden bg-red-50 border-b border-red-500 text-red-800 px-6 py-3 text-sm text-center">
        Mobile view is unsupported, please use a desktop for optimal experience!
      </div>

      {isAuthenticated ? (
        // Authenticated users see the class marketplace as the primary home experience
        <>
          <Suspense fallback={
            <div className="py-24 flex justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-gray-900 border-t-transparent animate-spin" />
                <p className="text-gray-600 text-sm">Loading classes for you...</p>
              </div>
            </div>
          }>
            <ClassShowcaseClient />
          </Suspense>
          <Suspense fallback={
            <div className="py-24 flex justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-gray-900 border-t-transparent animate-spin" />
                <p className="text-gray-600 text-sm">Loading assignments...</p>
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
                    Master English with confidence through AI-powered learning and practice.
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-4">Learn</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>
                      <Link href="/classes" className="hover:text-gray-900 transition-colors">
                        Classes
                      </Link>
                    </li>
                    <li>
                      <Link href="/assignment" className="hover:text-gray-900 transition-colors">
                        Assignments
                      </Link>
                    </li>
                    <li>
                      <Link href="/sessions" className="hover:text-gray-900 transition-colors">
                        Sessions
                      </Link>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-4">Account</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>
                      <Link href="/settings" className="hover:text-gray-900 transition-colors">
                        Settings
                      </Link>
                    </li>
                    <li>
                      <Link href="/ai" className="hover:text-gray-900 transition-colors">
                        AI Tools
                      </Link>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-4">Support</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>
                      <Link href="/service-status" className="hover:text-gray-900 transition-colors">
                        Service Status
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="border-t border-gray-200 pt-8 text-center text-sm text-gray-600">
                <p>© {new Date().getFullYear()} Idest. All rights reserved.</p>
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
                AI-Powered English Learning
              </div>
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Master English with
                <span className="block mt-2">confidence and ease</span>
              </h1>
              <p className="text-xl text-gray-600 mb-10 leading-relaxed">
                Practice speaking, writing, and comprehension with AI tutors
                that adapt to your learning style.
              </p>
              <div className="flex items-center justify-center gap-4">
                <Link
                  href="/auth/sign-up"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-lg font-medium"
                >
                  Get started
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  href="/auth/login"
                  className="px-6 py-3 text-gray-700 hover:text-gray-900 transition-colors text-lg font-medium"
                >
                  Learn more
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
                  Speaking Practice
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Have natural conversations with AI tutors and receive instant
                  feedback on pronunciation and fluency.
                </p>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-lg mb-4">
                  <BookOpen className="w-6 h-6 text-gray-900" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  Writing Assistance
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Improve your writing skills with AI-powered suggestions,
                  grammar corrections, and style recommendations.
                </p>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-lg mb-4">
                  <Brain className="w-6 h-6 text-gray-900" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  Personalized Learning
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Adaptive curriculum that adjusts to your level and learning
                  pace for optimal progress.
                </p>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="max-w-7xl mx-auto px-6 py-24 border-t border-gray-200">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                Ready to get started?
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Join thousands of learners improving their English every day.
              </p>
              <Link
                href="/auth/sign-up"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-lg font-medium"
              >
                Start learning for free
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t border-gray-200 mt-24">
            <div className="max-w-7xl mx-auto px-6 py-8 text-center text-sm text-gray-600">
              <p>© {new Date().getFullYear()} Idest. All rights reserved.</p>
            </div>
          </footer>
        </>
      )}
    </main>
  );
}

