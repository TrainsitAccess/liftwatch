// Best-effort push notification via ntfy (same stack as the Lighter-Than-Air
// project). Configure NTFY_TOPIC (and optionally NTFY_URL, default
// https://ntfy.sh) as env vars / Netlify env. Without NTFY_TOPIC this is a
// silent no-op. A failure NEVER throws — a missed push must not fail a poll,
// same posture as every other best-effort side call in this project.

export async function pushNotification(
  title: string,
  message: string,
  opts: { priority?: string; tags?: string } = {},
): Promise<void> {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return; // not configured
  const base = process.env.NTFY_URL || "https://ntfy.sh";
  try {
    await fetch(`${base}/${encodeURIComponent(topic)}`, {
      method: "POST",
      headers: {
        // ntfy headers must be ASCII — keep the title plain.
        Title: title.replace(/[^\x20-\x7E]/g, "?"),
        ...(opts.priority ? { Priority: opts.priority } : {}),
        ...(opts.tags ? { Tags: opts.tags } : {}),
      },
      body: message, // body is UTF-8, so station names etc. are fine here
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    console.warn(`  ⚠ ntfy push failed (non-fatal): ${err instanceof Error ? err.message : err}`);
  }
}
