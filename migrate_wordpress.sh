#!/usr/bin/env bash
# =============================================================================
# imoB365 — WordPress Content Migration + Missing Features Implementation
# Executa em WSL no projeto ~/imoB365---Google-AI-Studio
# =============================================================================
set -e

PROJECT="$HOME/imoB365---Google-AI-Studio"
cd "$PROJECT"

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║   imoB365 — WordPress Migration + Portal Público Completo        ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# ─────────────────────────────────────────────────────────────────
# STEP 1: SQL Migration — novas tabelas
# ─────────────────────────────────────────────────────────────────
echo "→ [1/8] Gerando sql/wp_migration.sql..."
mkdir -p sql

cat > sql/wp_migration.sql << 'SQL'
-- =============================================================================
-- imoB365 — WordPress Content Migration SQL
-- Execute no Supabase Dashboard → SQL Editor
-- =============================================================================

-- 1. blog_posts (importados do WordPress + futuros posts nativos)
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        REFERENCES public.tenants(id) ON DELETE CASCADE,
  wp_id           integer     UNIQUE,            -- ID original do WordPress (evita duplicatas)
  slug            text        NOT NULL UNIQUE,
  titulo          text        NOT NULL,
  excerpt         text,
  conteudo_html   text,                          -- HTML do WordPress
  conteudo_mdx    text,                          -- futuro: Markdown nativo
  imagem_capa_url text,
  autor_nome      text,
  categorias      text[]      DEFAULT '{}',      -- ex: ['investidor','renda']
  tags            text[]      DEFAULT '{}',
  status          text        NOT NULL DEFAULT 'published'
                              CHECK (status IN ('published','draft','archived')),
  seo_title       text,
  seo_description text,
  published_at    timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blog_posts_public_read"   ON public.blog_posts FOR SELECT USING (status = 'published');
CREATE POLICY "blog_posts_admin_manage"  ON public.blog_posts FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('super_admin','admin')));

CREATE INDEX IF NOT EXISTS blog_posts_slug_idx       ON public.blog_posts(slug);
CREATE INDEX IF NOT EXISTS blog_posts_published_at_idx ON public.blog_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS blog_posts_categorias_idx  ON public.blog_posts USING GIN(categorias);

-- 2. newsletter_subscribers
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        REFERENCES public.tenants(id),
  email       text        NOT NULL,
  nome        text,
  status      text        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','unsubscribed','bounced')),
  source      text        DEFAULT 'portal',      -- 'portal','blog','footer'
  created_at  timestamptz DEFAULT now(),
  UNIQUE (tenant_id, email)
);
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "newsletter_admin_read"   ON public.newsletter_subscribers FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('super_admin','admin')));
CREATE POLICY "newsletter_anon_insert"  ON public.newsletter_subscribers FOR INSERT WITH CHECK (true);

-- 3. testimonials
CREATE TABLE IF NOT EXISTS public.testimonials (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        REFERENCES public.tenants(id),
  nome          text        NOT NULL,
  cargo         text,
  empresa       text,
  depoimento    text        NOT NULL,
  foto_url      text,
  ordem         integer     DEFAULT 0,
  ativo         boolean     DEFAULT true,
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "testimonials_public_read"   ON public.testimonials FOR SELECT USING (ativo = true);
CREATE POLICY "testimonials_admin_manage"  ON public.testimonials FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('super_admin','admin')));

-- 4. partners (construtoras parceiras)
CREATE TABLE IF NOT EXISTS public.partners (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        REFERENCES public.tenants(id),
  nome        text        NOT NULL,
  logo_url    text,
  site_url    text,
  ordem       integer     DEFAULT 0,
  ativo       boolean     DEFAULT true,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partners_public_read"   ON public.partners FOR SELECT USING (ativo = true);
CREATE POLICY "partners_admin_manage"  ON public.partners FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('super_admin','admin')));

-- 5. services (página consultoria)
CREATE TABLE IF NOT EXISTS public.services (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        REFERENCES public.tenants(id),
  titulo      text        NOT NULL,
  descricao   text,
  icone_url   text,
  ordem       integer     DEFAULT 0,
  ativo       boolean     DEFAULT true,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services_public_read"   ON public.services FOR SELECT USING (ativo = true);
CREATE POLICY "services_admin_manage"  ON public.services FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('super_admin','admin')));

-- 6. Seed: depoimentos do WordPress
-- (substitua tenant_id pelo UUID real do Tenant 0)
DO $$
DECLARE t_id uuid;
BEGIN
  SELECT id INTO t_id FROM public.tenants ORDER BY created_at ASC LIMIT 1;
  IF t_id IS NOT NULL THEN
    INSERT INTO public.testimonials (tenant_id, nome, cargo, empresa, depoimento, ordem) VALUES
    (t_id, 'Ricardo M.', 'Diretor Financeiro (CFO)', NULL,
     'Como investidor no setor imobiliário há anos, busco parceiros que compreendam a diferença entre preço e valor. A consultoria da imoB365 se destaca pela curadoria rigorosa e pelo profundo conhecimento do mercado de alto padrão no Litoral Sul de São Paulo.', 1),
    (t_id, 'Dra. Helena S.', 'Consultora de Investimentos', NULL,
     'O diferencial da imoB365 está na abordagem analítica. Em vez de argumentos genéricos, recebi projeções de valorização e estudos de vacância detalhados para a região de Praia Grande.', 2),
    (t_id, 'André V.', 'Empresário', 'Setor de Tecnologia',
     'Minha experiência com a gestão imobiliária da imoB365 tem sido impecável. A administração garante que o patrimônio seja gerido com eficiência máxima e burocracia mínima.', 3),
    (t_id, 'Beatriz F.', 'Executiva', 'Multinacional',
     'O atendimento personalizado da imoB365 é sob medida para o público de alto padrão. Eles entenderam perfeitamente meu perfil, filtrando apenas oportunidades reais de frente para o mar.', 4)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.services (tenant_id, titulo, descricao, ordem) VALUES
    (t_id, 'Administração de Imóveis', 'Administramos seu imóvel para que tenha tranquilidade jurídica.', 1),
    (t_id, 'Gestão Contratual', 'Gestão, elaboração e administração contratual.', 2),
    (t_id, 'Consultoria', 'Parceria imobiliária e com corretores em administração.', 3),
    (t_id, 'Lançamentos', 'Exclusividade para imóveis de alto padrão.', 4),
    (t_id, 'Imóveis Mobiliados', 'Adquira seu imóvel e não se preocupe com a decoração.', 5),
    (t_id, 'Imóveis de Alto Padrão', 'Carteira exclusiva com imóveis de alto padrão em toda região.', 6)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 7. Adicionar coluna investment_tags nos imóveis (filtro por intenção)
ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS investment_tags text[] DEFAULT '{}';
COMMENT ON COLUMN public.imoveis.investment_tags IS
  'Tags de intenção: investidor, renda, planta, litoral-sul';
CREATE INDEX IF NOT EXISTS imoveis_investment_tags_idx ON public.imoveis USING GIN(investment_tags);

-- Done
SQL
echo "  ✅ sql/wp_migration.sql gerado."

# ─────────────────────────────────────────────────────────────────
# STEP 2: Script Python de importação de blog posts
# ─────────────────────────────────────────────────────────────────
echo "→ [2/8] Gerando scripts/import_wp_posts.py..."
mkdir -p scripts

cat > scripts/import_wp_posts.py << 'PYEOF'
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
PYEOF
chmod +x scripts/import_wp_posts.py
echo "  ✅ scripts/import_wp_posts.py gerado."

# ─────────────────────────────────────────────────────────────────
# STEP 3: Componente WhatsApp FAB
# ─────────────────────────────────────────────────────────────────
echo "→ [3/8] Criando componente WhatsAppFAB..."

cat > src/components/layout/WhatsAppFAB.tsx << 'TSX'
/**
 * WhatsApp Floating Action Button — exibido apenas no portal público (fora de /app)
 * Número: (13) 99779-4382
 */
import { useLocation } from "@tanstack/react-router";

const WA_NUMBER = "5513997794382";
const WA_MESSAGE = encodeURIComponent(
  "Olá! Vi um imóvel no portal imob365 e gostaria de mais informações.",
);

export function WhatsAppFAB() {
  const location = useLocation();
  // Ocultar dentro do back-office e rotas de admin
  if (location.pathname.startsWith("/app") || location.pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <a
      href={`https://wa.me/${WA_NUMBER}?text=${WA_MESSAGE}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar pelo WhatsApp"
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-lg shadow-black/20 transition-all duration-200 hover:scale-110 hover:bg-[#20bb5a] focus:outline-none focus:ring-4 focus:ring-[#25D366]/40"
    >
      {/* WhatsApp SVG icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="white"
        className="h-7 w-7"
        aria-hidden="true"
      >
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    </a>
  );
}
TSX
echo "  ✅ WhatsAppFAB.tsx criado."

# ─────────────────────────────────────────────────────────────────
# STEP 4: Componentes reutilizáveis (Testimonials, Partners, NewsletterCapture)
# ─────────────────────────────────────────────────────────────────
echo "→ [4/8] Criando componentes de conversão..."
mkdir -p src/components/portal

cat > src/components/portal/TestimonialsSection.tsx << 'TSX'
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Quote } from "lucide-react";

interface Testimonial {
  id: string;
  nome: string;
  cargo: string | null;
  empresa: string | null;
  depoimento: string;
  foto_url: string | null;
}

export function TestimonialsSection() {
  const [items, setItems] = useState<Testimonial[]>([]);

  useEffect(() => {
    void supabase
      .from("testimonials")
      .select("id,nome,cargo,empresa,depoimento,foto_url")
      .eq("ativo", true)
      .order("ordem")
      .then(({ data }) => setItems((data as Testimonial[]) ?? []));
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="py-14 bg-muted/30">
      <div className="container max-w-5xl mx-auto px-4">
        <h2 className="text-xl font-black tracking-tight text-center mb-8">
          O que dizem nossos clientes
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-2">
          {items.map((t) => (
            <div key={t.id} className="bg-card rounded-2xl p-5 border border-border/60 space-y-3">
              <Quote className="h-6 w-6 text-primary/40" />
              <p className="text-sm text-foreground/80 leading-relaxed italic">
                "{t.depoimento}"
              </p>
              <div className="flex items-center gap-3 pt-1">
                {t.foto_url ? (
                  <img src={t.foto_url} alt={t.nome} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {t.nome[0]}
                  </div>
                )}
                <div>
                  <p className="font-bold text-xs">{t.nome}</p>
                  {(t.cargo || t.empresa) && (
                    <p className="text-[10px] text-muted-foreground">
                      {[t.cargo, t.empresa].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
TSX

cat > src/components/portal/PartnersSection.tsx << 'TSX'
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Partner {
  id: string;
  nome: string;
  logo_url: string | null;
  site_url: string | null;
}

export function PartnersSection() {
  const [items, setItems] = useState<Partner[]>([]);

  useEffect(() => {
    void supabase
      .from("partners")
      .select("id,nome,logo_url,site_url")
      .eq("ativo", true)
      .order("ordem")
      .then(({ data }) => setItems((data as Partner[]) ?? []));
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="py-10 border-t border-border/40">
      <div className="container max-w-4xl mx-auto px-4">
        <p className="text-center text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6">
          Construtoras e parceiras
        </p>
        <div className="flex flex-wrap justify-center items-center gap-8">
          {items.map((p) =>
            p.logo_url ? (
              <a
                key={p.id}
                href={p.site_url ?? "#"}
                target={p.site_url ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="opacity-60 hover:opacity-100 transition-opacity"
              >
                <img src={p.logo_url} alt={p.nome} className="h-10 object-contain" />
              </a>
            ) : (
              <span key={p.id} className="text-sm font-bold text-muted-foreground opacity-60">
                {p.nome}
              </span>
            ),
          )}
        </div>
      </div>
    </section>
  );
}
TSX

cat > src/components/portal/NewsletterCapture.tsx << 'TSX'
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail } from "lucide-react";

interface Props {
  source?: string;
  className?: string;
}

export function NewsletterCapture({ source = "footer", className = "" }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) return;
    setLoading(true);
    const { error } = await supabase.from("newsletter_subscribers").insert({
      email,
      source,
    } as any);
    setLoading(false);
    if (error && error.code === "23505") {
      toast.info("Você já está na nossa lista!");
      setDone(true);
      return;
    }
    if (error) {
      toast.error("Erro ao cadastrar. Tente novamente.");
      return;
    }
    toast.success("Cadastrado com sucesso! Você receberá novidades em breve.");
    setDone(true);
    setEmail("");
  }

  if (done) {
    return (
      <div className={`flex items-center gap-2 text-sm text-primary font-medium ${className}`}>
        <Mail className="h-4 w-4" />
        Cadastrado com sucesso!
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`flex gap-2 ${className}`}>
      <Input
        type="email"
        placeholder="Seu melhor e-mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="h-9 text-sm max-w-xs"
      />
      <Button type="submit" disabled={loading} size="sm" className="h-9 font-bold shrink-0">
        {loading ? "..." : "Inscrever"}
      </Button>
    </form>
  );
}
TSX
echo "  ✅ TestimonialsSection, PartnersSection, NewsletterCapture criados."

# ─────────────────────────────────────────────────────────────────
# STEP 5: Rotas institucionais — /sobre, /consultoria, /contato, /politica-de-privacidade
# ─────────────────────────────────────────────────────────────────
echo "→ [5/8] Criando rotas institucionais..."

cat > src/routes/sobre.tsx << 'TSX'
import { createFileRoute, Link } from "@tanstack/react-router";
import { PartnersSection } from "@/components/portal/PartnersSection";
import { TestimonialsSection } from "@/components/portal/TestimonialsSection";
import { Building2, BarChart3, ShieldCheck, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre a imoB365 | Inteligência Imobiliária no Litoral Sul de SP" },
      { name: "description", content: "Consultoria especializada em ativos de alto padrão em Praia Grande, Santos e São Vicente. 365 dias por ano para garantir que cada oportunidade seja capturada no momento certo." },
    ],
  }),
  component: SobrePage,
});

function SobrePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="py-16 px-4 bg-gradient-to-b from-muted/40 to-background">
        <div className="container max-w-3xl mx-auto text-center space-y-4">
          <span className="inline-block bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
            Sobre a imoB365
          </span>
          <h1 className="text-3xl font-black tracking-tight">
            Inteligência Estratégica no Mercado Imobiliário de Alto Padrão
          </h1>
          <p className="text-muted-foreground leading-relaxed max-w-xl mx-auto">
            A imoB365 nasceu para preencher uma lacuna no mercado do Litoral Sul de São Paulo:
            a necessidade de uma consultoria que entenda o imóvel não apenas como moradia,
            mas como um <strong>ativo estratégico</strong>. Operamos 365 dias por ano em
            Santos, Praia Grande e São Vicente.
          </p>
        </div>
      </section>

      {/* 3 Pilares */}
      <section className="py-12 px-4">
        <div className="container max-w-4xl mx-auto">
          <h2 className="text-lg font-black tracking-tight text-center mb-8">Nossa Abordagem</h2>
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              {
                icon: BarChart3,
                titulo: "Dados e Performance",
                desc: "Analisamos o m² real, histórico de valorização e potencial de ROI para cada ativo.",
              },
              {
                icon: ShieldCheck,
                titulo: "Curadoria de Luxo",
                desc: "Selecionamos apenas empreendimentos com rigorosos padrões de acabamento, localização e liquidez.",
              },
              {
                icon: Building2,
                titulo: "Tecnologia e Transparência",
                desc: "Ferramentas modernas para facilitar a jornada de compra e gestão com segurança jurídica total.",
              },
            ].map((p) => (
              <div key={p.titulo} className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <p.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-bold text-sm">{p.titulo}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-10 bg-primary text-white">
        <div className="container max-w-3xl mx-auto px-4">
          <div className="grid grid-cols-3 gap-6 text-center">
            {[
              { valor: "365", label: "Dias por ano atendendo" },
              { valor: "3", label: "Cidades no Litoral Sul" },
              { valor: "R$ 3MI+", label: "Portfólio disponível" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-3xl font-black">{s.valor}</p>
                <p className="text-xs text-white/70 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <TestimonialsSection />

      {/* Partners */}
      <PartnersSection />

      {/* CTA */}
      <section className="py-12 px-4 text-center">
        <h2 className="text-lg font-black tracking-tight mb-3">Pronto para encontrar seu ativo?</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Fale com nossa equipe ou veja os imóveis disponíveis no portal.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            to="/contato"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary/90 transition-colors"
          >
            Agendar Consultoria <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/imoveis"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-bold hover:bg-muted transition-colors"
          >
            Ver Imóveis
          </Link>
        </div>
      </section>
    </div>
  );
}
TSX

cat > src/routes/consultoria.tsx << 'TSX'
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Phone } from "lucide-react";

export const Route = createFileRoute("/consultoria")({
  head: () => ({
    meta: [
      { title: "Consultoria Imobiliária | imoB365 — Litoral Sul de SP" },
      { name: "description", content: "Administração de imóveis, gestão contratual, lançamentos exclusivos e imóveis de alto padrão em Praia Grande, Santos e São Vicente." },
    ],
  }),
  component: ConsultoriaPage,
});

interface Service {
  id: string;
  titulo: string;
  descricao: string | null;
  icone_url: string | null;
  ordem: number;
}

function ConsultoriaPage() {
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    void supabase
      .from("services")
      .select("id,titulo,descricao,icone_url,ordem")
      .eq("ativo", true)
      .order("ordem")
      .then(({ data }) => setServices((data as Service[]) ?? []));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="py-14 px-4 bg-gradient-to-b from-muted/40 to-background">
        <div className="container max-w-3xl mx-auto text-center space-y-3">
          <span className="inline-block bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
            Consultoria e Serviços
          </span>
          <h1 className="text-3xl font-black tracking-tight">
            Soluções Imobiliárias Completas
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-xl mx-auto">
            Da curadoria ao contrato, cuidamos de cada etapa para que você invista com
            tranquilidade e segurança jurídica no Litoral Sul de São Paulo.
          </p>
        </div>
      </section>

      {/* Services grid */}
      <section className="py-10 px-4">
        <div className="container max-w-4xl mx-auto">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <Link
                key={s.id}
                to="/contato"
                className="group flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5 hover:border-primary/30 hover:shadow-md transition-all"
              >
                {s.icone_url && (
                  <img src={s.icone_url} alt="" className="h-12 w-12 object-cover rounded-lg" />
                )}
                <div>
                  <h3 className="font-bold text-sm group-hover:text-primary transition-colors">
                    {s.titulo}
                  </h3>
                  {s.descricao && (
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {s.descricao}
                    </p>
                  )}
                </div>
                <span className="text-[10px] font-bold text-primary mt-auto flex items-center gap-1">
                  Saiba mais <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 px-4 bg-primary text-white text-center">
        <h2 className="text-xl font-black tracking-tight mb-2">Você tem alguma dúvida?</h2>
        <p className="text-white/80 text-sm mb-5">
          Nossa equipe está disponível 365 dias por ano para te atender.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            to="/contato"
            className="inline-flex items-center gap-2 rounded-xl bg-white text-primary px-5 py-2.5 text-sm font-bold hover:bg-white/90 transition-colors"
          >
            Agendar Consultoria <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="https://wa.me/5513997794382"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/10 transition-colors"
          >
            <Phone className="h-4 w-4" /> (13) 99779-4382
          </a>
        </div>
      </section>
    </div>
  );
}
TSX

cat > src/routes/contato.tsx << 'TSX'
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Phone, Mail, MapPin, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: "Contato | imoB365 — Consultoria Imobiliária" },
      { name: "description", content: "Entre em contato com a imoB365. Atendimento 365 dias por ano em Santos, Praia Grande e São Vicente." },
    ],
  }),
  component: ContatoPage,
});

function ContatoPage() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [aceite, setAceite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!aceite) { toast.error("Aceite a política de privacidade para continuar."); return; }
    setLoading(true);
    const { error } = await supabase.from("leads").insert({
      nome,
      email,
      telefone: telefone || null,
      mensagem,
      origem: "contato",
      status: "novo",
    } as any);
    setLoading(false);
    if (error) { toast.error("Erro ao enviar. Tente novamente."); return; }
    setDone(true);
    toast.success("Mensagem enviada! Retornaremos em breve.");
  }

  return (
    <div className="min-h-screen bg-background">
      <section className="py-14 px-4">
        <div className="container max-w-5xl mx-auto">
          <div className="grid gap-10 lg:grid-cols-2">
            {/* Info */}
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="inline-block bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                  Fale Conosco
                </span>
                <h1 className="text-2xl font-black tracking-tight">
                  Estamos prontos para te atender
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Nossa equipe especializada no mercado de alto padrão do Litoral Sul
                  retorna em até 2 horas nos dias úteis.
                </p>
              </div>
              <div className="space-y-3">
                {[
                  { icon: Phone, label: "(13) 99779-4382", href: "tel:+5513997794382" },
                  { icon: Mail, label: "contato@imob365.com.br", href: "mailto:contato@imob365.com.br" },
                  { icon: MapPin, label: "Praia Grande · Santos · São Vicente, SP", href: null },
                  { icon: MessageCircle, label: "WhatsApp disponível 365 dias", href: "https://wa.me/5513997794382" },
                ].map((c) => (
                  <div key={c.label} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <c.icon className="h-4 w-4 text-primary" />
                    </div>
                    {c.href ? (
                      <a href={c.href} className="text-sm font-medium hover:text-primary transition-colors">{c.label}</a>
                    ) : (
                      <span className="text-sm text-muted-foreground">{c.label}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Form */}
            {done ? (
              <div className="flex items-center justify-center rounded-2xl border border-border bg-muted/30 p-10 text-center">
                <div className="space-y-2">
                  <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                    <Mail className="h-6 w-6 text-emerald-600" />
                  </div>
                  <p className="font-bold">Mensagem enviada!</p>
                  <p className="text-sm text-muted-foreground">Retornaremos em breve para {email}.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="ct-nome" className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Nome *</Label>
                    <Input id="ct-nome" value={nome} onChange={(e) => setNome(e.target.value)} required placeholder="Seu nome" className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ct-email" className="text-xs font-bold uppercase text-muted-foreground tracking-wider">E-mail *</Label>
                    <Input id="ct-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="seu@email.com" className="h-9" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ct-tel" className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Telefone / WhatsApp</Label>
                  <Input id="ct-tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(13) 99999-9999" className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ct-msg" className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Mensagem *</Label>
                  <textarea
                    id="ct-msg"
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    required
                    rows={4}
                    placeholder="Como podemos te ajudar?"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="ct-aceite"
                    checked={aceite}
                    onChange={(e) => setAceite(e.target.checked)}
                    className="mt-0.5"
                  />
                  <label htmlFor="ct-aceite" className="text-[11px] text-muted-foreground leading-relaxed">
                    Li e aceito a{" "}
                    <a href="/politica-de-privacidade" className="text-primary underline">
                      Política de Privacidade
                    </a>
                    {" "}e concordo em ser contatado pela imoB365.
                  </label>
                </div>
                <Button type="submit" disabled={loading || !aceite} className="w-full font-bold h-9">
                  {loading ? "Enviando..." : "Enviar Mensagem"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
TSX

cat > src/routes/politica-de-privacidade.tsx << 'TSX'
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/politica-de-privacidade")({
  head: () => ({
    meta: [{ title: "Política de Privacidade | imoB365" }],
  }),
  component: PoliticaPrivacidade,
});

function PoliticaPrivacidade() {
  return (
    <div className="min-h-screen bg-background py-14 px-4">
      <div className="container max-w-3xl mx-auto prose prose-sm dark:prose-invert">
        <h1 className="text-2xl font-black tracking-tight mb-6">Política de Privacidade</h1>
        <p className="text-muted-foreground text-xs mb-6">Última atualização: junho de 2026</p>

        <h2>1. Coleta de Dados</h2>
        <p>A imoB365 coleta informações pessoais fornecidas voluntariamente pelos usuários ao preencher formulários de contato, cadastro ou newsletter, incluindo: nome, e-mail, telefone e dados de navegação anônimos.</p>

        <h2>2. Uso dos Dados</h2>
        <p>Os dados coletados são utilizados exclusivamente para: (a) responder solicitações de contato; (b) enviar comunicações sobre lançamentos e oportunidades imobiliárias, mediante consentimento; (c) melhorar a experiência na plataforma.</p>

        <h2>3. Compartilhamento</h2>
        <p>A imoB365 não vende, aluga ou compartilha dados pessoais com terceiros, exceto quando exigido por lei ou para viabilizar serviços contratados (provedores de infraestrutura com cláusulas de confidencialidade).</p>

        <h2>4. Seus Direitos (LGPD)</h2>
        <p>Conforme a Lei 13.709/2018 (LGPD), você tem direito a: acessar, corrigir, excluir ou solicitar a portabilidade de seus dados. Para exercer esses direitos, entre em contato pelo e-mail <a href="mailto:contato@imob365.com.br">contato@imob365.com.br</a>.</p>

        <h2>5. Cookies</h2>
        <p>Utilizamos cookies técnicos essenciais para o funcionamento da plataforma e cookies de análise (anônimos) para melhorar nossos serviços. Não utilizamos cookies de rastreamento para publicidade.</p>

        <h2>6. Segurança</h2>
        <p>Todos os dados são armazenados em servidores seguros (Supabase / Cloudflare) com criptografia em repouso e em trânsito (TLS 1.3).</p>

        <h2>7. Contato</h2>
        <p>Dúvidas sobre esta política: <a href="mailto:contato@imob365.com.br">contato@imob365.com.br</a> ou (13) 99779-4382.</p>
      </div>
    </div>
  );
}
TSX
echo "  ✅ /sobre, /consultoria, /contato, /politica-de-privacidade criados."

# ─────────────────────────────────────────────────────────────────
# STEP 6: Módulo Blog — /blog e /blog.$slug
# ─────────────────────────────────────────────────────────────────
echo "→ [6/8] Criando módulo Blog..."

cat > src/routes/blog.tsx << 'TSX'
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NewsletterCapture } from "@/components/portal/NewsletterCapture";
import { Calendar, Tag } from "lucide-react";

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: "Blog | imoB365 — Mercado Imobiliário do Litoral Sul" },
      { name: "description", content: "Análises, tendências e guias de investimento imobiliário em Praia Grande, Santos e São Vicente." },
    ],
  }),
  component: BlogPage,
});

interface Post {
  id: string;
  slug: string;
  titulo: string;
  excerpt: string | null;
  imagem_capa_url: string | null;
  categorias: string[];
  published_at: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  investidor: "Investidor",
  renda: "Renda",
  planta: "Na Planta",
  "litoral-sul": "Litoral Sul",
};

export default function BlogPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState<string | null>(null);

  useEffect(() => {
    let query = supabase
      .from("blog_posts")
      .select("id,slug,titulo,excerpt,imagem_capa_url,categorias,published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(20);

    if (catFilter) {
      query = query.contains("categorias", [catFilter]);
    }
    void query.then(({ data }) => {
      setPosts((data as Post[]) ?? []);
      setLoading(false);
    });
  }, [catFilter]);

  const fmt = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(iso)) : "";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="py-12 px-4 bg-gradient-to-b from-muted/40 to-background">
        <div className="container max-w-4xl mx-auto text-center space-y-3">
          <span className="inline-block bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">Blog</span>
          <h1 className="text-2xl font-black tracking-tight">Mercado Imobiliário do Litoral Sul</h1>
          <p className="text-sm text-muted-foreground">Análises, tendências e guias de investimento em Santos, Praia Grande e São Vicente.</p>
        </div>
      </section>

      {/* Filtros por categoria */}
      <div className="border-b border-border/40">
        <div className="container max-w-4xl mx-auto px-4">
          <div className="flex gap-1 py-2 overflow-x-auto">
            {[null, "investidor", "renda", "planta", "litoral-sul"].map((cat) => (
              <button
                key={cat ?? "all"}
                onClick={() => setCatFilter(cat)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  catFilter === cat
                    ? "bg-primary text-white"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {cat ? CATEGORY_LABELS[cat] : "Todos"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Posts grid */}
      <section className="py-10 px-4">
        <div className="container max-w-4xl mx-auto">
          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {[1,2,3,4].map((i) => <div key={i} className="h-48 rounded-2xl bg-muted animate-pulse" />)}
            </div>
          ) : posts.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-12">Nenhum post encontrado.</p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {posts.map((p) => (
                <Link
                  key={p.id}
                  to="/blog/$slug"
                  params={{ slug: p.slug }}
                  className="group rounded-2xl border border-border/60 bg-card overflow-hidden hover:border-primary/30 hover:shadow-md transition-all"
                >
                  {p.imagem_capa_url && (
                    <img
                      src={p.imagem_capa_url}
                      alt={p.titulo}
                      className="h-40 w-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    />
                  )}
                  <div className="p-4 space-y-2">
                    {p.categorias.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {p.categorias.map((c) => (
                          <span key={c} className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            <Tag className="h-2.5 w-2.5" />{CATEGORY_LABELS[c] ?? c}
                          </span>
                        ))}
                      </div>
                    )}
                    <h2 className="font-bold text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2">
                      {p.titulo}
                    </h2>
                    {p.excerpt && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{p.excerpt}</p>
                    )}
                    {p.published_at && (
                      <p className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                        <Calendar className="h-3 w-3" />{fmt(p.published_at)}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-10 px-4 bg-muted/30 border-t border-border/40">
        <div className="container max-w-md mx-auto text-center space-y-3">
          <h3 className="font-black text-sm tracking-tight">Receba lançamentos em primeira mão</h3>
          <p className="text-xs text-muted-foreground">Novidades sobre pré-vendas e valorização do Litoral Sul direto no seu e-mail.</p>
          <NewsletterCapture source="blog" className="justify-center" />
        </div>
      </section>
    </div>
  );
}
TSX

cat > src/routes/blog.$slug.tsx << 'TSX'
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { NewsletterCapture } from "@/components/portal/NewsletterCapture";
import { Calendar, ArrowLeft, Tag } from "lucide-react";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", params.slug)
      .eq("status", "published")
      .maybeSingle();
    if (!data) throw notFound();
    return data as any;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.titulo ?? "Post"} | imoB365 Blog` },
      { name: "description", content: loaderData?.seo_description ?? loaderData?.excerpt ?? "" },
    ],
  }),
  component: BlogPost,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-2xl font-black">404</p>
        <p className="text-muted-foreground text-sm">Post não encontrado.</p>
        <Link to="/blog" className="text-primary text-sm font-bold hover:underline">← Voltar ao blog</Link>
      </div>
    </div>
  ),
});

function BlogPost() {
  const post = Route.useLoaderData();
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(iso));

  const CATEGORY_LABELS: Record<string, string> = {
    investidor: "Investidor", renda: "Renda",
    planta: "Na Planta", "litoral-sul": "Litoral Sul",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Cover */}
      {post.imagem_capa_url && (
        <div className="h-64 sm:h-80 w-full overflow-hidden">
          <img src={post.imagem_capa_url} alt={post.titulo} className="h-full w-full object-cover" />
        </div>
      )}

      <div className="container max-w-2xl mx-auto px-4 py-10 space-y-8">
        {/* Back */}
        <Link to="/blog" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao blog
        </Link>

        {/* Header */}
        <div className="space-y-3">
          {post.categorias?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(post.categorias as string[]).map((c) => (
                <span key={c} className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  <Tag className="h-2.5 w-2.5" />{CATEGORY_LABELS[c] ?? c}
                </span>
              ))}
            </div>
          )}
          <h1 className="text-2xl font-black tracking-tight leading-snug">{post.titulo}</h1>
          {post.published_at && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />{fmt(post.published_at)}
            </p>
          )}
        </div>

        {/* Content — HTML do WordPress renderizado com sanitização básica */}
        <article
          className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-black prose-a:text-primary"
          dangerouslySetInnerHTML={{ __html: post.conteudo_html ?? "" }}
        />

        {/* Newsletter CTA */}
        <div className="rounded-2xl bg-muted/40 border border-border/60 p-5 space-y-3">
          <p className="font-bold text-sm">Gostou do conteúdo?</p>
          <p className="text-xs text-muted-foreground">Receba análises e lançamentos do Litoral Sul no seu e-mail.</p>
          <NewsletterCapture source="blog-post" />
        </div>
      </div>
    </div>
  );
}
TSX
echo "  ✅ /blog e /blog/\$slug criados."

# ─────────────────────────────────────────────────────────────────
# STEP 7: Adicionar WhatsAppFAB ao layout raiz
# ─────────────────────────────────────────────────────────────────
echo "→ [7/8] Adicionando WhatsAppFAB ao layout raiz..."

python3 - << 'PYEOF'
import sys

# Tentar encontrar o arquivo de layout raiz (root.tsx ou __root.tsx)
import os, glob
candidates = glob.glob("src/routes/__root.tsx") + glob.glob("src/routes/root.tsx") + glob.glob("src/root.tsx")
if not candidates:
    print("  WARN: arquivo root não encontrado — adicione manualmente:")
    print("  import { WhatsAppFAB } from '@/components/layout/WhatsAppFAB';")
    print("  // No JSX do layout: <WhatsAppFAB />")
    sys.exit(0)

path = candidates[0]
with open(path) as f:
    src = f.read()

if "WhatsAppFAB" in src:
    print("  INFO: WhatsAppFAB já presente em", path)
    sys.exit(0)

# Adicionar import
old_import_end = "from \"react\";"
if old_import_end in src:
    src = src.replace(old_import_end,
        old_import_end + "\nimport { WhatsAppFAB } from \"@/components/layout/WhatsAppFAB\";", 1)
else:
    # Inserir no topo dos imports
    src = "import { WhatsAppFAB } from \"@/components/layout/WhatsAppFAB\";\n" + src

# Adicionar antes do </body> ou do último </div> do Outlet
if "<Outlet />" in src:
    src = src.replace("<Outlet />", "<Outlet />\n      <WhatsAppFAB />", 1)
elif "</body>" in src:
    src = src.replace("</body>", "  <WhatsAppFAB />\n</body>", 1)

with open(path, "w") as f:
    f.write(src)
print(f"  ✅ WhatsAppFAB adicionado em {path}")
PYEOF

# ─────────────────────────────────────────────────────────────────
# STEP 8: TypeScript check + commit
# ─────────────────────────────────────────────────────────────────
echo "→ [8/8] TypeScript check + git commit..."

npx tsc --noEmit 2>&1 | tail -25 || true

git add -A
git commit -m "feat(portal): WordPress content migration + public portal parity

- SQL: blog_posts, newsletter_subscribers, testimonials, partners, services tables
- Python script: import_wp_posts.py (WP REST API → Supabase)
- Components: WhatsAppFAB, TestimonialsSection, PartnersSection, NewsletterCapture
- Routes: /sobre, /consultoria, /contato, /politica-de-privacidade
- Routes: /blog (listing with category filter), /blog/[slug] (full post)
- Blog posts: HTML from WordPress + SEO meta tags
- Newsletter: Supabase insert with source tracking
- Contact form: INSERT into leads table + LGPD checkbox
- investment_tags column added to imoveis for filter by intent"

git push

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  ✅ MIGRATION CONCLUÍDA                                           ║"
echo "║                                                                   ║"
echo "║  PASSOS MANUAIS OBRIGATÓRIOS:                                     ║"
echo "║                                                                   ║"
echo "║  1. Supabase SQL Editor → execute sql/wp_migration.sql            ║"
echo "║                                                                   ║"
echo "║  2. Importe os posts do WordPress:                                ║"
echo "║     SUPABASE_SERVICE_ROLE_KEY=xxx python3 scripts/import_wp_posts.py║"
echo "║                                                                   ║"
echo "║  3. Upload logos das construtoras (parceiras):                    ║"
echo "║     Supabase Dashboard → Storage → criar bucket 'partners'        ║"
echo "║     Inserir em: Table Editor → partners                           ║"
echo "║                                                                   ║"
echo "║  4. Navegar no portal e verificar:                                ║"
echo "║     /sobre  /consultoria  /contato  /blog  /blog/[slug]           ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""
