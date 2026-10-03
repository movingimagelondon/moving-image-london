#!/usr/bin/env python3
"""Build the publish payload for the public site.

Usage: python3 build_payload.py LISTINGS_DIR [EXISTING_ENV_JSON]

LISTINGS_DIR      folder of <id>.json files from ArtifactData list (out_dir/listings)
EXISTING_ENV_JSON optional file holding the current site env vars (the Netlify
                  manage-env-vars getAllEnvVars result), used to report what changed

Prints JSON: {"changed": bool, "meta": "<gen>:<n>", "chunks": {"MIL_LISTINGS_0": "...", ...},
              "stale_keys": [...], "summary": "..."}
"""
import base64, datetime, glob, gzip, hashlib, json, os, re, sys

CHUNK = 3500
FIELDS = ["title", "artists", "venue", "address", "start", "end", "time", "medium", "url"]


def london_today():
    now = datetime.datetime.now(datetime.timezone.utc)
    y = now.year
    def last_sunday(month):
        d = datetime.datetime(y, month + 1, 1, tzinfo=datetime.timezone.utc) - datetime.timedelta(days=1) if month < 12 else datetime.datetime(y, 12, 31, tzinfo=datetime.timezone.utc)
        return d - datetime.timedelta(days=(d.weekday() + 1) % 7)
    bst = last_sunday(3).replace(hour=1) <= now < last_sunday(10).replace(hour=1)
    return (now + datetime.timedelta(hours=1 if bst else 0)).date()


def load(path):
    d = json.load(open(path, encoding="utf-8"))
    if isinstance(d, dict) and "data" in d and isinstance(d["data"], dict) and "id" in d:
        return d["id"], d["data"]
    return os.path.basename(path)[:-5], d


def build(listings_dir):
    today = london_today()
    out = []
    for p in sorted(glob.glob(os.path.join(listings_dir, "*.json"))):
        i, d = load(p)
        if not d.get("title"):
            continue
        last = d.get("end") or d.get("start")
        try:
            if last and datetime.date.fromisoformat(last) < today - datetime.timedelta(days=7):
                continue
        except ValueError:
            pass
        r = {"id": i, "kind": d.get("kind") or "exhibition"}
        for f in FIELDS:
            r[f] = str(d.get(f) or "")
        r["free"] = d.get("free") is True
        out.append(r)
    out.sort(key=lambda r: r["id"])
    return today, out


def env_value(env, key):
    for v in env if isinstance(env, list) else []:
        if v.get("key") == key:
            vals = v.get("values") or []
            pick = next((x for x in vals if x.get("context") == "all"), None) or (vals[0] if vals else None)
            return pick.get("value") if pick else None
    return None


def existing_listings(env):
    meta = env_value(env, "MIL_LISTINGS_META") or ""
    m = re.match(r"^([A-Za-z0-9]+):(\d+)$", meta)
    if not m:
        return None, None
    gen, n = m.group(1), int(m.group(2))
    data = ""
    for i in range(n):
        c = env_value(env, f"MIL_LISTINGS_{i}") or ""
        if not c.startswith(gen + ":"):
            return gen, None
        data += c[len(gen) + 1:]
    try:
        return gen, json.loads(gzip.decompress(base64.b64decode(data)).decode("utf-8"))["listings"]
    except Exception:
        return gen, None


def main():
    listings_dir = sys.argv[1]
    env = None
    if len(sys.argv) > 2 and os.path.exists(sys.argv[2]):
        raw = json.load(open(sys.argv[2], encoding="utf-8"))
        env = raw if isinstance(raw, list) else raw.get("envVars") or raw.get("data") or raw
    today, listings = build(listings_dir)
    body = json.dumps({"updated": str(today), "listings": listings}, ensure_ascii=False, separators=(",", ":"))
    gen = hashlib.sha1(json.dumps(listings, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:10]
    b64 = base64.b64encode(gzip.compress(body.encode("utf-8"), mtime=0)).decode()
    parts = [b64[i:i + CHUNK] for i in range(0, len(b64), CHUNK)] or [""]
    chunks = {f"MIL_LISTINGS_{i}": f"{gen}:{p}" for i, p in enumerate(parts)}
    old_gen, old = existing_listings(env) if env is not None else (None, None)
    stale = []
    if isinstance(env, list):
        for v in env:
            k = v.get("key", "")
            if re.match(r"^MIL_LISTINGS_\d+$", k) and k not in chunks:
                stale.append(k)
    changed = old_gen != gen
    ex = sum(1 for r in listings if r["kind"] != "screening")
    summary = f"{len(listings)} listings ({ex} exhibitions / {len(listings) - ex} screenings)"
    if old is not None:
        before = {r["id"]: r for r in old}
        after = {r["id"]: r for r in listings}
        added = [after[k]["title"] for k in after if k not in before]
        removed = [before[k]["title"] for k in before if k not in after]
        edited = [after[k]["title"] for k in after if k in before and after[k] != before[k]]
        bits = [f"added: {', '.join(added)}" if added else "", f"removed: {', '.join(removed)}" if removed else "", f"changed: {', '.join(edited)}" if edited else ""]
        bits = [b for b in bits if b]
        if bits:
            summary += "; " + "; ".join(bits)
    print(json.dumps({"changed": changed, "meta": f"{gen}:{len(parts)}", "chunks": chunks, "stale_keys": stale, "summary": summary}, ensure_ascii=False))


if __name__ == "__main__":
    main()
