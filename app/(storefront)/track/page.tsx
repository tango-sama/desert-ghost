import type { Metadata } from "next";
import { TrackPage } from "@/components/storefront/tracking/track-page";

export const metadata: Metadata = {
  title: "تتبع طلبيتك | Desert Shop",
  description: "تابعي حالة طلبيتكِ لدى Desert Shop باستخدام رقم الهاتف.",
  robots: { index: false, follow: false },
};

export default function TrackingPage() {
  return <TrackPage />;
}
