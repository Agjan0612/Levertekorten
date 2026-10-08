-- =====================================================================
-- Levertekorten – database voor de beoordelingsapp (Supabase)
--
-- Gebruik: Supabase → SQL Editor → New query → plak dit hele bestand → Run.
-- Het script kan veilig opnieuw worden uitgevoerd (bijvoorbeeld na een update).
--
-- Wie mag wat:
--   * Alleen e-mailadressen in de tabel "panel" kunnen iets doen.
--   * Een beoordelaar ziet en wijzigt alleen zijn of haar eigen oordelen en
--     voorstellen (blind beoordelen).
--   * De coördinator ziet alles en legt de eindbesluiten vast.
--   * De tabel "panel" zelf beheer je in het Supabase-dashboard (Table Editor).
-- =====================================================================

-- ---------- Panel: wie doet mee ----------
create table if not exists public.panel (
  email        text primary key check (email = lower(email)),
  naam         text not null,
  beoordelaar  boolean not null default true,
  coordinator  boolean not null default false
);

-- ---------- Hulpfuncties ----------
-- E-mailadres van wie is ingelogd (uit het inlogbewijs van Supabase).
create or replace function public.mijn_email() returns text
  language sql stable set search_path = public
  as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

-- "security definer": deze functies mogen de tabel panel lezen, ook als de
-- gebruiker dat zelf niet mag. Zo kunnen de regels hieronder ze gebruiken.
create or replace function public.is_beoordelaar() returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.panel where email = public.mijn_email() and beoordelaar) $$;

create or replace function public.is_coordinator() returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.panel where email = public.mijn_email() and coordinator) $$;

-- De app vraagt hiermee op wie er is ingelogd en welke rol die heeft.
create or replace function public.mijn_profiel() returns setof public.panel
  language sql stable security definer set search_path = public
  as $$ select * from public.panel where email = public.mijn_email() $$;

-- ---------- Oordelen: één regel per apotheker per alternatief ----------
create table if not exists public.oordelen (
  email        text not null default public.mijn_email(),
  bron         text not null,                 -- vingerafdruk van de versie van de lijst
  sleutel      text not null,                 -- "PRK|PRK alternatief"
  oordeel      text check (oordeel in ('akkoord', 'niet', 'bespreken')),
  toelichting  text not null default '',
  gewijzigd    timestamptz not null default now(),
  primary key (email, bron, sleutel)
);

-- ---------- Eigen voorstellen voor een ander alternatief ----------
create table if not exists public.voorstellen (
  id           uuid primary key default gen_random_uuid(),
  email        text not null default public.mijn_email(),
  bron         text not null,
  tekort_prk   text not null,
  prk          text not null,
  gegevens     jsonb not null default '{}'::jsonb,   -- generiek, voorbeeldartikel, ATC, toedieningsweg
  categorie    text not null,
  positie      integer,
  toelichting  text not null default '',
  gemaakt      timestamptz not null default now()
);
create index if not exists voorstellen_bron on public.voorstellen (bron);

-- ---------- Eindbesluiten van de coördinator (na paneloverleg) ----------
create table if not exists public.besluiten (
  bron        text not null,
  soort       text not null check (soort in ('regel', 'voorstel')),
  sleutel     text not null,
  besluit     text check (besluit in ('akkoord', 'afgewezen')),
  categorie   text,
  positie     integer,
  notitie     text not null default '',
  door        text not null default public.mijn_email(),
  gewijzigd   timestamptz not null default now(),
  primary key (bron, soort, sleutel)
);

-- ---------- Instellingen van de coördinator per versie ----------
create table if not exists public.coordinatie (
  bron                 text primary key,
  gepubliceerd         jsonb,                 -- de ingeladen gepubliceerde adviezenlijst
  verwijder_afgewezen  boolean not null default false,
  gewijzigd            timestamptz not null default now()
);

-- ---------- "gewijzigd" automatisch bijwerken ----------
create or replace function public.zet_gewijzigd() returns trigger
  language plpgsql set search_path = public as $$ begin new.gewijzigd := now(); return new; end $$;
drop trigger if exists oordelen_gewijzigd on public.oordelen;
create trigger oordelen_gewijzigd before update on public.oordelen for each row execute function public.zet_gewijzigd();
drop trigger if exists besluiten_gewijzigd on public.besluiten;
create trigger besluiten_gewijzigd before update on public.besluiten for each row execute function public.zet_gewijzigd();
drop trigger if exists coordinatie_gewijzigd on public.coordinatie;
create trigger coordinatie_gewijzigd before update on public.coordinatie for each row execute function public.zet_gewijzigd();

-- ---------- Toegang: alleen ingelogde gebruikers, verder via de regels ----------
revoke all on public.panel, public.oordelen, public.voorstellen, public.besluiten, public.coordinatie from anon;
grant select on public.panel to authenticated;
grant select, insert, update, delete on public.oordelen, public.voorstellen, public.besluiten, public.coordinatie to authenticated;
revoke execute on function public.mijn_profiel(), public.is_beoordelaar(), public.is_coordinator(), public.mijn_email() from public, anon;
grant execute on function public.mijn_profiel(), public.is_beoordelaar(), public.is_coordinator(), public.mijn_email() to authenticated;

-- ---------- Wakker houden ----------
-- Een gratis Supabase-project pauzeert na ongeveer een week zonder gebruik. De workflow
-- .github/workflows/wakker-houden.yml roept daarom elke drie dagen deze functie aan (zonder inlog).
-- Ze geeft alleen 'true' terug en leest geen tabellen.
create or replace function public.wakker() returns boolean
  language sql stable set search_path = '' as $$ select true $$;
revoke execute on function public.wakker() from public;
grant execute on function public.wakker() to anon, authenticated;

alter table public.panel       enable row level security;
alter table public.oordelen    enable row level security;
alter table public.voorstellen enable row level security;
alter table public.besluiten   enable row level security;
alter table public.coordinatie enable row level security;

-- panel: ieder ziet zijn eigen regel, de coördinator ziet iedereen.
drop policy if exists panel_lezen on public.panel;
create policy panel_lezen on public.panel for select to authenticated
  using (email = public.mijn_email() or public.is_coordinator());

-- oordelen: blind – alleen je eigen, behalve voor de coördinator (lezen).
drop policy if exists oordelen_lezen on public.oordelen;
create policy oordelen_lezen on public.oordelen for select to authenticated
  using (email = public.mijn_email() or public.is_coordinator());
drop policy if exists oordelen_toevoegen on public.oordelen;
create policy oordelen_toevoegen on public.oordelen for insert to authenticated
  with check (email = public.mijn_email() and public.is_beoordelaar());
drop policy if exists oordelen_wijzigen on public.oordelen;
create policy oordelen_wijzigen on public.oordelen for update to authenticated
  using (email = public.mijn_email()) with check (email = public.mijn_email() and public.is_beoordelaar());
drop policy if exists oordelen_verwijderen on public.oordelen;
create policy oordelen_verwijderen on public.oordelen for delete to authenticated
  using (email = public.mijn_email());

-- voorstellen: zelfde regels als oordelen.
drop policy if exists voorstellen_lezen on public.voorstellen;
create policy voorstellen_lezen on public.voorstellen for select to authenticated
  using (email = public.mijn_email() or public.is_coordinator());
drop policy if exists voorstellen_toevoegen on public.voorstellen;
create policy voorstellen_toevoegen on public.voorstellen for insert to authenticated
  with check (email = public.mijn_email() and public.is_beoordelaar());
drop policy if exists voorstellen_wijzigen on public.voorstellen;
create policy voorstellen_wijzigen on public.voorstellen for update to authenticated
  using (email = public.mijn_email()) with check (email = public.mijn_email() and public.is_beoordelaar());
drop policy if exists voorstellen_verwijderen on public.voorstellen;
create policy voorstellen_verwijderen on public.voorstellen for delete to authenticated
  using (email = public.mijn_email());

-- besluiten en coördinatie: alleen de coördinator.
drop policy if exists besluiten_coordinator on public.besluiten;
create policy besluiten_coordinator on public.besluiten for all to authenticated
  using (public.is_coordinator()) with check (public.is_coordinator());
drop policy if exists coordinatie_coordinator on public.coordinatie;
create policy coordinatie_coordinator on public.coordinatie for all to authenticated
  using (public.is_coordinator()) with check (public.is_coordinator());

-- ---------- Live bijwerken (Supabase Realtime) ----------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['oordelen', 'voorstellen', 'besluiten', 'coordinatie'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- =====================================================================
-- Panel vullen: pas de e-mailadressen en namen aan en voer dit deel uit
-- (of voeg de regels toe via Table Editor → panel). E-mailadressen in kleine letters.
--
-- insert into public.panel (email, naam, beoordelaar, coordinator) values
--   ('naam1@voorbeeld.nl', 'Voornaam Achternaam', true, false),
--   ('naam2@voorbeeld.nl', 'Voornaam Achternaam', true, false),
--   ('naam3@voorbeeld.nl', 'Voornaam Achternaam', true, true)
-- on conflict (email) do update set naam = excluded.naam, beoordelaar = excluded.beoordelaar, coordinator = excluded.coordinator;
-- =====================================================================
