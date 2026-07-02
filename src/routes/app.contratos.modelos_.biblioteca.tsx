import { moduleGuard } from "@/lib/routeGuard";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BUILTIN_TEMPLATES, type BuiltinTemplate } from "@/lib/contractTemplatesLibrary";

export const Route = createFileRoute("/app/contratos/modelos_/biblioteca")({
  beforeLoad: moduleGuard("juridico"),
  component: BibliotecaModelosPage,
});

function BibliotecaModelosPage() {
  const { tenantId, user } = useAuth();
  const [cloning, setCloning] = useState<string | null>(null);

  async function applyBuiltinTemplate(tpl: BuiltinTemplate) {
    if (!tenantId) return;
    setCloning(tpl.slug);
    const { error } = await supabase.from("contrato_templates").insert({
      tenant_id: tenantId,
      nome: tpl.nome,
      tipo: tpl.tipo as any,
      conteudo: tpl.conteudo,
      ativo: true,
      created_by: user?.id,
    });
    setCloning(null);
    if (error) return toast.error(error.message);
    toast.success(`"${tpl.nome}" adicionado aos seus modelos`);
  }

  return (
    <div className="p-8">
      <Link
        to="/app/contratos/modelos"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para Modelos de contrato
      </Link>

      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Sparkles className="h-6 w-6 text-primary" />
          Biblioteca de modelos prontos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Modelos jurídicos pré-elaborados para imobiliárias. Clique em "Usar este modelo" para
          clonar para a sua conta — você poderá editar livremente depois.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        {BUILTIN_TEMPLATES.map((tpl) => (
          <div
            key={tpl.slug}
            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{tpl.nome}</div>
                <Badge variant="secondary" className="mt-1 capitalize">
                  {tpl.tipo.replace("_", " ")}
                </Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{tpl.descricao}</p>
            <div className="mt-1 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                disabled={cloning === tpl.slug}
                onClick={() => applyBuiltinTemplate(tpl)}
              >
                {cloning === tpl.slug ? "Adicionando…" : "Usar este modelo"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
