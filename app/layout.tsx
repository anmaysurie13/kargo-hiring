import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { authEnabled } from "@/lib/auth";
import "./globals.css";

const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Kargo Hiring Dashboard",
  description: "The system recommends, Arjun decides.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
            <Link href="/" className="group flex items-center gap-2 font-semibold tracking-tight text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-indigo-700 text-xs font-bold text-white transition-transform group-hover:scale-105">
                K
              </span>
              Kargo <span className="font-normal text-slate-400">/ Hiring</span>
            </Link>
            <Nav signOut={authEnabled()} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
