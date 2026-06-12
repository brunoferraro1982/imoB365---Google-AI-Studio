#!/usr/bin/env python3
"""
imoB365 — WordPress → Supabase Blog Posts Importer
Uso: python3 scripts/import_wp_posts.py

Requer variáveis de ambiente em .env:
  VITE_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY   ← nunca em variável VITE_
"""
import os, json, re, sys
from urllib.request import urlopen, Request
from urllib.parse import urlencode

# ─── Configuração ────────────────────────────────────────────────
WP_BASE      = "https://imob365.com.br/wp-json/wp/v2"
WP_CATEGORY_MAP = {
    77: "investidor",
    76: "litoral-sul",
    79: "planta",
    78: "renda",
}

# Carregar .env manualmente (sem dependências externas)
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
SUPABASE_URL  = env.get("VITE_SUPABASE_URL", os.environ.get("VITE_SUPABASE_URL", ""))
SERVICE_KEY   = env.get("SUPABASE_SERVICE_ROLE_KEY", os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""))

if not SUPABASE_URL or not SERVICE_KEY:
    print("❌ VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no .env")
    sys.exit(1)

# ─── Helpers ─────────────────────────────────────────────────────
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

def get_tenant_id():
    url = f"{SUPABASE_URL}/rest/v1/tenants?select=id&order=created_at.asc&limit=1"
    req = Request(url, headers={
        "apikey":        SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
    })
    with urlopen(req, timeout=15) as r:
        data = json.loads(r.read())
        return data[0]["id"] if data else None

def strip_html_shortcodes(html):
    """Remove WPBakery shortcodes e normaliza HTML."""
    html = re.sub(r'\[vc_[^\]]+\]', '', html)
    html = re.sub(r'\[/vc_[^\]]+\]', '', html)
    return html.strip()

# ─── Main ────────────────────────────────────────────────────────
def main():
    print("🔍 Obtendo tenant_id do Supabase...")
    tenant_id = get_tenant_id()
    if not tenant_id:
        print("  ⚠️  Nenhum tenant encontrado — posts serão importados sem tenant_id")

    print("📥 Buscando posts do WordPress...")
    all_posts = []
    page = 1
    while True:
        posts, total, total_pages = wp_get("posts", {
            "per_page": 20, "page": page,
            "_fields": "id,slug,title,content,excerpt,date,categories,tags,yoast_head_json",
        })
        all_posts.extend(posts)
        print(f"  Página {page}/{total_pages} — {len(all_posts)}/{total} posts")
        if page >= (total_pages or 1):
            break
        page += 1

    print(f"\n✅ {len(all_posts)} posts encontrados. Importando para Supabase...")

    records = []
    for p in all_posts:
        cats  = [WP_CATEGORY_MAP.get(c, str(c)) for c in (p.get("categories") or [])]
        html  = strip_html_shortcodes(p["content"]["rendered"])
        exc   = re.sub('<[^<]+?>', '', p["excerpt"]["rendered"]).strip()
        yoast = p.get("yoast_head_json") or {}

        records.append({
            "tenant_id":       tenant_id,
            "wp_id":           p["id"],
            "slug":            p["slug"],
            "titulo":          p["title"]["rendered"],
            "excerpt":         exc[:500] if exc else None,
            "conteudo_html":   html,
            "categorias":      cats,
            "status":          "published",
            "seo_title":       yoast.get("title"),
            "seo_description": yoast.get("description"),
            "published_at":    p["date"] + "+00:00",
        })

    # Upsert em lotes de 10
    batch_size = 10
    for i in range(0, len(records), batch_size):
        batch = records[i:i+batch_size]
        status = supabase_upsert("blog_posts", batch)
        print(f"  ✅ Lote {i//batch_size + 1} — {len(batch)} posts — HTTP {status}")

    print(f"\n🎉 Importação concluída: {len(records)} posts no Supabase.")
    print("   Acesse: Supabase Dashboard → Table Editor → blog_posts")

if __name__ == "__main__":
    main()
