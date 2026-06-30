-- Fix: chave "modulos" ausente em plans.limites — trigger trg_tenant_modules_quota
-- retornava quota=0 e bloqueava provisionamento de módulos no trial Business.

UPDATE public.plans SET limites = limites || '{"modulos": -1}'::jsonb WHERE slug = 'business';
UPDATE public.plans SET limites = limites || '{"modulos": 8}'::jsonb  WHERE slug = 'pro';
UPDATE public.plans SET limites = limites || '{"modulos": 5}'::jsonb  WHERE slug = 'standard';
UPDATE public.plans SET limites = limites || '{"modulos": 3}'::jsonb  WHERE slug = 'basic';
UPDATE public.plans SET limites = limites || '{"modulos": 0}'::jsonb  WHERE slug = 'free';
