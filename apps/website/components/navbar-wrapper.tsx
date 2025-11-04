"use client";

import { usePathname } from "next/navigation";

interface NavbarWrapperProps {
  children: React.ReactNode;
}

export default function NavbarWrapper({ children }: NavbarWrapperProps) {
  const pathname = usePathname();
  const isMeetingPage = pathname?.includes("/meet");

  if (isMeetingPage) {
    return null;
  }

  return <>{children}</>;
}

