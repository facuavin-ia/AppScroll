#!/usr/bin/env python3
"""Actualiza feed.json con virales recientes.

Fuentes (cada una se saltea si falta su clave):
  - YouTube Shorts  -> API oficial (YOUTUBE_API_KEY, o el proxy del entorno inyecta X-Goog-Api-Key)
  - TikTok          -> Apify, actor clockworks/tiktok-scraper (APIFY_TOKEN, o el proxy inyecta Bearer)
Los videos de vidIQ (source=vidiq) que ya están en feed.json se conservan si tienen menos de DAYS*2 días.

Uso: python3 scripts/update_feed.py [--days 21] [--per 6] [--only youtube,tiktok]
"""
import argparse, datetime as dt, json, os, sys, urllib.parse, urllib.request

CATS = {
    "mealprep": {"yt": "meal prep semanal recetas", "tt": ["mealprep", "mealprepfacil", "recetasfit"]},
    "edicion":  {"yt": "edición de video con IA tutorial capcut davinci", "tt": ["edicionconia", "capcuttutorial", "davinciresolve"]},
    "repos":    {"yt": "repositorios github herramientas IA gratis", "tt": ["github", "opensource", "claudecode"]},
    "tools":    {"yt": "herramientas de IA para creadores de contenido", "tt": ["herramientasia", "iaparacreadores"]},
    "retos":    {"yt": "retos con amigos", "tt": ["retosconamigos", "retoviral"]},
    "cartas":   {"yt": "juegos de cartas con amigos", "tt": ["juegosdecartas", "juegosconamigos"]},
    "virales":  {"yt": "momentos graciosos con amigos bromas", "tt": ["humorentreamigos", "bromas"]},
}

def get(url, headers=None, data=None):
    req = urllib.request.Request(url, data=data, headers=headers or {})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read())

def human(n):
    n = int(n or 0)
    return f"{n/1e6:.1f}M" if n >= 1e6 else f"{n/1e3:.0f}K" if n >= 1e3 else str(n)

def youtube(cat, q, since, per):
    key = os.environ.get("YOUTUBE_API_KEY")
    hdr = {} if key else {"X-Goog-Api-Key": "proxy-injected"}
    k = f"&key={key}" if key else ""
    base = "https://www.googleapis.com/youtube/v3/"
    s = get(base + "search?" + urllib.parse.urlencode({
        "part": "snippet", "type": "video", "videoDuration": "short", "order": "viewCount",
        "publishedAfter": since.isoformat().replace("+00:00", "Z"), "q": q, "maxResults": per * 2,
        "relevanceLanguage": "es", "safeSearch": "moderate"}) + k, hdr)
    ids = [i["id"]["videoId"] for i in s.get("items", [])]
    if not ids: return []
    v = get(base + "videos?" + urllib.parse.urlencode({"part": "snippet,statistics,contentDetails", "id": ",".join(ids)}) + k, hdr)
    out = []
    for it in v.get("items", []):
        st, sn = it["statistics"], it["snippet"]
        out.append({"id": "yt_" + it["id"], "cat": cat, "platform": "youtube", "source": "youtube",
                    "url": f"https://www.youtube.com/shorts/{it['id']}", "creator": sn["channelTitle"],
                    "title": sn["title"][:110], "views": human(st.get("viewCount")), "_n": int(st.get("viewCount", 0)),
                    "x": round(int(st.get("likeCount", 0)) / max(int(st.get("viewCount", 1)), 1) * 100, 1),
                    "xlabel": "% likes", "date": sn["publishedAt"][:10],
                    "why": (sn.get("description") or "").split("\n")[0][:140]})
    return sorted(out, key=lambda x: -x["_n"])[:per]

def tiktok(cat, tags, since, per):
    tok = os.environ.get("APIFY_TOKEN")
    hdr = {"Content-Type": "application/json", "Authorization": f"Bearer {tok or 'proxy-injected'}"}
    body = json.dumps({"hashtags": tags, "resultsPerPage": per * 4, "shouldDownloadVideos": False,
                       "shouldDownloadCovers": False, "oldestPostDateUnified": since.date().isoformat()}).encode()
    items = get("https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?timeout=170", hdr, body)
    out = []
    for it in items:
        url, ts = it.get("webVideoUrl"), it.get("createTimeISO", "")
        if not url or (ts and ts[:10] < since.date().isoformat()): continue
        plays = it.get("playCount", 0); fans = (it.get("authorMeta") or {}).get("fans") or 0
        out.append({"id": "tt_" + str(it.get("id")), "cat": cat, "platform": "tiktok", "source": "apify", "url": url,
                    "creator": (it.get("authorMeta") or {}).get("name", "?"), "title": (it.get("text") or "")[:110],
                    "views": human(plays), "_n": plays,
                    "x": round(plays / fans, 1) if fans else 0, "xlabel": "x seguidores", "date": ts[:10],
                    "why": f"{human(it.get('shareCount'))} compartidos · {human(it.get('diggCount'))} likes"})
    seen, res = set(), []
    for o in sorted(out, key=lambda x: -x["_n"]):
        if o["id"] not in seen: seen.add(o["id"]); res.append(o)
    return res[:per]

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--days", type=int, default=21); ap.add_argument("--per", type=int, default=6)
    ap.add_argument("--only", default="youtube,tiktok"); a = ap.parse_args()
    only = set(a.only.split(",")); now = dt.datetime.now(dt.timezone.utc); since = now - dt.timedelta(days=a.days)
    path = os.path.join(os.path.dirname(__file__), "..", "feed.json")
    old = json.load(open(path)) if os.path.exists(path) else {"videos": []}
    keep_after = (now - dt.timedelta(days=a.days * 2)).date().isoformat()
    vidiq = [v for v in old["videos"] if v.get("source", "vidiq") == "vidiq" and v.get("date", "") >= keep_after]
    fresh, errors = [], []
    for cat, c in CATS.items():
        for name, fn, arg in (("youtube", youtube, c["yt"]), ("tiktok", tiktok, c["tt"])):
            if name not in only: continue
            try: got = fn(cat, arg, since, a.per); fresh += got; print(f"{name:8} {cat:9} {len(got)}")
            except Exception as e: errors.append(f"{name}/{cat}: {e}"); print(f"{name:8} {cat:9} ERROR {e}", file=sys.stderr)
    # si una fuente falló entera, conservamos sus videos anteriores
    for src in ("youtube", "apify"):
        if not any(v["source"] == src for v in fresh):
            fresh += [v for v in old["videos"] if v.get("source") == src and v.get("date", "") >= keep_after]
    for v in fresh: v.pop("_n", None)
    ids, videos = set(), []
    for v in vidiq + fresh:
        if v["id"] not in ids: ids.add(v["id"]); videos.append(v)
    json.dump({"updated": now.date().isoformat(), "source": "Claude · vidIQ + YouTube API + Apify",
               "videos": videos, "errors": errors}, open(path, "w"), ensure_ascii=False, indent=1)
    print(f"feed.json: {len(videos)} videos ({len(vidiq)} vidIQ, {len(fresh)} nuevos), {len(errors)} errores")

if __name__ == "__main__":
    main()
