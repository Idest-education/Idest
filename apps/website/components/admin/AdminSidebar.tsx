"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Video,
  ArrowLeft,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/classes", label: "Classes", icon: GraduationCap },
  { href: "/admin/sessions", label: "Sessions", icon: Video },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="w-64 min-h-screen p-6 flex flex-col"
      style={{ background: "#1a0a00" }}
    >
      {/* Logo */}
      <div className="mb-8">
        <h2
          style={{
            fontFamily: "Oswald, sans-serif",
            fontWeight: 700,
            fontSize: 18,
            color: "#fffaf5",
            letterSpacing: "0.05em",
          }}
        >
          IDEST
        </h2>
        <p
          className="mt-0.5"
          style={{
            fontFamily: "Plus Jakarta Sans, sans-serif",
            fontSize: 11,
            color: "rgba(255,250,245,0.4)",
            letterSpacing: "0.04em",
          }}
        >
          Admin Console
        </p>
      </div>

      {/* Nav */}
      <nav className="space-y-1 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-150"
              style={
                isActive
                  ? {
                      background: "var(--color-brand)",
                      color: "#ffffff",
                      fontFamily: "Plus Jakarta Sans, sans-serif",
                      fontWeight: 600,
                      fontSize: 14,
                    }
                  : {
                      background: "transparent",
                      color: "rgba(255,250,245,0.5)",
                      fontFamily: "Plus Jakarta Sans, sans-serif",
                      fontSize: 14,
                    }
              }
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.background = "#2d1500";
                  (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,250,245,0.8)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                  (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,250,245,0.5)";
                }
              }}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Back to App */}
      <div style={{ borderTop: "1px solid rgba(255,250,245,0.1)" }} className="pt-4 mt-4">
        <Link
          href="/classes"
          className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-150"
          style={{
            color: "rgba(255,250,245,0.5)",
            fontFamily: "Plus Jakarta Sans, sans-serif",
            fontSize: 14,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "#2d1500";
            (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,250,245,0.8)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
            (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,250,245,0.5)";
          }}
        >
          <ArrowLeft className="w-5 h-5 flex-shrink-0" />
          <span>Back to App</span>
        </Link>
      </div>
    </aside>
  );
}
