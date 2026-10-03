// Serves the current listings to the public site at /api/listings.
//
// The publish task hands new listings over through this site's environment variables
// (gzip + base64, split into chunks), because that's the one thing it can write to:
//   MIL_LISTINGS_META = "<generation>:<chunk count>"
//   MIL_LISTINGS_0..n = "<generation>:<chunk>"
// On the next request this function reads them through the Netlify API, saves the listings
// to Netlify Blobs, and deletes the variables again (so they never bloat the deploy environment).
// Visitors are always served from Blobs. If anything fails, the page falls back to listings.json.
import { gunzipSync } from "node:zlib";
import { getStore } from "@netlify/blobs";

const ACCOUNT = "6ac1008f45051f0b2bf6fd65";
const SITE = "95757246-81c2-41b7-ba42-e41a9ce9681c";
const API = "https://api.netlify.com/api/v1";

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

function valueOf(vars, key) {
  const v = Array.isArray(vars) && vars.find((x) => x.key === key);
  if (!v || !Array.isArray(v.values) || !v.values.length) return null;
  const pick = v.values.find((x) => x.context === "all") || v.values.find((x) => x.context === "production") || v.values[0];
  return pick && typeof pick.value === "string" ? pick.value : null;
}

async function pullHandover(token, store) {
  const auth = { Authorization: `Bearer ${token}` };
  const r = await fetch(`${API}/accounts/${ACCOUNT}/env?site_id=${SITE}`, { headers: auth });
  if (!r.ok) throw new Error(`netlify api ${r.status}`);
  const vars = await r.json();
  const keys = (Array.isArray(vars) ? vars : []).map((x) => x.key).filter((k) => /^MIL_LISTINGS_(META|\d+)$/.test(k));
  const meta = valueOf(vars, "MIL_LISTINGS_META");
  const m = meta && /^([A-Za-z0-9]+):(\d+)$/.exec(meta);
  if (!m) return null;
  const gen = m[1], count = Number(m[2]);
  let data = "";
  for (let i = 0; i < count; i++) {
    const c = valueOf(vars, `MIL_LISTINGS_${i}`);
    if (!c || !c.startsWith(gen + ":")) return null; // publish still in progress; try again next request
    data += c.slice(gen.length + 1);
  }
  const text = gunzipSync(Buffer.from(data, "base64")).toString("utf8");
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.listings)) throw new Error("bad shape");
  await store.set("listings", text, { metadata: { gen } });
  // clear the handover so the next publish starts clean
  await Promise.all(keys.map((k) => fetch(`${API}/accounts/${ACCOUNT}/env/${k}?site_id=${SITE}`, { method: "DELETE", headers: auth }).catch(() => null)));
  return text;
}

export default async () => {
  const store = getStore({ name: "mil", consistency: "strong" });
  const token = Netlify.env.get("NETLIFY_API_TOKEN");
  let fresh = null;
  if (token) {
    try { fresh = await pullHandover(token, store); } catch (e) { fresh = null; }
  }
  if (fresh) return reply(fresh, 200, true);
  const saved = await store.get("listings");
  if (saved) return reply(saved, 200, true);
  return reply({ error: token ? "no published listings yet" : "NETLIFY_API_TOKEN is not set" }, 404, false);
};

export const config = { path: "/api/listings" };
