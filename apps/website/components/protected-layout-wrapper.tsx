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
  const isReadingPage = pathname?.includes("/assignment/reading");
  const isWritingPage = pathname?.includes("/assignment/writing");
  const isSpeakingPage = pathname?.includes("/assignment/speaking");
  const isListeningPage = pathname?.includes("/assignment/listening");

  return (
    <main className="min-h-screen flex flex-col">
      <NavbarWrapper>{navbar}</NavbarWrapper>

      {/* Content - Full screen for meeting pages */}
      <div className={isMeetingPage || isReadingPage || isWritingPage || isSpeakingPage || isListeningPage ? "flex-1 w-full" : "flex-1 w-full max-w-7xl mx-auto p-6"}>
        {children}
      </div>
    </main>
  );
}

