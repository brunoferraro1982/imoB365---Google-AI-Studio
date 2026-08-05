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

  const fetchStatus = useServerFn(getMetaConnectionStatus);
  const fetchAuthorizeUrl = useServerFn(getMetaAuthorizeUrl);
  const salvarCredenciais = useServerFn(salvarMetaAppCredentials);
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
                  <strong>"Login do Facebook para Empresas"</strong> e{" "}
                  <strong>"Marketing API"</strong> (aparecem na lista de produtos disponíveis, é só
                  clicar em "Configurar" em cada um).
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
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
