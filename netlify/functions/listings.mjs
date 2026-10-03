// Serves the current listings to the public site.
// The publish task stores them in this site's environment variables (gzip + base64, split into chunks):
//   MIL_LISTINGS_META = "<generation>:<chunk count>"
//   MIL_LISTINGS_0..n = "<generation>:<chunk>"
// Reading them through the Netlify API means a publish shows up without a rebuild.
// If anything is missing or inconsistent this returns an error and the page falls back to listings.json.
import { gunzipSync } from "node:zlib";

const ACCOUNT = "6ac1008f45051f0b2bf6fd65";
const SITE = "95757246-81c2-41b7-ba42-e41a9ce9681c";

function reply(body, status, cache) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Netlify-CDN-Cache-Control": cache ? "public, s-maxage=60, stale-while-revalidate=300" : "no-store",
    },
  });
}

export default async () => {
  const token = Netlify.env.get("NETLIFY_API_TOKEN");
  if (!token) return reply({ error: "NETLIFY_API_TOKEN is not set" }, 503, false);
  let vars;
  try {
    const r = await fetch(`https://api.netlify.com/api/v1/accounts/${ACCOUNT}/env?site_id=${SITE}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return reply({ error: `netlify api ${r.status}` }, 502, false);
    vars = await r.json();
  } catch (e) {
    return reply({ error: "netlify api unreachable" }, 502, false);
  }
  const value = (key) => {
    const v = Array.isArray(vars) && vars.find((x) => x.key === key);
    if (!v || !Array.isArray(v.values) || !v.values.length) return null;
    const pick = v.values.find((x) => x.context === "all") || v.values.find((x) => x.context === "production") || v.values[0];
    return pick && typeof pick.value === "string" ? pick.value : null;
  };
  const meta = value("MIL_LISTINGS_META");
  const m = meta && /^([A-Za-z0-9]+):(\d+)$/.exec(meta);
  if (!m) return reply({ error: "no published listings yet" }, 404, false);
  const gen = m[1], count = Number(m[2]);
  let data = "";
  for (let i = 0; i < count; i++) {
    const c = value(`MIL_LISTINGS_${i}`);
    if (!c || !c.startsWith(gen + ":")) return reply({ error: "publish in progress" }, 503, false);
    data += c.slice(gen.length + 1);
  }
  try {
    const text = gunzipSync(Buffer.from(data, "base64")).toString("utf8");
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.listings)) throw new Error("bad shape");
    return reply(text, 200, true);
  } catch (e) {
    return reply({ error: "stored listings could not be read" }, 500, false);
  }
};

export const config = { path: "/api/listings" };
