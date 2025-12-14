"use client";

import { useState } from "react";
import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import ChatButtonClient from "@/components/conversation/ChatButtonClient";
import Image from "next/image";
import Logo from "@/assets/logo.png";

const navItems = [
  { href: "/classes", label: "Lớp học" },
  { href: "/sessions", label: "Buổi học" },
  { href: "/assignment", label: "Bài tập" },
  { href: "/assignment/submissions", label: "Bài nộp" },
  { href: "/service-status", label: "Trạng thái dịch vụ" },
];

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-gray-200 h-16 bg-white backdrop-blur-sm flex items-center shadow-sm">
      <div className="w-full max-w-7xl mx-auto flex justify-between items-center px-6 relative">
        {/* Left side: logo + menu */}
        <div className="flex items-center gap-3 lg:gap-8">
          <button
            type="button"
            onClick={toggleMenu}
            aria-label={isMenuOpen ? "Đóng menu điều hướng" : "Mở menu điều hướng"}
            aria-expanded={isMenuOpen}
            className="lg:hidden p-2 rounded-md text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200"
          >
            {isMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

          <Link
            href="/"
            className="flex items-center gap-3 group"
            onClick={closeMenu}
          >
            <Image
              src={Logo}
              alt="Idest"
              width={150}
              height={75}
              className="h-10 w-auto transition-opacity group-hover:opacity-80"
              priority
            />
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
          </div>
        </div>

        {/* Right side: Chat + Auth + Env */}
        <div className="flex items-center gap-4">
          <ChatButtonClient />
          {!hasEnvVars ? <EnvVarWarning /> : <AuthButton />}
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`lg:hidden absolute top-16 left-0 right-0 bg-white border-b border-gray-200 shadow-md transition-all duration-200 ${
          isMenuOpen ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
      >
        <div className="px-6 py-4 flex flex-col gap-2 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMenu}
              className="px-4 py-2 rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

