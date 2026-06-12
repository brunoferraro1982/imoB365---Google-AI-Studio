#!/usr/bin/env python3
import os, json, re, sys
from urllib.request import urlopen, Request
from urllib.parse import urlencode

WP_BASE = "https://imob365.com.br/wp-json/wp/v2"
WP_CATEGORY_MAP = {77: "investidor", 76: "litoral-sul", 79: "planta", 78: "renda"}

def load_env():
    env = {}
    try:
        with open(".env") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    env[k.strip()] = v.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return env

env = load_env()
SUPABASE_URL = env.get("VITE_SUPABASE_URL", os.environ.get("VITE_SUPABASE_URL", ""))
SERVICE_KEY  = env.get("SUPABASE_SERVICE_ROLE_KEY", os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""))

if not SUPABASE_URL or not SERVICE_KEY:
    print("❌ VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no .env")
    sys.exit(1)

def wp_get(endpoint, params=None):
    url = f"{WP_BASE}/{endpoint}"
    if params:
        url += "?" + urlencode(params)
    req = Request(url, headers={"User-Agent": "imob365-migrator/1.0"})
    with urlopen(req, timeout=30) as r:
        total = r.headers.get("X-WP-Total", "?")
        pages = r.headers.get("X-WP-TotalPages", "?")
        data  = json.loads(r.read())
        return data, int(total) if total != "?" else None, int(pages) if pages != "?" else None

def supabase_upsert(table, records):
    url     = f"{SUPABASE_URL}/rest/v1/{table}?on_conflict=wp_id"
    payload = json.dumps(records).encode()
    req = Request(url, data=payload, method="POST", headers={
        "apikey":        SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type":  "application/json",
        "Prefer":        "resolution=merge-duplicates,return=minimal",
    })
    with urlopen(req, timeout=30) as r:
        return r.status

def strip_html_shortcodes(html):
    html = re.sub(r'\[vc_[^\]]+\]', '', html)
    html = re.sub(r'\[/vc_[^\]]+\]', '', html)
    return html.strip()

def main():
    print("📥 Buscando posts do WordPress...")
    all_posts = []
    page = 1
    while True:
        posts, total, total_pages = wp_get("posts", {
            "per_page": 20, "page": page,
            "_fields": "id,slug,title,content,excerpt,date,categories,yoast_head_json,jetpack_featured_media_url",
        })
        all_posts.extend(posts)
        print(f"  Página {page}/{total_pages} — {len(all_posts)}/{total} posts")
        if page >= (total_pages or 1):
            break
        page += 1

    print(f"\n✅ {len(all_posts)} posts. Importando para Supabase...")
    records = []
    for p in all_posts:
        cats  = [WP_CATEGORY_MAP.get(c, str(c)) for c in (p.get("categories") or [])]
        html  = strip_html_shortcodes(p["content"]["rendered"])
        exc   = re.sub('<[^<]+?>', '', p["excerpt"]["rendered"]).strip()
        yoast = p.get("yoast_head_json") or {}
        records.append({
            "wp_id":           p["id"],
            "slug":            p["slug"],
            "titulo":          p["title"]["rendered"],
            "excerpt":         exc[:500] if exc else None,
            "conteudo_html":   html,
            "imagem_capa_url": p.get("jetpack_featured_media_url") or None,
            "autor_nome":      "Equipe imoB365",
            "categorias":      cats,
            "status":          "published",
            "seo_title":       yoast.get("title"),
            "published_at":    p["date"] + "+00:00",
        })

    for i in range(0, len(records), 10):
        batch = records[i:i+10]
        status = supabase_upsert("blog_posts", batch)
        print(f"  ✅ Lote {i//10 + 1} — {len(batch)} posts — HTTP {status}")

    print(f"\n🎉 {len(records)} posts importados com HTML completo.")

if __name__ == "__main__":
    main()
