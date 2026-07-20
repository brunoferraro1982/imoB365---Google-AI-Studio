-- Remove tenants.dominio_proprio: nunca teve verificação DNS real (feature
-- decorativa, editada de forma divergente por duas telas — imobiliaria.tsx
-- e branding.tsx, com textos de instrução diferentes entre si). Ambas as
-- telas foram consolidadas em app.site.index.tsx (Identidade/Marca), sem a
-- seção de domínio próprio.
alter table public.tenants drop column if exists dominio_proprio;
