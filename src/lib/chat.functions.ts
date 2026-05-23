import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const uuid = z.string().uuid();

/* ============================================================
 * Helpers
 * ============================================================ */

async function isTenantMember(supabase: any, userId: string, tenantId: string) {
  const { data } = await supabase.rpc("is_member_of_tenant", {
    _user_id: userId,
    _tenant_id: tenantId,
  });
  return !!data;
}

/* ============================================================
 * listConversations
 * ============================================================ */

const listSchema = z.object({
  filter: z.enum(["todas", "vendendo", "comprando"]).default("todas"),
  search: z.string().max(120).optional(),
});

export const listConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => listSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;

    // Tenants where user is member (corretor/admin view)
    const { data: roles } = await supabase
      .from("user_roles")
      .select("tenant_id")
      .eq("user_id", userId);
    const memberTenants = Array.from(
      new Set((roles ?? []).map((r) => r.tenant_id).filter(Boolean) as string[]),
    );

    let query = supabase
      .from("chat_conversations")
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(200);

    if (data.filter === "comprando") {
      query = query.eq("interessado_user_id", userId);
    } else if (data.filter === "vendendo") {
      if (memberTenants.length === 0) return { items: [] };
      query = query.in("tenant_id", memberTenants);
    } else {
      // todas: própria + tenants em que é membro
      const orParts = [`interessado_user_id.eq.${userId}`];
      if (memberTenants.length > 0) {
        orParts.push(`tenant_id.in.(${memberTenants.join(",")})`);
      }
      query = query.or(orParts.join(","));
    }

    const { data: convs, error } = await query;
    if (error) throw new Error(error.message);
    if (!convs || convs.length === 0) return { items: [] };

    const imovelIds = Array.from(new Set(convs.map((c) => c.imovel_id)));
    const userIds = Array.from(
      new Set(
        convs.flatMap((c) => [c.interessado_user_id, c.corretor_user_id].filter(Boolean) as string[]),
      ),
    );

    const [{ data: imoveis }, { data: fotos }, { data: profiles }] = await Promise.all([
      supabase
        .from("imoveis")
        .select("id,titulo,slug,preco,finalidade")
        .in("id", imovelIds),
      supabase
        .from("imovel_fotos")
        .select("imovel_id,storage_path,capa,ordem")
        .in("imovel_id", imovelIds)
        .order("capa", { ascending: false })
        .order("ordem"),
      userIds.length > 0
        ? supabase.from("profiles").select("id,nome").in("id", userIds)
        : Promise.resolve({ data: [] as { id: string; nome: string | null }[] }),
    ]);

    const imovelById = new Map((imoveis ?? []).map((i) => [i.id, i]));
    const fotoByImovel = new Map<string, string>();
    for (const f of fotos ?? []) {
      if (!fotoByImovel.has(f.imovel_id)) fotoByImovel.set(f.imovel_id, f.storage_path);
    }
    const nameByUser = new Map(
      (profiles ?? []).map((p) => [p.id, p.nome ?? "Usuário"] as const),
    );

    const items = convs
      .map((c) => {
        const im = imovelById.get(c.imovel_id);
        const myRole: "interessado" | "corretor" =
          c.interessado_user_id === userId ? "interessado" : "corretor";
        const counterpartId =
          myRole === "interessado" ? c.corretor_user_id : c.interessado_user_id;
        return {
          id: c.id,
          tenantId: c.tenant_id,
          imovelId: c.imovel_id,
          assunto: c.assunto ?? im?.titulo ?? "Conversa",
          imovel: im
            ? {
                id: im.id,
                titulo: im.titulo,
                slug: im.slug,
                preco: Number(im.preco ?? 0),
                finalidade: im.finalidade,
                fotoPath: fotoByImovel.get(im.id) ?? null,
              }
            : null,
          myRole,
          counterpartName: counterpartId
            ? nameByUser.get(counterpartId) ?? "Usuário"
            : "Usuário",
          lastMessageAt: c.last_message_at,
          lastMessagePreview: c.last_message_preview,
          unread: myRole === "interessado" ? c.unread_interessado : c.unread_corretor,
        };
      })
      .filter((it) => {
        if (!data.search) return true;
        const q = data.search.toLowerCase();
        return (
          it.assunto.toLowerCase().includes(q) ||
          it.counterpartName.toLowerCase().includes(q) ||
          (it.lastMessagePreview ?? "").toLowerCase().includes(q)
        );
      });

    return { items };
  });

/* ============================================================
 * getConversation
 * ============================================================ */

export const getConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;

    const { data: c, error } = await supabase
      .from("chat_conversations")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!c) throw new Error("Conversa não encontrada");

    const isInteressado = c.interessado_user_id === userId;
    const isMember = await isTenantMember(supabase, userId, c.tenant_id);
    if (!isInteressado && !isMember) throw new Error("Sem acesso a esta conversa");

    const myRole: "interessado" | "corretor" = isInteressado ? "interessado" : "corretor";
    const counterpartId = isInteressado ? c.corretor_user_id : c.interessado_user_id;

    const [{ data: im }, { data: foto }, { data: counterpart }] = await Promise.all([
      supabase
        .from("imoveis")
        .select("id,titulo,slug,preco,finalidade,publicado,status")
        .eq("id", c.imovel_id)
        .maybeSingle(),
      supabase
        .from("imovel_fotos")
        .select("storage_path")
        .eq("imovel_id", c.imovel_id)
        .order("capa", { ascending: false })
        .order("ordem")
        .limit(1)
        .maybeSingle(),
      counterpartId
        ? supabase.from("profiles").select("id,nome").eq("id", counterpartId).maybeSingle()
        : Promise.resolve({ data: null as null | { id: string; nome: string | null } }),
    ]);

    return {
      id: c.id,
      tenantId: c.tenant_id,
      assunto: c.assunto ?? im?.titulo ?? "Conversa",
      myRole,
      counterpart: {
        id: counterpartId,
        nome: counterpart?.nome ?? "Usuário",
      },
      imovel: im
        ? {
            id: im.id,
            titulo: im.titulo,
            slug: im.slug,
            preco: Number(im.preco ?? 0),
            finalidade: im.finalidade,
            fotoPath: foto?.storage_path ?? null,
            disponivel: im.publicado && im.status === "ativo",
          }
        : null,
    };
  });

/* ============================================================
 * getMessages
 * ============================================================ */

export const getMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        conversationId: uuid,
        before: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;

    const { data: c } = await supabase
      .from("chat_conversations")
      .select("tenant_id,interessado_user_id")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!c) throw new Error("Conversa não encontrada");
    const ok =
      c.interessado_user_id === userId ||
      (await isTenantMember(supabase, userId, c.tenant_id));
    if (!ok) throw new Error("Sem acesso");

    let q = supabase
      .from("chat_messages")
      .select("id,sender_user_id,sender_role,content,kind,read_at,created_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.before) q = q.lt("created_at", data.before);

    const { data: msgs, error } = await q;
    if (error) throw new Error(error.message);
    return { items: (msgs ?? []).reverse() };
  });

/* ============================================================
 * sendMessage
 * ============================================================ */

const sendSchema = z.object({
  conversationId: uuid,
  content: z.string().trim().min(1).max(4000),
  kind: z.enum(["text", "quick_reply"]).default("text"),
});

async function deliverMessage(supabase: any, opts: {
  conversationId: string;
  senderUserId: string;
  content: string;
  kind: "text" | "quick_reply" | "system";
}) {
  const { data: c, error: cErr } = await supabase
    .from("chat_conversations")
    .select("*")
    .eq("id", opts.conversationId)
    .maybeSingle();
  if (cErr) throw new Error(cErr.message);
  if (!c) throw new Error("Conversa não encontrada");

  const isInteressado = c.interessado_user_id === opts.senderUserId;
  const isMember = !isInteressado
    ? await isTenantMember(supabase, opts.senderUserId, c.tenant_id)
    : false;
  if (!isInteressado && !isMember) throw new Error("Sem acesso à conversa");

  const senderRole: "interessado" | "corretor" = isInteressado ? "interessado" : "corretor";

  const { data: inserted, error: insErr } = await supabase
    .from("chat_messages")
    .insert({
      conversation_id: c.id,
      tenant_id: c.tenant_id,
      sender_user_id: opts.senderUserId,
      sender_role: senderRole,
      content: opts.content,
      kind: opts.kind,
    })
    .select()
    .single();
  if (insErr) throw new Error(insErr.message);

  const preview = opts.content.slice(0, 140);
  const baseUpd = {
    last_message_at: new Date().toISOString(),
    last_message_preview: preview,
    last_sender_role: senderRole,
  };
  const isCorretorUnset = senderRole === "corretor" && !c.corretor_user_id;
  const upd =
    senderRole === "interessado"
      ? { ...baseUpd, unread_interessado: 0, unread_corretor: (c.unread_corretor ?? 0) + 1 }
      : { 
          ...baseUpd, 
          unread_corretor: 0, 
          unread_interessado: (c.unread_interessado ?? 0) + 1,
          ...(isCorretorUnset ? { corretor_user_id: opts.senderUserId } : {})
        };
  await supabase.from("chat_conversations").update(upd).eq("id", c.id);

  // Notificação para a contraparte
  const recipientId =
    senderRole === "interessado" ? c.corretor_user_id : c.interessado_user_id;
  if (recipientId) {
    const link =
      senderRole === "interessado"
        ? `/app/chat/${c.id}`
        : `/conta/chat/${c.id}`;
    await supabaseAdmin.from("notifications").insert({
      tenant_id: c.tenant_id,
      user_id: recipientId,
      tipo: "chat_mensagem",
      titulo: "Nova mensagem no chat",
      mensagem: preview,
      link,
    });
  }

  return inserted;
}

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => sendSchema.parse(i))
  .handler(async ({ data, context }) => {
    const msg = await deliverMessage(context.supabase, {
      conversationId: data.conversationId,
      senderUserId: context.userId,
      content: data.content,
      kind: data.kind,
    });
    return msg;
  });

/* ============================================================
 * markRead
 * ============================================================ */

export const markRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ conversationId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { data: c } = await supabase
      .from("chat_conversations")
      .select("tenant_id,interessado_user_id")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!c) throw new Error("Conversa não encontrada");
    const isInteressado = c.interessado_user_id === userId;
    const isMember = !isInteressado
      ? await isTenantMember(supabase, userId, c.tenant_id)
      : false;
    if (!isInteressado && !isMember) throw new Error("Sem acesso");

    const otherRole = isInteressado ? "corretor" : "interessado";
    await supabase
      .from("chat_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", data.conversationId)
      .is("read_at", null)
      .eq("sender_role", otherRole);

    const upd = isInteressado
      ? { unread_interessado: 0 }
      : { unread_corretor: 0 };
    await supabase
      .from("chat_conversations")
      .update(upd)
      .eq("id", data.conversationId);
    return { ok: true };
  });

/* ============================================================
 * startConversationFromImovel
 * ============================================================ */

const startSchema = z.object({
  imovelId: uuid,
  firstMessage: z.string().trim().min(1).max(4000),
});

export const startConversationFromImovel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => startSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;

    const { data: im } = await supabase
      .from("imoveis")
      .select("id,tenant_id,titulo,corretor_responsavel_id,publicado,status")
      .eq("id", data.imovelId)
      .maybeSingle();
    if (!im) throw new Error("Imóvel não encontrado");
    if (!im.publicado || im.status !== "ativo")
      throw new Error("Imóvel indisponível");

    // Anti-self: dono não fala consigo mesmo
    if (await isTenantMember(supabase, userId, im.tenant_id)) {
      throw new Error(
        "Você é membro da imobiliária deste imóvel e não pode iniciar uma conversa como interessado.",
      );
    }

    // Rate-limit simples: máx 10 novas conversas/hora
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("chat_conversations")
      .select("id", { count: "exact", head: true })
      .eq("interessado_user_id", userId)
      .gte("created_at", oneHourAgo);
    if ((count ?? 0) >= 10) {
      throw new Error("Você iniciou muitas conversas recentemente. Tente novamente em 1 hora.");
    }

    // Resolve corretor_user_id (snapshot)
    let corretorUserId: string | null = null;
    if (im.corretor_responsavel_id) {
      const { data: cor } = await supabase
        .from("corretores")
        .select("user_id")
        .eq("id", im.corretor_responsavel_id)
        .maybeSingle();
      corretorUserId = cor?.user_id ?? null;
    }

    // Upsert conversa
    const { data: existing } = await supabase
      .from("chat_conversations")
      .select("id")
      .eq("imovel_id", im.id)
      .eq("interessado_user_id", userId)
      .maybeSingle();

    let convId = existing?.id ?? null;
    if (!convId) {
      const { data: created, error } = await supabase
        .from("chat_conversations")
        .insert({
          tenant_id: im.tenant_id,
          imovel_id: im.id,
          interessado_user_id: userId,
          corretor_user_id: corretorUserId,
          assunto: im.titulo,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      convId = created.id;
    }

    await deliverMessage(supabase, {
      conversationId: convId!,
      senderUserId: userId,
      content: data.firstMessage,
      kind: "text",
    });

    return { id: convId! };
  });

/* ============================================================
 * listQuickReplies
 * ============================================================ */

export const listQuickReplies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ tenantId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const isMember = await isTenantMember(supabase, userId, data.tenantId);
    if (!isMember) return { items: [] };
    const { data: items } = await supabase
      .from("chat_quick_replies")
      .select("id,label,content,ordem")
      .eq("tenant_id", data.tenantId)
      .eq("ativo", true)
      .order("ordem");
    return { items: items ?? [] };
  });

/* ============================================================
 * Unread total (para badge na sidebar)
 * ============================================================ */

export const getUnreadTotal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("tenant_id")
      .eq("user_id", userId);
    const tenants = Array.from(
      new Set((roles ?? []).map((r) => r.tenant_id).filter(Boolean) as string[]),
    );

    let totalCorretor = 0;
    if (tenants.length > 0) {
      const { data } = await supabase
        .from("chat_conversations")
        .select("unread_corretor")
        .in("tenant_id", tenants);
      totalCorretor = (data ?? []).reduce((s, c) => s + (c.unread_corretor ?? 0), 0);
    }

    const { data: minhas } = await supabase
      .from("chat_conversations")
      .select("unread_interessado")
      .eq("interessado_user_id", userId);
    const totalInteressado = (minhas ?? []).reduce(
      (s, c) => s + (c.unread_interessado ?? 0),
      0,
    );

    return { corretor: totalCorretor, interessado: totalInteressado };
  });