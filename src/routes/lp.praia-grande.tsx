import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Bath,
  BedDouble,
  Building2,
  CalendarCheck,
  Car,
  CheckCircle2,
  Clock,
  HandCoins,
  KeyRound,
  Loader2,
  MapPin,
  MessageCircle,
  Ruler,
  ShieldCheck,
  Sun,
  Waves,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/Logo";
import { formatBRL } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { CORPORATE_TENANT_SLUG } from "@/lib/corporateTenant";
import { enviarLeadLanding } from "@/lib/landingLead.functions";
import {
  FAIXAS_INVESTIMENTO,
  MORA_EM,
  PRAZO_COMPRA,
  WHATSAPP_IMOB365,
  type FaixaInvestimento,
} from "@/lib/landingLeadOptions";

// Landing de campanha do Google Ads: moradores de São Paulo, Guarulhos e ABC
// interessados em comprar apartamento em Praia Grande. Acessível só pelo link
// do anúncio — noindex/nofollow, fora do sitemap (STATIC_PATHS) e sem link em
// nenhuma página do portal. Sem SiteHeader/SiteFooter de propósito: nenhuma
// rota de fuga além do formulário e do WhatsApp.
//
// Conteúdo vivo do portal: imóveis do corretor Bruno Ferraro (resolvido pelo
// NOME + tenant pessoal "bruno-ferraro", porque o slug do corretor diverge
// entre dev e produção) e os lançamentos publicados, Praia Grande primeiro.

const CORRETOR_NOME = "Bruno Ferraro";
const CORRETOR_TENANT_SLUG = "bruno-ferraro";
const CIDADE = "Praia Grande";
const WHATS_MSG =
  "Olá! Vi o anúncio dos imóveis em Praia Grande e quero receber opções de apartamento.";

type ImovelLp = {
  id: string;
  slug: string;
  titulo: string;
  tipo: string;
  preco: number;
  quartos: number | null;
  suites: number | null;
  banheiros: number | null;
  vagas: number | null;
  area_util: number | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  capa: string | null;
};

type EmpreendimentoLp = {
  id: string;
  slug: string;
  nome: string;
  fase: string | null;
  construtora: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  entrega_prevista: string | null;
  capa: string | null;
  aPartirDe: number | null;
};

type LpData = {
  corretor: {
    nome: string;
    creci: string | null;
    creci_uf: string | null;
    foto_url: string | null;
  } | null;
  imoveis: ImovelLp[];
  empreendimentos: EmpreendimentoLp[];
  heroImg: string | null;
  ads: { id: string | null; leadLabel: string | null; whatsLabel: string | null };
};

const semAcento = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const ehPraiaGrande = (cidade: string | null | undefined) =>
  semAcento(cidade).includes("praia grande");

// A campanha vende "apartamento na praia": imóvel da capital/Grande SP não
// entra, mesmo sendo do Bruno. Praia Grande primeiro, depois o resto do litoral.
const LITORAL = [
  "praia grande",
  "santos",
  "sao vicente",
  "guaruja",
  "mongagua",
  "itanhaem",
  "peruibe",
  "bertioga",
  "cubatao",
];
const ehLitoral = (cidade: string | null | undefined) =>
  LITORAL.some((c) => semAcento(cidade).includes(c));

// Preço abaixo disso é placeholder/cadastro incompleto ("R$ 1", "R$ 450") —
// não pode aparecer num anúncio.
const PRECO_MINIMO = 50_000;

const fetchLpPraiaGrande = createServerFn({ method: "GET" }).handler(async (): Promise<LpData> => {
  const sb = supabase as any;

  const [{ data: corretores }, { data: tenants }] = await Promise.all([
    sb
      .from("corretores")
      .select("id,nome,creci,creci_uf,foto_url,tenant_id")
      .ilike("nome", CORRETOR_NOME)
      .eq("ativo", true),
    sb.from("tenants").select("id,slug").in("slug", [CORRETOR_TENANT_SLUG, CORPORATE_TENANT_SLUG]),
  ]);
  const corretorIds: string[] = (corretores ?? []).map((c: { id: string }) => c.id);
  const tenantBruno = (tenants ?? []).find(
    (t: { slug: string }) => t.slug === CORRETOR_TENANT_SLUG,
  );
  const corretor =
    (corretores ?? []).find((c: { foto_url: string | null }) => c.foto_url) ??
    corretores?.[0] ??
    null;

  // Imóveis do Bruno: os do tenant pessoal dele + os em que ele é o corretor
  // responsável (em qualquer tenant). Só venda — a campanha é de compra.
  const filtros = [
    tenantBruno ? `tenant_id.eq.${tenantBruno.id}` : null,
    corretorIds.length ? `corretor_responsavel_id.in.(${corretorIds.join(",")})` : null,
  ].filter(Boolean);
  let imoveisBrutos: Omit<ImovelLp, "capa">[] = [];
  if (filtros.length) {
    const { data } = await sb
      .from("imoveis")
      .select(
        "id,slug,titulo,tipo,preco,quartos,suites,banheiros,vagas,area_util,endereco_bairro,endereco_cidade,destaque,updated_at",
      )
      .eq("publicado", true)
      .eq("status", "ativo")
      .eq("finalidade", "venda")
      .or(filtros.join(","))
      .order("destaque", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(60);
    imoveisBrutos = data ?? [];
  }
  // Só litoral e com preço real; Praia Grande primeiro (sort estável mantém
  // destaque/recência dentro de cada grupo).
  const selecionados = imoveisBrutos
    .filter((i) => ehLitoral(i.endereco_cidade) && Number(i.preco) >= PRECO_MINIMO)
    .sort(
      (a, b) => Number(ehPraiaGrande(b.endereco_cidade)) - Number(ehPraiaGrande(a.endereco_cidade)),
    )
    .slice(0, 9);

  const capas: Record<string, string> = {};
  if (selecionados.length) {
    const { data: fotos } = await sb
      .from("imovel_fotos")
      .select("imovel_id,storage_path,capa,ordem")
      .in(
        "imovel_id",
        selecionados.map((i) => i.id),
      )
      .order("ordem", { ascending: true });
    for (const f of (fotos ?? []) as {
      imovel_id: string;
      storage_path: string;
      capa: boolean;
    }[]) {
      if (!capas[f.imovel_id] || f.capa) {
        capas[f.imovel_id] = sb.storage
          .from("imovel-fotos")
          .getPublicUrl(f.storage_path).data.publicUrl;
      }
    }
  }
  const imoveis: ImovelLp[] = selecionados.map((i) => ({ ...i, capa: capas[i.id] ?? null }));

  // Lançamentos publicados — Praia Grande primeiro, depois os demais do portal.
  const { data: emps } = await sb
    .from("empreendimentos")
    .select(
      "id,slug,nome,fase,construtora,endereco_bairro,endereco_cidade,entrega_prevista,fotos_urls",
    )
    .eq("publicado", true)
    .limit(40);
  const empsOrdenados = (
    (emps ?? []) as (Omit<EmpreendimentoLp, "capa" | "aPartirDe"> & {
      fotos_urls: string[] | null;
    })[]
  )
    .sort((a, b) => {
      const pg =
        Number(ehPraiaGrande(b.endereco_cidade)) - Number(ehPraiaGrande(a.endereco_cidade));
      if (pg) return pg;
      return Number(!!b.fotos_urls?.length) - Number(!!a.fotos_urls?.length);
    })
    .slice(0, 6);

  const precos: Record<string, number> = {};
  if (empsOrdenados.length) {
    const { data: unidades } = await sb
      .from("empreendimento_unidades")
      .select("empreendimento_id,preco,status")
      .in(
        "empreendimento_id",
        empsOrdenados.map((e) => e.id),
      )
      .eq("status", "disponivel");
    for (const u of (unidades ?? []) as { empreendimento_id: string; preco: number | null }[]) {
      if (
        u.preco &&
        u.preco >= PRECO_MINIMO &&
        (!precos[u.empreendimento_id] || u.preco < precos[u.empreendimento_id])
      ) {
        precos[u.empreendimento_id] = u.preco;
      }
    }
  }
  const empreendimentos: EmpreendimentoLp[] = empsOrdenados.map(({ fotos_urls, ...e }) => ({
    ...e,
    capa: fotos_urls?.[0] ?? null,
    aPartirDe: precos[e.id] ?? null,
  }));

  const heroImg =
    empreendimentos.find((e) => e.capa && ehPraiaGrande(e.endereco_cidade))?.capa ??
    imoveis.find((i) => i.capa && ehPraiaGrande(i.endereco_cidade))?.capa ??
    empreendimentos.find((e) => e.capa)?.capa ??
    imoveis.find((i) => i.capa)?.capa ??
    null;

  return {
    corretor: corretor
      ? {
          nome: corretor.nome,
          creci: corretor.creci,
          creci_uf: corretor.creci_uf,
          foto_url: corretor.foto_url,
        }
      : null,
    imoveis,
    empreendimentos,
    heroImg,
    // IDs públicos do Google Ads (vão no HTML de qualquer jeito) — opcionais:
    // sem eles a página funciona, só não registra conversão.
    ads: {
      id: process.env.LP_GOOGLE_ADS_ID || null,
      leadLabel: process.env.LP_GOOGLE_ADS_LEAD_LABEL || null,
      whatsLabel: process.env.LP_GOOGLE_ADS_WHATSAPP_LABEL || null,
    },
  };
});

export const Route = createFileRoute("/lp/praia-grande")({
  loader: () => fetchLpPraiaGrande(),
  head: () => ({
    meta: [
      { title: "Apartamentos em Praia Grande | imoB365" },
      {
        name: "description",
        content:
          "Apartamentos prontos e lançamentos em Praia Grande, a cerca de 1 hora de São Paulo. Receba uma seleção no seu orçamento, sem compromisso.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LpPraiaGrande,
});

const FASE_LABEL: Record<string, string> = {
  lancamento: "Lançamento",
  pre_lancamento: "Pré-lançamento",
  em_obras: "Em obras",
  obras: "Em obras",
  pronto: "Pronto para morar",
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

function useGoogleAds(adsId: string | null) {
  useEffect(() => {
    if (!adsId) return;
    window.dataLayer = window.dataLayer || [];
    if (!window.gtag) {
      window.gtag = function gtag() {
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer!.push(arguments);
      };
      window.gtag("js", new Date());
    }
    if (!document.querySelector(`script[data-lp-ads="${adsId}"]`)) {
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${adsId}`;
      s.dataset.lpAds = adsId;
      document.head.appendChild(s);
    }
    window.gtag("config", adsId);
  }, [adsId]);
}

function conversao(adsId: string | null, label: string | null) {
  if (adsId && label && window.gtag)
    window.gtag("event", "conversion", { send_to: `${adsId}/${label}` });
}

function mascaraTelefone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function LpPraiaGrande() {
  const data = Route.useLoaderData() as LpData;
  useGoogleAds(data.ads.id);
  const whatsHref = waLink(WHATSAPP_IMOB365, WHATS_MSG) ?? `https://wa.me/${WHATSAPP_IMOB365}`;
  const onWhats = () => conversao(data.ads.id, data.ads.whatsLabel);
  const irProForm = () => {
    const el = document.getElementById("form-lead");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => el?.querySelector("input")?.focus({ preventScroll: true }), 400);
  };

  return (
    <div className="min-h-screen bg-[#f6f3ec] pb-20 text-[#1a1a1a] md:pb-0">
      {/* ---------- topo: só logo + WhatsApp, sem menu de fuga ---------- */}
      <header className="sticky top-0 z-40 bg-[#0f1e3a]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Logo variant="white" className="h-7 w-auto" />
          <a
            href={whatsHref}
            target="_blank"
            rel="noopener"
            onClick={onWhats}
            className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-bold text-white shadow-md transition hover:bg-[#1EBE5A]"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Falar no WhatsApp</span>
            <span className="sm:hidden">WhatsApp</span>
          </a>
        </div>
      </header>

      {/* ---------- hero + formulário ---------- */}
      <section className="relative overflow-hidden bg-[#0f1e3a] text-white">
        {data.heroImg && (
          <img
            src={data.heroImg}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-35"
            fetchPriority="high"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f1e3a] via-[#0f1e3a]/85 to-[#0f1e3a]/40" />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-10 md:py-16 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-orange-200 ring-1 ring-white/20">
              <MapPin className="h-3.5 w-3.5" /> Praia Grande · Litoral Sul de SP
            </span>
            <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight md:text-5xl">
              Seu apartamento na praia, a cerca de{" "}
              <span className="text-[#FF7A1A]">1 hora de São Paulo</span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-white/85 md:text-lg">
              Mora em São Paulo, Guarulhos ou no ABC? Nossos consultores selecionam apartamentos
              prontos e lançamentos em Praia Grande no seu orçamento — sem custo e sem compromisso.
            </p>
            <ul className="mt-6 grid gap-2.5 text-sm md:text-base">
              {[
                "Lançamentos com condições direto da construtora",
                "Ajuda com simulação e aprovação do financiamento",
                "Visitas agendadas no seu horário, inclusive fim de semana",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#FF7A1A]" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <a
              href={whatsHref}
              target="_blank"
              rel="noopener"
              onClick={onWhats}
              className="mt-7 hidden items-center gap-2 text-sm font-semibold text-white/90 underline-offset-4 hover:underline lg:inline-flex"
            >
              <MessageCircle className="h-4 w-4 text-[#25D366]" /> Prefere conversar agora? Chame no
              WhatsApp
            </a>
          </div>
          <FormLead ads={data.ads} whatsHref={whatsHref} onWhats={onWhats} />
        </div>
      </section>

      {/* ---------- argumentos rápidos ---------- */}
      <section className="border-b border-black/5 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 py-6 md:grid-cols-4">
          {[
            {
              icon: Car,
              t: "Imigrantes e Anchieta",
              d: "Acesso rápido saindo da capital e do ABC",
            },
            { icon: Sun, t: "Praia o ano inteiro", d: "Para morar, veranear ou investir" },
            {
              icon: ShieldCheck,
              t: "Imóveis verificados",
              d: "Documentação conferida pela equipe",
            },
            { icon: KeyRound, t: "Do contato à chave", d: "Um consultor acompanha tudo com você" },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-[#C2410C]">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold">{t}</p>
                <p className="text-xs text-black/60">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- lançamentos ---------- */}
      {data.empreendimentos.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <Titulo
            eyebrow="Lançamentos"
            titulo="Lançamentos e empreendimentos em destaque"
            sub="Plantas, condições e tabela de preços atualizadas com o consultor."
          />
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.empreendimentos.map((e) => (
              <a
                key={e.id}
                href={`/empreendimento/${e.slug}`}
                target="_blank"
                rel="noopener"
                className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="relative aspect-[4/3] bg-[#0f1e3a]/10">
                  {e.capa ? (
                    <img
                      src={e.capa}
                      alt={e.nome}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-[#0f1e3a]/40">
                      <Building2 className="h-10 w-10" />
                    </div>
                  )}
                  {e.fase && (
                    <span className="absolute left-3 top-3 rounded-full bg-[#0f1e3a] px-2.5 py-1 text-xs font-semibold text-white">
                      {FASE_LABEL[e.fase] ?? e.fase}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-display text-lg font-bold">{e.nome}</h3>
                  {(e.endereco_bairro || e.endereco_cidade) && (
                    <p className="mt-1 flex items-center gap-1 text-sm text-black/60">
                      <MapPin className="h-3.5 w-3.5" />
                      {[e.endereco_bairro, e.endereco_cidade].filter(Boolean).join(", ")}
                    </p>
                  )}
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <div className="text-sm">
                      {e.aPartirDe ? (
                        <>
                          <span className="text-black/50">a partir de </span>
                          <strong className="text-[#C2410C]">{formatBRL(e.aPartirDe)}</strong>
                        </>
                      ) : (
                        <span className="text-black/60">Consulte condições</span>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#0f1e3a] group-hover:text-[#C2410C]">
                      Ver detalhes <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ---------- imóveis do corretor ---------- */}
      {data.imoveis.length > 0 && (
        <section className="bg-white py-12">
          <div className="mx-auto max-w-6xl px-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <Titulo
                eyebrow="Pronto para morar"
                titulo={`Apartamentos selecionados por ${data.corretor?.nome ?? CORRETOR_NOME}`}
                sub="Imóveis à venda acompanhados de perto pelo nosso consultor."
              />
              {data.corretor && (
                <div className="flex items-center gap-3 rounded-2xl bg-[#f6f3ec] px-4 py-3">
                  {data.corretor.foto_url ? (
                    <img
                      src={data.corretor.foto_url}
                      alt={data.corretor.nome}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-[#0f1e3a] font-bold text-white">
                      {data.corretor.nome
                        .split(" ")
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                  )}
                  <div className="text-sm">
                    <p className="flex items-center gap-1 font-bold">
                      {data.corretor.nome} <BadgeCheck className="h-4 w-4 text-[#C2410C]" />
                    </p>
                    {data.corretor.creci && (
                      <p className="text-xs text-black/60">
                        CRECI {data.corretor.creci}
                        {data.corretor.creci_uf ? `/${data.corretor.creci_uf}` : ""}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.imoveis.map((i) => (
                <a
                  key={i.id}
                  href={`/imovel/${i.slug}`}
                  target="_blank"
                  rel="noopener"
                  className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="relative aspect-[4/3] bg-[#0f1e3a]/10">
                    {i.capa ? (
                      <img
                        src={i.capa}
                        alt={i.titulo}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-[#0f1e3a]/40">
                        <Building2 className="h-10 w-10" />
                      </div>
                    )}
                    <span className="absolute bottom-3 left-3 rounded-lg bg-white/95 px-2.5 py-1 text-sm font-extrabold text-[#0f1e3a] shadow">
                      {formatBRL(i.preco)}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="line-clamp-2 font-semibold leading-snug">{i.titulo}</h3>
                    <p className="mt-1 flex items-center gap-1 text-sm text-black/60">
                      <MapPin className="h-3.5 w-3.5" />
                      {[i.endereco_bairro, i.endereco_cidade].filter(Boolean).join(", ") || CIDADE}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/70">
                      {!!i.quartos && (
                        <span className="inline-flex items-center gap-1">
                          <BedDouble className="h-3.5 w-3.5" /> {i.quartos} dorm.
                        </span>
                      )}
                      {!!i.banheiros && (
                        <span className="inline-flex items-center gap-1">
                          <Bath className="h-3.5 w-3.5" /> {i.banheiros} banh.
                        </span>
                      )}
                      {!!i.vagas && (
                        <span className="inline-flex items-center gap-1">
                          <Car className="h-3.5 w-3.5" /> {i.vagas} vaga{i.vagas > 1 ? "s" : ""}
                        </span>
                      )}
                      {!!i.area_util && (
                        <span className="inline-flex items-center gap-1">
                          <Ruler className="h-3.5 w-3.5" /> {i.area_util} m²
                        </span>
                      )}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------- por que Praia Grande ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <Titulo
          eyebrow="Por que Praia Grande"
          titulo="Qualidade de vida sem ir longe de São Paulo"
        />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Waves,
              t: "Praia, orla e lazer",
              d: "Orla extensa com ciclovia, quiosques e praias para a família curtir o ano todo.",
            },
            {
              icon: HandCoins,
              t: "Preço que cabe no bolso",
              d: "Apartamentos com valores mais acessíveis que bairros equivalentes da capital — para morar ou investir.",
            },
            {
              icon: Building2,
              t: "Cidade estruturada",
              d: "Comércio, serviços, escolas e lançamentos modernos em bairros como Canto do Forte, Boqueirão e Guilhermina.",
            },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <Icon className="h-7 w-7 text-[#C2410C]" />
              <h3 className="mt-3 font-display text-lg font-bold">{t}</h3>
              <p className="mt-1 text-sm text-black/70">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- como funciona + CTA final ---------- */}
      <section className="bg-[#0f1e3a] text-white">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <Titulo eyebrow="Como funciona" titulo="Três passos até a sua chave" claro />
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: MessageCircle,
                t: "1. Conte o que procura",
                d: "Orçamento, tamanho e quando pretende comprar.",
              },
              {
                icon: CalendarCheck,
                t: "2. Receba a seleção",
                d: "Opções sob medida no seu WhatsApp, sem enrolação.",
              },
              {
                icon: KeyRound,
                t: "3. Visite e compre",
                d: "Acompanhamento na visita, no financiamento e na documentação.",
              },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                <Icon className="h-6 w-6 text-[#FF7A1A]" />
                <h3 className="mt-3 font-bold">{t}</h3>
                <p className="mt-1 text-sm text-white/75">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={irProForm}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF7A1A] px-6 py-3.5 font-bold text-white shadow-lg transition hover:bg-[#C2410C] sm:w-auto"
            >
              Quero receber opções <ArrowRight className="h-5 w-5" />
            </button>
            <a
              href={whatsHref}
              target="_blank"
              rel="noopener"
              onClick={onWhats}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-6 py-3.5 font-bold text-white shadow-lg transition hover:bg-[#1EBE5A] sm:w-auto"
            >
              <MessageCircle className="h-5 w-5" /> Falar no WhatsApp
            </a>
          </div>
        </div>
      </section>

      <footer className="bg-[#0b162b] px-4 py-8 text-center text-xs text-white/60">
        <Logo variant="white" className="mx-auto h-6 w-auto opacity-80" />
        <p className="mt-3">
          imoB365 — consultoria imobiliária · contato@imob365.com.br · (13) 99779-4382
        </p>
        <p className="mt-2 space-x-3">
          <a href="/termos" target="_blank" rel="noopener" className="underline">
            Termos de uso
          </a>
          <a href="/privacidade" target="_blank" rel="noopener" className="underline">
            Privacidade
          </a>
        </p>
        <p className="mt-3 text-white/40">
          Valores e disponibilidade sujeitos a alteração. Imagens ilustrativas.
        </p>
      </footer>

      {/* ---------- barra fixa no celular ---------- */}
      <div className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-2 gap-2 border-t border-black/10 bg-white/95 p-2.5 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={irProForm}
          className="rounded-xl bg-[#FF7A1A] py-3 text-sm font-bold text-white"
        >
          Receber opções
        </button>
        <a
          href={whatsHref}
          target="_blank"
          rel="noopener"
          onClick={onWhats}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] py-3 text-sm font-bold text-white"
        >
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
      </div>
    </div>
  );
}

function Titulo({
  eyebrow,
  titulo,
  sub,
  claro,
}: {
  eyebrow: string;
  titulo: string;
  sub?: string;
  claro?: boolean;
}) {
  return (
    <div>
      <p
        className={`text-xs font-bold uppercase tracking-widest ${claro ? "text-[#FF7A1A]" : "text-[#C2410C]"}`}
      >
        {eyebrow}
      </p>
      <h2 className="mt-1 font-display text-2xl font-extrabold md:text-3xl">{titulo}</h2>
      {sub && <p className={`mt-1 text-sm ${claro ? "text-white/70" : "text-black/60"}`}>{sub}</p>}
    </div>
  );
}

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "fbclid",
] as const;

function FormLead({
  ads,
  whatsHref,
  onWhats,
}: {
  ads: LpData["ads"];
  whatsHref: string;
  onWhats: () => void;
}) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [tipo, setTipo] = useState<"apartamento" | "casa">("apartamento");
  const [moraEm, setMoraEm] = useState<string>("");
  const [faixa, setFaixa] = useState<FaixaInvestimento | "">("");
  const [prazo, setPrazo] = useState<string>("");
  const [honeypot, setHoneypot] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const carregadoEm = useRef<number>(0);
  const clientRef = useRef<string>("");

  // UTMs/gclid do clique no anúncio — guardados na sessão para sobreviver a
  // navegações (ex.: visitante abre um imóvel e volta).
  const utms = useMemo(() => {
    if (typeof window === "undefined") return {} as Record<string, string>;
    const out: Record<string, string> = {};
    const params = new URLSearchParams(window.location.search);
    for (const k of UTM_KEYS) {
      let v = params.get(k);
      try {
        if (v) sessionStorage.setItem(`lp_${k}`, v);
        else v = sessionStorage.getItem(`lp_${k}`);
      } catch {
        /* storage bloqueado: segue só com a URL */
      }
      if (v) out[k] = v.slice(0, 200);
    }
    return out;
  }, []);

  useEffect(() => {
    carregadoEm.current = Date.now();
    clientRef.current = crypto.randomUUID();
  }, []);

  const telDigitos = telefone.replace(/\D/g, "");
  const valido = nome.trim().length >= 2 && telDigitos.length >= 10 && /\S+@\S+\.\S+/.test(email);

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    if (enviando) return;
    if (!valido) {
      setErro(
        nome.trim().length < 2
          ? "Informe seu nome."
          : telDigitos.length < 10
            ? "Informe seu WhatsApp com DDD."
            : "Informe um e-mail válido.",
      );
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const r = await enviarLeadLanding({
        data: {
          landing: "praia-grande",
          client_ref: clientRef.current || crypto.randomUUID(),
          nome,
          telefone,
          email,
          tipo_imovel: tipo,
          faixa: faixa || null,
          mora_em: (moraEm || null) as (typeof MORA_EM)[number] | null,
          prazo: (prazo || null) as (typeof PRAZO_COMPRA)[number] | null,
          honeypot: honeypot || null,
          carregado_em: carregadoEm.current || null,
          pagina_origem: window.location.href.slice(0, 300),
          ...utms,
        },
      });
      if (r.ok) {
        setEnviado(true);
        conversao(ads.id, ads.leadLabel);
      } else {
        setErro(r.erro);
      }
    } catch {
      setErro("Não foi possível enviar agora. Fale com a gente pelo WhatsApp.");
    } finally {
      setEnviando(false);
    }
  }

  const campo =
    "w-full rounded-xl border border-black/15 bg-white px-3.5 py-3 text-[15px] text-[#1a1a1a] outline-none transition placeholder:text-black/40 focus:border-[#FF7A1A] focus:ring-2 focus:ring-[#FF7A1A]/25";

  if (enviado) {
    return (
      <div
        id="form-lead"
        className="rounded-3xl bg-white p-6 text-center text-[#1a1a1a] shadow-2xl md:p-8"
      >
        <CheckCircle2 className="mx-auto h-14 w-14 text-[#25D366]" />
        <h2 className="mt-3 font-display text-2xl font-extrabold">Recebemos seu contato!</h2>
        <p className="mt-2 text-black/70">
          Um consultor da imoB365 vai te chamar no WhatsApp em breve com opções em Praia Grande.
        </p>
        <a
          href={whatsHref}
          target="_blank"
          rel="noopener"
          onClick={onWhats}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-6 py-3.5 font-bold text-white"
        >
          <MessageCircle className="h-5 w-5" /> Quero falar agora pelo WhatsApp
        </a>
      </div>
    );
  }

  return (
    <form
      id="form-lead"
      onSubmit={enviar}
      noValidate
      className="rounded-3xl bg-white p-5 text-[#1a1a1a] shadow-2xl ring-4 ring-[#FF7A1A]/30 md:p-7"
    >
      <p className="text-xs font-bold uppercase tracking-widest text-[#C2410C]">
        Atendimento gratuito
      </p>
      <h2 className="mt-1 font-display text-xl font-extrabold md:text-2xl">
        Receba opções de apartamento em Praia Grande
      </h2>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-black/60">
        <Clock className="h-4 w-4" /> Resposta rápida no seu WhatsApp
      </p>

      <div className="mt-5 grid gap-3">
        <input
          className={campo}
          placeholder="Seu nome"
          autoComplete="name"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
        />
        <input
          className={campo}
          placeholder="WhatsApp com DDD"
          inputMode="tel"
          autoComplete="tel"
          value={telefone}
          onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
          required
        />
        <input
          className={campo}
          placeholder="Seu e-mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de imóvel">
          {(["apartamento", "casa"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tipo === t}
              onClick={() => setTipo(t)}
              className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                tipo === t
                  ? "border-[#FF7A1A] bg-orange-50 text-[#C2410C]"
                  : "border-black/15 text-black/70 hover:border-black/30"
              }`}
            >
              {t === "apartamento" ? "Apartamento" : "Casa"}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            className={campo}
            value={moraEm}
            onChange={(e) => setMoraEm(e.target.value)}
            aria-label="Onde você mora"
          >
            <option value="">Onde você mora?</option>
            {MORA_EM.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            className={campo}
            value={faixa}
            onChange={(e) => setFaixa(e.target.value as FaixaInvestimento | "")}
            aria-label="Faixa de investimento"
          >
            <option value="">Quanto quer investir?</option>
            {Object.entries(FAIXAS_INVESTIMENTO).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <select
          className={campo}
          value={prazo}
          onChange={(e) => setPrazo(e.target.value)}
          aria-label="Quando pretende comprar"
        >
          <option value="">Quando pretende comprar?</option>
          {PRAZO_COMPRA.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        {/* honeypot: invisível para humanos */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Não preencher
            <input
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </label>
        </div>

        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF7A1A] px-6 py-4 text-base font-extrabold text-white shadow-lg transition hover:bg-[#C2410C] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          Quero receber opções
        </button>
        <a
          href={whatsHref}
          target="_blank"
          rel="noopener"
          onClick={onWhats}
          className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#25D366] px-6 py-3 text-sm font-bold text-[#128C4A] transition hover:bg-[#25D366]/10"
        >
          <MessageCircle className="h-4 w-4" /> Prefiro chamar no WhatsApp
        </a>
        <p className="text-center text-[11px] leading-snug text-black/50">
          Ao enviar, você concorda em ser contatado pela imoB365 sobre imóveis, conforme a{" "}
          <a href="/privacidade" target="_blank" rel="noopener" className="underline">
            política de privacidade
          </a>
          .
        </p>
      </div>
    </form>
  );
}
