import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import ChatButtonClient from "@/components/conversation/ChatButtonClient"

const navItems = [
  { href: "/classes", label: "Classes" },
  { href: "/sessions", label: "Sessions" },
  { href: "/assignment", label: "Assignments" },
];

const aiSubItems = [
  { href: "/ai/speaking", label: "Speaking" },
  { href: "/ai/writing", label: "Writing" },
  { href: "/ai/generate-text", label: "Generate text" },
  { href: "/ai/generate-text-with-context", label: "Generate text with context" },
];

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 w-full border-b border-gray-200 h-16 bg-white backdrop-blur-sm flex items-center shadow-sm">
        <div className="w-full max-w-7xl mx-auto flex justify-between items-center px-6">
          {/* Left side: logo + menu */}
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="flex items-center gap-3 group"
            >
              <div className="text-2xl font-semibold text-gray-900 transition-colors hover:text-gray-600">
                Idest
              </div>
            </Link>

            {/* Menu */}
            <div className="hidden lg:flex gap-1 text-sm">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-4 py-2 rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                >
                  {item.label}
                </Link>
              ))}

              {/* Dropdown AI Tools */}
              <div className="relative group">
                <button className="flex items-center gap-2 px-4 py-2 rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                  <span>AI Tools</span>
                  <svg className="w-4 h-4 transition-transform duration-200 group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <div className="absolute left-0 top-full pt-2 hidden group-hover:block">
                  <div className="bg-white border border-gray-200 rounded-lg shadow-lg min-w-[240px] overflow-hidden">
                    <div className="p-2">
                      {aiSubItems.map((sub) => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right side: Chat + Auth + Env */}
          <div className="flex items-center gap-4">
            <ChatButtonClient />
            {!hasEnvVars ? <EnvVarWarning /> : <AuthButton />}
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 w-full max-w-7xl mx-auto p-6">
        {children}
      </div>
    </main>
  );
}

