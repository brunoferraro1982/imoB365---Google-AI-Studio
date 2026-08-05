-- Marca d'água opcional sobre fotos de imóvel (logo do tenant sobreposto,
-- feito 100% client-side via <canvas>) — objetivo: dificultar cópia das
-- fotos por concorrentes que salvam imagens direto do site público.
--
-- Toggle é por imóvel, não por foto (decisão de produto: simplicidade >
-- granularidade). A logo usada é sempre tenants.tema.logo_url, o mesmo
-- campo já usado em /app/site "Marca" (ver src/lib/tenantBranding.ts) —
-- pra corretor autônomo esse campo já é a foto pessoal dele, cobrindo os
-- dois casos sem seletor extra.
ALTER TABLE public.imoveis
  ADD COLUMN marca_dagua_ativa boolean NOT NULL DEFAULT false;

-- storage_path em imovel_fotos precisa continuar sendo SEMPRE o arquivo
-- servido publicamente (rota /imovel/$slug lê storage_path direto, sem
-- lógica condicional) — então quando a marca d'água é aplicada, o arquivo
-- ORIGINAL sem marca é preservado à parte pra permitir reverter ou
-- reprocessar (ex.: tenant troca a logo) sem pedir novo upload.
--
-- Invariante: storage_path_original IS NULL significa "storage_path já É
-- o arquivo original, nunca teve marca d'água aplicada por esta feature".
-- storage_path_original IS NOT NULL significa "storage_path aponta pro
-- arquivo COM marca; storage_path_original aponta pro arquivo cru".
-- Nunca existe um terceiro estado por foto.
ALTER TABLE public.imovel_fotos
  ADD COLUMN storage_path_original text;

COMMENT ON COLUMN public.imoveis.marca_dagua_ativa IS
  'Se true, novos uploads de foto e reprocessamentos manuais aplicam a logo do tenant (tenants.tema.logo_url) sobre a foto antes de publicar.';
COMMENT ON COLUMN public.imovel_fotos.storage_path_original IS
  'Path do arquivo original (sem marca d''água) no bucket imovel-fotos, quando storage_path aponta pra uma versão com marca aplicada. NULL = storage_path já é o original.';
