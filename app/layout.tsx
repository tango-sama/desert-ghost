import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "جمالكِ الخارجي | Desert Shop — منتجات الجمال والعناية",
  description:
    "ديزرت شوب — متجر متخصص في منتجات الجمال، العناية بالبشرة والشعر، العطور والمكمّلات النسائية. الدفع عند الاستلام وتوصيل لكل الولايات.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
