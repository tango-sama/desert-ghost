"use client";

import Script from "next/script";

// Base Meta Pixel loader — mounted once from the root layout (app/layout.tsx),
// never from a page/funnel component, so it survives every client-side
// navigation without re-initializing. `next/script` dedupes by `id`, so even
// if React re-renders this component the underlying <script> tag is only
// ever injected once per page load.
//
// The base snippet itself calls `fbq('init', pixelId)` and
// `fbq('track', 'PageView')` — that covers the PageView for the very first
// load. Route changes after that are handled separately by
// <MetaPixelRouteTracker/> (meta-pixel-route-tracker.tsx), which explicitly
// skips the first render so the two never double-count the same view.
export function MetaPixel({ pixelId }: { pixelId: string }) {
  return (
    <>
      <Script id="meta-pixel-base" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${pixelId}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
