import type { Metadata } from "next";
import { getSettings } from "@/lib/firebase";
import { CheckoutForm } from "@/components/storefront/checkout-form";

export const metadata: Metadata = {
  title: "إتمام الطلب | جمالكِ الخارجي — Desert Shop",
};

export default async function CheckoutPage() {
  const settings = await getSettings();
  return <CheckoutForm settings={settings} />;
}
