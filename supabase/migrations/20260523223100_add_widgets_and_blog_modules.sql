insert into public.modules (slug, nome, descricao, requires_plan, core) values
  ('widgets', 'Widgets de Conversão', 'Capturadores flutuantes, calculadoras financeiras e CTAs inteligentes para seu site', 'pro', false),
  ('blog', 'Blog Imobiliário', 'Criação de artigos, notícias e conteúdos SEO para atração de leads', 'pro', false)
on conflict (slug) do nothing;
