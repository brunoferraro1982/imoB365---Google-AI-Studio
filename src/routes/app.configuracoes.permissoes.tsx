import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Shield, RotateCcw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { listTenantMembers } from "@/lib/team.functions";
import { can } from "@/lib/permissions";
import type { AppModule, AppAction } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/app/configuracoes/permissoes")({
  component: Permissoes,
});

const MODULES: { id: AppModule; label: string }[] = [
  { id: "imobiliario", label: "Imobiliário" },
  { id: "juridico",    label: "Jurídico"    },
  { id: "financeiro",  label: "Financeiro"  },
  { id: "marketing",   label: "Marketing"   },
  { id: "elearning",   label: "E-Learning"  },
  { id: "ajustes",     label: "Ajustes"     },
];

const ACTIONS: { id: AppAction; label: string }[] = [
  { id: "read",   label: "Visualizar" },
  { id: "write",  label: "Editar"     },
  { id: "delete", label: "Excluir"    },
  { id: "config", label: "Configurar" },
];

type MemberOption = { user_id: string; nome: string | null; email: string | null; roles: string[] };
type Override = { module: string; action: string; granted: boolean };

function Permissoes() {
  const { tenantId, isAdmin, roles: myRoles } = useAuth();
  const listMembers = useServerFn(listTenantMembers);

  const [members, setMembers]           = useState<MemberOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [overrides, setOverrides]       = useState<Override[]>([]);
  const [saving, setSaving]             = useState<string>("");  // "module:action"

  useEffect(() => {
    if (!tenantId || !isAdmin) return;
    listMembers({ data: { tenantId } }).then(({ members: m }) => setMembers(m));
  }, [tenantId, isAdmin]);

  useEffect(() => {
    if (!selectedUserId || !tenantId) return;
    supabase
      .from("user_permissions")
      .select("module, action, granted")
      .eq("tenant_id", tenantId)
      .eq("user_id", selectedUserId)
      .then(({ data }) => setOverrides(data ?? []));
  }, [selectedUserId, tenantId]);

  const selectedMember = members.find((m) => m.user_id === selectedUserId);

  function getOverride(module: AppModule, action: AppAction): Override | undefined {
    return overrides.find((o) => o.module === module && o.action === action);
  }

  function effectiveGranted(module: AppModule, action: AppAction): boolean {
    const ov = getOverride(module, action);
    if (ov !== undefined) return ov.granted;
    const memberRoles = (selectedMember?.roles ?? []) as Parameters<typeof can>[0];
    return can(memberRoles, module, action);
  }

  async function handleToggle(module: AppModule, action: AppAction) {
    if (!selectedUserId || !tenantId) return;
    const key = `${module}:${action}`;
    setSaving(key);

    const ov = getOverride(module, action);
    const memberRoles = (selectedMember?.roles ?? []) as Parameters<typeof can>[0];
    const roleDefault = can(memberRoles, module, action);
    const currentEffective = effectiveGranted(module, action);
    const newGranted = !currentEffective;

    if (newGranted === roleDefault && ov !== undefined) {
      // Reset para padrão: remove override
      const { error } = await supabase.rpc("remove_user_permission", {
        p_user_id: selectedUserId,
        p_module:  module,
        p_action:  action,
      });
      if (error) { toast.error("Erro ao remover override"); }
      else {
        setOverrides((prev) => prev.filter((o) => !(o.module === module && o.action === action)));
      }
    } else {
      // Cria ou atualiza override
      const { error } = await supabase.rpc("set_user_permission", {
        p_user_id: selectedUserId,
        p_module:  module,
        p_action:  action,
        p_granted: newGranted,
      });
      if (error) { toast.error("Erro ao salvar permissão"); }
      else {
        setOverrides((prev) => {
          const filtered = prev.filter((o) => !(o.module === module && o.action === action));
          return [...filtered, { module, action, granted: newGranted }];
        });
      }
    }
    setSaving("");
  }

  async function handleResetAll() {
    if (!selectedUserId || !tenantId) return;
    const { error } = await supabase
      .from("user_permissions")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("user_id", selectedUserId);
    if (error) { toast.error("Erro ao redefinir permissões"); }
    else {
      setOverrides([]);
      toast.success("Permissões redefinidas para padrão da role");
    }
  }

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Acesso restrito a administradores.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Permissões da Equipe</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        Conceda ou revogue ações específicas por usuário. Overrides têm prioridade sobre a role padrão.
      </p>

      {/* Seletor de membro */}
      <div className="flex items-center gap-3">
        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Selecione um membro..." />
          </SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.user_id} value={m.user_id}>
                {m.nome ?? m.email ?? m.user_id}
                {m.roles.length > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground">({m.roles.join(", ")})</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedUserId && overrides.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleResetAll}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Redefinir tudo
          </Button>
        )}
      </div>

      {/* Matriz de permissões */}
      {selectedMember && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-3 font-medium w-36">Módulo</th>
                {ACTIONS.map((a) => (
                  <th key={a.id} className="text-center px-4 py-3 font-medium">
                    {a.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((mod, idx) => (
                <tr key={mod.id} className={idx % 2 === 0 ? "" : "bg-muted/20"}>
                  <td className="px-4 py-3 font-medium text-foreground/80">{mod.label}</td>
                  {ACTIONS.map((act) => {
                    const ov = getOverride(mod.id, act.id);
                    const granted = effectiveGranted(mod.id, act.id);
                    const hasOverride = ov !== undefined;
                    const key = `${mod.id}:${act.id}`;
                    const isSavingThis = saving === key;

                    return (
                      <td key={act.id} className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggle(mod.id, act.id)}
                          disabled={isSavingThis}
                          className={[
                            "inline-flex items-center justify-center w-8 h-8 rounded-md border transition-colors",
                            granted
                              ? hasOverride
                                ? "bg-green-100 border-green-400 text-green-700"
                                : "bg-green-50 border-green-200 text-green-600"
                              : hasOverride
                              ? "bg-red-100 border-red-400 text-red-700"
                              : "bg-muted/30 border-border text-muted-foreground/40",
                            isSavingThis ? "opacity-50 cursor-wait" : "hover:opacity-80 cursor-pointer",
                          ].join(" ")}
                          title={
                            hasOverride
                              ? `Override: ${granted ? "concedido" : "revogado"} — clique para ${granted ? "revogar" : "conceder"}`
                              : `Padrão da role: ${granted ? "permitido" : "bloqueado"} — clique para ${granted ? "revogar" : "conceder"}`
                          }
                        >
                          {granted ? "✓" : "–"}
                        </button>
                        {hasOverride && (
                          <div className="mt-0.5">
                            <Badge variant="outline" className="text-[10px] px-1 py-0 leading-tight">
                              override
                            </Badge>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedMember && (
        <p className="text-xs text-muted-foreground">
          ✓ verde = permitido &nbsp;|&nbsp; – cinza = bloqueado por role &nbsp;|&nbsp;
          <Badge variant="outline" className="text-[10px] px-1 py-0">override</Badge>{" "}
          = permissão explícita (sobrepõe role padrão)
        </p>
      )}

      {!selectedUserId && (
        <div className="border border-dashed rounded-lg p-10 text-center text-muted-foreground">
          Selecione um membro da equipe para gerenciar suas permissões.
        </div>
      )}
    </div>
  );
}
