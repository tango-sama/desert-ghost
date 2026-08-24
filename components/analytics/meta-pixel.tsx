"use client";

import Script from "next/script";

// Base Meta Pixel loader — mounted once from the root layout (app/layout.tsx),
// never from a page/funnel component, so it survives every client-side
// navigation without re-initializing. `next/script` dedupes by `id`, so even
// if React re-renders this component the underlying <script> tag is only
// ever injected once per page load.
//
// The base snippet itself calls `fbq('init', pixelId, ...)` and
// `fbq('track', 'PageView')` — that covers the PageView for the very first
// load. Route changes after that are handled separately by
// <MetaPixelRouteTracker/> (meta-pixel-route-tracker.tsx), which explicitly
// skips the first render so the two never double-count the same view.
//
// Two things happen BEFORE `init`, and the ordering is the whole point:
//
//  1. `ds_vid` — a random per-browser id passed as Meta's `external_id`.
//     Because it is set here, at init time, EVERY browser event from this
//     page load onward carries it automatically, including the ones with no
//     server-side twin (PageView, AddToCart, InitiateCheckout, Lead,
//     Contact, Search). That is what gives those browser-only events an
//     identifier Meta can match on, which is the documented fallback when
//     an event can't be sent with a shared event id. It is a random value,
//     not derived from anything about the person.
//
//  2. `_fbc` — reconstructed from a `fbclid` URL parameter when the cookie
//     isn't already set. Normally the pixel writes `_fbc` itself on an
//     ad-click landing, but only if it loaded; doing it here first means the
//     click id survives even when the pixel is blocked, and the server copy
//     of the event (which reads this same cookie) still carries attribution.
//     An existing `_fbc` is never overwritten — a valid earlier click wins.
export function MetaPixel({ pixelId }: { pixelId: string }) {
  return (
    <>
      <Script id="meta-pixel-base" strategy="afterInteractive">
        {`
          (function(){
            var vid;
            try {
              vid = localStorage.getItem('ds_vid');
              if (!vid) {
                vid = (crypto && crypto.randomUUID)
                  ? crypto.randomUUID()
                  : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
                localStorage.setItem('ds_vid', vid);
              }
            } catch (e) { vid = undefined; }

            try {
              if (document.cookie.indexOf('_fbc=') === -1) {
                var fbclid = new URLSearchParams(location.search).get('fbclid');
                if (fbclid) {
                  document.cookie = '_fbc=fb.1.' + Date.now() + '.' + fbclid +
                    ';path=/;max-age=7776000;SameSite=Lax';
                }
              }
            } catch (e) {}

            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');

            if (vid) { fbq('init', '${pixelId}', { external_id: vid }); }
            else { fbq('init', '${pixelId}'); }
            fbq('track', 'PageView');
          })();
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
