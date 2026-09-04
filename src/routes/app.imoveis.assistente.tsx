import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Camera,
  FileText,
  Coins,
  MapPin,
  HandCoins,
  UserRound,
  Droplets,
  ListChecks,
  Globe,
  Share2,
  Check,
  ArrowLeft,
  ArrowRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  ImovelForm,
  type ImovelFormData,
  type ImovelFormSectionKey,
} from "@/components/imoveis/ImovelForm";
import { ImovelFotosSection } from "@/components/imoveis/ImovelFotosSection";
import { ImovelRedesSociaisSection } from "@/components/imoveis/ImovelRedesSociaisSection";
import { useImovelDraft } from "@/hooks/useImovelDraft";
import { getMetaConnectionStatus } from "@/lib/metaOAuth.functions";

export const Route = createFileRoute("/app/imoveis/assistente")({
  component: AssistenteImovel,
});

type StepKey = ImovelFormSectionKey | "fotos" | "redes_sociais";

const ALL_STEPS: { key: StepKey; label: string; icon: typeof Camera }[] = [
  { key: "fotos", label: "Fotos", icon: Camera },
  { key: "principal", label: "Informações", icon: FileText },
  { key: "valores", label: "Valores e medidas", icon: Coins },
  { key: "endereco", label: "Endereço", icon: MapPin },
  { key: "condicoes", label: "Condições", icon: HandCoins },
  { key: "corretor", label: "Corretor", icon: UserRound },
  { key: "marca_dagua", label: "Marca d'água", icon: Droplets },
  { key: "campos_personalizados", label: "Campos extras", icon: ListChecks },
  { key: "situacao", label: "Publicar", icon: Globe },
  { key: "redes_sociais", label: "Redes sociais", icon: Share2 },
];

function AssistenteImovel() {
  const { user, tenantId } = useAuth();
  const navigate = useNavigate();
  const { savedId, saving, hasUserSaved, save } = useImovelDraft(tenantId, user?.id);
  const fetchMetaStatus = useServerFn(getMetaConnectionStatus);
  const [stepIndex, setStepIndex] = useState(0);
  const [finalidade, setFinalidade] = useState("venda");
  const [hasCustomFields, setHasCustomFields] = useState(false);
  const [metaConectado, setMetaConectado] = useState(false);

  useEffect(() => {
    fetchMetaStatus()
      .then((s) => setMetaConectado(s.connected))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const steps = useMemo(
    () =>
      ALL_STEPS.filter((s) => s.key !== "condicoes" || finalidade !== "aluguel")
        .filter((s) => s.key !== "campos_personalizados" || hasCustomFields)
        .filter((s) => s.key !== "redes_sociais" || metaConectado),
    [finalidade, hasCustomFields, metaConectado],
  );

  const current = steps[Math.min(stepIndex, steps.length - 1)];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  // Na etapa "Publicar", quem avança é o botão "Publicar imóvel" do próprio
  // ImovelForm (ver handleSubmit) — um "Próximo" genérico aqui só confundiria,
  // deixando parecer que avança sem de fato publicar.
  const mostrarProximo = !isLast && current.key !== "situacao";

  async function handleSubmit(data: ImovelFormData, action: "save" | "publish" | "unpublish") {
    await save(data, action);
    if (action === "publish" && savedId) {
      const redesIndex = steps.findIndex((s) => s.key === "redes_sociais");
      if (redesIndex !== -1) {
        setStepIndex(redesIndex);
      } else {
        navigate({ to: "/app/imoveis/$id", params: { id: savedId } });
      }
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/imoveis">
            <X className="mr-1 h-4 w-4" /> Sair
          </Link>
        </Button>
        {hasUserSaved && <span className="text-xs text-muted-foreground">Progresso salvo</span>}
      </div>

      <h1 className="mb-1 text-3xl font-bold tracking-tight">Assistente de cadastro</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Cadastre um imóvel passo a passo — suas fotos e o rascunho já ficam salvos desde o início.
      </p>

      <div className="mb-6 flex items-center gap-1 overflow-x-auto pb-1">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const state = i < stepIndex ? "done" : i === stepIndex ? "active" : "todo";
          return (
            <div key={s.key} className="flex items-center gap-1">
              <div
                className={[
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs transition-colors",
                  state === "done" && "border-primary bg-primary text-primary-foreground",
                  state === "active" && "border-primary text-primary ring-2 ring-primary/20",
                  state === "todo" && "border-border text-muted-foreground",
                ]
                  .filter(Boolean)
                  .join(" ")}
                title={s.label}
              >
                {state === "done" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`h-px w-4 shrink-0 sm:w-8 ${i < stepIndex ? "bg-primary" : "bg-border"}`}
                />
              )}
            </div>
          );
        })}
      </div>

      <p className="mb-4 text-sm font-medium text-muted-foreground">
        Etapa {stepIndex + 1} de {steps.length} — {current.label}
      </p>

      {/* As duas seções ficam sempre montadas (só a visibilidade muda) pra não
          perder dado já digitado ao voltar pra Fotos e avançar de novo. */}
      <div hidden={current.key !== "fotos"}>
        <ImovelFotosSection imovelId={savedId} tenantId={tenantId} />
      </div>
      <div hidden={current.key !== "redes_sociais"}>
        {savedId && <ImovelRedesSociaisSection imovelId={savedId} tenantId={tenantId} />}
      </div>
      <div hidden={current.key === "fotos" || current.key === "redes_sociais"}>
        <ImovelForm
          activeSection={
            current.key === "fotos" || current.key === "redes_sociais" ? "principal" : current.key
          }
          onSubmit={handleSubmit}
          submitLabel={hasUserSaved ? "Salvar alterações" : "Criar imóvel"}
          submitting={saving}
          mode={hasUserSaved ? "edit" : "create"}
          onDataChange={(d) => setFinalidade(d.finalidade)}
          onCustomFieldsCountChange={(n) => setHasCustomFields(n > 0)}
        />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button variant="outline" disabled={isFirst} onClick={() => setStepIndex((i) => i - 1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        {mostrarProximo && (
          <Button onClick={() => setStepIndex((i) => i + 1)}>
            Próximo <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
