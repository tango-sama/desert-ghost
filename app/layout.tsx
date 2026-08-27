import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import { MetaPixel } from "@/components/analytics/meta-pixel";
import { MetaPixelRouteTracker } from "@/components/analytics/meta-pixel-route-tracker";
import "./globals.css";

const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "جمالكِ الخارجي | Desert Shop — منتجات الجمال والعناية",
  description:
    "ديزرت شوب — متجر متخصص في منتجات الجمال، العناية بالبشرة والشعر، العطور والمكمّلات النسائية. الدفع عند الاستلام وتوصيل لكل الولايات.",
  // Meta Business Manager domain verification for desertshop.fit — needed
  // to lift the pixel's traffic-permission gate (see context/
  // architecture-context.md, ## Analytics). Not a secret: this token is
  // meant to be publicly visible in page source, same as a
  // google-site-verification tag.
  verification: {
    other: {
      "facebook-domain-verification": "onddnkck92bukbfcir9flot8pw69v2",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {metaPixelId && (
          <>
            <MetaPixel pixelId={metaPixelId} />
            <MetaPixelRouteTracker />
          </>
        )}
        {children}
      </body>
    </html>
  );
}
