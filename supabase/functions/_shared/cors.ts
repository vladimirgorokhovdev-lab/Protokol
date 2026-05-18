type CorsOptions = {
  allowedOriginsEnv?: string;
};

const DEFAULT_ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

function parseOrigins(raw: string | null | undefined): string[] {
  return String(raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeOrigin(o: string): string {
  return o.replace(/\/+$/, "");
}

export function corsHeadersForRequest(req: Request, opts: CorsOptions = {}) {
  const origin = req.headers.get("origin") ?? "";

  const allowedOrigins = Array.from(
    new Set(
      parseOrigins(
        opts.allowedOriginsEnv
          ? Deno.env.get(opts.allowedOriginsEnv)
          : undefined,
      )
        .concat(parseOrigins(Deno.env.get("SUPABASE_ALLOWED_ORIGINS")))
        .concat(parseOrigins(Deno.env.get("SITE_URL")))
        .map(normalizeOrigin),
    ),
  );

  const normalizedOrigin = normalizeOrigin(origin);
  const isAllowed =
    normalizedOrigin && allowedOrigins.includes(normalizedOrigin);

  const allowOrigin =
    allowedOrigins.length === 0 ? "*" : isAllowed ? normalizedOrigin : "null";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": DEFAULT_ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    Vary: "Origin",
  };
}

export function handleCorsPreflight(req: Request, opts?: CorsOptions) {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, { headers: corsHeadersForRequest(req, opts) });
}
