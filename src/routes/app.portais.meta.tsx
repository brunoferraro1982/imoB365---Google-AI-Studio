import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Facebook, CheckCircle2, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  getMetaConnectionStatus,
  getMetaAuthorizeUrl,
  salvarMetaAppCredentials,
  salvarMetaLoginConfigId,
  removerMetaAppCredentials,
  disconnectMeta,
  META_WEBHOOK_VERIFY_TOKEN,
} from "@/lib/metaOAuth.functions";

const META_ERROR_LABEL: Record<string, string> = {
  parametros_ausentes: "A Meta não retornou os parâmetros esperados.",
  state_invalido: "A conexão expirou ou é inválida — tente novamente.",
  integracao_nao_configurada: "Configure seu App da Meta antes de conectar a Página.",
  token_exchange_falhou:
    "A Meta recusou a autorização — confira se o App ID/Secret estão corretos.",
  nenhuma_pagina: "Nenhuma Página do Facebook encontrada nessa conta.",
  erro_ao_salvar: "Falha ao salvar a conexão. Tente novamente.",
  erro_inesperado: "Erro inesperado ao conectar. Tente novamente.",
};

export const Route = createFileRoute("/app/portais/meta")({
  head: () => ({ meta: [{ title: "Conectar Facebook/Instagram — imob365" }] }),
  component: MetaConexaoPage,
});

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
        {value}
      </code>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success("Copiado");
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

// Passo a passo pensado pra quem contratou o serviço e não é técnico —
// cada instrução diz exatamente onde clicar, sem pressupor conhecimento de
// desenvolvimento. Motivo de ser um App por tenant (não um app único do
// imoB365): leads_retrieval/catalog_management só funcionam em "Standard
// Access" pra Páginas que o próprio app já é dono — um app gerenciando
// Páginas de terceiros exigiria revisão da Meta (semanas, sem garantia).
// Como o app do tenant só toca a própria Página dele, funciona na hora.
function MetaConexaoPage() {
  const search = useSearch({ strict: false }) as { meta_connected?: string; meta_error?: string };
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [loginConfigId, setLoginConfigId] = useState("");
  const [salvandoConfigId, setSalvandoConfigId] = useState(false);

  const fetchStatus = useServerFn(getMetaConnectionStatus);
  const fetchAuthorizeUrl = useServerFn(getMetaAuthorizeUrl);
  const salvarCredenciais = useServerFn(salvarMetaAppCredentials);
  const salvarConfigId = useServerFn(salvarMetaLoginConfigId);
  const removerCredenciais = useServerFn(removerMetaAppCredentials);
  const desconectar = useServerFn(disconnectMeta);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["meta-connection-status"],
    queryFn: () => fetchStatus(),
  });

  useEffect(() => {
    if (search.meta_connected) {
      toast.success("Página do Facebook conectada com sucesso!");
      refetch();
    } else if (search.meta_error) {
      toast.error(META_ERROR_LABEL[search.meta_error] ?? "Não foi possível conectar à Meta.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoginConfigId(data?.loginConfigId ?? "");
  }, [data?.loginConfigId]);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://portal.imob365.com.br";
  const webhookUrl = `${origin}/api/public/webhooks/meta`;
  const redirectUri = `${origin}/api/public/meta/oauth/callback`;

  async function onSalvar() {
    if (!appId || !appSecret) {
      toast.error("Preencha o ID do aplicativo e a Chave Secreta.");
      return;
    }
    setSalvando(true);
    try {
      await salvarCredenciais({ data: { appId, appSecret } });
      toast.success("App da Meta salvo. Agora clique em Conectar Facebook.");
      setAppId("");
      setAppSecret("");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar");
    } finally {
      setSalvando(false);
    }
  }

  async function onSalvarConfigId() {
    if (!loginConfigId.trim()) {
      toast.error("Cole o ID da Configuração de Login.");
      return;
    }
    setSalvandoConfigId(true);
    try {
      await salvarConfigId({ data: { loginConfigId: loginConfigId.trim() } });
      toast.success("Configuração de Login salva. Clique em Conectar Facebook novamente.");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar");
    } finally {
      setSalvandoConfigId(false);
    }
  }

  async function onConectar() {
    setConectando(true);
    try {
      const { url } = await fetchAuthorizeUrl();
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível iniciar a conexão");
      setConectando(false);
    }
  }

  async function onDesconectar() {
    setDesconectando(true);
    try {
      await desconectar();
      toast.success("Página desconectada");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível desconectar");
    } finally {
      setDesconectando(false);
    }
  }

  async function onRemoverApp() {
    if (!confirm("Isso apaga o App configurado e a conexão com a Página. Tem certeza?")) return;
    setRemovendo(true);
    try {
      await removerCredenciais();
      toast.success("App removido. Você pode configurar um novo a qualquer momento.");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível remover");
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <Link
        to="/app/portais"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Facebook className="h-7 w-7 text-primary" />
          Conectar Facebook/Instagram
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conectando sua própria Página, você passa a receber de volta, direto no seu funil, os
          leads reais gerados pelas suas campanhas no Facebook e Instagram.
        </p>
        <Link
          to="/ajuda/facebook-instagram"
          target="_blank"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Guia completo, passo a passo, com solução de
          problemas
        </Link>
      </header>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <div className="space-y-6">
          {!data?.appConfigured && (
            <section className="rounded-xl border border-border bg-card p-6">
              <h2 className="mb-3 text-base font-semibold">Passo a passo (leva uns 10 minutos)</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Cada corretor/imobiliária precisa do próprio "aplicativo" cadastrado na Meta — é
                gratuito e simples, só precisa de uma conta normal do Facebook. Como o aplicativo só
                vai gerenciar a <strong>sua própria Página</strong>, isso funciona na hora, sem fila
                de aprovação da Meta (que só existe pra quem gerencia Páginas de outras empresas).
              </p>
              <ol className="space-y-4 text-sm">
                <li>
                  <strong>1. Business Manager.</strong> Acesse{" "}
                  <a
                    href="https://business.facebook.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    business.facebook.com <ExternalLink className="inline h-3 w-3" />
                  </a>{" "}
                  e crie (ou use) um Business Manager pra sua imobiliária/CRECI.
                </li>
                <li>
                  <strong>2. Criar o aplicativo.</strong> Acesse{" "}
                  <a
                    href="https://developers.facebook.com/apps"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    developers.facebook.com/apps <ExternalLink className="inline h-3 w-3" />
                  </a>{" "}
                  → "Criar aplicativo" → tipo <strong>"Negócios"</strong> → dê o nome que quiser
                  (ex.: "Corretor João — imob365").
                </li>
                <li>
                  <strong>3. Adicionar produtos.</strong> Dentro do aplicativo, adicione os produtos{" "}
                  <strong>"Login do Facebook para Empresas"</strong>,{" "}
                  <strong>"Marketing API"</strong> e <strong>"Instagram Graph API"</strong>{" "}
                  (aparecem na lista de produtos disponíveis, é só clicar em "Configurar" em cada
                  um). O Instagram Graph API é o que permite publicar Post/Story direto do imob365
                  mais pra frente — sem ele, só o Facebook funciona.
                </li>
                <li>
                  <strong>3.1. Autorizar o app a acessar sua Página (obrigatório).</strong> Como o
                  app usa "Login do Facebook para Empresas", a Meta só deixa conectar Páginas que já
                  estão atribuídas ao app dentro do Business Manager — sem esse passo, ao clicar em
                  "Conectar Facebook" mais abaixo, você recebe o erro "Nenhuma Página do Facebook
                  encontrada nessa conta", mesmo sendo administrador dela. Acesse{" "}
                  <a
                    href="https://business.facebook.com/settings/apps"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    business.facebook.com/settings/apps <ExternalLink className="inline h-3 w-3" />
                  </a>{" "}
                  → selecione este aplicativo → <strong>"Adicionar ativos"</strong> → aba{" "}
                  <strong>Páginas</strong> → selecione sua Página → marque{" "}
                  <strong>"Acesso total"</strong> → Salvar.
                </li>
                <li>
                  <strong>3.2. Criar uma Configuração de Login (obrigatório).</strong> Mesmo com a
                  Página atribuída no passo anterior, "Login do Facebook para Empresas" só concede
                  acesso a ela através de uma Configuração de Login — sem isso, a conexão continua
                  falhando com "Nenhuma Página encontrada". Dentro do produto{" "}
                  <strong>"Login do Facebook para Empresas"</strong> → aba{" "}
                  <strong>Configurações</strong> → "Criar configuração" → tipo de ativo{" "}
                  <strong>Página</strong> → selecione sua Página → marque as permissões:{" "}
                  <em>
                    pages_show_list, pages_manage_metadata, pages_manage_posts,
                    pages_read_engagement, leads_retrieval, catalog_management, instagram_basic,
                    instagram_content_publish
                  </em>{" "}
                  → Salvar. Copie o <strong>ID de configuração</strong> gerado e cole no campo
                  abaixo (aparece depois de salvar o App ID/Secret).
                </li>
                <li>
                  <strong>
                    3.3. Vincular o Instagram (opcional, mas necessário pra publicar lá também).
                  </strong>{" "}
                  Sua Página do Facebook precisa estar ligada a uma{" "}
                  <strong>conta profissional do Instagram</strong>. Isso é feito no próprio
                  Instagram, não no app da Meta: no app do Instagram (celular), vá em Configurações
                  → Contas vinculadas → Facebook, e escolha a mesma Página do Facebook desta
                  imobiliária. Depois de vincular, volte aqui e conecte normalmente — o imob365
                  detecta a vinculação sozinho.
                </li>
                <li>
                  <strong>4. Configurar o Webhook.</strong> No produto Webhooks, escolha o objeto{" "}
                  <strong>"Página"</strong> e cole:
                  <div className="mt-2 space-y-2">
                    <div>
                      <span className="mb-1 block text-xs text-muted-foreground">
                        URL de retorno de chamada
                      </span>
                      <CopyField value={webhookUrl} />
                    </div>
                    <div>
                      <span className="mb-1 block text-xs text-muted-foreground">
                        Token de verificação
                      </span>
                      <CopyField value={META_WEBHOOK_VERIFY_TOKEN} />
                    </div>
                  </div>
                  Depois, na lista de campos, assine o campo <strong>"leadgen"</strong>.
                </li>
                <li>
                  <strong>5. URI de redirecionamento.</strong> Ainda em "Login do Facebook" →
                  Configurações, cole na "URI de redirecionamento do OAuth válido":
                  <div className="mt-2">
                    <CopyField value={redirectUri} />
                  </div>
                </li>
                <li>
                  <strong>6. Copiar as credenciais.</strong> Vá em Configurações → Básico e copie o{" "}
                  <strong>ID do aplicativo</strong> e a <strong>Chave secreta do aplicativo</strong>{" "}
                  (pode pedir sua senha do Facebook pra mostrar) — cole os dois campos abaixo.
                </li>
              </ol>
            </section>
          )}

          {!data?.appConfigured ? (
            <section className="rounded-xl border border-border bg-card p-6">
              <h2 className="mb-3 text-base font-semibold">Seu App da Meta</h2>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>ID do aplicativo</Label>
                  <Input
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="1234567890123456"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Chave secreta do aplicativo</Label>
                  <Input
                    type="password"
                    value={appSecret}
                    onChange={(e) => setAppSecret(e.target.value)}
                    placeholder="••••••••••••••••••••••••••••••••"
                  />
                </div>
                <Button onClick={onSalvar} disabled={salvando} className="w-full">
                  {salvando ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            </section>
          ) : (
            <section className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold">Seu App da Meta</h2>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onRemoverApp}
                  disabled={removendo}
                  className="text-red-600"
                >
                  {removendo ? "Removendo…" : "Remover App configurado"}
                </Button>
              </div>

              <div className="mb-4 space-y-1.5">
                <Label>ID de Configuração de Login (passo 3.2 acima)</Label>
                <div className="flex gap-2">
                  <Input
                    value={loginConfigId}
                    onChange={(e) => setLoginConfigId(e.target.value)}
                    placeholder="123456789012345"
                  />
                  <Button variant="outline" onClick={onSalvarConfigId} disabled={salvandoConfigId}>
                    {salvandoConfigId ? "Salvando…" : "Salvar"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Necessário se sua Página pertence a um Portfólio Empresarial — sem isso a conexão
                  não encontra a Página mesmo ela estando corretamente atribuída ao app.
                </p>
              </div>

              {data?.connected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                    <div className="text-sm">
                      <p className="font-medium">
                        Conectado à página <strong>{data.pageName ?? "—"}</strong>
                      </p>
                      <p className="text-muted-foreground">
                        Desde{" "}
                        {data.connectedAt
                          ? new Date(data.connectedAt).toLocaleDateString("pt-BR")
                          : "—"}
                      </p>
                    </div>
                  </div>
                  {data.instagramConnected ? (
                    <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                      <p className="text-sm font-medium">
                        Conta profissional do Instagram vinculada — pronto pra publicar nas duas
                        redes.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                      <p className="font-medium">Instagram ainda não vinculado</p>
                      <p className="mt-1 text-muted-foreground">
                        A publicação no Facebook já funciona. Pra publicar no Instagram também, siga
                        o passo 3.3 acima (vincular a conta no próprio Instagram) e depois clique em
                        "Desconectar Página" e "Conectar Facebook" de novo, pra o imob365 detectar a
                        vinculação.
                      </p>
                    </div>
                  )}
                  <Button variant="outline" onClick={onDesconectar} disabled={desconectando}>
                    {desconectando ? "Desconectando…" : "Desconectar Página"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    App configurado! Agora clique abaixo pra conectar a sua Página do Facebook.
                  </p>
                  <Button onClick={onConectar} disabled={conectando}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {conectando ? "Redirecionando…" : "Conectar Facebook"}
                  </Button>
                  {search.meta_error === "nenhuma_pagina" && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                      <p className="font-medium">
                        Nenhuma Página do Facebook encontrada nessa conta
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        Confira duas coisas: (1) a Página está atribuída a este app em{" "}
                        <a
                          href="https://business.facebook.com/settings/apps"
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline underline-offset-2"
                        >
                          business.facebook.com/settings/apps{" "}
                          <ExternalLink className="inline h-3 w-3" />
                        </a>{" "}
                        (Adicionar ativos → Páginas → Acesso total); (2) se sua Página pertence a um{" "}
                        <strong>Portfólio Empresarial</strong>, isso sozinho não basta — você também
                        precisa criar uma <strong>Configuração de Login</strong> (passo 3.2 acima) e
                        colar o ID no campo "ID de Configuração de Login" logo acima deste botão.
                        Depois volte aqui e clique em "Conectar Facebook" de novo.
                      </p>
                      <Link
                        to="/ajuda/facebook-instagram"
                        hash="erro-nenhuma-pagina"
                        target="_blank"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        Ver explicação detalhada no guia <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
