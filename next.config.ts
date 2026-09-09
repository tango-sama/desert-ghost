import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Everything under public/assets — product photos, the funnel imagery,
        // and /quiz's intro clip (4.8 MB of H.264 when this was written, since
        // re-encoded to ~0.5 MB with a ~0.3 MB VP9 twin — still the largest
        // single asset this site serves).
        //
        // Next serves public/ as `public, max-age=0`, so every repeat visit
        // revalidates before the browser may reuse a file it already has. The
        // body does come back as a 304, so nothing is re-downloaded, but the
        // round trip is spent before the hero video can start — on a mobile
        // connection in Algeria that is a real fraction of a second of blank
        // frame, paid again on every visit.
        //
        // A day of max-age removes that entirely, and a week of
        // stale-while-revalidate means a file replaced in a deploy is picked
        // up in the background rather than being waited for. These filenames
        // are not content-hashed, so this is deliberately NOT `immutable`:
        // replacing intro-background.mp4 must not strand a visitor on the old
        // one indefinitely. A day is the bound on how stale an asset can be —
        // raise it if the assets stop changing, lower it before a swap.
        source: "/assets/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
