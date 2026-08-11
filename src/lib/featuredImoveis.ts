// Composição da vitrine "Imóveis em destaque" da home (src/routes/index.tsx).
//
// Antes: os imóveis saíam por recência pura (order updated_at desc) — ou seja,
// "na ordem em que os corretores cadastram". Agora a lista é composta por
// visitante, combinando 3 sinais, nesta ordem de importância:
//   1. Região do visitante (UF/cidade — via nginx GeoIP2, ver geo.functions.ts)
//   2. Intercalação corretor × imobiliária, um a um
//   3. Preferência de Bruno Ferraro / imob365 (só como desempate — "boost leve")
//
// Função pura e agnóstica do shape do card (só exige os campos abaixo), pra
// ser testável isoladamente e não acoplar à UI.

import { CORPORATE_TENANT_SLUG } from "@/lib/corporateTenant";

// imob365 (tenant corporativo) e o corretor Bruno Ferraro têm preferência na
// vitrine. Constante por slug por enquanto — se a lista de preferidos crescer,
// vira uma flag em `tenants` (ex.: destaque_prioritario).
export const PREFERRED_HOME_TENANT_SLUGS: string[] = [CORPORATE_TENANT_SLUG, "bruno-ferraro"];

export type TenantMeta = { slug: string | null; tipo_tenant: string | null };
export type VisitorRegion = {
  city: string | null;
  uf: string | null;
  country: string | null;
} | null;

export type ImovelComposivel = {
  tenant_id?: string | null;
  endereco_cidade?: string | null;
  endereco_uf?: string | null;
  updated_at?: string | null;
};

function normalizar(s: string | null | undefined): string {
  // NFD + remove diacríticos via property escape \p{Diacritic} (fonte 100%
  // ASCII — evita caractere combinante literal no arquivo, gotcha já
  // documentado no projeto em aiAssistant.ts / captacao.ts).
  return (s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

// 0 = cidade do visitante bate | 1 = só a UF bate | 2 = não bate (ou sem geo).
// UF é o sinal primário e confiável; cidade do GeoIP2 é fuzzy entre idiomas,
// então só conta como bônus quando bate exatamente (normalizada).
function regionTier(imovel: ImovelComposivel, region: VisitorRegion): 0 | 1 | 2 {
  if (!region) return 2;
  const cidade = normalizar(region.city);
  if (cidade && normalizar(imovel.endereco_cidade) === cidade) return 0;
  const uf = (region.uf ?? "").trim().toUpperCase();
  if (uf && (imovel.endereco_uf ?? "").trim().toUpperCase() === uf) return 1;
  return 2;
}

type Anotado<T> = { item: T; isCorretor: boolean; tier: number; pref: number; upd: string };

// Intercala dois buckets um a um até `limit`; quando um esvazia, drena o outro
// (o grid nunca fica com buraco). `startA` escolhe quem lidera.
function zipAlternate<T>(a: Anotado<T>[], b: Anotado<T>[], limit: number, startA: boolean): T[] {
  const res: T[] = [];
  let i = 0;
  let j = 0;
  let takeA = startA;
  while (res.length < limit && (i < a.length || j < b.length)) {
    if (takeA && i < a.length) res.push(a[i++].item);
    else if (!takeA && j < b.length) res.push(b[j++].item);
    else if (i < a.length) res.push(a[i++].item);
    else if (j < b.length) res.push(b[j++].item);
    takeA = !takeA;
  }
  return res;
}

export function comporDestaques<T extends ImovelComposivel>(
  pool: T[],
  tenantById: Record<string, TenantMeta | undefined>,
  region: VisitorRegion,
  opts?: { limit?: number },
): T[] {
  const limit = opts?.limit ?? 8;

  const anot: Anotado<T>[] = pool.map((item) => {
    const t = item.tenant_id ? tenantById[item.tenant_id] : undefined;
    return {
      item,
      isCorretor: t?.tipo_tenant === "corretor",
      tier: regionTier(item, region),
      pref: t?.slug && PREFERRED_HOME_TENANT_SLUGS.includes(t.slug) ? 0 : 1,
      upd: item.updated_at ?? "",
    };
  });

  // Ordem: região manda; preferência é só desempate; recência por último.
  const cmp = (a: Anotado<T>, b: Anotado<T>) =>
    a.tier - b.tier || a.pref - b.pref || b.upd.localeCompare(a.upd);
  anot.sort(cmp);

  const corretores = anot.filter((x) => x.isCorretor);
  const outros = anot.filter((x) => !x.isCorretor); // imobiliárias + tipo desconhecido

  // Lidera o bucket cujo topo tem a melhor chave (região/preferência/recência).
  let startA: boolean;
  if (corretores.length === 0) startA = false;
  else if (outros.length === 0) startA = true;
  else startA = cmp(corretores[0], outros[0]) <= 0;

  return zipAlternate(corretores, outros, limit, startA);
}
