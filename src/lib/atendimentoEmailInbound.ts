import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { SupabaseClient } from "@supabase/supabase-js";

// Polling IMAP por tenant — cada tenant (imoB365 inclusa, mesmo mecanismo,
// ver memória "imob365-tenant-autonomy-byo-credentials") traz a própria
// caixa de e-mail via tenant_atendimento_canal_config. Uma falha de
// conexão/autenticação num tenant nunca derruba o polling dos demais.

type CanalEmailConfig = {
  imap_host?: string;
  imap_port?: number;
  usuario?: string;
  senha?: string;
};

export type PollResultado = {
  tenantId: string;
  novosChamados: number;
  novasMensagens: number;
  erro?: string;
};

// Casa por número de chamado no assunto, ex.: "Re: [CH-000123] Anúncio com foto errada"
const NUMERO_REGEX = /(CH-\d{6})/i;

export async function pollarEmailTenant(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  responsavelTipo: "tenant" | "imob365",
  config: CanalEmailConfig,
): Promise<PollResultado> {
  const resultado: PollResultado = { tenantId, novosChamados: 0, novasMensagens: 0 };
  if (!config.imap_host || !config.usuario || !config.senha) {
    resultado.erro = "Configuração de e-mail incompleta";
    return resultado;
  }

  const client = new ImapFlow({
    host: config.imap_host,
    port: config.imap_port ?? 993,
    secure: true,
    auth: { user: config.usuario, pass: config.senha },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const naoLidas = await client.search({ seen: false });
      for (const uid of naoLidas || []) {
        const msg = await client.fetchOne(uid, { source: true });
        if (!msg || !("source" in msg) || !msg.source) continue;

        const parsed = await simpleParser(msg.source);
        const remetente = parsed.from?.value?.[0];
        const de = remetente?.address ?? "";
        const nome = remetente?.name || de || "Desconhecido";
        const assunto = parsed.subject ?? "(sem assunto)";
        const corpo = (parsed.text ?? parsed.html?.toString() ?? "").slice(0, 4000);

        const match = assunto.match(NUMERO_REGEX);
        let chamadoId: string | null = null;

        if (match) {
          const numero = match[1].toUpperCase();
          const { data: chamado } = await supabaseAdmin
            .from("chamados")
            .select("id")
            .eq("numero", numero)
            .maybeSingle();
          chamadoId = chamado?.id ?? null;
        }

        if (chamadoId) {
          await supabaseAdmin.from("chamado_mensagens").insert({
            chamado_id: chamadoId,
            autor_tipo: "cliente",
            canal: "email",
            conteudo: corpo || "(mensagem sem texto)",
          });
          resultado.novasMensagens++;
        } else {
          const { data: novoChamado } = await supabaseAdmin
            .from("chamados")
            .insert({
              responsavel_tipo: responsavelTipo,
              tenant_id: tenantId,
              solicitante_tipo: "cliente_final",
              solicitante_nome: nome,
              solicitante_email: de || null,
              categoria: "outro",
              canal_origem: "email",
              assunto: assunto.slice(0, 120),
            })
            .select("id")
            .single();

          if (novoChamado) {
            await supabaseAdmin.from("chamado_mensagens").insert({
              chamado_id: novoChamado.id,
              autor_tipo: "cliente",
              canal: "email",
              conteudo: corpo || "(mensagem sem texto)",
            });
            resultado.novosChamados++;
          }
        }

        await client.messageFlagsAdd(uid, ["\\Seen"]);
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    resultado.erro = err instanceof Error ? err.message : String(err);
  }

  return resultado;
}

export async function pollarTodosCanaisEmail(
  supabaseAdmin: SupabaseClient,
): Promise<PollResultado[]> {
  const { data: configs } = await supabaseAdmin
    .from("tenant_atendimento_canal_config")
    .select("tenant_id, config")
    .eq("canal", "email")
    .eq("ativo", true);

  const { data: corporate } = await supabaseAdmin
    .from("tenants")
    .select("id")
    .eq("slug", "imob365")
    .maybeSingle();
  const corporateId = corporate?.id;

  const resultados: PollResultado[] = [];
  for (const c of configs ?? []) {
    const responsavelTipo = c.tenant_id === corporateId ? "imob365" : "tenant";
    const r = await pollarEmailTenant(
      supabaseAdmin,
      c.tenant_id,
      responsavelTipo,
      c.config as CanalEmailConfig,
    );
    resultados.push(r);
  }
  return resultados;
}
