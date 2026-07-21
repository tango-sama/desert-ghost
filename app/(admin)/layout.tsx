import type { Metadata } from "next";

// The obscure /amelhadj URL is intentional (matches the old amelhadj.html)
// and must never be linked from the storefront or indexed.
export const metadata: Metadata = {
  title: "لوحة التحكم | Desert Shop",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
