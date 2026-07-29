import { slugify } from "@/lib/format";

// Robô de captação automática de imóveis: varre a Chaves na Mão em busca de
// anúncios que casam com a configuração de cada tenant e insere leads novos
// direto no funil normal (leads.origem = 'captacao_automatica'). Usado tanto
// pela rota /api/public/cron/captacao (service role, todos os tenants) via
// src/routes/api.public.cron.captacao.ts.
//
// Extração via JSON-LD estruturado (schema.org RealEstateListing/Offer),
// não HTML/CSS solto — validado manualmente contra o site real antes de
// escrever este código: as páginas de busca embutem um bloco
// <script type="application/ld+json"> com @type "RealEstateListing" cujo
// offers.itemListElement[] traz cada anúncio já limpo (preço, endereço,
// geo, foto, anunciante). Sem telefone do anunciante nesse bloco — o link
// do anúncio é sempre o fallback acionável pro corretor.

export interface CaptacaoSupabaseClient {
  from: (table: string) => any;
}

export type CaptacaoConfig = {
  id: string;
  tenant_id: string;
  nome: string;
  cidade: string;
  uf: string;
  bairro: string | null;
  tipo: string;
  finalidade: string;
  preco_min: number | null;
  preco_max: number | null;
};

export type RawListing = {
  external_id: string;
  url: string;
  titulo: string;
  preco: number | null;
  bairro: string | null;
  endereco: string | null;
  foto: string | null;
  anunciante: string | null;
  quartos: number | null;
  banheiros: number | null;
  area: number | null;
};

// plans.slug reais (confirmado contra dev): "pro"/"business", sem prefixo
// "plan-" — o CLAUDE.md documenta uma convenção "plan-pro"/"plan-busi" que
// não bate com o schema atual (drift de documentação, não de schema).
const PLANOS_COM_ACESSO = ["pro", "business"];

// Mapa tipo+finalidade → slug de URL. "apartamentos-a-venda" e
// "casas-para-alugar" foram confirmados reais contra o site (200, JSON-LD
// presente); os demais seguem o mesmo padrão observado mas não foram
// testados individualmente — ajustar se algum combo específico não bater.
const TIPO_SLUG: Record<string, string> = {
  apartamento: "apartamentos",
  casa: "casas",
  cobertura: "coberturas",
  terreno: "terrenos",
  comercial: "imoveis-comerciais",
};
const FINALIDADE_SLUG: Record<string, string> = {
  venda: "a-venda",
  aluguel: "para-alugar",
};

function buildSearchUrl(
  config: Pick<CaptacaoConfig, "cidade" | "uf" | "tipo" | "finalidade">,
): string {
  const tipoSlug = TIPO_SLUG[config.tipo] ?? TIPO_SLUG.apartamento;
  const finalidadeSlug = FINALIDADE_SLUG[config.finalidade] ?? FINALIDADE_SLUG.venda;
  const cidadeSlug = slugify(config.cidade);
  const ufSlug = config.uf.toLowerCase();
  return `https://www.chavesnamao.com.br/${tipoSlug}-${finalidadeSlug}/${ufSlug}-${cidadeSlug}/`;
}

function extractExternalId(url: string): string | null {
  const m = url.match(/id-(\d+)/);
  return m ? m[1] : null;
}

function parseListingsFromHtml(html: string): RawListing[] {
  const scriptMatches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  for (const match of scriptMatches) {
    let data: any;
    try {
      data = JSON.parse(match[1]);
    } catch {
      continue;
    }
    if (data?.["@type"] !== "RealEstateListing") continue;
    const items = data?.offers?.itemListElement;
    if (!Array.isArray(items)) continue;

    return items
      .map((item: any): RawListing | null => {
        const url = item.url;
        const externalId = typeof url === "string" ? extractExternalId(url) : null;
        if (!externalId || !url) return null;
        const itemOffered = item.itemOffered ?? {};
        const address = itemOffered.address ?? {};
        const floorSize = itemOffered.floorSize?.unitText as string | undefined;
        const areaNum = floorSize ? parseFloat(floorSize.replace(/[^\d.]/g, "")) : null;
        return {
          external_id: externalId,
          url,
          titulo: item.name ?? "Anúncio sem título",
          preco: item.price != null ? Number(item.price) : null,
          bairro: address.addressLocality ?? null,
          endereco: address.streetAddress ?? null,
          foto: itemOffered.image ?? null,
          anunciante: item.offeredBy?.name ?? null,
          quartos:
            itemOffered.numberOfBedrooms != null
              ? parseInt(String(itemOffered.numberOfBedrooms), 10) || null
              : null,
          banheiros:
            itemOffered.numberOfBathroomsTotal != null
              ? parseInt(String(itemOffered.numberOfBathroomsTotal), 10) || null
              : null,
          area: areaNum && !Number.isNaN(areaNum) ? areaNum : null,
        };
      })
      .filter((x: RawListing | null): x is RawListing => x !== null);
  }
  return [];
}

function matchesFilters(listing: RawListing, config: CaptacaoConfig): boolean {
  if (config.bairro) {
    const alvo = config.bairro.trim().toLowerCase();
    if (!listing.bairro || !listing.bairro.toLowerCase().includes(alvo)) return false;
  }
  if (config.preco_min != null && (listing.preco == null || listing.preco < config.preco_min)) {
    return false;
  }
  if (config.preco_max != null && (listing.preco == null || listing.preco > config.preco_max)) {
    return false;
  }
  return true;
}

export async function fetchChavesNaMaoListings(
  config: Pick<CaptacaoConfig, "cidade" | "uf" | "tipo" | "finalidade">,
): Promise<RawListing[]> {
  const url = buildSearchUrl(config);
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) return [];
  const html = await res.text();
  return parseListingsFromHtml(html);
}

const BATCH_SIZE_CONFIGS = 20;
const BATCH_SIZE_RECHECK = 50;

export type ProcessarCaptacoesResult = {
  configsProcessadas: number;
  listingsEncontrados: number;
  leadsNovos: number;
};

export type ProcessarCaptacoesOpcoes = {
  // Restringe o lote a um único tenant — usado pelo botão "Sincronizar
  // agora" (força a sincronização de UM tenant específico) em vez do
  // varredor global que o cron horário roda.
  tenantId?: string;
  // Ignora o gate de intervalo (ultima_execucao + intervalo_horas) — é
  // exatamente o "forçado" do botão manual; o cron horário nunca passa
  // essa flag, sempre respeita o ciclo configurado.
  forcar?: boolean;
};

export async function processarCaptacoes(
  client: CaptacaoSupabaseClient,
  opcoes: ProcessarCaptacoesOpcoes = {},
): Promise<ProcessarCaptacoesResult> {
  const nowIso = new Date().toISOString();
  let query = client
    .from("captacao_configs")
    .select("*, tenants!inner(plano_slug)")
    .eq("ativo", true)
    .in("tenants.plano_slug", PLANOS_COM_ACESSO)
    .order("ultima_execucao", { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE_CONFIGS);
  if (opcoes.tenantId) query = query.eq("tenant_id", opcoes.tenantId);
  const { data: configs } = await query;

  let listingsEncontrados = 0;
  let leadsNovos = 0;
  let configsProcessadas = 0;

  for (const config of (configs ?? []) as CaptacaoConfig[]) {
    const intervaloHoras = (config as any).intervalo_horas ?? 24;
    const ultimaExecucao = (config as any).ultima_execucao as string | null;
    if (!opcoes.forcar && ultimaExecucao) {
      const proximaExecucao = new Date(ultimaExecucao).getTime() + intervaloHoras * 3600_000;
      if (proximaExecucao > Date.now()) continue;
    }

    configsProcessadas++;
    const listings = await fetchChavesNaMaoListings(config);
    const filtrados = listings.filter((l) => matchesFilters(l, config));
    listingsEncontrados += filtrados.length;

    for (const listing of filtrados) {
      const { data: existente } = await client
        .from("captacao_listings")
        .select("id, lead_id")
        .eq("tenant_id", config.tenant_id)
        .eq("fonte", "chavesnamao")
        .eq("external_id", listing.external_id)
        .maybeSingle();

      if (existente) {
        await client
          .from("captacao_listings")
          .update({ ultima_vez_visto_em: nowIso, indisponivel_desde: null })
          .eq("id", existente.id);
        continue;
      }

      const { data: lead } = await client
        .from("leads")
        .insert({
          tenant_id: config.tenant_id,
          nome: listing.anunciante ?? `Anúncio — ${listing.bairro ?? config.cidade}`,
          origem: "captacao_automatica",
          mensagem: `Captado automaticamente via ${config.nome}.\n${listing.titulo}\n${listing.endereco ?? ""}\nLink: ${listing.url}`,
        })
        .select("id")
        .single();

      await client.from("captacao_listings").insert({
        tenant_id: config.tenant_id,
        config_id: config.id,
        fonte: "chavesnamao",
        external_id: listing.external_id,
        url: listing.url,
        dados_brutos: listing,
        lead_id: lead?.id ?? null,
      });

      if (lead?.id) leadsNovos++;
    }

    await client.from("captacao_configs").update({ ultima_execucao: nowIso }).eq("id", config.id);
  }

  return { configsProcessadas, listingsEncontrados, leadsNovos };
}

export type VerificarDisponibilidadeResult = {
  verificados: number;
  marcadosIndisponiveis: number;
};

export async function verificarDisponibilidade(
  client: CaptacaoSupabaseClient,
): Promise<VerificarDisponibilidadeResult> {
  const limite = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: listings } = await client
    .from("captacao_listings")
    .select("id, url, lead_id")
    .is("indisponivel_desde", null)
    .lte("ultima_vez_visto_em", limite)
    .limit(BATCH_SIZE_RECHECK);

  let verificados = 0;
  let marcadosIndisponiveis = 0;
  const nowIso = new Date().toISOString();

  for (const listing of listings ?? []) {
    verificados++;
    let disponivel = true;
    try {
      const res = await fetch(listing.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        },
      });
      if (!res.ok) {
        disponivel = false;
      } else {
        const html = await res.text();
        disponivel =
          html.includes('"@type":"RealEstateListing"') ||
          html.includes('"@type": "RealEstateListing"');
      }
    } catch {
      disponivel = false;
    }

    if (!disponivel) {
      marcadosIndisponiveis++;
      await client
        .from("captacao_listings")
        .update({ indisponivel_desde: nowIso })
        .eq("id", listing.id);
      if (listing.lead_id) {
        await client
          .from("leads")
          .update({ status: "perdido", perdido_motivo: "Imóvel indisponível na fonte original" })
          .eq("id", listing.lead_id)
          .eq("status", "novo");
      }
    } else {
      await client
        .from("captacao_listings")
        .update({ ultima_vez_visto_em: nowIso })
        .eq("id", listing.id);
    }
  }

  return { verificados, marcadosIndisponiveis };
}
