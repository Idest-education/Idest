import type { Metadata } from "next";
import { Oswald, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster } from "sonner";
import logoIcon from "@/assets/logo-icon.png";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Idest",
  description: "Nền tảng học tiếng Anh được hỗ trợ bởi AI",
  icons: {
    icon: logoIcon.src,
  },
};

const oswald = Oswald({
  variable: "--font-display",
  weight: "700",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-body",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  weight: "700",
  subsets: ["latin"],
  display: "optional",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body
        className={`${oswald.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable} antialiased`}
        style={{ fontFamily: "var(--font-body, system-ui, sans-serif)" }}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster
            richColors={false}
            position="top-center"
            toastOptions={{
              style: {
                background: "#1a0a00",
                color: "#ffffff",
                border: "1px solid #3d1800",
                fontFamily: "var(--font-body)",
                fontSize: "14px",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
