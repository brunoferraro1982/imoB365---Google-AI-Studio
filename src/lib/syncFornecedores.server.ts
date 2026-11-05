import { randomUUID } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseTabelaEcon, precoPlanta } from "@/lib/tabelaEcon";

// Sincronização semanal dos materiais de construtoras importados em
// 2026-11-04 (portfólio Econ e Le Jardin/Coralon), disparada pelo Claude
// Cowork via /api/public/cron/sync-fornecedores. Aplica sozinha só o que é
// determinístico:
//   • Econ  → preço "a partir de" de cada imóvel pronto quando a pasta
//             TABELA ganha uma tabela nova (imoveis.custom_data.econ)
//   • Coralon → fotos novas nas pastas de imagens do Le Jardin
// O resto (portfólio novo, produto novo no site da Econ, arquivos novos que
// não são tabela/foto) vira relatório para revisão humana. As pastas do
// Drive são públicas — lidas pela visualização embutida, sem credencial.

type Entrada = {
  id: string;
  nome: string;
  pasta: boolean;
  modificado: string;
  caminho: string;
};
type Snapshot = Record<string, { nome: string; modificado: string; caminho: string }>;

export type Relatorio = {
  fonte: string;
  executado_em: string;
  primeira_execucao: boolean;
  aplicado: string[];
  revisar: string[];
  erros: string[];
  resumo: string;
};

const TENANT_BRUNO = "7c68f266-9c32-4ef5-a6da-56253453d73f";
const FONTES = {
  econ: {
    pastas: [
      { id: "1WYSVJs92z7cNRqwg--j6-532-_wWG8PN", nome: "Portfólio" },
      { id: "1dIXxw5EQZhQaHAQ7LTl-zbWYiKqcMYtA", nome: "Apresentações em PDF" },
    ],
    profundidade: 3,
  },
  coralon: {
    pastas: [{ id: "1Eg2IhGGc1-I3bH-OeSgxRP6wAIozZ9ZC", nome: "LE JARDIN" }],
    profundidade: 3,
    empreendimentoId: "e32c8594-3985-43df-9b00-052d9a01078b",
  },
} as const;
export type Fonte = keyof typeof FONTES;

const UA = { "User-Agent": "Mozilla/5.0 (imoB365 sync-fornecedores)" };
const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();

async function listarPasta(id: string): Promise<Entrada[]> {
  const r = await fetch(`https://drive.google.com/embeddedfolderview?id=${id}`, { headers: UA });
  if (!r.ok) throw new Error(`Drive ${id}: HTTP ${r.status}`);
  const html = await r.text();
  const out: Entrada[] = [];
  for (const bloco of html.split('<div class="flip-entry" ').slice(1)) {
    const eid = /id="entry-([A-Za-z0-9_-]+)"/.exec(bloco)?.[1];
    const nome = /flip-entry-title">([^<]*)</.exec(bloco)?.[1];
    if (!eid || nome == null) continue;
    out.push({
      id: eid,
      nome: decode(nome),
      pasta: bloco.includes("/drive/folders/"),
      modificado: /flip-entry-last-modified"><div>([^<]*)</.exec(bloco)?.[1] ?? "",
      caminho: "",
    });
  }
  return out;
}

async function listarRecursivo(raiz: { id: string; nome: string }, profundidade: number) {
  const todas: Entrada[] = [];
  const fila: { id: string; caminho: string; nivel: number }[] = [
    { id: raiz.id, caminho: raiz.nome, nivel: 0 },
  ];
  while (fila.length && todas.length < 3000) {
    const lote = fila.splice(0, 4);
    const res = await Promise.all(lote.map((p) => listarPasta(p.id).then((es) => ({ p, es }))));
    for (const { p, es } of res) {
      for (const e of es) {
        const item = { ...e, caminho: `${p.caminho}/${e.nome}` };
        todas.push(item);
        if (e.pasta && p.nivel + 1 < profundidade)
          fila.push({ id: e.id, caminho: item.caminho, nivel: p.nivel + 1 });
      }
    }
  }
  return todas;
}

async function baixarDrive(fileId: string): Promise<Uint8Array> {
  const r = await fetch(
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
    { headers: UA },
  );
  if (!r.ok) throw new Error(`download ${fileId}: HTTP ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

async function textoPdf(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return String(text);
}

// ------------------------------------------------------------------ Econ
type EconMeta = {
  tabela_pasta_id: string;
  tabela_arquivo_id?: string;
  area: number;
  dorms: number;
};

/** A tabela "vigente" da pasta: PDF de condomínio (não ficha técnica), a mais recente pelo nome/mês. */
function escolherTabela(arquivos: Entrada[]): Entrada | null {
  const MESES = [
    "JAN",
    "FEV",
    "MAR",
    "ABR",
    "MAI",
    "JUN",
    "JUL",
    "AGO",
    "SET",
    "OUT",
    "NOV",
    "DEZ",
  ];
  const tabelas = arquivos.filter(
    (a) =>
      !a.pasta &&
      /\.pdf$/i.test(a.nome) &&
      !/ficha|implanta/i.test(a.nome) &&
      /condom|tabela|financiada/i.test(a.nome) &&
      !/^direta/i.test(a.nome),
  );
  const peso = (n: string) => {
    const m = /(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s*\/?\s*(\d{2,4})/i.exec(n);
    if (!m) return 0;
    const ano = Number(m[2].length === 2 ? `20${m[2]}` : m[2]);
    return ano * 12 + MESES.indexOf(m[1].toUpperCase()) + 1;
  };
  // Mesmo mês: a "financiada" vence (a "direta" da Econ às vezes vem zerada).
  const fin = (n: string) => (/financiada/i.test(n) ? 1 : 0);
  return (
    tabelas.sort((a, b) => peso(b.nome) - peso(a.nome) || fin(b.nome) - fin(a.nome))[0] ?? null
  );
}

async function sincronizarPrecosEcon(sb: SupabaseClient, rel: Relatorio) {
  const { data: imoveis, error } = await sb
    .from("imoveis")
    .select("id,codigo_interno,titulo,preco,custom_data")
    .eq("tenant_id", TENANT_BRUNO)
    .like("codigo_interno", "econ-p%");
  if (error) throw new Error(error.message);
  const porPasta = new Map<
    string,
    {
      id: string;
      codigo: string;
      titulo: string;
      preco: number;
      meta: EconMeta;
      cd: Record<string, unknown>;
    }[]
  >();
  for (const i of imoveis ?? []) {
    const cd = (i.custom_data ?? {}) as Record<string, unknown>;
    const meta = cd.econ as EconMeta | undefined;
    if (!meta?.tabela_pasta_id) continue;
    const lista = porPasta.get(meta.tabela_pasta_id) ?? [];
    lista.push({
      id: i.id,
      codigo: i.codigo_interno!,
      titulo: i.titulo,
      preco: Number(i.preco),
      meta,
      cd,
    });
    porPasta.set(meta.tabela_pasta_id, lista);
  }

  for (const [pastaId, lista] of porPasta) {
    try {
      const arquivos = await listarPasta(pastaId);
      const tabela = escolherTabela(arquivos);
      if (!tabela) continue;
      if (lista.every((x) => x.meta.tabela_arquivo_id === tabela.id)) continue; // nada novo
      const unidades = parseTabelaEcon(await textoPdf(await baixarDrive(tabela.id))).filter(
        (u) => u.preco > 50_000,
      );
      if (!unidades.length) {
        rel.revisar.push(
          `Tabela nova sem formato reconhecido: "${tabela.nome}" (${lista[0].titulo.split(" – ")[0]}) — preço mantido.`,
        );
        // registra a tabela vista para não repetir o aviso toda semana
        for (const x of lista)
          await sb
            .from("imoveis")
            .update({ custom_data: { ...x.cd, econ: { ...x.meta, tabela_arquivo_id: tabela.id } } })
            .eq("id", x.id);
        continue;
      }
      for (const x of lista) {
        const novo = precoPlanta(unidades, x.meta);
        const cd = { ...x.cd, econ: { ...x.meta, tabela_arquivo_id: tabela.id } };
        if (novo == null) {
          await sb.from("imoveis").update({ custom_data: cd }).eq("id", x.id);
          rel.revisar.push(
            `${x.titulo}: nenhuma unidade disponível dessa planta na "${tabela.nome}" — avaliar despublicar.`,
          );
          continue;
        }
        const patch: Record<string, unknown> = { custom_data: cd };
        if (Math.round(novo) !== Math.round(x.preco)) patch.preco = novo;
        const { error: e } = await sb.from("imoveis").update(patch).eq("id", x.id);
        if (e) rel.erros.push(`${x.codigo}: ${e.message}`);
        else if (patch.preco)
          rel.aplicado.push(`${x.titulo}: preço ${fmt(x.preco)} → ${fmt(novo)} ("${tabela.nome}")`);
      }
    } catch (e) {
      rel.erros.push(`Tabela da pasta ${pastaId}: ${(e as Error).message}`);
    }
  }
}

/** Objeto JSON que começa em `inicio` (contagem de chaves ciente de strings). */
function lerObjeto(txt: string, inicio: number): unknown {
  let nivel = 0;
  let emString = false;
  for (let i = inicio; i < txt.length; i++) {
    const c = txt[i];
    if (emString) {
      if (c === "\\") i++;
      else if (c === '"') emString = false;
    } else if (c === '"') emString = true;
    else if (c === "{") nivel++;
    else if (c === "}" && --nivel === 0) return JSON.parse(txt.slice(inicio, i + 1));
  }
  return null;
}

/** Catálogo completo da Econ: toda página de produto embute a lista de todos os produtos. */
async function catalogoSiteEcon(): Promise<Record<string, { titulo: string; categoria: string }>> {
  const r = await fetch("https://econconstrutora.com.br/imovel/centro/free-liberdade", {
    headers: UA,
  });
  if (!r.ok) throw new Error(`site Econ: HTTP ${r.status}`);
  const html = (await r.text()).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  const out: Record<string, { titulo: string; categoria: string }> = {};
  for (const m of html.matchAll(/\{"_id":"[0-9a-f]{24}","localizacao"/g)) {
    try {
      const o = lerObjeto(html, m.index!) as {
        slug?: string;
        titulo?: string;
        categoria?: string;
      } | null;
      if (o?.slug) out[o.slug] = { titulo: o.titulo ?? o.slug, categoria: o.categoria ?? "" };
    } catch {
      /* objeto malformado — ignora */
    }
  }
  if (Object.keys(out).length < 20)
    throw new Error(`catálogo com só ${Object.keys(out).length} produtos — formato mudou?`);
  return out;
}

// ------------------------------------------------------------------ Coralon
const IMAGEM = /\.(jpe?g|png|webp)$/i;

async function aplicarFotosNovasLeJardin(sb: SupabaseClient, novas: Entrada[], rel: Relatorio) {
  const fotos = novas
    .filter((e) => !e.pasta && IMAGEM.test(e.nome) && /foto|imagen|imagem/i.test(e.caminho))
    .slice(0, 40);
  if (!fotos.length) return;
  const empId = FONTES.coralon.empreendimentoId;
  const { data: emp } = await sb
    .from("empreendimentos")
    .select("tenant_id,fotos_urls,nome")
    .eq("id", empId)
    .maybeSingle();
  if (!emp) return rel.erros.push("Empreendimento Le Jardin não encontrado");
  const urls = [...((emp.fotos_urls as string[] | null) ?? [])];
  let ok = 0;
  for (const f of fotos) {
    try {
      const bytes = await baixarDrive(f.id);
      if (bytes.byteLength > 12 * 1024 * 1024) {
        rel.revisar.push(`Foto grande demais, não enviada: ${f.caminho}`);
        continue;
      }
      const ext = (IMAGEM.exec(f.nome)?.[1] ?? "jpg").toLowerCase().replace("jpeg", "jpg");
      const path = `${emp.tenant_id}/emp-${empId}/${randomUUID()}.${ext}`;
      const { error } = await sb.storage.from("imovel-fotos").upload(path, bytes, {
        contentType: ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg",
      });
      if (error) throw new Error(error.message);
      urls.push(sb.storage.from("imovel-fotos").getPublicUrl(path).data.publicUrl);
      ok++;
    } catch (e) {
      rel.erros.push(`Foto ${f.caminho}: ${(e as Error).message}`);
    }
  }
  if (ok) {
    const { error } = await sb.from("empreendimentos").update({ fotos_urls: urls }).eq("id", empId);
    if (error) rel.erros.push(`Le Jardin fotos_urls: ${error.message}`);
    else rel.aplicado.push(`${emp.nome}: ${ok} foto(s) nova(s) adicionada(s) à galeria.`);
  }
}

// ------------------------------------------------------------------ geral
const fmt = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;

export async function sincronizarFornecedor(sb: SupabaseClient, fonte: Fonte): Promise<Relatorio> {
  const cfg = FONTES[fonte];
  let siteAtual: Record<string, { titulo: string; categoria: string }> | undefined;
  const rel: Relatorio = {
    fonte,
    executado_em: new Date().toISOString(),
    primeira_execucao: false,
    aplicado: [],
    revisar: [],
    erros: [],
    resumo: "",
  };

  const { data: estado } = await sb
    .from("fornecedor_sync")
    .select("snapshot")
    .eq("fonte", fonte)
    .maybeSingle();
  const anterior = (estado?.snapshot ?? null) as {
    drive?: Snapshot;
    site?: Record<string, { titulo: string; categoria: string }>;
  } | null;
  rel.primeira_execucao = !anterior;

  // 1) Drive: árvore atual × snapshot
  const atual: Snapshot = {};
  const entradas: Entrada[] = [];
  for (const p of cfg.pastas) {
    try {
      for (const e of await listarRecursivo(p, cfg.profundidade)) {
        entradas.push(e);
        atual[e.id] = { nome: e.nome, modificado: e.modificado, caminho: e.caminho };
      }
    } catch (e) {
      rel.erros.push(`Pasta ${p.nome}: ${(e as Error).message}`);
    }
  }
  const novas: Entrada[] = [];
  if (anterior?.drive) {
    for (const e of entradas) {
      const antes = anterior.drive[e.id];
      if (!antes) novas.push(e);
      else if (!e.pasta && antes.modificado !== e.modificado)
        rel.revisar.push(
          `Arquivo atualizado: ${e.caminho} (${antes.modificado} → ${e.modificado})`,
        );
    }
    for (const [id, antes] of Object.entries(anterior.drive))
      if (!atual[id]) rel.revisar.push(`Removido do Drive: ${antes.caminho}`);
  }

  // 2) Ações automáticas por fonte
  if (fonte === "econ") {
    for (const e of novas)
      rel.revisar.push(
        /portf/i.test(e.nome)
          ? `NOVO PORTFÓLIO: ${e.caminho} — rodar a importação completa no Claude Code.`
          : `Novo no Drive: ${e.caminho}`,
      );
    await sincronizarPrecosEcon(sb, rel);
    try {
      const site = await catalogoSiteEcon();
      if (anterior?.site) {
        for (const [slug, v] of Object.entries(site)) {
          const antes = anterior.site[slug];
          if (!antes)
            rel.revisar.push(
              `Produto novo no site da Econ: ${v.titulo} (econconstrutora.com.br/…/${slug})`,
            );
          else if (antes.categoria && v.categoria && antes.categoria !== v.categoria)
            rel.revisar.push(
              `${v.titulo}: site da Econ mudou de "${antes.categoria}" para "${v.categoria}" — avaliar fase/entrega.`,
            );
        }
      }
      siteAtual = site;
    } catch (e) {
      rel.erros.push(`Site da Econ: ${(e as Error).message}`);
    }
  } else {
    if (anterior) await aplicarFotosNovasLeJardin(sb, novas, rel);
    for (const e of novas)
      if (e.pasta || !IMAGEM.test(e.nome)) rel.revisar.push(`Novo no Drive: ${e.caminho}`);
  }

  // 3) Grava o novo estado (mantém o anterior das partes que falharam)
  const snapshot = {
    drive: Object.keys(atual).length ? atual : (anterior?.drive ?? {}),
    site: siteAtual ?? anterior?.site,
  };
  rel.resumo = rel.primeira_execucao
    ? `Primeira execução: estado de referência gravado (${Object.keys(atual).length} itens no Drive). Mudanças serão detectadas a partir da próxima.`
    : `${rel.aplicado.length} alteração(ões) aplicada(s), ${rel.revisar.length} item(ns) para revisar, ${rel.erros.length} erro(s).`;
  await sb
    .from("fornecedor_sync")
    .upsert(
      { fonte, snapshot, relatorio: rel, executado_em: rel.executado_em },
      { onConflict: "fonte" },
    );
  return rel;
}
