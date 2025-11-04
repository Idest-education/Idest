import ProtectedLayoutWrapper from "@/components/protected-layout-wrapper";
import Navbar from "@/components/navbar-content";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedLayoutWrapper navbar={<Navbar />}>
      {children}
    </ProtectedLayoutWrapper>
  );
}

