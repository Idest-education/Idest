import Link from "next/link";

export default function DevInfoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-gray-200">
        <div className="px-6 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-semibold text-gray-900">
            Idest
          </Link>
          <div className="text-sm text-gray-600">
            Thông tin nhà phát triển
          </div>
        </div>
      </nav>
      <div className="w-full px-6 py-6">
        {children}
      </div>
    </main>
  );
}
