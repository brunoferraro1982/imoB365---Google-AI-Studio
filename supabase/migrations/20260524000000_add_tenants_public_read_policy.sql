-- Allow public select on tenants (basic columns) for landing pages and subdomains
create policy "tenants_public_read" on public.tenants
  for select to anon, authenticated
  using (status in ('active', 'trial'));
