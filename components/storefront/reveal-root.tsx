"use client";

import { useReveal } from "@/hooks/use-reveal";

export function RevealRoot({ children }: { children: React.ReactNode }) {
  const ref = useReveal<HTMLDivElement>();
  return <div ref={ref}>{children}</div>;
}
