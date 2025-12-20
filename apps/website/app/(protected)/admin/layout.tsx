import { requireAdmin } from "@/lib/admin/require-admin";
import AdminShell from "@/components/admin/AdminShell";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireAdmin();
  } catch (error) {
    // Next.js redirect() throws a special error that should propagate
    // Check if it's a redirect error and re-throw it
    if (error && typeof error === 'object' && 'digest' in error) {
      const digest = (error as any).digest;
      if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')) {
        throw error; // Re-throw redirect exceptions
      }
    }
    // For other errors, redirect to classes
    redirect("/classes");
  }

  return <AdminShell>{children}</AdminShell>;
}

