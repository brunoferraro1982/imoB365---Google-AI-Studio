import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { ImovelForm } from "@/components/imoveis/ImovelForm";
import { ImovelFotosSection } from "@/components/imoveis/ImovelFotosSection";
import { ImovelRedesSociaisSection } from "@/components/imoveis/ImovelRedesSociaisSection";
import { useImovelDraft } from "@/hooks/useImovelDraft";

export const Route = createFileRoute("/app/imoveis/novo")({
  component: NovoImovel,
});

function NovoImovel() {
  const { user, tenantId } = useAuth();
  const navigate = useNavigate();
  const { savedId, saving, hasUserSaved, save } = useImovelDraft(tenantId, user?.id);
  const [publicado, setPublicado] = useState(false);

  return (
    <div className="mx-auto max-w-5xl p-8">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/app/imoveis">
          <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
        </Link>
      </Button>
      <h1 className="mb-1 text-3xl font-bold tracking-tight">Novo imóvel</h1>
      <p className="mb-6 text-sm text-muted-foreground">Cadastre imóveis para venda e locação</p>

      <ImovelFotosSection imovelId={savedId} tenantId={tenantId} />

      <ImovelForm
        onSubmit={save}
        submitLabel={hasUserSaved ? "Salvar alterações" : "Criar imóvel"}
        submitting={saving}
        mode={hasUserSaved ? "edit" : "create"}
        onDataChange={(d) => setPublicado(d.publicado)}
      />

      {hasUserSaved && savedId && publicado && (
        <div className="mt-6">
          <ImovelRedesSociaisSection imovelId={savedId} tenantId={tenantId} />
        </div>
      )}

      {hasUserSaved && savedId && (
        <div className="mt-6 flex justify-end">
          <Button
            size="lg"
            onClick={() => navigate({ to: "/app/imoveis/$id", params: { id: savedId } })}
          >
            <Check className="mr-2 h-4 w-4" />
            Concluir cadastro
          </Button>
        </div>
      )}
    </div>
  );
}
