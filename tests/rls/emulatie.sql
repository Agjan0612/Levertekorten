-- Bootst het deel van Supabase na dat het schema gebruikt: de rollen anon en
-- authenticated, auth.jwt() (het inlogbewijs) en de publicatie voor Realtime.
-- Alleen voor de test; in Supabase bestaat dit al.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create function auth.jwt() returns jsonb language sql stable
  as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.jwt() to anon, authenticated;
grant usage on schema public to anon, authenticated;
create publication supabase_realtime;
