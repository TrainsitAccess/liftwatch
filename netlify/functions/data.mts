import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

// Serves the site's data payloads from Netlify Blobs at the SAME paths the
// static pages have always fetched (/data.json, /systems/{id}.json), so
// index.html/system.html need no URL changes. poll-background.mts refreshes
// these blobs every poll — this is what lets the live site's data update
// every 5 minutes with zero rebuilds/redeploys (see that file's header).
//
// Custom-path functions take precedence over same-path static files by
// default (preferStatic is deliberately NOT set), so the deploy-baked
// site/data.json snapshot from `npm run site:data` is shadowed in
// production — it remains the data source for LOCAL preview (site:serve),
// where this function doesn't exist. Blobs persist across deploys, so the
// only window where they can be empty is the ~5 min between the very first
// deploy and the first poll (or a manually wiped store) — a clear 503
// covers that, and the pages already render a load-failure message.

export default async (req: Request): Promise<Response> => {
  const { pathname } = new URL(req.url);

  // Map the public path to a blob key, strictly — anything else 404s.
  let key: string | null = null;
  if (pathname === "/data.json") key = "data.json";
  else {
    const m = pathname.match(/^\/systems\/([a-z0-9-]+)\.json$/);
    if (m) key = `systems/${m[1]}.json`;
  }
  if (!key) return new Response("Not found", { status: 404 });

  const store = getStore("site-data");
  const blob = await store.get(key, { type: "stream" });
  if (blob) {
    return new Response(blob, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        // Fresh data lands every ~5 min; a short shared cache absorbs bursts
        // without meaningfully staling the board.
        "cache-control": "public, max-age=60",
      },
    });
  }

  return new Response(JSON.stringify({ error: "Data not available yet — first poll pending." }), {
    status: 503,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
};

export const config: Config = {
  path: ["/data.json", "/systems/*"],
};
