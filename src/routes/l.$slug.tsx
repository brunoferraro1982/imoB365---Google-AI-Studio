import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/l/$slug")({
  beforeLoad: async ({ params }) => {
    const { data } = await (supabase as any)
      .from("short_links")
      .select("id, target_url, utm_source, utm_medium, utm_campaign, clicks_count")
      .eq("slug", params.slug)
      .maybeSingle();
    if (!data) throw redirect({ to: "/" });

    // registra clique (best-effort)
    try {
      await (supabase as any).from("short_link_clicks").insert({
        short_link_id: data.id,
        referrer: typeof document !== "undefined" ? document.referrer : null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      });
      await (supabase as any)
        .from("short_links")
        .update({ clicks_count: (data.clicks_count ?? 0) + 1 })
        .eq("id", data.id);
    } catch {}

    const url = new URL(data.target_url);
    if (data.utm_source) url.searchParams.set("utm_source", data.utm_source);
    if (data.utm_medium) url.searchParams.set("utm_medium", data.utm_medium);
    if (data.utm_campaign) url.searchParams.set("utm_campaign", data.utm_campaign);

    if (typeof window !== "undefined") {
      window.location.replace(url.toString());
    }
    throw redirect({ to: "/" });
  },
  component: () => <div className="p-8 text-sm text-muted-foreground">Redirecionando…</div>,
});
