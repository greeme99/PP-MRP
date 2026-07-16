import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prod.Plan 생산계획",
  description: "수주 기반 주 단위 생산계획(MPS) 시스템",
};

const NAV = [
  { href: "/", label: "대시보드" },
  { href: "/mps", label: "생산계획(MPS)" },
  { href: "/daily", label: "일별계획" },
  { href: "/mrp", label: "자재소요(MRP)" },
  { href: "/inventory", label: "재고" },
  { href: "/orders", label: "수주" },
  { href: "/mdm/items", label: "기준정보(MDM)" },
  { href: "/import", label: "엑셀 가져오기" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
        <header className="bg-slate-800 text-white">
          <div className="mx-auto max-w-7xl px-4 flex items-center gap-6 h-12">
            <Link href="/" className="font-bold tracking-tight">
              Prod.Plan
            </Link>
            <nav className="flex gap-4 text-sm">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="text-slate-200 hover:text-white"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl w-full px-4 py-6 flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
