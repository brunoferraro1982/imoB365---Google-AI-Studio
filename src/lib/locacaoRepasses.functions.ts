import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gerarRepassesDoMes } from "@/lib/locacaoRepasses";

export const gerarRepassesAgora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    return gerarRepassesDoMes(supabase);
  });
