import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { marcarAtrasados } from "@/lib/inadimplencia";

export const verificarInadimplenciaAgora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    return marcarAtrasados(supabase);
  });
