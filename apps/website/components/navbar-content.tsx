"use client";

import { useState } from "react";
import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import ChatButtonClient from "@/components/conversation/ChatButtonClient";
import Image from "next/image";
import Logo from "@/assets/logo.png";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/classes", label: "Lớp học" },
  { href: "/sessions", label: "Buổi học" },
  { href: "/assignment", label: "Bài tập" },
  { href: "/assignment/submissions", label: "Bài nộp" },
];

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <nav
      className="sticky top-0 z-50 w-full h-14 flex items-center"
      style={{
        backgroundColor: "var(--color-surface-card)",
        borderBottom: "1px solid var(--color-border-default)",
      }}
    >
      <div className="w-full flex justify-between items-center px-6">
        {/* Left: logo + links */}
        <div className="flex items-center gap-2 lg:gap-8">
          <button
            type="button"
            onClick={toggleMenu}
            aria-label={isMenuOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={isMenuOpen}
            className="lg:hidden p-2 rounded-md transition-colors"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {isMenuOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

          <Link href="/" onClick={closeMenu} className="flex items-center">
            <Image
              src={Logo}
              alt="Idest"
              width={120}
              height={60}
              className="h-8 w-auto"
              priority
            />
          </Link>

          <div className="hidden lg:flex gap-1 text-sm">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-4 py-2 rounded-full text-sm font-medium transition-colors"
                  style={{
                    color: isActive ? "var(--color-brand)" : "var(--color-text-secondary)",
                    backgroundColor: isActive ? "var(--color-surface-subtle)" : "transparent",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right: chat + auth */}
        <div className="flex items-center gap-3">
          <ChatButtonClient />
          {!hasEnvVars ? <EnvVarWarning /> : <AuthButton />}
        </div>
      </div>

      {/* Mobile dropdown */}
      {isMenuOpen && (
        <div
          className="lg:hidden absolute top-14 left-0 right-0 z-50 shadow-lg animate-slideDown"
          style={{
            backgroundColor: "var(--color-surface-card)",
            borderBottom: "1px solid var(--color-border-default)",
          }}
        >
          <div className="px-6 py-3 flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMenu}
                className="px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
