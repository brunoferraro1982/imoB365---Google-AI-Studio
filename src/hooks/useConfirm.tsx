/**
 * useConfirm — hook para confirmação de ações destrutivas via AlertDialog shadcn/ui.
 * Substitui o bloqueante window.confirm() em todos os módulos.
 *
 * Uso:
 *   const { confirmDialog, ConfirmDialog } = useConfirm();
 *   // No JSX: <ConfirmDialog />
 *   // Na função: if (!(await confirmDialog("Excluir este imóvel?"))) return;
 */
import { useState, useCallback, useRef } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmOptions {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
}

export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ description: "" });
  const resolveRef = useRef<(value: boolean) => void>(() => {});

  const confirmDialog = useCallback((description: string, opts?: Partial<ConfirmOptions>) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setOptions({ description, title: opts?.title ?? "Confirmar ação", ...opts });
      setOpen(true);
    });
  }, []);

  function handleConfirm() {
    setOpen(false);
    resolveRef.current(true);
  }

  function handleCancel() {
    setOpen(false);
    resolveRef.current(false);
  }

  function ConfirmDialog() {
    return (
      <AlertDialog
        open={open}
        onOpenChange={(v) => {
          if (!v) handleCancel();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{options.title ?? "Confirmar ação"}</AlertDialogTitle>
            <AlertDialogDescription>{options.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>
              {options.cancelLabel ?? "Cancelar"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={
                (options.variant ?? "destructive") === "destructive"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              {options.confirmLabel ?? "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return { confirmDialog, ConfirmDialog };
}
