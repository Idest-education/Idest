"use client";

import NavbarWrapper from "@/components/navbar-wrapper";

interface ProtectedLayoutWrapperProps {
  children: React.ReactNode;
  navbar: React.ReactNode;
}

export default function ProtectedLayoutWrapper({ children, navbar }: ProtectedLayoutWrapperProps) {
  return (
    <main className="min-h-screen flex flex-col">
      <NavbarWrapper>{navbar}</NavbarWrapper>

      <div className="flex-1 w-full">
        {children}
      </div>
    </main>
  );
}

