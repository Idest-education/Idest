"use client";

import { usePathname } from "next/navigation";
import FocusNav from "@/components/focus-nav";

interface NavbarWrapperProps {
  children: React.ReactNode;
}

// Matches /assignment/(reading|listening|writing|speaking)/[id]
// but NOT /assignment/(skill)/[id]/result/[submissionId]
const TEST_ROUTE_REGEX = /^\/assignment\/(reading|listening|writing|speaking)\/[^/]+$/;

export default function NavbarWrapper({ children }: NavbarWrapperProps) {
  const pathname = usePathname();

  if (pathname?.includes("/meet")) {
    return null;
  }

  if (pathname && TEST_ROUTE_REGEX.test(pathname)) {
    return <FocusNav />;
  }

  return <>{children}</>;
}

