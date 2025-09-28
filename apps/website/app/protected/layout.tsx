import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";

const navItems = [
  { href: "/protected/classes", label: "Classes", icon: "👥" },
  { href: "/protected/sessions", label: "Sessions", icon: "📅" },
  { href: "/protected/assignments", label: "Assignments", icon: "📝" },
];

const aiSubItems = [
  { href: "/protected/ai/speaking", label: "Speaking", icon: "🗣️" },
  { href: "/protected/ai/writing", label: "Writing", icon: "✍️" },
  { href: "/protected/ai/generate-text", label: "Generate text", icon: "📄" },
  { href: "/protected/ai/generate-text-with-context", label: "Generate text with context", icon: "📚" },
];

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 w-full border-b border-indigo-100 h-20 bg-white/95 backdrop-blur-sm flex items-center shadow-lg">
        <div className="w-full max-w-7xl mx-auto flex justify-between items-center px-6">
          {/* Left side: logo + menu */}
          <div className="flex items-center gap-8">
            <Link
              href="/protected"
              className="flex items-center gap-3 group"
            >
              <div className="w-12 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                📚
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  EnglishMaster
                </span>
                <span className="text-xs text-gray-500 font-medium">
                  Learn • Practice • Excel
                </span>
              </div>
            </Link>

            {/* Menu */}
            <div className="hidden lg:flex gap-1 font-medium text-sm relative">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-black hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200 group"
                >
                  <span className="text-lg group-hover:scale-110 transition-transform duration-200">
                    {item.icon}
                  </span>
                  <span className="font-medium">{item.label}</span>
                </Link>
              ))}

              {/* Dropdown AI Tools */}
              <div className="relative group">
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gradient-to-r hover:from-purple-50 hover:to-indigo-50 hover:text-purple-700 transition-all duration-200 group/btn">
                  <span className="text-lg group-hover/btn:scale-110 transition-transform duration-200">
                    🤖
                  </span>
                  <span className="font-medium text-black">AI Tools</span>
                  <svg className="w-4 h-4 transition-transform duration-200 group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* Invisible bridge to prevent gap */}
                <div className="absolute left-0 top-full w-full h-2 bg-transparent group-hover:block hidden"></div>
                
                <div className="absolute left-0 top-full pt-4 hidden group-hover:block">
                  <div className="bg-white/95 backdrop-blur-sm border border-purple-100 rounded-xl shadow-2xl min-w-[250px] overflow-hidden">
                    <div className="p-2">
                      {aiSubItems.map((sub) => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-gradient-to-r hover:from-purple-50 hover:to-indigo-50 rounded-lg transition-all duration-200 group/sub"
                        >
                          <span className="text-base group-hover/sub:scale-110 transition-transform duration-200">
                            {sub.icon}
                          </span>
                          <span className="font-medium text-gray-700 group-hover/sub:text-purple-700">
                            {sub.label}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right side: Progress + Auth + Env */}
          <div className="flex items-center gap-4">
            {!hasEnvVars ? <EnvVarWarning /> : <AuthButton />}
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 w-full max-w-7xl mx-auto p-6">
        {/* Main Content */}
        <div className="flex-1 w-full max-w-7xl mx-auto p-6">
          {children}
        </div>
      </div>

      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-10 w-20 h-20 bg-purple-200 rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute top-40 right-20 w-16 h-16 bg-indigo-200 rounded-full opacity-20 animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute bottom-40 left-20 w-24 h-24 bg-blue-200 rounded-full opacity-20 animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute bottom-20 right-40 w-18 h-18 bg-purple-200 rounded-full opacity-20 animate-pulse" style={{animationDelay: '3s'}}></div>
      </div>
    </main>
  );
}