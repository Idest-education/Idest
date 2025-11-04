"use client";

import { usePathname } from "next/navigation";
import NavbarWrapper from "@/components/navbar-wrapper";

interface ProtectedLayoutWrapperProps {
  children: React.ReactNode;
  navbar: React.ReactNode;
}

export default function ProtectedLayoutWrapper({ children, navbar }: ProtectedLayoutWrapperProps) {
  const pathname = usePathname();
  const isMeetingPage = pathname?.includes("/meet");

  return (
    <main className="min-h-screen flex flex-col">
      <NavbarWrapper>{navbar}</NavbarWrapper>
      
      {/* Content - Full screen for meeting pages */}
      <div className={isMeetingPage ? "flex-1 w-full" : "flex-1 w-full max-w-7xl mx-auto p-6"}>
        {children}
      </div>
    </main>
  );
}

